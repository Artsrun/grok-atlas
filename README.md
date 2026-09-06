# GROK.ATLAS

Photoreal Earth from the ISS cupola — day/night terminator, city lights, clouds, atmosphere. Click a country to fly there. Observational views, not conflict scenarios.

Home camera is the Nile Delta / Eastern Mediterranean — the cupola night-limb frame.

## Controls

- **Orbit** — drag. Pinch / wheel to zoom
- **Country** — tap to inspect and fly to centroid
- **Views** — Nile Delta, Yerevan, Ararat, Europe, Americas, West Pacific, Lunar stand
- **Layers** — atmosphere, clouds, borders, cage, ISS, moon, tides, cupola vignette, auto-sun, auto-moon, auto-rotate
- **Device tilt** — optional gyroscope on the rig (phone)
- **Share** — copies `?c=Armenia` or `?site=nile`

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
