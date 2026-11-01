(function(){
  var memory={}; function put(k,v){memory[k]=v;try{localStorage.setItem(k,v)}catch(e){}};
  function close(){document.querySelectorAll('dialog[open]').forEach(function(d){d.close()})}
  document.querySelector('.menu').addEventListener('click',function(){var h=document.querySelector('.site-header');h.classList.toggle('open');this.setAttribute('aria-expanded',h.classList.contains('open'))});
  document.querySelectorAll('nav a').forEach(function(a){a.addEventListener('click',function(){document.querySelector('.site-header').classList.remove('open')})});
  document.querySelectorAll('[data-open-portal]').forEach(function(b){b.onclick=function(){document.getElementById('portalModal').showModal()}});
  document.querySelectorAll('[data-open-warning]').forEach(function(b){b.onclick=function(){document.getElementById('warningModal').showModal()}});
  document.querySelectorAll('[data-close-modal]').forEach(function(b){b.onclick=close});
  document.querySelector('[data-show-password]').onclick=function(){close();document.getElementById('passwordModal').showModal();setTimeout(function(){document.getElementById('adminPassword').focus()},50)};
  document.querySelectorAll('[data-portal]').forEach(function(b){b.onclick=function(){location.href='/auth/login?next=%2Fstaff-dashboard.html'}});
  document.getElementById('adminForm').onsubmit=function(e){e.preventDefault();location.href='/auth/login?next=%2Fadmin.html'};
  document.getElementById('consultationForm').onsubmit=function(e){e.preventDefault();var n=this.querySelector('.form-note');if(!this.checkValidity()){n.textContent='Please complete your name, phone number and project details.';return}n.textContent='Thank you — your consultation request is recorded in this local demo. Our office will contact you by phone.';this.reset()};
}());
