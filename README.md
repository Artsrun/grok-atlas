# GROK.ATLAS

Photoreal Earth from the ISS cupola. One custom Earth shader — not a map engine. Day/night terminator, city lights, clouds, airglow limb, tides, a 30° cage, and a seat on the station.

Home camera is the Nile Delta / Eastern Mediterranean — the cupola night-limb frame.

Quiet edition is the default (the window). `?v=2` is the instrument.

## Controls

- **Orbit** — drag. Pinch / wheel to zoom. Touch gets a heavier throw and a larger tap slop so a drag does not pick a country.
- **Phone** — three thumb buttons at the bottom: Locate, ISS ride, toolbox. The instrument sheet is a short tray with a grab handle; swipe down to close. Views live in the tray, not as a chip row over the globe.
- **Desktop** — right rail, hover tips, pointer section.
- **Country** — tap to inspect and fly to centroid
- **Views** — Nile Delta, Yerevan, Ararat, Europe, Americas, West Pacific, Lunar stand, ISS ride
- **ISS ride** — the camera takes the station: cupola glass, ground track running out ahead, live lat / lon / altitude / velocity under the caption. `ISS` on the dock, `iss ride` in the toolbox, `?site=iss` in a link. Any country tap or view leaves the ride and flies back out.
- **Cage** — 30° graticule with the degree readings written on it (`30°N`, `60°E`), faint geodesic shell behind. Every reading is one quad in one buffer, billboarded in the vertex shader — the whole set costs one draw call.
- **Layers** — atmosphere, clouds, borders, cage, ISS, moon, tides, cupola vignette, auto-sun, auto-moon, auto-rotate
- **Grain** — city lights and relief pick up a heavy ISS-style grain on new GPUs (Apple M / A15+, Adreno 6xx+, RTX). Older / software GL stays smooth. Force a path with `?tier=high|mid|low`.
- **Share** — copies `?c=Armenia`, `?site=nile` or `?site=iss`

## Loading

The globe is not gated on countries JSON. Canvas first, then the day map (first photoreal frame), then city lights (overlay leaves), then relief / clouds / atlas in the background. Low-tier devices skip spec/normal/clouds after lights so the first second stays cheap. Day and night are warmed into the HTTP cache on boot.

## Frame budget

The shaders are written for 60. The device tier decides how many octaves of
grain get *linked* — `GRAIN_OCTAVES` is a define, not a branch — and a governor
watches the frame rate from there: under ~49 fps for the best part of a second
it steps the render scale down a rung and dims the grain with it, and hands both
back after 3.5 s of headroom. Four rungs, 1.0 down to 0.5. The toolbox prints the
live rate and the current rung next to the GPU line.

## Stack

TanStack Start, React 19, Three.js, React Three Fiber, custom Earth shaders, Natural Earth 110m, Zustand, Tailwind v4.

Textures: day / night lights / specular / normal / clouds under `public/earth/`. Topology: `public/geo/countries-110m.json`.

```sh
npm install
npm run dev
```

## Deploy (Vercel)

TanStack Start + Nitro. Do **not** pick Vite / Create React App — they look for `dist` and the globe comes up blank.

On the import screen:

| Field | Value |
| --- | --- |
| Project name | `grok-atlas` |
| Application Preset | **TanStack Start** (scroll). If missing, **Other** |
| Root Directory | `./` |
| Build / Output | leave defaults |

`vercel.json` pins `"framework": "tanstack-start"`. No env vars. Production branch is `prod`.
