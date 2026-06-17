const fs = require('fs');
const path = require('path');

const CATEGORY_FILES = [
  'vegetables','fruits','meat','seafood','dairy_eggs','grains_bakery',
  'legumes','herbs_spices','oils_fats','sauces_condiments','nuts_seeds','sweeteners_baking'
];

const baseDir = __dirname;
const batchPath = path.join(baseDir, 'new-ingredients-batch-2.json');

if(!fs.existsSync(batchPath)){
  console.error('Missing file:', batchPath);
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
const allExistingIds = new Set();
const categoryData = {};

for(const cat of CATEGORY_FILES){
  const file = path.join(baseDir, `${cat}.json`);
  const arr = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  categoryData[cat] = Array.isArray(arr) ? arr : [];
  for(const item of categoryData[cat]){
    if(item && item.id) allExistingIds.add(item.id);
  }
}

const addedByCategory = {};
let added = 0;
let skippedDuplicate = 0;
let skippedInvalid = 0;

for(const item of batch){
  if(!item || !item.id || !item.category || !CATEGORY_FILES.includes(item.category)){
    skippedInvalid++;
    continue;
  }
  if(allExistingIds.has(item.id)){
    console.log('Skip duplicate:', item.id);
    skippedDuplicate++;
    continue;
  }

  const clean = {
    id: item.id,
    category: item.category,
    subcategory: item.subcategory || 'general',
    name: item.name || { en: item.id.replace(/_/g, ' ') },
    aliases: Array.isArray(item.aliases) ? item.aliases : [item.id, item.id.replace(/_/g, ' ')]
  };

  categoryData[item.category].push(clean);
  allExistingIds.add(item.id);
  addedByCategory[item.category] = (addedByCategory[item.category] || 0) + 1;
  added++;
}

for(const cat of CATEGORY_FILES){
  const file = path.join(baseDir, `${cat}.json`);
  categoryData[cat].sort((a,b) => String(a.id).localeCompare(String(b.id)));
  fs.writeFileSync(file, JSON.stringify(categoryData[cat], null, 2), 'utf8');
}

console.log('✅ Added:', added);
console.log('Skipped duplicate:', skippedDuplicate);
console.log('Skipped invalid:', skippedInvalid);
console.log('Added by category:', addedByCategory);
