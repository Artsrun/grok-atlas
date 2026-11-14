# Session — GROK.ATLAS

Default is V3 (the window). Instrument is `?v=2`. Same globe, same shaders, same country tap.

Live: https://grok-atlas.vercel.app — production branch `prod`.

## Freeze (2026-09-20)

Do not add helix, geodesic-volume, or NASA EONET until:

1. First photoreal frame (day map) is measured on a phone.
2. The App Builder scaffold (auth / PGlite / P2P) is stripped in its own PR.

Last feature on `prod`: country vitals (flag, TLD, E.164) — 17 Sep.

## 1 · First-frame measure

Marks fire from `markBoot`:

| mark | stage | meaning |
| --- | --- | --- |
| `atlas:gl` | `gl` | first GL clear |
| `atlas:lit` | `day` | day map on the sphere — freeze number |
| `atlas:ready` | `night` | day + night |

Read on the phone (Safari console, after the strip leaves):

```js
window.__atlasMarks
// { gl: 180, lit: 940, ready: 2100 }  // ms from navigation start
```

Protocol: `?tier=low`, cold cache, once on 4G and once on Wi-Fi.
Target to beat later: lit < 1500 on 4G. Do not tune until the table has numbers.

| date | device | net | cache | gl | lit | ready |
| --- | --- | --- | --- | --- | --- | --- |
|  | iPhone · `?tier=low` | 4G | cold |  |  |  |
|  | iPhone · `?tier=low` | wifi | cold |  |  |  |

## Share surface

- Window: https://grok-atlas.vercel.app/?c=Armenia
- Ride: https://grok-atlas.vercel.app/?site=iss
- Instrument: https://grok-atlas.vercel.app/?v=2

## Stale branches (delete after this lands)

`claude/grok-changes-cage-coords-5ya9v8`
`claude/review-improvements-wc75x2`
`feat/device-grain`
`feat/iss-radio-cosmic`
`feat/mobile-boot`
`real-sky`
`v3-quiet`
`v3/quiet-hud`
