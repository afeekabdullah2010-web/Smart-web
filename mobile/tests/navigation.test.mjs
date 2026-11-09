import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { DEFAULT_SITE, siteOrigin, isInternal, externalKind, tabUrl, tabForUrl, canDownload, downloadName } from '../src/navigation.ts';
import { bridgeScript } from '../src/bridge.ts';

test('only the exact HTTPS company origin stays inside the app', () => {
  assert.equal(siteOrigin(), DEFAULT_SITE);
  for (const url of ['http://example.com','https://user:secret@example.com','https://example.com/path','https://example.com/?token=abc']) assert.throws(() => siteOrigin(url));
  assert.ok(isInternal(DEFAULT_SITE+'/auth/login', DEFAULT_SITE));
  for (const url of [DEFAULT_SITE+'.attacker.example/auth/login','http://smpowenginnworks.netlify.app','javascript:alert(1)','data:text/html,hi','file:///secret','https://user:pass@smpowenginnworks.netlify.app']) assert.equal(isInternal(url,DEFAULT_SITE),false,url);
  assert.equal(externalKind('tel:0773587109'),'contact');assert.equal(externalKind('mailto:office@example.com'),'contact');assert.equal(externalKind('https://maps.google.com'),'web');assert.equal(externalKind('intent://x'),null);
});
test('workspace routes use the current account role and protected pages remain in Workspace', () => {
  assert.equal(tabUrl('workspace',DEFAULT_SITE,null),DEFAULT_SITE+'/auth/login');
  assert.equal(tabUrl('workspace',DEFAULT_SITE,'Admin'),DEFAULT_SITE+'/admin.html');
  assert.equal(tabUrl('workspace',DEFAULT_SITE,'Staff'),DEFAULT_SITE+'/staff-dashboard.html');
  for (const path of ['/auth/login','/profile.html','/staff-tasks.html','/projects.html','/api/staff/payslip?id=5']) assert.equal(tabForUrl(DEFAULT_SITE+path),'workspace');
  assert.equal(tabForUrl(DEFAULT_SITE+'/our-projects'),'projects');assert.equal(tabForUrl(DEFAULT_SITE+'/service-electrical.html'),'services');
});
test('only authenticated report and payslip routes can be shared; names cannot escape cache', () => {
  assert.ok(canDownload(DEFAULT_SITE+'/api/admin/reports?kind=team',DEFAULT_SITE));
  assert.ok(canDownload(DEFAULT_SITE+'/api/staff/payslip?id=1&download=1',DEFAULT_SITE));
  for (const path of ['/api/me','/api/profile','/auth/login','/api/admin/users']) assert.equal(canDownload(DEFAULT_SITE+path,DEFAULT_SITE),false);
  assert.equal(canDownload('https://attacker.example/api/admin/reports',DEFAULT_SITE),false);
  assert.equal(canDownload(undefined,DEFAULT_SITE),false);
  assert.ok(!downloadName('../../salary','text/csv').includes('/'));
  assert.ok(downloadName('salary','text/html').endsWith('.html'));
});
test('WebView bridge sends role only, keeps authenticated fetch in origin, and rejects external downloads', async () => {
  const messages=[],listeners={},calls=[];
  const window={ReactNativeWebView:{postMessage:message=>messages.push(JSON.parse(message))}};
  const document={documentElement:{outerHTML:'<html>My payslip</html>'},addEventListener:(name,listener)=>{listeners[name]=listener}};
  const fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({role:'Staff',csrf:'never-send-this',email:'private@example.test'})}};
  vm.runInNewContext(bridgeScript,{window,document,fetch,location:new URL(DEFAULT_SITE),URL});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(messages,[{type:'session',role:'Staff'}]);assert.equal(calls[0].options.credentials,'same-origin');
  window.print();assert.deepEqual(messages.at(-1),{type:'print',html:'<html>My payslip</html>'});
  let prevented=false;
  listeners.click({target:{closest:()=>({href:'https://attacker.example/api/admin/reports',hasAttribute:()=>true})},preventDefault:()=>{prevented=true}});
  assert.equal(prevented,false);assert.equal(calls.length,1);
});
