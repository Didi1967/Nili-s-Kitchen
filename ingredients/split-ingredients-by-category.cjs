const fs = require("fs");
const path = require("path");

const baseDir = __dirname;
const sourceFile = path.join(baseDir, "ingredients-v2.js");

const CATEGORY_FILES = {
  vegetables: "vegetables.json",
  fruits: "fruits.json",
  meat: "meat.json",
  seafood: "seafood.json",
  dairy_eggs: "dairy_eggs.json",
  grains_bakery: "grains_bakery.json",
  herbs_spices: "herbs_spices.json",
  oils_fats: "oils_fats.json",
  sauces_condiments: "sauces_condiments.json",
  nuts_seeds: "nuts_seeds.json",
  sweeteners_baking: "sweeteners_baking.json",
  beverages: "beverages.json",
  legumes: "legumes.json"
};

let raw = fs.readFileSync(sourceFile, "utf8");

// yorumları temizle
raw = raw.replace(/\/\*[\s\S]*?\*\//g, "").trim();

// ilk array'i bul
const firstBracket = raw.indexOf("[");
const endMarker = raw.indexOf("];", firstBracket);

if(firstBracket === -1 || endMarker === -1){
  throw new Error("Ingredient array bulunamadı.");
}

raw = raw.slice(firstBracket, endMarker + 1).trim();

const ingredients = JSON.parse(raw);

const buckets = {};
Object.keys(CATEGORY_FILES).forEach(category => {
  buckets[category] = [];
});

const unknown = [];

ingredients.forEach(item => {
  const category = item.category || "unknown";

  if(buckets[category]){
    buckets[category].push(item);
  } else {
    unknown.push(item);
  }
});

Object.entries(CATEGORY_FILES).forEach(([category, fileName]) => {
  fs.writeFileSync(
    path.join(baseDir, fileName),
    JSON.stringify(buckets[category], null, 2),
    "utf8"
  );

  console.log(`${category}: ${buckets[category].length}`);
});

if(unknown.length){
  fs.writeFileSync(
    path.join(baseDir, "unknown.json"),
    JSON.stringify(unknown, null, 2),
    "utf8"
  );

  console.log(`unknown: ${unknown.length}`);
}

console.log("✅ Ingredients split by category completed."); 