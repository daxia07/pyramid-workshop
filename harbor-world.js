import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {SoftwareRenderer} from './software-renderer.js';
import {DECK, CARGO_SPECS, footprint, placementProblem, loadMetrics} from './cargo-packing.js';
import {VOYAGE_MS} from './harbor-game.js';
import {createHarborEnvironment,MARKET_BAYS} from './harbor-environment.js';
import {terrainHeight,voyagePose,voyageRigPose} from './harbor-terrain.js';

const CELL=.76, DECK_Y=.61;
const INKS={brick:0x2a7380,edge:0x53849d,corner:0xb46d42,cap:0xc99c35};
export function createHarborWorld(container, getContext, actions) {
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0xd8e6e3);
  const camera=new THREE.PerspectiveCamera(43,1,.1,700);
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{renderer=new SoftwareRenderer();}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  container.append(renderer.domElement);container.dataset.renderer=renderer instanceof SoftwareRenderer?'textured-software':'webgl-pbr';
  renderer.domElement.setAttribute('aria-label','3D quarry harbor. Tap a packed stone at the market, then tap the deck to load it. Drag empty water to orbit.');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
  controls.minDistance=6;controls.maxDistance=42;controls.maxPolarAngle=Math.PI*.46;
  const mats=new Map(),geometries=new Map(),loader=new THREE.TextureLoader();let dirty=true;
  function tex(name,repeat=1,color=true){const t=loader.load(`/textures/${name.includes('.')?name:name+'.png'}`,()=>dirty=true);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  const stone=new THREE.MeshStandardMaterial({map:tex('quarry-limestone-v2.jpg'),normalMap:tex('limestone-normal-512',1,false),normalScale:new THREE.Vector2(.3,.3),roughness:.92,color:0xf4eddc});
  const sand=new THREE.MeshStandardMaterial({map:tex('sand-color',6),normalMap:tex('sand-normal-512',5,false),normalScale:new THREE.Vector2(.4,.4),roughness:1,color:0xf3dbac});
  function woodTexture(){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#948573';x.fillRect(0,0,512,128);for(let i=0;i<45;i++){x.strokeStyle=`rgba(${i%3?'62,34,17':'242,205,145'},${.035+(i%7)*.009})`;x.lineWidth=.35+(i%4)*.2;x.beginPath();for(let a=0;a<=16;a++){const px=a*32,py=(i*17)%128+Math.sin(a*.8+i)*2.2;a?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  const woodMap=woodTexture(),wood=new THREE.MeshStandardMaterial({map:woodMap,color:0xd1c4a9,roughness:.8}),darkWood=new THREE.MeshStandardMaterial({map:woodMap,color:0x82735a,roughness:.9});
  function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.78}));return mats.get(color);}
  function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,typeof mat==='number'?material(mat):mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,x,y,z,w,h,d,mat=wood,r=.025){const k=[w,h,d,r].join(',');if(!geometries.has(k))geometries.set(k,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.2,h*.2,d*.2)));return mesh(parent,geometries.get(k),mat,x,y,z);}
  function pole(parent,a,b,r,mat=darkWood){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),m=mesh(parent,new THREE.CylinderGeometry(r,r*.95,aa.distanceTo(bb),9),mat);m.position.copy(aa).add(bb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bb.sub(aa).normalize());return m;}
  function rope(parent,points,r=.017,mat=0xc6a879){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,5,false),mat);}
  function label(parent,text,x,y,z,w=1,color='#294e51',bg='#f4e5c4'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(9,9,494,110);ctx.font='bold 44px Georgia';const fontSize=Math.min(44,44*472/ctx.measureText(text).width);ctx.font=`bold ${fontSize}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,68);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=mesh(parent,new THREE.PlaneGeometry(w,w/4),new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,roughness:1}),x,y,z);m.castShadow=false;m.userData.ownedLabel=true;return m;}
  const environment=createHarborEnvironment(scene,renderer,{mesh,box,pole,rope,label,tex,stone,sand,wood,darkWood},renderer instanceof SoftwareRenderer);
  // Curved, planked hull. The usable grid is a small patch of the physical deck.
  const boat=new THREE.Group();boat.name='cargo-barge';scene.add(boat);
  const sections=[[-2.9,.13],[-2.58,1.18],[-2.02,1.99],[-1.25,2.13],[0,2.15],[1.25,2.13],[2.02,1.99],[2.58,1.18],[2.9,.13]];
  const pos=[],uv=[];function tri(a,b,c){pos.push(...a,...b,...c);for(const p of[a,b,c])uv.push(p[2]*.4,p[1]*2);}
  for(let i=0;i<sections.length-1;i++)for(const side of[-1,1]){const[z,w]=sections[i],[zz,ww]=sections[i+1];const a=[side*w,.57,z],b=[side*ww,.57,zz],c=[side*ww*.65,-.24,zz*.87],d=[side*w*.65,-.24,z*.87];tri(a,b,d);tri(b,c,d);}
  const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hullGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));hullGeo.computeVertexNormals();const hullMat=darkWood.clone();hullMat.side=THREE.DoubleSide;mesh(boat,hullGeo,hullMat);
  function widthAt(z){for(let i=0;i<sections.length-1;i++){const[a,w]=sections[i],[b,v]=sections[i+1];if(z>=a&&z<=b)return THREE.MathUtils.lerp(w,v,(z-a)/(b-a));}return .1;}
  for(let z=-2.72;z<=2.72;z+=.16){const width=widthAt(z)*2-.12;box(boat,0,.52,z,width,.15,.149,wood,.018);}
  for(const side of[-1,1]){rope(boat,sections.map(([z,w])=>[side*w,.68,z]),.065,wood);rope(boat,sections.map(([z,w])=>[side*w*.9,.26,z*.97]),.023,0xc2a76d);for(const z of[-2,-1.3,0,1.3,2]){pole(boat,[side*widthAt(z),.15,z],[side*widthAt(z),.69,z],.028,0x715033);}}
  for(const z of[-2.6,2.6]){box(boat,0,.65,z,1.9,.12,.22,darkWood);pole(boat,[0,.5,z],[0,1.04,z*1.05],.065);}
  // The mast occupies two central cells; rigging stays above the picking plane.
  box(boat,0,.64,0,.54,.12,1.38,darkWood,.05);pole(boat,[0,.68,0],[0,3.65,0],.062);
  pole(boat,[-1.48,3.4,0],[1.48,3.4,0],.038);
  const furled=mesh(boat,new THREE.CylinderGeometry(.09,.1,2.7,12),0xe9dbc0,0,3.36,.035);furled.rotation.z=Math.PI/2;
  // A capstone reaches about y=1.81 above the deck. Keep the fully opened
  // canvas above y=2 so the sail can billow without clipping a loaded sled.
  const SAIL_WIDTH=2.7,SAIL_HEIGHT=1.3,SAIL_TOP_Y=3.36;
  const sailGeo=new THREE.PlaneGeometry(SAIL_WIDTH,SAIL_HEIGHT,8,5);
  const sailCanvas=document.createElement('canvas');sailCanvas.width=512;sailCanvas.height=256;const sailCtx=sailCanvas.getContext('2d');
  sailCtx.fillStyle='#eadcc2';sailCtx.fillRect(0,0,sailCanvas.width,sailCanvas.height);sailCtx.strokeStyle='rgba(104,78,55,.26)';sailCtx.lineWidth=3;
  for(const x of[128,256,384]){sailCtx.beginPath();sailCtx.moveTo(x,8);sailCtx.lineTo(x,248);sailCtx.stroke();}
  for(const y of[64,128,192]){sailCtx.beginPath();sailCtx.moveTo(8,y);sailCtx.lineTo(504,y);sailCtx.stroke();}
  sailCtx.strokeStyle='rgba(93,67,47,.48)';sailCtx.lineWidth=5;sailCtx.strokeRect(8,8,496,240);
  sailCtx.fillStyle='rgba(93,67,47,.5)';for(const x of[32,96,160,224,288,352,416,480])for(const y of[8,248])sailCtx.fillRect(x,y-2,12,4);
  const sailMap=new THREE.CanvasTexture(sailCanvas);sailMap.colorSpace=THREE.SRGBColorSpace;
  const sail=mesh(boat,sailGeo,new THREE.MeshStandardMaterial({map:sailMap,color:0xffffff,roughness:.88,side:THREE.DoubleSide}),0,SAIL_TOP_Y,.07);sail.name='cargo-sail';sail.visible=false;
  function shapeSail(amount,windPhase=0){const position=sailGeo.attributes.position;for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),across=THREE.MathUtils.clamp(x/SAIL_WIDTH+.5,0,1),vertical=THREE.MathUtils.clamp(y/SAIL_HEIGHT+.5,0,1),fullness=Math.sin(Math.PI*across)*Math.sin(Math.PI*vertical);position.setZ(i,amount*fullness+.024*Math.sin(windPhase+x*2.8+y*3.2)*fullness);}position.needsUpdate=true;sailGeo.computeVertexNormals();}
  for(const x of[-.9,0,.9])rope(boat,[[x,3.4,-.07],[x,3.24,.04],[x,3.4,.13]],.018,0x896647);
  rope(boat,[[0,3.6,0],[.05,1.6,-1.15],[0,.78,-2.55]],.012);rope(boat,[[0,3.6,0],[.04,1.6,1.23],[0,.8,2.6]],.012);
  const anchorRig=new THREE.Group();anchorRig.name='cargo-anchor';anchorRig.position.set(1.28,.02,2.65);boat.add(anchorRig);
  const anchorRing=mesh(anchorRig,new THREE.TorusGeometry(.12,.024,6,16),0x6f5942);anchorRing.rotation.x=Math.PI/2;
  pole(anchorRig,[0,.08,0],[0,-.18,0],.027,0x6f5942);pole(anchorRig,[-.22,-.16,0],[.22,-.16,0],.024,0x6f5942);
  const anchorCableRig=new THREE.Group();anchorCableRig.position.set(1.28,.72,2.65);boat.add(anchorCableRig);rope(anchorCableRig,[[0,0,0],[0,-.7,0]],.014,0x6f5942);
  const pennantGeo=new THREE.BufferGeometry();pennantGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.8,-.08,0,0,-.3,0],3));pennantGeo.computeVertexNormals();const pennant=mesh(boat,pennantGeo,new THREE.MeshStandardMaterial({color:0x3d777e,side:THREE.DoubleSide}),0,3.68,0);
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
  const wake=new THREE.Group(),wakeLines=[];scene.add(wake);for(let i=0;i<6;i++){const line=mesh(wake,new THREE.TorusGeometry(.4+i*.2,.018,4,40,Math.PI),new THREE.MeshBasicMaterial({color:0xc6e8de,transparent:true,opacity:.23}),0,-.105,i*.32);line.rotation.x=-Math.PI/2;line.scale.set(1,.6,1);wakeLines.push(line);}
  function applyRigPose(rig,elapsed,reduced){const deploy=rig.sailDeploy;sail.visible=rig.visible&&deploy>.01;sail.scale.set(1,Math.max(.001,deploy),1);sail.position.y=SAIL_TOP_Y-SAIL_HEIGHT*.5*deploy;furled.scale.set(1,1-.82*deploy,1);shapeSail(rig.sailBillow*(reduced?.82:1),reduced?0:elapsed*.004);anchorRig.position.y=.02+rig.anchorLift*.66;anchorCableRig.scale.y=Math.max(.04,1-rig.anchorLift*.94);wake.visible=rig.visible&&rig.wakeStrength>.01;wake.scale.set(.7+.65*rig.wakeStrength,1,.7+.45*rig.wakeStrength);wakeLines.forEach((line,i)=>{line.material.opacity=.23*rig.wakeStrength*(1-i*.07);line.position.z=i*.32*(.65+.35*rig.wakeStrength);});}
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
  const marketGroup=new THREE.Group();scene.add(marketGroup);
  let marketSignature='';
  function syncMarket(state,level){
    const stock=MARKET_BAYS.map(b=>({bay:b,items:state.harbor?.cargo.filter(c=>c.type===b.type&&['market','quay'].includes(c.status)),need:level.requiredNewQuantities[b.type]||0}));
    const key=JSON.stringify(stock.map(s=>[s.bay.type,s.items?.map(i=>i.status),s.need]));if(key===marketSignature)return;marketSignature=key;disposeGroup(marketGroup);
    for(const {bay,items,need}of stock){const available=items?items.length:need,y=terrainHeight(bay.x,bay.z)+.17;
      for(let i=0;i<Math.min(3,available);i++){const item=cargoMesh({type:bay.type,id:'market',rotation:0}),cells=footprint(bay.type),w=Math.max(...cells.map(c=>c[0]))+1,d=Math.max(...cells.map(c=>c[1]))+1;
        item.scale.setScalar(.9);item.position.set(bay.x-w*CELL*.45+(i%2)*.09,y+i*.51,bay.z-d*CELL*.45-i*.035);item.traverse(o=>{delete o.userData.cargoId;if(o.isMesh)o.userData.marketType=bay.type;});marketGroup.add(item);
      }
      const ready=items?.filter(i=>i.status==='quay').length||0,sale=items?.filter(i=>i.status==='market').length||0;
      const caption=!available?(need?'All dispatched':'Not in this order'):items?(ready&&sale?`${ready} bought / ${sale} to buy`:`${available} ${ready?'ready':'for sale'} · ${CARGO_SPECS[bay.type].weight} wt`):`${available} in your plan · ${CARGO_SPECS[bay.type].weight} wt`;
      const board=label(marketGroup,caption,bay.x,y+.36,bay.z+1.04,2.3,'#f3e6c7','#'+INKS[bay.type].toString(16));if(available)board.userData.marketType=bay.type;
    }
  }
  function disposeGroup(g){for(const child of [...g.children]){g.remove(child);child.traverse(o=>{if(o.geometry&&!Array.from(geometries.values()).includes(o.geometry))o.geometry.dispose();if(o.userData.ownedLabel&&o.material?.map?.isCanvasTexture){o.material.map.dispose();o.material.dispose();}if(o.material?.isMeshBasicMaterial&&o.material.transparent)o.material.dispose();});}}
  let signature='',mode='',wasSailing=false,view='orbit',hoverSignature='',frame=0,lastFrame=0;
  function sync(){const {state,level}=getContext();const nextMode=['order','purchase'].includes(state.stage)||level.journeyRole==='order'?'order':'cargo';
    if(nextMode!==mode){mode=nextMode;home();signature='';}
    syncMarket(state,level);
    const h=state.harbor;if(h?.inTransit&&!wasSailing)departureView();else if(!h?.inTransit&&wasSailing)home();wasSailing=!!h?.inTransit;const sig=JSON.stringify([h?.cargo,h?.selected]);if(sig!==signature){signature=sig;disposeGroup(cargoGroup);if(h)for(const item of h.cargo.filter(c=>['boat','transit'].includes(c.status))){const g=cargoMesh(item);g.position.set((item.column-2.5)*CELL,DECK_Y+.02,(item.row-2)*CELL);cargoGroup.add(g);if(h.selected===item.id){const edges=cargoMesh(item,true,true);edges.position.copy(g.position);edges.position.y=DECK_Y+.04;cargoGroup.add(edges);}}}
    deckCells.visible=mode==='cargo';ghost.visible=mode==='cargo'&&!!h?.selected&&!h.inTransit;
    // Orbit remains available while a stone is selected. Placement gestures
    // temporarily suspend it, so a drag that starts on open water can still
    // orbit the deck without turning its release point into a placement.
    controls.enabled=mode==='order'||!h?.inTransit;
    renderer.domElement.style.cursor=h?.selected?'crosshair':'grab';container.dataset.view=view;hoverSignature='';dirty=true;resize();
  }
  function departureView(){view='voyage';controls.target.set(3,1,-20);camera.position.set(5.5,5.2,16);controls.update();resize();container.dataset.view=view;dirty=true;}
  function marketView(){view='market';controls.target.set(-7.8,1.1,-2.6);camera.position.set(4.4,7.1,13.4);controls.update();resize();container.dataset.view=view;dirty=true;}
  function home(){view='orbit';if(mode==='order'){view='shore';controls.target.set(-4,1.1,-5);camera.position.set(5,5.7,16);controls.update();resize();container.dataset.view=view;return;}controls.target.set(-.5,.55,-.3);camera.position.set(7.3,8.3,10.6);camera.zoom=1;controls.update();resize();container.dataset.view=view;dirty=true;}
  function topView(){view='deck';container.dataset.view=view;controls.target.set(0,.4,0);camera.position.set(0,12.4,2.9);controls.update();resize();dirty=true;}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;
    const mobile=w<=800&&h>500;
    // Keep the physical puzzle clear of the side order and lower cargo tray.
    camera.clearViewOffset();camera.zoom=mobile?(mode==='order'?.88:view==='market'?.8:.71):(view==='voyage'?.97:mode==='order'?.93:view==='market'?1:1.12);
    camera.setViewOffset(w,h,mobile?0:(Math.min(355,w*.3)-(mode==='cargo'?(w>1100?180:60):0))/2,mobile?(mode==='order'?h*.13:view==='deck'?10:h*.055):(mode==='order'||view==='market'||view==='voyage'?35:105),w,h);
    camera.updateProjectionMatrix();renderer.setSize(w,h);dirty=true;
  }
  new ResizeObserver(resize).observe(container);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const cargoHit=ray.intersectObjects(cargoGroup.children,true).find(x=>x.object.userData.cargoId);const deckHit=ray.intersectObjects(deckCells.children,true).find(x=>x.object.userData.deck);const marketHit=ray.intersectObjects(marketGroup.children,true).find(x=>x.object.userData.marketType);return{cargoId:cargoHit?.object.userData.cargoId,cell:deckHit?.object.userData.deck,marketType:marketHit&&marketHit.distance<Math.min(cargoHit?.distance??Infinity,deckHit?.distance??Infinity)?marketHit.object.userData.marketType:undefined};}
  function preview(column,row){const{state}=getContext(),h=state.harbor,item=h?.cargo.find(c=>c.id===h.selected);if(!item||h.inTransit){ghost.visible=false;return;}
    const problem=placementProblem(h.cargo,item,column,row,h.rotation),sig=[item.id,column,row,h.rotation,problem].join(':');
    if(sig!==hoverSignature){hoverSignature=sig;disposeGroup(ghost);const g=cargoMesh({...item,rotation:h.rotation},true,!problem);g.position.set((column-2.5)*CELL,DECK_Y+.04,(row-2)*CELL);ghost.add(g);ghost.visible=true;actions.onHover?.(problem||`Place at ${String.fromCharCode(65+column)}${row+1} · ${h.rotation}°`);dirty=true;}
  }
  function restoreControls(){const h=getContext().state.harbor;controls.enabled=mode==='order'||!h?.inTransit;}
  function releasePointer(pointerId){if(renderer.domElement.hasPointerCapture?.(pointerId))renderer.domElement.releasePointerCapture?.(pointerId);}
  let down=null,pointers=new Set();
  renderer.domElement.addEventListener('pointerdown',e=>{
    pointers.add(e.pointerId);
    if(pointers.size>1){if(down)releasePointer(down.pointerId);down=null;ghost.visible=false;restoreControls();return;}
    const{state}=getContext();
    if(state.harbor?.inTransit){pointers.delete(e.pointerId);restoreControls();return;}
    const hitInfo=hit(e),selected=!!state.harbor?.selected;
    let kind='orbit';
    if(hitInfo.marketType)kind='market';
    else if(hitInfo.cargoId)kind='cargo-drag';
    else if(hitInfo.cell&&selected)kind='place';
    down={pointerId:e.pointerId,x:e.clientX,y:e.clientY,selected,cargoId:hitInfo.cargoId,marketType:hitInfo.marketType,kind};
    if(kind==='market'||kind==='place'||kind==='cargo-drag'){
      if(kind==='cargo-drag'&&state.harbor?.selected!==hitInfo.cargoId)actions.onSelect(hitInfo.cargoId);
      controls.enabled=false;
      renderer.domElement.setPointerCapture(e.pointerId);
    }else ghost.visible=false;
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(pointers.size>1)return;
    const{state}=getContext(),info=hit(e),orbiting=down?.kind==='orbit';
    renderer.domElement.style.cursor=orbiting?'grabbing':info.marketType?'pointer':state.harbor?.selected?'crosshair':'grab';
    if(mode!=='cargo'||!state.harbor?.selected||orbiting||down?.kind==='market')return;
    if(info.cell)preview(info.cell.column,info.cell.row);else ghost.visible=false;
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    pointers.delete(e.pointerId);
    const gesture=down;down=null;releasePointer(e.pointerId);
    if(!gesture){restoreControls();return;}
    const moved=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>7;
    if(gesture.kind==='market'){restoreControls();if(!moved)actions.onMarket?.(gesture.marketType);return;}
    if(gesture.kind==='place'||gesture.kind==='cargo-drag'){
      // A deck tap places the selected stone. A loaded-cargo drag places only
      // after movement; a cargo click therefore remains a selection gesture.
      if(gesture.kind==='place'||moved){const info=hit(e);if(info.cell)actions.onPlace(info.cell.column,info.cell.row);}
    }
    restoreControls();
  });
  renderer.domElement.addEventListener('pointercancel',e=>{
    pointers.delete(e.pointerId);if(down)releasePointer(down.pointerId);down=null;ghost.visible=false;restoreControls();
  });
  renderer.domElement.addEventListener('pointerleave',()=>{if(!down)ghost.visible=false;});
  controls.addEventListener('change',()=>dirty=true);
  controls.addEventListener('start',()=>renderer.setInteractive?.(true));controls.addEventListener('end',()=>renderer.setInteractive?.(false));
  function animate(t){requestAnimationFrame(animate);if(container.closest('[hidden]')||document.hidden)return;const software=renderer instanceof SoftwareRenderer;if(t-lastFrame<(software?110:25))return;lastFrame=t;
    const{state}=getContext(),h=state.harbor,trip=h?.inTransit;const m=h?loadMetrics(h.cargo):{offsetX:0,offsetZ:0};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dx=0,dz=0,turn=0,rig=voyageRigPose(0),elapsed=0;
    if(trip){elapsed=Math.max(0,Date.now()-trip.startedAt);const p=Math.min(1,elapsed/VOYAGE_MS),pose=voyagePose(p);rig=voyageRigPose(p);actions.onVoyagePhase?.(rig.anchorLift<1?'Raising the anchor…':rig.sailDeploy<1?'Unfurling the sail…':rig.visible?'Under sail · bound for Giza':'Beyond the bend · arriving at Giza');dx=pose.x;dz=pose.z;turn=pose.heading;boat.visible=pose.visible;cargoGroup.visible=true;
    }else{boat.visible=true;cargoGroup.visible=true;}
    const motionTime=trip?elapsed:t;boat.position.set(dx,reduced?0:Math.sin(motionTime*.0013)*.025,dz);boat.rotation.set((trip?.offsetZ??m.offsetZ)*.12,turn,-(trip?.offsetX??m.offsetX)*.16+(reduced?0:Math.sin(motionTime*.0009)*.007));wake.position.set(dx,-.01,dz+2.5);
    applyRigPose(rig,elapsed,reduced);environment.update(motionTime,reduced);if(!reduced)pennant.rotation.y=Math.sin(motionTime*.002)*.12;
    controls.update();renderer.render(scene,camera);container.dataset.ready='ready';container.dataset.frame=String(++frame);dirty=false;
  }
  sync();requestAnimationFrame(animate);
  return{sync,home,marketView,topView,preview,zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();dirty=true;},orbit(){if(getContext().state.harbor)getContext().state.harbor.selected=null;actions.onDeselect?.();},get view(){return view;}};
}
