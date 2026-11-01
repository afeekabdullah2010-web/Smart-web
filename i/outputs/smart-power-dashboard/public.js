(function(){
'use strict';
const header=document.querySelector('.site-header'),menu=document.querySelector('.menu');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function closeMenu(){header.classList.remove('open');menu.setAttribute('aria-expanded','false')}
menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.classList.contains('open')){closeMenu();menu.focus()}});
function measureHeader(){document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px')}
if('ResizeObserver'in window)new ResizeObserver(measureHeader).observe(header);measureHeader();
const form=document.getElementById('consultationForm');
if(form)form.onsubmit=async function(event){event.preventDefault();if(!this.reportValidity())return;const note=this.querySelector('.form-note'),button=this.querySelector('[type=submit]'),t=text=>window.spTranslate?window.spTranslate(text):text;button.disabled=true;note.textContent=t('Sending…');try{const response=await fetch('/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(this)))});if(!response.ok)throw Error();note.textContent=t('Thank you. Your request has been sent to our office.');this.reset()}catch(error){note.textContent=t('Unable to send. Please try again.')}finally{button.disabled=false}};
// Content remains visible when JavaScript or animation support is unavailable.
let observer;
function reveal(){
 if(reduced.matches){document.querySelectorAll('.will-reveal').forEach(el=>el.classList.add('is-visible'));return}
 if(!('IntersectionObserver'in window))return;
 observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:0.08});
 document.querySelectorAll('main>section,.destination-card,.service-list article,.project,.about aside,.engineering-card,.approach-steps article,.welcome-art').forEach((el,index)=>{el.classList.add('will-reveal');el.style.setProperty('--reveal-delay',(index%3)*70+'ms');observer.observe(el)});
}
reveal();reduced.addEventListener('change',()=>{if(reduced.matches){observer?.disconnect();document.querySelectorAll('.will-reveal').forEach(el=>el.classList.add('is-visible'))}});
let leaving=false;
document.addEventListener('click',event=>{
 const link=event.target.closest('a');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target)return;
 const url=new URL(link.href,location.href);if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))return;
 if(url.pathname===location.pathname&&url.hash){const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));if(target){event.preventDefault();closeMenu();target.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});if(link.classList.contains('skip'))target.focus({preventScroll:true});history.pushState(null,'',url.hash)}return}
 if(!['/index.html','/about.html','/services.html','/our-projects.html','/contact.html'].includes(url.pathname))return;
 closeMenu();if(reduced.matches)return;event.preventDefault();if(leaving)return;leaving=true;document.body.classList.add('page-leaving');window.setTimeout(()=>location.assign(url.href),150);
});
const slides=Array.from(document.querySelectorAll('[data-project-slide]'));
if(slides.length){let current=0;const region=document.querySelector('.home-projects');function showSlide(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==current;slide.classList.toggle('is-active',i===current)});document.querySelector('[data-project-count]').textContent=(current+1)+' / '+slides.length;}
 document.querySelector('[data-project-next]').onclick=()=>showSlide(current+1);document.querySelector('[data-project-prev]').onclick=()=>showSlide(current-1);
 region.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();showSlide(current+(event.key==='ArrowRight'?1:-1))}});
}
window.addEventListener('pageshow',()=>{leaving=false;document.body.classList.remove('page-leaving')});
})();
