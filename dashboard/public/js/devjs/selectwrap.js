// devjs/selectwrap.js — Custom searchable select replacement for all <select> elements

(function(){
'use strict';
var CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
var wrapped=new WeakSet();
var openWrap=null;

function cleanText(t){ t=String(t||''); var d=document.createElement('div'); d.innerHTML=t; return (d.textContent||d.innerText||'').trim(); }
function optText(opt){ return cleanText(opt.text||opt.textContent||opt.label||''); }

function positionPanel(wrap){
  var r=wrap._t.getBoundingClientRect(), p=wrap._p;
  var panelH=p.offsetHeight||240, spaceBelow=window.innerHeight-r.bottom, spaceAbove=r.top;
  var width=Math.max(r.width,160);
  p.style.width=width+'px'; p.style.left=r.left+'px'; p.style.right='auto';
  if(spaceBelow>=panelH||spaceBelow>=spaceAbove){ p.style.top=(r.bottom+4)+'px'; p.style.bottom='auto'; }
  else { p.style.bottom=(window.innerHeight-r.top+4)+'px'; p.style.top='auto'; }
}

document.addEventListener('mousedown',function(e){ if(!openWrap)return; if(!openWrap._p.contains(e.target)&&!openWrap._t.contains(e.target))close_(openWrap); },true);
window.addEventListener('scroll',function(){ if(openWrap)positionPanel(openWrap); },true);
window.addEventListener('resize',function(){ if(openWrap)positionPanel(openWrap); });

function open_(wrap){
  if(openWrap&&openWrap!==wrap)close_(openWrap);
  openWrap=wrap;
  buildList(wrap,''); wrap._si.value=''; wrap._sw.style.display='';
  document.body.appendChild(wrap._p); wrap._p.style.display='block';
  wrap._t.classList.add('is-open'); wrap._t.setAttribute('aria-expanded','true');
  requestAnimationFrame(function(){positionPanel(wrap);});
  setTimeout(function(){if(openWrap===wrap)wrap._si.focus();},30);
}

function close_(wrap){
  if(!wrap)return;
  if(wrap._p.parentNode)wrap._p.parentNode.removeChild(wrap._p);
  wrap._p.style.display='none'; wrap._t.classList.remove('is-open');
  wrap._t.setAttribute('aria-expanded','false'); if(openWrap===wrap)openWrap=null;
}

function buildList(wrap,q){
  var sel=wrap._s,list=wrap._l,qlo=(q||'').toLowerCase();
  var opts=Array.from(sel.options).filter(function(o){ var t=optText(o); return t&&(!qlo||t.toLowerCase().indexOf(qlo)>-1); });
  if(!opts.length){list.innerHTML='<div class="rzr-empty">No options found</div>';return;}
  list.innerHTML='';
  opts.forEach(function(opt){
    var it=document.createElement('div'); it.className='rzr-item'+(opt.value===sel.value?' is-sel':''); it.dataset.v=opt.value;
    var tx=document.createElement('span');tx.className='rzr-item-text';tx.textContent=optText(opt);
    var ck=document.createElement('span');ck.className='rzr-item-chk';ck.textContent='✓';
    it.appendChild(tx);it.appendChild(ck);
    it.addEventListener('mousedown',function(e){ e.preventDefault();e.stopPropagation(); sel.value=opt.value; updateLabel(wrap); close_(wrap); sel.dispatchEvent(new Event('change',{bubbles:true})); });
    list.appendChild(it);
  });
}

function updateLabel(wrap){
  var sel=wrap._s,lbl=wrap._lb;
  var idx=sel.selectedIndex,opt=idx>=0?sel.options[idx]:null;
  var text=opt?optText(opt):'';
  if(text){ lbl.textContent=text; lbl.classList.toggle('is-ph',idx===0&&(!opt.value||opt.value==='')); }
  else { lbl.textContent='Select\u2026'; lbl.classList.add('is-ph'); }
  wrap._last=sel.value;
}

function wrapSelect(sel){
  if(wrapped.has(sel)||sel.hasAttribute('data-rzr-skip')||(sel.size&&sel.size>1))return;
  wrapped.add(sel);
  if(sel.parentElement)sel.parentElement.classList.add('rzr-wrap-parent');
  sel.style.cssText='position:absolute!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;overflow:hidden!important;top:0!important;left:0!important;z-index:-1!important;border:none!important;padding:0!important;margin:0!important;';
  var sib=sel.nextElementSibling;
  if(sib&&sib.classList&&(sib.classList.contains('pointer-events-none')||sib.classList.contains('select-arrow')))sib.style.display='none';
  var t=document.createElement('div'); t.className='rzr-trigger'; t.setAttribute('tabindex','0'); t.setAttribute('role','combobox'); t.setAttribute('aria-haspopup','listbox'); t.setAttribute('aria-expanded','false');
  var lb=document.createElement('span');lb.className='rzr-label is-ph';lb.textContent='Select\u2026';
  var cv=document.createElement('span');cv.className='rzr-chev';cv.innerHTML=CHEV;
  t.appendChild(lb);t.appendChild(cv);
  var p=document.createElement('div');p.className='rzr-panel';p.style.display='none';
  var sw=document.createElement('div');sw.className='rzr-panel-search';
  var si=document.createElement('input');si.className='rzr-search-inp';si.type='text';si.placeholder='Search\u2026';si.autocomplete='off';si.spellcheck=false;
  sw.appendChild(si);
  var l=document.createElement('div');l.className='rzr-list';l.setAttribute('role','listbox');
  p.appendChild(sw);p.appendChild(l);
  var w=document.createElement('div');w.className='rzr-wrap';
  w._s=sel;w._t=t;w._p=p;w._sw=sw;w._si=si;w._lb=lb;w._l=l;w._last=sel.value;
  w.appendChild(t);w.appendChild(p);
  sel.parentNode.insertBefore(w,sel);
  w.appendChild(sel);
  si.addEventListener('input',function(){buildList(w,si.value);});
  si.addEventListener('keydown',function(e){if(e.key==='Escape'){close_(w);t.focus();}});
  t.addEventListener('click',function(e){ e.stopPropagation(); openWrap===w?close_(w):open_(w); });
  t.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();openWrap===w?close_(w):open_(w);} if(e.key==='Escape')close_(w); });
  var mo=new MutationObserver(function(){ updateLabel(w); if(openWrap===w){buildList(w,si.value);requestAnimationFrame(function(){positionPanel(w);});} });
  mo.observe(sel,{childList:true,subtree:true,characterData:true,attributes:true});
  var pid=setInterval(function(){ if(!document.contains(sel)){clearInterval(pid);mo.disconnect();if(openWrap===w)close_(w);return;} if(sel.value!==w._last)updateLabel(w); },150);
  updateLabel(w);
}

function initAll(){document.querySelectorAll('select').forEach(wrapSelect);}
new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ if(n.nodeType!==1)return; if(n.tagName==='SELECT')wrapSelect(n); else if(n.querySelectorAll)n.querySelectorAll('select').forEach(wrapSelect); }); }); }).observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAll);
else initAll();
})();