// Runs inside the trusted company origin: cookies stay inside the WebView.
export const bridgeScript = `(function(){
 if(window.__smartPowerMobile)return true;window.__smartPowerMobile=true;
 var style=document.createElement('style');style.textContent='.site-header,.sidebar,body>footer,body>main>header{display:none!important}.app{display:block!important}html,body{max-width:100%!important;overflow-x:hidden!important}main,#workspace,#staffWorkspace{padding:14px!important;max-width:100%!important}.page-intro{padding:20px 14px!important}.page-intro h1{font-size:28px!important}.card,.panel,.workspace-card{max-width:100%!important;overflow:hidden!important}table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}thead,tbody,tr{width:max-content!important;min-width:100%!important}th,td{min-width:112px!important;white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important;vertical-align:top!important}th:last-child,td:last-child{min-width:96px!important}input,select,textarea,button{max-width:100%!important}a.portal-btn{display:none!important}'+(location.pathname.indexOf('/api/mobile/')===0?'body>footer{display:none!important}':'');document.head.appendChild(style);
 var send=function(data){window.ReactNativeWebView.postMessage(JSON.stringify(data))};
 var dashboardAttempts=0;
 function loadDashboard(u){
  if(!u||!u.role||!['/admin.html','/staff-dashboard.html','/api/mobile/client/dashboard'].includes(location.pathname)||new URLSearchParams(location.search).has('appWorkspace'))return;
  dashboardAttempts++;
  fetch('/api/mobile/dashboard-data',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw Error('Dashboard unavailable');return r.json()}).then(function(data){send({type:'dashboard',dashboard:data})}).catch(function(error){if(dashboardAttempts<4)setTimeout(function(){loadDashboard(u)},dashboardAttempts*1200);else send({type:'dashboard-error',message:error.message})});
 }
 fetch('/api/mobile/me',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(u){send({type:'session',role:u&&u.role||null,id:u&&u.id});loadDashboard(u)}).catch(function(){});
 function removeNetlifyBadge(root){root=root||document;if(!root||typeof root.querySelectorAll!=='function')return;root.querySelectorAll('a,iframe,netlify-drawer,#netlify-drawer,[data-netlify-drawer],[style*="position: fixed"],[style*="position:fixed"]').forEach(function(node){var href=(node.getAttribute('href')||node.getAttribute('src')||'').toLowerCase(),label=(node.getAttribute('aria-label')||'').toLowerCase(),words=(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();if((href.indexOf('netlify')>=0||label.indexOf('powered by netlify')>=0||words==='powered by netlify'||words.endsWith('powered by netlify'))&&node!==document.body&&node!==document.documentElement)node.remove()});root.querySelectorAll('*').forEach(function(node){if(node.shadowRoot)removeNetlifyBadge(node.shadowRoot)})}
 removeNetlifyBadge();if(typeof MutationObserver==='function')new MutationObserver(function(){removeNetlifyBadge()}).observe(document.documentElement,{childList:true,subtree:true});if(typeof setInterval==='function')setInterval(removeNetlifyBadge,1200);
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
