"""App-only HTML/auth flow against isolated persistent PostgreSQL at phone viewport."""
from pathlib import Path
import subprocess,tempfile,shutil,json
from playwright.sync_api import sync_playwright,expect
REPO=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
 tmp=Path(tmp);cert=tmp/'cert.pem';key=tmp/'key.pem'
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=localhost'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
 process=subprocess.Popen(['node','tests-netlify/server.mjs',str(tmp),str(cert),str(key)],cwd=REPO,stdout=subprocess.PIPE,text=True)
 try:
  port=json.loads(process.stdout.readline())['port'];base=f'https://127.0.0.1:{port}'
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   def context():return browser.new_context(ignore_https_errors=True,viewport={'width':393,'height':852},is_mobile=True,has_touch=True)
   admin=context();setup=admin.request.post(base+'/auth/setup',form={'name':'Mobile Admin','email':'admin@example.test','password':'Test-password-123','confirm':'Test-password-123','setup_key':'temporary-owner-test-setup-key-32'});assert 'Account created' in setup.text()
   def signup(ctx,name,email,role):
    page=ctx.new_page();page.goto(base+'/api/mobile/auth/register?role='+role);page.get_by_label('Full name',exact=True).fill(name);page.get_by_label('Email',exact=True).fill(email);page.get_by_label('Password',exact=True).fill('Test-password-123');page.get_by_label('Confirm password',exact=True).fill('Test-password-123');page.get_by_role('button',name='Create account',exact=True).click();return page
   client=context();page=signup(client,'Mobile Client','client@example.test','Client');expect(page.get_by_role('heading',name='Welcome, Mobile Client',exact=True)).to_be_visible();assert client.request.get(base+'/api/admin/team').status==401
   bridge=(REPO/'mobile/src/bridge.ts').read_text().split('`',2)[1]
   page.evaluate("window.nativeMessages=[];window.ReactNativeWebView={postMessage:m=>window.nativeMessages.push(JSON.parse(m))};")
   page.evaluate(bridge);page.wait_for_function("window.nativeMessages.some(m=>m.type==='dashboard'&&m.dashboard.role==='Client')")
   page.get_by_role('link',name='New request',exact=True).click();page.get_by_label('Phone number',exact=True).fill('0771234567');page.get_by_label('Tell us about your project',exact=True).fill('Private mobile customer project');page.get_by_role('button',name='Send request',exact=True).click();expect(page.get_by_text('Your request has been sent to our office.',exact=True)).to_be_visible();expect(page.get_by_text('Private mobile customer project',exact=True)).to_be_visible()
   other=context();otherpage=signup(other,'Another Client','other@example.test','Client');expect(otherpage.get_by_text('No requests yet. Tell our team about your project.',exact=True)).to_be_visible();assert 'Private mobile customer project' not in otherpage.locator('body').inner_text()
   adminpage=admin.new_page();adminpage.goto(base+'/api/mobile/auth/login?role=Admin');expect(adminpage.get_by_text('Admin access',exact=True)).to_be_visible();expect(adminpage.get_by_role('link',name='Create account',exact=True)).to_have_count(0);adminpage.get_by_label('Email',exact=True).fill('admin@example.test');adminpage.get_by_label('Password',exact=True).fill('Test-password-123');adminpage.get_by_role('button',name='Sign in',exact=True).click();expect(adminpage.get_by_role('heading',name='Company overview',exact=True)).to_be_visible()
   adminpage.goto(base+'/admin.html?appWorkspace=consultations');adminpage.evaluate("window.nativeMessages=[];window.ReactNativeWebView={postMessage:m=>window.nativeMessages.push(JSON.parse(m))};");adminpage.evaluate(bridge);expect(adminpage.get_by_role('heading',name='Consultation requests',exact=True)).to_be_visible()
   me=admin.request.get(base+'/api/me').json();request=admin.request.get(base+'/api/admin/consultations').json()[0];response=admin.request.post(base+'/api/admin/consultations',data={'id':request['id'],'csrf':me['csrf'],'data':{**request,'status':'Contacted'}});assert response.status==200,response.text()
   page.reload();expect(page.get_by_role('heading',name='Request updated',exact=True)).to_be_visible();expect(page.get_by_text('Contacted',exact=True)).to_be_visible();otherpage.reload();assert 'Request updated' not in otherpage.locator('body').inner_text()
   staff=context();staffpage=signup(staff,'Phone Staff','phone-staff@example.test','Staff');expect(staffpage.get_by_role('heading',name='Welcome, Phone Staff',exact=True)).to_be_visible();assert any(r['email']=='phone-staff@example.test' for r in admin.request.get(base+'/api/admin/team').json())
   staffpage.goto(base+'/staff-dashboard.html?appWorkspace=notifications');staffpage.evaluate("window.nativeMessages=[];window.ReactNativeWebView={postMessage:m=>window.nativeMessages.push(JSON.parse(m))};");staffpage.evaluate(bridge);expect(staffpage.get_by_role('dialog').get_by_role('heading',name='My notifications',exact=True)).to_be_visible();staffpage.get_by_role('dialog').locator('[data-close]').click();staffpage.wait_for_url('**/staff-dashboard.html')
   page.get_by_role('button',name='Sign out',exact=True).click();page.wait_for_url('**/api/mobile/entry');assert client.request.get(base+'/api/mobile/me').json()['role'] is None
   page.goto(base+'/auth/login');assert page.locator('select[name=position] option').all_text_contents()==['Admin','Staffs']
   browser.close();print('PASS: phone-size Client/Staff signup, private customer dashboard, Admin sign-in, correct-recipient updates, cookie logout and unchanged website sign-in.')
 finally:
  process.terminate();process.wait(timeout=10)
