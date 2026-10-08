import * as THREE from 'three';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Smooth terrain preserves the exact flat teaching-site elevation and footprint.
export function riseHeight(x,z,size){
 const r=size/2,dx=Math.max(0,Math.abs(x)-r),dz=Math.max(0,Math.abs(z)-r),distance=Math.hypot(dx,dz);
 const base=1-smooth(distance/2.0);
 if(z<=r)return base;
 const path=1-smooth((z-r)/3.8),blend=1-smooth((Math.abs(x)-.5)/.95);
 return Math.max(base,base+(path-base)*blend);
}
export function earthenRiseGeometry(size){
 const r=size/2,extent=r+2.15,zMin=-extent,zMax=r+4,cols=44,rows=48,pos=[],uv=[],colors=[],idx=[];
 for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=cols;ix++){
  const x=-extent+ix/cols*extent*2,z=zMin+iz/rows*(zMax-zMin),y=riseHeight(x,z,size);pos.push(x,y-.044*(1-y),z);uv.push(x*.4,z*.4);colors.push(1,1,1,Math.min(1,y*10));
 }
 for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){const a=iz*(cols+1)+ix,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function risePathGeometry(size){const pos=[],uv=[],idx=[],r=size/2;for(let i=0;i<=24;i++){const z=r-.12+i/24*3.8;for(const x of[-.37,.37]){const h=riseHeight(x,z,size);pos.push(x,h-.044*(1-h)+.008,z);uv.push(x,z*.3);}if(i<24){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
