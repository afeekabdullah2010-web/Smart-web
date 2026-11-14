const path=require('node:path');
function shellUrl(value){try{const u=new URL(value);return u.protocol==='smartpower-app:'&&u.host==='desktop'&&!u.username&&!u.password}catch{return false}}
function companyPath(value,origin){
 if(typeof value!=='string'||value.length>3000||!/^\/(?!\/)/.test(value)||/[\\\u0000-\u001f\u007f]/.test(value))throw Error('Invalid application path');
 const u=new URL(value,origin);if(u.origin!==origin||u.protocol!=='https:'||u.username||u.password)throw Error('Invalid company origin');return u.href;
}
function bounds(rect,size){
 if(!rect)return null;
 for(const k of ['x','y','width','height'])if(typeof rect[k]!=='number'||!Number.isFinite(rect[k]))throw Error('Invalid bounds');
 const x=Math.max(0,Math.min(Math.round(rect.x),size.width)),y=Math.max(0,Math.min(Math.round(rect.y),size.height));
 const width=Math.max(0,Math.min(Math.round(rect.width),size.width-x)),height=Math.max(0,Math.min(Math.round(rect.height),size.height-y));
 return width>0&&height>0?{x,y,width,height}:null;
}
function assetPath(root,value){
 let pathname;try{pathname=decodeURIComponent(new URL(value).pathname)}catch{throw Error('Invalid asset URL')}
 const file=path.resolve(root,'.'+pathname);const relative=path.relative(root,file);
 if(relative.startsWith('..')||path.isAbsolute(relative)||pathname.includes('\\')||pathname.includes('\0'))throw Error('Invalid asset path');return file;
}
function filename(value,mime){const clean=String(value||'smart-power').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,90)||'smart-power';const ext=mime==='text/csv'?'.csv':'.html';return clean.toLowerCase().endsWith(ext)?clean:clean+ext}
module.exports={shellUrl,companyPath,bounds,assetPath,filename};
