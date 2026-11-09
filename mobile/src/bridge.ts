// Runs inside the trusted company origin: cookies stay inside the WebView.
export const bridgeScript = `(function(){
 if(window.__smartPowerMobile)return true;window.__smartPowerMobile=true;
 var send=function(data){window.ReactNativeWebView.postMessage(JSON.stringify(data))};
 fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(u){send({type:'session',role:u&&u.role||null})}).catch(function(){});
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
