// Local regression server only. Production uses the Netlify Function entrypoint.
import https from 'node:https';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createCompany} from '../netlify/lib/company.mjs';
import templates from '../netlify/lib/templates.mjs';
const [dir,cert,key]=process.argv.slice(2);const db=new PGlite(join(dir,'postgres'));
if(!existsSync(join(dir,'migrated'))){await db.exec(await readFile('database/migrations/20261101180000_company.sql','utf8'));await writeFile(join(dir,'migrated'),'yes')}
const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
const store={set:async(k,v)=>{const p=join(dir,'uploads',k);await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p,v)},get:async k=>{try{return await readFile(join(dir,'uploads',k))}catch{return null}}};
const handler=createCompany({pool,store,templates,env:k=>k==='SMART_POWER_SETUP_KEY'?'temporary-owner-test-setup-key-32':undefined});
const base=resolve('dist/site');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=https.createServer({cert:await readFile(cert),key:await readFile(key)},async(req,res)=>{
 try{const buffers=[];for await(const chunk of req)buffers.push(chunk);const body=Buffer.concat(buffers),url=new URL(req.url,'https://localhost');const path=url.pathname;let response;
  if(path.startsWith('/api/')||path.startsWith('/auth/')||path.startsWith('/admin/')||templates[path.slice(1)])response=await handler(new Request('https://localhost'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}));
  else{const file=resolve(base,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(base+'/'))response=new Response('Not found',{status:404});else{try{response=new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}})}catch{response=new Response('Not found',{status:404})}}}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(500);res.end('Test server error')}
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));
