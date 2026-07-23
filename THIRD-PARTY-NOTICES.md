# Third-Party Notices

This product bundles or depends on third-party open-source software. The
permissive licenses below (MIT, BSD-3-Clause, ISC, Apache-2.0, SIL OFL 1.1)
require that their copyright and permission notices be reproduced in
distributions of this software. Full, unmodified license texts ship inside each
package under `node_modules/<package>/LICENSE*`.

---

## Runtime & build dependencies

| Package | License | Copyright |
| --- | --- | --- |
| next | MIT | © 2025 Vercel, Inc. |
| react | MIT | © Meta Platforms, Inc. and affiliates |
| react-dom | MIT | © Meta Platforms, Inc. and affiliates |
| next-auth | ISC | © 2022–2024 Balázs Orbán |
| framer-motion | MIT | © 2018 Framer B.V. |
| zustand | MIT | © 2019 Paul Henschel |
| zod | MIT | © 2025 Colin McDonnell |
| clsx | MIT | © Luke Edwards |
| tailwind-merge | MIT | © 2021 Dany Castillo |
| tailwindcss | MIT | © Tailwind Labs, Inc. |
| lucide-react | ISC | © 2022 Lucide Contributors; portions © 2013–2022 Cole Bemis (Feather, MIT) |
| maplibre-gl | BSD-3-Clause | © 2023 MapLibre contributors |
| @node-rs/argon2 | MIT | © 2020–present LongYinan |
| @neondatabase/serverless | MIT | © 2022–2025 Neon Inc. |
| @vercel/speed-insights | Apache-2.0 | © Vercel, Inc. |
| server-only | MIT | © Vercel, Inc. |

The MIT, ISC and BSD-3-Clause licenses each require that "the above copyright
notice and this permission notice shall be included in all copies or substantial
portions of the Software." Apache-2.0 requires retention of the `NOTICE` /
license terms. Those texts are preserved verbatim in the respective package
directories under `node_modules/`.

## Fonts (self-hosted via `next/font/google`)

| Font | License | Author |
| --- | --- | --- |
| Plus Jakarta Sans | SIL Open Font License 1.1 | Tokotype |
| Anton | SIL Open Font License 1.1 | Vernon Adams |
| Pacifico | SIL Open Font License 1.1 | Vernon Adams / Jacques Le Bailly |

These fonts are served from the application's own origin at build time. The
SIL OFL 1.1 permits bundling and web embedding; the font files retain their
`OFL.txt` license notice as published by Google Fonts.

## Map data & tiles

Maps are rendered with **MapLibre GL JS** (BSD-3-Clause) using raster tiles from
the **OpenStreetMap** project. Map data is:

> © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors,
> available under the Open Database License (ODbL).

This attribution is displayed in the map's on-screen attribution control
(`src/components/MapView.tsx`). **Production note:** the OpenStreetMap Foundation
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
prohibits using `tile.openstreetmap.org` for heavy or commercial production
traffic. Before going live, switch to a dedicated tile provider (e.g. MapTiler,
Stadia Maps, or self-hosted tiles) while keeping the OpenStreetMap attribution.

---

_Generated as part of a rights/licensing compliance review. Regenerate when
dependencies change._
