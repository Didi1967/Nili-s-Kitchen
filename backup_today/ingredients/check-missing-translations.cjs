const fs = require("fs");
const path = require("path");

const LANGS = ["en", "tr", "ru", "ar", "es", "pt", "fr", "de", "zh", "ja"];

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

let total = 0;

for(const fileName of CATEGORY_FILES){

  const filePath = path.join(__dirname, fileName);

  if(!fs.existsSync(filePath)) continue;

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));

  console.log(`\n${fileName}: ${items.length}`);
  total += items.length;

  LANGS.forEach(lang => {
    const missing = items.filter(item =>
      !item.name ||
      !item.name[lang] ||
      String(item.name[lang]).trim() === ""
    );

    if(missing.length){
      console.log(`${lang} missing: ${missing.length}`);
    }
  });
}

console.log(`\nTOTAL INGREDIENTS: ${total}`);