/** Measure document coordinates, including collapsed margins, without viewport scrollHeight feedback. */
export function buildMixFrameBridge(source: string, frameId: string, minHeight: number): string {
    return `<script>(function(){
  var frameId=${JSON.stringify(frameId)}, pending=false;
  function measure(){var b=document.body;if(!b)return ${minHeight};
    var cs=getComputedStyle(b), mb=parseFloat(cs.marginBottom)||0;
    var h=b.getBoundingClientRect().bottom+window.scrollY+mb;
    for(var i=0;i<b.children.length;i++){var el=b.children[i],r=el.getBoundingClientRect();
      if(r.width||r.height)h=Math.max(h,r.bottom+window.scrollY+(parseFloat(getComputedStyle(el).marginBottom)||0)+mb);}
    return Math.max(Math.ceil(h)+2,${minHeight});}
  function send(){parent.postMessage({source:${JSON.stringify(source)},type:'resize',id:frameId,height:measure()},'*');}
  function sched(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;send();});}
  window.addEventListener('load',sched);window.addEventListener('resize',sched);
  document.addEventListener('load',sched,true);document.addEventListener('toggle',sched,true);
  document.addEventListener('transitionend',sched,true);document.addEventListener('animationend',sched,true);
  if(window.ResizeObserver&&document.body)new ResizeObserver(sched).observe(document.body);
  if(window.MutationObserver)new MutationObserver(sched).observe(document.documentElement,{attributes:true,childList:true,subtree:true,characterData:true});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sched);
  sched();setTimeout(sched,60);setTimeout(sched,400);setTimeout(sched,1200);
})();</` + `script>`;
}
