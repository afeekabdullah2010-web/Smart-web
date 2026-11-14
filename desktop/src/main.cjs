const {app,BrowserWindow,WebContentsView,protocol,net,ipcMain,session,dialog,shell}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');const {pathToFileURL}=require('node:url');
const policy=require('./policy.cjs');
const common=require('../runtime/navigation.cjs');const {dashboardPage}=require('../runtime/dashboard.cjs');const {script:bridgeScript}=require('../runtime/bridge.json');
const ORIGIN=common.siteOrigin(),UI_ROOT=path.join(__dirname,'../ui');
protocol.registerSchemesAsPrivileged([{scheme:'smartpower-app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let window,remote,interval,queueBusy=false,principal='',surface=null,closing=false;
let state={url:ORIGIN+'/api/mobile/entry',loading:true,error:null,canGoBack:false,role:null,id:null,dashboard:null};
const smoke=process.argv.includes('--smoke-test');
function emit(){if(window&&!window.isDestroyed())window.webContents.send('desktop:changed',state)}
function update(value){state={...state,...value};emit()}
function hide(){if(remote)remote.setVisible(false)}
function applySurface(){if(!window||!remote)return;const size=window.getContentBounds();const rect=policy.bounds(surface,size);if(rect&&!state.loading&&!state.error){remote.setBounds(rect);remote.setVisible(true)}else hide()}
function trusted(event){if(!window||event.sender!==window.webContents||!event.senderFrame||!policy.shellUrl(event.senderFrame.url))throw Error('Untrusted desktop frame')}
function error(message){dialog.showMessageBox(window,{type:'info',title:'Smart Power',message:String(message).slice(0,300)}).catch(()=>{})}
async function external(url){
 const kind=common.externalKind(url);if(!kind)return;
 if(kind==='web'){const answer=await dialog.showMessageBox(window,{type:'question',title:'Open in browser?',message:new URL(url).hostname,buttons:['Cancel','Open'],defaultId:0,cancelId:0});if(answer.response!==1)return}
 try{await shell.openExternal(url)}catch{error('No application is available to open this link.')}
}
async function load(url){hide();update({url,loading:true,error:null,dashboard:null});try{await remote.webContents.loadURL(url)}catch{if(!closing&&state.url===url)update({loading:false,error:'Unable to connect. Check your internet connection.'})}}
function follow(event,url){url=event.url||url;if(common.isInternal(url,ORIGIN)){hide();update({url,loading:true,error:null,dashboard:null});return}event.preventDefault();void external(url);}
async function message(data){
 if(!data||typeof data!=='object')return;
 if(data.type==='session'){
  const role=['Admin','Staff','Client'].includes(data.role)?data.role:null,id=role&&Number.isInteger(data.id)?data.id:null;
  const next=role+':'+id;if(next!==principal)state.dashboard=null;principal=next;update({role,id});return;
 }
 if(data.type==='dashboard'){
  const d=data.dashboard;if(d&&d.role+':'+d.userId===principal&&state.role)update({dashboard:d});return;
 }
 if(data.type==='error'){error(data.message||'Please try again.');return}
 if(data.type==='print'){remote.webContents.print({silent:false},()=>{});return}
 if(data.type==='download'){
  if(!common.canDownload(data.url,ORIGIN)||!['text/csv','text/html'].includes(data.mime)||typeof data.base64!=='string'||data.base64.length>6700000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))return;
  const result=await dialog.showSaveDialog(window,{title:'Save Smart Power document',defaultPath:path.join(app.getPath('downloads'),policy.filename(data.name,data.mime)),filters:[{name:data.mime==='text/csv'?'CSV report':'HTML payslip',extensions:[data.mime==='text/csv'?'csv':'html']}]});
  if(!result.canceled&&result.filePath)await fs.writeFile(result.filePath,Buffer.from(data.base64,'base64'));
 }
}
async function poll(){
 if(queueBusy||closing||!remote||remote.webContents.isDestroyed()||!common.isInternal(remote.webContents.getURL(),ORIGIN))return;
 queueBusy=true;
 try{
  const messages=await remote.webContents.executeJavaScript('window.__smartPowerDesktopQueue ? window.__smartPowerDesktopQueue.splice(0,10) : []');
  for(const value of messages||[]){if(typeof value!=='string'||value.length>7000000)continue;try{await message(JSON.parse(value))}catch{error('Unable to complete the document action.')}}
 }catch{}finally{queueBusy=false}
}
function installIpc(){
 ipcMain.handle('desktop:state',event=>{trusted(event);return state});
 ipcMain.handle('desktop:surface',(event,value)=>{trusted(event);surface=policy.bounds(value,window.getContentBounds());applySurface()});
 ipcMain.handle('desktop:command',async(event,value)=>{
  trusted(event);if(!value||typeof value!=='object')throw Error('Invalid command');
  if(value.type==='navigate')return load(policy.companyPath(value.path,ORIGIN));
  if(value.type==='auth'){
   if(!['login','register'].includes(value.action)||!['Client','Staff','Admin'].includes(value.role))throw Error('Invalid account choice');
   return load(common.mobileAuthUrl(value.action,value.role,ORIGIN));
  }
  if(value.type==='guest')return load(ORIGIN+'/');
  if(value.type==='back'){if(remote.webContents.navigationHistory.canGoBack())remote.webContents.navigationHistory.goBack();return}
  if(value.type==='reload'){remote.webContents.reload();return}
  if(value.type==='logout'){
   if(common.isInternal(remote.webContents.getURL(),ORIGIN))await remote.webContents.executeJavaScript('window.spMobileLogout && window.spMobileLogout();true;');return;
  }
  throw Error('Unknown desktop command');
 });
}
async function createWindow(){
 const remoteSession=session.fromPartition('persist:smart-power-workspace');
 let cameraAllowed=false;
 remoteSession.setPermissionCheckHandler((contents,permission,origin,details)=>cameraAllowed&&contents===remote?.webContents&&permission==='media'&&common.isInternal(origin,ORIGIN)&&'mediaType' in details&&details.mediaType==='video');
 remoteSession.setPermissionRequestHandler(async(webContents,permission,callback,details)=>{
  if(webContents!==remote?.webContents||!common.isInternal(details.requestingUrl||webContents.getURL(),ORIGIN)||permission!=='media'||('mediaTypes' in details&&details.mediaTypes.includes('audio'))){callback(false);return}
  const answer=await dialog.showMessageBox(window,{type:'question',title:'Camera access',message:'Allow Smart Power to use the camera for a photo?',buttons:['Cancel','Allow'],defaultId:0,cancelId:0});cameraAllowed=answer.response===1;callback(cameraAllowed);
 });
 remoteSession.on('will-download',(event,item,contents)=>{
  if(contents!==remote?.webContents||!common.canDownload(item.getURL(),ORIGIN)){event.preventDefault();return}
  item.setSaveDialogOptions({title:'Save Smart Power document',defaultPath:path.join(app.getPath('downloads'),policy.filename(item.getFilename(),item.getMimeType().split(';')[0]))});
 });
 window=new BrowserWindow({width:1240,height:850,minWidth:720,minHeight:620,show:false,title:'Smart Power',backgroundColor:'#061d35',icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
 window.setMenuBarVisibility(false);
 remote=new WebContentsView({webPreferences:{session:remoteSession,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}});
 window.contentView.addChildView(remote);hide();
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!policy.shellUrl(event.url||url))event.preventDefault()});
 remote.webContents.setWindowOpenHandler(({url})=>{if(common.isInternal(url,ORIGIN))void load(url);else void external(url);return{action:'deny'}});
 remote.webContents.on('will-navigate',follow);remote.webContents.on('will-redirect',follow);
 remote.webContents.on('did-start-loading',()=>{hide();update({loading:true,error:null,dashboard:null})});
 remote.webContents.on('did-navigate',(_event,url)=>update({url,canGoBack:remote.webContents.navigationHistory.canGoBack()}));
 remote.webContents.on('did-navigate-in-page',(_event,url)=>{if(common.isInternal(url,ORIGIN))update({url,canGoBack:remote.webContents.navigationHistory.canGoBack()})});
 remote.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3){hide();update({loading:false,error:'Unable to connect. Check your internet connection.'})}});
 remote.webContents.on('render-process-gone',()=>{hide();update({loading:false,error:'Please refresh your workspace.'})});
 remote.webContents.on('did-finish-load',async()=>{
  if(!common.isInternal(remote.webContents.getURL(),ORIGIN))return;
  try{
   await remote.webContents.executeJavaScript('window.__smartPowerDesktopQueue=[];window.ReactNativeWebView={postMessage:function(value){if(window.__smartPowerDesktopQueue.length<30)window.__smartPowerDesktopQueue.push(String(value))}};'+bridgeScript);
   update({url:remote.webContents.getURL(),loading:false,error:null,canGoBack:remote.webContents.navigationHistory.canGoBack()});await poll();
  }catch{update({loading:false,error:'Please refresh your workspace.'})}
 });
 window.on('resize',()=>{hide();surface=null});
 window.on('closed',()=>{closing=true;clearInterval(interval);if(remote&&!remote.webContents.isDestroyed())remote.webContents.close();window=null});
 installIpc();
 await window.loadURL('smartpower-app://desktop/');
 if(smoke){
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){const text=await window.webContents.executeJavaScript('document.body.innerText');if(text.includes('Continue as Guest')&&text.includes('Create account')){console.log('PASS: Electron shared Client/Staff/Guest screen and preload.');app.exit(0);return}await new Promise(r=>setTimeout(r,200))}
  console.error('Desktop smoke test did not render the shared welcome screen.');app.exit(1);return;
 }
 window.show();interval=setInterval(()=>{void poll()},600);void load(ORIGIN+'/api/mobile/entry');
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
 app.whenReady().then(async()=>{
  protocol.handle('smartpower-app',async request=>{
   if(!policy.shellUrl(request.url))return new Response('Not found',{status:404});
   try{
    let file=policy.assetPath(UI_ROOT,request.url);
    try{const stat=await fs.stat(file);if(!stat.isFile())file=path.join(UI_ROOT,'index.html')}catch{if(path.extname(file))return new Response('Not found',{status:404});file=path.join(UI_ROOT,'index.html')}
    const response=await net.fetch(pathToFileURL(file).href);const headers=new Headers(response.headers);
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'");
    return new Response(response.body,{status:response.status,headers});
   }catch{return new Response('Not found',{status:404})}
  });await createWindow();
 }).catch(error=>{console.error('Unable to start desktop app:',error.message);app.exit(1)});
 app.on('window-all-closed',()=>app.quit());
}
