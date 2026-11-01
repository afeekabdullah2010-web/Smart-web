from pathlib import Path
import ast,json
root=Path(__file__).resolve().parents[1]
source=root/'i/outputs/smart-power-dashboard/server.py'
tree=ast.parse(source.read_text())
for node in ast.walk(tree):
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='schemas' for t in node.targets):
  schemas=ast.literal_eval(node.value);break
else:raise RuntimeError('No record schemas found')
manifest={'schemas':schemas,'adminPages':['admin.html','projects.html','team.html','materials.html','finance.html','clients.html','reports.html','settings.html'],'staffPages':['staff-dashboard.html','staff-attendance.html','staff-tasks.html','staff-salary.html'],'profileFields':['name','email','phone','nic','dob','address','employee_id','department','job_title','employment_type','joined','emergency_name','emergency_phone','blood_group','qualifications','bank_name','bank_account','photo','signature']}
(root/'netlify/lib/manifest.mjs').write_text('export default '+json.dumps(manifest)+';\n')
