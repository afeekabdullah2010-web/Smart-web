"""Verify full Netlify build boundaries and static links."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
import tempfile
import json
from build_netlify import build
class Links(HTMLParser):
    def __init__(self):super().__init__();self.references=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in {'href','src'} and value:self.references.append(value)
with tempfile.TemporaryDirectory() as tmp:
    root=build(Path(tmp)/'site');rules=(root/'_redirects').read_text()
    for page in root.glob('*.html'):
        assert 'rel="icon" type="image/png" href="/assets/smart-power-logo.png"' in page.read_text(),page.name
        parser=Links();parser.feed(page.read_text())
        for value in parser.references:
            u=urlparse(value)
            if u.scheme or u.netloc or not u.path:continue
            if u.path=='/':assert(root/'index.html').is_file();continue
            path=root/u.path.lstrip('/') if u.path.startswith('/') else page.parent/u.path
            assert path.is_file() or u.path.startswith('/auth/'),(page.name,value)
    for forbidden in ['smart_power.db','server.py','admin.html','staff-dashboard.html','profile.html','tests']:
        assert not(root/forbidden).exists(),forbidden
    for route in ['/auth/*','/api/*','/admin.html','/profile.html','/staff-salary.html']:
        assert route+' /.netlify/functions/company/' in rules,route
    assert '"database":true' in (root/'hosting-config.js').read_text()
    assert 'data-netlify' not in (root/'contact.html').read_text()
    assert (Path(__file__).parents[1]/'netlify/lib/templates.mjs').is_file()
    repo=Path(__file__).parents[1]
    assert not (repo/'netlify/database').exists()
    assert '@netlify/database' not in json.loads((repo/'package.json').read_text())['dependencies']
    assert (repo/'database/migrations/20261101180000_company.sql').is_file()
    print('PASS: public links/assets, authenticated function routes, private template packaging and database/source exclusion.')
