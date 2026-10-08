import * as THREE from 'three';
export function shoreline(z){return-8.5-.07*Math.pow(Math.max(0,Math.abs(z)-9),2)+Math.sin(z*.29)*.48+Math.sin(z*.83)*.16+Math.sin(z*1.71)*.045;}
export function riverWidth(z){return 7+Math.min(3,Math.abs(z)*.035);}
export function createRiverGeometry(){
 const samples=[];for(let z=-70;z<=70;z+=.35)samples.push(z);
 const wp=[],wu=[],wc=[],wi=[],bp=[],bu=[],bc=[],bi=[];
 const offsets=[0,.14,.44,1.25,3.4],heights=[-.026,-.013,.012,.022,-.055],shades=[.62,.74,.91,1,1],alphas=[1,1,1,1,0];
 for(const [i,z]of samples.entries()){
  const x=shoreline(z),width=riverWidth(z),fade=Math.max(0,Math.min(1,(65-Math.hypot(x,z))/23));
  for(const xx of[x-width,x]){wp.push(xx,-.026,z);wu.push(xx*.23,z*.23);wc.push(1,1,1,fade);}
  if(i<samples.length-1){const a=i*2;wi.push(a,a+2,a+1,a+1,a+2,a+3);}
  for(const side of[-1,1]){
   const edge=side===1?x:x-width;
   for(let j=0;j<offsets.length;j++){
    const xx=edge+side*offsets[j]*(1+.15*Math.sin(z*.69));bp.push(xx,heights[j],z);bu.push(xx*.4,z*.4);
    const shade=shades[j];bc.push(shade,shade,shade*.94,alphas[j]*fade);
   }
  }
  if(i<samples.length-1)for(let side=0;side<2;side++)for(let j=0;j<4;j++){const a=i*10+side*5+j,b=a+10;if(side===0)bi.push(a,a+1,b,a+1,b+1,b);else bi.push(a,b,a+1,a+1,b,b+1);}
 }
 function geo(p,u,c,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,4));g.setIndex(idx);g.computeVertexNormals();return g;}
 return{water:geo(wp,wu,wc,wi),banks:geo(bp,bu,bc,bi)};
}
