(function () {
'use strict';
const $=s=>document.querySelector(s), root=$('#workspace');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let account, records=[], current, query='', status='';
const kinds={
 projects:['Projects','New project',{name:'Project name',code:'Project code',client:'Client',location:'Location',type:['Residential','Commercial','Engineering','Renovation'],status:['Planned','In progress','On hold','Completed'],start:'Start date|date',end:'End date|date',budget:'Budget (LKR)|number',progress:'Progress (%)|number',manager:'Project manager',notes:'Notes|textarea'}],
 team:['Staff directory','Add staff record',{name:'Full name',email:'Email|email',phone:'Phone',role:'Job title',site:'Assigned site',salary:'Monthly salary (LKR)|number',status:['Active','On leave','Inactive']}],
 attendance:['Attendance','Record attendance',{name:'Staff name',date:'Date|date',site:'Site',hours:'Hours worked|number',status:['Present','Absent','Leave']}],
 materials:['Materials','New requisition',{name:'Material name',quantity:'Quantity|number',unit:'Unit',location:'Location',supplier:'Supplier',minimum:'Reorder level|number',status:['Requested','Ordered','Received']}],
 invoices:['Finance & invoices','Create invoice',{name:'Invoice number',client:'Client',project:'Project',amount:'Amount (LKR)|number',due:'Due date|date',status:['Draft','Pending','Paid','Overdue'],notes:'Notes|textarea'}],
 clients:['Clients','Add client',{name:'Client name',email:'Email|email',phone:'Phone',address:'Address',project:'Project',notes:'Notes|textarea'}],
 notifications:['Notifications','Add reminder',{name:'Title',details:'Details|textarea',status:['Unread','Read']}],
 consultations:['Consultation requests','Add request',{name:'Name',phone:'Phone',type:'Project type',message:'Project details|textarea',status:['New','Contacted','Closed']}],
 settings:['Company details','Edit company details',{name:'Company name',address:'Office address',phone:'Phone',email:'Email|email'}],
 tasks:['Staff tasks','Assign task',{name:'Task title',user_id:'Staff account|staff',site:'Site',due:'Due date|date',priority:['Normal','High','Urgent'],status:['Assigned','In progress','Completed'],notes:'Instructions|textarea'}],
 payroll:['Staff payroll','Create payslip',{name:'Payroll reference',user_id:'Staff account|staff',period:'Salary month (YYYY-MM)|month',basic:'Basic salary (LKR)|number',allowances:'Allowances (LKR)|number',deductions:'Deductions (LKR)|number',paid:'Paid amount (LKR)|number',status:['Draft','Issued'],notes:'Notes|textarea'}],
 stafflogs:['Staff time logs','',{name:'Staff name',date:'Date',site:'Site',check_in:'Check in',check_out:'Check out',hours:'Hours'}],
 workupdates:['Staff work updates','',{name:'Staff name',date:'Date',site:'Site',summary:'Work details',photo:'Site photo'}],
 support:['Office support requests','Add support request',{name:'Subject',requester:'Requester',email:'Email|email',message:'Message|textarea',status:['Open','In progress','Resolved'],response:'Office response|textarea'}],
 users:['User administration','Create account',{name:'Full name',email:'Email|email',role:['Staff','Admin'],active:['Active','Inactive'],password:'Password (12+ characters)|password'}]
};
window.toggleNav=()=>$('#sidebar').classList.toggle('open');
window.toast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000)};
async function api(kind,payload){
 const response=await fetch('/api/admin/'+kind,{method:payload?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify({...payload,csrf:account.csrf}):undefined});
 if(response.redirected){location.href='/auth/login';throw Error('Please sign in again.');}
 if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('Restart python server.py with the latest files, then refresh this page.');const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load records.');return data;
}
function fail(e){window.toast(e.message);if(root&&!root.querySelector('h1'))root.innerHTML='<h1>Workspace unavailable</h1><p>'+esc(e.message)+'</p><button class="primary" onclick="location.reload()">Try again</button>';}
function button(text,action,cls='primary'){return '<button class="'+cls+'" data-action="'+action+'">'+esc(text)+'</button>';}
function header(title,actions=''){return '<header class="topbar"><div><div class="crumb">Company Administration</div><h1>'+esc(title)+'</h1></div><div class="top-actions">'+actions+'</div></header>';}
function toolbar(){
 const schema=kinds[current][2],field=Array.isArray(schema.status)?'status':current==='users'?'active':null;
 const choices=field==='active'?['Active','Inactive']:field?[...new Set([...schema.status,...records.map(r=>r.status).filter(Boolean)])]:[];
 return '<div class="filters"><input id="recordSearch" aria-label="Search records" placeholder="Search records" value="'+esc(query)+'">'+(field?'<select id="statusFilter" aria-label="Filter status"><option value="">All statuses</option>'+choices.map(v=>'<option value="'+esc(v)+'" '+(status===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>':'')+'</div>';
}
function readOnly(){return ['stafflogs','workupdates'].includes(current)}
function table(){
 const fields=Object.keys(kinds[current][2]).filter(k=>!['password','notes','message','details','response'].includes(k));
 const visible=records.filter(r=>(!query||JSON.stringify({...r,photo:undefined}).toLowerCase().includes(query.toLowerCase()))&&(!status||(current==='users'?(r.active?'Active':'Inactive'):r.status)===status));
 function value(r,k){if(k==='photo')return r.photo?'<img class="site-thumbnail" alt="Site photo" src="'+esc(r.photo)+'">':'—';if(k==='check_in'||k==='check_out')return r[k]?esc(new Date(r[k]*1000).toLocaleString('en-GB',{timeZone:'Asia/Colombo'})):'—';return esc(k==='active'?(r.active?'Active':'Inactive'):r[k])}
 return '<p class="panel-sub" style="padding:0 20px">'+visible.length+' / '+records.length+' records</p><div class="table-scroll"><table class="data-table"><thead><tr>'+fields.map(k=>'<th>'+esc(Array.isArray(kinds[current][2][k])?k:kinds[current][2][k].split('|')[0])+'</th>').join('')+(readOnly()?'':'<th>Actions</th>')+'</tr></thead><tbody>'+visible.map(r=>'<tr>'+fields.map(k=>'<td>'+value(r,k)+'</td>').join('')+(readOnly()?'':'<td><button class="secondary" data-edit="'+r.id+'">Edit</button> '+(current==='users'?'<a class="secondary" href="/profile.html?user='+r.id+'">Profile</a>':'<button class="secondary" data-delete="'+r.id+'">Delete</button>')+'</td>')+'</tr>').join('')+'</tbody></table></div>'+(!visible.length?'<p class="empty">No records match this view.</p>':'');
}
async function workspace(kind){
 current=kind;query='';status='';records=await api(kind);
 root.innerHTML=header(kinds[kind][0],button('Notifications','notifications','secondary')+(readOnly()?'':button(kinds[kind][1],'new')))+'<section class="panel">'+(kind==='team'?'<p class="body-pad">Staff records are separate from sign-in accounts. <a href="#" data-action="users">Manage sign-in accounts</a> · <a href="#" data-action="attendance">Manual attendance records</a> · <a href="#" data-action="stafflogs">Staff time logs</a> · <a href="#" data-action="tasks">Staff tasks</a> · <a href="#" data-action="payroll">Staff payroll</a> · <a href="#" data-action="workupdates">Staff work updates</a></p>':'')+(kind==='settings'?'<p class="body-pad">Company contact information. User access and passwords are managed separately.</p>':'')+toolbar()+'<div id="recordsTable">'+table()+'</div></section>';
 $('#recordSearch').oninput=e=>{query=e.target.value;$('#recordsTable').innerHTML=table()};if($('#statusFilter'))$('#statusFilter').onchange=e=>{status=e.target.value;$('#recordsTable').innerHTML=table()};
 updateBadge().catch(fail);
}
async function form(record={}){
 const staffChoices=['tasks','payroll'].includes(current)?(await api('users')).filter(u=>u.role==='Staff'&&u.active):[];
 const dialog=document.createElement('dialog');dialog.className='edit-dialog';
 const optional=new Set(['response','email','manager','notes','site','supplier','address','project','details']);
 dialog.innerHTML='<form id="editForm"><header><h2>'+esc(record.id?'Edit '+kinds[current][0]:kinds[current][1])+'</h2><button type="button" class="secondary" data-close>×</button></header><div class="field-grid">'+Object.entries(kinds[current][2]).map(([key,label])=>{
 let value=record[key]??(key==='active'?'Active':key==='name'&&current==='settings'?'Smart Power Engineering Works':'');if(key==='active'&&record.id)value=record.active?'Active':'Inactive';
 const required=(!optional.has(key)&&!(key==='password'&&record.id))?' required':'';
 if(Array.isArray(label))return '<label>'+esc(key)+'<select name="'+key+'">'+label.map(v=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
 let [title,type='text']=label.split('|');if(type==='staff')return '<label>'+esc(title)+'<select aria-label="'+esc(title)+'" name="'+key+'" required><option value="">Choose Staff account</option>'+staffChoices.map(u=>'<option value="'+u.id+'" '+(String(value)===String(u.id)?'selected':'')+'>'+esc(u.name)+' · '+esc(u.email)+'</option>').join('')+'</select></label>';if(type==='date'&&!value)value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Colombo'});
 return '<label>'+esc(title)+(type==='textarea'?'<textarea name="'+key+'" maxlength="2000"'+required+'>'+esc(value)+'</textarea>':'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'" maxlength="2000"'+required+(type==='number'?' min="0" step="any"'+(key==='progress'?' max="100"':key==='hours'?' max="24"':''):'')+(type==='password'?' minlength="12" autocomplete="new-password"':'')+'>')+'</label>';
 }).join('')+'</div><p class="form-error" role="alert"></p><footer><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save</button></footer></form>';
 document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=dialog.querySelector('[type=submit]');submit.disabled=true;
 try{const saved=await api(current,{id:record.id,data:Object.fromEntries(new FormData(e.target))});await workspace(current);if(!records.some(row=>row.id===saved.id))throw Error('Unable to confirm the saved record. Refresh and check.');dialog.close();window.toast('Saved permanently.');}catch(err){dialog.querySelector('.form-error').textContent=err.message;}finally{submit.disabled=false}};
}
async function updateBadge(){const n=await api('notifications');document.querySelectorAll('[data-action=notifications]').forEach(b=>b.textContent='Notifications · '+n.filter(r=>r.status==='Unread').length);}
async function overview(){
 const [projects,team,invoices,materials,notifications,consultations]=await Promise.all(['projects','team','invoices','materials','notifications','consultations'].map(k=>api(k)));
 const metrics=[['Active projects',projects.filter(p=>p.status!=='Completed').length],['Active staff',team.filter(p=>p.status==='Active').length],['Unpaid invoices (LKR)',invoices.filter(i=>i.status!=='Paid').reduce((n,i)=>n+i.amount,0).toLocaleString()],['Project budget (LKR)',projects.reduce((n,p)=>n+p.budget,0).toLocaleString()]];
 root.innerHTML=header('Company overview',button('Notifications · '+notifications.filter(n=>n.status==='Unread').length,'notifications','secondary')+button('+ New project','project-new'))+'<section class="page-banner"><span class="eyebrow">Smart Power Engineering Works</span><h2>Every project, person and payment in view.</h2><p>Live totals from your saved company records.</p></section><section class="metrics">'+metrics.map(([label,value])=>'<article class="metric"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong></article>').join('')+'</section><section class="panel"><div class="panel-head"><h3>Company workspaces</h3></div><div class="workspace-grid">'+['projects','team','attendance','materials','invoices','clients','consultations','notifications','support','tasks','payroll','stafflogs','workupdates','users','settings'].map(k=>button(kinds[k][0],k,'secondary')).join('')+button('Reports','reports','secondary')+'</div></section><section class="layout" style="margin-top:20px"><article class="panel"><div class="panel-head"><h3>Recent notifications</h3></div><div class="mini-list">'+notifications.slice(0,5).map(n=>'<div class="mini-item"><span><b>'+esc(n.name)+'</b><small>'+esc(n.details)+'</small></span><span>'+esc(n.status)+'</span></div>').join('')+(!notifications.length?'<p>No notifications yet.</p>':'')+'</div></article><article class="panel"><div class="panel-head"><h3>Follow up</h3></div><div class="body-pad"><p>'+materials.filter(m=>m.quantity<=m.minimum).length+' materials at or below reorder level.</p><p>'+consultations.filter(c=>!c.status||c.status==='New').length+' consultation requests to contact.</p>'+button('View requests','consultations','secondary')+'</div></article></section>';
}
function reports(){
 const reportKinds=['projects','team','attendance','materials','invoices','clients','consultations'];
 root.innerHTML=header('Report centre')+'<section class="panel"><div class="panel-head"><h3>Download reports as CSV</h3></div><div class="filters"><label>From <input id="reportFrom" type="date"></label><label>To <input id="reportTo" type="date"></label><button class="secondary" id="clearReportDates">All dates</button></div><p class="body-pad">Dates filter by record creation date. Leave dates empty to export all saved records. Empty reports contain column headers.</p><p id="reportError" class="form-error body-pad" role="alert"></p><div class="workspace-grid">'+reportKinds.map(k=>'<a class="secondary report-download" data-kind="'+k+'" href="/api/admin/reports?kind='+k+'" download="smart-power-'+k+'.csv">'+esc(kinds[k][0])+' CSV</a>').join('')+'</div><p class="body-pad">Open the downloaded CSV in Excel. Records are exported from the permanent database.</p></section>';
 function update(){const from=$('#reportFrom').value,to=$('#reportTo').value;$('#reportError').textContent=from&&to&&from>to?'End date must follow start date.':'';document.querySelectorAll('.report-download').forEach(a=>{a.href='/api/admin/reports?'+new URLSearchParams({kind:a.dataset.kind,from,to});a.setAttribute('aria-disabled',String(!!(from&&to&&from>to)))});}
 $('#reportFrom').onchange=update;$('#reportTo').onchange=update;$('#clearReportDates').onclick=()=>{$('#reportFrom').value='';$('#reportTo').value='';update()};
}
root?.addEventListener('click',async e=>{if(e.target.closest('.report-download[aria-disabled="true"]')){e.preventDefault();return;}const target=e.target.closest('button,[data-action]');if(!target)return;
 try{
 if(target.dataset.edit){await form(records.find(r=>r.id===Number(target.dataset.edit)));return;}
 if(target.dataset.delete){if(!confirm('Delete this record permanently?'))return;await api(current,{action:'delete',id:Number(target.dataset.delete)});await workspace(current);return;}
 const action=target.dataset.action;if(!action)return;e.preventDefault();
 if(action==='new'){await form(current==='settings'?(records[0]||{}):{});return;}
 if(action==='project-new'){await workspace('projects');await form();return;}
 if(action==='reports'){reports();return;}
 if(kinds[action])await workspace(action);
 }catch(err){fail(err)}
});
if(location.protocol==='file:'){document.body.innerHTML='<main><h1>Start the company server</h1><p>Run <code>python server.py</code>, then open http://127.0.0.1:8000.</p></main>';return;}
async function signOut(button){
 button.disabled=true;
 try{const response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'csrf='+encodeURIComponent(account.csrf)});if(!response.ok)throw Error('Unable to log out. Refresh and try again.');location.href='/';}catch(error){fail(error);button.disabled=false;}
}
window.spRefreshIdentity=async()=>{const response=await fetch('/api/profile',{cache:'no-store'});if(!response.ok)return;const profile=await response.json();document.querySelectorAll('[data-person]').forEach(n=>n.textContent=profile.name);document.querySelectorAll('.avatar').forEach(n=>{n.textContent=profile.name.split(/\s+/).map(p=>p[0]).slice(0,2).join('');if(profile.photo){const image=document.createElement('img');image.src=profile.photo;image.alt='Profile photo';n.replaceChildren(image)}});};
async function support(){
 if(!account)throw Error('Please wait for your account to load.');
 const response=await fetch('/api/support',{cache:'no-store'});if(!response.ok)throw Error('Unable to load office support.');const data=await response.json();const dialog=document.createElement('dialog');dialog.className='edit-dialog';
 const phone=String(data.phone).replace(/[^+0-9]/g,''),email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)?data.email:'';
 dialog.innerHTML='<header><h2>Office support</h2><button class="secondary" data-close>×</button></header><p><a class="secondary" href="tel:'+esc(phone)+'">Call office: '+esc(data.phone)+'</a> '+(email?'<a class="secondary" href="mailto:'+esc(email)+'">Email office</a>':'')+'</p><form><div class="field-grid"><label>Subject<input name="subject" required minlength="2" maxlength="200"></label><label>Message<textarea name="message" required minlength="5" maxlength="2000"></textarea></label></div><p class="form-error" role="alert"></p><button class="primary">Send request</button></form><h3>My support requests</h3><div class="mini-list">'+data.requests.map(r=>'<div class="mini-item"><span><b>'+esc(r.name)+'</b><small>'+esc(r.message)+'</small>'+(r.response?'<p>'+esc(r.response)+'</p>':'')+'</span><span>'+esc(r.status)+'</span></div>').join('')+(!data.requests.length?'<p>No support requests yet.</p>':'')+'</div>';
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;try{const response=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(e.target)),csrf:account.csrf})});const result=await response.json();if(!response.ok)throw Error(result.error);dialog.close();window.toast('Support request sent to the office.');}catch(error){dialog.querySelector('.form-error').textContent=error.message;submit.disabled=false}};
}
document.addEventListener('click',e=>{const target=e.target.closest('[data-support]');if(target){e.preventDefault();support().catch(fail)}});
window.spAccountReady=fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(async response=>{
 if(response.redirected||!response.ok){location.href='/auth/login';return null;}account=await response.json();document.querySelectorAll('[data-person]').forEach(n=>n.textContent=account.name);document.querySelectorAll('[data-role]').forEach(n=>n.textContent=account.role);document.querySelectorAll('[data-signout],#staffSignout').forEach(b=>b.onclick=()=>signOut(b));document.querySelectorAll('[data-admin-only]').forEach(n=>n.hidden=account.role!=='Admin');document.querySelectorAll('[data-staff-only]').forEach(n=>n.hidden=account.role!=='Staff');window.spRefreshIdentity().catch(fail);
 if(root){const page=location.pathname.split('/').pop();const map={'projects.html':'projects','team.html':'team','materials.html':'materials','finance.html':'invoices','clients.html':'clients','settings.html':'settings'};if(page==='reports.html')reports();else if(map[page])await workspace(map[page]);else await overview();}
 return account;
}).catch(error=>{fail(error);return null});
})();
