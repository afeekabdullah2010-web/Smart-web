(function(){
'use strict';
const header=document.querySelector('.site-header'),menu=document.querySelector('.menu');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function closeSubmenus(){document.querySelectorAll('.submenu-toggle').forEach(toggle=>{toggle.setAttribute('aria-expanded','false');document.getElementById(toggle.getAttribute('aria-controls')).hidden=true})}
function closeMenu(){closeSubmenus();header.classList.remove('open');menu.setAttribute('aria-expanded','false')}
document.querySelectorAll('.submenu-toggle').forEach(toggle=>{toggle.onclick=event=>{event.stopPropagation();const open=toggle.getAttribute('aria-expanded')!=='true';closeSubmenus();toggle.setAttribute('aria-expanded',String(open));document.getElementById(toggle.getAttribute('aria-controls')).hidden=!open;measureHeader()}});
document.addEventListener('click',event=>{if(!event.target.closest('#mainNav'))closeSubmenus()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=document.querySelector('.submenu-toggle[aria-expanded=true]');if(open){closeSubmenus();open.focus()}}});
menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.classList.contains('open')){closeMenu();menu.focus()}});
function measureHeader(){document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px')}
if('ResizeObserver'in window)new ResizeObserver(measureHeader).observe(header);measureHeader();
const form=document.getElementById('consultationForm');
if(form){const params=new URLSearchParams(location.search);if(params.get('interest')==='careers'){form.elements.type.value='Career enquiry';form.elements.type.parentElement.firstChild.textContent='Enquiry type';form.elements.message.placeholder='Your area of interest, qualifications, experience and availability';}const services={"construction": "Full Construction", "renewable-energy": "Solar & Wind Power", "security": "Security & Communication", "electrical": "Electrical Systems", "fire-safety": "Fire Safety Solutions", "air-conditioning": "Air Conditioning & Ventilation", "plumbing": "Plumbing & Gas", "facilities": "Facilities Management", "backup-power": "UPS & Battery Backups", "hydro": "Hydro Solutions", "architecture": "Architectural Drawings & 3D Visualisation", "industrial-accessories": "Industrial Accessories Trading"};if(services[params.get('service')]){const option=document.createElement('option');option.value=services[params.get('service')];option.textContent=option.value;form.elements.type.append(option);form.elements.type.value=option.value}}

if(form)form.onsubmit=async function(event){
 event.preventDefault();if(!this.reportValidity())return;
 const note=this.querySelector('.form-note'),button=this.querySelector('[type=submit]'),t=text=>window.spTranslate?window.spTranslate(text):text;
 const values=Object.fromEntries(new FormData(this)),phone=String(values.phone||'').trim(),digits=phone.replace(/\D/g,'');
 if(!/^[+0-9 ()-]{7,30}$/.test(phone)||digits.length<7||digits.length>15){note.textContent=t('Enter a valid phone number with 7–15 digits.');this.elements.phone.focus();return}
 values.phone=phone;button.disabled=true;note.textContent=t('Sending…');
 try{
  const netlify=window.SMART_POWER_HOSTING?.formMode==='netlify';
  const response=await fetch(netlify?'/contact.html':'/api/consultations',{method:'POST',headers:{'Content-Type':netlify?'application/x-www-form-urlencoded':'application/json'},body:netlify?new URLSearchParams({...values,'form-name':'smart-power-enquiries'}).toString():JSON.stringify(values)});
  if(!response.ok){let result;try{result=await response.json()}catch{}note.textContent=t(result?.error||'Unable to send. Please try again.');return}
  note.textContent=t('Thank you. Your request has been sent to our office.');this.reset();
 }catch(error){note.textContent=t('Unable to send. Please check your connection and try again.')}finally{button.disabled=false}
};
// Content remains visible when JavaScript or animation support is unavailable.
let observer;
function reveal(){
 if(reduced.matches){document.querySelectorAll('.will-reveal').forEach(el=>el.classList.add('is-visible'));return}
 if(!('IntersectionObserver'in window))return;
 observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:0.08});
 document.querySelectorAll('main>section,.destination-card,.service-list article,.project,.about aside,.engineering-card,.approach-steps article,.welcome-art,.about-part,.news-card,.responsibility-grid article').forEach((el,index)=>{el.classList.add('will-reveal');el.style.setProperty('--reveal-delay',(index%3)*70+'ms');observer.observe(el)});
}
reveal();reduced.addEventListener('change',()=>{if(reduced.matches){observer?.disconnect();document.querySelectorAll('.will-reveal').forEach(el=>el.classList.add('is-visible'))}});
let leaving=false;
document.addEventListener('click',event=>{
 const link=event.target.closest('a');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target)return;
 const url=new URL(link.href,location.href);if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))return;
 if(url.pathname===location.pathname&&url.hash){const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));if(target){event.preventDefault();closeMenu();target.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});if(link.classList.contains('skip'))target.focus({preventScroll:true});history.pushState(null,'',url.hash)}return}
 if(!url.pathname.endsWith('.html'))return;
 closeMenu();if(reduced.matches)return;event.preventDefault();if(leaving)return;leaving=true;document.body.classList.add('page-leaving');window.setTimeout(()=>location.assign(url.href),150);
});
const slides=Array.from(document.querySelectorAll('[data-project-slide]'));
if(slides.length){let current=0;const region=document.querySelector('.home-projects');function showSlide(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==current;slide.classList.toggle('is-active',i===current)});document.querySelector('[data-project-count]').textContent=(current+1)+' / '+slides.length;}
 document.querySelector('[data-project-next]').onclick=()=>showSlide(current+1);document.querySelector('[data-project-prev]').onclick=()=>showSlide(current-1);
 region.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();showSlide(current+(event.key==='ArrowRight'?1:-1))}});
}
window.addEventListener('pageshow',()=>{leaving=false;document.body.classList.remove('page-leaving')});
})();
