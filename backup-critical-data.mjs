import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageRoot = path.resolve(process.env.NILI_STORAGE_ROOT || __dirname);
const backupRoot = path.resolve(
  process.env.NILI_BACKUP_ROOT || path.join(storageRoot, "data-backups")
);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const snapshotRoot = path.join(backupRoot, "critical-snapshots", timestamp);
const mediaBackupRoot = path.join(backupRoot, "media-mirror");

const dataFiles = [
  path.join("approved-recipes", "approved_recipes.json"),
  path.join("pending-recipes", "pending_recipes.json"),
  path.join("recipe-catalog", "catalog.json"),
  path.join("data", "favorites.json")
];

const mediaDirs = [
  "recipe-import-images",
  path.join("optimized-images", "recipe-import"),
  "creator-uploads",
  path.join("optimized-images", "creator")
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfChanged(source, destination) {
  const sourceStat = fs.statSync(source);
  if (fs.existsSync(destination)) {
    const destinationStat = fs.statSync(destination);
    if (
      sourceStat.size === destinationStat.size &&
      Math.trunc(sourceStat.mtimeMs) === Math.trunc(destinationStat.mtimeMs)
    ) {
      return false;
    }
  }

  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
  fs.utimesSync(destination, sourceStat.atime, sourceStat.mtime);
  return true;
}

function mirrorDirectory(sourceRoot, destinationRoot) {
  const result = { scanned: 0, copied: 0, bytes: 0 };
  if (!fs.existsSync(sourceRoot)) return result;

  function visit(current) {
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const source = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(source);
        return;
      }
      if (!entry.isFile()) return;

      const relative = path.relative(sourceRoot, source);
      const destination = path.join(destinationRoot, relative);
      const stat = fs.statSync(source);
      result.scanned += 1;
      result.bytes += stat.size;
      if (copyFileIfChanged(source, destination)) result.copied += 1;
    });
  }

  visit(sourceRoot);
  return result;
}

ensureDir(snapshotRoot);
ensureDir(mediaBackupRoot);

const copiedData = [];
for (const relative of dataFiles) {
  const source = path.join(storageRoot, relative);
  if (!fs.existsSync(source)) continue;
  const destination = path.join(snapshotRoot, relative);
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
  copiedData.push(relative);
}

const media = {};
for (const relative of mediaDirs) {
  media[relative.replaceAll("\\", "/")] = mirrorDirectory(
    path.join(storageRoot, relative),
    path.join(mediaBackupRoot, relative)
  );
}

const manifest = {
  createdAt: new Date().toISOString(),
  storageRoot,
  backupRoot,
  copiedData,
  media
};

fs.writeFileSync(
  path.join(snapshotRoot, "backup-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log(JSON.stringify(manifest, null, 2));
