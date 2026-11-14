const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const p=require('../src/policy.cjs');const origin='https://smpowenginnworks.netlify.app';
test('only the packaged local shell may call desktop IPC',()=>{
 assert.ok(p.shellUrl('smartpower-app://desktop/home'));
 for(const value of ['https://smpowenginnworks.netlify.app','smartpower-app://desktop.evil/home','smartpower-app://user:password@desktop/home','file:///desktop/index.html','javascript:alert(1)'])assert.equal(p.shellUrl(value),false,value);
});
test('desktop navigation never escapes the configured company origin',()=>{
 assert.equal(p.companyPath('/api/mobile/auth/login?role=Client',origin),origin+'/api/mobile/auth/login?role=Client');
 for(const value of ['//attacker.example','/\\attacker.example','https://attacker.example','javascript:alert(1)','/bad\u0000value'])assert.throws(()=>p.companyPath(value,origin),value);
});
test('embedded browser bounds cannot cover content outside the window',()=>{
 assert.deepEqual(p.bounds({x:-10,y:30,width:2000,height:2000},{width:1000,height:700}),{x:0,y:30,width:1000,height:670});
 assert.throws(()=>p.bounds({x:NaN,y:0,width:10,height:10},{width:100,height:100}));assert.equal(p.bounds(null,{width:100,height:100}),null);
});
test('packaged asset requests and saved file names cannot traverse directories',()=>{
 const root=path.resolve('/tmp/desktop-ui');assert.equal(p.assetPath(root,'smartpower-app://desktop/assets/logo.png'),path.join(root,'assets/logo.png'));
 assert.throws(()=>p.assetPath(root,'smartpower-app://desktop/%2e%2e%2fsecret'));
 assert.ok(!p.filename('../../payroll','text/csv').includes('/'));assert.equal(p.filename('payslip','text/html'),'payslip.html');
});
