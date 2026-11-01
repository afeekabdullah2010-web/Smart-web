"""Expanded company pages, accessible submenus and twelve service routes."""
import importlib.util
from pathlib import Path
import tempfile
import threading
import shutil
from playwright.sync_api import sync_playwright, expect
r=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('app',r/'server.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app);app.Handler.log_message=lambda *args:None
with tempfile.TemporaryDirectory() as tmp:
 app.DB=Path(tmp)/'company.db';app.LEGACY_DB=Path(tmp)/'absent.db';app.init_db();server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/index.html')
  for label in ['News','Careers','Contact Us']:expect(page.locator('#mainNav').get_by_role('link',name=label,exact=True)).to_be_visible()
  assert page.locator('header').get_by_role('link',name='Company Administration',exact=True).count()==0
  expect(page.locator('footer').get_by_role('link',name='Company Administration',exact=True)).to_be_visible()
  page.get_by_role('button',name='Show About pages',exact=True).click();expect(page.locator('#aboutMenu')).to_be_visible();expect(page.locator('#aboutMenu a')).to_have_text(['Leadership','Awards','Privacy Policy']);page.keyboard.press('Escape');expect(page.locator('#aboutMenu')).to_be_hidden()
  page.get_by_role('button',name='Show services',exact=True).click();expect(page.locator('#servicesMenu')).to_be_visible();service_links=page.locator('#servicesMenu .mega-grid a');assert service_links.count()==12;routes=service_links.evaluate_all('(nodes)=>nodes.map(n=>({href:n.getAttribute("href"),title:n.querySelector("b").textContent}))');text=page.locator('#servicesMenu').inner_text();assert 'Full Construction' in text and 'Solar & Wind Power' in text
  for excluded in ['Mobility','AVI','Fentons Information','ICT Systems']:assert excluded not in text
  page.get_by_role('heading',level=1).click();expect(page.locator('#servicesMenu')).to_be_hidden()
  page.goto(base+'/about.html');expect(page.locator('.about-parts a')).to_have_count(3)
  for route,title in [('leadership.html','Leadership & responsibility.'),('awards.html','Recognition & achievements.'),('privacy-policy.html','Your information. Handled with care.')]:
   page.get_by_role('button',name='Show About pages',exact=True).click()
   page.locator('#aboutMenu a[href="/'+route+'"]').click();page.wait_for_url('**/'+route);expect(page.get_by_role('heading',name=title,exact=True)).to_be_visible()
   if route=='leadership.html':expect(page.locator('.sample-leader')).to_have_count(3);expect(page.locator('.sample-profile-note')).to_have_text('These names, positions and portraits are temporary samples.')
  for item in routes:
   response=page.goto(base+item['href']);assert response.status==200;expect(page.get_by_role('heading',level=1)).to_have_text(item['title']);expect(page.locator('.service-detail li')).to_have_count(3);assert 'Fentons' not in page.locator('main').inner_text()
  page.goto(base+'/services.html');expect(page.locator('.service-catalogue [data-service]')).to_have_count(12);page.locator('.service-catalogue [data-service=electrical]').click();page.wait_for_url('**/service-electrical.html');page.get_by_role('link',name='Discuss this service').click();page.wait_for_url('**/contact.html?service=electrical');expect(page.locator('select[name=type]')).to_have_value('Electrical Systems')
  page.goto(base+'/careers.html');page.get_by_role('link',name='Send a career enquiry',exact=True).click();page.wait_for_url('**/contact.html?interest=careers');expect(page.locator('select[name=type]')).to_have_value('Career enquiry');page.get_by_label('Your name',exact=True).fill('Career enquiry test');page.get_by_label('Phone number',exact=True).fill('0771234567');page.locator('textarea[name=message]').fill('Engineer with site experience and immediate availability.');page.get_by_role('button',name='Send consultation request').click();expect(page.locator('.form-note')).to_have_text('Thank you. Your request has been sent to our office.')
  with app.connection() as db:
   import json
   data=json.loads(db.execute("SELECT data FROM records WHERE kind='consultations'").fetchone()[0]);assert data['type']=='Career enquiry'
  page.goto(base+'/news.html');expect(page.locator('.news-card')).to_have_count(2)
  page.set_viewport_size({'width':390,'height':844});page.goto(base+'/index.html');page.locator('.menu').click();page.get_by_role('button',name='Show services',exact=True).click();expect(page.locator('#servicesMenu')).to_be_visible();page.locator('#servicesMenu a[href="/service-industrial-accessories.html"]').click();page.wait_for_url('**/service-industrial-accessories.html');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for language in ['ta','si','en']:
   page.locator('.language-select').select_option(language);page.locator('.menu').click();page.locator('.submenu-toggle[aria-controls=aboutMenu]').click();expect(page.locator('#aboutMenu')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),language;page.keyboard.press('Escape');page.keyboard.press('Escape')
  page.set_viewport_size({'width':1440,'height':1000});page.goto(base+'/services.html');page.locator('.language-select').select_option('ta');expect(page.locator('.service-catalogue [data-service=construction] h3')).to_have_text('முழுமையான கட்டுமானம்');page.locator('.service-catalogue [data-service=construction]').click();page.wait_for_url('**/service-construction.html');expect(page.locator('html')).to_have_attribute('lang','ta');expect(page.get_by_role('heading',level=1)).to_have_text('முழுமையான கட்டுமானம்')
  assert not errors,errors;browser.close();print('PASS: News/Careers/Contact Us navigation; About submenu and three pages; twelve service pages with excluded categories absent; career/service enquiry persistence; desktop/mobile menus, Escape, language switching and ownership-preserving public routes.')
 server.shutdown();server.server_close()
