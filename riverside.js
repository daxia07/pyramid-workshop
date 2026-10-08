import * as THREE from 'three';
// Reconstructed teaching props; these do not change the delivery simulation.
export function makeDeliveryBoat(){
 const boat=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x88613a,roughness:.83}),edge=new THREE.MeshStandardMaterial({color:0xb28c55,roughness:.78});
 const contact=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x163640,transparent:true,opacity:.22,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.scale.set(.38,.82,1);contact.position.y=-.019;boat.add(contact);
 const outline=[[-.08,-.83],[-.27,-.65],[-.37,-.3],[-.38,.28],[-.27,.66],[-.07,.84],[.07,.84],[.27,.66],[.38,.28],[.37,-.3],[.27,-.65],[.08,-.83]];
 const pos=[],uv=[];const tri=(a,b,c)=>{pos.push(...a,...b,...c);uv.push(a[2],a[1],b[2],b[1],c[2],c[1]);};
 for(let i=0;i<outline.length;i++){const j=(i+1)%outline.length,[x,z]=outline[i],[xx,zz]=outline[j],a=[x*.68,.045,z*.88],b=[xx*.68,.045,zz*.88],c=[x,.26,z],d=[xx,.26,zz];tri(a,c,b);tri(b,c,d);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const hull=new THREE.Mesh(geo,wood);hull.material.side=THREE.DoubleSide;boat.add(hull);
 const rail=new THREE.CatmullRomCurve3(outline.map(([x,z])=>new THREE.Vector3(x,.26,z)),true);boat.add(new THREE.Mesh(new THREE.TubeGeometry(rail,48,.023,5,true),edge));
 for(let i=0;i<5;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.108,.045,1.19-Math.abs(i-2)*.1),new THREE.MeshStandardMaterial({color:new THREE.Color(0xa17c4e).offsetHSL(0,0,(i%2)*.025),roughness:.9}));plank.position.set((i-2)*.116,.105,0);boat.add(plank);}
 for(const z of[-.43,.4]){const seat=new THREE.Mesh(new THREE.BoxGeometry(.6,.055,.13),edge);seat.position.set(0,.21,z);boat.add(seat);}
 const oar=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,1.36,6),wood);shaft.rotation.x=Math.PI/2;oar.add(shaft);const blade=new THREE.Mesh(new THREE.BoxGeometry(.1,.025,.27),edge);blade.position.z=.7;oar.add(blade);oar.rotation.y=.17;oar.position.set(.2,.29,-.02);boat.add(oar);
 boat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return boat;
}
export function addRiverbankDetails(env,shore,pbr){
 // A thin damp bank meets the water. Irregular patches avoid a straight hedge.
 const greens=[0x7b8950,0x8b995a,0x637944,0x9eaa68];
 for(const [ci,z]of[-12.1,-9.7,-6.3,-3.6,1.8,5.2,7.4,11.3].entries()){
  const group=new THREE.Group();group.position.set(shore(z)+.18,0,z);env.add(group);
  for(let k=0;k<13+ci%4;k++){
   const angle=k*2.399+ci*.8,r=.07+((k*7)%9)*.022,height=.24+((k*11+ci*5)%13)*.028,lean=.15+(k%4)*.035;
   const x=Math.cos(angle)*r,zz=Math.sin(angle)*r,p=[],t=[];
   for(let j=0;j<=6;j++){const u=j/6,cx=x+Math.cos(angle)*lean*u*u,cz=zz+Math.sin(angle)*lean*u*u,half=.016*Math.sin(Math.PI*(u*.9+.06));for(const side of[-1,1])p.push(cx+Math.sin(angle)*half*side,height*u,cz-Math.cos(angle)*half*side);if(j<6){const a=j*2;t.push(a,a+1,a+2,a+1,a+3,a+2);}}
   const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute(p,3));leaf.setIndex(t);leaf.computeVertexNormals();group.add(new THREE.Mesh(leaf,new THREE.MeshStandardMaterial({color:greens[(k+ci)%greens.length],side:THREE.DoubleSide,roughness:.85})));
  }
 }
 // A small shore mooring post with loose rope, a teaching reconstruction.
 const z=-1.1,x=shore(z)+.46,wood=new THREE.MeshStandardMaterial({color:0x826441,roughness:.95});const post=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.46,8),wood);post.position.set(x,.21,z);env.add(post);
 const rope=new THREE.CatmullRomCurve3(Array.from({length:41},(_,i)=>{const a=i*.42,r=.045+i*.0016;return new THREE.Vector3(x+.19+Math.cos(a)*r,.01+i*.00025,z+Math.sin(a)*r);}));env.add(new THREE.Mesh(new THREE.TubeGeometry(rope,40,.009,4,false),new THREE.MeshStandardMaterial({color:0xc1a777,roughness:1})));
}
