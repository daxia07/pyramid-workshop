# Pyramid Workshop

A static 3D educational browser game with three civilization chapters and twelve missions. Children plan quantities, buy materials within a budget, construct and repair shaped monuments, then unlock short English history stories with credited real photographs.

## Build and run

```sh
npm ci
npm test
npm run build
```

Use a Node.js version supported by the pinned Vite release: 20.19+ or 22.12+. The current release is checked with Node.js 22.22.3. Production output is `dist/`. For local development, run `npm run dev`. Serve production output over HTTP; opening index.html directly is not supported. Vercel configuration uses Vite, `npm run build`, and `dist` as output.

The original sanitized snapshot is commit `495e585` (reviewed release `2026-10-08-r1-vlhdOufz`). `SOURCE-RELEASE.json` and `SOURCE-SHA256SUMS.txt` describe that original snapshot, not subsequent interface changes.

## Current interface

All three chapters have a visible four-mission expedition timeline and a persistent next-mission action after inspection. Optional **Explore the model** activities use the active mission blueprint: Egypt compares layers, Maya explores terraces and stair routes, and Ur compares core/facing bricks, four-brick packs and model waterlines. Predictions give explanations and allow retries; revealing model counts never fills estimates, spends coins or passes a mission. Open them in the field journal or worksite guide. Real history stories also have optional read-aloud controls.

Maya and Ur now have distinct procedural summit buildings with open doorways. Maya uses a framed limestone chamber and stepped roof; Ur uses a brick chamber with projecting buttresses, flat coping and visible brick courses. These are illustrative teaching models, especially the uncertain upper structures at Ur. Both use ordinary merged meshes for WebGL and the software fallback, retain picking and ghost previews, and keep geometry inside the existing puzzle envelope. Core and facing bricks have clearer contrasting colors.

Maya and Ur build hints now identify incorrect materials and disconnected stair routes, guide safe upper-first removal, and direct the player to the next supported layer, stair slot or inspection. Market refunds preserve salvaged site stones, so a repair cannot lose its reusable stair through the return-stock button. The top-view journal includes its own material, layer, place/remove, undo and inspection controls, keeping the full build reachable on narrow screens.

Egypt is designed around short, guided challenges for young players. The shopping list requires the child's own counts, with large +/− controls, gentle recount clues, and a counting mat where matching stones can be marked individually. Marking stones never fills an answer or passes a level. Optional “Read to me” buttons use the device's speech support; written directions remain available.

“Help me pack” reveals one move from a verified three-trip route. The child rotates the sled and taps the starred deck-map space; hints never place or ship cargo. The boat checks weight, balance, and whether the remaining fares could carry the waiting stones. Undo is visible beside the packing tools. Both shipments retain their original puzzles and budgets.

Building checks shapes before consuming a stone, gives persistent layer and repair hints, and keeps a next-step button visible after completion and reload. Egypt's top-view map focuses on the current layer's building spaces, while keeping misplaced stones from older saves reachable for repair. Bigger touch controls and simpler directions apply across the Egypt chapter; existing saves and earned rewards are retained.

The worksite fills the window, with an illustrated material tray and a floating field journal. Capstone and other layer transitions now show a persistent next-step hint, highlight the suggested layer, and offer a layer shortcut. Repair missions allow salvaged stones to remain in the store after inspection.

Egypt follows a visible expedition timeline: **Plan and buy → Pack and ship → Build three layers → Expand to four**. The opening quarry scene uses a rotatable 3D reference model and quantities for all 14 stones. Sealing the shopping list locks its quantities; Level 1 passes only after all materials are purchased. Level 2 starts with that paid stock and passes only after every shipment arrives. Passed timeline stops remain visible without reopening earlier stages. After shipping, that stock is supplied to an empty construction site. The later expansion preserves the completed upper 14 stones on a temporary model scaffold and adds a new 16-stone, 4×4 foundation.

The cargo game has a real Three.js quarry and river scene: a curved, planked barge with rigging, textured limestone cargo, water, shadows, quarry stock, and animated voyages. Departure lifts the anchor, unfurls a stitched sail above the cargo, then accelerates downriver and disappears beyond the bend. Select a sled, rotate it with the button or R, and tap the deck; loaded sleds can be picked up and moved. Drag empty water to orbit even while a stone is selected; releasing an orbit drag cannot place cargo. Switch to Deck view for precision, or open the accessible deck map. The physical boat tilts with the load. Visible instructions and contextual hints explain rotation, fitting, weight and both balance axes. Titles, voyage updates and pass notices live inside the order panels.

The 5×4 deck has two mast spaces. Protective sleds use domino, straight triomino, L-triomino and 2×2 footprints; weights are 2, 3, 3 and 5. A voyage must avoid collisions, fit the deck, weigh at most 16 and balance in both directions. Freight costs 3 coins per voyage. Contract budgets (63 initially, 60 for expansion) cover all stones plus four voyages; both shipments have verified three-voyage solutions. Undoing a voyage restores its cargo and fee. Unload all returns the current deck load to the quay without changing delivered cargo or fees. Restart level restores that level’s starting materials and budget, keeping earned rewards. Shipping restarts with the paid list and does not repeat shopping. Shipping never repeats the building task.

Saved discoveries, earned coins, studio designs and non-Egypt progress survive the update. Previous Egypt runs are archived, earlier cargo purchases and deliveries keep their value, and the old repair build retains its stones and salvaged inventory.

Completed missions pay 20, 25, 30 or 35 earned coins according to their position in the chapter. Wages are separate from contract budgets, paid once per mission, and credited for earlier saved completions. Free Design offers 3×3, 5×5 and 7×7 pyramids, smooth or stepped forms, four stone palettes, unlimited construction, layer filling, removal and undo. Earned coins unlock decorations once for unlimited placement: paths, palms, banners, obelisks and pools. Designs, purchases and mission progress persist together in the existing browser storage key.

## Publishing

Production: https://pyramid.mingli.world/ and https://pyramid-mingli-world.vercel.app/. Vercel project: `mingxia-lis-projects/pyramid-mingli-world` (`prj_opPerdde2LuNl72PHK2S1tndfGlI`). Aliyun's `pyramid` CNAME points to `7c3590a381be7036.vercel-dns-017.com` with TTL 600; the domain is already verified and assigned to this project.

Deploy a tested, committed checkout using the authenticated CLI:

```sh
vercel deploy --prod --project prj_opPerdde2LuNl72PHK2S1tndfGlI --scope mingxia-lis-projects --yes
```

Release commits must use an email associated with the publishing account. The original GitHub no-reply address caused `TEAM_ACCESS_REQUIRED`; using the verified publishing identity unblocked deployment. This Vercel account has no GitHub login connection, so direct `gitSource` deployment is unavailable; CLI source uploads work. `.vercelignore` excludes dependencies, local build output and secrets. After publishing, compare the served HTML and build assets with the tested `dist/` output.

## Play and learning
- Egypt: a shopping list, spatial cargo packing, supplied-stock construction and a four-layer expansion. The 14-piece model uses 3×3 + 2×2 + 1; the expansion adds 4×4 below for 30 pieces. Layers stay centred with continuous sloping faces.
- Maya cities: terrace footprints, mirrored stairs, zero-purchase route repair and a protected cenote-access corridor.
- Ur: core versus facing materials, packs of four, reversible higher-site comparison and a mixed-constraint commission.

Dimensions, prices, transport capacities and flood levels are teaching abstractions. Generated scenery and reconstructed worksite props are distinct from real present-day history photographs. The optional remote Sphinx is labeled as a later Khafre-era view, after Khufu. See `public/ASSET-CREDITS.txt`, `public/history.json` and `THIRD-PARTY-NOTICES.md` for credits, licenses and sources.

## Verification and limits

The automated suite covers spatial collision and mast restrictions, both balance axes, verified three-voyage solutions for both contracts, freight accounting and undo, voyage persistence, legacy migration, salvaged inventory, one-time wages, free design, monument geometry and capstone guidance. Child-focused regressions also cover independent counting answers, expansion counts, fare exhaustion prevention, repair recovery, and complete guided shipments with save/reload.

The current suite has 154 passing tests, including an actual-control playthrough of all twelve missions with the 3D renderers stubbed. It checks both Egypt shipments and builds, Maya terrace/mirrored-route/repair/corridor missions, Ur materials/packs/high-site/budget missions, independent learning activities, final reward navigation, reload persistence and one-time wages. Geometry tests check distinct temple silhouettes, finite bounds and open doorways.

Connected Chrome checks exercised the production preview, including completed Maya and Ur missions and their rendered summits, Egypt's counting scene, and an emulated iPhone 16 viewport (393 × 852). The Ur mission was completed with the journal's mobile map controls, including material/layer selection and inspection. These complement the automated playthrough; the simulated tests do not prove rendering, and phone emulation does not prove physical touch or device speech playback. A textured software renderer remains available when WebGL cannot initialize.

No accounts, analytics or backend services are used. Coins are in-game rewards, with no real-money purchases. Progress stays in local browser storage on the current device. The original sanitized source snapshot excludes build output and installed dependencies.

## Integrity and rights
The original source archive includes `SOURCE-SHA256SUMS.txt`, covering that archive's payload except the manifest itself. Public repository visibility is authorized, but this source adds no license grant for the original game code. Third-party components and photographs retain their respective licenses and attributions.
