// Runs inside the trusted company origin: cookies stay inside the WebView.
export const bridgeScript = `(function(){
 if(window.__smartPowerMobile)return true;window.__smartPowerMobile=true;
 var style=document.createElement('style');style.textContent='.site-header,.sidebar,body>footer,body>main>header{display:none!important}.app{display:block!important}main,#workspace,#staffWorkspace{padding:18px!important}.page-intro{padding:24px 18px!important}.page-intro h1{font-size:32px!important}a.portal-btn{display:none!important}'+(location.pathname.indexOf('/api/mobile/')===0?'body>footer{display:none!important}':'');document.head.appendChild(style);
 var send=function(data){window.ReactNativeWebView.postMessage(JSON.stringify(data))};
 fetch('/api/mobile/me',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(u){
  send({type:'session',role:u&&u.role||null,id:u&&u.id});
  if(u&&u.role&&['/admin.html','/staff-dashboard.html','/api/mobile/client/dashboard'].includes(location.pathname)&&!new URLSearchParams(location.search).has('appWorkspace'))
   return fetch('/api/mobile/dashboard-data',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw Error('Dashboard unavailable');return r.json()}).then(function(data){send({type:'dashboard',dashboard:data})});
 }).catch(function(){});
 var workspace=new URLSearchParams(location.search).get('appWorkspace');
 if(['users','consultations','tasks','payroll','stafflogs','workupdates','support','notifications'].includes(workspace)&&window.spAccountReady)window.spAccountReady.then(function(){
  var selector=location.pathname==='/staff-dashboard.html'?(workspace==='notifications'?'[data-my-notifications]':'[data-support]'):'[data-action="'+workspace+'"]';
  var button=document.querySelector(selector);if(button)button.click();
  if(location.pathname==='/staff-dashboard.html')document.addEventListener('close',function(){location.replace('/staff-dashboard.html')},true);
 });
 window.spMobileLogout=function(){
  fetch('/api/mobile/me',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(me){return fetch('/api/mobile/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:me.csrf}).toString()})}).then(function(r){if(!r.ok)throw Error('Unable to sign out. Please try again.');location.assign('/api/mobile/entry')}).catch(function(error){send({type:'error',message:error.message})});
 };
 window.print=function(){send({type:'print',html:document.documentElement.outerHTML})};
 document.addEventListener('click',function(event){
  var link=event.target.closest&&event.target.closest('a');if(!link)return;
  var url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
  if(!link.hasAttribute('download')&&!(url.pathname==='/api/staff/payslip'&&url.searchParams.get('download')==='1'))return;
  if(!['/api/admin/reports','/api/staff/payslip'].includes(url.pathname))return;
  event.preventDefault();event.stopImmediatePropagation();
  fetch(url.href,{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok||r.redirected)throw Error('Please sign in again before downloading.');return r.blob()}).then(function(blob){
   if(blob.size>5000000)throw Error('This file is too large to share from the app.');
   var reader=new FileReader();reader.onload=function(){send({type:'download',url:url.href,mime:blob.type.split(';')[0],name:url.pathname==='/api/admin/reports'?'smart-power-'+(url.searchParams.get('kind')||'report')+'.csv':'smart-power-payslip.html',base64:String(reader.result).split(',')[1]})};reader.readAsDataURL(blob);
  }).catch(function(error){send({type:'error',message:error.message})});
 },true);return true;
})();true;`;
