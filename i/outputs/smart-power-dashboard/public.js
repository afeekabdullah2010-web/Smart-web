(function(){
 const menu=document.querySelector('.menu');menu.addEventListener('click',function(){const h=document.querySelector('.site-header');h.classList.toggle('open');this.setAttribute('aria-expanded',h.classList.contains('open'))});
 document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.site-header').classList.remove('open');menu.setAttribute('aria-expanded','false')}));
 document.getElementById('consultationForm').onsubmit=async function(e){e.preventDefault();if(!this.reportValidity())return;const note=this.querySelector('.form-note'),button=this.querySelector('[type=submit]'),t=text=>window.spTranslate?window.spTranslate(text):text;button.disabled=true;note.textContent=t('Sending…');
 try{const response=await fetch('/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(this)))});if(!response.ok)throw Error();note.textContent=t('Thank you. Your request has been sent to our office.');this.reset()}catch(err){note.textContent=t('Unable to send. Please try again.')}finally{button.disabled=false}
 };
})();
