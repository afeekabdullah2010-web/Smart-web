import {randomBytes,createHash} from 'node:crypto';
const now=()=>Math.floor(Date.now()/1000),digest=v=>createHash('sha256').update(v).digest('hex');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clear=name=>name+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const cookie=(name,value)=>name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200';
const rawCookie=(req,name)=>(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const json=data=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
function redirect(path,cookies=[]){const headers=new Headers({Location:path,'Cache-Control':'no-store'});for(const value of cookies)headers.append('Set-Cookie',value);return new Response(null,{status:303,headers})}
function page(title,body,status=200){return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | Smart Power</title><link rel="icon" href="/assets/smart-power-logo.png"><style>*{box-sizing:border-box}body{margin:0;background:#f1f7fc;color:#102c43;font:16px/1.5 system-ui,sans-serif}main{max-width:780px;margin:auto;padding:28px 20px}header{display:flex;gap:12px;align-items:center;margin-bottom:28px}header img{width:50px;height:65px;object-fit:contain}header strong{letter-spacing:.07em;font-size:15px}header small{display:block;color:#56758d;font-size:10px;letter-spacing:.14em}h1{font-size:30px;line-height:1.2;margin-bottom:10px}h2{font-size:21px}.muted,small{color:#56758d}label{display:grid;gap:8px;margin:18px 0;font-weight:650}input,textarea,select{width:100%;padding:14px;font:inherit;border:1px solid #b8cede;border-radius:12px;background:white}textarea{min-height:120px}button,.button{display:inline-block;border:0;border-radius:12px;padding:14px 20px;background:#0086db;color:white;font:inherit;font-weight:750;text-decoration:none;cursor:pointer}form>button{width:100%}.secondary{background:#e2f1fc;color:#0068a9}a{color:#0077bb}.error{padding:12px;background:#fff0ef;color:#a02b23;border-radius:10px}.success{color:#17633a;background:#e9f9ef;padding:12px;border-radius:10px}.card{padding:20px;background:white;border:1px solid #d7e6f0;border-radius:18px;margin:16px 0}.card h3{margin:0 0 8px}.metrics{display:flex;gap:12px}.metrics .card{flex:1;text-align:center;padding:14px 8px}.metrics strong{display:block;font-size:28px}.actions{display:flex;flex-wrap:wrap;gap:12px}footer{text-align:center;padding:22px 12px 32px;color:#56758d;font-size:12px}footer a{font-weight:800;text-decoration:none}.status{color:#0068a9;font-weight:700}.small-form{max-width:490px;margin:auto}</style></head><body><main><header><img src="/assets/smart-power-logo.png" alt="Smart Power logo"><div><strong>SMART POWER</strong><small>ENGINEERING WORKS</small></div></header>'+body+'</main><footer>Powered by Smart <a aria-label="Admin sign in" href="/api/mobile/auth/login?role=Admin">Power</a></footer></body></html>',{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}
function authPage(kind,role,error=''){
 const register=kind==='register',href='/api/mobile/auth/';
 return page((register?'Create account':'Sign in')+' · '+role,'<section class="small-form"><p class="muted">'+esc(role)+' access</p><h1>'+(register?'Create your account':'Welcome back')+'</h1><p class="muted">'+(role==='Admin'?'Use your existing administrator account.':role==='Client'?'Manage your requests and connect with our team.':'Your attendance, tasks and salary in one place.')+'</p>'+(error?'<p class="error" role="alert">'+esc(error)+'</p>':'')+'<form method="post">'+(register?'<label>Full name<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label>':'')+'<label>Email<input name="email" type="email" required maxlength="160" autocomplete="email"></label><label>Password<input name="password" type="password" required minlength="12" maxlength="200" autocomplete="'+(register?'new-password':'current-password')+'"></label>'+(register?'<label>Confirm password<input name="confirm" type="password" required minlength="12" maxlength="200" autocomplete="new-password"></label>':'')+'<button>'+(register?'Create account':'Sign in')+'</button></form>'+(role==='Admin'?'':('<p>'+(register?'Already have an account?':'New to Smart Power?')+' <a href="'+href+(register?'login':'register')+'?role='+role+'">'+(register?'Sign in':'Create account')+'</a></p>'))+'<p><a href="/api/mobile/entry">Back to account options</a></p></section>');
}
const target=role=>role==='Admin'?'/admin.html':role==='Staff'?'/staff-dashboard.html':'/api/mobile/client/dashboard';

export function createMobile({query,tx,add,notice,syncStaffDirectory,hashPassword,verify,Problem}){
 const check=(ok,message,status=400)=>{if(!ok)throw new Problem(status,message)};
 async function clientSession(req){const raw=rawCookie(req,'sp_mobile_session');if(!raw)return null;return(await query('SELECT c.id,c.name,c.email,s.csrf_token FROM sp_mobile_client_sessions s JOIN sp_mobile_clients c ON c.id=s.client_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND c.active=TRUE',[digest(raw),now()]))[0]||null}
 async function form(req){const raw=await req.text();check(Buffer.byteLength(raw)<12000,'Form is too large.');return Object.fromEntries(new URLSearchParams(raw))}
 async function saveSession(account,role,client){
  const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
  if(role==='Client'){
   await query('DELETE FROM sp_mobile_client_sessions WHERE expires_at<$1',[now()],client);
   await query('INSERT INTO sp_mobile_client_sessions(token_hash,client_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',[digest(token),account.id,csrf,now()+43200],client);
  }else{
   await query('DELETE FROM sp_sessions WHERE expires_at<$1',[now()],client);
   await query('INSERT INTO sp_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',[digest(token),account.id,csrf,now()+43200],client);
  }
  return role==='Client'?[cookie('sp_mobile_session',token),clear('sp_session')]:[cookie('sp_session',token),clear('sp_mobile_session')];
 }
 function logoutForm(csrf){return '<form method="post" action="/api/mobile/auth/logout"><input type="hidden" name="csrf" value="'+esc(csrf)+'"><button class="secondary">Sign out</button></form>'}
 function requestForm(account,error=''){
  return '<h2>Request a consultation</h2>'+(error?'<p class="error" role="alert">'+esc(error)+'</p>':'')+'<form method="post" action="/api/mobile/client/request"><input type="hidden" name="csrf" value="'+esc(account.csrf_token)+'"><label>Phone number<input name="phone" type="tel" required maxlength="30" placeholder="07X XXX XXXX"></label><label>Service<select name="type"><option>Engineering works</option><option>Residential construction</option><option>Commercial construction</option><option>Renovation / project management</option></select></label><label>Tell us about your project<textarea name="message" required maxlength="2000"></textarea></label><button>Send request</button></form>';
 }
 return async function mobile(req,user,path){
  const url=new URL(req.url),read=['GET','HEAD'].includes(req.method),account=await clientSession(req);
  if(path==='/api/mobile/me'){check(read,'Method not allowed.',405);return json(account?{id:account.id,name:account.name,role:'Client',csrf:account.csrf_token}:user?{id:user.id,name:user.name,role:user.role,csrf:user.csrf_token}:{role:null})}
  if(path==='/api/mobile/dashboard-data'){
   check(read,'Method not allowed.',405);check(account||user,'Please sign in.',401);
   if(account){
    const requests=(await query("SELECT id,data FROM sp_records WHERE kind='consultations' AND data->>'mobile_client_id'=$1 ORDER BY id DESC",[String(account.id)])).map(r=>({...r.data,id:r.id}));
    const updates=(await query("SELECT data FROM sp_records WHERE kind='mobileclientnotice' AND data->>'client_id'=$1 ORDER BY id DESC LIMIT 20",[String(account.id)])).map(r=>r.data);
    return json({userId:account.id,role:'Client',name:account.name,summary:{requests:requests.length,open:requests.filter(r=>r.status!=='Closed').length},requests,updates});
   }
   if(user.role==='Admin'){
    const people=(await query('SELECT id,name,email,role,active FROM sp_users ORDER BY name')).map(r=>({...r,key:'user-'+r.id}));
    const clients=await query('SELECT id,name,email,active FROM sp_mobile_clients ORDER BY name');
    people.push(...clients.map(r=>({...r,key:'client-'+r.id,role:'Client'})));
    const stats=(await query("SELECT kind,count(*) AS count FROM sp_records WHERE kind IN ('projects','consultations') GROUP BY kind"));
    return json({userId:user.id,role:'Admin',name:user.name,people,summary:{staff:people.filter(r=>r.role==='Staff').length,clients:clients.length,projects:Number(stats.find(r=>r.kind==='projects')?.count||0),requests:Number(stats.find(r=>r.kind==='consultations')?.count||0)}});
   }
   const tasks=(await query("SELECT id,data FROM sp_records WHERE kind='tasks' AND data->>'user_id'=$1 ORDER BY id DESC",[String(user.id)])).map(r=>({...r.data,id:r.id}));
   const salary=(await query("SELECT data FROM sp_records WHERE kind='payroll' AND data->>'user_id'=$1 AND data->>'status'='Issued' ORDER BY data->>'period' DESC LIMIT 1",[String(user.id)]))[0]?.data;
   const attendance=(await query('SELECT date,site,check_in,check_out FROM sp_attendance WHERE user_id=$1 ORDER BY check_in DESC LIMIT 1',[user.id]))[0];
   return json({userId:user.id,role:'Staff',name:user.name,tasks:tasks.slice(0,10),attendance,summary:{pending:tasks.filter(r=>r.status!=='Completed').length,netSalary:salary?salary.basic+salary.allowances-salary.deductions:null}});
  }
  if(path==='/api/mobile/entry'){
   check(read,'Method not allowed.',405);
   if(account||user)return redirect(target(account?'Client':user.role));
   return page('Welcome','<h1>Welcome to Smart Power</h1><p>Choose your account in the app, or continue as a guest.</p><div class="actions"><a class="button" href="/api/mobile/auth/login?role=Client">Client sign in</a><a class="button secondary" href="/api/mobile/auth/login?role=Staff">Staff sign in</a><a class="button secondary" href="/">Continue as Guest</a></div>');
  }
  if(path==='/api/mobile/auth/logout'){
   check(!read,'Method not allowed.',405);const f=await form(req),current=account||user;check(current&&f.csrf===current.csrf_token,'Refresh and try again.',403);
   const clientToken=rawCookie(req,'sp_mobile_session'),staffToken=rawCookie(req,'sp_session');
   await tx(async c=>{if(clientToken)await query('DELETE FROM sp_mobile_client_sessions WHERE token_hash=$1',[digest(clientToken)],c);if(staffToken)await query('DELETE FROM sp_sessions WHERE token_hash=$1',[digest(staffToken)],c)});
   return redirect('/api/mobile/entry',[clear('sp_session'),clear('sp_mobile_session')]);
  }
  if(path.startsWith('/api/mobile/auth/')){
   const kind=path.slice('/api/mobile/auth/'.length),role=url.searchParams.get('role')||'Client';
   check(['login','register'].includes(kind)&&['Client','Staff','Admin'].includes(role),'Choose a valid account option.',404);
   check(kind!=='register'||role!=='Admin','Admin accounts are created by the office.',403);
   if(read)return authPage(kind,role);
   try{
    const f=await form(req),email=String(f.email||'').trim().toLowerCase();
    check(email.length<=160&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&typeof f.password==='string'&&f.password.length>=12&&f.password.length<=200,'Enter a valid email and a password of 12–200 characters.');
    let cookies;
    if(kind==='login'){
     const found=(await query(role==='Client'?'SELECT * FROM sp_mobile_clients WHERE email=$1 AND active=TRUE':'SELECT * FROM sp_users WHERE email=$1 AND active=TRUE',[email]))[0];
     check(found&&(role==='Client'||found.role===role)&&await verify(f.password,found.password_hash),'Incorrect account type, email or password.',401);
     cookies=await tx(c=>saveSession(found,role,c));
    }else{
     const name=String(f.name||'').trim();check(name.length>=2&&name.length<=100&&f.password===f.confirm,'Enter your name and matching passwords.');
     if(role==='Staff')check((await query("SELECT id FROM sp_users WHERE role='Admin' LIMIT 1")).length,'The office must set up Admin access first.',409);
     const hash=await hashPassword(f.password);
     cookies=await tx(async c=>{
      const created=(await query(role==='Client'?'INSERT INTO sp_mobile_clients(name,email,password_hash,created_at) VALUES($1,$2,$3,$4) RETURNING id':"INSERT INTO sp_users(name,email,password_hash,created_at,role) VALUES($1,$2,$3,$4,'Staff') RETURNING id",[name,email,hash,now()],c))[0];
      if(role==='Staff')await syncStaffDirectory(c);else await notice('New client joined',name+' ('+email+') created a Client account in the app.',null,c);
      return saveSession(created,role,c);
     });
    }
    return redirect(target(role),cookies);
   }catch(error){if(error.code==='23505')return authPage(kind,role,'This email already has an account. Sign in instead.');if(error instanceof Problem)return authPage(kind,role,error.message);throw error}
  }
  if(path.startsWith('/api/mobile/client/')){
   if(!account)return read?redirect('/api/mobile/auth/login?role=Client'):new Response('Please sign in.',{status:401,headers:{'Cache-Control':'no-store'}});
   if(path==='/api/mobile/client/request'){
    if(read)return page('New request',requestForm(account));
    const f=await form(req);check(f.csrf===account.csrf_token,'Refresh and try again.',403);
    try{
     const phone=String(f.phone||'').trim(),type=String(f.type||'').trim(),message=String(f.message||'').trim(),digits=phone.replace(/\D/g,'');
     check(/^[+0-9 ()-]{7,30}$/.test(phone)&&digits.length>=7&&digits.length<=15,'Enter a valid phone number with 7–15 digits.');check(type.length>0&&type.length<=120&&message.length>0&&message.length<=2000,'Enter your service and project details.');
     await tx(async c=>{await add('consultations',{name:account.name,email:account.email,phone,type,message,status:'New',mobile_client_id:account.id},null,c);await notice('New client request',account.name+': '+type,null,c)});
     return redirect('/api/mobile/client/dashboard?sent=1');
    }catch(error){if(error instanceof Problem)return page('New request',requestForm(account,error.message));throw error}
   }
   check(path==='/api/mobile/client/dashboard','Page not found.',404);check(read,'Method not allowed.',405);
   const requests=await query("SELECT id,data,created_at FROM sp_records WHERE kind='consultations' AND data->>'mobile_client_id'=$1 ORDER BY id DESC",[String(account.id)]);
   const updates=await query("SELECT id,data FROM sp_records WHERE kind='mobileclientnotice' AND data->>'client_id'=$1 ORDER BY id DESC LIMIT 20",[String(account.id)]);
   const closed=requests.filter(r=>r.data.status==='Closed').length;
   return page('Client dashboard','<p class="muted">CLIENT DASHBOARD</p><h1>Welcome, '+esc(account.name)+'</h1><p class="muted">Your requests and updates from Smart Power.</p>'+(url.searchParams.get('sent')==='1'?'<p class="success" role="status">Your request has been sent to our office.</p>':'')+'<div class="metrics"><div class="card"><strong>'+requests.length+'</strong><small>Requests</small></div><div class="card"><strong>'+(requests.length-closed)+'</strong><small>Open</small></div><div class="card"><strong>'+closed+'</strong><small>Closed</small></div></div><div class="actions"><a class="button" href="/api/mobile/client/request">New request</a><a class="button secondary" href="/services.html">Our services</a></div><h2>My updates</h2>'+updates.map(r=>'<article class="card"><h3>'+esc(r.data.name)+'</h3><p>'+esc(r.data.details)+'</p></article>').join('')+(!updates.length?'<p class="muted">Office updates will appear here.</p>':'')+'<h2>My requests</h2>'+requests.map(r=>'<article class="card"><h3>'+esc(r.data.type)+'</h3><span class="status">'+esc(r.data.status||'New')+'</span><p>'+esc(r.data.message)+'</p><small>Request #'+r.id+' · '+esc(new Date(Number(r.created_at)*1000).toLocaleDateString('en-GB',{timeZone:'Asia/Colombo'}))+'</small></article>').join('')+(!requests.length?'<p class="muted">No requests yet. Tell our team about your project.</p>':'')+'<section class="card"><h2>My account</h2><p>'+esc(account.email)+'</p><p><a href="tel:0773587109">Call our office</a></p>'+logoutForm(account.csrf_token)+'</section>');
  }
  throw new Problem(404,'Page not found.');
 };
}
