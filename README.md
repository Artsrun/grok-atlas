# GROK.ATLAS

Photoreal Earth from the ISS cupola. One custom Earth shader — not a map engine. Day/night terminator, city lights, clouds, airglow limb, tides, a 30° cage, and a seat on the station.

Home camera is the Nile Delta / Eastern Mediterranean — the cupola night-limb frame.

Quiet edition is the default (the window). `?v=2` is the instrument.

## Controls

- **Orbit** — drag. Pinch / wheel to zoom. Touch gets a heavier throw and a larger tap slop so a drag does not pick a country.
- **Phone** — two thumb buttons at the bottom: Locate and Toolbox. The toolbox is a short tray with four tabs — **Go** (views, find a country, copy the view), **Show** (layers), **Time**, **Look** (sliders, tide, tilt) — because the tray gets 317 px on a phone and the sections stacked came to 1,258. Tap the handle or pull it down to close; pull up and it stays.
- **Desktop** — right rail, hover tips, pointer section. The rail is 320px of opaque panel over a third of the globe, so it collapses: click the edge grab or press `T`, and the globe gets the whole window back. It scrolls, and fades its bottom edge only while there is more below.
- **Time** — one clock drives the terminator, the moon phase and the station. Hold it, run it at a minute, an hour or twelve hours a second, forwards or back, scrub ±12 h by hand, jump a day, or press `now` to fall back into the real sky. The clock is gold whenever it is not the real one.
- **Keys** (desktop) — `T` toolbox, `L` locate, `I` ISS ride, `Space` hold time, `,` `.` scrub an hour, `N` back to now, `Esc` leave the ride then close the toolbox. Nothing fires while a field has focus, so `find country` still takes an `i`.
- **Country** — tap one and it fills in: the outline lights, the wash lands, and a sheet gives its name, its capital in white, and one true line about that capital. Tap the capital to fly to it. On a mouse, the country under the cursor lights its own outline before you click.
- **Rivers** — the twelve great rivers, drawn as ribbons with the current running down them. Natural Earth digitises a centreline from source to mouth, so the vertex order *is* the flow: the pulses on the Nile run north and the ones on the Congo run west because that is what the data says.
- **Views** — Europe, Americas, West Pacific, Moon stand, ISS ride
- **ISS ride** — the camera takes the station: cupola glass, ground track running out ahead, live lat / lon / altitude / velocity under the caption. `ISS` on the dock, `iss ride` in the toolbox, `?site=iss` in a link. Any country tap or view leaves the ride and flies back out.
- **Geo net** — 30° graticule with the degree readings written on it (`30°N`, `60°E`). Every reading is one quad in one buffer, billboarded in the vertex shader, so the whole set costs one draw call.
- **Cage** — the geodesic shell, on its own switch. It is chrome with no scale on it; the net is how you read a longitude, and one switch for both meant nobody could have just one.
- **Layers** — grouped by what they answer: on the earth (borders, rivers, clouds, tides), around it (atmosphere, moon, ISS, ISS ride), grid and frame (geo net, cage, cupola, orbit)
- **Grain** — city lights and relief pick up a heavy ISS-style grain on new GPUs (Apple M / A15+, Adreno 6xx+, RTX). Older / software GL stays smooth. Force a path with `?tier=high|mid|low`.
- **Share** — copies `?c=Armenia`, `?site=nile` or `?site=iss`, plus `?t=` when the clock is off the real sky: a link carries the instant as well as the place.

## Loading

The globe is not gated on countries JSON. Canvas first, then the day map (first photoreal frame), then city lights (overlay leaves), then relief / clouds / atlas in the background. Low-tier devices skip spec/normal/clouds after lights so the first second stays cheap.

Day and night maps are `rel="preload"` in the document head, and the atlas chunk is requested when the route module evaluates rather than when the component mounts — the textures come down the same connection as the code instead of queueing behind it.

Nothing that fails is silent and nothing hangs: a stage that will not arrive still completes the strip, and leaves one line naming what the globe is now missing. A strip that has not moved for seven seconds says so.

## Night side

City lights are lamps, not a texture wash. The terminator is taken from the
geometric normal, so relief grain cannot chew holes in it; lamps come up through
civil twilight and are full by nautical dark rather than cross-fading against
daylight; sodium warms the outskirts and arclight cools the cores; and above the
compat tier four taps of the night map put the haze a city throws into its own
air around the bright ones. The night map's dim albedo floor — sensor noise over
empty land, which used to wash the Sahara violet — is gated out. Day and night
add rather than cross-fade, so dusk shows the half hour where the ground is
still lit and the lamps are already on, and a full moon puts a little blue-grey
back on cloud tops, scaled by the phase it is actually at.

## Country data

Two files under `public/geo/`, built by `node scripts/build-atlas-data.mjs` and
committed:

| File | What | Size |
| --- | --- | --- |
| `country-facts.json` | capital, its coordinates and metro population, region, area, land neighbours — for all 177 countries in the topology | 32 KB |
| `rivers.json` | twelve great rivers, each a single course from source to mouth | 19 KB |

Capitals come from Natural Earth's populated-places layer, which is the same
source family as the outlines, so the country names join without guesswork.
Region and area come from `world-countries`, a dev dependency the app never
ships. Seven entries have no capital — Antarctica and six dependencies that the
110m places layer gives no Admin-0 capital, which is true rather than invented.

Capital stories live in `src/lib/atlas/stories.ts`, keyed by ISO 3166-1 alpha-3,
and cover about half the map. A capital without one shows the measured line
instead: region, area, neighbours. An empty space is better than an invented
sentence.

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
