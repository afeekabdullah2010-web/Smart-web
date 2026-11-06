import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createCompany,validateSetupKey} from '../netlify/lib/company.mjs';

async function fixture(){
 const db=new PGlite();await db.exec(await readFile(new URL('../database/migrations/20261101180000_company.sql',import.meta.url),'utf8'));
 const pool={query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
 const files=new Map();const store={set:async(k,v)=>files.set(k,Buffer.from(v)),get:async k=>files.get(k)||null};
 const handler=createCompany({pool,store,templates:{'admin.html':'<h1>Admin</h1>','staff-dashboard.html':'<h1>Staff</h1>','profile.html':'<h1>Profile</h1>'},env:k=>k==='SMART_POWER_SETUP_KEY'?'owner-setup-key-with-32-characters':undefined});
 const cookies={};
 async function request(path,{method='GET',data,form,as,csrf=true}={}){
  const headers={};if(as&&cookies[as])headers.cookie=cookies[as];let body;
  if(data!==undefined){method='POST';headers['content-type']='application/json';body=JSON.stringify({...data,...(csrf&&as?{csrf:as.csrf}: {})})}
  if(form){method='POST';headers['content-type']='application/x-www-form-urlencoded';body=new URLSearchParams(form).toString()}
  if(typeof as==='object'&&as.cookie)headers.cookie=as.cookie;
  const response=await handler(new Request('https://smart.example'+path,{method,headers,body}));const text=await response.text();let json;try{json=JSON.parse(text)}catch{}
  return {status:response.status,headers:response.headers,text,json};
 }
 async function login(email,position){const r=await request('/auth/login',{form:{email,position,password:'Test-password-123'}});assert.equal(r.status,303,r.text);const account={cookie:r.headers.get('set-cookie').split(';')[0]};const me=await request('/api/me',{as:account});return {...account,...me.json};}
 const first=await request('/auth/setup',{form:{name:'Administrator',email:'admin@example.test',password:'Test-password-123',confirm:'Test-password-123',setup_key:'owner-setup-key-with-32-characters'}});assert.equal(first.status,200,first.text);assert.match(first.text,/Account created/);
 const admin=await login('admin@example.test','Admin');
 for(const n of [1,2]){const r=await request('/api/admin/users',{as:admin,data:{data:{name:'Staff '+n,email:'staff'+n+'@example.test',role:'Staff',active:'Active',password:'Test-password-123'}}});assert.equal(r.status,200,r.text)}
 const staff=await login('staff1@example.test','Staff'),other=await login('staff2@example.test','Staff');
 return {db,request,admin,staff,other,login,files};
}

test('Postgres login, registration, role guards, CSRF and logout',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/admin.html')).status,303);
  assert.equal((await f.request('/admin.html',{as:f.staff})).status,403);
  assert.equal((await f.request('/api/admin/team',{as:f.staff})).status,403);
  assert.equal((await f.request('/api/admin/team',{as:f.admin,data:{data:{}},csrf:false})).status,403);
  const form={name:'New Staff',email:'new@example.test',password:'Test-password-123',confirm:'Test-password-123',role:'Admin'};
  assert.match((await f.request('/auth/register',{form})).text,/Account created/);
  const registered=await f.login('new@example.test','Staff');assert.equal(registered.role,'Staff');
  const bad=await f.request('/auth/login',{form:{email:'new@example.test',password:'Test-password-123',position:'Admin'}});assert.equal(bad.status,200);assert.equal(bad.headers.has('set-cookie'),false);
  assert.equal((await f.request('/auth/logout',{as:f.staff,form:{csrf:f.staff.csrf}})).status,303);
  assert.equal((await f.request('/api/me',{as:f.staff})).status,401);
 }finally{await f.db.close()}
});

test('Postgres CRUD, CSV reports and profile uploads preserve ownership',async()=>{
 const f=await fixture();try{
  const data={name:'Permanent Staff Record',email:'',phone:'0771234567',role:'Engineer',site:'Nintavur',salary:80000,status:'Active'};
  const saved=await f.request('/api/admin/team',{as:f.admin,data:{data}});assert.equal(saved.status,200,saved.text);
  assert.ok((await f.request('/api/admin/team',{as:f.admin})).json.some(row=>row.name===data.name));
  const csv=await f.request('/api/admin/reports?kind=team',{as:f.admin});assert.equal(csv.status,200);assert.match(csv.text,/Permanent Staff Record/);assert.match(csv.headers.get('content-disposition'),/attachment/);
  const profile=await f.request('/api/profile',{as:f.staff,data:{data:{name:'Updated Staff',email:'staff1@example.test',nic:'200012345678',dob:'2000-01-01',phone:'0771234567'}}});assert.equal(profile.status,200,profile.text);
  assert.equal((await f.request('/api/profile?user='+f.staff.id,{as:f.other})).status,403);
  const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
  const image='data:image/png;base64,'+Buffer.concat([png,Buffer.alloc(3500000-png.length)]).toString('base64');
  const upload=await f.request('/api/uploads',{as:f.staff,data:{image}});assert.equal(upload.status,201,upload.text);
  assert.equal((await f.request('/api/profile',{as:f.staff,data:{data:{photo:upload.json.url,signature:upload.json.url}}})).status,200);
  assert.equal((await f.request(upload.json.url,{as:f.other})).status,404);
  assert.equal((await f.request(upload.json.url,{as:f.staff})).status,200);
  assert.equal((await f.request('/api/profile',{as:f.other,data:{data:{photo:upload.json.url}}})).status,403);
  assert.equal((await f.request('/api/profile',{as:f.staff,data:{data:{role:'Admin'}}})).status,400);
  const oversized='data:image/png;base64,'+Buffer.concat([png,Buffer.alloc(3500001-png.length)]).toString('base64');
  assert.equal((await f.request('/api/uploads',{as:f.staff,data:{image:oversized}})).status,400);
 }finally{await f.db.close()}
});

test('Postgres Staff attendance, task/photo updates, payroll and support work end to end',async()=>{
 const f=await fixture();try{
  const task={name:'Wiring task',user_id:f.staff.id,site:'Nintavur',due:'2026-12-01',priority:'High',status:'Assigned',notes:'Follow drawings'};
  const created=await f.request('/api/admin/tasks',{as:f.admin,data:{data:task}});assert.equal(created.status,200,created.text);const id=created.json.id;
  assert.equal((await f.request('/api/staff/tasks',{as:f.other})).json.length,0);
  assert.equal((await f.request('/api/staff/tasks',{as:f.other,data:{id,status:'Completed'}})).status,404);
  assert.equal((await f.request('/api/staff/tasks',{as:f.staff,data:{id,status:'In progress'}})).status,200);
  assert.equal((await f.request('/api/staff/tasks',{as:f.staff,data:{id,status:'Completed'}})).status,200);
  assert.equal((await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-out'}})).status,409);
  assert.equal((await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-in',site:'Nintavur'}})).status,200);
  assert.equal((await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-in',site:'Nintavur'}})).status,409);
  assert.equal((await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-out'}})).status,200);
  assert.equal((await f.request('/api/staff/attendance',{as:f.other})).json.length,0);
  assert.equal((await f.request('/api/staff/updates',{as:f.staff,data:{site:'Nintavur',summary:'Wiring completed',task_id:id}})).status,200);
  assert.equal((await f.request('/api/staff/updates',{as:f.other})).json.length,0);
  const pay={name:'PAY-001',user_id:f.staff.id,period:'2026-11',basic:80000,allowances:5000,deductions:2000,paid:50000,status:'Issued',notes:'Bank transfer'};
  const salary=await f.request('/api/admin/payroll',{as:f.admin,data:{data:pay}});assert.equal(salary.status,200,salary.text);
  const slip=await f.request('/api/staff/payslip?id='+salary.json.id+'&download=1',{as:f.staff});assert.match(slip.text,/83,000.00/);assert.match(slip.text,/33,000.00/);
  assert.equal((await f.request('/api/staff/payslip?id='+salary.json.id,{as:f.other})).status,404);
  assert.equal((await f.request('/api/staff/salary',{as:f.staff,data:{paid:90000}})).status,403);
  assert.equal((await f.request('/api/support',{as:f.staff,data:{subject:'Help needed',message:'Please assist with the site work.'}})).status,201);
  const support=(await f.request('/api/admin/support',{as:f.admin})).json[0];support.response='Office will assist';support.status='Resolved';
  assert.equal((await f.request('/api/admin/support',{as:f.admin,data:{id:support.id,data:support}})).status,200);
  assert.equal((await f.request('/api/support',{as:f.staff})).json.requests[0].response,'Office will assist');
  assert.equal((await f.request('/api/support',{as:f.other})).json.requests.length,0);
 }finally{await f.db.close()}
});

test('every Admin workspace CRUD and public enquiries persist in Postgres',async()=>{
 const f=await fixture();try{
  const entries={
   projects:{name:'Project',code:'P1',client:'Client',location:'Site',type:'Residential',status:'Planned',start:'2026-11-01',end:'2026-12-01',budget:1000,progress:0,manager:'Admin',notes:''},
   team:{name:'Team',email:'',phone:'0771234567',role:'Engineer',site:'Site',salary:80000,status:'Active'},
   materials:{name:'Cement',quantity:10,unit:'bags',location:'Store',supplier:'Vendor',minimum:5,status:'Received'},
   invoices:{name:'INV1',client:'Client',project:'P1',amount:100,due:'2026-12-01',status:'Pending',notes:''},
   clients:{name:'Client',email:'',phone:'0771234567',address:'Site',project:'P1',notes:''},
   attendance:{name:'Staff',date:'2026-11-01',site:'Site',hours:8,status:'Present'},
   notifications:{name:'Reminder',details:'Details',status:'Unread'},
   consultations:{name:'Enquiry',phone:'0771234567',type:'Construction',message:'Project details',status:'New'},
   support:{name:'Support',requester:'Staff',email:'',message:'Please assist',status:'Open',response:''},
   settings:{name:'Smart Power',address:'Nintavur',phone:'0771234567',email:''},
   tasks:{name:'Task',user_id:f.staff.id,site:'Site',due:'2026-12-01',priority:'High',status:'Assigned',notes:''},
   payroll:{name:'Payroll',user_id:f.staff.id,period:'2026-11',basic:80000,allowances:1000,deductions:0,paid:1000,status:'Issued',notes:''}
  };
  for(const [kind,data] of Object.entries(entries)){
   const route='/api/admin/'+kind;
   assert.equal((await f.request(route,{as:f.staff})).status,403,kind);
   const create=await f.request(route,{as:f.admin,data:{data}});assert.equal(create.status,200,kind+': '+create.text);
   const id=create.json.id;assert.ok((await f.request(route,{as:f.admin})).json.some(row=>row.id===id));
   const updated=await f.request(route,{as:f.admin,data:{id,data:{...data,name:data.name+' updated'}}});assert.equal(updated.status,200,kind+': '+updated.text);
   assert.equal((await f.request(route,{as:f.admin,data:{id,action:'delete'}})).status,200);
   assert.ok(!(await f.request(route,{as:f.admin})).json.some(row=>row.id===id));
  }
  assert.equal((await f.request('/api/consultations',{data:{name:'Career applicant',phone:'0771234567',type:'Career enquiry',message:'Engineering experience and availability'}})).status,201);
  assert.equal((await f.request('/api/admin/consultations',{as:f.admin})).json[0].type,'Career enquiry');
 }finally{await f.db.close()}
});


test('first Admin setup identifies missing, short and mismatched keys without exposing the secret',()=>{
 const secret='temporary-production-setup-key-123';
 assert.throws(()=>validateSetupKey(undefined,secret),/Functions scope/);
 assert.throws(()=>validateSetupKey('short',secret),/too short/);
 assert.throws(()=>validateSetupKey(secret,'short'),/at least 24/);
 assert.throws(()=>validateSetupKey(secret,'different-production-key-1234'),/does not match/);
 assert.doesNotThrow(()=>validateSetupKey(secret,secret));
 try{validateSetupKey(secret,'different-production-key-1234')}catch(error){assert.equal(error.message.includes(secret),false)}
});

test('Staff registration creates one directory entry and Admin notification; existing accounts are included',async()=>{
 const f=await fixture();try{
  const form={name:'Joined Staff',email:'joined@example.test',password:'Test-password-123',confirm:'Test-password-123'};
  assert.match((await f.request('/auth/register',{form})).text,/Account created/);
  let rows=(await f.request('/api/admin/team',{as:f.admin})).json;
  assert.equal(rows.filter(r=>r.email===form.email).length,1);
  assert.ok(rows.some(r=>r.email==='staff1@example.test'));
  assert.ok(!rows.some(r=>r.email==='admin@example.test'));
  const member=rows.find(r=>r.email===form.email);assert.equal(member.status,'Active');assert.ok(member.user_id);
  let notices=(await f.request('/api/admin/notifications',{as:f.admin})).json;
  assert.equal(notices.filter(n=>n.name==='New staff joined'&&n.details.includes(form.email)).length,1);
  assert.match((await f.request('/auth/register',{form})).text,/already has an account/);
  await f.request('/api/admin/team',{as:f.admin});
  notices=(await f.request('/api/admin/notifications',{as:f.admin})).json;
  assert.equal(notices.filter(n=>n.details.includes(form.email)).length,1);
  const edited=await f.request('/api/admin/team',{as:f.admin,data:{id:member.id,data:{...member,phone:'0771234567',role:'Engineer',salary:75000}}});assert.equal(edited.status,200,edited.text);
  rows=(await f.request('/api/admin/team',{as:f.admin})).json;
  assert.equal(rows.filter(r=>r.user_id===member.user_id).length,1);assert.equal(rows.find(r=>r.id===member.id).salary,75000);
  assert.equal((await f.request('/api/admin/notifications',{as:f.staff})).status,403);
 }finally{await f.db.close()}
});

test('Staff actions notify Admin and office updates reach only the correct Staff',async()=>{
 const f=await fixture();try{
  const task={name:'Private wiring job',user_id:f.staff.id,site:'Site A',due:'2026-12-01',priority:'High',status:'Assigned',notes:'Wiring'};
  const saved=await f.request('/api/admin/tasks',{as:f.admin,data:{data:task}});assert.equal(saved.status,200,saved.text);
  let mine=(await f.request('/api/notifications',{as:f.staff})).json;
  assert.ok(mine.some(n=>n.name==='New task assigned'&&n.details.includes(task.name)));
  assert.equal((await f.request('/api/notifications',{as:f.other})).json.length,0);
  assert.equal((await f.request('/api/notifications',{as:f.other,data:{action:'read',id:mine[0].id}})).status,404);
  assert.equal((await f.request('/api/notifications',{as:f.staff,data:{action:'read',id:mine[0].id},csrf:false})).status,403);
  assert.equal((await f.request('/api/notifications',{as:f.staff,data:{action:'read',id:mine[0].id}})).status,200);
  assert.equal((await f.request('/api/notifications',{as:f.staff})).json[0].status,'Read');
  await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-in',site:'Site A'}});
  await f.request('/api/staff/attendance',{as:f.staff,data:{action:'check-out'}});
  await f.request('/api/profile',{as:f.staff,data:{data:{phone:'0771234567'}}});
  await f.request('/api/staff/tasks',{as:f.staff,data:{id:saved.json.id,status:'Completed'}});
  await f.request('/api/staff/updates',{as:f.staff,data:{site:'Site A',summary:'Wiring work finished'}});
  await f.request('/api/support',{as:f.staff,data:{subject:'Tools needed',message:'Please send the required tools.'}});
  const messages=(await f.request('/api/admin/notifications',{as:f.admin})).json;
  for(const title of ['Staff checked in','Staff checked out','Staff profile updated','Staff task updated','Staff work update','Office support request'])assert.ok(messages.some(n=>n.name===title),title);
  const support=(await f.request('/api/admin/support',{as:f.admin})).json[0];
  await f.request('/api/admin/support',{as:f.admin,data:{id:support.id,data:{...support,email:f.other.email,response:'Tools will arrive tomorrow',status:'In progress'}}});
  const pay={name:'PAY-PRIVATE',user_id:f.staff.id,period:'2026-11',basic:80000,allowances:0,deductions:0,paid:0,status:'Draft',notes:''};
  const salary=await f.request('/api/admin/payroll',{as:f.admin,data:{data:pay}});assert.equal(salary.status,200,salary.text);
  mine=(await f.request('/api/notifications',{as:f.staff})).json;assert.ok(!mine.some(n=>n.name==='Salary updated'));
  await f.request('/api/admin/payroll',{as:f.admin,data:{id:salary.json.id,data:{...pay,status:'Issued'}}});
  mine=(await f.request('/api/notifications',{as:f.staff})).json;
  assert.ok(mine.some(n=>n.name==='Office support update'&&n.details.includes('Tools will arrive tomorrow')));
  assert.ok(mine.some(n=>n.name==='Salary updated'));
  assert.equal((await f.request('/api/notifications?user='+f.staff.id,{as:f.other})).json.length,0);
  assert.equal((await f.request('/api/notifications')).status,401);
 }finally{await f.db.close()}
});

test('Contact requests reject invalid phones with a clear reason and valid requests notify Admin',async()=>{
 const f=await fixture();try{
  const data={name:'Contact Visitor',phone:'045558',type:'Engineering works',message:'Please call about electrical work.'};
  const invalid=await f.request('/api/consultations',{data});assert.equal(invalid.status,400);assert.match(invalid.json.error,/7–15 digits/);
  assert.equal((await f.request('/api/admin/consultations',{as:f.admin})).json.length,0);
  const valid=await f.request('/api/consultations',{data:{...data,phone:'+94 77 123 4567'}});assert.equal(valid.status,201,valid.text);
  const requests=(await f.request('/api/admin/consultations',{as:f.admin})).json;assert.equal(requests.length,1);assert.equal(requests[0].name,data.name);
  assert.ok((await f.request('/api/admin/notifications',{as:f.admin})).json.some(n=>n.name==='New consultation request'&&n.details===data.name));
 }finally{await f.db.close()}
});
