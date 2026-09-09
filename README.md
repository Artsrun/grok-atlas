# GROK.ATLAS

Photoreal Earth from the ISS cupola. One custom Earth shader — not a map engine. Day/night terminator, city lights, clouds, airglow limb, tides, a 30° cage, and a seat on the station.

Home camera is the Nile Delta / Eastern Mediterranean — the cupola night-limb frame.

Quiet edition is the default (the window). `?v=2` is the instrument.

## Controls

- **Orbit** — drag. Pinch / wheel to zoom. Touch gets a heavier throw and a larger tap slop so a drag does not pick a country.
- **Phone** — three thumb buttons at the bottom: Locate, ISS ride, Toolbox. The instrument sheet is a short tray: tap the handle or pull it down to close, pull up and it stays. Views live in the tray as a two-column grid — six of them, none off the edge.
- **Desktop** — right rail, hover tips, pointer section. The rail is 320px of opaque panel over a third of the globe, so it collapses: click the edge grab or press `T`, and the globe gets the whole window back. It scrolls, and fades its bottom edge only while there is more below.
- **Keys** (desktop) — `T` toolbox, `L` locate, `I` ISS ride, `Esc` leave the ride, then close the toolbox. Nothing fires while a field has focus, so `find country` still takes an `i`.
- **Country** — tap to inspect and fly to centroid
- **Views** — Nile Delta, Yerevan, Ararat, Europe, Americas, West Pacific, Lunar stand, ISS ride
- **ISS ride** — the camera takes the station: cupola glass, ground track running out ahead, live lat / lon / altitude / velocity under the caption. `ISS` on the dock, `iss ride` in the toolbox, `?site=iss` in a link. Any country tap or view leaves the ride and flies back out.
- **Cage** — 30° graticule with the degree readings written on it (`30°N`, `60°E`), faint geodesic shell behind. Every reading is one quad in one buffer, billboarded in the vertex shader — the whole set costs one draw call.
- **Layers** — atmosphere, clouds, borders, cage, ISS, moon, tides, cupola vignette, auto-sun, auto-moon, auto-rotate
- **Grain** — city lights and relief pick up a heavy ISS-style grain on new GPUs (Apple M / A15+, Adreno 6xx+, RTX). Older / software GL stays smooth. Force a path with `?tier=high|mid|low`.
- **Share** — copies `?c=Armenia`, `?site=nile` or `?site=iss`

## Loading

The globe is not gated on countries JSON. Canvas first, then the day map (first photoreal frame), then city lights (overlay leaves), then relief / clouds / atlas in the background. Low-tier devices skip spec/normal/clouds after lights so the first second stays cheap.

Day and night maps are `rel="preload"` in the document head, and the atlas chunk is requested when the route module evaluates rather than when the component mounts — the textures come down the same connection as the code instead of queueing behind it.

Nothing that fails is silent and nothing hangs: a stage that will not arrive still completes the strip, and leaves one line naming what the globe is now missing. A strip that has not moved for seven seconds says so.

## Frame budget

The shaders are written for 60. The device tier decides how many octaves of
grain get *linked* — `GRAIN_OCTAVES` is a define, not a branch — and a governor
watches the frame rate from there: under ~49 fps for the best part of a second
it steps the render scale down a rung and dims the grain with it, and hands both
back after 3.5 s of headroom. Four rungs, 1.0 down to 0.5. The toolbox prints the
live rate and the current rung next to the GPU line.

Per frame, the rig aims to allocate nothing and recompute nothing it already
knows. The sun, moon, station and ride seat write into vectors they own rather
than returning fresh arrays; the station's pose and the ground-track buffer are
solved once per fix, not once per frame; the ephemeris is read four times a
second, not sixty. Both airglow shells share one sphere, coarser below the top
tier, and the selection wash drops to 1024×512 there — a country tap re-uploads
a quarter of the texture it used to.

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
