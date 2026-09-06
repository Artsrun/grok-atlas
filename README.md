# GROK.ATLAS

Photoreal Earth from the ISS cupola — day/night terminator, city lights, clouds, atmosphere — with a country cascade overlay you can assign, solve, and share.

Tap a country to cycle **defender / attacker / neutral**. The field solves in three passes: committed poles pull undecided states across an affinity space (NATO, CSTO, SCO, Arab League, nuclear, mass). Hot nuclear states light up when the score crosses threshold.

Home camera is the Nile Delta / Eastern Mediterranean — the cupola night-limb frame.

## Controls

- **Orbit** — drag. Pinch / wheel to zoom
- **Country** — tap to cycle role, or search in the panel
- **Preset** — North Korea vs South Korea, USA vs Russia, USA vs China, …
- **Layers** — atmosphere, clouds, borders, cage, ISS, cupola vignette, auto-sun, auto-rotate
- **Share** — copies `?d=…&a=…&n=…` so a field state is a URL
- **Device tilt** — optional gyroscope on the rig (phone)

```
?d=Ukraine&a=Russia
?d=Taiwan|Japan&a=China
```

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
