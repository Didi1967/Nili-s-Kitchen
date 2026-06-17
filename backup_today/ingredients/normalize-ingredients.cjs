const fs = require("fs");
const path = require("path");

const LANGS = ["en", "tr", "ru", "ar", "es", "pt", "fr", "de", "zh", "ja"];

const filePath = path.join(__dirname, "ingredients-v2.json");
const backupPath = path.join(__dirname, "ingredients-v2.backup.json");

function slugify(text){
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const raw = fs.readFileSync(filePath, "utf8");
const data = JSON.parse(raw);

const ingredients = Array.isArray(data)
  ? data
  : Object.values(data.ingredients || data);

fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), "utf8");

const today = new Date().toISOString().slice(0, 10);

const normalized = ingredients.map((item) => {
  const enName =
    item.name?.en ||
    item.en ||
    item.id ||
    "unknown";

  const id =
    item.id ||
    slugify(enName);

  const name = item.name || {};

  LANGS.forEach(lang => {
    if(!name[lang]){
      name[lang] = name.en || enName;
    }
  });

  const aliasesSet = new Set();

  aliasesSet.add(id);
  Object.values(name).forEach(v => {
    if(v) aliasesSet.add(String(v));
  });

  (item.aliases || []).forEach(v => {
    if(v) aliasesSet.add(String(v));
  });

  return {
    id,
    category: item.category || "uncategorized",
    subcategory: item.subcategory || "general",
    name,
    aliases: Array.from(aliasesSet),
    tags: Array.isArray(item.tags) ? item.tags : [],
    active: item.active !== false,
    priority: typeof item.priority === "number" ? item.priority : 50,
    source: item.source || "system",
    createdAt: item.createdAt || today,
    updatedAt: today
  };
});

fs.writeFileSync(
  filePath,
  JSON.stringify(normalized, null, 2),
  "utf8"
);

console.log("✅ ingredients-v2 normalized");
console.log("Total:", normalized.length);
console.log("Backup:", backupPath);