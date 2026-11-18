(() => {
 'use strict';
 if (typeof populateStandbyDesignDropdown === 'function') populateStandbyDesignDropdown();
 const key='gp_living_design_v1', store=window.AppStorage || localStorage;
 const copy={
 de:['Natürlich & lebendig','Sanftes Seitendesign','Lebendige Animationen','Neuen Look ausprobieren?','Sanfte Farben und kurze Animationen machen die Seite lebendiger. Beides ist optional und in den Einstellungen einzeln abschaltbar.','Anwenden','Jetzt nicht'],
 en:['Natural & lively','Soft page design','Lively animations','Try the new look?','Soft colors and short animations bring the page to life. Both are optional and can be disabled separately in settings.','Apply','Not now'],
 es:['Natural y animado','Diseño suave','Animaciones','¿Probar el nuevo estilo?','Colores suaves y animaciones breves. Ambas opciones se pueden desactivar por separado en ajustes.','Aplicar','Ahora no'],
 fr:['Naturel et vivant','Design doux','Animations','Essayer le nouveau style ?','Des couleurs douces et des animations courtes. Chaque option peut être désactivée dans les réglages.','Appliquer','Pas maintenant'],
 pt:['Natural e vivo','Design suave','Animações','Experimentar o novo visual?','Cores suaves e animações curtas. As duas opções podem ser desativadas separadamente nas configurações.','Aplicar','Agora não'],
 tr:['Doğal ve canlı','Yumuşak tasarım','Canlı animasyonlar','Yeni görünümü dene?','Yumuşak renkler ve kısa animasyonlar. Her iki seçenek ayarlardan ayrı ayrı kapatılabilir.','Uygula','Şimdi değil']};
 let prefs={style:false,motion:false,asked:false};
 try {const saved=JSON.parse(store.getItem(key)||'null');if(saved)for(const k of Object.keys(prefs))prefs[k]=saved[k]===true;}catch(_){}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const active=new Set();let observer=null;
 const words=()=>copy[(store.getItem('app_language')||document.documentElement.lang||'de').slice(0,2)]||copy.en;
 const save=()=>{try{store.setItem(key,JSON.stringify(prefs));}catch(_){}};
 const allowed=()=>prefs.motion&&!reduced.matches&&!document.hidden&&!document.body.classList.contains('low-end')&&!document.body.classList.contains('standby-mode');
 function animate(el,frames,duration=420){if(!el.animate||!allowed())return;const a=el.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.2,1)'});active.add(a);a.onfinish=a.oncancel=()=>active.delete(a);}
 function motion(){
   observer?.disconnect();observer=null;for(const a of active)a.cancel();active.clear();
   if(!allowed())return;
   observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){animate(e.target,[{opacity:.6,translate:'0 10px'},{opacity:1,translate:'0 0'}]);observer?.unobserve(e.target);}},{threshold:.12});
   document.querySelectorAll('#main-content .glass-card').forEach(el=>observer.observe(el));
 }
 function apply(){
   document.body.classList.toggle('living-style',prefs.style);document.body.classList.toggle('living-motion',prefs.motion);
   for(const name of ['style','motion']){const el=document.getElementById('living-'+name);if(el)el.checked=prefs[name];}
   const w=words();document.querySelectorAll('[data-living]').forEach(el=>el.textContent=w[{title:0,style:1,motion:2}[el.dataset.living]]);
   motion();
 }
 for(const name of ['style','motion'])document.getElementById('living-'+name)?.addEventListener('change',e=>{prefs[name]=e.target.checked;prefs.asked=true;save();apply();});
 document.addEventListener('pointerover',e=>{const el=e.target.closest?.('button,a[href]');if(el&&!el.contains(e.relatedTarget)&&!el.matches(':disabled,[aria-disabled="true"]'))animate(el,[{filter:'brightness(1)'},{filter:'brightness(1.12)'},{filter:'brightness(1)'}],250);},{passive:true});
 reduced.addEventListener('change',motion);document.addEventListener('visibilitychange',motion);
 let mode=document.body.classList.contains('low-end')+'|'+document.body.classList.contains('standby-mode');
 new MutationObserver(()=>{const next=document.body.classList.contains('low-end')+'|'+document.body.classList.contains('standby-mode');if(next!==mode){mode=next;motion();}}).observe(document.body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>apply()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 function offer(){
   if(prefs.asked||document.hidden||document.body.classList.contains('standby-mode')||document.querySelector('dialog[open]')||window.OnboardingCoordinator?.isOnboarding)return;
   if(!['true','1'].includes(store.getItem('onboarding_completed')))return;
   prefs.asked=true;save();document.removeEventListener('click',afterClick,true);
   const w=words(),dialog=document.createElement('dialog');dialog.id='living-offer';dialog.setAttribute('aria-labelledby','living-offer-title');
   const title=document.createElement('h2');title.id='living-offer-title';title.textContent=w[3];const desc=document.createElement('p');desc.textContent=w[4];
   const yes=document.createElement('button');yes.id='living-accept';yes.textContent=w[5];const no=document.createElement('button');no.id='living-decline';no.textContent=w[6];
   yes.onclick=()=>{prefs.style=prefs.motion=true;save();apply();dialog.close();};no.onclick=()=>dialog.close();
   dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.append(title,desc,yes,no);document.body.append(dialog);dialog.showModal();no.focus();
 }
 function afterClick(){setTimeout(offer,0);}
 apply();if(!prefs.asked){document.addEventListener('click',afterClick,true);window.addEventListener('load',offer,{once:true});setTimeout(offer,0);}
})();
