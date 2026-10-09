// Shared illustrated pieces: the same silhouette follows a stone from plan to site.
export const STONE_DETAILS = {
  brick: { label: 'Flat brick', hint: 'Flat on every side', role: 'A solid support for the layer above.' },
  edge: { label: 'Edge stone', hint: '1 sloping face', role: 'Makes the middle of a smooth outer face.' },
  corner: { label: 'Corner stone', hint: '2 sloping faces', role: 'Joins two outer faces at a corner.' },
  cap: { label: 'Capstone', hint: 'A pointed summit', role: 'The final stone at the top of the pyramid.' },
  core: { label: 'Core brick', hint: 'Sun-dried earth', role: 'An economical brick for the protected inside.' },
  facing: { label: 'Facing brick', hint: 'Fired terracotta', role: 'A stronger brick for the exposed outside.' },
  temple: { label: 'Temple', hint: 'A roof & doorway', role: 'The sanctuary at the top of the terraces.' },
  stairs: { label: 'Stair flight', hint: 'Five rising steps', role: 'Connects one terrace to the next.' },
};

const project = ([x, y, z]) => [64 + (x - z) * 42, 67 + (x + z) * 19 - y * 54];
const points = vertices => vertices.map(v => project(v).map(n => +n.toFixed(2)).join(',')).join(' ');
const face = (vertices, fill) => `<polygon points="${points(vertices)}" fill="${fill}" stroke="#795b3c" stroke-width="1.4" stroke-linejoin="round"/>`;
const line = (a, b, color = '#fff4d2') => `<path d="M${project(a).join(',')} L${project(b).join(',')}" fill="none" stroke="${color}" stroke-width="1.25" stroke-linecap="round"/>`;

function block(x0, x1, z0, z1, y0, y1, colors, top = [x0, x1, z0, z1]) {
  const [a, b, c, d] = top;
  return face([[x0,y0,z1],[x1,y0,z1],[b,y1,d],[a,y1,d]], colors[1])
    + face([[x1,y0,z1],[x1,y0,z0],[b,y1,c],[b,y1,d]], colors[2])
    + face([[a,y1,c],[b,y1,c],[b,y1,d],[a,y1,d]], colors[0]);
}

export function stoneArt(type) {
  const colors = type === 'core' ? ['#dbd0ad', '#b8a77e', '#8b8062']
    : type === 'facing' ? ['#ebb18a', '#ce835e', '#9b583c']
    : type === 'cap' ? ['#ffe4a1', '#e6bd6e', '#b68a43']
    : ['#f6e4bb', '#dfbf86', '#b89159'];
  let art = '';
  if (type === 'cap') {
    art = face([[-.55,0,.55],[.55,0,.55],[0,1.05,0]],colors[1])
      + face([[.55,0,.55],[.55,0,-.55],[0,1.05,0]],colors[2])
      + line([-.48,.04,.5],[0,1.02,0]);
  } else if (type === 'stairs') {
    for (let step = 0; step < 5; step++) {
      const z = .6 - step * .24;
      art += block(-.52,.52,-.6,z,step*.16,(step+1)*.16,colors);
    }
  } else if (type === 'temple') {
    art = block(-.58,.58,-.48,.5,0,.12,colors)
      + block(-.45,.45,-.36,.36,.12,.65,colors)
      + face([[-.18,.12,.365],[.16,.12,.365],[.16,.54,.365],[-.18,.54,.365]],'#514638')
      + block(-.55,.55,-.46,.46,.65,.81,colors)
      + block(-.4,.4,-.36,-.15,.81,.96,colors);
  } else {
    const top = [-.55, type === 'edge' || type === 'corner' ? 0 : .55, -.55, type === 'corner' ? 0 : .55];
    art = block(-.55,.55,-.55,.55,0,.7,colors,top);
    art += line([top[0]+.06,.704,top[3]-.04],[top[1]-.04,.704,top[3]-.04]);
    if (type === 'core') {
      for (const [x,y] of [[-.34,.25],[-.13,.45],[.19,.19],[.31,.52]]) {
        art += line([x,y,.555],[x+.07,y+.035,.555],'#887959');
      }
    } else if (type === 'facing') {
      art += line([-.49,.24,.555],[.47,.24,.555],'#a35f42')
        + line([-.49,.48,.555],[.47,.48,.555],'#a35f42')
        + line([.1,.02,.555],[.1,.23,.555],'#a35f42')
        + line([-.18,.25,.555],[-.18,.47,.555],'#a35f42');
    } else {
      art += line([-.39,.15,.555],[-.28,.18,.555],'#b59565');
    }
  }
  return `<svg class="stone-art stone-art--${type}" viewBox="0 0 128 104" aria-hidden="true" focusable="false"><ellipse cx="64" cy="89" rx="43" ry="8" fill="#674926" opacity=".12"/>${art}</svg>`;
}
