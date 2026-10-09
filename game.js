import manifest from './missions.json' with {type:'json'};
export const COURSE=.64;
export const PARTS={core:{name:'Sun-dried core brick',short:'Core',color:0xb9a786},facing:{name:'Fired facing brick',short:'Facing',color:0xbd7b58},brick:{name:'Flat brick',short:'Brick',color:0xe8cc91},edge:{name:'Sloping edge',short:'Edge',color:0xf3d395},corner:{name:'Corner stone',short:'Corner',color:0xecc582},cap:{name:'Pyramid cap',short:'Cap',color:0xffdf99},temple:{name:'Temple assembly',short:'Temple',color:0xe4d8b6},stairs:{name:'Stair flight',short:'Stairs',color:0xd8c49b}};
export const SCENES=[
 {id:'egypt',name:'A wonder in limestone',place:'Egypt',kind:'Smooth-sided pyramid',dims:[3,2,1],types:['brick','edge','corner','cap'],prices:{brick:2,edge:3,corner:4,cap:5},budget:60,color:0xf6e4bb,ground:0xeed5a2,sky:0xbfe7f5,lesson:'Corner stones slope on two sides. Edge stones slope on one. Together they make four smooth faces.'},
 {id:'maya',name:'Temple above the canopy',place:'Maya cities',kind:'Stepped temple platform',dims:[4,3,2,1],types:['brick','temple','stairs'],prices:{brick:2,temple:8,stairs:3},budget:82,color:0xe9dfc4,ground:0x91ab69,sky:0xc5e8e5,lesson:'Build wide terraces first, then the temple and stair flights. Each terrace is smaller than the one below.'},
 {id:'mesopotamia',name:'The sacred city of Ur',place:'Mesopotamia',kind:'Mudbrick ziggurat',dims:[5,3,1],types:['brick','temple','stairs'],prices:{brick:2,temple:8,stairs:3},budget:94,color:0xc99570,ground:0xb3ad7f,sky:0xd1e7ea,lesson:'A two-unit change in width makes a one-unit terrace on each side. Count bricks and stairs separately.'}
];
export const missionText={
 'egypt-1':'The base is already built. Count the four upper corner stones and the cap. Their sloping faces must meet.',
 'egypt-2':'Stone travelled to Giza by water. Our model boat carries three weight units: a corner weighs one, the cap weighs two.',
 'egypt-3':'Two upper stones have the wrong shape. Inspect the pattern, lift them out, and restore the smooth casing.',
 'egypt-4':'Plan the whole fourteen-piece pyramid. Keep all four faces smooth and finish within fifty-four coins.',
 'maya-1':'The next floor needs a terrace around it. Compare the two footprints before ordering your materials.',
 'maya-2':'Mirror the completed front stairway on the rear. Both routes must connect the plaza to the summit.',
 'maya-3':'One stair flight is on the wrong side. Move existing pieces to reconnect the ascent. You do not need to buy anything.',
 'maya-4':'Keep the path toward the cenote clear. Compare footprint, stairway reach and cost before choosing a design.',
 'ur-1':'Use economical sun-dried bricks inside and stronger fired bricks on the outside. Cutaway view reveals the core.',
 'ur-2':'Facing bricks arrive in packs of four. Count the unfinished upper perimeter, then order the right number of packs.',
 'ur-3':'Compare two building sites against a model waterline. The higher site costs two coins. Predict, then test the water.',
 'ur-4':'Combine a high site, core and facing materials, packs and access stairs. Keep the complete commission within seventy-six coins.'
};
export const LEVELS=manifest.missions.map(m=>({...SCENES.find(s=>s.id===m.sceneId),...m,id:m.sceneId,missionId:m.id,types:Object.keys(m.prices),lesson:missionText[m.id],blueprint:m.target}));
export const key=(x,y,z)=>`${x},${y},${z}`;
export const sku=b=>b.material||b.type;
export function cells(n,y){return Array.from({length:n*n},(_,i)=>({x:i%n-(n-1)/2,y,z:Math.floor(i/n)-(n-1)/2}));}
export const target=l=>l.blueprint;
export function quantities(l){return Object.fromEntries(l.types.map(t=>[t,l.blueprint.filter(b=>sku(b)===t).length]));}
export const total=l=>l.blueprint.length;
export function required(l){const owned={};for(const b of l.seed)owned[sku(b)]=(owned[sku(b)]||0)+1;const q=quantities(l);return Object.fromEntries(l.types.map(t=>[t,Math.max(0,q[t]-(owned[t]||0))]));}
export function bounds(b){let x0=b.x-.5,x1=b.x+.5,z0=b.z-.5,z1=b.z+.5;if(b.type==='edge'||b.type==='corner'){if(b.type==='corner'||Math.abs(b.x)>=Math.abs(b.z)){if(b.x<0)x0+=.5;else x1-=.5;}if(b.type==='corner'||Math.abs(b.z)>Math.abs(b.x)){if(b.z<0)z0+=.5;else z1-=.5;}}if(b.type==='cap'){x0=x1=b.x;z0=z1=b.z;}return{x0,x1,z0,z1};}
export function supported(b,blocks,l){if(b.y===0)return true;if(b.type==='stairs')return blocks.some(p=>p.y===b.y-1&&p.type==='stairs'&&(p.routeId||'front')===(b.routeId||'front'));const below=blocks.filter(p=>p.y===b.y-1&&p.type!=='stairs');return[-.49,.49].every(dx=>[-.49,.49].every(dz=>below.some(p=>{const q=bounds(p);return b.x+dx>=q.x0-.011&&b.x+dx<=q.x1+.011&&b.z+dz>=q.z0-.011&&b.z+dz<=q.z1+.011;})));}
export function validate(l,blocks){const wants=new Map(target(l).map(b=>[key(b.x,b.y,b.z),sku(b)])),has=new Map(blocks.map(b=>[key(b.x,b.y,b.z),sku(b)]));return{missing:[...wants].filter(([k])=>!has.has(k)).length,extra:[...has].filter(([k])=>!wants.has(k)).length,wrong:[...has].filter(([k,t])=>wants.has(k)&&wants.get(k)!==t).length,unsupported:blocks.filter(b=>!supported(b,blocks,l)).length};}
export function initial(i=0){const l=LEVELS[i],empty=()=>Object.fromEntries(l.types.map(t=>[t,0]));return{level:i,stage:'plan',estimates:Object.fromEntries(l.types.map(t=>[t,required(l)[t]===0?'0':''])),money:l.budget,inventory:empty(),freeInventory:empty(),warehouse:empty(),blocks:structuredClone(l.seed),layer:Math.min(...target(l).filter(b=>!l.seed.some(p=>key(p.x,p.y,p.z)===key(b.x,b.y,b.z)&&sku(p)===sku(b))).map(b=>b.y),l.dims.length-1),tool:'place',part:l.types.find(t=>required(l)[t]>0)||l.types[0],history:[],completed:[],siteChoice:null,planningChoice:null,waterPreview:false,cutaway:false,trips:0};}
export const inventoryTotal=s=>Object.values(s.inventory).reduce((a,v)=>a+v,0);
export const available=(l,completed)=>!l.unlocksAfter||completed.includes(l.unlocksAfter);
export function planningValid(l,s){if(l.site&&s.siteChoice!==l.site.accepted)return false;if(l.planning?.acceptedChoice&&s.planningChoice!==l.planning.acceptedChoice)return false;if(l.planning?.choices?.[0]?.upperWidth&&s.planningChoice!==2)return false;return true;}
export function previewDims(l,s){if(l.planning?.choices?.[0]?.upperWidth&&s.planningChoice)return[l.dims[0],s.planningChoice,1];if(l.planning?.acceptedChoice&&s.planningChoice)return l.planning.choices.find(c=>c.id===s.planningChoice)?.dims||l.dims;return l.dims;}
export function previewTarget(l,s){const dims=previewDims(l,s);if(dims===l.dims)return target(l);const a=dims.flatMap((n,y)=>cells(n,y).map(b=>({...b,type:n===1?'temple':'brick'})));for(let y=0;y<dims.length-1;y++)a.push({x:0,y,z:dims[y]/2+.25,type:'stairs',stair:true,routeId:'front'});return a;}

export const unusedPurchases=s=>Object.entries(s.inventory).reduce((n,[type,count])=>n+Math.max(0,count-(s.freeInventory?.[type]||0)),0)+Object.values(s.warehouse||{}).reduce((n,count)=>n+count,0);
