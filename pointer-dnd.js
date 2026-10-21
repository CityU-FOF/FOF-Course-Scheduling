/* FOF adapter for interact.js (MIT). Keeps Vue-owned nodes in place; only a visual clone moves. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.FOFPointerDnD=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 function install(options){
  const root=options.root,doc=root.ownerDocument,win=doc.defaultView,interact=options.interact||win.interact;
  if(typeof interact!=='function')return null;
  let ghost=null,source=null,activeId='',zone=null,dx=0,dy=0,suppressUntil=0;
  function clear(){if(ghost)ghost.remove();if(source)source.classList.remove('pointer-source');if(zone)zone.classList.remove('pointer-zone');ghost=source=zone=null;activeId='';dx=dy=0;}
  function targetAt(x,y){const hit=doc.elementFromPoint(x,y);const z=hit&&hit.closest('[data-drop-day],[data-drop-pool]');return z&&root.contains(z)?z:null;}
  const listeners={
   start(e){const b=options.getBlock(e.target.dataset.blockId);if(!b||b.locked){e.interaction?.stop();return;}source=e.target;activeId=b.id;const r=source.getBoundingClientRect();ghost=source.cloneNode(true);ghost.removeAttribute('data-block-id');ghost.classList.add('pointer-ghost');Object.assign(ghost.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',pointerEvents:'none',zIndex:'1000',margin:'0'});ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');const scale=win.getComputedStyle(source).getPropertyValue('--ui-scale');if(scale)ghost.style.setProperty('--ui-scale',scale);doc.body.appendChild(ghost);source.classList.add('pointer-source');},
   move(e){if(!ghost)return;dx+=e.dx;dy+=e.dy;ghost.style.transform=`translate(${dx}px,${dy}px)`;if(zone)zone.classList.remove('pointer-zone');zone=targetAt(e.clientX,e.clientY);if(zone)zone.classList.add('pointer-zone');const sc=root.querySelector('.timetable-panel .grid-scroll');if(sc){const r=sc.getBoundingClientRect();if(e.clientY>=r.top&&e.clientY<=r.bottom&&e.clientX>=r.left-30&&e.clientX<=r.right+30){if(e.clientX>r.right-35)sc.scrollLeft+=20;else if(e.clientX<r.left+35)sc.scrollLeft-=20;}}},
   end(e){if(!activeId){clear();return;}const id=activeId,z=targetAt(e.clientX,e.clientY);suppressUntil=Date.now()+450;clear();if(!z)return;if(z.hasAttribute('data-drop-pool'))options.onPool(id);else options.onPlace(id,Number(z.dataset.dropDay),Number(z.dataset.dropSlot));}
  };
  const bound=interact('.course-card[data-block-id]:not(.locked)',{context:root}).draggable({inertia:false,ignoreFrom:'button,input,select,textarea,a',listeners});
  const suppress=e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
  const escape=e=>{if(e.key==='Escape')cancel();};
  const cancel=()=>{clear();interact.stop();};root.addEventListener('pointercancel',cancel);doc.addEventListener('touchcancel',cancel);root.addEventListener('click',suppress,true);doc.addEventListener('keydown',escape);win.addEventListener('blur',cancel);
  return {destroy(){bound.unset();clear();root.removeEventListener('click',suppress,true);doc.removeEventListener('keydown',escape);win.removeEventListener('blur',cancel);root.removeEventListener('pointercancel',cancel);doc.removeEventListener('touchcancel',cancel);},listeners};
 }
 return {install};
});
