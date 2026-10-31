import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(__filename);
const optimizedRoot = path.join(root, "optimized-images");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const concurrency = Math.max(1, Number(process.env.IMAGE_OPTIMIZE_CONCURRENCY || 3));

const sourceSets = [
  {
    name: "recipe-import",
    sourceDir: path.join(root, "recipe-import-images"),
    sourceUrl: "/recipe-import-images/",
    outputDir: path.join(optimizedRoot, "recipe-import"),
    outputUrl: "/optimized-images/recipe-import/"
  },
  {
    name: "creator",
    sourceDir: path.join(root, "creator-uploads"),
    sourceUrl: "/creator-uploads/",
    outputDir: path.join(optimizedRoot, "creator"),
    outputUrl: "/optimized-images/creator/"
  },
  {
    name: "site",
    sourceDir: root,
    sourceUrl: "/",
    outputDir: path.join(optimizedRoot, "site"),
    outputUrl: "/optimized-images/site/",
    filter: file => file.toLowerCase() !== "logo.jpeg"
  }
];

function listImages(set) {
  if (!fs.existsSync(set.sourceDir)) return [];
  return fs.readdirSync(set.sourceDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(file => imageExtensions.has(path.extname(file).toLowerCase()))
    .filter(file => !set.filter || set.filter(file))
    .map(file => ({ set, file }));
}

function outputFileName(file) {
  return `${file}.webp`;
}

async function optimizeOne({ set, file }) {
  fs.mkdirSync(set.outputDir, { recursive: true });
  const input = path.join(set.sourceDir, file);
  const outputName = outputFileName(file);
  const output = path.join(set.outputDir, outputName);
  const inputStat = fs.statSync(input);

  if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= inputStat.mtimeMs) {
    return { set, file, outputName, originalBytes: inputStat.size, optimizedBytes: fs.statSync(output).size, skipped: true };
  }

  await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4, smartSubsample: true })
    .toFile(output);

  return { set, file, outputName, originalBytes: inputStat.size, optimizedBytes: fs.statSync(output).size, skipped: false };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { ...items[index], error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function addUrlVariants(mapping, sourceUrl, outputUrl, file, outputName) {
  const target = `${outputUrl}${outputName}`;
  mapping.set(`${sourceUrl}${file}`, target);
  mapping.set(`${sourceUrl.replace(/^\//, "")}${file}`, target);
  if (sourceUrl === "/") mapping.set(file, target);
}

function migrateRecipe(recipe, mapping) {
  let changed = false;
  const migrateValue = value => {
    if (typeof value !== "string") return value;
    const replacement = mapping.get(value);
    if (!replacement) return value;
    changed = true;
    return replacement;
  };

  if (recipe.mediaUrl) {
    const old = recipe.mediaUrl;
    recipe.mediaUrl = migrateValue(old);
    if (recipe.mediaUrl !== old && !recipe.originalMediaUrl) recipe.originalMediaUrl = old;
  }
  if (Array.isArray(recipe.mediaUrls)) {
    const old = [...recipe.mediaUrls];
    recipe.mediaUrls = recipe.mediaUrls.map(migrateValue);
    if (recipe.mediaUrls.some((value, index) => value !== old[index]) && !recipe.originalMediaUrls) recipe.originalMediaUrls = old;
  }
  if (recipe.image) {
    const old = recipe.image;
    recipe.image = migrateValue(old);
    if (recipe.image !== old && !recipe.originalImage) recipe.originalImage = old;
  }
  if (recipe.fullImage) recipe.fullImage = migrateValue(recipe.fullImage);
  return changed;
}

function migrateJsonFile(file, mapping, backupDir) {
  if (!fs.existsSync(file)) return { file, changed: 0 };
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return { file, changed: 0 };
  let changed = 0;
  for (const recipe of data) if (recipe && typeof recipe === "object" && migrateRecipe(recipe, mapping)) changed += 1;
  if (!changed) return { file, changed: 0 };
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  const temp = `${file}.image-opt.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  fs.copyFileSync(temp, file);
  fs.unlinkSync(temp);
  return { file, changed };
}

const jobs = sourceSets.flatMap(listImages);
console.log(`Optimizing ${jobs.length} images with concurrency ${concurrency}...`);
const results = await mapLimit(jobs, concurrency, optimizeOne);
const successful = results.filter(result => result && !result.error);
const failures = results.filter(result => result?.error);
const mapping = new Map();

for (const result of successful) {
  addUrlVariants(mapping, result.set.sourceUrl, result.set.outputUrl, result.file, result.outputName);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(root, "image-optimization-backups", timestamp);
const jsonFiles = [
  path.join(root, "approved-recipes", "approved_recipes.json"),
  path.join(root, "pending-recipes", "pending_recipes.json"),
  path.join(root, "recipe-catalog", "catalog.json")
];
const migrations = jsonFiles.map(file => migrateJsonFile(file, mapping, backupDir));

const originalBytes = successful.reduce((sum, item) => sum + item.originalBytes, 0);
const optimizedBytes = successful.reduce((sum, item) => sum + item.optimizedBytes, 0);
const manifest = {
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  imageCount: successful.length,
  failedCount: failures.length,
  originalBytes,
  optimizedBytes,
  savedBytes: originalBytes - optimizedBytes,
  migrations,
  failures: failures.map(item => ({ set: item.set?.name, file: item.file, error: item.error })),
  mapping: Object.fromEntries([...mapping.entries()].filter(([key]) => key.startsWith("/")))
};
fs.mkdirSync(optimizedRoot, { recursive: true });
fs.writeFileSync(path.join(optimizedRoot, "image-optimization-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

console.log(JSON.stringify({
  images: manifest.imageCount,
  failed: manifest.failedCount,
  originalMB: Math.round(originalBytes / 1024 / 1024),
  optimizedMB: Math.round(optimizedBytes / 1024 / 1024),
  savedMB: Math.round((originalBytes - optimizedBytes) / 1024 / 1024),
  migratedRecords: migrations.reduce((sum, item) => sum + item.changed, 0),
  backupDir: migrations.some(item => item.changed) ? backupDir : null
}, null, 2));
