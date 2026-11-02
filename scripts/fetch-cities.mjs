// Fetch city boundaries from Nominatim -> scripts/raw.json ; run: node scripts/fetch-cities.mjs
import { writeFileSync } from 'node:fs';
const cities = [...new Set(`ירושלים,תל אביב-יפו,חיפה,ראשון לציון,פתח תקווה,אשדוד,נתניה,באר שבע,בני ברק,חולון,רמת גן,אשקלון,רחובות,בת ים,בית שמש,כפר סבא,הרצליה,חדרה,מודיעין-מכבים-רעות,לוד,רמלה,נצרת,עכו,רעננה,אילת,טבריה,צפת,קריית שמונה,עפולה,נהריה,כרמיאל,דימונה,ערד,יבנה,נס ציונה,אור יהודה,הוד השרון,קריית גת,בית שאן,טירת כרמל,קריית אתא,קריית ביאליק,קריית מוצקין,קריית ים,שדרות,נתיבות,אופקים,מצפה רמון,רמת השרון,גבעתיים,אור עקיבא,קיסריה,מטולה,שלומי,מעלות-תרשיחא,חצור הגלילית,ראש פינה,קצרין,יסוד המעלה,מגדל העמק,נוף הגליל,יקנעם עילית,קריית טבעון,נשר,זכרון יעקב,עתלית,חריש,פרדס חנה-כרכור,בנימינה-גבעת עדה,כפר תבור,מגדל,ירוחם,להבים,עומר,מיתר,אלעד,שוהם,מבשרת ציון,צור הדסה,גבעת שמואל,קריית אונו,יהוד-מונוסון,גני תקווה,אזור,סביון,כפר שמריהו,כוכב יאיר,קדימה-צורן,תל מונד,אבן יהודה,כפר יונה,גן יבנה,גדרה,מזכרת בתיה,קריית עקרון,קריית מלאכי,באר יעקב,בית דגן,ראש העין,פרדסיה,אום אל-פחם,רהט,טייבה,שפרעם,סח'נין`.split(',').map(x=>x.trim()))];
const out = {};
for (const name of cities) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', ישראל')}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0003&limit=5&accept-language=he`;
  const r = await (await fetch(url, { headers: { 'User-Agent': 'size-it-up-il/0.1 (personal project)' } })).json();
  const hit = r.find(x => x.category === 'boundary' && /Polygon/.test(x.geojson?.type));
  if (hit) { out[name] = { osm: hit.osm_id, display: hit.display_name, geometry: hit.geojson }; console.log('ok  ', name, '|', hit.addresstype, '|', hit.display_name.split(',').slice(0,3).join(',')); }
  else console.log('MISS', name, r.map(x => x.category + '/' + x.type).join(' '));
  await new Promise(s => setTimeout(s, 1100));
}
writeFileSync(new URL('./raw.json', import.meta.url), JSON.stringify(out));
