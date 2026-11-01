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
 users:['User administration','Create account',{name:'Full name',email:'Email|email',role:['Staff','Admin'],active:['Active','Inactive'],password:'Password (12+ characters)|password'}]
};
window.toggleNav=()=>$('#sidebar').classList.toggle('open');
window.toast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000)};
async function api(kind,payload){
 const response=await fetch('/api/admin/'+kind,{method:payload?'POST':'GET',credentials:'same-origin',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify({...payload,csrf:account.csrf}):undefined});
 if(response.redirected){location.href='/auth/login';throw Error('Please sign in again.');}
 const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load records.');return data;
}
function fail(e){window.toast(e.message);if(root&&!root.querySelector('h1'))root.innerHTML='<h1>Workspace unavailable</h1><p>'+esc(e.message)+'</p><button class="primary" onclick="location.reload()">Try again</button>';}
function button(text,action,cls='primary'){return '<button class="'+cls+'" data-action="'+action+'">'+esc(text)+'</button>';}
function header(title,actions=''){return '<header class="topbar"><div><div class="crumb">Company Administration</div><h1>'+esc(title)+'</h1></div><div class="top-actions">'+actions+'</div></header>';}
function toolbar(){return '<div class="filters"><input id="recordSearch" aria-label="Search records" placeholder="Search records" value="'+esc(query)+'"><select id="statusFilter" aria-label="Filter status"><option value="">All statuses</option>'+[...new Set(records.map(r=>r.status).filter(Boolean))].map(v=>'<option '+(status===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>';}
function table(){
 const fields=Object.keys(kinds[current][2]).filter(k=>!['password','notes','message','details'].includes(k));
 const visible=records.filter(r=>(!query||JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))&&(!status||r.status===status));
 return '<p class="panel-sub" style="padding:0 20px">'+visible.length+' / '+records.length+' records</p><div class="table-scroll"><table class="data-table"><thead><tr>'+fields.map(k=>'<th>'+esc(Array.isArray(kinds[current][2][k])?k:kinds[current][2][k].split('|')[0])+'</th>').join('')+'<th>Actions</th></tr></thead><tbody>'+visible.map(r=>'<tr>'+fields.map(k=>'<td>'+esc(k==='active'?(r.active?'Active':'Inactive'):r[k])+'</td>').join('')+'<td><button class="secondary" data-edit="'+r.id+'">'+(current==='consultations'?'View / edit':'Edit')+'</button> '+(current!=='users'?'<button class="secondary" data-delete="'+r.id+'">Delete</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'+(!visible.length?'<p class="empty">No records yet. Use “'+esc(kinds[current][1])+'” to get started.</p>':'');
}
async function workspace(kind){
 current=kind;query='';status='';records=await api(kind);
 root.innerHTML=header(kinds[kind][0],button('Notifications','notifications','secondary')+button(kinds[kind][1],'new'))+'<section class="panel">'+(kind==='team'?'<p class="body-pad">Staff records are separate from sign-in accounts. <a href="#" data-action="users">Manage sign-in accounts</a> · <a href="#" data-action="attendance">Attendance records</a></p>':'')+(kind==='settings'?'<p class="body-pad">Company contact information. User access and passwords are managed separately.</p>':'')+toolbar()+'<div id="recordsTable">'+table()+'</div></section>';
 $('#recordSearch').oninput=e=>{query=e.target.value;$('#recordsTable').innerHTML=table()};$('#statusFilter').onchange=e=>{status=e.target.value;$('#recordsTable').innerHTML=table()};
 updateBadge();
}
function form(record={}){
 const dialog=document.createElement('dialog');dialog.className='edit-dialog';
 const optional=new Set(['email','manager','notes','site','supplier','address','project','details']);
 dialog.innerHTML='<form id="editForm"><header><h2>'+esc(record.id?'Edit '+kinds[current][0]:kinds[current][1])+'</h2><button type="button" class="secondary" data-close>×</button></header><div class="field-grid">'+Object.entries(kinds[current][2]).map(([key,label])=>{
 let value=record[key]??(key==='active'?'Active':key==='name'&&current==='settings'?'Smart Power Engineering Works':'');if(key==='active'&&record.id)value=record.active?'Active':'Inactive';
 const required=(!optional.has(key)&&!(key==='password'&&record.id))?' required':'';
 if(Array.isArray(label))return '<label>'+esc(key)+'<select name="'+key+'">'+label.map(v=>'<option '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
 let [title,type='text']=label.split('|');if(type==='date'&&!value)value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Colombo'});
 return '<label>'+esc(title)+(type==='textarea'?'<textarea name="'+key+'" maxlength="2000"'+required+'>'+esc(value)+'</textarea>':'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'" maxlength="2000"'+required+(type==='number'?' min="0" step="any"'+(key==='progress'?' max="100"':key==='hours'?' max="24"':''):'')+(type==='password'?' minlength="12" autocomplete="new-password"':'')+'>')+'</label>';
 }).join('')+'</div><p class="form-error" role="alert"></p><footer><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Save</button></footer></form>';
 document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=dialog.querySelector('[type=submit]');submit.disabled=true;
 try{await api(current,{id:record.id,data:Object.fromEntries(new FormData(e.target))});dialog.close();await workspace(current);window.toast('Saved successfully.');}catch(err){dialog.querySelector('.form-error').textContent=err.message;}finally{submit.disabled=false}};
}
async function updateBadge(){const n=await api('notifications');document.querySelectorAll('[data-action=notifications]').forEach(b=>b.textContent='Notifications · '+n.filter(r=>r.status==='Unread').length);}
async function overview(){
 const [projects,team,invoices,materials,notifications,consultations]=await Promise.all(['projects','team','invoices','materials','notifications','consultations'].map(k=>api(k)));
 const metrics=[['Active projects',projects.filter(p=>p.status!=='Completed').length],['Active staff',team.filter(p=>p.status==='Active').length],['Unpaid invoices (LKR)',invoices.filter(i=>i.status!=='Paid').reduce((n,i)=>n+i.amount,0).toLocaleString()],['Project budget (LKR)',projects.reduce((n,p)=>n+p.budget,0).toLocaleString()]];
 root.innerHTML=header('Company overview',button('Notifications · '+notifications.filter(n=>n.status==='Unread').length,'notifications','secondary')+button('+ New project','project-new'))+'<section class="page-banner"><span class="eyebrow">Smart Power Engineering Works</span><h2>Every project, person and payment in view.</h2><p>Live totals from your saved company records.</p></section><section class="metrics">'+metrics.map(([label,value])=>'<article class="metric"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong></article>').join('')+'</section><section class="panel"><div class="panel-head"><h3>Company workspaces</h3></div><div class="workspace-grid">'+['projects','team','attendance','materials','invoices','clients','consultations','notifications','users','settings'].map(k=>button(kinds[k][0],k,'secondary')).join('')+button('Reports','reports','secondary')+'</div></section><section class="layout" style="margin-top:20px"><article class="panel"><div class="panel-head"><h3>Recent notifications</h3></div><div class="mini-list">'+notifications.slice(0,5).map(n=>'<div class="mini-item"><span><b>'+esc(n.name)+'</b><small>'+esc(n.details)+'</small></span><span>'+esc(n.status)+'</span></div>').join('')+(!notifications.length?'<p>No notifications yet.</p>':'')+'</div></article><article class="panel"><div class="panel-head"><h3>Follow up</h3></div><div class="body-pad"><p>'+materials.filter(m=>m.quantity<=m.minimum).length+' materials at or below reorder level.</p><p>'+consultations.filter(c=>!c.status||c.status==='New').length+' consultation requests to contact.</p>'+button('View requests','consultations','secondary')+'</div></article></section>';
}
function csv(rows,filename){if(!rows.length){window.toast('No saved records to export.');return;}const keys=[...new Set(rows.flatMap(Object.keys))].filter(k=>k!=='password');const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const text='\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=filename+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function reports(){root.innerHTML=header('Report centre')+'<section class="panel"><div class="panel-head"><h3>Export saved records as CSV</h3></div><div class="filters"><label>From <input id="reportFrom" type="date"></label><label>To <input id="reportTo" type="date"></label></div><p class="body-pad">Dates filter by record creation date. Leave dates empty to export all saved records.</p><div class="workspace-grid">'+['projects','team','attendance','materials','invoices','clients','consultations'].map(k=>button(kinds[k][0]+' CSV','export-'+k,'secondary')).join('')+'</div></section>';}
root?.addEventListener('click',async e=>{const target=e.target.closest('button,[data-action]');if(!target)return;
 try{
 if(target.dataset.edit){form(records.find(r=>r.id===Number(target.dataset.edit)));return;}
 if(target.dataset.delete){if(!confirm('Delete this record permanently?'))return;await api(current,{action:'delete',id:Number(target.dataset.delete)});await workspace(current);return;}
 const action=target.dataset.action;if(!action)return;e.preventDefault();
 if(action==='new'){form(current==='settings'?(records[0]||{}):{});return;}
 if(action==='project-new'){await workspace('projects');form();return;}
 if(action==='reports'){reports();return;}
 if(action.startsWith('export-')){const from=$('#reportFrom').value,to=$('#reportTo').value;if(from&&to&&from>to)throw Error('End date must follow start date.');const data=await api(action.slice(7));csv(data.filter(r=>{const d=new Date(r.created_at*1000).toLocaleDateString('en-CA',{timeZone:'Asia/Colombo'});return (!from||d>=from)&&(!to||d<=to)}),action.slice(7));return;}
 if(kinds[action])await workspace(action);
 }catch(err){fail(err)}
});
if(location.protocol==='file:'){document.body.innerHTML='<main><h1>Start the company server</h1><p>Run <code>python server.py</code>, then open http://127.0.0.1:8000.</p></main>';return;}
fetch('/api/me',{credentials:'same-origin'}).then(async response=>{if(response.redirected||!response.ok){location.href='/auth/login';return;}account=await response.json();document.querySelectorAll('[data-person]').forEach(n=>n.textContent=account.name);document.querySelectorAll('[data-role]').forEach(n=>n.textContent=account.role);document.querySelectorAll('[data-signout],#staffSignout').forEach(b=>b.onclick=async()=>{await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'csrf='+encodeURIComponent(account.csrf)});location.href='/'});
 if(!root)return;const page=location.pathname.split('/').pop();const map={'projects.html':'projects','team.html':'team','materials.html':'materials','finance.html':'invoices','clients.html':'clients','settings.html':'settings'};
 if(page==='reports.html')reports();else if(map[page])await workspace(map[page]);else await overview();
}).catch(fail);
})();
