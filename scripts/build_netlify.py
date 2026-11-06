"""Build Smart Power public files and authenticated Netlify Function templates."""
from pathlib import Path
import importlib.util
import json
import shutil
import subprocess
import sys

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / 'i/outputs/smart-power-dashboard'
DESTINATION = REPO / 'dist/site'


def build(destination=DESTINATION):
    spec=importlib.util.spec_from_file_location('smart_power_source',SOURCE/'server.py')
    app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
    destination=Path(destination)
    if destination.exists():shutil.rmtree(destination)
    destination.mkdir(parents=True)
    public={name for name in app.PUBLIC_FILES if name.endswith('.html')}|{'public.css','public.js','i18n.js','assets/smart-power-logo.png'}
    assets={'app.js','app.css','auth.css','profile.js','staff.js'}
    config='<link rel="icon" type="image/png" href="/assets/smart-power-logo.png"><script src="/hosting-config.js"></script>'
    for name in sorted(public|assets):
        target=destination/name;target.parent.mkdir(parents=True,exist_ok=True)
        if name.endswith('.html'):target.write_text((SOURCE/name).read_text().replace('</head>',config+'</head>'))
        else:shutil.copyfile(SOURCE/name,target)
    (destination/'hosting-config.js').write_text('window.SMART_POWER_HOSTING = {"formMode":"backend","database":true};\n')
    templates={}
    for name in app.ADMIN_PAGES|set(app.ROLE_PAGES):
        templates[name]=(SOURCE/name).read_text().replace('</head>',config+'</head>')
    (REPO/'netlify/lib/templates.mjs').write_text('export default '+json.dumps(templates,ensure_ascii=False)+';\n')
    subprocess.run([sys.executable,str(REPO/'scripts/generate_manifest.py')],check=True)
    redirects=[]
    for prefix in ['auth','api','admin']:
        redirects.append(f'/{prefix}/* /.netlify/functions/company/{prefix}/:splat 200!')
    for name in sorted(templates):redirects.append(f'/{name} /.netlify/functions/company/{name} 200!')
    for name in app.DISABLED_PAGES:redirects.append(f'/{name} /404.html 404!')
    redirects+=['/smart_power.db /404.html 404!','/server.py /404.html 404!','/tests/* /404.html 404!']
    (destination/'_redirects').write_text('\n'.join(redirects)+'\n')
    (destination/'404.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/public.css"><link rel="icon" type="image/png" href="/assets/smart-power-logo.png"><title>Page not found | Smart Power</title></head><body><main class="page-intro"><h1>Page not found</h1><a class="button solid" href="/">Back to website</a></main></body></html>')
    assert not any((destination/name).exists() for name in templates)
    assert not any(p.suffix in {'.db','.py','.pyc'} for p in destination.rglob('*') if p.is_file())
    print(f'Full Netlify build ready: {len(public)} public assets, {len(templates)} authenticated pages, external Postgres + private Blobs.')
    return destination

if __name__=='__main__':build()
