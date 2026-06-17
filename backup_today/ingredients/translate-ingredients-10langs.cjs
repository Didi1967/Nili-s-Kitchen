const fs = require("fs");
const path = require("path");

const API_BASE = "http://localhost:3000";

const LANGS = ["en", "tr", "ru", "ar", "es", "pt", "fr", "de", "zh", "ja"];

const TARGET_LANGS = ["de", "zh", "ja"];

const CATEGORY_FILES = [
  "vegetables.json",
  "fruits.json",
  "meat.json",
  "seafood.json",
  "dairy_eggs.json",
  "grains_bakery.json",
  "herbs_spices.json",
  "oils_fats.json",
  "sauces_condiments.json",
  "nuts_seeds.json",
  "sweeteners_baking.json",
  "beverages.json",
  "legumes.json"
];

async function translateBatch(items, lang){
  const res = await fetch(`${API_BASE}/translate-ingredients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items,
      lang
    })
  });

  if(!res.ok){
    throw new Error(`Translate failed ${lang}: ${res.status}`);
  }

  const data = await res.json();

  if(!data || !Array.isArray(data.items)){
    throw new Error(`Invalid translate response for ${lang}`);
  }

  return data.items;
}

async function main(){

  for(const fileName of CATEGORY_FILES){

    const filePath = path.join(__dirname, fileName);

    if(!fs.existsSync(filePath)){
      console.log(`Skip missing: ${fileName}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const ingredients = JSON.parse(raw);

    if(!Array.isArray(ingredients)){
      console.log(`Skip invalid: ${fileName}`);
      continue;
    }

    fs.writeFileSync(
      filePath.replace(".json", ".backup.json"),
      JSON.stringify(ingredients, null, 2),
      "utf8"
    );

    console.log(`\nProcessing ${fileName}: ${ingredients.length}`);

    for(const lang of TARGET_LANGS){

      const missing = ingredients.filter(item => {
        const en = item.name?.en;
        const existing = item.name?.[lang];

        return en && (!existing || existing === en);
      });

      console.log(`${lang} missing: ${missing.length}`);

      const batchSize = 5;

      for(let i = 0; i < missing.length; i += batchSize){

        const batch = missing.slice(i, i + batchSize);
        const texts = batch.map(item => item.name.en);

        console.log(`Translating ${lang}: ${i + 1}-${i + batch.length}`);

        const translated = await translateBatch(texts, lang);

        await new Promise(resolve => setTimeout(resolve, 3000));

        batch.forEach((item, index) => {
          item.name = item.name || {};
          item.name[lang] = translated[index] || item.name.en;
        });
      }
    }

    ingredients.forEach(item => {
      item.name = item.name || {};

      LANGS.forEach(lang => {
        if(!item.name[lang]){
          item.name[lang] = item.name.en || item.id;
        }
      });
    });

    fs.writeFileSync(
      filePath,
      JSON.stringify(ingredients, null, 2),
      "utf8"
    );

    console.log(`Saved ${fileName}`);
  }

  console.log("\n✅ All ingredient files translated to 10 languages.");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
});