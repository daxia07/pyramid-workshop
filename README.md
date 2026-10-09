# Pyramid Workshop

A static 3D educational browser game with three civilization chapters and twelve missions. Children plan quantities, buy materials within a budget, construct and repair shaped monuments, then unlock short English history stories with credited real photographs.

## Build and run

```sh
npm ci
npm test
npm run build
```

Use a Node.js version supported by the pinned Vite release: 20.19+ or 22.12+. This snapshot was tested with Node.js 24.19.0. Production output is `dist/`. For local development, run `npm run dev`. Serve production output over HTTP; opening index.html directly is not supported. Vercel configuration uses Vite, `npm run build`, and `dist` as output.

The original sanitized snapshot is commit `495e585` (reviewed release `2026-10-08-r1-vlhdOufz`). `SOURCE-RELEASE.json` and `SOURCE-SHA256SUMS.txt` describe that original snapshot, not subsequent interface changes.

## Current interface

The 2026-10-09 update fills the window with the worksite, opens planning and market controls in a floating field journal, and moves building materials into a large illustrated tray. Eight distinct stone drawings appear consistently in planning, ordering, and building, with shape descriptions and quantity badges. The camera makes room for the journal and tray; short landscape screens use a side tray. A browser fullscreen button is available where supported.

The journal retains the keyboard-accessible top-view grid, specialist mission tools, and mission selection. Close it to build directly in 3D; reopen it with **Field journal** or **Blueprint & tools**. Saved progress continues to use the existing browser storage key.

## Publishing

Production destinations: https://pyramid.mingli.world/ and https://pyramid-mingli-world.vercel.app/. The Vercel project is `mingxia-lis-projects/pyramid-mingli-world` (`prj_opPerdde2LuNl72PHK2S1tndfGlI`).

Published and verified on 2026-10-09: GitHub release commit [`9bd8840`](https://github.com/daxia07/pyramid-workshop/commit/9bd884072902c52d2ed9f3c9a666bb34a2798af6), Vercel deployment `dpl_D33btDBiXpzCdSKtHrMuUXhFG4oA`. Both production URLs return HTTPS 200. All 30 served build files were checked against the tested local build and match byte for byte.

Aliyun manages the domain's DNS. The `pyramid` CNAME points to Vercel's recommended target, `7c3590a381be7036.vercel-dns-017.com`, with a 600-second TTL. The custom domain is registered and ownership-verified on the existing Vercel project.

Release commits must use an email associated with the publishing account. The original GitHub no-reply address caused Vercel's `TEAM_ACCESS_REQUIRED` verification error; see [Vercel's commit attribution guidance](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#resolving-git-provider-commit-attribution-issues). Deploy from the recorded GitHub release commit, or from a synchronized local checkout:

This Vercel account currently has no GitHub login connection. This release used the authenticated Vercel file-upload API with accurate metadata from the recorded GitHub commit; all 63 source files were matched against that commit before upload. Direct `gitSource` deployments require connecting GitHub to Vercel first.

```sh
vercel deploy --prod --project prj_opPerdde2LuNl72PHK2S1tndfGlI --scope mingxia-lis-projects --yes
```

The 2026-10-09 interface build produces `assets/index-DhR-l2dW.js` (SHA-256 `355ebcf3e91a41c0793f5556b024465a6cd74420f8b3baa271d07db3e3b66c78`) and `assets/index-CXiOOuV5.css`. Verify the served assets after publishing. `.vercelignore` excludes local build output and dependencies so Vercel builds the uploaded source.

## Play and learning
- Egypt: shaped casing stones, boat load balancing, pattern repair and an independent commission. The 14-piece model preserves 3×3 + 2×2 + 1 counting with centred layers and continuous sloping faces.
- Maya cities: terrace footprints, mirrored stairs, zero-purchase route repair and a protected cenote-access corridor.
- Ur: core versus facing materials, packs of four, reversible higher-site comparison and a mixed-constraint commission.

Dimensions, prices, transport capacities and flood levels are teaching abstractions. Generated scenery and reconstructed worksite props are distinct from real present-day history photographs. The optional remote Sphinx is labeled as a later Khafre-era view, after Khufu. See `public/ASSET-CREDITS.txt`, `public/history.json` and `THIRD-PARTY-NOTICES.md` for credits, licenses and sources.

## Verification and limits
All 54 automated checks and the production build pass for the current interface. Additional DOM checks with the renderer stubbed covered a complete Egypt mission (planning, purchasing, placement, undo, completion), material controls in all twelve missions, guide toggles, and unique control IDs. Camera projection and picking were checked at desktop and phone dimensions. The eight illustrations were rendered and visually inspected.

The original snapshot had a desktop browser playthrough of all twelve missions and a 500px-wide desktop check. Live browser review of the new interface was blocked by session permissions; its layout and true touch interaction remain unverified. Three.js provides mesh geometry, picking, orbit and zoom; a textured depth-buffered software renderer handles browsers where WebGL cannot initialize.

Still open:
- Overall visual realism and a coherent high-resolution distant environment. Failed scenery experiments are excluded.
- GPU rendering and true iPad/touch interaction. The reviewed preview used software rendering; narrow desktop testing is not touch testing.

No accounts, analytics or backend services are used. Progress stays in local browser storage on the current device. The source snapshot excludes build output and installed dependencies.

## Integrity and rights
The original source archive includes `SOURCE-SHA256SUMS.txt`, covering that archive's payload except the manifest itself. Public repository visibility is authorized, but this source adds no license grant for the original game code. Third-party components and photographs retain their respective licenses and attributions.
