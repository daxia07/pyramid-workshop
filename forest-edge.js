import * as THREE from 'three';
// Irregular broadleaf understory patches outside the cleared Maya work area.
export function addForestEdge(parent,texture){
 const leafMap=texture('maya-broadleaf-cluster');leafMap.wrapS=leafMap.wrapT=THREE.ClampToEdgeWrapping;
 const leafMaterial=new THREE.MeshBasicMaterial({map:leafMap,color:0xa9bd87,alphaTest:.45,side:THREE.DoubleSide});
 const wood=new THREE.MeshStandardMaterial({color:0x71674c,roughness:.95}),moving=[];
 const mask=document.createElement('canvas');mask.width=mask.height=128;const ctx=mask.getContext('2d'),grad=ctx.createRadialGradient(64,64,12,64,64,63);grad.addColorStop(0,'white');grad.addColorStop(.6,'#bbbbbb');grad.addColorStop(1,'black');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const alpha=new THREE.CanvasTexture(mask);
 const soil=new THREE.MeshStandardMaterial({map:texture('earth-color',2),color:0xd2c9a6,alphaMap:alpha,transparent:true,depthWrite:false,roughness:1});
 const positions=[[-9,-9.4,1.5],[-6.5,-9.8,1.65],[-3.8,-10.1,1.4],[-1.2,-10.5,1.75],[1.8,-10.3,1.5],[4.7,-9.6,1.65],[7.6,-9.8,1.35],[9.2,-7,1.2],[-8,-5,1.05],[8.3,-2,.95],[-8.4,1,.8]];
 for(const[i,[x,z,scale]]of positions.entries()){
  const patch=new THREE.Mesh(new THREE.PlaneGeometry(3.2*scale,2.6*scale),soil);patch.rotation.x=-Math.PI/2;patch.position.set(x,-.012,z);parent.add(patch);
  for(const [bi,dx,dz,bs]of[[0,0,0,1],[1,-.62,.38,.65]]){
   const group=new THREE.Group();group.position.set(x+dx*scale,0,z+dz*scale);group.scale.setScalar(scale*bs);parent.add(group);
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.015,.045,.5,7),wood);stem.position.y=.25;group.add(stem);
   for(let k=0;k<26;k++){
    const geometry=new THREE.PlaneGeometry(.56,.64,2,2),p=geometry.attributes.position;
    for(let j=0;j<p.count;j++)p.setZ(j,.045*Math.sin((p.getY(j)+.32)/.64*Math.PI));geometry.computeVertexNormals();
    const card=new THREE.Mesh(geometry,leafMaterial),angle=k*2.399+i*.37+bi;
    const radius=.14+((k*7)%13)/13*.42;card.position.set(Math.cos(angle)*radius,.65+Math.sin(k*1.7)*.38,Math.sin(angle)*radius);card.rotation.set(-.15+(k%2)*.32,angle,0);group.add(card);moving.push({mesh:card,phase:i*.9+k*.5});
   }
  }
 }
 return moving;
}
