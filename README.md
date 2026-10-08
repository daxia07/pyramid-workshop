# Pyramid Workshop

A static 3D educational browser game with three civilization chapters and twelve missions. Children plan quantities, buy materials within a budget, construct and repair shaped monuments, then unlock short English history stories with credited real photographs.

## Reproduce the reviewed build

```sh
npm ci
npm test
npm run build
```

Use a Node.js version supported by the pinned Vite release: 20.19+ or 22.12+. This snapshot was tested with Node.js 24.19.0. Production output is `dist/`. For local development, run `npm run dev`. Serve production output over HTTP; opening index.html directly is not supported. Vercel configuration uses Vite, `npm run build`, and `dist` as output.

This sanitized source snapshot reproduces reviewed release 2026-10-08-r1-vlhdOufz. Expected main bundle: `assets/index-vlhdOufz.js`, SHA-256 `6a8ff2608dcfb0db8f8c71a6689a478028179106dbef542fcadbbe90298d57ec`.

## Play and learning
- Egypt: shaped casing stones, boat load balancing, pattern repair and an independent commission. The 14-piece model preserves 3×3 + 2×2 + 1 counting with centred layers and continuous sloping faces.
- Maya cities: terrace footprints, mirrored stairs, zero-purchase route repair and a protected cenote-access corridor.
- Ur: core versus facing materials, packs of four, reversible higher-site comparison and a mixed-constraint commission.

Dimensions, prices, transport capacities and flood levels are teaching abstractions. Generated scenery and reconstructed worksite props are distinct from real present-day history photographs. The optional remote Sphinx is labeled as a later Khafre-era view, after Khufu. See `public/ASSET-CREDITS.txt`, `public/history.json` and `THIRD-PARTY-NOTICES.md` for credits, licenses and sources.

## Verification and limits
All twelve missions have been completed through desktop browser controls; 54 automated checks pass. A 500px-wide desktop playthrough also passed. Three.js provides actual mesh geometry, picking, orbit and zoom; a textured depth-buffered software renderer handles browsers where WebGL cannot initialize.

Still open:
- Overall visual realism and a coherent high-resolution distant environment. Failed scenery experiments are excluded.
- GPU rendering and true iPad/touch interaction. The reviewed preview used software rendering; narrow desktop testing is not touch testing.
- Publication and hosting-project/domain verification. The intended address is `pyramid.mingli.world`; this source snapshot does not establish a live deployment or project binding.

No accounts, analytics or backend services are used. Progress stays in local browser storage on the current device. The source snapshot excludes build output and installed dependencies.

## Integrity and rights
The source archive includes `SOURCE-SHA256SUMS.txt`, covering every payload file except that manifest. Public repository visibility is authorized, but this snapshot adds no license grant for the original game code. Third-party components and photographs retain their respective licenses and attributions.
