(()=>{
'use strict';
const root=document.documentElement,body=document.body;
const read=k=>{try{return (window.AppStorage||localStorage).getItem(k);}catch(_){return null;}};
const write=(k,v)=>{try{(window.AppStorage||localStorage).setItem(k,v);}catch(_){}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const home=!!document.getElementById('liquid-glass-toggle');
let toggle;
const glassDefaults={enabled:true,blur:7,saturation:128,refraction:3.4,edge:.28};
let glassConfig={...glassDefaults};
function applyGlassConfig(value){
 glassConfig={...glassDefaults,...value};
 for(const [key,val] of Object.entries(glassConfig))root.style.setProperty(key==='edge'?'--gp-edge-alpha':'--gp-'+key,String(val));
 root.classList.toggle('gp-glass-admin-disabled',glassConfig.enabled===false);
 const displacement=document.querySelector('#gp-liquid-refraction feDisplacementMap');if(displacement)displacement.setAttribute('scale',String(glassConfig.refraction));
}
async function loadGlassConfig(){try{const response=await fetch('https://raw.githubusercontent.com/Gamingpig/About-Gamingpig/main/data/glass-config.json?t='+Math.floor(Date.now()/60000),{cache:'no-store'});if(response.ok)applyGlassConfig(await response.json());}catch(_){} }
function sync(){
 const on=home?body.classList.contains('liquid-glass-active'):read('liquidGlassMode')==='true';
 const saving=body.classList.contains('low-end')||(!home&&read('perfMode')==='true');
 let motion=false;try{motion=JSON.parse(read('gp_living_design_v1')||'{}').motion===true;}catch(_){}
 root.classList.toggle('gp-glass',on);root.classList.toggle('gp-glass-saving',saving);root.classList.toggle('gp-glass-motion',motion&&!saving&&!reduced.matches);
 if(toggle)toggle.setAttribute('aria-pressed',String(on));
}
if(!home&&!body.hasAttribute('data-glass-overlay')){
 const header=document.querySelector('header');
 if(header){toggle=document.createElement('button');toggle.id='gp-glass-toggle';toggle.type='button';toggle.textContent='◈ Liquid Glass';toggle.onclick=()=>{write('liquidGlassMode',String(read('liquidGlassMode')!=='true'));sync();};header.append(toggle);}
}
new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['class']});
window.addEventListener('storage',sync);window.addEventListener('pageshow',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
sync();

function installOptics(){
 if(document.getElementById('gp-liquid-optics'))return;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.id='gp-liquid-optics';svg.setAttribute('aria-hidden','true');
 svg.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
 svg.innerHTML='<defs><filter id="gp-liquid-refraction" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .018" numOctaves="1" seed="7" result="surface"/><feGaussianBlur in="surface" stdDeviation=".7" result="softSurface"/><feDisplacementMap in="SourceGraphic" in2="softSurface" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="refracted"/><feGaussianBlur in="refracted" stdDeviation=".16"/></filter></defs>';
 body.append(svg);
 applyGlassConfig(glassConfig);
}

function installUniversalFooter(){
 if(body.hasAttribute('data-glass-overlay')||document.getElementById('liquid-glass-toggle'))return;
 let oldMenu=document.getElementById('footer-expandable-menu');
 let oldBubble=document.getElementById('footer-bubble');
 if(oldMenu){const fresh=oldMenu.cloneNode(false);oldMenu.replaceWith(fresh);oldMenu=fresh;}else{oldMenu=document.createElement('nav');oldMenu.id='footer-expandable-menu';body.append(oldMenu);}
 if(oldBubble){const fresh=oldBubble.cloneNode(false);oldBubble.replaceWith(fresh);oldBubble=fresh;}else{oldBubble=document.createElement('div');oldBubble.id='footer-bubble';body.append(oldBubble);}
 const menu=oldMenu,bubble=oldBubble;
 menu.className='gp-universal-footer-menu hidden';menu.setAttribute('aria-label','Footer navigation');
 bubble.className='gp-universal-footer';bubble.setAttribute('aria-hidden','true');
 const homePage=!!document.getElementById('liquid-glass-toggle');
 const copy={
  de:{title:'Navigation & Rechtliches',more:'Mehr',home:'Startseite',news:'Was ist neu?',status:'Live-Status',privacy:'Datenschutz',legal:'Impressum',roadmap:'Roadmap',settings:'Einstellungen',admin:'Admin'},
  en:{title:'Navigation & Legal',more:'More',home:'Home',news:"What's New",status:'Live Status',privacy:'Privacy',legal:'Legal Notice',roadmap:'Roadmap',settings:'Settings',admin:'Admin'},
  es:{title:'Navegación y legal',more:'Más',home:'Inicio',news:'Novedades',status:'Estado',privacy:'Privacidad',legal:'Aviso legal',roadmap:'Hoja de ruta',settings:'Ajustes',admin:'Admin'},
  fr:{title:'Navigation et mentions',more:'Plus',home:'Accueil',news:'Nouveautés',status:'État',privacy:'Confidentialité',legal:'Mentions légales',roadmap:'Feuille de route',settings:'Réglages',admin:'Admin'},
  pt:{title:'Navegação e legal',more:'Mais',home:'Início',news:'Novidades',status:'Status',privacy:'Privacidade',legal:'Aviso legal',roadmap:'Roteiro',settings:'Ajustes',admin:'Admin'},
  tr:{title:'Gezinme ve yasal',more:'Daha',home:'Ana sayfa',news:'Yenilikler',status:'Canlı durum',privacy:'Gizlilik',legal:'Yasal bildirim',roadmap:'Yol haritası',settings:'Ayarlar',admin:'Yönetici'}
 };
 menu.innerHTML='<div class="gp-footer-head"><span id="footer-menu-title"></span><span id="footer-menu-hint">v24.213.0</span></div><div class="gp-footer-grid"><a class="gp-footer-link" href="index.html">⌂ <span data-gp-footer="home"></span></a><button class="gp-footer-link" id="footer-whats-new-btn" type="button">📜 <span data-gp-footer="news"></span></button><a class="gp-footer-link" href="status.html">🟢 <span data-gp-footer="status"></span></a><a class="gp-footer-link" href="privacy.html">🛡️ <span data-gp-footer="privacy"></span></a><a class="gp-footer-link" href="impressum.html">⚖️ <span data-gp-footer="legal"></span></a><a class="gp-footer-link" href="roadmap.html">🔮 <span data-gp-footer="roadmap"></span></a><button class="gp-footer-link" id="footer-settings-btn" type="button">⚙️ <span data-gp-footer="settings"></span></button><a class="gp-footer-link" href="push-admin.html">🔐 <span data-gp-footer="admin"></span></a></div>';
 bubble.innerHTML='<span id="footer-established">© 2026 GAMINGPIG</span><span aria-hidden="true">•</span><span id="footer-version-label">v24.213.0</span><span aria-hidden="true">•</span><button id="footer-menu-toggle-btn" type="button" aria-expanded="false"><span id="footer-more-label"></span> <span id="footer-menu-arrow">▲</span></button>';
 const motion=()=>!reduced.matches&&!body.classList.contains('standby-mode');
 let shown=false,menuOpen=false,bubbleAnimation=null,menuAnimation=null;
 function translate(){const lang=(root.lang||'de').slice(0,2),t=copy[lang]||copy.en;menu.querySelector('#footer-menu-title').textContent=t.title;bubble.querySelector('#footer-more-label').textContent=t.more;menu.querySelectorAll('[data-gp-footer]').forEach(e=>e.textContent=t[e.dataset.gpFooter]);}
 function positionMenu(){const r=bubble.getBoundingClientRect();menu.style.bottom=Math.max(64,innerHeight-r.top+10)+'px';}
 function animateBubble(show){
  if(show===shown)return;shown=show;if(bubbleAnimation)bubbleAnimation.cancel();
  if(show){bubble.classList.add('footer-bubble-visible');bubble.removeAttribute('aria-hidden');if(motion())bubbleAnimation=bubble.animate([{opacity:0,transform:'translateX(-50%) translateY(24px) scale(.92)',filter:'blur(4px)'},{opacity:1,transform:'translateX(-50%) translateY(-2px) scale(1.015)',filter:'blur(0)',offset:.76},{opacity:1,transform:'translateX(-50%) translateY(0) scale(1)',filter:'blur(0)'}],{duration:540,easing:'cubic-bezier(.16,1,.3,1)'});}
  else{if(menuOpen)closeMenu(true);if(!motion()){bubble.classList.remove('footer-bubble-visible');bubble.setAttribute('aria-hidden','true');return;}bubbleAnimation=bubble.animate([{opacity:1,transform:'translateX(-50%) translateY(0) scale(1)'},{opacity:0,transform:'translateX(-50%) translateY(20px) scale(.94)',filter:'blur(3px)'}],{duration:260,easing:'cubic-bezier(.4,0,.2,1)'});bubbleAnimation.onfinish=()=>{bubble.classList.remove('footer-bubble-visible');bubble.setAttribute('aria-hidden','true');};}
 }
 function openMenu(){if(menuOpen)return;menuOpen=true;if(menuAnimation)menuAnimation.cancel();positionMenu();menu.classList.remove('hidden');menu.classList.add('footer-animating');bubble.querySelector('#footer-menu-toggle-btn').setAttribute('aria-expanded','true');bubble.querySelector('#footer-menu-arrow').style.transform='rotate(180deg)';if(!motion()){menu.classList.remove('footer-animating');return;}menuAnimation=menu.animate([{opacity:0,transform:'translateX(-50%) translateY(22px) scale(.9)',filter:'blur(5px)'},{opacity:1,transform:'translateX(-50%) translateY(-3px) scale(1.012)',filter:'blur(0)',offset:.78},{opacity:1,transform:'translateX(-50%) translateY(0) scale(1)',filter:'blur(0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});menuAnimation.onfinish=()=>menu.classList.remove('footer-animating');}
 function closeMenu(immediate){if(!menuOpen&&!immediate)return;menuOpen=false;if(menuAnimation)menuAnimation.cancel();bubble.querySelector('#footer-menu-toggle-btn').setAttribute('aria-expanded','false');bubble.querySelector('#footer-menu-arrow').style.transform='rotate(0deg)';const done=()=>{menu.classList.add('hidden');menu.classList.remove('footer-animating');};if(immediate||!motion())return done();menu.classList.add('footer-animating');menuAnimation=menu.animate([{opacity:1,transform:'translateX(-50%) translateY(0) scale(1)'},{opacity:0,transform:'translateX(-50%) translateY(16px) scale(.94)',filter:'blur(4px)'}],{duration:240,easing:'cubic-bezier(.4,0,.2,1)'});menuAnimation.onfinish=done;}
 function update(){const max=Math.max(0,document.documentElement.scrollHeight-innerHeight),atEnd=max===0||scrollY/max>=.8;animateBubble(atEnd&&!body.classList.contains('standby-mode'));}
 window.toggleFooterMenu=force=>{const next=typeof force==='boolean'?force:!menuOpen;next?openMenu():closeMenu(false);};
 const footerToggle=bubble.querySelector('#footer-menu-toggle-btn');
 const toggleMenu=()=>{menuOpen?closeMenu(false):openMenu();};
 footerToggle.addEventListener('pointerdown',event=>{event.preventDefault();event.stopImmediatePropagation();toggleMenu();},true);
 footerToggle.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(event.detail===0)toggleMenu();},true);
 menu.querySelector('#footer-whats-new-btn').addEventListener('click',()=>{closeMenu(false);if(homePage&&typeof window.openEpicWhatsNewTour==='function')window.openEpicWhatsNewTour(false);else location.href='release.html';});
 menu.querySelector('#footer-settings-btn').addEventListener('click',e=>{closeMenu(false);if(homePage&&typeof window.toggleStandaloneSettings==='function')window.toggleStandaloneSettings(e);else location.href='index.html?openSettings=1';});
 document.addEventListener('click',e=>{if(menuOpen&&!menu.contains(e.target)&&!bubble.contains(e.target))closeMenu(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu(false);});
 addEventListener('scroll',update,{passive:true});addEventListener('resize',()=>{positionMenu();update();},{passive:true});
 new MutationObserver(update).observe(body,{attributes:true,attributeFilter:['class']});new MutationObserver(translate).observe(root,{attributes:true,attributeFilter:['lang']});
 translate();update();
 if(homePage&&new URLSearchParams(location.search).get('openSettings')==='1'&&typeof window.toggleStandaloneSettings==='function'){
  setTimeout(()=>window.toggleStandaloneSettings(new Event('click')),0);
  history.replaceState(null,'',location.pathname+location.hash);
 }
}
function installGlassAdmin(){
 if(!/push-admin\.html$/i.test(location.pathname)||document.getElementById('gp-glass-admin'))return;
 const dashboard=document.getElementById('admin-dashboard'),host=document.getElementById('view-glass')||dashboard;if(!host||!dashboard)return;const panel=document.createElement('section');panel.id='gp-glass-admin';panel.className='glass-card';panel.hidden=dashboard.classList.contains('hidden');
 panel.innerHTML='<h2>💎 Globales Liquid Glass</h2><p>Änderungen gelten ohne Website-Update auf allen Seiten.</p><label><input id="gp-admin-enabled" type="checkbox"> Aktiv</label><label>Unschärfe <input id="gp-admin-blur" type="range" min="0" max="24" step="1"></label><label>Sättigung <input id="gp-admin-saturation" type="range" min="80" max="200" step="1"></label><label>Lichtbrechung <input id="gp-admin-refraction" type="range" min="0" max="16" step=".2"></label><label>Glaskante <input id="gp-admin-edge" type="range" min="0" max=".8" step=".02"></label><button id="gp-admin-save" type="button">Für alle speichern</button><span id="gp-admin-state" role="status"></span>';
 host.append(panel);
 const ids={enabled:'gp-admin-enabled',blur:'gp-admin-blur',saturation:'gp-admin-saturation',refraction:'gp-admin-refraction',edge:'gp-admin-edge'};for(const [key,id] of Object.entries(ids))document.getElementById(id)[key==='enabled'?'checked':'value']=glassConfig[key];
 document.getElementById('gp-admin-save').onclick=async()=>{const state=document.getElementById('gp-admin-state');try{const token=await window.AdminVault?.getToken();if(!token)throw new Error('GitHub-Token fehlt im Tresor.');const value={enabled:document.getElementById(ids.enabled).checked,blur:+document.getElementById(ids.blur).value,saturation:+document.getElementById(ids.saturation).value,refraction:+document.getElementById(ids.refraction).value,edge:+document.getElementById(ids.edge).value,updatedAt:new Date().toISOString()};const url='https://api.github.com/repos/Gamingpig/About-Gamingpig/contents/data/glass-config.json';const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};const current=await fetch(url,{headers,cache:'no-store'});const meta=current.ok?await current.json():{};const content=btoa(unescape(encodeURIComponent(JSON.stringify(value,null,2)+'\n')));const saved=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'admin: update global liquid glass settings [skip ci]',content,sha:meta.sha})});if(!saved.ok)throw new Error('Speichern fehlgeschlagen: '+saved.status);applyGlassConfig(value);state.textContent='✓ Global gespeichert';}catch(error){state.textContent=error.message;}};
}
const bootSharedGlass=()=>{installOptics();installUniversalFooter();installGlassAdmin();loadGlassConfig().then(()=>{const panel=document.getElementById('gp-glass-admin');if(panel)for(const [key,id] of Object.entries({enabled:'gp-admin-enabled',blur:'gp-admin-blur',saturation:'gp-admin-saturation',refraction:'gp-admin-refraction',edge:'gp-admin-edge'}))document.getElementById(id)[key==='enabled'?'checked':'value']=glassConfig[key];});};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bootSharedGlass,0),{once:true});
else bootSharedGlass();
})();
