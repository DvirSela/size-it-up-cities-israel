// raw.json (Nominatim polygons) -> app/cities.json (km-space rings, y down, bbox top-left = 0,0)
// usage: node scripts/build-data.mjs <raw.json>   (raw.json comes from scripts/fetch-cities.mjs)
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0)) / 2;

function dp(pts, tol) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  let dmax = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1e-9);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

function simplifyRing(r, tol) { // closed ring: split at the point farthest from the start, simplify both halves
  let far = 1;
  for (let i = 2; i < r.length - 1; i++) if (Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]) > Math.hypot(r[far][0] - r[0][0], r[far][1] - r[0][1])) far = i;
  return [...dp(r.slice(0, far + 1), tol).slice(0, -1), ...dp(r.slice(far), tol).slice(0, -1)];
}

const out = [];
for (const [name, { geometry }] of Object.entries(raw)) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const all = polys.flat(2);
  const lat0 = (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2;
  const proj = ([lon, lat]) => [lon * Math.cos((lat0 * Math.PI) / 180) * 111.32, -lat * 110.574];
  let parts = polys.map((rings) => rings.map((r) => r.map(proj)));
  const total = parts.reduce((s, p) => s + area(p[0]), 0);
  parts = parts.filter((p) => area(p[0]) > total * 0.01); // drop tiny fragments
  const pts = parts.flat(2);
  const minX = Math.min(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1]));
  const h = Math.max(...pts.map((p) => p[1])) - minY, w = Math.max(...pts.map((p) => p[0])) - minX;
  const tol = h * 0.004;
  const rings = parts.flatMap((p) => p.map((r) => simplifyRing(r, tol).map(([x, y]) => [+(x - minX).toFixed(3), +(y - minY).toFixed(3)])).filter((r) => r.length > 3));
  out.push({ name, h: +h.toFixed(2), w: +w.toFixed(2), rings });
}
writeFileSync('app/cities.json', JSON.stringify(out));
console.log(out.map((c) => `${c.name} ${c.h}x${c.w}km ${c.rings.reduce((s, r) => s + r.length, 0)}pts`).join('\n'));
