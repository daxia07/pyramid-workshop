import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SoftwareRenderer} from './software-renderer.js';
import {DECK, CARGO_SPECS, footprint, placementProblem, loadMetrics} from './cargo-packing.js';
import {VOYAGE_MS} from './harbor-game.js';

const CELL=.76, DECK_Y=.61;
const INKS={brick:0x2a7380,edge:0x53849d,corner:0xb46d42,cap:0xc99c35};
export function createHarborWorld(container, getContext, actions) {
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0xd8e6e3);scene.fog=new THREE.Fog(0xd8e6e3,24,66);
  const camera=new THREE.PerspectiveCamera(43,1,.1,110);
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{renderer=new SoftwareRenderer();}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  container.append(renderer.domElement);container.dataset.renderer=renderer instanceof SoftwareRenderer?'textured-software':'webgl-pbr';
  renderer.domElement.setAttribute('aria-label','3D quarry harbor. Select a cargo sled, then tap the deck. Drag empty water to orbit.');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
  controls.minDistance=6;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.46;
  const hemi=new THREE.HemisphereLight(0xd8ecf1,0xd0ab79,1.8);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe5b5,2.8);sun.position.set(-7,14,9);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:40});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun);
  const mats=new Map(),geometries=new Map(),loader=new THREE.TextureLoader();let dirty=true;
  function tex(name,repeat=1,color=true){const t=loader.load(`/textures/${name}.png`,()=>dirty=true);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  const stone=new THREE.MeshStandardMaterial({map:tex('limestone-color'),normalMap:tex('limestone-normal-512',1,false),normalScale:new THREE.Vector2(.3,.3),roughness:.92,color:0xfff3d6});
  const sand=new THREE.MeshStandardMaterial({map:tex('sand-color',6),normalMap:tex('sand-normal-512',5,false),normalScale:new THREE.Vector2(.4,.4),roughness:1,color:0xf3dbac});
  const waterMap=tex('water-color',6),waterNormal=tex('water-normal-512',5,false);
  const waterMat=new THREE.MeshStandardMaterial({color:0x3a9296,map:waterMap,normalMap:waterNormal,normalScale:new THREE.Vector2(.35,.35),metalness:.28,roughness:.22});
  function woodTexture(){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#aa7c4c';x.fillRect(0,0,512,128);for(let i=0;i<120;i++){x.strokeStyle=`rgba(${i%3?'62,34,17':'242,205,145'},${.05+(i%7)*.015})`;x.lineWidth=.6+(i%4)*.4;x.beginPath();for(let a=0;a<=16;a++){const px=a*32,py=(i*17)%128+Math.sin(a*.8+i)*2.2;a?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  const woodMap=woodTexture(),wood=new THREE.MeshStandardMaterial({map:woodMap,color:0xd1ae7d,roughness:.8}),darkWood=new THREE.MeshStandardMaterial({map:woodMap,color:0x7e5738,roughness:.9});
  function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.78}));return mats.get(color);}
  function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,typeof mat==='number'?material(mat):mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,x,y,z,w,h,d,mat=wood,r=.025){const k=[w,h,d,r].join(',');if(!geometries.has(k))geometries.set(k,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.2,h*.2,d*.2)));return mesh(parent,geometries.get(k),mat,x,y,z);}
  function pole(parent,a,b,r,mat=darkWood){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),m=mesh(parent,new THREE.CylinderGeometry(r,r*.95,aa.distanceTo(bb),9),mat);m.position.copy(aa).add(bb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bb.sub(aa).normalize());return m;}
  function rope(parent,points,r=.017,mat=0xc6a879){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,5,false),mat);}
  function label(parent,text,x,y,z,w=1,color='#294e51',bg='#f4e5c4'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(9,9,494,110);ctx.font='bold 44px Georgia';const fontSize=Math.min(44,44*472/ctx.measureText(text).width);ctx.font=`bold ${fontSize}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,68);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=mesh(parent,new THREE.PlaneGeometry(w,w/4),new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,roughness:1}),x,y,z);m.castShadow=false;return m;}
  // A continuous river, terraced quarry face, and a small, detailed working quay.
  const water=mesh(scene,new THREE.PlaneGeometry(130,130,1,1),waterMat,0,-.13,0);water.rotation.x=-Math.PI/2;water.userData.water=true;
  const bank=box(scene,-13,-.4,-2,20,.9,60,sand,.4);bank.userData.ground=true;
  for(let tier=0;tier<4;tier++){for(let j=0;j<7-tier;j++){const rock=box(scene,-6-j*1.8-tier*.3,.15+tier*.92,-9-tier*1.2,2.1,1.1,2.3,stone,.15);rock.rotation.y=Math.sin(j*3+tier)*.04;}}
  for(let j=0;j<12;j++){const r=mesh(scene,new THREE.DodecahedronGeometry(.13+(j%3)*.055),stone,-4.4-(j%4)*.32,.03,-5.5+Math.floor(j/4)*.36);r.scale.set(1.2,.6,.9);r.rotation.y=j*.61;}
  const dock=new THREE.Group();scene.add(dock);
  for(let i=0;i<26;i++)box(dock,-4.7,.23,-3.6+i*.25,4.5,.17,.236,wood,.025);
  for(const x of[-6.5,-3])for(const z of[-3.4,2.4]){pole(dock,[x,-.7,z],[x,.73,z],.12);box(dock,x,.82,z,.32,.1,.3,darkWood);for(let j=0;j<4;j++){const t=mesh(dock,new THREE.TorusGeometry(.14,.025,5,16),0xbba477,x,.62+j*.04,z);t.rotation.x=Math.PI/2;}}
  for(const z of[-3,0,2])box(dock,-4.7,.08,z,4.8,.19,.18,darkWood);
  // Shade awning, stock racks, tools, amphorae and a surveyor's worktable.
  for(const x of[-7,-4.2])for(const z of[-3.5,-1.4])pole(scene,[x,.1,z],[x,3.1,z],.055);
  const awningGeo=new THREE.PlaneGeometry(3.1,2.4,12,8);const ap=awningGeo.attributes.position;
  for(let i=0;i<ap.count;i++){const x=ap.getX(i),yy=ap.getY(i);ap.setZ(i,.17*Math.cos(x*2)-.08*Math.sin(yy*2));}awningGeo.computeVertexNormals();
  const awning=mesh(scene,awningGeo,new THREE.MeshStandardMaterial({color:0xece0c4,side:THREE.DoubleSide,roughness:1}),-5.6,3.03,-2.5);awning.rotation.x=-Math.PI/2;awning.rotation.z=.04;
  for(let i=0;i<5;i++){const stripe=box(scene,-6.82+i*.61,3.08,-2.5,.1,.016,2.3,0x567978,.006);stripe.rotation.z=.04;}
  label(scene,'THE QUARRY',-5.55,2.54,-1.27,1.65);
  for(let i=0;i<7;i++)box(scene,-6.7+(i%3)*.58,.45+Math.floor(i/3)*.32,-3.13,.53,.29,.52,stone,.04);
  for(let i=0;i<3;i++){const g=new THREE.LatheGeometry([new THREE.Vector2(.11,0),new THREE.Vector2(.23,.1),new THREE.Vector2(.26,.35),new THREE.Vector2(.15,.52),new THREE.Vector2(.12,.65),new THREE.Vector2(.15,.67)],16);mesh(scene,g,0xba7852,-6.4+i*.46,.32,1.88);}
  for(let j=0;j<4;j++) {const coil=mesh(scene,new THREE.TorusGeometry(.22-j*.043,.018,6,32),0xcbb07b,-3.1,.34,1.92);coil.rotation.x=Math.PI/2;}
  pole(scene,[-6.5,.4,.8],[-5.75,1.45,.8],.033);box(scene,-5.75,1.5,.8,.35,.13,.13,0x86745b);
  const table=new THREE.Group();table.position.set(-4.8,.33,.75);scene.add(table);
  for(const x of[-.92,.92])for(const z of[-.68,.68])box(table,x,.39,z,.12,.78,.12,darkWood);
  box(table,0,.82,0,2.3,.15,1.8,wood,.045);
  const planSheet=box(table,0,.905,0,1.95,.014,1.48,0xe9d8b4,.02);
  const reference=new THREE.Group();reference.position.set(0,.93,0);table.add(reference);
  const referenceLabel=label(table,'THE ARCHITECT’S MODEL',0,.67,.915,1.85);
  // Palms and sedges soften the quarry edge without covering the puzzle.
  function palm(x,z,h){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);rope(g,[[0,0,0],[.05,h*.5,0],[.25,h,0]],.085,0x907b54);for(let j=0;j<11;j++){const a=j*Math.PI*2/11;const points=[[.25,h,0],[.25+Math.cos(a)*.65,h+.18,Math.sin(a)*.65],[.25+Math.cos(a)*1.4,h-.6,Math.sin(a)*1.4]];rope(g,points,.022,0x647b4c);for(let k=1;k<9;k++){const t=k/9,r=t*1.3,yy=h+Math.sin(t*Math.PI)*.23-.65*t*t;const leaf=mesh(g,new THREE.ConeGeometry(.1,.65*(1-t*.55),3),0x6e8956,.25+Math.cos(a)*r,yy,Math.sin(a)*r);leaf.rotation.set(Math.cos(a)*1.05,a,Math.sin(a)*1.05);}}}
  palm(-7.8,4.7,3.9);palm(-9,-6,4.8);palm(-7.6,7,3.3);
  for(let j=0;j<25;j++){const x=-3.23-(j%3)*.11,z=4.3+Math.floor(j/3)*.26;pole(scene,[x,-.04,z],[x+.1,.45+(j%5)*.11,z+.08],.011,0x758768);}
  for(const [x,z,r,h]of[[7,-24,3.6,4.4],[12,-28,3.2,4],[1,-29,2.3,2.9]]){const g=new THREE.ConeGeometry(r,h,4);g.rotateY(Math.PI/4);mesh(scene,g,0xd0c2a0,x,h/2-.1,z);}
  const farQuay=box(scene,7,-.08,-20,10,.2,4,sand,.2);label(scene,'GIZA',7,1.12,-18,2.1);
  for(const x of[4,10])pole(scene,[x,0,-18],[x,1.9,-18],.08);
  // Curved, planked hull. The usable grid is a small patch of the physical deck.
  const boat=new THREE.Group();scene.add(boat);
  const sections=[[-2.9,.13],[-2.58,1.18],[-2.02,1.99],[-1.25,2.13],[0,2.15],[1.25,2.13],[2.02,1.99],[2.58,1.18],[2.9,.13]];
  const pos=[],uv=[];function tri(a,b,c){pos.push(...a,...b,...c);for(const p of[a,b,c])uv.push(p[2]*.4,p[1]*2);}
  for(let i=0;i<sections.length-1;i++)for(const side of[-1,1]){const[z,w]=sections[i],[zz,ww]=sections[i+1];const a=[side*w,.57,z],b=[side*ww,.57,zz],c=[side*ww*.65,-.24,zz*.87],d=[side*w*.65,-.24,z*.87];tri(a,b,d);tri(b,c,d);}
  const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hullGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));hullGeo.computeVertexNormals();const hullMat=darkWood.clone();hullMat.side=THREE.DoubleSide;mesh(boat,hullGeo,hullMat);
  function widthAt(z){for(let i=0;i<sections.length-1;i++){const[a,w]=sections[i],[b,v]=sections[i+1];if(z>=a&&z<=b)return THREE.MathUtils.lerp(w,v,(z-a)/(b-a));}return .1;}
  for(let z=-2.72;z<=2.72;z+=.16){const width=widthAt(z)*2-.12;box(boat,0,.52,z,width,.15,.149,wood,.018);}
  for(const side of[-1,1]){rope(boat,sections.map(([z,w])=>[side*w,.68,z]),.065,wood);rope(boat,sections.map(([z,w])=>[side*w*.9,.26,z*.97]),.023,0xc2a76d);for(const z of[-2,-1.3,0,1.3,2]){pole(boat,[side*widthAt(z),.15,z],[side*widthAt(z),.69,z],.028,0x715033);}}
  for(const z of[-2.6,2.6]){box(boat,0,.65,z,1.9,.12,.22,darkWood);pole(boat,[0,.5,z],[0,1.04,z*1.05],.065);}
  // The mast occupies two central cells; rigging stays above the picking plane.
  box(boat,0,.64,0,.54,.12,1.38,darkWood,.05);pole(boat,[0,.68,0],[0,3.1,0],.062);
  pole(boat,[-1.48,2.8,0],[1.48,2.8,0],.038);
  const furled=mesh(boat,new THREE.CylinderGeometry(.09,.1,2.7,12),0xe9dbc0,0,2.76,.035);furled.rotation.z=Math.PI/2;
  for(const x of[-.9,0,.9])rope(boat,[[x,2.8,-.07],[x,2.64,.04],[x,2.8,.13]],.018,0x896647);
  rope(boat,[[0,3.06,0],[.05,1.6,-1.15],[0,.78,-2.55]],.012);rope(boat,[[0,3.06,0],[.04,1.6,1.23],[0,.8,2.6]],.012);
  const pennantGeo=new THREE.BufferGeometry();pennantGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.8,-.08,0,0,-.3,0],3));pennantGeo.computeVertexNormals();const pennant=mesh(boat,pennantGeo,new THREE.MeshStandardMaterial({color:0x3d777e,side:THREE.DoubleSide}),0,3.13,0);
  pole(boat,[1.7,.68,2],[3,.02,3.6],.033,wood);box(boat,2.85,.1,3.41,.22,.05,.65,wood).rotation.y=-.55;
  const deckCells=new THREE.Group(),cargoGroup=new THREE.Group(),ghost=new THREE.Group();boat.add(deckCells,cargoGroup,ghost);
  const cellMat=new THREE.MeshBasicMaterial({color:0xf3dfac,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide});
  const blockedMat=new THREE.MeshBasicMaterial({color:0xb97148,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});
  for(let row=0;row<DECK.rows;row++)for(let column=0;column<DECK.columns;column++){
    const blocked=DECK.blocked.some(([c,r])=>c===column&&r===row);
    const m=mesh(deckCells,new THREE.PlaneGeometry(CELL-.04,CELL-.04),blocked?blockedMat:cellMat,(column-2)*CELL,DECK_Y,(row-1.5)*CELL);m.rotation.x=-Math.PI/2;m.userData.deck={column,row};m.castShadow=false;
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(CELL-.035,CELL-.035)),new THREE.LineBasicMaterial({color:0xefdaad,transparent:true,opacity:.4}));outline.rotation.x=-Math.PI/2;outline.position.copy(m.position);outline.position.y+=.005;deckCells.add(outline);
  }
  for(let c=0;c<5;c++){const tag=label(boat,String.fromCharCode(65+c),(c-2)*CELL,DECK_Y+.012,1.83,.3);tag.rotation.x=-Math.PI/2;}
  for(let r=0;r<4;r++){const tag=label(boat,String(r+1),-2,DECK_Y+.012,(r-1.5)*CELL,.24);tag.rotation.x=-Math.PI/2;}
  label(boat,'NILE • 01',0,.19,2.63,1.1,'#f1d9a7','#456e70');
  const wake=new THREE.Group();scene.add(wake);for(let i=0;i<6;i++){const line=mesh(wake,new THREE.TorusGeometry(.4+i*.2,.018,4,40,Math.PI),new THREE.MeshBasicMaterial({color:0xc6e8de,transparent:true,opacity:.23}),0,-.105,i*.32);line.rotation.x=-Math.PI/2;line.scale.set(1,.6,1);}
  // Pallets are polyomino sleds: their full transport footprint is visible.
  function slabGeometry(cells,height){const occupied=new Set(cells.map(([c,r])=>`${c},${r}`)),edges=[];
    for(const[c,r]of cells){if(!occupied.has(`${c},${r-1}`))edges.push([[c,r],[c+1,r]]);if(!occupied.has(`${c+1},${r}`))edges.push([[c+1,r],[c+1,r+1]]);if(!occupied.has(`${c},${r+1}`))edges.push([[c+1,r+1],[c,r+1]]);if(!occupied.has(`${c-1},${r}`))edges.push([[c,r+1],[c,r]]);}
    const path=[edges.shift()];while(edges.length){const end=path.at(-1)[1],i=edges.findIndex(e=>e[0][0]===end[0]&&e[0][1]===end[1]);if(i<0)break;path.push(edges.splice(i,1)[0]);}
    const sh=new THREE.Shape();path.forEach((e,i)=>{const[x,z]=e[0];i?sh.lineTo(x*CELL,-z*CELL):sh.moveTo(x*CELL,-z*CELL);});sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:height,bevelEnabled:true,bevelSize:.026,bevelThickness:.02,bevelSegments:2,steps:1});g.rotateX(-Math.PI/2);return g;
  }
  function cargoMesh(item,preview=false,valid=true){const cells=footprint(item.type,item.rotation||0),g=new THREE.Group();const w=Math.max(...cells.map(c=>c[0]))+1,d=Math.max(...cells.map(c=>c[1]))+1;
    if(preview){for(const[c,r]of cells){const m=box(g,(c+.5)*CELL,.04,(r+.5)*CELL,CELL-.05,.08,CELL-.05,new THREE.MeshBasicMaterial({color:valid?0x77d6b4:0xe99470,transparent:true,opacity:.58,depthWrite:false}),.018);m.castShadow=false;}return g;}
    mesh(g,slabGeometry(cells,.1),darkWood,0,.015,0);
    for(const[c,r]of cells){box(g,(c+.5)*CELL,.13,(r+.5)*CELL,CELL-.07,.12,CELL-.08,wood,.02);const marking=box(g,(c+.5)*CELL,.198,(r+.5)*CELL,.08,.014,CELL-.11,INKS[item.type],.005);}
    if(item.type==='cap'){const capGeo=new THREE.ConeGeometry(.79,.97,4,1);capGeo.rotateY(Math.PI/4);mesh(g,capGeo,stone,w*CELL/2,.69,d*CELL/2);const top=mesh(g,new THREE.ConeGeometry(.14,.17,4),0xc7a258,w*CELL/2,1.1,d*CELL/2);top.rotation.y=Math.PI/4;}
    else {const sg=slabGeometry(cells,item.type==='brick'?.39:.48);const m=mesh(g,sg,stone,.025,.22,.025);m.scale.set(.93,1,.93);
      if(item.type==='edge'){const a=sg.attributes.position;const normalAxis=w>d?'z':'x';for(let i=0;i<a.count;i++)if(a.getY(i)>.2){if(normalAxis==='z')a.setZ(i,a.getZ(i)*.66+.18);else a.setX(i,a.getX(i)*.66+.18);}sg.computeVertexNormals();}
    }
    // Broad rope straps, a colored seal, and weight labels remain legible close up.
    const cc=cells[0];const xx=(cc[0]+.5)*CELL,zz=(cc[1]+.5)*CELL;
    const ropeHeight=item.type==='cap'?.6:.73;
    rope(g,[[xx-.28,.18,zz],[xx-.28,ropeHeight,zz],[xx+.28,ropeHeight,zz],[xx+.28,.18,zz]],.016,0xaf9564);
    const tag=label(g,`${item.type==='brick'?'B':item.type==='edge'?'E':item.type==='corner'?'C':'▲'} · ${CARGO_SPECS[item.type].weight}`,xx,.24,(cc[1]+1)*CELL+.021,.5,'#f9e8c5','#'+INKS[item.type].toString(16));
    const topTag=label(g,`${CARGO_SPECS[item.type].weight}`,xx,ropeHeight+.025,zz,.3,'#294e51','#edd6a4');topTag.rotation.x=-Math.PI/2;
    g.traverse(o=>{if(o.isMesh)o.userData.cargoId=item.id;});return g;
  }
  // Large catalogue examples sit at the quay, not abstract colored dots.
  ['brick','edge','corner','cap'].forEach((type,i)=>{const g=cargoMesh({type,id:`stock-${type}`,rotation:0});g.scale.setScalar(.46);g.position.set(-6.6+(i%2)*1.7,.34,-.9+Math.floor(i/2)*1.15);g.traverse(o=>delete o.userData.cargoId);scene.add(g);});
  function disposeGroup(g){for(const child of [...g.children]){g.remove(child);child.traverse(o=>{if(o.geometry&&!Array.from(geometries.values()).includes(o.geometry))o.geometry.dispose();if(o.material?.map?.isCanvasTexture){o.material.map.dispose();o.material.dispose();}if(o.material?.isMeshBasicMaterial&&o.material.transparent)o.material.dispose();});}}
  function referenceGeometry(b){const h=.25,a=.175;let x0=-a,x1=a,z0=-a,z1=a;if(['edge','corner'].includes(b.type)){if(b.type==='corner'||Math.abs(b.x)>=Math.abs(b.z)){if(b.x<0)x0=0;else x1=0;}if(b.type==='corner'||Math.abs(b.z)>Math.abs(b.x)){if(b.z<0)z0=0;else z1=0;}}const v=[[-a,0,-a],[a,0,-a],[a,0,a],[-a,0,a],[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]],indices=[0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,3,7,0,0,7,4,4,7,5,5,7,6,0,1,3,1,2,3],g=new THREE.BufferGeometry(),pts=indices.flatMap(i=>v[i]);g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(indices.flatMap(i=>[v[i][0]*3,v[i][2]*3+v[i][1]]),2));return g;}
  let signature='',referenceSignature='',mode='',view='orbit',hoverSignature='',frame=0,lastFrame=0;
  function sync(){const {state,level}=getContext();const nextMode=state.stage==='order'||level.journeyRole==='order'?'order':'cargo';
    if(nextMode!==mode){mode=nextMode;home();signature='';}
    const refKey=level.dims.join('-');if(refKey!==referenceSignature){disposeGroup(reference);referenceSignature=refKey;
      level.dims.forEach((n,y)=>{for(let r=0;r<n;r++)for(let c=0;c<n;c++){const x=(c-(n-1)/2)*.36,z=(r-(n-1)/2)*.36;
        if(n===1){const geo=new THREE.ConeGeometry(.36/Math.sqrt(2),.27,4);geo.rotateY(Math.PI/4);mesh(reference,geo,0xd2ad60,x,y*.25+.135,z);}
        else {const block=level.blueprint.find(b=>b.y===y&&Math.abs(b.x-(c-(n-1)/2))<.01&&Math.abs(b.z-(r-(n-1)/2))<.01);mesh(reference,referenceGeometry(block),y===0&&level.journeyRole==='expand'?0xcba36b:stone,x,y*.25,z);}
      }});reference.scale.setScalar(level.dims[0]===4?.96:1.15);
    }
    const h=state.harbor;const sig=JSON.stringify([h?.cargo,h?.selected]);if(sig!==signature){signature=sig;disposeGroup(cargoGroup);if(h)for(const item of h.cargo.filter(c=>['boat','transit'].includes(c.status))){const g=cargoMesh(item);g.position.set((item.column-2.5)*CELL,DECK_Y+.02,(item.row-2)*CELL);cargoGroup.add(g);if(h.selected===item.id){const edges=cargoMesh(item,true,true);edges.position.copy(g.position);edges.position.y=DECK_Y+.04;cargoGroup.add(edges);}}}
    deckCells.visible=mode==='cargo';ghost.visible=mode==='cargo'&&!!h?.selected&&!h.inTransit;controls.enabled=!h?.selected||mode==='order'||!!h?.inTransit;
    renderer.domElement.style.cursor=h?.selected?'crosshair':'grab';hoverSignature='';dirty=true;resize();
  }
  function home(){view='orbit';if(mode==='order'){controls.target.set(-4.8,1.22,.7);camera.position.set(.2,5.8,8.2);}else{controls.target.set(0,.5,0);camera.position.set(7.3,9.5,10.6);}camera.zoom=1;controls.update();resize();dirty=true;}
  function topView(){view='deck';controls.target.set(0,.4,0);camera.position.set(0,12.4,2.9);controls.update();resize();dirty=true;}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;
    const mobile=w<=800&&h>500;
    // Keep the physical puzzle clear of the side order and lower cargo tray.
    camera.clearViewOffset();camera.zoom=mobile?(mode==='order'?.67:.71):(mode==='cargo'?1.12:1);
    camera.setViewOffset(w,h,mobile?0:(Math.min(355,w*.3)-(mode==='cargo'?(w>1100?180:60):0))/2,mobile?(mode==='order'?h*.13:view==='deck'?10:h*.055):(mode==='cargo'?105:35),w,h);
    camera.updateProjectionMatrix();renderer.setSize(w,h);dirty=true;
  }
  new ResizeObserver(resize).observe(container);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const cargoHit=ray.intersectObjects(cargoGroup.children,true).find(x=>x.object.userData.cargoId);const deckHit=ray.intersectObjects(deckCells.children,true).find(x=>x.object.userData.deck);return{cargoId:cargoHit?.object.userData.cargoId,cell:deckHit?.object.userData.deck};}
  function preview(column,row){const{state}=getContext(),h=state.harbor,item=h?.cargo.find(c=>c.id===h.selected);if(!item||h.inTransit){ghost.visible=false;return;}
    const problem=placementProblem(h.cargo,item,column,row,h.rotation),sig=[item.id,column,row,h.rotation,problem].join(':');
    if(sig!==hoverSignature){hoverSignature=sig;disposeGroup(ghost);const g=cargoMesh({...item,rotation:h.rotation},true,!problem);g.position.set((column-2.5)*CELL,DECK_Y+.04,(row-2)*CELL);ghost.add(g);ghost.visible=true;actions.onHover?.(problem||`Place at ${String.fromCharCode(65+column)}${row+1} · ${h.rotation}°`);dirty=true;}
  }
  let down=null,pointers=new Set();
  renderer.domElement.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1){down=null;controls.enabled=true;return;}const{state}=getContext();if(mode!=='cargo'||state.harbor?.inTransit)return;const hitInfo=hit(e);down={x:e.clientX,y:e.clientY,selected:state.harbor?.selected,cargoId:hitInfo.cargoId};if(!down.selected&&hitInfo.cargoId){actions.onSelect(hitInfo.cargoId);controls.enabled=false;}if(down.selected||hitInfo.cargoId)renderer.domElement.setPointerCapture(e.pointerId);});
  renderer.domElement.addEventListener('pointermove',e=>{if(pointers.size>1)return;const{state}=getContext();if(mode!=='cargo'||!state.harbor?.selected)return;const info=hit(e);if(info.cell)preview(info.cell.column,info.cell.row);else ghost.visible=false;});
  renderer.domElement.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y)>7,shouldPlace=down.selected||down.cargoId&&moved;down=null;if(shouldPlace){const info=hit(e);if(info.cell)actions.onPlace(info.cell.column,info.cell.row);}});
  renderer.domElement.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;});
  renderer.domElement.addEventListener('pointerleave',()=>{if(!down)ghost.visible=false;});
  controls.addEventListener('change',()=>dirty=true);
  controls.addEventListener('start',()=>renderer.setInteractive?.(true));controls.addEventListener('end',()=>renderer.setInteractive?.(false));
  function animate(t){requestAnimationFrame(animate);if(container.closest('[hidden]')||document.hidden)return;const software=renderer instanceof SoftwareRenderer;if(t-lastFrame<(software?110:25))return;lastFrame=t;
    const{state}=getContext(),h=state.harbor,trip=h?.inTransit;const m=h?loadMetrics(h.cargo):{offsetX:0,offsetZ:0};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dx=0,dz=0,turn=0;
    if(trip){const p=Math.min(1,Math.max(0,(Date.now()-trip.startedAt)/VOYAGE_MS));const ease=x=>x*x*(3-2*x);if(p<.48){const a=ease(p/.48);dx=a*7;dz=-a*17;turn=-.38*a;}else if(p<.63){dx=7;dz=-17;turn=-.38;}else{const a=ease((p-.63)/.37);dx=7*(1-a);dz=-17*(1-a);turn=-.38*(1-a);}cargoGroup.visible=p<.57;wake.visible=p<.48||p>.63;
    }else{cargoGroup.visible=true;wake.visible=false;}
    boat.position.set(dx,reduced?0:Math.sin(t*.0013)*.025,dz);boat.rotation.set((trip?.offsetZ??m.offsetZ)*.12,turn,-(trip?.offsetX??m.offsetX)*.16+(reduced?0:Math.sin(t*.0009)*.007));wake.position.set(dx,-.01,dz+2.5);
    if(!reduced){waterNormal.offset.set(t*.000009,t*.000003);waterMap.offset.x=t*.000001;pennant.rotation.y=Math.sin(t*.002)*.12;}
    controls.update();renderer.render(scene,camera);container.dataset.ready='ready';container.dataset.frame=String(++frame);dirty=false;
  }
  sync();requestAnimationFrame(animate);
  return{sync,home,topView,preview,zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();dirty=true;},orbit(){if(getContext().state.harbor)getContext().state.harbor.selected=null;actions.onDeselect?.();},get view(){return view;}};
}
