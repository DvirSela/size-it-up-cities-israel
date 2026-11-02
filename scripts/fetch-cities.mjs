// Fetch city boundaries from Nominatim -> scripts/raw.json ; run: node scripts/fetch-cities.mjs
import { writeFileSync } from 'node:fs';
const cities = `ירושלים,תל אביב-יפו,חיפה,ראשון לציון,פתח תקווה,אשדוד,נתניה,באר שבע,בני ברק,חולון,רמת גן,אשקלון,רחובות,בת ים,בית שמש,כפר סבא,הרצליה,חדרה,מודיעין-מכבים-רעות,לוד,רמלה,נצרת,עכו,רעננה,אילת,טבריה,צפת,קריית שמונה,עפולה,נהריה,כרמיאל,דימונה,ערד,יבנה,נס ציונה,אור יהודה,הוד השרון,קריית גת,בית שאן,טירת כרמל,קריית אתא,קריית ביאליק,קריית מוצקין,קריית ים,שדרות,נתיבות,אופקים,מצפה רמון,רמת השרון,גבעתיים,אור עקיבא,קיסריה`.split(',');
const out = {};
for (const name of cities) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', ישראל')}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0003&limit=5&accept-language=he`;
  const r = await (await fetch(url, { headers: { 'User-Agent': 'size-it-up-il/0.1 (personal project)' } })).json();
  const hit = r.find(x => x.category === 'boundary' && /Polygon/.test(x.geojson?.type));
  if (hit) { out[name] = { osm: hit.osm_id, display: hit.display_name, geometry: hit.geojson }; console.log('ok  ', name); }
  else console.log('MISS', name, r.map(x => x.category + '/' + x.type).join(' '));
  await new Promise(s => setTimeout(s, 1100));
}
writeFileSync(new URL('./raw.json', import.meta.url), JSON.stringify(out));
