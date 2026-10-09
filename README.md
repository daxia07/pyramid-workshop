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

The worksite fills the window, with an illustrated material tray and a floating field journal. Capstone and other layer transitions now show a persistent next-step hint, highlight the suggested layer, and offer a layer shortcut. Repair missions allow salvaged stones to remain in the store after inspection.

Egypt mission 2 is a separate quarry and harbor puzzle. Buy four corner stones (weight 2 each) and a capstone (weight 3), arrange them on a six-space boat, keep each voyage within weight 6 and a side-to-side difference of 2, and pay 2 coins per voyage. The 25-coin contract covers stone purchases and two shipments. Delivery completes the mission without repeating construction. Cargo can be dragged or selected and placed by tapping; saved voyages resume on reload. Earlier purchases and deliveries migrate without being discarded.

Completed missions pay 20, 25, 30 or 35 earned coins according to their position in the chapter. Wages are separate from contract budgets, paid once per mission, and credited for earlier saved completions. Free Design offers 3×3, 5×5 and 7×7 pyramids, smooth or stepped forms, four stone palettes, unlimited construction, layer filling, removal and undo. Earned coins unlock decorations once for unlimited placement: paths, palms, banners, obelisks and pools. Designs, purchases and mission progress persist together in the existing browser storage key.

## Publishing

Production: https://pyramid.mingli.world/ and https://pyramid-mingli-world.vercel.app/. Vercel project: `mingxia-lis-projects/pyramid-mingli-world` (`prj_opPerdde2LuNl72PHK2S1tndfGlI`). Aliyun's `pyramid` CNAME points to `7c3590a381be7036.vercel-dns-017.com` with TTL 600; the domain is already verified and assigned to this project.

Deploy a tested, committed checkout using the authenticated CLI:

```sh
vercel deploy --prod --project prj_opPerdde2LuNl72PHK2S1tndfGlI --scope mingxia-lis-projects --yes
```

Release commits must use an email associated with the publishing account. The original GitHub no-reply address caused `TEAM_ACCESS_REQUIRED`; using the verified publishing identity unblocked deployment. This Vercel account has no GitHub login connection, so direct `gitSource` deployment is unavailable; CLI source uploads work. `.vercelignore` excludes dependencies, local build output and secrets. After publishing, compare the served HTML and build assets with the tested `dist/` output.

## Play and learning
- Egypt: shaped casing stones, a quarry shipping and load-balance puzzle, pattern repair and an independent commission. The 14-piece model preserves 3×3 + 2×2 + 1 counting with centred layers and continuous sloping faces.
- Maya cities: terrace footprints, mirrored stairs, zero-purchase route repair and a protected cenote-access corridor.
- Ur: core versus facing materials, packs of four, reversible higher-site comparison and a mixed-constraint commission.

Dimensions, prices, transport capacities and flood levels are teaching abstractions. Generated scenery and reconstructed worksite props are distinct from real present-day history photographs. The optional remote Sphinx is labeled as a later Khafre-era view, after Khufu. See `public/ASSET-CREDITS.txt`, `public/history.json` and `THIRD-PARTY-NOTICES.md` for credits, licenses and sources.

## Verification and limits

All 73 automated checks and the production build pass. Regression coverage includes capstone guidance, salvaged repair inventory, shipping weight/balance/budget constraints, saved-voyage recovery, migration, once-only wages, decoration purchases, all six studio size/shape combinations, support rules and undo data.

Connected Chrome checks exercised the capstone hint through actual 3D picking, mission 3 inspection with two salvaged edge stones, both shipping voyages and fees, wages, studio size and stone changes, decoration placement, free layer building and undo, reload persistence, and return to missions. Desktop and emulated phone layouts were visually checked with WebGL rendering. Physical iPad/touch-device testing remains open. A textured software renderer remains available when WebGL cannot initialize.

No accounts, analytics or backend services are used. Coins are in-game rewards, with no real-money purchases. Progress stays in local browser storage on the current device. The original sanitized source snapshot excludes build output and installed dependencies.

## Integrity and rights
The original source archive includes `SOURCE-SHA256SUMS.txt`, covering that archive's payload except the manifest itself. Public repository visibility is authorized, but this source adds no license grant for the original game code. Third-party components and photographs retain their respective licenses and attributions.
