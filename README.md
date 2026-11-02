# Size It Up: ערי ישראל

A Hebrew (RTL) take on the "Size It Up: Geography" game from [Magnitudle](https://magnitudle.com/size-it-up/geography), using Israeli cities.

A reference city is drawn at true scale. Drag to resize a second city until its north–south length matches reality, then lock in. The true outline is revealed over your guess and you get a score out of 100.

## Play

- **Daily challenge** (default): the same 5 cities for everyone each day (date in `Asia/Jerusalem`). One play per day; progress and a 🔥 streak of consecutive finished days are saved in `localStorage` (a missed day resets it).
- **Free play**: random cities, replay as much as you like.
- **Controls**: drag the red city to move it anywhere (even on top of the blue one) and its ⤢ corner handle to set the length, `↑ ↓ ← →` for fine adjustment, `+` / `−` to zoom.
- **Scoring**: based on the ratio between your guess and the real length (`max/min`), ~91 points for a 10% error, 0 at 2× off.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Next.js (App Router) + Tailwind CSS v4. The whole game is a client component in `app/Game.tsx`; the map is drawn on a `<canvas>`.

## Data

`app/cities.json` holds ~49 simplified municipal boundaries (km-space rings, y down). It is generated, not hand-edited:

```bash
node scripts/fetch-cities.mjs                       # Nominatim -> scripts/raw.json (~1 req/s)
node scripts/build-data.mjs scripts/raw.json        # project to km, drop fragments, simplify -> app/cities.json
```

Edit the city list at the top of `scripts/fetch-cities.mjs` to add or remove cities.

Caveats:
- These are **municipal jurisdiction** boundaries, not built-up areas, so desert towns (Dimona, Arad, Eilat, Mitzpe Ramon) include a lot of empty land.
- "Length" is the north–south extent of the boundary's bounding box.

## Credits

City boundaries © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [ODbL](https://opendatacommons.org/licenses/odbl/). Game concept and look inspired by Magnitudle's Size It Up; this is an unaffiliated fan project.
