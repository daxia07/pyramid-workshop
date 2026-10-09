import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const COLORS={brick:0x638889,edge:0x8195a0,corner:0xc39169,cap:0xc9a353};
function stoneGeometry(block){
  if(block.type==='cap'){const g=new THREE.ConeGeometry(.49/Math.sqrt(2),.38,4);g.rotateY(Math.PI/4);g.translate(0,.19,0);return g;}
  const a=.242,h=.35;let x0=-a,x1=a,z0=-a,z1=a;
  if(['edge','corner'].includes(block.type)){
    if(block.type==='corner'||Math.abs(block.x)>=Math.abs(block.z)){if(block.x<0)x0=0;else x1=0;}
    if(block.type==='corner'||Math.abs(block.z)>Math.abs(block.x)){if(block.z<0)z0=0;else z1=0;}
  }
  const v=[[-a,0,-a],[a,0,-a],[a,0,a],[-a,0,a],[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],indices=[0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,3,7,0,0,7,4,4,7,5,5,7,6,0,1,3,1,2,3];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>v[i]),3));g.computeVertexNormals();return g;
}

/** A persistent, separately lit study model inside the shopping-list overlay. */
export function createOrderReference(){
  const element=document.createElement('div');element.className='order-model';
  element.innerHTML='<div class="order-model-canvas"></div><div class="model-tools"><span>3D study · drag to turn</span><button type="button" aria-pressed="false">Separate layers</button></div>';
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{element.innerHTML='<p class="fineprint">Count the colored layers in the plan below.</p>';return{element,sync(){},highlight(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor(0,0);
  renderer.domElement.setAttribute('aria-label','Reference pyramid. Drag to rotate; separate layers to count stones.');element.firstElementChild.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30),model=new THREE.Group();scene.add(model,new THREE.HemisphereLight(0xf5f4e7,0x7b6952,2.3));
  const sun=new THREE.DirectionalLight(0xffeccb,3);sun.position.set(-3,7,5);scene.add(sun);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;
  let signature='',exploded=false,dirty=true,last=0;
  const button=element.querySelector('button');button.onclick=()=>{exploded=!exploded;button.setAttribute('aria-pressed',String(exploded));button.textContent=exploded?'Bring layers together':'Separate layers';arrange();};
  const arrange=()=>{model.children.forEach(m=>m.position.y=m.userData.layer*(exploded?.61:.355));controls.target.set(0,exploded?.75:.45,0);controls.update();dirty=true;};
  controls.addEventListener('change',()=>dirty=true);
  const resize=()=>{const w=element.clientWidth,h=element.firstElementChild.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;};new ResizeObserver(resize).observe(element);
  function animate(t){requestAnimationFrame(animate);if(!element.isConnected||element.closest('[hidden]')||document.hidden||t-last<40)return;last=t;controls.update();if(dirty){renderer.render(scene,camera);dirty=false;element.dataset.ready='ready';}}requestAnimationFrame(animate);
  return {element,sync(level){const key=level.dims.join('-');if(key!==signature){signature=key;for(const m of[...model.children]){m.geometry.dispose();m.material.dispose();model.remove(m);}for(const b of level.blueprint){const material=new THREE.MeshStandardMaterial({color:COLORS[b.type],roughness:.84}),m=new THREE.Mesh(stoneGeometry(b),material);m.position.set(b.x*.5,b.y*.355,b.z*.5);m.userData={layer:b.y,type:b.type};model.add(m);}camera.position.set(2.8,2.4,3.5);exploded=false;button.textContent='Separate layers';button.setAttribute('aria-pressed','false');arrange();}resize();},highlight(type){for(const m of model.children){m.material.color.set(COLORS[m.userData.type]);m.material.emissive.set(m.userData.type===type?0x574323:0);m.material.emissiveIntensity=.16;}dirty=true;}};
}
