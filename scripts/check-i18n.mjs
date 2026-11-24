// Vérifie que fr.json et en.json ont les mêmes clés et que chaque t("...") du code existe.
import { readFileSync, readdirSync } from "node:fs";
const load = (l) => JSON.parse(readFileSync(new URL(`../src/locales/${l}.json`, import.meta.url), "utf8"));
const fr = load("fr"), en = load("en");
let bad = 0;
for (const k of Object.keys(fr)) if (!(k in en)) { console.error("manque en EN :", k); bad++; }
for (const k of Object.keys(en)) if (!(k in fr)) { console.error("manque en FR :", k); bad++; }
for (const [k, v] of Object.entries(en)) if (!v.trim()) { console.error("vide en EN :", k); bad++; }
const dir = new URL("../src/", import.meta.url);
for (const f of readdirSync(dir).filter((x) => /\.(tsx?|ts)$/.test(x))) {
  const src = readFileSync(new URL(f, dir), "utf8");
  for (const m of src.matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)) if (!(m[1] in fr)) { console.error(`${f} : clé inconnue`, m[1]); bad++; }
}
if (bad) process.exit(1);
console.log(`i18n ok : ${Object.keys(fr).length} clés, FR et EN identiques`);
