// Shared renderer contracts, kept independent of DOM/GPU for regression tests.
export function backgroundCacheKey(w,h,camera,direction,env){
 return [w,h,camera.fov,camera.aspect,direction.x.toFixed(5),direction.y.toFixed(5),direction.z.toFixed(5),env?.image?.width||0,env?.uuid||'',env?.offset?.x||0,env?.offset?.y||0,env?.repeat?.x||1,env?.repeat?.y||1].join(',');
}
export class RenderReadiness {
 constructor(){this.pending=false;this.rendered=false;}
 beginScene(){this.rendered=false;}
 loadStart(){this.pending=true;this.rendered=false;}
 loadDone(){this.pending=false;this.rendered=false;}
 frameDone(){if(!this.pending)this.rendered=true;return this.ready;}
 get ready(){return !this.pending&&this.rendered;}
}
