import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {Water} from 'three/addons/objects/Water.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {bankX,terrainHeight,createBankGeometry,createRiverGeometry,PYRAMID_SITES,WATER_LEVEL} from './harbor-terrain.js';

export const MARKET_BAYS = Object.freeze([
  {type:'brick',name:'FLAT BRICKS',x:-9.9,z:.9},
  {type:'edge',name:'EDGE STONES',x:-6.4,z:.9},
  {type:'corner',name:'CORNERS',x:-9.9,z:-3.1},
  {type:'cap',name:'CAPSTONES',x:-6.4,z:-3.1},
]);

// One seeded landscape: visual detail never moves a bank or a foundation.
export function createHarborEnvironment(scene,renderer,{mesh,box,pole,rope,label,tex,stone,sand,wood,darkWood},software=false){
  let seed=7291;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const sunDirection=new THREE.Vector3(.12,.09,-1).normalize();
  scene.fog=new THREE.FogExp2(0xcdd5cd,.009);
  const sky=new Sky();sky.scale.setScalar(400);
  Object.assign(sky.material.uniforms.turbidity,{value:3.7});
  sky.material.uniforms.rayleigh.value=2.2;
  sky.material.uniforms.mieCoefficient.value=.004;
  sky.material.uniforms.mieDirectionalG.value=.84;
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  sky.material.fragmentShader=sky.material.fragmentShader.replace('vec4( texColor, 1.0 )','vec4( texColor * 0.38, 1.0 )');
  if(sky.material.uniforms.cloudCoverage)sky.material.uniforms.cloudCoverage.value=.13;
  if(!software){scene.add(sky);const pmrem=new THREE.PMREMGenerator(renderer);const envScene=new THREE.Scene();envScene.add(sky);sky.material.uniforms.showSunDisc.value=0;const environment=pmrem.fromScene(envScene,.06,1,500);scene.environment=environment.texture;scene.environmentIntensity=.3;scene.add(sky);sky.material.uniforms.showSunDisc.value=1;pmrem.dispose();}
  const sunlight=new THREE.DirectionalLight(0xffedc9,3.2);sunlight.position.copy(sunDirection).multiplyScalar(70);sunlight.target.position.set(-5,0,-3);scene.add(sunlight,sunlight.target);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);Object.assign(sunlight.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:150});sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.00015;
  scene.add(new THREE.HemisphereLight(0xc4def0,0xb7a783,1.6));
  const skyFill=new THREE.DirectionalLight(0xdde8e5,1.15);skyFill.position.set(6,16,12);scene.add(skyFill);

  const landMaterial=sand.clone();landMaterial.color.set(0xffffff);landMaterial.vertexColors=true;
  landMaterial.map=tex('sand-color',36);landMaterial.normalMap=tex('sand-normal-512',46,false);landMaterial.normalScale.set(.24,.24);
  for(const side of ['west','east']){const land=mesh(scene,createBankGeometry(side),landMaterial);land.name=`continuous-${side}-bank`;land.castShadow=false;}
  const waterGeo=createRiverGeometry();waterGeo.translate(0,-WATER_LEVEL,0);waterGeo.rotateX(Math.PI/2);
  // Incommensurate wave directions avoid the old repeating, embossed stripe pattern.
  const normalSize=256,normalData=new Uint8Array(normalSize*normalSize*4);
  const waveTerms=[[3,5,.52],[7,-4,.32],[-6,11,.18],[13,9,.12],[-17,5,.09],[21,-13,.065],[31,25,.04]];
  for(let y=0;y<normalSize;y++)for(let x=0;x<normalSize;x++){
    let dx=0,dy=0;for(const[a,b,c]of waveTerms){const phase=(x*a+y*b)*Math.PI*2/normalSize,scale=c/Math.hypot(a,b);dx+=Math.cos(phase)*a*scale;dy+=Math.cos(phase)*b*scale;}
    const n=new THREE.Vector3(-dx*.47,-dy*.47,1).normalize(),i=(y*normalSize+x)*4;normalData[i]=(n.x*.5+.5)*255;normalData[i+1]=(n.y*.5+.5)*255;normalData[i+2]=(n.z*.5+.5)*255;normalData[i+3]=255;
  }
  const normals=new THREE.DataTexture(normalData,normalSize,normalSize);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearMipmapLinearFilter;normals.generateMipmaps=true;normals.needsUpdate=true;let water;
  if(software){water=mesh(scene,waterGeo,new THREE.MeshStandardMaterial({color:0x497572,map:tex('water-color',8),normalMap:tex('water-normal-512',8,false),roughness:.2,metalness:.3}));}
  else {water=new Water(waterGeo,{textureWidth:512,textureHeight:512,waterNormals:normals,sunDirection,sunColor:0xffedcd,waterColor:0x34635e,distortionScale:.55,fog:true});scene.add(water);water.material.uniforms.size.value=28;}
  water.name='bank-bounded-nile';water.rotation.x=-Math.PI/2;water.position.y=WATER_LEVEL;water.castShadow=false;water.userData.water=true;

  // The quarry is a cut into a broad escarpment, with raw faces and extraction ledges.
  const quarryMat=stone.clone();quarryMat.map=tex('quarry-limestone-v2.jpg');quarryMat.bumpMap=quarryMat.map;quarryMat.bumpScale=.075;quarryMat.normalScale.set(.15,.15);quarryMat.vertexColors=true;quarryMat.color.set(0xf3e3c8);
  const rockPos=[],rockUV=[],rockColors=[];
  function rockTri(a,b,c,tint=1){for(const p of[a,b,c]){rockPos.push(...p);rockUV.push(p[0]/5+p[2]/17,p[1]/5+p[2]/13);rockColors.push(tint,tint*.975,tint*.93);}}
  function rockQuad(a,b,c,d,tint){rockTri(a,c,b,tint);rockTri(a,d,c,tint);}
  const rows=[[-8,.42],[-11.5,.55],[-11.6,2.0],[-15,2.1],[-15.15,4.35],[-19.4,4.5],[-19.55,7.5],[-24,8],[-30,7.8],[-40,4],[-52,.6]];
  const columns=60,grid=rows.map(([z,y],r)=>Array.from({length:columns+1},(_,i)=>{
    const x=-39+i*.53,edge=Math.min(1,i/8,(columns-i)/9),rough=Math.sin(x*2.3+r*.9)*.055+Math.sin(x*7.1)*.028;
    return [x,terrainHeight(x,z)+y*Math.max(0,edge)*(1+.035*Math.sin(x*.72)+.025*Math.sin(x*1.9))+rough,z+Math.sin(x*.47)*.6+Math.sin(x*1.9)*.1];
  }));
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns;c++)rockQuad(grid[r][c],grid[r+1][c],grid[r+1][c+1],grid[r][c+1],.82+random()*.18);
  const quarryGeometry=new THREE.BufferGeometry();quarryGeometry.setAttribute('position',new THREE.Float32BufferAttribute(rockPos,3));quarryGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(rockUV,2));quarryGeometry.setAttribute('color',new THREE.Float32BufferAttribute(rockColors,3));quarryGeometry.computeVertexNormals();
  mesh(scene,quarryGeometry,quarryMat).name='excavated-limestone-escarpment';
  // Wind-shaped dunes recede inland instead of a perfectly flat tabletop horizon.
  const duneGeo=new THREE.PlaneGeometry(85,110,38,42);duneGeo.rotateX(-Math.PI/2);duneGeo.translate(67,0,-42);
  const dp=duneGeo.attributes.position;for(let i=0;i<dp.count;i++){const x=dp.getX(i),z=dp.getZ(i),inland=Math.max(0,Math.min(1,(x-36)/15)),edge=Math.sin((x-24.5)/85*Math.PI)**2;dp.setY(i,terrainHeight(x,z)+inland*edge*(1.2+1.1*Math.sin(z*.075+x*.04))+.005);}duneGeo.computeVertexNormals();mesh(scene,duneGeo,sand).castShadow=false;
  // Dark, narrow channels left by stonecutters; the ledges are not stacked bricks.
  const cuts=new THREE.MeshStandardMaterial({color:0x71624c,roughness:1});
  for(let i=0;i<29;i++){const x=-29+i*.72;const z=-11.6+Math.sin(x*.47)*.6+Math.sin(x*1.9)*.1;
    box(scene,x,1.28,z+.018,.016,1.27,.013,cuts,.003);
    if(i%3===0)box(scene,x,3.3,-15.1+Math.sin(x*.47)*.6,.019,1.7,.017,cuts,.003);
  }
  const chipGeo=new THREE.IcosahedronGeometry(1,0),chips=new THREE.InstancedMesh(chipGeo,stone,250),dummy=new THREE.Object3D();
  for(let i=0;i<250;i++){const x=-32+random()*27,z=-8+random()*22,y=terrainHeight(x,z),s=.035+Math.pow(random(),3)*.23;dummy.position.set(x,y+s*.3,z);dummy.scale.set(s*1.5,s*.65,s);dummy.rotation.set(random()*2,random()*6,random());dummy.updateMatrix();chips.setMatrixAt(i,dummy.matrix);if(software&&i<35){const chip=mesh(scene,chipGeo,stone);chip.position.copy(dummy.position);chip.scale.copy(dummy.scale);chip.rotation.copy(dummy.rotation);chip.castShadow=false;}}chips.castShadow=true;chips.receiveShadow=true;if(!software)scene.add(chips);
  // A broad haul road reaches the landward side of the wharf.
  const roadMat=new THREE.MeshStandardMaterial({map:tex('earth-color',4),color:0xc4ad83,roughness:1});
  const road=new THREE.Shape();road.moveTo(-17,-9);road.lineTo(-14,-9);road.lineTo(-4.1,2);road.lineTo(-4.1,4);road.lineTo(-7.5,4);road.closePath();
  const roadGeo=new THREE.ShapeGeometry(road,8);roadGeo.rotateX(Math.PI/2);const rp=roadGeo.attributes.position;
  for(let i=0;i<rp.count;i++)rp.setY(i,terrainHeight(rp.getX(i),rp.getZ(i))+.025);roadGeo.computeVertexNormals();mesh(scene,roadGeo,roadMat).castShadow=false;
  for(const d of[-.26,.26])rope(scene,[[-15+d,.59,-8],[-12+d,.58,-4],[-8+d,.49,1],[-5+d,.19,3]],.014,0x968367);

  const dock=new THREE.Group();dock.name='shore-connected-working-wharf';scene.add(dock);
  for(let i=0;i<31;i++)box(dock,-4.7,.29,-4+i*.25,4.6,.18,.232,wood,.008);
  for(const x of[-6.7,-2.7])for(const z of[-3.9,3.4]){pole(dock,[x,-.62,z],[x,.8,z],.115);for(let j=0;j<4;j++){const ring=mesh(dock,new THREE.TorusGeometry(.128,.017,5,16),0x8c7852,x,.55+j*.045,z);ring.rotation.x=Math.PI/2;}}
  for(const z of[-3.7,-.3,3])box(dock,-4.7,.1,z,4.8,.18,.2,darkWood);
  // Reeds and stones tie the timber into a silty shoreline.
  const reedParts=[];
  for(let i=0;i<155;i++){const z=4+random()*36,x=bankX(z)-.1-random()*.6,y=terrainHeight(x,z),h=.35+random()*.65;
    for(let j=0;j<3;j++){const blade=new THREE.PlaneGeometry(.035,h,1,3),p=blade.attributes.position;for(let k=0;k<p.count;k++){const v=(p.getY(k)+h/2)/h;p.setX(k,p.getX(k)*(1-v*.9)+v*v*.13);p.setZ(k,v*v*.17);}blade.translate(0,h/2,0);blade.rotateY(random()*6.28);blade.translate(x,y,z);reedParts.push(blade);}}
  const reedGeo=mergeGeometries(reedParts);reedParts.forEach(g=>g.dispose());mesh(scene,reedGeo,new THREE.MeshStandardMaterial({color:0x626b3c,roughness:1,side:THREE.DoubleSide}));

  // Each palm has a tapered, scarred trunk and hundreds of thin, curved leaflets.
  const frondParts=[];
  const bark=new THREE.MeshStandardMaterial({map:tex('palm-bark-color',3),normalMap:tex('palm-bark-normal',3,false),normalScale:new THREE.Vector2(.65,.65),color:0xada18b,roughness:1});
  function palm(x,z,h,lean=.45){const y=terrainHeight(x,z),curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,y,z),new THREE.Vector3(x+lean*.25,y+h*.5,z),new THREE.Vector3(x+lean,y+h,z-.2)]);
    const trunkGeo=new THREE.TubeGeometry(curve,28,.15,10,false),p=trunkGeo.attributes.position;
    for(let i=0;i<p.count;i++){const f=(p.getY(i)-y)/h,center=curve.getPointAt(Math.min(1,Math.max(0,f))),taper=1-f*.44;p.setX(i,center.x+(p.getX(i)-center.x)*taper);p.setZ(i,center.z+(p.getZ(i)-center.z)*taper);}trunkGeo.computeVertexNormals();mesh(scene,trunkGeo,bark);
    const crown=curve.getPoint(1);
    for(let j=0;j<13;j++){const a=j*2.399+random()*.3,len=1.7+random()*.85,raise=j<4?.65:.25,drop=j<4?.6:1.3;
      const radial=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),side=new THREE.Vector3(-Math.sin(a),0,Math.cos(a));
      const frond=t=>crown.clone().addScaledVector(radial,t*len).add(new THREE.Vector3(0,Math.sin(t*Math.PI)*raise-t*t*drop,0));
      const frondGeo=new THREE.PlaneGeometry(len*.57,len,6,18),fp=frondGeo.attributes.position;
      for(let k=0;k<fp.count;k++){const lateral=fp.getX(k),t=(fp.getY(k)+len/2)/len,point=frond(t).addScaledVector(side,lateral);point.y-=Math.abs(lateral)*.24*Math.sin(t*Math.PI);fp.setXYZ(k,point.x,point.y,point.z);}frondGeo.computeVertexNormals();frondParts.push(frondGeo);
    }
    for(let j=0;j<5;j++){const fruit=mesh(scene,new THREE.SphereGeometry(.11,6,5),0x81603c,crown.x+Math.cos(j)*.17,crown.y-.16,crown.z+Math.sin(j)*.17);fruit.scale.y=1.6;}
  }
  for(const args of[[-13.8,5,6.3,.7],[-15.7,7.3,5.4,-.3],[-10.7,-7.7,5.8,.45],[-22,1,5.5,.25],[-25,7,6.8,.5],[-10.5,13.8,5.7,.6],[25,-20,5,.2],[28,-22,6,.4],[30,-25,4.9,.4],[-8,-38,5.5,.2]])palm(...args);
  const foliageGeo=mergeGeometries(frondParts);frondParts.forEach(g=>g.dispose());
  const palmMap=tex('date-palm-frond-v2');palmMap.wrapS=palmMap.wrapT=THREE.ClampToEdgeWrapping;
  const leaves=mesh(scene,foliageGeo,new THREE.MeshStandardMaterial({map:palmMap,color:0xe1e6ce,roughness:.92,side:THREE.DoubleSide,alphaTest:.32}));leaves.name='curved-botanical-palm-fronds';

  // Pyramids sit on continuous dry land, with wide foundations sampled from that land.
  for(const [i,site] of PYRAMID_SITES.entries()){const h=[6.5,7.6,5.9][i],base=site.baseHeight+.09,w=site.halfWidth*2;
    box(scene,site.x,base-.09,site.z,w+.35,.28,site.halfDepth*2+.35,stone,.015);
    const geo=new THREE.ConeGeometry(w/Math.sqrt(2),h,4,1);geo.rotateY(Math.PI/4);const monument=mesh(scene,geo,stone,site.x,base+h/2,site.z);monument.name=`dry-land-pyramid-${i+1}`;monument.scale.z=site.halfDepth/site.halfWidth;
    for(let row=1;row<26;row++){const yy=h*row/26,span=w*(1-row/26),depth=site.halfDepth*2*(1-row/26);const seam=box(scene,site.x,base+yy,site.z+depth/2+.008,span,.018,.013,0xb4a281,.002);seam.castShadow=false;}
  }
  // Giza is beyond this stretch of river; voyages disappear into the distance.

  // Market bays are on the ground beside the road; shade stays behind the goods.
  const canvas=new THREE.MeshStandardMaterial({color:0xcbbd98,roughness:1,side:THREE.DoubleSide});
  const awnings=[];
  for(const bay of MARKET_BAYS){const y=terrainHeight(bay.x,bay.z)+.055;bayGround(bay,y);
    function bayGround(b,y){for(let i=0;i<7;i++)box(scene,b.x,y+.04,b.z-.8+i*.27,2.9,.08,.25,darkWood,.005);
      for(const xx of[b.x-1.38,b.x+1.38]){pole(scene,[xx,y,b.z-1.0],[xx,y+2.8,b.z-1],.047);pole(scene,[xx,y,b.z-2.6],[xx,y+2.65,b.z-2.6],.045);}
      const g=new THREE.PlaneGeometry(3.1,2,14,9),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,-.15*Math.cos(p.getX(i)*1.8)+.06*Math.sin(p.getY(i)*2));g.computeVertexNormals();const cover=mesh(scene,g,canvas,b.x,y+2.73,b.z-1.85);cover.rotation.x=-Math.PI/2;awnings.push(cover);
      pole(scene,[b.x-1.5,y+2.76,b.z-.85],[b.x+1.5,y+2.76,b.z-.85],.033);label(scene,b.name,b.x,y+2.37,b.z-.82,2.42);
      for(let i=0;i<3;i++){const roll=mesh(scene,new THREE.CylinderGeometry(.09,.09,1.05,7),0xaa8e5b,b.x-.85+i*.65,y+.17,b.z-1.1);roll.rotation.z=Math.PI/2;}
    }
  }
  // Amphorae, a balance scale and coiled mooring lines at human scale.
  const potGeo=new THREE.LatheGeometry([new THREE.Vector2(.11,0),new THREE.Vector2(.23,.1),new THREE.Vector2(.26,.35),new THREE.Vector2(.15,.52),new THREE.Vector2(.12,.65),new THREE.Vector2(.15,.67)],20);
  for(let i=0;i<6;i++){const x=-11.7+(i%2)*.47,z=3.1+Math.floor(i/2)*.45;mesh(scene,potGeo,0x9f6948,x,terrainHeight(x,z),z);}
  const sx=-4.5,sz=2.1;box(scene,sx,.73,sz,1,.12,.7,wood);for(const x of[sx-.36,sx+.36])box(scene,x,.52,sz,.06,.4,.06,darkWood);pole(scene,[sx,.8,sz],[sx,1.5,sz],.025,0x8c734e);pole(scene,[sx-.4,1.42,sz],[sx+.4,1.42,sz],.022,0x8c734e);
  for(const x of[sx-.35,sx+.35]){rope(scene,[[x,1.42,sz],[x,1.02,sz]],.008);mesh(scene,new THREE.CylinderGeometry(.17,.12,.025,14),0x8f805c,x,1.01,sz);}
  for(let j=0;j<5;j++){const coil=mesh(scene,new THREE.TorusGeometry(.26-j*.042,.014,5,36),0xb29d72,-3.2,.4,2.9);coil.rotation.x=Math.PI/2;}

  // Small broken wave crests slide along the edge, leaving the reflective water readable.
  const rippleGroup=new THREE.Group();scene.add(rippleGroup);const rippleMat=new THREE.MeshBasicMaterial({color:0xd0dfce,transparent:true,opacity:.17,depthWrite:false});
  for(let i=0;i<24;i++){const z=-12+i*1.6,x=bankX(z)+.12+random()*.5,g=new THREE.PlaneGeometry(.018,.4+random()*.65);g.rotateX(-Math.PI/2);const wave=mesh(rippleGroup,g,rippleMat,x,WATER_LEVEL+.017,z);wave.rotation.y=(random()-.5)*.15;wave.castShadow=false;wave.userData.baseX=x;}
  return {water,update(time,reduced){if(water.material.uniforms)water.material.uniforms.time.value=reduced?0:time*.00038;else if(!reduced)water.material.normalMap.offset.set(time*.000009,time*.000003);if(!reduced){ripples(time);for(let i=0;i<awnings.length;i++)awnings[i].rotation.z=Math.sin(time*.0006+i)*.006;}},sunDirection};
  function ripples(t){rippleGroup.children.forEach((wave,i)=>{wave.position.x=wave.userData.baseX+Math.sin(t*.0008+i*.8)*.08;wave.position.y=WATER_LEVEL+.017+Math.sin(t*.001+i)*.005;});}
}
