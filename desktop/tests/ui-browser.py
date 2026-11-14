"""Exercise the shared Windows renderer with a narrow mock of Electron's preload API."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import shutil,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'ui'),**kwargs)
 def do_GET(self):
  if self.path.split('?')[0] in ['/home','/services','/projects','/contact','/workspace']:self.path='/index.html'
  super().do_GET()
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
script="""(()=>{
 const origin='https://smpowenginnworks.netlify.app';
 let state={url:origin+'/api/mobile/entry',loading:false,error:null,canGoBack:false,role:null,id:null,dashboard:null};
 const listeners=[];window.commands=[];window.surfaces=[];
 window.emitDesktop=value=>{state={...state,...value};listeners.forEach(listener=>listener(state))};
 window.smartPowerDesktop={getState:async()=>state,onState:listener=>{listeners.push(listener);return()=>{}},surface:async rect=>{window.surfaces.push(rect)},command:async value=>{
 window.commands.push(value);
 if(value.type==='guest')window.emitDesktop({url:origin+'/',loading:false});
 if(value.type==='navigate')window.emitDesktop({url:origin+value.path,loading:false});
 if(value.type==='auth')window.emitDesktop({url:origin+'/api/mobile/auth/'+value.action+'?role='+value.role,loading:false});
 }};
})();"""
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1240,'height':850});errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.add_init_script(script)
  page.goto(f'http://127.0.0.1:{server.server_port}/');expect(page.get_by_role('button',name='Continue as Guest')).to_be_visible();expect(page.get_by_role('button',name='Create account',exact=True)).to_be_visible()
  (ROOT/'artifacts').mkdir(exist_ok=True);page.screenshot(path=str(ROOT/'artifacts/welcome.png'))
  page.get_by_role('tab',name='Staff',exact=True).click();page.get_by_role('button',name='Sign in',exact=True).click();assert page.evaluate('window.commands.at(-1)')=={'type':'auth','action':'login','role':'Staff'}
  page.evaluate("window.emitDesktop({url:'https://smpowenginnworks.netlify.app/staff-dashboard.html',role:'Staff',id:2,dashboard:{role:'Staff',userId:2,name:'Desktop Staff',summary:{pending:2,netSalary:80000},tasks:[]}})")
  expect(page.get_by_text('Hello, Desktop.',exact=True)).to_be_visible();page.get_by_text('My salary',exact=True).click();assert page.evaluate('window.commands.at(-1).path')=='/staff-salary.html'
  page.reload();page.get_by_role('button',name='Continue as Guest').click();expect(page.get_by_text('Engineering ideas.',exact=False)).to_be_visible();page.get_by_text('Our services',exact=True).click();assert page.evaluate('window.commands.at(-1).path')=='/services.html'
  page.get_by_role('tab',name='Workspace',exact=True).click();expect(page.get_by_role('button',name='Create account',exact=True)).to_be_visible();page.get_by_role('button',name='Admin sign in',exact=True).click();assert page.evaluate('window.commands.at(-1)')=={'type':'auth','action':'login','role':'Admin'}
  people=[{'key':'user-1','name':'Example Admin','email':'admin@example.test','role':'Admin','active':True},{'key':'user-2','name':'Example Staff','email':'staff@example.test','role':'Staff','active':True},{'key':'client-1','name':'Example Client','email':'client@example.test','role':'Client','active':True}]
  page.evaluate('(people)=>window.emitDesktop({url:"https://smpowenginnworks.netlify.app/admin.html",role:"Admin",id:1,dashboard:{role:"Admin",userId:1,name:"Example Admin",summary:{staff:1,clients:1,projects:2,requests:3},people}})',people)
  page.get_by_role('button',name='People · 3',exact=True).click();expect(page.get_by_text('Example Client',exact=True)).to_be_visible();expect(page.get_by_text('Example Staff',exact=True)).to_be_visible();page.get_by_role('button',name='Client',exact=True).click();expect(page.get_by_text('Example Client',exact=True)).to_be_visible();expect(page.get_by_text('Example Staff',exact=True)).to_have_count(0)
  page.screenshot(path=str(ROOT/'artifacts/admin-people.png'));assert not errors,errors;browser.close();print('PASS: shared desktop welcome, Staff routing, Guest company view, private Admin entry and all-role People filters.')
finally:server.shutdown();server.server_close()
