import * as THREE from 'three';
import {gardenPosition} from './studio-game.js';

export function addStudioDecorations(parent, studio) {
  const mesh=(group,geometry,color,x,y,z)=>{
    const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.78}));
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.temporaryMaterial=true;group.add(m);return m;
  };
  const box=(g,x,y,z,w,h,d,c)=>mesh(g,new THREE.BoxGeometry(w,h,d),c,x,y,z);
  for(const [slot,type]of Object.entries(studio.decorations)){
    const p=gardenPosition(+slot,studio.size),g=new THREE.Group();g.position.set(p.x,0,p.z);parent.add(g);
    if(type==='path'){
      for(let i=0;i<4;i++)box(g,0,.035,(i-1.5)*.29,.72,.07,.24,0xc8b991);
    }else if(type==='obelisk'){
      box(g,0,.1,0,.65,.2,.65,0xc5b28a);box(g,0,.88,0,.28,1.36,.28,0xe5cd97);
      mesh(g,new THREE.ConeGeometry(.2,.25,4),0xe8c574,0,1.68,0).rotation.y=Math.PI/4;
      for(let i=0;i<5;i++)box(g,0,.4+i*.22,.143,.065,.06,.01,0x9c7f4e);
    }else if(type==='palms'){
      for(const [x,z,h]of [[-.24,-.15,1.5],[.24,.15,1.9]]){
        mesh(g,new THREE.CylinderGeometry(.055,.085,h,7),0x8a6741,x,h/2,z);
        for(let i=0;i<7;i++){
          const a=i*Math.PI*2/7,leaf=mesh(g,new THREE.SphereGeometry(.48,7,4),i%2?0x6f8b4c:0x547a44,x+Math.cos(a)*.25,h,z+Math.sin(a)*.25);
          leaf.scale.set(1,.1,.3);leaf.rotation.y=-a;leaf.rotation.z=Math.cos(a)*.22;
        }
      }
    }else if(type==='banners'){
      for(const x of[-.27,.27]){
        mesh(g,new THREE.CylinderGeometry(.025,.04,1.55,6),0x886440,x,.78,0);
        const flag=mesh(g,new THREE.PlaneGeometry(.34,.58),x<0?0xb46c49:0x526d6b,x+.17,1.2,0);flag.material.side=THREE.DoubleSide;
        mesh(g,new THREE.SphereGeometry(.055,8,5),0xe8c878,x,1.58,0);
      }
    }else if(type==='pool'){
      mesh(g,new THREE.CylinderGeometry(.63,.67,.11,32),0xc6b88f,0,.055,0);
      const water=mesh(g,new THREE.CircleGeometry(.53,32),0x458d99,0,.115,0);water.rotation.x=-Math.PI/2;water.material.roughness=.15;
      for(let i=0;i<3;i++){const lily=mesh(g,new THREE.CircleGeometry(.1,8),0x6a8e58,.25*Math.cos(i*2.1),.12,.25*Math.sin(i*2.1));lily.rotation.x=-Math.PI/2;}
    }
  }
}
