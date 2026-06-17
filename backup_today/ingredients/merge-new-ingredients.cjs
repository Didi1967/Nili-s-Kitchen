const fs = require("fs");
const path = require("path");

const NEW_FILE = "new-ingredients-50.json";

const CATEGORY_MAP = {
  vegetables: "vegetables.json",
  fruits: "fruits.json",
  legumes: "legumes.json",
  meat: "meat.json",
  seafood: "seafood.json",
  dairy_eggs: "dairy_eggs.json",
  grains_bakery: "grains_bakery.json",
  herbs_spices: "herbs_spices.json",
  oils_fats: "oils_fats.json",
  sauces_condiments: "sauces_condiments.json",
  nuts_seeds: "nuts_seeds.json",
  sweeteners_baking: "sweeteners_baking.json",
  beverages: "beverages.json"
};

const newItems = JSON.parse(
  fs.readFileSync(path.join(__dirname, NEW_FILE), "utf8")
);

let added = 0;

for (const item of newItems) {

  const targetFile = CATEGORY_MAP[item.category];

  if (!targetFile) {
    console.log(`Unknown category: ${item.category}`);
    continue;
  }

  const filePath = path.join(__dirname, targetFile);

  const items = JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );

  const exists = items.find(x => x.id === item.id);

  if (exists) {
    console.log(`Skip duplicate: ${item.id}`);
    continue;
  }

  items.push(item);

  fs.writeFileSync(
    filePath,
    JSON.stringify(items, null, 2),
    "utf8"
  );

  added++;
}

console.log(`✅ Added: ${added}`);