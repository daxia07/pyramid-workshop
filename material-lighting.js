import * as THREE from 'three';
export function tangentLightBasis(vertices,normal,sun){
 const a=vertices[0],b=vertices[1],c=vertices[2],e1=b.world.clone().sub(a.world),e2=c.world.clone().sub(a.world),du1=b.u-a.u,dv1=b.v-a.v,du2=c.u-a.u,dv2=c.v-a.v,det=du1*dv2-du2*dv1;
 if(Math.abs(det)<1e-10)return null;
 const tangent=e1.clone().multiplyScalar(dv2).addScaledVector(e2,-dv1).divideScalar(det);tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
 const bitangent=e2.clone().multiplyScalar(du1).addScaledVector(e1,-du2).divideScalar(det);bitangent.addScaledVector(normal,-bitangent.dot(normal)).normalize();
 return[tangent.dot(sun),bitangent.dot(sun),normal.dot(sun)];
}
export function mappedDiffuse(r,g,b,scaleX,scaleY,basis){const x=(r/127.5-1)*scaleX,y=(g/127.5-1)*scaleY,z=b/127.5-1;return Math.max(0,(x*basis[0]+y*basis[1]+z*basis[2])/Math.max(.001,Math.hypot(x,y,z)));}
function hull(points){points.sort((a,b)=>a.x-b.x||a.z-b.z);const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),lo=[],hi=[];for(const p of points){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
export class ShadowGeometryCache{
 constructor(){this.entries=new WeakMap();this.hits=0;this.misses=0;}
 get(mesh,sun,receiverY){
  const elements=mesh.matrixWorld.elements,old=this.entries.get(mesh);if(old&&old.geometry===mesh.geometry&&old.receiverY===receiverY&&old.sun.equals(sun)&&old.matrix.every((v,i)=>v===elements[i])){this.hits++;return old.points;}
  this.misses++;const pos=mesh.geometry.attributes.position,points=[],p=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const height=Math.max(0,p.y-receiverY);points.push({x:p.x-sun.x/sun.y*height,y:receiverY,z:p.z-sun.z/sun.y*height});}
  const result=hull(points);this.entries.set(mesh,{geometry:mesh.geometry,receiverY,sun:sun.clone(),matrix:[...elements],points:result});return result;
 }
}
export function clipShadowToReceiver(points,bounds){
 if(!bounds)return points;let out=points;
 for(const[axis,value,greater]of[['x',bounds.minX,true],['x',bounds.maxX,false],['z',bounds.minZ,true],['z',bounds.maxZ,false]]){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],insideA=greater?a[axis]>=value:a[axis]<=value,insideB=greater?b[axis]>=value:b[axis]<=value;if(insideA)out.push(a);if(insideA!==insideB){const t=(value-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y,z:a.z+(b.z-a.z)*t});}}}
 return out;
}
