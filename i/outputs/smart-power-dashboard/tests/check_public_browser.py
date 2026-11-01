"""Public multi-page navigation, language, animation and contact regression."""
import importlib.util
from pathlib import Path
import tempfile
import threading
import shutil
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('app',root/'server.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app);app.Handler.log_message=lambda *args:None
with tempfile.TemporaryDirectory() as tmp:
 app.DB=Path(tmp)/'public.db';app.LEGACY_DB=Path(tmp)/'absent.db';app.init_db()
 server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(base+'/');expect(page.get_by_role('heading',level=1)).to_be_visible();assert page.locator('header').bounding_box()['height']>=118
  assert page.locator('header .portal-btn').count()==0
  assert page.locator('footer .footer-links').count()==0
  expect(page.locator('footer').get_by_role('link',name='Company Administration',exact=True)).to_have_attribute('href','/auth/login?next=%2Fadmin.html')
  # Corporate home keeps the blue theme and a functional project showcase.
  expect(page.get_by_role('heading',name='Engineering ideas. Building tomorrow.',exact=True)).to_be_visible()
  page.locator('[data-project-next]').scroll_into_view_if_needed();page.locator('[data-project-next]').click();expect(page.locator('[data-project-count]')).to_have_text('2 / 3');expect(page.locator('[data-project-slide]:not([hidden]) h3')).to_have_text('Spaces built for momentum');page.locator('[data-project-prev]').click();expect(page.locator('[data-project-count]')).to_have_text('1 / 3');page.locator('[data-project-prev]').focus();page.keyboard.press('ArrowLeft');expect(page.locator('[data-project-count]')).to_have_text('3 / 3')
  for label,path in [('About Us','about.html'),('Services','services.html'),('Projects','our-projects.html'),('Contact','contact.html'),('Home','index.html')]:
   page.locator('nav').get_by_role('link',name=label,exact=True).click();page.wait_for_url('**/'+path);expect(page.locator('nav [aria-current=page]')).to_have_text(label);expect(page.get_by_role('heading',level=1)).to_be_visible();assert page.locator('header .portal-btn').count()==0
   for element in page.locator('.will-reveal').all():element.scroll_into_view_if_needed()
   page.wait_for_timeout(800);assert page.locator('.will-reveal:not(.is-visible)').count()==0
  # The skip link preserves keyboard focus and reaches content below the sticky header.
  page.goto(base+'/about.html');page.keyboard.press('Tab');expect(page.locator('.skip')).to_be_focused();page.keyboard.press('Enter');expect(page.locator('#main')).to_be_focused()
  page.locator('.language-select').select_option('ta');expect(page.locator('nav').get_by_role('link',name='சேவைகள்',exact=True)).to_be_visible();page.locator('nav').get_by_role('link',name='சேவைகள்',exact=True).click();page.wait_for_url('**/services.html');expect(page.locator('html')).to_have_attribute('lang','ta');page.locator('.language-select').select_option('si');expect(page.locator('nav').get_by_role('link',name='සේවා',exact=True)).to_be_visible();page.locator('.language-select').select_option('en')
  page.goto(base+'/contact.html');page.get_by_label('Your name',exact=True).fill('Public site test');page.get_by_label('Phone number',exact=True).fill('0771234567');page.get_by_label('Tell us about the project',exact=True).fill('Construction consultation');page.get_by_role('button',name='Send consultation request').click();expect(page.locator('.form-note')).to_have_text('Thank you. Your request has been sent to our office.')
  with app.connection() as db:assert db.execute("SELECT count(*) FROM records WHERE kind='consultations'").fetchone()[0]==1
  page.set_viewport_size({'width':390,'height':844});page.goto(base+'/index.html');expect(page.locator('.menu')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('.menu').click();expect(page.locator('.menu')).to_have_attribute('aria-expanded','true');page.locator('nav').get_by_role('link',name='About Us',exact=True).click();page.wait_for_url('**/about.html');expect(page.locator('.menu')).to_have_attribute('aria-expanded','false');page.locator('.menu').click();page.keyboard.press('Escape');expect(page.locator('.menu')).to_have_attribute('aria-expanded','false')
  # Check Tamil/Sinhala mastheads at phone width without horizontal overflow.
  for language in ['ta','si','en']:
   page.locator('.language-select').select_option(language);page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),language
  page.emulate_media(reduced_motion='reduce');page.goto(base+'/services.html');assert page.locator('main').evaluate("e=>getComputedStyle(e).animationName")=='none';assert page.locator('.will-reveal').count()==0
  page.locator('nav').get_by_role('link',name='Projects',exact=True).count() # Menu remains available without animation.
  assert not errors,errors;browser.close();print('PASS: five public pages, enlarged header, footer cleanup, active navigation, scroll reveals, transitions, keyboard skip, three languages, contact persistence, mobile layout/menu and reduced motion.')
 server.shutdown();server.server_close()
