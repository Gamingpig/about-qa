(()=>{'use strict';const root=document.documentElement,body=document.body,defaults={enabled:true,blur:7,saturation:128,refraction:3.4,edge:.28},reduced=matchMedia('(prefers-reduced-motion: reduce)');
/* Android detection — add gp-android class for CSS compatibility layer */
try{const ua=navigator.userAgent||'';if(/Android/i.test(ua)){root.classList.add('gp-android');const lowMem=(navigator.deviceMemory&&navigator.deviceMemory<=4)||false;const lowCores=(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||false;if(lowMem||lowCores)root.classList.add('gp-android-lowend');}if(/Mobile|iP(hone|od|ad)|Android.*Mobile/i.test(ua))root.classList.add('gp-mobile');}catch(e){}
let config={...defaults};
function apply(value){config={...defaults,...value};const blur=Math.max(0,Number(config.blur)||0),sat=Math.max(0,Number(config.saturation)||0),ref=Math.max(0,Math.min(16,Number(config.refraction)||0)),edge=Math.max(0,Math.min(.8,Number(config.edge)||0));root.style.setProperty('--gp-blur',`${blur}px`);root.style.setProperty('--gp-saturation',`${sat}%`);root.style.setProperty('--gp-refraction',ref);root.style.setProperty('--gp-edge-alpha',edge);root.style.setProperty('--gp-prism-opacity',ref/16*.56);root.style.setProperty('--gp-prism-shift',`${ref*.18}px`);document.querySelector('#gp-liquid-refraction feDisplacementMap')?.setAttribute('scale',String(ref));root.classList.toggle('gp-glass-admin-disabled',config.enabled===false)}
function optics(){if(document.getElementById('gp-liquid-optics'))return;/* Skip SVG refraction filter creation on Android — not supported */if(root.classList.contains('gp-android')){apply(config);return}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='gp-liquid-optics';svg.setAttribute('aria-hidden','true');svg.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';svg.innerHTML='<defs><filter id="gp-liquid-refraction" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .018" numOctaves="1" seed="7" result="surface"/><feGaussianBlur in="surface" stdDeviation=".55" result="soft-surface"/><feDisplacementMap in="SourceGraphic" in2="soft-surface" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';body.append(svg);apply(config)}
async function load(){try{const r=await fetch(`data/glass-config.json?release=${Date.now()}`,{cache:'no-store'});if(r.ok)apply(await r.json())}catch(e){console.warn('[glass] configuration unavailable',e)}}
function sync(){root.classList.toggle('gp-glass',body.classList.contains('liquid-glass-active')||!document.getElementById('liquid-glass-toggle'))}
function footer(){
  if(body.hasAttribute('data-glass-overlay'))return;
  const isHomePage=!!document.getElementById('liquid-glass-toggle');
  /* Strict decoupling: index.html has its own dedicated, hardware-accelerated footer engine */
  if(isHomePage)return;

  let bubble=document.getElementById('footer-bubble');
  let menu=document.getElementById('footer-expandable-menu')||document.getElementById('footer-menu-dropdown');

  if(!bubble){
    bubble=document.createElement('div');
    bubble.id='footer-bubble';
    bubble.className='gp-universal-footer';
    bubble.setAttribute('aria-hidden','true');
    bubble.innerHTML='<span id="footer-established">© 2026 GAMINGPIG</span><span aria-hidden="true">•</span><span id="footer-version-label">v24.213.0</span><span aria-hidden="true">•</span><button id="footer-menu-toggle-btn" type="button" aria-expanded="false"><span id="footer-more-label">Mehr</span> <span id="footer-menu-arrow">▲</span></button>';
    body.appendChild(bubble);
  }
  if(!menu){
    menu=document.createElement('div');
    menu.id='footer-expandable-menu';
    menu.className='gp-universal-footer-menu hidden';
    menu.setAttribute('role','menu');
    menu.setAttribute('aria-label','Navigation und Links');
    menu.innerHTML='<div class="gp-footer-head"><span id="footer-menu-title">Navigation & Rechtliches</span><span id="footer-menu-hint">v24.213.0</span></div><div class="gp-footer-grid"><a class="gp-footer-link" href="index.html">⌂ <span data-gp-footer="home">Startseite</span></a><button class="gp-footer-link" id="footer-whats-new-btn" type="button">📜 <span data-gp-footer="news">Was ist neu?</span></button><a class="gp-footer-link" href="status.html">🟢 <span data-gp-footer="status">Live-Status</span></a><a class="gp-footer-link" href="privacy.html">🛡️ <span data-gp-footer="privacy">Datenschutz</span></a><a class="gp-footer-link" href="impressum.html">⚖️ <span data-gp-footer="legal">Impressum</span></a><a class="gp-footer-link" href="roadmap.html">🔮 <span data-gp-footer="roadmap">Roadmap</span></a><a class="gp-footer-link" href="push-admin.html">🔐 <span data-gp-footer="admin">Admin</span></a></div>';
    body.appendChild(menu);
  }

  const toggle=document.getElementById('footer-menu-toggle-btn');
  if(!toggle||bubble.dataset.gpFooterInitialized)return;
  bubble.dataset.gpFooterInitialized='true';
  bubble.dataset.gpFooter=menu.dataset.gpFooter='true';
  toggle.removeAttribute('onclick');

  let shown=false,open=false,closeTimer=null;

  const copy={
    de:{title:'Navigation & Rechtliches',more:'Mehr',home:'Startseite',news:'Was ist neu?',status:'Live-Status',privacy:'Datenschutz',legal:'Impressum',roadmap:'Roadmap',admin:'Admin'},
    en:{title:'Navigation & Legal',more:'More',home:'Home',news:"What's New",status:'Live Status',privacy:'Privacy',legal:'Legal Notice',roadmap:'Roadmap',admin:'Admin'},
    es:{title:'Navegación y legal',more:'Más',home:'Inicio',news:'Novedades',status:'Estado',privacy:'Privacidad',legal:'Aviso legal',roadmap:'Hoja de ruta',admin:'Admin'},
    fr:{title:'Navigation et mentions',more:'Plus',home:'Accueil',news:'Nouveautés',status:'État',privacy:'Confidentialité',legal:'Mentions légales',roadmap:'Feuille de route',admin:'Admin'},
    pt:{title:'Navegação e legal',more:'Mais',home:'Início',news:'Novidades',status:'Status',privacy:'Privacidade',legal:'Aviso legal',roadmap:'Roteiro',admin:'Admin'},
    tr:{title:'Gezinme ve yasal',more:'Daha',home:'Ana sayfa',news:'Yenilikler',status:'Canlı durum',privacy:'Gizlilik',legal:'Yasal bildirim',roadmap:'Yol haritası',admin:'Yönetici'}
  };

  function translate(){
    const lang=((window.AppStorage||localStorage).getItem('app_language')||root.lang||'de').slice(0,2);
    const t=copy[lang]||copy.de;
    const titleEl=menu.querySelector('#footer-menu-title');
    const moreEl=bubble.querySelector('#footer-more-label');
    if(titleEl)titleEl.textContent=t.title;
    if(moreEl)moreEl.textContent=t.more;
    menu.querySelectorAll('[data-gp-footer]').forEach(e=>{if(t[e.dataset.gpFooter])e.textContent=t[e.dataset.gpFooter];});
  }

  function positionMenu(){
    const r=bubble.getBoundingClientRect();
    menu.style.bottom = Math.max(64, innerHeight - r.top + 12) + "px";
  }

  function expand(v){
    open=v;
    toggle.setAttribute('aria-expanded',String(v));
    const a=document.getElementById('footer-menu-arrow');
    if(a)a.style.transform=v?'rotate(180deg)':'rotate(0deg)';
  }

  function closeMenu(now=false){
    if(!open&&menu.classList.contains('hidden'))return;
    clearTimeout(closeTimer);
    expand(false);
    if(now||reduced.matches){
      menu.classList.add('hidden');
      menu.classList.remove('menu-opening','menu-closing');
      return;
    }
    menu.classList.remove('menu-opening');
    menu.classList.add('menu-closing');
    closeTimer=setTimeout(()=>{
      menu.classList.add('hidden');
      menu.classList.remove('menu-closing');
    },220);
  }

  function openMenu(){
    if(open)return;
    clearTimeout(closeTimer);
    expand(true);
    positionMenu();
    menu.classList.remove('hidden','menu-closing');
    menu.classList.add('menu-opening');
  }

  function bubbleState(next){
    if(next===shown)return;
    shown=next;
    if(next){
      bubble.classList.add('footer-bubble-visible');
      bubble.removeAttribute('aria-hidden');
    } else {
      closeMenu(true);
      bubble.classList.remove('footer-bubble-visible');
      bubble.setAttribute('aria-hidden','true');
    }
  }

  let ticking=false;
  const update=()=>{
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(()=>{
      ticking=false;
      const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
      const atEnd=(max<=80)||(max>0&&(max-scrollY<=180));
      const farAway=max>0&&(max-scrollY>300);
      if(atEnd&&!body.classList.contains('standby-mode')){
        bubbleState(true);
      }else if(farAway){
        bubbleState(false);
      }
    });
  };

  toggle.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    open?closeMenu():openMenu();
  },true);

  document.addEventListener('pointerdown',e=>{
    if(open&&!menu.contains(e.target)&&!bubble.contains(e.target)){closeMenu();}
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeMenu();
  });

  const whatsNewBtn=menu.querySelector('#footer-whats-new-btn');
  if(whatsNewBtn){
    whatsNewBtn.addEventListener('click',()=>{
      closeMenu(false);
      location.href='release.html';
    });
  }

  window.toggleFooterMenu=force=>(typeof force==='boolean'?force:!open)?openMenu():closeMenu();
  addEventListener('scroll',update,{passive:true});
  addEventListener('resize',()=>{positionMenu();update();},{passive:true});
  new MutationObserver(update).observe(body,{attributes:true,attributeFilter:['class']});
  new MutationObserver(translate).observe(root,{attributes:true,attributeFilter:['lang']});
  translate();
  update();
  try{fetch('version.json').then(r=>r.ok?r.json():null).then(v=>{if(v&&v.version){const l=document.getElementById('footer-version-label');if(l)l.textContent='v'+v.version;const h=document.getElementById('footer-menu-hint');if(h)h.textContent='v'+v.version;}}).catch(()=>{});}catch(e){}
}
function admin(){if(!/push-admin\.html$/i.test(location.pathname))return;const host=document.getElementById('view-glass')||document.getElementById('admin-dashboard');if(!host||document.getElementById('gp-glass-admin'))return;const p=document.createElement('section');p.id='gp-glass-admin';p.className='glass-card';p.innerHTML='<h2>💎 Globales Liquid Glass</h2><label><input id="gp-admin-enabled" type="checkbox"> Aktiv</label><label>Unschärfe <input id="gp-admin-blur" type="range" min="0" max="24"></label><label>Sättigung <input id="gp-admin-saturation" type="range" min="80" max="200"></label><label>Lichtbrechung <input id="gp-admin-refraction" type="range" min="0" max="16" step=".2"></label><label>Glaskante <input id="gp-admin-edge" type="range" min="0" max=".8" step=".02"></label><button id="gp-admin-save" type="button">Für alle speichern</button><span id="gp-admin-state" role="status"></span>';host.append(p);const fields={enabled:'gp-admin-enabled',blur:'gp-admin-blur',saturation:'gp-admin-saturation',refraction:'gp-admin-refraction',edge:'gp-admin-edge'},syncFields=()=>Object.entries(fields).forEach(([k,id])=>document.getElementById(id)[k==='enabled'?'checked':'value']=config[k]);syncFields();p.querySelector('#gp-admin-save').onclick=async()=>{const state=p.querySelector('#gp-admin-state');try{const token=await window.AdminVault?.getToken();if(!token)throw Error('GitHub-Token fehlt im Tresor.');const value=Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,k==='enabled'?document.getElementById(id).checked:Number(document.getElementById(id).value)]));value.updatedAt=new Date().toISOString();const url='https://api.github.com/repos/Gamingpig/About-Gamingpig/contents/data/glass-config.json',headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},cur=await fetch(url,{headers,cache:'no-store'}),meta=cur.ok?await cur.json():{},content=btoa(unescape(encodeURIComponent(`${JSON.stringify(value,null,2)}\n`))),saved=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'admin: update global liquid glass settings [skip ci]',content,sha:meta.sha})});if(!saved.ok)throw Error(`Speichern fehlgeschlagen: ${saved.status}`);apply(value);state.textContent='✓ Global gespeichert'}catch(e){state.textContent=e.message}}}
function boot(){optics();sync();footer();admin();load();new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['class']})}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot()})();
