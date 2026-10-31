import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import crypto from "crypto";
import sharp from "sharp";
import { spawn } from "node:child_process";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

// Local/admin frontend entry points. Keep these explicit so the project root,
// environment files and protected recipe JSON are never exposed as static files.
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/nili-typography.css", (req, res) => {
  res.sendFile(path.join(__dirname, "nili-typography.css"));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_ROOT = path.resolve(process.env.NILI_STORAGE_ROOT || __dirname);
const storagePath = (...parts) => path.join(STORAGE_ROOT, ...parts);
const uploadTempDir = storagePath("uploads");
const protectedDataRoot = path.resolve(
  process.env.NILI_BACKUP_ROOT || storagePath("data-backups")
);
const protectionManifestFile = path.join(protectedDataRoot, "manifest.json");
const professionalExcelRoot = storagePath("excel-master");
const professionalExcelMasterFile = path.join(
  professionalExcelRoot,
  "nilis-kitchen-professional-master.xlsx"
);
const configuredApprovedMinimum = Math.max(
  0,
  Number(process.env.NILI_APPROVED_MIN_COUNT || 700)
);

fs.mkdirSync(uploadTempDir, { recursive: true });
fs.mkdirSync(protectedDataRoot, { recursive: true });
fs.mkdirSync(professionalExcelRoot, { recursive: true });

function safeBackupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupId() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

function safeArchiveName(value, fallback = "file") {
  const clean = String(value || fallback)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return clean || fallback;
}

function archiveUploadedExcel(file) {
  if (!file?.path || !fs.existsSync(file.path)) return null;
  const id = backupId();
  const archiveDir = path.join(protectedDataRoot, "excel-imports");
  fs.mkdirSync(archiveDir, { recursive: true });
  const originalName = safeArchiveName(file.originalname, "recipes.xlsx");
  const archiveName = `IMPORT_${safeBackupTimestamp()}_${id}_${originalName}`;
  const archivePath = path.join(archiveDir, archiveName);
  fs.copyFileSync(file.path, archivePath);
  return { id, name: archiveName, path: archivePath };
}

function readJsonArrayStrict(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Protected data is not an array: ${file}`);
  }
  return parsed;
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), "utf8");
  try {
    fs.renameSync(tempFile, file);
  } catch (error) {
    fs.copyFileSync(tempFile, file);
    fs.unlinkSync(tempFile);
  }
}

function readProtectionManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(protectionManifestFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProtectionManifest(patch) {
  const next = {
    ...readProtectionManifest(),
    ...patch,
    updatedAt: new Date().toISOString(),
    storageRoot: STORAGE_ROOT
  };
  writeJsonAtomic(protectionManifestFile, next);
  return next;
}

function protectedBackupDir(dataset) {
  const dir = path.join(protectedDataRoot, dataset);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createProtectedSnapshot(file, dataset, reason = "update") {
  if (!fs.existsSync(file)) return "";
  const current = readJsonArrayStrict(file);
  const safeReason = String(reason || "update").replace(/[^a-z0-9_-]+/gi, "-");
  const snapshot = path.join(
    protectedBackupDir(dataset),
    `${safeBackupTimestamp()}-${current.length}-${safeReason}.json`
  );
  fs.copyFileSync(file, snapshot);
  return snapshot;
}

function validProtectedSnapshots(dataset) {
  return fs.readdirSync(protectedBackupDir(dataset))
    .filter(name => name.endsWith(".json"))
    .sort()
    .reverse()
    .map(name => path.join(protectedBackupDir(dataset), name))
    .filter(file => {
      try {
        readJsonArrayStrict(file);
        return true;
      } catch {
        return false;
      }
    });
}

function hasProtectedSnapshot(dataset) {
  return fs.readdirSync(protectedBackupDir(dataset))
    .some(name => name.endsWith(".json"));
}

function recoverProtectedArray(file, dataset, minimumCount = 0) {
  const snapshot = validProtectedSnapshots(dataset).find(candidate =>
    readJsonArrayStrict(candidate).length >= minimumCount
  );
  if (!snapshot) {
    throw new Error(`No valid ${dataset} backup with at least ${minimumCount} records`);
  }
  const recovered = readJsonArrayStrict(snapshot);
  writeJsonAtomic(file, recovered);
  console.error(`PROTECTED DATA RECOVERED: ${dataset} from ${snapshot}`);
  return recovered;
}

function readProtectedArray(file, dataset, { minimumCount = 0 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    if (minimumCount > 0) {
      return recoverProtectedArray(file, dataset, minimumCount);
    }
    writeJsonAtomic(file, []);
  }

  let records;
  try {
    records = readJsonArrayStrict(file);
  } catch (error) {
    console.error(`PROTECTED DATA READ FAILED: ${dataset}:`, error.message);
    return recoverProtectedArray(file, dataset, minimumCount);
  }

  if (records.length < minimumCount) {
    console.error(
      `PROTECTED DATA COUNT DROP BLOCKED: ${dataset} ${records.length} < ${minimumCount}`
    );
    return recoverProtectedArray(file, dataset, minimumCount);
  }

  if (!hasProtectedSnapshot(dataset) && records.length) {
    createProtectedSnapshot(file, dataset, "baseline");
  }
  return records;
}

function writeProtectedArray(file, records, dataset, {
  preventDecrease = false,
  reason = "update",
  snapshot = true
} = {}) {
  if (!Array.isArray(records)) {
    throw new Error(`${dataset} write rejected: data must be an array`);
  }

  const manifest = readProtectionManifest();
  const floorKey = `${dataset}Floor`;
  const recordedFloor = Number(manifest[floorKey] || 0);
  let current = [];

  if (fs.existsSync(file)) {
    current = readProtectedArray(file, dataset, {
      minimumCount: preventDecrease ? recordedFloor : 0
    });
  }

  const protectedMinimum = preventDecrease
    ? Math.max(recordedFloor, current.length)
    : 0;

  if (preventDecrease && records.length < protectedMinimum) {
    throw new Error(
      `${dataset} count decrease blocked: ${protectedMinimum} -> ${records.length}`
    );
  }

  if (snapshot && current.length) {
    createProtectedSnapshot(file, dataset, reason);
  }
  writeJsonAtomic(file, records);

  const manifestPatch = {
    [`${dataset}Count`]: records.length,
    [`${dataset}LastReason`]: reason,
    [`${dataset}LastWriteAt`]: new Date().toISOString()
  };
  if (preventDecrease) {
    manifestPatch[floorKey] = Math.max(protectedMinimum, records.length);
  }
  writeProtectionManifest(manifestPatch);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BONUS_PER_CLICK = Number(process.env.BONUS_PER_CLICK || 0.01);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb", parameterLimit: 200 }));

const allowedBrowserOrigins = new Set([
  "https://niliskitchen.com",
  "https://www.niliskitchen.com"
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedBrowserOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
}));

function createIpRateLimiter({ windowMs, max, message }) {
  const entries = new Map();
  let lastCleanup = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastCleanup > windowMs) {
      for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
      lastCleanup = now;
    }
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    entries.set(key, entry);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, error: message || "Too many requests" });
    }
    next();
  };
}

app.use("/admin/login", createIpRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, message: "Too many login attempts" }));
app.use("/creator-auth", createIpRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many authentication attempts" }));
app.use(["/contact-message", "/send-error-alert"], createIpRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, message: "Too many messages" }));
app.use(["/analyze", "/creator/parse-recipe"], createIpRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, message: "Too many image analysis requests" }));
app.use("/upload-creator-media-chunk", createIpRateLimiter({ windowMs: 15 * 60 * 1000, max: 150, message: "Too many upload requests" }));
app.use(["/translate-ingredients", "/normalize-ingredient", "/normalize-ingredients", "/localize-recipe-detail", "/discover-recipes", "/recipes", "/meal-plan", "/nili-assistant"], createIpRateLimiter({ windowMs: 10 * 60 * 1000, max: 120, message: "Too many API requests" }));

 

console.log("SMTP HOST:", process.env.SMTP_HOST);
console.log("SMTP USER:", process.env.SMTP_USER);
console.log("SMTP PORT:", process.env.SMTP_PORT);

function setPublicMediaHeaders(res) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

app.use(
  "/optimized-images",
  express.static(storagePath("optimized-images"), {
    maxAge: "1h",
    setHeaders: setPublicMediaHeaders
  })
);

app.use(
  "/recipe-posters",
  express.static(path.join(__dirname, "recipe-posters"), {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    maxAge: "1h",
    setHeaders: setPublicMediaHeaders
  })
);

app.use(
  "/flags",
  express.static(path.join(__dirname, "flags"))
);

app.use(
  "/assets/fonts",
  express.static(path.join(__dirname, "assets", "fonts"), {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    maxAge: "7d"
  })
);

app.use(
  "/creator-uploads",
  express.static(storagePath("creator-uploads"))
);

app.use(
  "/recipe-import-images",
  express.static(storagePath("recipe-import-images"))
);

// Local development uses a single origin: the website and API both run on
// http://localhost:3000. Keep production's API-only root unchanged because
// the public website is hosted separately there.
const servesLocalWebsite = process.platform === "win32" && process.env.NODE_ENV !== "production";

if (servesLocalWebsite) {
  const localWebsiteFiles = [
    "index.html",
    "creator-dashboard.html",
    "creator.html",
    "ebook-builder.html",
    "how-it-works.html",
    "meal-plan.html",
    "nili-archive.html",
    "world-cuisines.html",
    "app.js",
    "creator.js",
    "ebook-builder.js",
    "i18n-extra.js",
    "meal-plan.js",
    "nili-archive.js",
    "nili-recipe-editorial.js",
    "video-playlist.js",
    "world-cuisines.js",
    "creator-v3.css",
    "ebook-builder.css",
    "ebook-opening.css",
    "ebook-interior-v2.css",
    "homepage-theme.css",
    "meal-plan.css",
    "nili-archive-entry.css",
    "nili-archive.css",
    "nili-assistant.css",
    "nili-core.css",
    "nili-home.css",
    "nili-luxe.css",
    "nili-recipe-cards.css",
    "nili-recipe-page.css",
    "nili-typography.css",
    "nili-world.css",
    "premium-pages.css",
    "style.css",
    "style.fix.css",
    "today-cook.css",
    "world-cuisines.css",
    "logo.jpeg",
    "logo-mark-transparent.png",
    "logo-transparent.png",
    "nili-chef-mascot-v1.png",
    "nili-chef-mascot-v2.png"
  ];

  for (const fileName of localWebsiteFiles) {
    app.get(`/${fileName}`, (req, res) => res.sendFile(path.join(__dirname, fileName)));
  }

  app.get(/^\/ingredients\/[a-z0-9_-]+\.json$/i, (req, res) => {
    const fileName = path.basename(req.path);
    return res.sendFile(path.join(__dirname, "ingredients", fileName));
  });

  app.use(
    "/Videolar",
    express.static(path.join(__dirname, "Videolar"), {
      dotfiles: "deny",
      index: false,
      maxAge: 0
    })
  );
}

app.get("/", (req, res) => {
  if (servesLocalWebsite) {
    return res.sendFile(path.join(__dirname, "index.html"));
  }
  res.json({
    ok: true,
    service: "niliskitchen-api",
    health: "/health"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "nilis-kitchen-api" });
});

// Card renderer access: expose only its short-lived foreground HTML files to
// the local browser process. Never reopen the project root as a static folder.
app.get(/^\/recipe-(?:foreground|reference)-[0-9]+-[0-9]+\.html$/, (req, res) => {
  const clientIp = String(req.ip || "");
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(clientIp)) {
    return res.status(404).end();
  }
  const fileName = path.basename(req.path);
  const renderFile = path.join(__dirname, fileName);
  if (!fs.existsSync(renderFile)) return res.status(404).end();
  return res.sendFile(renderFile);
});

const activeVisitors = new Map();
const ACTIVE_VISITOR_TTL_MS = 90 * 1000;

function cleanupActiveVisitors() {
  const cutoff = Date.now() - ACTIVE_VISITOR_TTL_MS;
  for (const [id, visitor] of activeVisitors.entries()) {
    if (!visitor || visitor.lastSeen < cutoff) {
      activeVisitors.delete(id);
    }
  }
}

function activeVisitorCount() {
  cleanupActiveVisitors();
  return activeVisitors.size;
}

app.post("/analytics/ping", (req, res) => {
  const visitorId =
    String(req.body?.visitorId || "").trim() ||
    crypto.randomBytes(12).toString("hex");

  activeVisitors.set(visitorId, {
    visitorId,
    path: String(req.body?.path || req.headers.referer || ""),
    lang: String(req.body?.lang || ""),
    userEmail: String(req.body?.userEmail || ""),
    userAgent: String(req.headers["user-agent"] || ""),
    ip: req.ip || req.socket.remoteAddress || "",
    lastSeen: Date.now()
  });

  cleanupActiveVisitors();
  res.json({
    success: true,
    visitorId,
    activeVisitors: activeVisitors.size
  });
});

const SAFE_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const SAFE_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v"]);

function imageUploadFilter(req, file, cb) {
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  cb(null, SAFE_IMAGE_EXTENSIONS.has(extension) && String(file.mimetype || "").startsWith("image/"));
}

function creatorMediaUploadFilter(req, file, cb) {
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  const mimetype = String(file.mimetype || "").toLowerCase();
  const allowed = (SAFE_IMAGE_EXTENSIONS.has(extension) && mimetype.startsWith("image/")) ||
    (SAFE_VIDEO_EXTENSIONS.has(extension) && mimetype.startsWith("video/"));
  cb(null, allowed);
}

const upload = multer({
  dest: uploadTempDir,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: imageUploadFilter
});

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendMailSafe({ to, subject, html, text }) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
      console.log("MAIL SKIPPED:", subject);
      return false;
    }

    await mailer.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });

    console.log("MAIL SENT:", subject, to);
    return true;
  } catch (err) {
    console.log("MAIL ERROR:", err.message);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
}
 
/* TRANSLATE */

async function translateText(
  text,
  lang
){

  if(
    !text ||
    lang === "en"
  ){

    return text;

  }

  try{

    const gpt =
    await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",

          content:`

Translate recipe content.

Keep food names natural.

Return ONLY translated text.

`

        },

        {
          role:"user",

          content:`

Language:
${getTargetLanguageName(lang)}

Text:
${text}

`

        }

      ]

    });

    return gpt
    .choices[0]
    .message.content;

  }catch(e){

    console.log(e);

    return text;

  }

}

function getTargetLanguageName(lang) {
  const names = {
    en: "English",
    tr: "Turkish",
    ru: "Russian",
    de: "German",
    fr: "French",
    es: "Spanish",
    pt: "Portuguese",
    ar: "Arabic",
    ja: "Japanese",
    zh: "Chinese"
  };

  return names[String(lang || "").toLowerCase()] || lang || "English";
}

function criticalCulinaryGlossary(lang) {
  const rows={
    en:"bulgur=bulgur; yenibahar=allspice; un=flour; aşurelik buğday=wheat berries; asma yaprağı=grape leaves; yumurtalı tereyağı=egg butter; kıyma=ground/minced meat",
    de:"bulgur=Bulgur; yenibahar=Piment; un=Mehl; aşurelik buğday=Weizenkörner; asma yaprağı=Weinblätter; yumurtalı tereyağı=Eierbutter; kıyma=Hackfleisch",
    fr:"bulgur=boulgour; yenibahar=piment de la Jamaïque; un=farine; aşurelik buğday=grains de blé; asma yaprağı=feuilles de vigne; yumurtalı tereyağı=beurre aux œufs; kıyma=viande hachée",
    es:"bulgur=bulgur; yenibahar=pimienta de Jamaica; un=harina; aşurelik buğday=granos de trigo; asma yaprağı=hojas de parra; yumurtalı tereyağı=mantequilla de huevo; kıyma=carne picada",
    pt:"bulgur=bulgur; yenibahar=pimenta-da-jamaica; un=farinha; aşurelik buğday=grãos de trigo; asma yaprağı=folhas de videira; yumurtalı tereyağı=manteiga de ovo; kıyma=carne moída",
    ru:"bulgur=булгур; yenibahar=душистый перец; un=мука; aşurelik buğday=зёрна пшеницы; asma yaprağı=виноградные листья; yumurtalı tereyağı=яичное масло; kıyma=фарш",
    ar:"bulgur=برغل; yenibahar=بهار حلو; un=دقيق; aşurelik buğday=حبوب القمح; asma yaprağı=أوراق العنب; yumurtalı tereyağı=زبدة البيض; kıyma=لحم مفروم",
    ja:"bulgur=ブルグル; yenibahar=オールスパイス; un=小麦粉; aşurelik buğday=小麦粒; asma yaprağı=ブドウの葉; yumurtalı tereyağı=エッグバター; kıyma=ひき肉",
    zh:"bulgur=布格麦（碎小麦）; yenibahar=多香果粉; un=面粉; aşurelik buğday=小麦粒; asma yaprağı=葡萄叶; yumurtalı tereyağı=鸡蛋黄油; kıyma=绞肉"
  };
  return rows[String(lang || "").toLowerCase()] || rows.en;
}

function criticalRecipeTranslationIssues(sourceIngredients,candidateIngredients,lang){
  const checks={
    bulgur:{source:/\bbulgur\b/iu,target:{en:/\bbulgur\b/i,de:/\bbulgur\b/i,fr:/\bboulgour\b/i,es:/\bbulgur\b/i,pt:/\bbulgur\b/i,ru:/булгур/iu,ar:/برغل/u,ja:/ブルグル/u,zh:/布格麦|碎小麦/u}},
    yenibahar:{source:/\byenibahar\b/iu,target:{en:/\ballspice\b/i,de:/\bpiment\b/i,fr:/piment de la jamaïque/i,es:/pimienta de jamaica/i,pt:/pimenta[- ]da[- ]jamaica/i,ru:/душист.*пер/iu,ar:/بهار حلو/u,ja:/オールスパイス/u,zh:/多香果/u}},
    flour:{source:/\b(?:un|unu)\b/iu,target:{en:/\bflour\b/i,de:/mehl\b/i,fr:/\bfarine\b/i,es:/\bharina\b/i,pt:/\bfarinha\b/i,ru:/мук/iu,ar:/دقيق/u,ja:/粉/u,zh:/面粉|麦粉/u}},
    ashureWheat:{source:/aşurelik\s+buğday/iu,target:{en:/wheat berr/i,de:/weizenkörner|weizenkorn/iu,fr:/grains? de blé/iu,es:/granos? de trigo/iu,pt:/grãos? de trigo/iu,ru:/з[её]рна? пшениц/iu,ar:/حبوب القمح/u,ja:/小麦粒/u,zh:/小麦粒/u}},
    grapeLeaves:{source:/(?:asma|üzüm)\s+yapra(?:ğı|kları?)/iu,target:{en:/grape leaves?/i,de:/weinblätter|weinblatt/iu,fr:/feuilles? de vigne/iu,es:/hojas? de parra/iu,pt:/folhas? de videira/iu,ru:/виноградн.*листь/iu,ar:/أوراق العنب/u,ja:/ブドウの葉/u,zh:/葡萄叶/u}}
  };
  const issues=[];
  sourceIngredients.forEach((source,index)=>Object.entries(checks).forEach(([name,rule])=>{
    if(name === "flour" && breadcrumbRule(source,lang)) {
      if(!breadcrumbRule(source,lang).test(String(candidateIngredients[index] || ""))) issues.push(`ingredient ${index+1}: breadcrumbs`);
      return;
    }
    if(rule.source.test(String(source||"")) && rule.target[lang] && !rule.target[lang].test(String(candidateIngredients[index]||""))) issues.push(`ingredient ${index+1}: ${name}`);
  }));
  return issues;
}

function repairCriticalIngredientTerminology(sourceIngredients,candidateIngredients,lang){
  const repaired=(Array.isArray(candidateIngredients) ? candidateIngredients : []).map(value=>String(value || ""));
  if(lang!=="de") return repaired;
  sourceIngredients.forEach((source,index)=>{
    const sourceText=String(source || "");
    if(breadcrumbRule(sourceText,lang)) return;
    let candidate=String(repaired[index] || sourceText);
    if(!/\b(?:un|unu)\b/iu.test(sourceText) || /\bmehl\b|roggenmehl|weizenmehl/iu.test(candidate)) return;
    if(/çavdar\s+unu?/iu.test(sourceText)){
      candidate=/roggen/iu.test(candidate) ? candidate.replace(/roggen/iu,"Roggenmehl") : `${candidate} (Roggenmehl)`;
    }else if(/buğday\s+unu?/iu.test(sourceText)){
      candidate=/weizen/iu.test(candidate) ? candidate.replace(/weizen/iu,"Weizenmehl") : `${candidate} (Weizenmehl)`;
    }else{
      candidate=`${candidate} Mehl`;
    }
    repaired[index]=candidate.replace(/\s+/g," ").trim();
  });
  return repaired;
}

const recipeTranslationCache = new Map();
const recipeDetailTranslationCache = new Map();

async function translateWithDeepL(texts, targetLang) {
  const values = (Array.isArray(texts) ? texts : [texts]).map(value => String(value || ""));
  if (!values.length || values.every(value => !value)) return values;
  const apiKey = String(process.env.DEEPL_API_KEY || "").trim();
  if (!apiKey) throw new Error("DEEPL_API_KEY is not configured");
  const response = await fetch(process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams([
      ["target_lang", String(targetLang || "en").toUpperCase()],
      ["source_lang", "TR"],
      ...values.map(value => ["text", value])
    ])
  });
  if (!response.ok) throw new Error(`DeepL translation failed: ${response.status}`);
  const payload = await response.json();
  const translations = Array.isArray(payload?.translations) ? payload.translations : [];
  if (translations.length !== values.length) throw new Error("DeepL returned an incomplete translation");
  return translations.map(item => String(item?.text || ""));
}

async function translateTextBatch(items, lang, force = false){
  const source = Array.isArray(items)
    ? items.map(item => String(item ?? ""))
    : [];

  if(!source.length || (lang === "en" && !force)){
    return source;
  }

  const targetLang = String(lang || "en").toLowerCase();
  const missing = [...new Set(source.filter(Boolean))]
    .filter(item => !recipeTranslationCache.has(`${targetLang}:${item}`));

  if(!missing.length){
    return source.map(item =>
      recipeTranslationCache.get(`${targetLang}:${item}`) || item
    );
  }

  const chunks=[];
  for(let index=0;index<missing.length;index+=24){
    chunks.push(missing.slice(index,index+24));
  }

  const translateChunk=async chunk=>{
    try{
      const gpt =
      await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[
          {
            role:"system",
            content:`

Translate each array item into the target language.

Return ONLY a valid JSON array of strings.

Keep the same order and the same number of items.

Every item must be written only in the requested target language.

Preserve internationally recognized dish names when that is natural.

Never convert a dish name into a script that does not belong to the target language.

`
          },
          {
            role:"user",
            content:`

Language:
${getTargetLanguageName(lang)}

JSON array:
${JSON.stringify(chunk)}

`
          }
        ]
      },{
        timeout:18000,
        maxRetries:1
      });

      const content =
      gpt?.choices?.[0]?.message?.content?.trim() || "";

      const jsonMatch =
      content.match(/\[[\s\S]*\]/);

      const parsed =
      JSON.parse(jsonMatch ? jsonMatch[0] : content);

      if(!Array.isArray(parsed) || parsed.length !== chunk.length){
        throw new Error("Translation response item count mismatch");
      }

      chunk.forEach((item,index)=>{
        const translated=String(parsed[index] ?? "").trim();
        recipeTranslationCache.set(
          `${targetLang}:${item}`,
          translated || item
        );
      });
    }catch(error){
      console.log("BATCH TRANSLATE FAILED:",error.message);
    }
  };

  for(let index=0;index<chunks.length;index+=3){
    await Promise.all(chunks.slice(index,index+3).map(translateChunk));
  }

  return source.map(item =>
    recipeTranslationCache.get(`${targetLang}:${item}`) || item
  );
}

async function translateRecipeTitlesBatch(items, lang){
  const source = Array.isArray(items)
    ? items.map(item => String(item ?? ""))
    : [];

  const targetLang = String(lang || "en").toLowerCase();

  if(!source.length || targetLang === "tr"){
    return source;
  }

  const cachePrefix = `recipe-title:${targetLang}:`;
  const missing = [...new Set(source.filter(Boolean))]
    .filter(item => !recipeTranslationCache.has(`${cachePrefix}${item}`));

  if(!missing.length){
    return source.map(item =>
      recipeTranslationCache.get(`${cachePrefix}${item}`) || item
    );
  }

  try{
    const gpt =
    await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        {
          role:"system",
          content:`
Translate recipe and dish titles into the requested target language for a food website.

Return ONLY a valid JSON array of strings.
Keep the same order and number of items.

The returned title must be understandable to a reader of the target language.
For a culturally specific dish, write a clear descriptive name in the target language.
Do not return only the unchanged original cultural name.
Do not append the original name in parentheses because the interface displays the original name separately.
Keep only globally familiar international names natural, such as Pizza Napoletana, Croissant, Sushi Nigiri, Ramen and Tiramisu.
`
        },
        {
          role:"user",
          content:`
Language:
${getTargetLanguageName(targetLang)}

JSON array:
${JSON.stringify(missing)}
`
        }
      ]
    },{
      timeout:12000,
      maxRetries:1
    });

    const content =
    gpt?.choices?.[0]?.message?.content?.trim() || "";

    const jsonMatch =
    content.match(/\[[\s\S]*\]/);

    const parsed =
    JSON.parse(jsonMatch ? jsonMatch[0] : content);

    if(Array.isArray(parsed) && parsed.length === missing.length){
      missing.forEach((item, index) => {
        const translated = String(parsed[index] ?? "").trim();
        recipeTranslationCache.set(
          `${cachePrefix}${item}`,
          translated || item
        );
      });

      return source.map(item =>
        recipeTranslationCache.get(`${cachePrefix}${item}`) || item
      );
    }
  }catch(error){
    console.log("TITLE TRANSLATE FAILED:", error.message);
  }

  return source;
}

async function localizeIngredientArray(items, lang, force = false){
  if(!Array.isArray(items) || !items.length || (lang === "en" && !force)){
    return Array.isArray(items) ? items : [];
  }

  const originals =
  items.map(item =>
    String(item?.original || item?.name || "")
  );

  const translated =
  await translateTextBatch(originals, lang, force);

  return items.map((item, index) => ({
    ...item,
    original: translated[index] || item.original || item.name,
    name: translated[index] || item.name || item.original
  }));
}

function recipeInstructionStepTexts(recipe){
  if(Array.isArray(recipe?.analyzedInstructions) && recipe.analyzedInstructions.length){
    return recipe.analyzedInstructions
      .flatMap(block => Array.isArray(block?.steps) ? block.steps : [])
      .map(step => String(step?.step || "").trim())
      .filter(Boolean);
  }

  if(Array.isArray(recipe?.steps)){
    return recipe.steps
      .map(step => String(step?.step || step || "").trim())
      .filter(Boolean);
  }

  return [];
}

function localizeAnalyzedInstructions(recipe, translatedSteps){
  if(!Array.isArray(recipe?.analyzedInstructions) || !recipe.analyzedInstructions.length){
    return recipe.analyzedInstructions;
  }

  let stepIndex = 0;

  return recipe.analyzedInstructions.map(block => ({
    ...block,
    steps:Array.isArray(block?.steps)
      ? block.steps.map(step => ({
          ...step,
          step:translatedSteps[stepIndex++] || step?.step || ""
        }))
      : block?.steps
  }));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 5000){
  const controller = new AbortController();
  const timeout =
  setTimeout(() => controller.abort(), timeoutMs);

  try{
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return response;
  }finally{
    clearTimeout(timeout);
  }
}

function getAdminAlertEmail() {
  return (
    process.env.ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER
  );
}

async function notifyAdminError(source, err, extra = {}) {
  // Local Windows development must never consume the production mail quota.
  if (process.platform === "win32") {
    console.log("LOCAL ALERT EMAIL SKIPPED:", source || "unknown");
    return false;
  }

  const message =
    err instanceof Error ? err.stack || err.message : String(err || "Unknown error");

  await sendMailSafe({
    to: getAdminAlertEmail(),
    subject: `Nili's Kitchen System Alert - ${source || "unknown"}`,
    text: [
      `Source: ${source || "unknown"}`,
      `Time: ${new Date().toISOString()}`,
      `Extra: ${JSON.stringify(extra, null, 2)}`,
      "",
      message
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.45;max-width:720px">
        <h2>Nili's Kitchen System Alert</h2>
        <p><strong>Source:</strong> ${source || "unknown"}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <pre style="white-space:pre-wrap;background:#fff4f4;border:1px solid #ffd6d6;border-radius:12px;padding:14px;">${message}</pre>
        <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px;">${JSON.stringify(extra, null, 2)}</pre>
      </div>
    `
  });
}

process.on("uncaughtException", async (err) => {
  console.log("UNCAUGHT EXCEPTION:", err);
  await notifyAdminError("uncaughtException", err);
});

process.on("unhandledRejection", async (reason) => {
  console.log("UNHANDLED REJECTION:", reason);
  await notifyAdminError("unhandledRejection", reason);
});

app.post("/translate-ingredients", async (req, res) => {

  try{

    const { items, lang } = req.body;

    if(!Array.isArray(items) || !lang){
      return res.status(400).json({
        error:"Missing items or lang"
      });
    }

    if(lang === "en"){
      return res.json({ items });
    }

    const translatedItems =
      await translateTextBatch(items, lang, true);

    return res.json({
      items: translatedItems.map(item => String(item).trim())
    });

  }catch(err){

    console.log("TRANSLATE INGREDIENTS ERROR:", err.message);

    return res.status(500).json({
      error:"Ingredient translation failed"
    });

  }

});



/* ANALYZE */

app.post(
  "/analyze",
  upload.single("photo"),
  async (req, res) => {

    let uploadedPath = null;

    try {

      console.log("1 - ANALYZE START");

      if (!req.file) {

        return res.status(400).json({
          error: "No photo"
        });

      }

      uploadedPath = req.file.path;

      console.log("2 - FILE RECEIVED:", req.file.originalname);
      console.log("3 - MIME:", req.file.mimetype);

      const imageBase64 =
      fs.readFileSync(
        req.file.path,
        {
          encoding: "base64"
        }
      );

      console.log("4 - IMAGE CONVERTED BASE64");

      const openai =
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      console.log("5 - OPENAI REQUEST START");

      const response =
      await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content:
              "Return ONLY a valid JSON array of ingredient names. Example: [\"tomato\",\"onion\",\"cheese\"]"
            },

            {
              role: "user",

              content: [

                {
                  type: "text",
                  text: "Detect visible food ingredients in this image."
                },

                {
                  type: "image_url",
                  image_url: {
                    url:
                    `data:${req.file.mimetype};base64,${imageBase64}`
                  }
                }

              ]

            }

          ]

        },
        {
          timeout: 20000
        }
      );

      console.log("6 - OPENAI ANSWER RECEIVED");

      const text =
      response
      .choices[0]
      .message
      .content;

      console.log("AI RAW:", text);

      let ingredients =
      [];

      try {

        ingredients =
        JSON.parse(text);

      } catch {

        ingredients =
        text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/\[/g, "")
        .replace(/\]/g, "")
        .replace(/"/g, "")
        .replace(/'/g, "")
        .replace(/[“”]/g, "")
        .replace(/[‘’]/g, "")
        .replace(/\n/g, "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      }

      ingredients =
      ingredients
      .map(x =>
        String(x)
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
      )
      .filter(Boolean);

      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }

      console.log("7 - ANALYZE DONE:", ingredients);

      return res.json({
        ingredients
      });

    } catch (err) {

      console.log("ANALYZE ERROR:", err.message);

      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }

      return res.status(500).json({
        error: "Analyze failed",
        details: err.message
      });

    }

  }
);

/* NORMALIZE INGREDIENT */

app.post(
  "/normalize-ingredient",
  async (req, res) => {

    try {

      const input =
      req.body.ingredient;

      if(!input){
        return res.json({
          ingredient: ""
        });
      }

      const openai =
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content:
            `
You normalize food ingredient names.

Rules:
- Return only ONE ingredient name.
- Return in English.
- Fix typos.
- Translate if needed.
- Remove quantity words.
- Remove unnecessary adjectives unless important.
- Do not return sentences.
- Do not add explanations.

Examples:
domates -> tomato
tavuk gogsu -> chicken breast
kaşar peyniri -> cheese
kirmizi biber -> red pepper
zeytin yag -> olive oil
2 adet yumurta -> egg
biraz tuz -> salt
`
          },
          {
            role: "user",
            content: String(input)
          }
        ]
      });

      const ingredient =
      response
      .choices[0]
      .message
      .content
      .trim()
      .toLowerCase();

      return res.json({
        ingredient
      });

    } catch (err) {

      console.log("NORMALIZE ERROR:", err.message);

      return res.status(500).json({
        error: "Normalize failed",
        details: err.message
      });

    }

  }
);

/* WORLD RECIPE CATALOG */

const recipeCatalogDir = storagePath("recipe-catalog");
const recipeCatalogFile = path.join(recipeCatalogDir, "catalog.json");

const PRIORITY_CUISINES = {
  turkey: { label:"Turkish", mealDbArea:"Turkish", spoon:"Turkish", aliases:["turkey","turkish","turkiye","turk","turk mutfagi","anadolu","osmanli","gaziantep","hatay","kars","ege","karadeniz","bursa","adana","tarsus","kilis","konya","mersin","antakya","sakarya","samsun","siirt","kirsehir","izmir","seferihisar"] },
  italy: { label:"Italian", mealDbArea:"Italian", spoon:"Italian", edamam:"italian", aliases:["italy","italian","italya","italyan","napoli","milano","roma","toskana","sicilya","floransa","ligurya","lombardiya","piyemonte","bari","campania"] },
  mexico: { label:"Mexican", mealDbArea:"Mexican", spoon:"Mexican", edamam:"mexican", aliases:["mexico","mexican","meksika","meksika mutfagi","yucatan","puebla"] },
  india: { label:"Indian", mealDbArea:"Indian", spoon:"Indian", edamam:"indian", aliases:["india","indian","hindistan","hint mutfagi","gujarat","mumbai","haydarabad","maharashtra","andhra","pencap","kuzey hindistan","guney hindistan"] },
  china: { label:"Chinese", mealDbArea:"Chinese", spoon:"Chinese", edamam:"chinese", aliases:["china","chinese","cin","cin mutfagi","sichuan","kanton","pekin","sanghay"] },
  japan: { label:"Japanese", mealDbArea:"Japanese", spoon:"Japanese", edamam:"japanese", aliases:["japan","japanese","japonya","japon mutfagi","osaka"] },
  france: { label:"French", mealDbArea:"French", spoon:"French", edamam:"french", aliases:["france","french","fransa","fransiz mutfagi","lyon","auvergne","normandiya","picardie","lorraine","alsace","bretonya","nice","provence","burgonya","limousin","touraine","bearn","aubrac","languedoc"] },
  greece: { label:"Greek", mealDbArea:"Greek", spoon:"Greek", aliases:["greece","greek","yunanistan","yunan","yunan mutfagi","girit","santorini"] },
  usa: { label:"American", mealDbArea:"American", spoon:"American", edamam:"american", aliases:["usa","american","abd","birlesik devletler","amerika birlesik devletleri","louisiana","new england"] },
  thailand: { label:"Thai", mealDbArea:"Thai", spoon:"Thai", aliases:["thailand","thai","tayland","tayland mutfagi","kuzey tayland"] }
};

const RECIPE_SOURCE_PRIORITY = {
  nili:0,
  nili_approved:0,
  approved:0,
  nili_creator:0,
  nili_database:0,
  themealdb:1,
  spoonacular:2,
  edamam:3,
  "edamam-live":3
};

function recipeSourcePriority(recipe){
  return RECIPE_SOURCE_PRIORITY[recipe?.source] ?? 9;
}

function sortByRecipeSourcePriority(recipes){
  return [...(Array.isArray(recipes) ? recipes : [])]
    .sort((a,b) => recipeSourcePriority(a) - recipeSourcePriority(b));
}

const DISCOVERY_CATEGORY_ALIASES = {
  "main course":["main course","main dish","ana yemek","dinner","entree","beef","chicken","lamb","pork","goat","miscellaneous"],
  meat:["meat","et yemegi","et yemekleri","tavuk","dana","kuzu","kebap","kofte","beef","chicken","lamb","pork","goat"],
  vegetarian:["vegetarian","vegan","sebze","sebze yemegi","zeytinyagli"],
  pasta:["pasta","makarna","noodle","eriste"],
  seafood:["seafood","deniz urunu","balik","karides","midye","kalamar"],
  soup:["soup","corba","sulu yemek"],
  salad:["salad","salata"],
  breakfast:["breakfast","kahvalti","brunch"],
  dessert:["dessert","tatli","pasta tatli"],
  appetizer:["appetizer","starter","baslangic","meze","atistirmalik"],
  "hot beverage":[
    "hot beverage","hot drink","hot drinks","beverage hot",
    "sicak icecek","icecek sicak","kahve","coffee","cay","tea",
    "hot chocolate","cocoa","salep"
  ],
  "cold beverage":[
    "cold beverage","cold drink","cold drinks","beverage cold",
    "soguk icecek","icecek soguk","lemonade","limonata","smoothie",
    "juice","meyve suyu","iced tea","iced coffee","milkshake","mocktail"
  ]
};

const BEVERAGE_CATEGORY_SEARCH = {
  "hot beverage":"hot chocolate",
  "cold beverage":"lemonade"
};

function isBeverageCategory(category){
  return Boolean(BEVERAGE_CATEGORY_SEARCH[String(category || "").toLowerCase()]);
}

function normalizedContainsTerm(value,term){
  const clean = input => normalizeText(input).replace(/[^a-z0-9]+/g," ").trim();
  const haystack=` ${clean(value)} `;
  const needle=` ${clean(term)} `;
  return needle.trim() && haystack.includes(needle);
}

function beverageRecipeMatches(recipe,category){
  const structured=[
    recipe.category,
    recipe.dishType,
    recipe.type,
    ...(recipe.tags || [])
  ].filter(Boolean).join(" ");
  const title=recipe.title || "";
  const titleTerms=category==="hot beverage"
    ? ["hot chocolate","coffee","latte","cappuccino","espresso","tea","cocoa","salep"]
    : ["lemonade","limonata","smoothie","juice","meyve suyu","iced tea","iced coffee","milkshake","mocktail"];
  const nonDrinkFoodTerms=[
    "fudge","cake","cookie","bun","bread","pudding","ice cream",
    "sauce","muffin","brownie","pie","tart"
  ];
  const hasRequestedTemperature=DISCOVERY_CATEGORY_ALIASES[category].some(term=>
    normalizedContainsTerm(structured,term)
  );
  const hasDrinkTitle=titleTerms.some(term=>normalizedContainsTerm(title,term));
  const looksLikeFood=nonDrinkFoodTerms.some(term=>normalizedContainsTerm(title,term));

  return hasRequestedTemperature || (hasDrinkTitle && !looksLikeFood);
}

const DISCOVERY_ALCOHOL_TERMS=[
  "alcohol","beer","wine","vodka","rum","gin","tequila","whiskey","whisky",
  "bourbon","brandy","cognac","liqueur","champagne","prosecco","vermouth",
  "cocktail","spiked"
];

function isNonAlcoholicDiscoveryRecipe(recipe){
  const searchable=[
    recipe.title,
    recipe.category,
    recipe.dishType,
    ...(recipe.tags || []),
    ...normalizeIngredientList(recipe.extendedIngredients || recipe.usedIngredients || [])
      .map(item=>item.original || item.originalString || item.name || "")
  ].filter(Boolean).join(" ");
  return !DISCOVERY_ALCOHOL_TERMS.some(term=>normalizedContainsTerm(searchable,term));
}

function discoveryCuisineAliases(cuisine){
  const config=PRIORITY_CUISINES[String(cuisine||"").toLowerCase()];
  return (config?.aliases || [config?.label || cuisine]).map(normalizeText).filter(Boolean);
}

function resolvePriorityCuisineKey(value){
  const primarySegment = normalizeText(
    String(value || "").split(/\s*(?:\/|\||–|—|\s-\s)\s*/)[0]
  );
  if(!primarySegment) return "";

  for(const [key, config] of Object.entries(PRIORITY_CUISINES)){
    const aliases = config.aliases.map(normalizeText);
    if(aliases.some(alias =>
      primarySegment === alias ||
      primarySegment.startsWith(`${alias} `) ||
      primarySegment.endsWith(` ${alias}`) ||
      primarySegment.includes(` ${alias} `)
    )) return key;
  }

  return "";
}

function recipeMatchesCuisine(recipe,cuisine){
  if(!cuisine) return true;
  const metadata=normalizeText([recipe.cuisine,recipe.country].filter(Boolean).join(" "));
  const requested=normalizeText(cuisine);
  if(requested && metadata.includes(requested)) return true;
  const requestedKey=String(cuisine||"").toLowerCase();
  const requestedPriorityKey=PRIORITY_CUISINES[requestedKey]
    ? requestedKey
    : resolvePriorityCuisineKey(cuisine);
  const resolvedKey=
    recipe.cuisineKey ||
    resolvePriorityCuisineKey(recipe.country) ||
    resolvePriorityCuisineKey(recipe.cuisine);
  if(resolvedKey && requestedPriorityKey) return resolvedKey === requestedPriorityKey;

  const aliases=discoveryCuisineAliases(cuisine);
  return aliases.some(alias=>metadata === alias || metadata.includes(alias)) || metadata.includes(requested);
}

function recipeMatchesCategory(recipe,category){
  if(!category) return true;
  const key=String(category).toLowerCase();
  if(isBeverageCategory(key)) return beverageRecipeMatches(recipe,key);
  const aliases=(DISCOVERY_CATEGORY_ALIASES[key] || [key]).map(normalizeText);
  const metadata=normalizeText([
    recipe.category,
    recipe.dishType,
    recipe.type,
    recipe.title,
    ...(recipe.tags || [])
  ].filter(Boolean).join(" "));
  return aliases.some(alias=>metadata.includes(alias));
}

function filterDiscoverySelection(recipes,{cuisine,category}){
  return (Array.isArray(recipes)?recipes:[]).filter(recipe=>
    recipeMatchesCuisine(recipe,cuisine) && recipeMatchesCategory(recipe,category)
  );
}

function ensureRecipeCatalog(){
  if(!fs.existsSync(recipeCatalogDir)) fs.mkdirSync(recipeCatalogDir, { recursive:true });
  if(!fs.existsSync(recipeCatalogFile)) fs.writeFileSync(recipeCatalogFile, "[]", "utf8");
}

function readRecipeCatalog(){
  ensureRecipeCatalog();
  try{
    const data = JSON.parse(fs.readFileSync(recipeCatalogFile, "utf8"));
    return Array.isArray(data) ? data : [];
  }catch(error){
    console.log("RECIPE CATALOG READ ERROR:", error.message);
    return [];
  }
}

function writeRecipeCatalog(recipes){
  ensureRecipeCatalog();
  const tempFile = recipeCatalogFile + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(recipes, null, 2), "utf8");
  try{
    fs.renameSync(tempFile, recipeCatalogFile);
  }catch(error){
    // Windows cannot always replace an existing file with renameSync.
    fs.copyFileSync(tempFile, recipeCatalogFile);
    fs.unlinkSync(tempFile);
  }
}

function recipeCatalogKey(recipe){
  return `${recipe.source || "unknown"}:${recipe.sourceId || recipe.id || ""}`;
}

function upsertRecipeCatalog(incoming){
  if(!Array.isArray(incoming) || !incoming.length) return readRecipeCatalog();
  const catalog = readRecipeCatalog();
  const byKey = new Map(catalog.map(item => [recipeCatalogKey(item), item]));

  incoming.forEach(recipe => {
    if(!recipe || !recipe.sourceId || !recipe.title) return;
    const key = recipeCatalogKey(recipe);
    const existing = byKey.get(key) || {};
    byKey.set(key, {
      ...existing,
      ...recipe,
      localizations: existing.localizations || {},
      cachedAt: existing.cachedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  const next = [...byKey.values()];
  writeRecipeCatalog(next);
  return next;
}

function catalogSearchText(recipe){
  return normalizeText([
    recipe.title,
    recipe.cuisine,
    recipe.country,
    recipe.category,
    ...(recipe.tags || []),
    ...(recipe.extendedIngredients || []).map(item => item.name || item.original || "")
  ].join(" "));
}

function searchRecipeCatalog({ query, cuisine, category, limit }){
  const queryText = normalizeText(query || "");

  return readRecipeCatalog()
    .map(recipe => {
      const text = catalogSearchText(recipe);
      let score = 0;
      if(queryText){
        if(normalizeText(recipe.title) === queryText) score += 100;
        else if(normalizeText(recipe.title).includes(queryText)) score += 60;
        else if(text.includes(queryText)) score += 20;
        else return null;
      }
      if(cuisine){
        if(recipeMatchesCuisine(recipe,cuisine)) score += 40;
        else return null;
      }
      if(category){
        if(recipeMatchesCategory(recipe,category)) score += 30;
        else return null;
      }
      return { recipe, score };
    })
    .filter(Boolean)
    .sort((a,b) =>
      b.score - a.score ||
      recipeSourcePriority(a.recipe) - recipeSourcePriority(b.recipe) ||
      String(b.recipe.updatedAt).localeCompare(String(a.recipe.updatedAt))
    )
    .slice(0, limit)
    .map(item => item.recipe);
}

const MIN_SELECTED_INGREDIENT_COVERAGE = 0.9;

function ingredientFamilyKey(value){
  const normalized=normalizeText(value).replace(/[_-]+/g," ");

  if(
    /\bbeef\b/.test(normalized) ||
    ["bresaola","veal"].some(term=>normalized.includes(term))
  ){
    return "beef";
  }

  return "";
}

function buildIngredientAliasGroups(primaryItems, originalItems = [], translatedItems = []){
  const primary = Array.isArray(primaryItems) ? primaryItems : [];
  const originals = Array.isArray(originalItems) ? originalItems : [];
  const translated = Array.isArray(translatedItems) ? translatedItems : [];

  const grouped=new Map();

  primary.forEach((item,index)=>{
    const aliases=[item, originals[index], translated[index]]
      .map(normalizeText)
      .filter(Boolean);
    if(!aliases.length) return;

    const family=aliases.map(ingredientFamilyKey).find(Boolean);
    const key=family || aliases[0];
    if(!grouped.has(key)) grouped.set(key,new Set());
    aliases.forEach(alias=>grouped.get(key).add(alias));
    if(family) grouped.get(key).add(family);
  });

  return [...grouped.values()].map(group=>[...group]);
}

function recipeIngredientSearchText(recipe){
  return normalizeText([
    recipe.title,
    recipe.adminTitleTr,
    recipe.ingredients,
    recipe.adminIngredientsTr,
    recipe.ingredientsText,
    ...(recipe.usedIngredients || []).map(item => item?.name || item?.original || item || ""),
    ...(recipe.missedIngredients || []).map(item => item?.name || item?.original || item || ""),
    ...(recipe.extendedIngredients || []).map(item => item?.name || item?.original || item || "")
  ].join(" "));
}

function ingredientCoverageForRecipe(recipe, ingredientGroups){
  const groups = Array.isArray(ingredientGroups) ? ingredientGroups : [];
  if(!groups.length) return { matchCount:0, coverage:0, matchedIngredients:[] };
  const text = recipeIngredientSearchText(recipe);
  const matchedIngredients = groups
    .filter(group => group.some(alias => text.includes(alias)))
    .map(group => group[0]);
  return {
    matchCount:matchedIngredients.length,
    coverage:matchedIngredients.length / groups.length,
    matchedIngredients
  };
}

function filterRecipesByIngredientCoverageAtThreshold(
  recipes,
  ingredientGroups,
  limit = Infinity,
  minimumCoverage = MIN_SELECTED_INGREDIENT_COVERAGE
){
  return (Array.isArray(recipes) ? recipes : [])
    .map(recipe => ({ recipe, ...ingredientCoverageForRecipe(recipe, ingredientGroups) }))
    .filter(item => item.coverage >= minimumCoverage)
    .sort((a,b) =>
      b.coverage - a.coverage ||
      b.matchCount - a.matchCount ||
      recipeSourcePriority(a.recipe) - recipeSourcePriority(b.recipe)
    )
    .slice(0,limit)
    .map(item => ({
      ...item.recipe,
      selectedIngredientCoverage:item.coverage,
      matchedIngredients:item.matchedIngredients
    }));
}

function ingredientCoverageThresholds(ingredientCount){
  if(ingredientCount <= 2) return [1];

  const practicalCoverage =
    ingredientCount === 3 ? 2 / 3 :
    ingredientCount <= 5 ? 0.6 :
    0.5;
  const emergencyCoverage = Math.min(practicalCoverage, 2 / ingredientCount);

  return [...new Set([
    MIN_SELECTED_INGREDIENT_COVERAGE,
    practicalCoverage,
    emergencyCoverage
  ])].sort((a,b)=>b-a);
}

function filterRecipesByBestIngredientCoverage(recipes, ingredientGroups, limit = Infinity){
  const groups=Array.isArray(ingredientGroups) ? ingredientGroups : [];
  for(const threshold of ingredientCoverageThresholds(groups.length)){
    const matches=filterRecipesByIngredientCoverageAtThreshold(
      recipes,
      groups,
      limit,
      threshold
    );
    if(matches.length) return matches;
  }
  return [];
}

function filterRecipesByIngredientCoverage(recipes, ingredientGroups, limit = Infinity){
  return filterRecipesByIngredientCoverageAtThreshold(
    recipes,
    ingredientGroups,
    limit,
    MIN_SELECTED_INGREDIENT_COVERAGE
  );
}

function searchRecipeCatalogByIngredients(ingredientGroups, limit){
  if(!Array.isArray(ingredientGroups) || !ingredientGroups.length){
    return [];
  }

  return sortByRecipeSourcePriority(
    filterRecipesByBestIngredientCoverage(readRecipeCatalog(), ingredientGroups, limit)
  ).slice(0,limit);
}

function normalizeDiscoveryMediaUrl(value){
  let url=String(value || "").trim().replace(/\\/g,"/");
  if(!url || /\/flags\//i.test(url)) return "";

  url=url
    .replace(/\/recipe-import-images\/optimized-images\//gi,"/optimized-images/")
    .replace(/\/recipe-import-images\/recipe-import-images\//gi,"/recipe-import-images/");

  if(!/^https?:\/\//i.test(url) && !url.startsWith("/")){
    url=`/${url}`;
  }
  return url;
}

function localRecipeMediaExists(url){
  if(/^https?:\/\//i.test(url)) return true;

  const clean=String(url || "")
    .split(/[?#]/)[0]
    .replace(/^\/+/,"");
  if(!clean) return false;

  try{
    return fs.existsSync(path.join(__dirname,decodeURIComponent(clean)));
  }catch{
    return false;
  }
}

function discoveryMediaUrls(recipe){
  const values=[
    recipe?.mediaUrl,
    recipe?.fullImage,
    recipe?.image,
    ...(Array.isArray(recipe?.mediaUrls) ? recipe.mediaUrls : [])
  ];
  if(recipe?.mediaFile) values.push(`/creator-uploads/${recipe.mediaFile}`);

  const candidates=values
    .map(normalizeDiscoveryMediaUrl)
    .filter(Boolean)
    .flatMap(url => url.toLowerCase().endsWith(".webp")
      ? [url,url.slice(0,-5)]
      : [url]
    );

  return [...new Set(candidates)].filter(localRecipeMediaExists);
}

const mobileRecipeThumbnailDir=storagePath("optimized-images","mobile-cards");
fs.mkdirSync(mobileRecipeThumbnailDir,{recursive:true});

function localDiscoveryMediaPath(value){
  const url=normalizeDiscoveryMediaUrl(value);
  if(!url || /^https?:\/\//i.test(url)) return "";

  const clean=url.split(/[?#]/)[0].replace(/^\/+/,"");
  if(!/^(creator-uploads|recipe-import-images|optimized-images)\//i.test(clean)){
    return "";
  }

  try{
    const decoded=decodeURIComponent(clean);
    const storageCandidate=path.resolve(STORAGE_ROOT,decoded);
    const storagePrefix=`${STORAGE_ROOT}${path.sep}`.toLowerCase();
    if(
      storageCandidate.toLowerCase().startsWith(storagePrefix) &&
      fs.existsSync(storageCandidate)
    ){
      return storageCandidate;
    }

    const appCandidate=path.resolve(__dirname,decoded);
    const appPrefix=`${__dirname}${path.sep}`.toLowerCase();
    if(
      appCandidate.toLowerCase().startsWith(appPrefix) &&
      fs.existsSync(appCandidate)
    ){
      return appCandidate;
    }
  }catch{
    return "";
  }

  return "";
}

async function createMobileRecipeThumbnail(recipe){
  const sourceUrl=discoveryMediaUrls(recipe)[0] || "";
  const sourcePath=localDiscoveryMediaPath(sourceUrl);
  if(!sourcePath) return recipe;

  const key=crypto
    .createHash("sha1")
    .update(`${sourceUrl}:420x315:v1`)
    .digest("hex");
  const outputName=`${key}.webp`;
  const outputPath=path.join(mobileRecipeThumbnailDir,outputName);

  try{
    if(
      !fs.existsSync(outputPath) ||
      fs.statSync(outputPath).mtimeMs<fs.statSync(sourcePath).mtimeMs
    ){
      await sharp(sourcePath,{failOn:"none"})
        .rotate()
        .resize(420,315,{fit:"cover",position:"centre"})
        .webp({quality:70,effort:3,smartSubsample:true})
        .toFile(outputPath);
    }

    return {
      ...recipe,
      thumbnail:`/optimized-images/mobile-cards/${outputName}`
    };
  }catch(error){
    console.log("MOBILE RECIPE THUMBNAIL FAILED:",error.message);
    return recipe;
  }
}

async function attachMobileRecipeThumbnails(recipes){
  const source=Array.isArray(recipes) ? recipes : [];
  const output=new Array(source.length);
  let cursor=0;

  const worker=async()=>{
    while(cursor<source.length){
      const index=cursor++;
      output[index]=await createMobileRecipeThumbnail(source[index]);
    }
  };

  await Promise.all(
    Array.from({length:Math.min(3,source.length)},worker)
  );
  return output;
}

function mapNiliDiscoveryRecipe(recipe){
  const rawIngredients = recipe.adminIngredientsTr || recipe.ingredients || [];
  const cuisineValue = recipe.cuisine || recipe.country || "";
  const mediaUrls=discoveryMediaUrls(recipe);
  const ingredients = (Array.isArray(rawIngredients) ? rawIngredients : String(rawIngredients).split(/\r?\n|;+/))
    .map(item => typeof item === "string" ? { name:item.trim(), original:item.trim() } : item)
    .filter(item => item && (item.name || item.original));
  return {
    id:`nili-${recipe.id}`,
    sourceId:String(recipe.id),
    importRecipeId:String(recipe.importRecipeId || ""),
    source:"nili_creator",
    title:recipe.adminTitleTr || recipe.title || "Nili's Recipe",
    image:mediaUrls[0] || "",
    mediaUrl:mediaUrls[0] || "",
    mediaUrls,
    cuisine:cuisineValue,
    country:recipe.country || recipe.cuisine || "",
    cuisineKey:resolvePriorityCuisineKey(cuisineValue),
    category:recipe.category || recipe.dishType || recipe.type || "",
    dishType:recipe.dishType || recipe.type || recipe.category || "",
    tags:recipe.tags || [],
    creatorUsername:recipe.creatorUsername || recipe.creatorName || "Nili's Kitchen",
    createdAt:recipe.createdAt || "",
    updatedAt:recipe.updatedAt || "",
    approvedAt:recipe.approvedAt || "",
    views:Number(recipe.views || 0),
    clicks:Number(recipe.clicks || 0),
    readyInMinutes:Number(recipe.prepTime || recipe.readyInMinutes) || 30,
    prepTimeText:String(recipe.prepTimeText || ""),
    cookTimeText:String(recipe.cookTimeText || ""),
    totalTime:(Number(recipe.prepTimeText) || 0)+(Number(recipe.cookTimeText) || 0) || "",
    servings:recipe.servings || null,
    usedIngredients:normalizeIngredientList(ingredients),
    extendedIngredients:normalizeIngredientList(ingredients),
    instructions:recipe.adminInstructionsTr || recipe.instructions || "Recipe instructions unavailable.",
    localizations:recipe.localizations && typeof recipe.localizations === "object" ? {...recipe.localizations} : {},
    recipeCardUrls:recipe.recipeCardUrls && typeof recipe.recipeCardUrls === "object" ? {...recipe.recipeCardUrls} : {},
    recipeCardStatuses:recipe.recipeCardStatuses && typeof recipe.recipeCardStatuses === "object" ? {...recipe.recipeCardStatuses} : {},
    sourceUrl:""
  };
}

let ebookContentCache={mtimeMs:0,byRecipeId:new Map()};

function cleanExcelText(value){
  return String(value ?? "").replace(/_x000d_/gi,"").replace(/\r\n?/g,"\n").trim();
}

async function readEbookContentIndex(){
  if(!fs.existsSync(professionalExcelMasterFile)) return new Map();
  const mtimeMs=fs.statSync(professionalExcelMasterFile).mtimeMs;
  if(ebookContentCache.mtimeMs===mtimeMs) return ebookContentCache.byRecipeId;
  const XLSXModule=await import("xlsx");
  const XLSXLib=XLSXModule.default || XLSXModule;
  const workbook=XLSXLib.readFile(professionalExcelMasterFile,{cellDates:false});
  const rowsFrom=sheetName=>{
    const sheet=workbook.Sheets[sheetName];
    return sheet ? XLSXLib.utils.sheet_to_json(sheet,{range:2,defval:"",raw:false}) : [];
  };
  const byRecipeId=new Map();
  const ensure=id=>{
    const key=cleanExcelText(id);
    if(!key) return null;
    if(!byRecipeId.has(key)) byRecipeId.set(key,{});
    return byRecipeId.get(key);
  };
  rowsFrom("Tarifler").forEach(row=>{
    const item=ensure(row["Recipe ID"]);
    if(!item) return;
    Object.assign(item,{
      professionalRecipeId:cleanExcelText(row["Recipe ID"]),
      originalTitle:cleanExcelText(row["Orijinal Ad"]),
      localizedSubtitle:cleanExcelText(row["Türkçe Açıklama"]),
      prepTimeText:cleanExcelText(row["Hazırlık Süresi"]),
      cookTimeText:cleanExcelText(row["Pişirme Süresi"]),
      difficulty:cleanExcelText(row["Zorluk"]),
      allergens:cleanExcelText(row["Alerjen"]),
      totalTime:cleanExcelText(row["Toplam Süre"]),
      temperature:cleanExcelText(row["Sıcaklık"])
    });
  });
  rowsFrom("Ek İçerikler").forEach(row=>{
    const item=ensure(row["Recipe ID"]);
    if(!item) return;
    Object.assign(item,{
      tip:cleanExcelText(row["Püf Noktası"]),
      servingSuggestion:cleanExcelText(row["Servis Önerisi"]),
      storage:cleanExcelText(row["Saklama Önerisi"]),
      alternatives:cleanExcelText(row["Alternatif Malzemeler"]),
      culturalNote:cleanExcelText(row["Kültür/Köken"])
    });
  });
  ebookContentCache={mtimeMs,byRecipeId};
  return byRecipeId;
}

async function enrichEbookRecipes(recipes){
  try{
    const index=await readEbookContentIndex();
    return recipes.map(recipe=>({...recipe,...(index.get(String(recipe.importRecipeId || "")) || {})}));
  }catch(error){
    console.log("EBOOK CONTENT LOAD FAILED:",error.message);
    return recipes;
  }
}

function searchNiliDiscovery({ query, cuisine, category, limit }){
  const queryText=normalizeText(query || "");
  return readApprovedRecipes()
    .filter(recipe => recipe.status === "approved" && recipe.publishEnabled !== false)
    .map(mapNiliDiscoveryRecipe)
    .filter(recipe => {
      const text=catalogSearchText(recipe);
      return (!queryText || text.includes(queryText)) &&
        recipeMatchesCuisine(recipe,cuisine) &&
        recipeMatchesCategory(recipe,category);
    })
    .slice(0,limit);
}

function niliCuisineIdentity(recipe){
  return normalizeText(
    String(recipe?.cuisine || recipe?.country || "other")
      .split(/\s*(?:\/|\||–|—|\s-\s)\s*/)[0]
  ) || "other";
}

function diversifyNiliCuisines(recipes){
  const groups=new Map();
  recipes.forEach(recipe=>{
    const key=niliCuisineIdentity(recipe);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(recipe);
  });

  const diversified=[];
  let row=0;
  while(diversified.length<recipes.length){
    let added=false;
    for(const group of groups.values()){
      if(group[row]){
        diversified.push(group[row]);
        added=true;
      }
    }
    if(!added) break;
    row+=1;
  }
  return diversified;
}

function recipeCuisineText(recipe){
  return normalizeText([
    recipe?.cuisine,
    recipe?.country,
    recipe?.area,
    recipe?.region
  ].filter(Boolean).join(" "));
}

function recipeTitleText(recipe){
  return normalizeText(recipe?.title || "");
}

function recipeMatchesAnyAlias(recipe, aliases, { includeTitle = false } = {}){
  const cuisineText = recipeCuisineText(recipe);
  const titleText = includeTitle ? recipeTitleText(recipe) : "";

  return aliases.some(alias => {
    const normalizedAlias = normalizeText(alias);
    return cuisineText.includes(normalizedAlias) ||
      (includeTitle && titleText.includes(normalizedAlias));
  });
}

function rotateRecipePool(recipes){
  if(!recipes.length) return [];
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const offset = dayIndex % recipes.length;
  return [...recipes.slice(offset), ...recipes.slice(0, offset)];
}

function buildMobileFeaturedNiliSelection(recipes, limit){
  const pool = rotateRecipePool(filterRenderableRecipes(uniqueRecipes(recipes)));
  const selected = [];
  const usedTitles = new Set();

  const requiredGroups = [
    { id:"turkey", aliases:["turkiye","turkish","turkey","turkiye mutfagi","anadolu","gaziantep","hatay"] },
    { id:"france", aliases:["fransa","french","france","fransiz"] },
    { id:"italy", aliases:["italya","italian","italy","italyan"] },
    { id:"morocco", aliases:["fas","maghrip","magrip","maghreb","kuzey afrika","cezayir","tunus"] },
    { id:"far-east", aliases:["japon","japan","cin","chinese","china","tayland","thai","kore","korean","vietnam","uzak dogu","guneydogu asya"] },
    { id:"central-asia", aliases:["orta asya","plov","manti","ozbek","kazak","kirgiz","uygur","turkmen"] }
  ];

  const addRecipe = recipe => {
    if(!recipe) return false;
    const key = normalizeText(recipe.title || recipe.id || "");
    if(!key || usedTitles.has(key)) return false;
    usedTitles.add(key);
    selected.push(recipe);
    return true;
  };

  requiredGroups.forEach(group => {
    const match = pool.find(recipe =>
      !usedTitles.has(normalizeText(recipe.title || recipe.id || "")) &&
      recipeMatchesAnyAlias(recipe, group.aliases, {
        includeTitle: group.id === "central-asia"
      })
    );

    addRecipe(match);
  });

  diversifyNiliCuisines(pool).forEach(recipe => {
    if(selected.length < limit) addRecipe(recipe);
  });

  return selected.slice(0, limit);
}

function uniqueRecipes(recipes){
  return recipes.filter((recipe,index,array) =>
    array.findIndex(item => normalizeText(item.title) === normalizeText(recipe.title)) === index
  );
}

function normalizeIngredientEntry(item){
  if(!item) return null;
  if(typeof item === "string"){
    const value = item.trim();
    return value ? { name:value, original:value } : null;
  }

  const original = String(
    item.original ||
    item.originalName ||
    item.text ||
    item.food ||
    ""
  ).trim();

  const name = String(
    item.name ||
    item.food ||
    original ||
    ""
  ).trim();

  if(!original && !name){
    return null;
  }

  const quantity = item.quantity ? String(item.quantity).trim() : "";
  const measure = item.measure ? String(item.measure).trim() : "";
  const combined = [quantity, measure, name].filter(Boolean).join(" ").trim();

  return {
    name:name || combined,
    original:original || combined || name
  };
}

function normalizeIngredientList(list){
  if(!Array.isArray(list)) return [];
  return list.map(normalizeIngredientEntry).filter(Boolean);
}

function recipeInstructionSteps(recipe){
  if(Array.isArray(recipe?.analyzedInstructions) && recipe.analyzedInstructions.length){
    return recipe.analyzedInstructions
      .flatMap(block => Array.isArray(block.steps) ? block.steps : [])
      .map(step => String(step?.step || "").trim())
      .filter(Boolean);
  }
  return [];
}

function recipeHasUsableInstructions(recipe){
  const steps = recipeInstructionSteps(recipe);
  if(steps.length >= 2) return true;

  const text = String(recipe?.instructions || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if(!text || /^https?:\/\//i.test(text)) return false;

  const lowered = text.toLowerCase();
  if(
    lowered.includes("open recipe source for instructions") ||
    lowered.includes("recipe instructions unavailable") ||
    lowered.includes("no instructions")
  ){
    return false;
  }

  return text.length >= 80;
}

function sanitizeRecipeForApp(recipe){
  const usedIngredients = normalizeIngredientList(recipe.usedIngredients);
  const missedIngredients = normalizeIngredientList(recipe.missedIngredients);
  const extendedIngredients = normalizeIngredientList(
    recipe.extendedIngredients?.length ? recipe.extendedIngredients : usedIngredients
  );

  return {
    ...recipe,
    usedIngredients,
    missedIngredients,
    extendedIngredients,
    sourceUrl:"",
    instructions:String(recipe.instructions || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  };
}

function recipeHasUsableImage(recipe){
  const candidates=[
    recipe?.mediaUrl,
    recipe?.fullImage,
    recipe?.image,
    ...(Array.isArray(recipe?.mediaUrls) ? recipe.mediaUrls : [])
  ]
    .map(value=>String(value || "").trim())
    .filter(value=>value && !/\/flags\//i.test(value));

  return candidates.some(value=>{
    if(/^(?:https?:|data:|blob:)/i.test(value)) return true;

    const clean=value
      .replace(/\\/g,"/")
      .split(/[?#]/)[0]
      .replace(/^\/+/,"");
    if(!clean) return false;

    try{
      return fs.existsSync(path.join(__dirname,decodeURIComponent(clean)));
    }catch{
      return false;
    }
  });
}

function filterRenderableRecipes(recipes){
  return uniqueRecipes(
    (recipes || [])
      .map(sanitizeRecipeForApp)
      .filter(recipe =>
        recipeCardHasUsableImage(recipe) &&
        recipeHasUsableInstructions(recipe) &&
        Array.isArray(recipe.extendedIngredients) &&
        recipe.extendedIngredients.length >= 2
      )
  );
}

function mealDbIngredients(detail){
  const ingredients = [];
  for(let index=1; index<=20; index++){
    const name = String(detail[`strIngredient${index}`] || "").trim();
    const measure = String(detail[`strMeasure${index}`] || "").trim();
    if(name) ingredients.push({ name, original:`${measure} ${name}`.trim() });
  }
  return ingredients;
}

function mapMealDbRecipe(detail){
  const ingredients = mealDbIngredients(detail);
  return {
    id:`themealdb-${detail.idMeal}`,
    sourceId:String(detail.idMeal),
    source:"themealdb",
    title:detail.strMeal || "Recipe",
    image:detail.strMealThumb || "",
    cuisine:detail.strArea || "",
    country:detail.strArea || "",
    category:detail.strCategory || "",
    tags:String(detail.strTags || "").split(",").map(item => item.trim()).filter(Boolean),
    readyInMinutes:30,
    servings:null,
    usedIngredients:normalizeIngredientList(ingredients),
    extendedIngredients:normalizeIngredientList(ingredients),
    instructions:detail.strInstructions || "Recipe instructions unavailable.",
    sourceUrl:detail.strSource || detail.strYoutube || ""
  };
}

async function fetchMealDbDiscovery({ query, cuisine, category, limit }){
  if(!useTheMealDB) return [];
  const apiKey = process.env.THEMEALDB_KEY || "1";
  let summaries = [];
  if(query){
    const response =
    await fetchJsonWithTimeout(
      `https://www.themealdb.com/api/json/v1/${apiKey}/search.php?s=${encodeURIComponent(query)}`,
      {},
      4500
    );
    summaries = (await response.json()).meals || [];
    return filterRenderableRecipes(
      filterDiscoverySelection(summaries.map(mapMealDbRecipe),{cuisine,category})
    ).slice(0,limit);
  }

  const cuisineConfig = PRIORITY_CUISINES[cuisine];
  const filter = cuisineConfig
    ? `a=${encodeURIComponent(cuisineConfig.mealDbArea)}`
    : `c=${encodeURIComponent(category || "Main course")}`;
  const response =
  await fetchJsonWithTimeout(
    `https://www.themealdb.com/api/json/v1/${apiKey}/filter.php?${filter}`,
    {},
    4500
  );
  summaries = (await response.json()).meals || [];

  const details = await Promise.all(summaries.slice(0,limit).map(async summary => {
    const detailResponse =
    await fetchJsonWithTimeout(
      `https://www.themealdb.com/api/json/v1/${apiKey}/lookup.php?i=${summary.idMeal}`,
      {},
      4500
    );
    return (await detailResponse.json()).meals?.[0] || null;
  }));
  return filterRenderableRecipes(
    filterDiscoverySelection(details.filter(Boolean).map(mapMealDbRecipe),{cuisine,category})
  ).slice(0,limit);
}

async function fetchMealDbFallback(limit){
  if(!useTheMealDB) return [];
  const apiKey=process.env.THEMEALDB_KEY || "1";
  const attempts=Math.min(Math.max(limit,1),6);
  const settled=await Promise.allSettled(Array.from({length:attempts},async()=>{
    const response=
    await fetchJsonWithTimeout(
      `https://www.themealdb.com/api/json/v1/${apiKey}/random.php`,
      {},
      4500
    );
    if(!response.ok) throw new Error(`TheMealDB ${response.status}`);
    return (await response.json()).meals?.[0] || null;
  }));
  return filterRenderableRecipes(settled.filter(item=>item.status==="fulfilled"&&item.value).map(item=>mapMealDbRecipe(item.value)));
}

async function fetchSpoonDiscovery({ query, cuisine, category, limit }){
  if(!useSpoonacular || !process.env.SPOON_KEY) return [];
  const params = new URLSearchParams({
    apiKey:process.env.SPOON_KEY,
    number:String(limit),
    addRecipeInformation:"true",
    fillIngredients:"true",
    instructionsRequired:"true"
  });
  if(query) params.set("query", query);
  if(cuisine && PRIORITY_CUISINES[cuisine]) params.set("cuisine", PRIORITY_CUISINES[cuisine].spoon);
  if(category && !isBeverageCategory(category)) params.set("type", category);

  const response =
  await fetchJsonWithTimeout(
    `https://api.spoonacular.com/recipes/complexSearch?${params}`,
    {},
    4500
  );
  if(!response.ok) throw new Error(`Spoonacular ${response.status}`);
  const results = (await response.json()).results || [];
  const mapped=results.map(recipe => ({
    id:`spoonacular-${recipe.id}`,
    sourceId:String(recipe.id),
    source:"spoonacular",
    title:recipe.title || "Recipe",
    image:recipe.image || "",
    cuisine:PRIORITY_CUISINES[cuisine]?.label || recipe.cuisines?.[0] || "",
    country:PRIORITY_CUISINES[cuisine]?.label || recipe.cuisines?.[0] || "",
    category:recipe.dishTypes?.[0] || category || "",
    tags:[...(recipe.diets || []), ...(recipe.dishTypes || [])],
    readyInMinutes:recipe.readyInMinutes || 30,
    servings:recipe.servings || null,
    usedIngredients:normalizeIngredientList(recipe.extendedIngredients || []),
    extendedIngredients:normalizeIngredientList(recipe.extendedIngredients || []),
    analyzedInstructions:recipe.analyzedInstructions || [],
    instructions:recipe.instructions || "Recipe instructions unavailable.",
    sourceUrl:""
  }));
  return filterRenderableRecipes(
    filterDiscoverySelection(mapped,{cuisine,category})
  ).slice(0,limit);
}

async function fetchEdamamDiscovery({ query, cuisine, category, limit }){
  if(!useEdamam || !process.env.EDAMAM_APP_ID || !process.env.EDAMAM_APP_KEY) return [];
  const cuisineConfig=PRIORITY_CUISINES[cuisine];
  if(cuisine && !cuisineConfig?.edamam) return [];
  const params = new URLSearchParams({
    type:"public",
    q:query || category || PRIORITY_CUISINES[cuisine]?.label || "popular",
    app_id:process.env.EDAMAM_APP_ID,
    app_key:process.env.EDAMAM_APP_KEY,
    random:"false"
  });
  if(cuisineConfig?.edamam) params.append("cuisineType", cuisineConfig.edamam);
  if(category && !isBeverageCategory(category)) params.append("dishType", category.toLowerCase());
  const response =
  await fetchJsonWithTimeout(
    `https://api.edamam.com/api/recipes/v2?${params}`,
    {},
    4500
  );
  if(!response.ok) throw new Error(`Edamam ${response.status}`);
  const hits = (await response.json()).hits || [];
  const mapped=hits.map(hit => {
    const recipe = hit.recipe || {};
    return {
      id:`edamam-${encodeURIComponent(recipe.uri || recipe.url || recipe.label)}`,
      sourceId:recipe.uri || recipe.url || recipe.label,
      source:"edamam-live",
      title:recipe.label || "Recipe",
      image:recipe.image || "",
      cuisine:recipe.cuisineType?.[0] || "",
      country:recipe.cuisineType?.[0] || "",
      category:recipe.dishType?.[0] || "",
      tags:[...(recipe.dietLabels || []), ...(recipe.healthLabels || []).slice(0,4)],
      readyInMinutes:recipe.totalTime || 30,
      servings:recipe.yield || null,
      usedIngredients:normalizeIngredientList(recipe.ingredients || []),
      extendedIngredients:normalizeIngredientList(recipe.ingredients || []),
      instructions:"",
      sourceUrl:""
    };
  });
  return filterRenderableRecipes(
    filterDiscoverySelection(mapped,{cuisine,category})
  ).slice(0,limit);
}

function shouldKeepOriginalRecipeTitle(originalTitle, translatedTitle, lang) {
  if (lang !== "en") {
    return false;
  }

  const original =
  String(originalTitle || "");

  const translated =
  String(translatedTitle || "");

  const originalHasLatin =
  /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(original);

  const translatedHasNonLatin =
  /[\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(translated);

  return originalHasLatin && translatedHasNonLatin;
}

function isNiliStoredRecipe(recipe){
  return recipe?.source === "nili_creator" ||
    recipe?.source === "nili_database";
}

function recipeNeedsLocalization(recipe, lang){
  if(!lang) return false;
  if(isNiliStoredRecipe(recipe)) return lang !== "tr";
  return lang !== "en";
}

function storedRecipeLocalization(recipe, lang){
  const targetLang=String(lang || "").toLowerCase();
  const localizations=recipe?.localizations;
  const stored=localizations && typeof localizations === "object"
    ? localizations[targetLang]
    : null;
  return stored && typeof stored === "object"
    ? {...recipe,...stored,_localizedLang:targetLang,_detailsLocalized:true}
    : null;
}

async function localizeRecipeCollection(recipes, lang, options = {}){
  const includeDetails = options.includeDetails !== false;
  const sourceRecipes = Array.isArray(recipes) ? recipes : [];
  const targets = sourceRecipes
    .map((recipe, index) => ({ recipe, index }))
    .filter(item => recipeNeedsLocalization(item.recipe, lang));

  if(!targets.length){
    return sourceRecipes.map(recipe => ({
      ...recipe,
      _localizedLang:String(lang || "en").toLowerCase(),
      _detailsLocalized:includeDetails
    }));
  }

  const configuredTranslationProvider = String(process.env.TRANSLATION_PROVIDER || process.env.RECIPE_TRANSLATION_PROVIDER || "local").toLowerCase();
  if(!["openai", "deepl"].includes(configuredTranslationProvider)){
    return sourceRecipes.map(recipe =>
      storedRecipeLocalization(recipe, lang) || {
        ...recipe,
        _localizedLang:String(lang || "en").toLowerCase(),
        _detailsLocalized:includeDetails,
        _translationUnavailable:true
      }
    );
  }

  const ingredientEntries = [];
  targets.forEach(({ recipe }) => {
    ["usedIngredients", "missedIngredients", "extendedIngredients"]
      .forEach(field => {
        (Array.isArray(recipe[field]) ? recipe[field] : []).forEach(item => {
          const value = String(item?.original || item?.name || "").trim();
          if(value) ingredientEntries.push(value);
        });
      });
  });

  const uniqueIngredients = [...new Set(ingredientEntries)];
  const instructionStepTexts =
  targets.map(({ recipe }) => recipeInstructionStepTexts(recipe));
  const flatInstructionSteps =
  includeDetails ? instructionStepTexts.flat() : [];
  const metaTexts =
  targets.flatMap(({ recipe }) => [
    String(recipe.country || "").trim(),
    String(recipe.cuisine || "").trim(),
    String(recipe.category || "").trim(),
    String(recipe.dishType || "").trim(),
    String(recipe.localizedSubtitle || "").trim(),
    String(recipe.tip || "").trim(),
    String(recipe.servingSuggestion || "").trim(),
    String(recipe.storage || "").trim(),
    String(recipe.alternatives || "").trim(),
    String(recipe.culturalNote || "").trim()
  ]);

  const [titles, instructions, ingredientTexts, translatedIngredients, translatedStepTexts, translatedMetaTexts] =
  await Promise.all([
    translateRecipeTitlesBatch(targets.map(item => item.recipe.title || ""), lang),
    includeDetails
      ? translateTextBatch(targets.map(item => item.recipe.instructions || ""), lang, true)
      : Promise.resolve(targets.map(item => item.recipe.instructions || "")),
    includeDetails
      ? translateTextBatch(targets.map(item => item.recipe.ingredientsText || ""), lang, true)
      : Promise.resolve(targets.map(item => item.recipe.ingredientsText || "")),
    translateTextBatch(uniqueIngredients, lang, true),
    includeDetails
      ? translateTextBatch(flatInstructionSteps, lang, true)
      : Promise.resolve(flatInstructionSteps),
    translateTextBatch(metaTexts, lang, true)
  ]);

  const ingredientMap = new Map(
    uniqueIngredients.map((item, index) => [
      item,
      translatedIngredients[index] || item
    ])
  );
  const targetByIndex = new Map(
    targets.map((item, targetIndex) => [item.index, targetIndex])
  );

  const translatedStepsByTarget = [];
  let translatedStepIndex = 0;
  instructionStepTexts.forEach((steps, targetIndex) => {
    translatedStepsByTarget[targetIndex] =
    steps.map(() => translatedStepTexts[translatedStepIndex++] || "");
  });

  const metaByTarget = [];
  let metaIndex = 0;
  targets.forEach((_, targetIndex) => {
    metaByTarget[targetIndex] = {
      country: translatedMetaTexts[metaIndex++] || "",
      cuisine: translatedMetaTexts[metaIndex++] || "",
      category: translatedMetaTexts[metaIndex++] || "",
      dishType: translatedMetaTexts[metaIndex++] || "",
      localizedSubtitle: translatedMetaTexts[metaIndex++] || "",
      tip: translatedMetaTexts[metaIndex++] || "",
      servingSuggestion: translatedMetaTexts[metaIndex++] || "",
      storage: translatedMetaTexts[metaIndex++] || "",
      alternatives: translatedMetaTexts[metaIndex++] || "",
      culturalNote: translatedMetaTexts[metaIndex++] || ""
    };
  });

  const localizeArray = items =>
    (Array.isArray(items) ? items : []).map(item => {
      const original = String(item?.original || item?.name || "").trim();
      const translated = ingredientMap.get(original) || original;
      return {
        ...item,
        original: translated,
        name: translated
      };
    });

  return sourceRecipes.map((recipe, index) => {
    if(!targetByIndex.has(index)){
      return {
        ...recipe,
        _localizedLang:String(lang || "en").toLowerCase(),
        _detailsLocalized:includeDetails
      };
    }
    const targetIndex = targetByIndex.get(index);
    const translatedTitle = titles[targetIndex] || recipe.title;
    const translatedSteps = translatedStepsByTarget[targetIndex] || [];
    const translatedMeta = metaByTarget[targetIndex] || {};

    return {
      ...recipe,
      title: shouldKeepOriginalRecipeTitle(recipe.title, translatedTitle, lang)
        ? recipe.title
        : translatedTitle,
      instructions: instructions[targetIndex] || recipe.instructions,
      ingredientsText: ingredientTexts[targetIndex] || recipe.ingredientsText,
      country: translatedMeta.country || recipe.country,
      cuisine: translatedMeta.cuisine || recipe.cuisine,
      category: translatedMeta.category || recipe.category,
      dishType: translatedMeta.dishType || recipe.dishType,
      localizedSubtitle: translatedMeta.localizedSubtitle || recipe.localizedSubtitle,
      tip: translatedMeta.tip || recipe.tip,
      servingSuggestion: translatedMeta.servingSuggestion || recipe.servingSuggestion,
      storage: translatedMeta.storage || recipe.storage,
      alternatives: translatedMeta.alternatives || recipe.alternatives,
      culturalNote: translatedMeta.culturalNote || recipe.culturalNote,
      analyzedInstructions: localizeAnalyzedInstructions(recipe, translatedSteps),
      steps: Array.isArray(recipe.steps) && translatedSteps.length
        ? recipe.steps.map((step, stepIndex) =>
            typeof step === "string"
              ? translatedSteps[stepIndex] || step
              : { ...step, step: translatedSteps[stepIndex] || step?.step || "" }
          )
        : recipe.steps,
      usedIngredients: localizeArray(recipe.usedIngredients),
      missedIngredients: localizeArray(recipe.missedIngredients),
      extendedIngredients: localizeArray(recipe.extendedIngredients),
      _localizedLang:String(lang || "en").toLowerCase(),
      _detailsLocalized:includeDetails
    };
  });
}

async function localizeRecipeDetailAtomic(recipe, lang){
  const targetLang=String(lang || "en").toLowerCase();
  if(!recipeNeedsLocalization(recipe,targetLang)){
    return {
      ...recipe,
      _localizedLang:targetLang,
      _detailsLocalized:true
    };
  }

  const configuredTranslationProvider = String(process.env.TRANSLATION_PROVIDER || process.env.RECIPE_TRANSLATION_PROVIDER || "local").toLowerCase();
  if(!["openai", "deepl"].includes(configuredTranslationProvider)){
    const stored=storedRecipeLocalization(recipe,targetLang);
    if(stored) return stored;
    return {
      ...recipe,
      _localizedLang:targetLang,
      _detailsLocalized:true,
      _translationUnavailable:true
    };
  }

  const ingredientFields=["usedIngredients","missedIngredients","extendedIngredients"];
  const ingredientTexts=[];
  ingredientFields.forEach(field=>{
    (Array.isArray(recipe?.[field]) ? recipe[field] : []).forEach(item=>{
      const value=String(item?.original || item?.name || item || "").trim();
      if(value && !ingredientTexts.includes(value)) ingredientTexts.push(value);
    });
  });
  if(!ingredientTexts.length){
    const rawIngredients=String(recipe?.adminIngredientsTr || recipe?.ingredientsText || recipe?.ingredients || "")
      .replace(/\\n/g,"\n");
    rawIngredients.split(/\r?\n|\s*;\s*/).map(value=>value.trim()).filter(Boolean).forEach(value=>{
      if(!ingredientTexts.includes(value)) ingredientTexts.push(value);
    });
  }
  const stepTexts=recipeInstructionStepTexts(recipe);
  const sourcePayload={
    title:String(recipe?.title || ""),
    instructions:String(recipe?.instructions || ""),
    ingredients:ingredientTexts,
    ingredientsText:String(recipe?.ingredientsText || ""),
    steps:stepTexts,
    country:String(recipe?.country || ""),
    cuisine:String(recipe?.cuisine || ""),
    category:String(recipe?.category || ""),
    dishType:String(recipe?.dishType || "")
  };
  const sourceHash=crypto.createHash("sha1").update(JSON.stringify(sourcePayload)).digest("hex");
  const cacheKey=`detail:v5:${targetLang}:${sourceHash}`;
  if(recipeDetailTranslationCache.has(cacheKey)){
    return recipeDetailTranslationCache.get(cacheKey);
  }
  const persistentCacheDir=path.join(STORAGE_ROOT,"recipe-localizations",targetLang);
  const persistentCacheFile=path.join(persistentCacheDir,`${sourceHash}-v5.json`);
  try{
    if(fs.existsSync(persistentCacheFile)){
      const cached=JSON.parse(fs.readFileSync(persistentCacheFile,"utf8"));
      if(cached && cached._localizedLang===targetLang && cached._detailsLocalized===true){
        recipeDetailTranslationCache.set(cacheKey,cached);
        return cached;
      }
    }
  }catch(error){
    console.warn("RECIPE LOCALIZATION CACHE READ FAILED:",error.message);
  }

  let translated = null;
  const translationProvider = String(process.env.TRANSLATION_PROVIDER || process.env.RECIPE_TRANSLATION_PROVIDER || "local").toLowerCase();
  if (translationProvider === "deepl") {
    try {
      const translatedValues = await translateWithDeepL(
        [sourcePayload.title, ...ingredientTexts, ...stepTexts, sourcePayload.instructions],
        targetLang
      );
      const ingredientStart = 1;
      const stepStart = ingredientStart + ingredientTexts.length;
      const instructionIndex = stepStart + stepTexts.length;
      translated = {
        title: translatedValues[0] || sourcePayload.title,
        ingredients: translatedValues.slice(ingredientStart, stepStart),
        steps: translatedValues.slice(stepStart, instructionIndex),
        instructions: translatedValues[instructionIndex] || sourcePayload.instructions,
        ingredientsText: translatedValues.slice(ingredientStart, stepStart).join("\n"),
        country: sourcePayload.country,
        cuisine: sourcePayload.cuisine,
        category: sourcePayload.category,
        dishType: sourcePayload.dishType
      };
    } catch (error) {
      console.warn("DEEPL TRANSLATION FAILED; falling back to OpenAI:", error.message);
    }
  }

  const response=!translated ? await openai.chat.completions.create({
    model:process.env.RECIPE_TRANSLATION_MODEL || "gpt-4o",
    response_format:{type:"json_object"},
    messages:[
      {
        role:"system",
        content:`You are a professional culinary translator and recipe editor.
Translate the complete recipe into the requested language with exact culinary meaning.
Return ONLY one valid JSON object with exactly these keys:
title, instructions, ingredients, ingredientsText, steps, country, cuisine, category, dishType.
ingredients and steps must be arrays with the same item count and order as the input.
Every translatable field must use only the requested language. Keep quantities and units accurate. The title must be a clear descriptive dish name in the requested language; never return only an unchanged culturally specific original name because the original name is displayed separately.
Never add, remove, generalize, or substitute an ingredient. Never infer meat, dairy, allergens, cooking methods, or fillings that are absent from the source.
Translate measurement phrases as well as ingredient names.
Critical Turkish culinary glossary:
- un = flour; çavdar unu = rye flour; buğday unu = wheat flour
- bulgur = bulgur / cracked durum wheat, never flour
- aşurelik buğday = wheat berries / whole wheat kernels, never flour or bulgur
- asma yaprağı / üzüm yaprağı = grape leaves
- yenibahar = allspice, never nutmeg and never cinnamon
- kimyon = cumin; kişniş = coriander/cilantro according to context
- kıyma = ground/minced meat; kuzu = lamb; dana = beef
- irmik = semolina; nişasta = starch; galeta unu = breadcrumbs
- pekmez = fruit molasses; salça = concentrated tomato or pepper paste
- yoğurt = yogurt; lor = curd cheese; kaymak = clotted cream
- yemek kaşığı = tablespoon; çay kaşığı = teaspoon; su bardağı = metric cup
Mandatory target-language terminology for this request: ${criticalCulinaryGlossary(targetLang)}
For internationally established dish names, keep the original name but add a concise descriptive target-language title when needed.
Before returning JSON, silently compare every translated ingredient against its source and correct any semantic drift.`
      },
      {
        role:"user",
        content:`Language: ${getTargetLanguageName(targetLang)}\nRecipe JSON:\n${JSON.stringify(sourcePayload)}`
      }
    ]
  },{
    timeout:30000,
    maxRetries:2
  }) : null;

  const content=String(response?.choices?.[0]?.message?.content || "").trim();
  const objectMatch=content.match(/\{[\s\S]*\}/);
  if (!translated) translated=JSON.parse(objectMatch ? objectMatch[0] : content);
  if(
    !translated ||
    !Array.isArray(translated.ingredients) ||
    !Array.isArray(translated.steps)
  ){
    throw new Error("Complete recipe translation response is invalid");
  }
  // Run the paid bilingual repair only when deterministic terminology checks
  // find a real critical mismatch. The previous `!translated` condition could
  // never be true here, so validatable issues such as un -> farine stopped the
  // entire queue without giving the repair pass a chance.
  const auditRequired=criticalRecipeTranslationIssues(ingredientTexts,translated.ingredients,targetLang).length>0;
  const auditResponse=auditRequired ? await openai.chat.completions.create({
    model:process.env.RECIPE_TRANSLATION_AUDIT_MODEL || process.env.RECIPE_TRANSLATION_MODEL || "gpt-4o",
    response_format:{type:"json_object"},
    messages:[
      {
        role:"system",
        content:`You are the final bilingual culinary QA gate.
Compare the Turkish source title and ingredients with the candidate translation item by item and correct every semantic error.
Return ONLY one JSON object with exactly two keys: title and ingredients. ingredients must keep exactly the same array length and order as the source.
Do not add or remove ingredients. Do not invent a meat type, filling, allergen, cooking method, country, or dish property.
Preserve every quantity and fraction exactly. Translate measurement words naturally.
Critical meanings: un=flour; bulgur=bulgur/cracked durum wheat and NEVER flour; yenibahar=allspice and NEVER nutmeg, cinnamon, five-spice, or generic mixed spice; kimyon=cumin; galeta unu=breadcrumbs; nişasta=starch; kıyma=generic ground/minced meat unless the source explicitly names lamb, beef, pork, or chicken.
Mandatory target-language terminology for this request: ${criticalCulinaryGlossary(targetLang)}
The target title must describe only what exists in the source and must not contain source-language leftovers.
Before returning, verify every source ingredient has the same food identity in the candidate.`
      },
      {
        role:"user",
        content:`Target language: ${getTargetLanguageName(targetLang)}\nSOURCE:\n${JSON.stringify({title:sourcePayload.title,ingredients:sourcePayload.ingredients})}\nCANDIDATE:\n${JSON.stringify({title:translated.title,ingredients:translated.ingredients})}`
      }
    ]
  },{
    timeout:30000,
    maxRetries:2
  }) : null;
  const auditContent=String(auditResponse?.choices?.[0]?.message?.content || "").trim();
  const auditMatch=auditContent.match(/\{[\s\S]*\}/);
  let audited=null;
  try{
    const parsedAudit=JSON.parse(auditMatch ? auditMatch[0] : auditContent);
    if(parsedAudit && Array.isArray(parsedAudit.ingredients) && parsedAudit.ingredients.length===ingredientTexts.length){
      audited=parsedAudit;
    }
  }catch{}
  if(audited){
    translated={...translated,title:String(audited.title || translated.title || sourcePayload.title),ingredients:audited.ingredients};
  }else if(auditRequired){
    console.warn("RECIPE TRANSLATION AUDIT FORMAT INVALID; deterministic validation retained",targetLang,sourcePayload.title);
  }
  const normalizedSourceTitle=String(sourcePayload.title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/[^a-z0-9]/g,"");
  const approvedLocalizedDishTitles={
    karniyarik:{
      en:"Turkish Stuffed Eggplant",de:"Türkische gefüllte Aubergine",fr:"Aubergine farcie à la turque",
      es:"Berenjena rellena a la turca",pt:"Berinjela recheada à moda turca",ru:"Фаршированные баклажаны по-турецки",
      ar:"باذنجان محشي على الطريقة التركية",ja:"トルコ風ナスの肉詰め",zh:"土耳其风味酿茄子"
    }
  };
  if(approvedLocalizedDishTitles[normalizedSourceTitle]?.[targetLang]){
    translated.title=approvedLocalizedDishTitles[normalizedSourceTitle][targetLang];
  }
  translated.ingredients=repairCriticalIngredientTerminology(ingredientTexts,translated.ingredients,targetLang);
  const semanticIssues=criticalRecipeTranslationIssues(ingredientTexts,translated.ingredients,targetLang);
  if(semanticIssues.length){
    throw new Error(`Recipe translation semantic validation failed: ${semanticIssues.join("; ")}`);
  }
  translated.title = String(translated.title || sourcePayload.title);

  translated.ingredients = ingredientTexts.map((item,index) =>
    String(translated.ingredients[index] || item)
  );
  translated.ingredientsText = translated.ingredients.join("\n");
  translated.steps = stepTexts.map((item,index) =>
    String(translated.steps[index] || item)
  );

  const ingredientMap=new Map(
    ingredientTexts.map((item,index)=>[item,String(translated.ingredients[index] || item)])
  );
  const localizeArray=items=>(Array.isArray(items) ? items : []).map(item=>{
    const original=String(item?.original || item?.name || item || "").trim();
    const value=ingredientMap.get(original) || original;
    return typeof item==="string" ? value : {...item,original:value,name:value};
  });
  const localizedSteps=translated.steps.map((step,index)=>String(step || stepTexts[index] || ""));
  const localized={
    ...recipe,
    title:String(translated.title || recipe.title || ""),
    instructions:String(translated.instructions || recipe.instructions || ""),
    ingredientsText:String(translated.ingredientsText || recipe.ingredientsText || ""),
    country:String(translated.country || recipe.country || ""),
    cuisine:String(translated.cuisine || recipe.cuisine || ""),
    category:String(translated.category || recipe.category || ""),
    dishType:String(translated.dishType || recipe.dishType || ""),
    ingredients:translated.ingredients.map(value=>String(value || "")),
    usedIngredients:localizeArray(recipe.usedIngredients),
    missedIngredients:localizeArray(recipe.missedIngredients),
    extendedIngredients:localizeArray(recipe.extendedIngredients),
    analyzedInstructions:localizeAnalyzedInstructions(recipe,localizedSteps),
    steps:Array.isArray(recipe.steps) && recipe.steps.length
      ? recipe.steps.map((step,index)=>typeof step==="string"
        ? localizedSteps[index] || step
        : {...step,step:localizedSteps[index] || step?.step || ""})
      : localizedSteps,
    _localizedLang:targetLang,
    _detailsLocalized:true
  };
  recipeDetailTranslationCache.set(cacheKey,localized);
  try{
    fs.mkdirSync(persistentCacheDir,{recursive:true});
    writeJsonAtomic(persistentCacheFile,localized);
  }catch(error){
    console.warn("RECIPE LOCALIZATION CACHE WRITE FAILED:",error.message);
  }
  return localized;
}

app.post("/localize-recipe-detail",async(req,res)=>{
  try{
    const recipe=req.body?.recipe;
    const lang=String(req.body?.lang || "en").toLowerCase();
    if(!recipe || typeof recipe!=="object"){
      return res.status(400).json({error:"Recipe is required"});
    }
    return res.json({recipe:await localizeRecipeDetailAtomic(recipe,lang)});
  }catch(error){
    console.log("RECIPE DETAIL TRANSLATE FAILED:",error.message);
    return res.status(503).json({error:"Complete recipe translation failed"});
  }
});

app.get("/public-recipe/:id",async(req,res)=>{
  try{
    const requestedId=decodeURIComponent(String(req.params.id || "")).trim();
    const lang=String(req.query.lang || "en").toLowerCase();
    const rawId=requestedId.startsWith("nili-")
      ? requestedId.slice(5)
      : requestedId;

    const approvedRecipe=readApprovedRecipes().find(recipe=>
      [recipe.id,recipe.sourceId,recipe.systemKey]
        .filter(Boolean)
        .some(value=>String(value)===rawId || `nili-${value}`===requestedId)
    );
    let recipe=approvedRecipe ? mapNiliDiscoveryRecipe(approvedRecipe) : null;

    if(!recipe){
      recipe=readRecipeCatalog().find(item=>
        [item.id,item.sourceId,recipeCatalogKey(item)]
          .filter(Boolean)
          .some(value=>String(value)===requestedId || String(value)===rawId)
      ) || null;
    }

    if(!recipe){
      return res.status(404).json({error:"Recipe not found"});
    }

    const localizedRecipe = await localizeRecipeDetailAtomic(recipe, lang);
    return res.json({recipe:localizedRecipe});
  }catch(error){
    console.log("PUBLIC RECIPE LOAD FAILED:",error.message);
    const details=String(error?.message || error);
    const creditFailure=/\b429\b|no credits remaining|insufficient_quota|billing|quota exceeded/i.test(details);
    return res.status(creditFailure ? 503 : 500).json({
      error:creditFailure ? "OPENAI_CREDIT_EXHAUSTED" : "Recipe could not be loaded",
      details
    });
  }
});

// Local-only e-book preview. The paid production flow will use authenticated
// orders and entitlements; this endpoint must never become a public download API.
app.post("/ebook/build-preview",async(req,res)=>{
  const remoteAddress=String(req.socket?.remoteAddress || "");
  const isLoopback=["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remoteAddress);
  if(!isLoopback || process.env.NODE_ENV==="production"){
    return res.status(404).end();
  }
  const recipeIds=[...new Set((Array.isArray(req.body?.recipeIds) ? req.body.recipeIds : [])
    .map(value=>String(value || "").trim()).filter(Boolean))].slice(0,20);
  if(!recipeIds.length){
    return res.status(400).json({error:"En az bir tarif seçmelisiniz"});
  }
  const lang=String(req.body?.lang || "tr").toLowerCase();
  const allowedLanguages=new Set(["tr","en","de","fr","es","pt","ru","ar","ja","zh"]);
  if(!allowedLanguages.has(lang)){
    return res.status(400).json({error:"Desteklenmeyen kitap dili"});
  }
  const title=String(req.body?.title || "Benim Tarif Kitabım").trim().slice(0,70) || "Benim Tarif Kitabım";
  try{
    const approved=readApprovedRecipes();
    const selected=recipeIds.map(id=>{
      const plainId=id.replace(/^nili-/,"");
      return approved.find(recipe=>{
        const recipeId=String(recipe.id || "");
        const sourceId=String(recipe.sourceId || "");
        return recipeId===id || sourceId===id || recipeId===plainId || sourceId===plainId || `nili-${recipeId}`===id;
      });
    }).filter(Boolean);
    if(!selected.length) return res.status(404).json({error:"Seçilen tarifler bulunamadı"});
    const localized=await localizeRecipeCollection(selected.map(mapNiliDiscoveryRecipe),lang,{includeDetails:true});
    const jobId=`ebook-preview-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const jobDir=path.join(__dirname,"tmp","ebook-jobs");
    const outputDir=path.join(__dirname,"output","pdf");
    fs.mkdirSync(jobDir,{recursive:true});
    fs.mkdirSync(outputDir,{recursive:true});
    const inputFile=path.join(jobDir,`${jobId}.json`);
    const outputFile=path.join(outputDir,`${jobId}.pdf`);
    fs.writeFileSync(inputFile,JSON.stringify({recipes:localized},null,2),"utf8");
    const defaultPython=process.platform==="win32"
      ? path.join(__dirname,".venv-pdf","Scripts","python.exe")
      : path.join(__dirname,".venv-pdf","bin","python");
    const pythonExecutable=String(process.env.NILI_PDF_PYTHON || defaultPython);
    if(!fs.existsSync(pythonExecutable)){
      fs.rmSync(inputFile,{force:true});
      return res.status(503).json({error:"Yerel PDF ortamı hazır değil"});
    }
    const child=spawn(pythonExecutable,[
      path.join(__dirname,"generate-ebook-pdf.py"),
      `--input=${inputFile}`,
      `--output=${outputFile}`,
      `--title=${title}`,
      `--count=${selected.length}`
    ],{cwd:__dirname,windowsHide:true});
    let errorOutput="";
    const timer=setTimeout(()=>child.kill(),180000);
    child.stderr.on("data",chunk=>{errorOutput+=chunk;});
    child.on("error",error=>{
      clearTimeout(timer);
      fs.rmSync(inputFile,{force:true});
      if(!res.headersSent) res.status(500).json({error:error.message});
    });
    child.on("close",code=>{
      clearTimeout(timer);
      fs.rmSync(inputFile,{force:true});
      if(code!==0 || !fs.existsSync(outputFile)){
        if(!res.headersSent) return res.status(500).json({error:errorOutput.trim() || "PDF oluşturulamadı"});
        return;
      }
      const safeTitle=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase() || "nili-tarif-kitabi";
      res.download(outputFile,`${safeTitle}.pdf`,error=>{
        if(error) console.log("EBOOK PREVIEW DOWNLOAD FAILED:",error.message);
      });
    });
  }catch(error){
    console.log("EBOOK PREVIEW BUILD FAILED:",error.message);
    return res.status(500).json({error:"PDF taslağı oluşturulamadı"});
  }
});

app.post("/nili-recipe-archive",async(req,res)=>{
  try{
    const query=String(req.body?.query || "").trim();
    const cuisine=String(req.body?.cuisine || "").trim().toLowerCase();
    const category=String(req.body?.category || "").trim().toLowerCase();
    const creator=normalizeText(req.body?.creator || "");
    const sort=String(req.body?.sort || "newest").trim().toLowerCase();
    const lang=String(req.body?.lang || "en").trim().toLowerCase();
    const page=Math.max(Number(req.body?.page) || 1,1);
    const limit=Math.min(Math.max(Number(req.body?.limit) || 12,1),30);

    const allRecipes=filterRenderableRecipes(uniqueRecipes(searchNiliDiscovery({
      query:"",
      cuisine:"",
      category:"",
      limit:100000
    })));

    let filtered=allRecipes.filter(recipe=>{
      const searchable=catalogSearchText(recipe);
      const creatorName=normalizeText(recipe.creatorUsername || "Nili's Kitchen");
      return (!query || searchable.includes(normalizeText(query))) &&
        recipeMatchesCuisine(recipe,cuisine) &&
        recipeMatchesCategory(recipe,category) &&
        (!creator || creatorName===creator);
    });

    if(sort==="title"){
      filtered.sort((a,b)=>String(a.title || "").localeCompare(String(b.title || ""),"tr",{sensitivity:"base"}));
    }else if(sort==="popular"){
      filtered.sort((a,b)=>(Number(b.views||0)+Number(b.clicks||0))-(Number(a.views||0)+Number(a.clicks||0)));
    }else{
      const dateValue=recipe=>Date.parse(recipe.updatedAt || recipe.approvedAt || recipe.createdAt || 0) || 0;
      filtered.sort((a,b)=>dateValue(b)-dateValue(a));
    }

    const total=filtered.length;
    const totalPages=Math.max(Math.ceil(total/limit),1);
    const safePage=Math.min(page,totalPages);
    const offset=(safePage-1)*limit;
    const pageRecipes=filtered.slice(offset,offset+limit);
    const localized=await localizeRecipeCollection(pageRecipes,lang,{includeDetails:false});

    const optionValues=(field)=>[...new Set(allRecipes
      .map(recipe=>String(field(recipe)||"").trim())
      .filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"tr",{sensitivity:"base"}));

    return res.json({
      recipes:localized,
      meta:{
        page:safePage,
        limit,
        total,
        totalPages,
        hasNext:safePage<totalPages,
        hasPrevious:safePage>1
      },
      filters:{
        cuisines:optionValues(recipe=>recipe.country || recipe.cuisine),
        categories:optionValues(recipe=>recipe.dishType || recipe.category),
        creators:optionValues(recipe=>recipe.creatorUsername || "Nili's Kitchen")
      }
    });
  }catch(error){
    console.log("NILI RECIPE ARCHIVE FAILED:",error.message);
    return res.status(500).json({error:"Nili's recipe archive could not be loaded"});
  }
});

async function localizeDiscoveryRecipes(recipes, lang){
  return localizeRecipeCollection(recipes, lang);
}

app.get("/world-recipe-options", (req,res) => {
  const recipes=readApprovedRecipes();
  const optionValues=selector=>[...new Set(recipes
    .map(selector)
    .map(value=>String(value || "").trim())
    .filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"tr",{sensitivity:"base"}));
  res.json({
    cuisines:optionValues(recipe=>recipe.country || recipe.cuisine).map(value=>({id:value,label:value})),
    categories:[
      {id:"main course",label:"Ana yemek"},
      {id:"appetizer",label:"Başlangıç / meze"},
      {id:"soup",label:"Çorba"},
      {id:"salad",label:"Salata"},
      {id:"pasta",label:"Makarna / erişte"},
      {id:"seafood",label:"Balık / deniz ürünü"},
      {id:"vegetarian",label:"Sebze yemeği"},
      {id:"breakfast",label:"Kahvaltı"},
      {id:"dessert",label:"Tatlı"},
      {id:"hot beverage",label:"Sıcak içecek"},
      {id:"cold beverage",label:"Soğuk içecek"}
    ]
  });
});

app.post("/discover-recipes", async (req,res) => {
  try{
    const query = String(req.body.query || "").trim();
    const cuisine = String(req.body.cuisine || "").trim().toLowerCase();
    const category = String(req.body.category || "").trim().toLowerCase();
    const providerQuery = query || BEVERAGE_CATEGORY_SEARCH[category] || "";
    const lang = String(req.body.lang || "en").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.body.limit) || 18, 1), 30);
    const offset = Math.max(Number(req.body.offset) || 0, 0);
    const includeExternal =
      req.body.includeExternal === true ||
      req.body.includeExternal === "true";
    const niliOnly =
      req.body.niliOnly === true ||
      req.body.niliOnly === "true";
    const featured =
      req.body.featured === true ||
      req.body.featured === "true";
    const fast =
      req.body.fast === true ||
      req.body.fast === "true";
    const otherCuisines =
      req.body.otherCuisines === true ||
      req.body.otherCuisines === "true";
    const nonAlcoholic =
      req.body.nonAlcoholic === true ||
      req.body.nonAlcoholic === "true";

    if(niliOnly){
      let niliResults=searchNiliDiscovery({
        query,
        cuisine:otherCuisines ? "" : cuisine,
        category,
        limit:10000
      });

      if(otherCuisines){
        niliResults=diversifyNiliCuisines(
          niliResults.filter(recipe =>
            !resolvePriorityCuisineKey(recipe.cuisine || recipe.country)
          )
        );
      }

      if(featured){
        const pool=searchNiliDiscovery({ query:"", cuisine:"", category:"", limit:10000 });
        niliResults=buildMobileFeaturedNiliSelection(pool, limit);
      }

      const renderableNili=filterRenderableRecipes(uniqueRecipes(niliResults))
        .filter(recipe=>!nonAlcoholic || isNonAlcoholicDiscoveryRecipe(recipe));
      let pagedNili=renderableNili.slice(offset,offset+limit);
      pagedNili=await enrichEbookRecipes(pagedNili);
      if(featured){
        pagedNili=await attachMobileRecipeThumbnails(pagedNili);
      }
      const localizedNili=featured && fast
        ? pagedNili
        : featured
          ? await localizeRecipeCollection(pagedNili,lang,{ includeDetails:false })
          : await localizeDiscoveryRecipes(pagedNili,lang);
      return res.json({
        recipes:localizedNili,
        meta:{
          niliCreatorCount:localizedNili.length,
          localCount:0,
          mealDbCount:0,
          spoonCount:0,
          liveEdamamCount:0,
          fetched:false,
          fetchedSources:[],
          fallbackMode:featured
            ? fast ? "nili-featured-fast" : "nili-featured"
            : otherCuisines ? "nili-other-cuisines" : "nili-only",
          localized:!(featured && fast),
          sourceOrder:["nili_database"],
          catalogSize:readRecipeCatalog().length,
          offset,
          limit,
          total:renderableNili.length,
          hasMore:offset+localizedNili.length<renderableNili.length
        }
      });
    }

    if(!query && !cuisine && !category){
      return res.status(400).json({ error:"query, cuisine or category is required" });
    }

    const niliCreatorResults=searchNiliDiscovery({ query, cuisine, category, limit });
    const exactNiliResults =
    query
      ? niliCreatorResults.filter(recipe =>
          normalizeText(recipe.title) === normalizeText(query)
        )
      : [];

    if (exactNiliResults.length && !includeExternal) {
      const exactCombined =
      filterRenderableRecipes(exactNiliResults)
        .filter(recipe=>!nonAlcoholic || isNonAlcoholicDiscoveryRecipe(recipe))
        .slice(0, limit);

      const localizedExact = sortByRecipeSourcePriority(
        await localizeDiscoveryRecipes(exactCombined, lang)
      );

      return res.json({
        recipes: localizedExact,
        meta: {
          niliCreatorCount: exactNiliResults.length,
          localCount: 0,
          mealDbCount: 0,
          spoonCount: 0,
          liveEdamamCount: 0,
          fetched: false,
          fetchedSources: [],
          fallbackMode: "nili-exact",
          sourceOrder: ["nili_database", "themealdb", "spoonacular", "edamam-live"],
          catalogSize: readRecipeCatalog().length
        }
      });
    }

    if (exactNiliResults.length && includeExternal) {
      const similarLimit = Math.min(limit, 12);
      const catalogResults =
      searchRecipeCatalog({ query, cuisine, category, limit: similarLimit });

      const settled =
      await Promise.allSettled([
        fetchMealDbDiscovery({ query:providerQuery, cuisine, category, limit: 4 }),
        fetchSpoonDiscovery({ query:providerQuery, cuisine, category, limit: 4 }),
        fetchEdamamDiscovery({ query:providerQuery, cuisine, category, limit: 4 })
      ]);

      const mealDb =
      settled[0].status === "fulfilled" ? settled[0].value : [];
      const spoon =
      settled[1].status === "fulfilled" ? settled[1].value : [];
      const liveEdamam =
      settled[2].status === "fulfilled" ? settled[2].value : [];

      const fetchedSources = [];
      if(mealDb.length) fetchedSources.push("themealdb");
      if(spoon.length) fetchedSources.push("spoonacular");
      if(liveEdamam.length) fetchedSources.push("edamam-live");
      if(mealDb.length) upsertRecipeCatalog(mealDb);
      if(spoon.length) upsertRecipeCatalog(spoon);
      if(liveEdamam.length) upsertRecipeCatalog(liveEdamam);

      const combined =
      filterRenderableRecipes(
        uniqueRecipes([
          ...exactNiliResults,
          ...sortByRecipeSourcePriority(catalogResults),
          ...mealDb,
          ...spoon,
          ...liveEdamam
        ])
      )
        .filter(recipe=>!nonAlcoholic || isNonAlcoholicDiscoveryRecipe(recipe))
        .slice(0, similarLimit);

      const localizedExactForSimilar =
      await localizeDiscoveryRecipes(
        filterRenderableRecipes(exactNiliResults).slice(0, similarLimit),
        lang
      );

      const exactKeys =
      new Set(exactNiliResults.map(recipe => normalizeText(recipe.title)));

      const externalSimilar =
      combined.filter(recipe => !exactKeys.has(normalizeText(recipe.title)));

      const localizedSimilar = sortByRecipeSourcePriority(
      uniqueRecipes([
        ...localizedExactForSimilar,
        ...externalSimilar
      ])).slice(0, similarLimit);

      return res.json({
        recipes: localizedSimilar,
        meta: {
          niliCreatorCount: exactNiliResults.length,
          localCount: catalogResults.length,
          mealDbCount: mealDb.length,
          spoonCount: spoon.length,
          liveEdamamCount: liveEdamam.length,
          fetched: fetchedSources.length > 0,
          fetchedSources,
          fallbackMode: "nili-exact-similar",
          sourceOrder: ["nili_database", "themealdb", "spoonacular", "edamam-live"],
          catalogSize: readRecipeCatalog().length
        }
      });
    }

    const catalogResults=searchRecipeCatalog({ query, cuisine, category, limit });
    let combined=uniqueRecipes([
      ...niliCreatorResults,
      ...sortByRecipeSourcePriority(catalogResults)
    ]);
    const fetchedSources=[];
    let mealDb=[];
    let spoon=[];
    let liveEdamam=[];

    if(combined.length < limit){
      try{
        mealDb=await fetchMealDbDiscovery({ query:providerQuery, cuisine, category, limit:Math.min(12,limit-combined.length) });
        if(mealDb.length){ upsertRecipeCatalog(mealDb); combined=uniqueRecipes([...combined,...mealDb]); }
        fetchedSources.push("themealdb");
      }catch(error){ console.log("DISCOVERY THEMEALDB FAILED:",error.message); }
    }

    if(combined.length < limit){
      try{
        spoon=await fetchSpoonDiscovery({ query:providerQuery, cuisine, category, limit:Math.min(12,limit-combined.length) });
        if(spoon.length){ upsertRecipeCatalog(spoon); combined=uniqueRecipes([...combined,...spoon]); }
        fetchedSources.push("spoonacular");
      }catch(error){ console.log("DISCOVERY SPOON FAILED:",error.message); }
    }

    if(combined.length < limit){
      try{
        liveEdamam=await fetchEdamamDiscovery({ query:providerQuery, cuisine, category, limit:Math.min(12,limit-combined.length) });
        if(liveEdamam.length){
          upsertRecipeCatalog(liveEdamam);
          combined=uniqueRecipes([...combined,...liveEdamam]);
        }
        fetchedSources.push("edamam-live");
      }catch(error){ console.log("DISCOVERY EDAMAM FAILED:",error.message); }
    }

    let fallbackMode="";
    if(combined.length===0){
      const niliFallback=searchNiliDiscovery({ query:"", cuisine:"", category:"", limit });
      const catalogFallback=readRecipeCatalog()
        .sort((a,b)=>String(b.updatedAt||b.cachedAt||"").localeCompare(String(a.updatedAt||a.cachedAt||"")))
        .slice(0,limit);
      combined=uniqueRecipes([...niliFallback,...catalogFallback]);
      if(combined.length) fallbackMode="nili-popular";
    }

    if(combined.length===0){
      try{
        const mealFallback=await fetchMealDbFallback(Math.min(limit,6));
        if(mealFallback.length){
          upsertRecipeCatalog(mealFallback);
          combined=mealFallback;
          fallbackMode="themealdb-random";
          if(!fetchedSources.includes("themealdb")) fetchedSources.push("themealdb");
        }
      }catch(error){ console.log("DISCOVERY FALLBACK FAILED:",error.message); }
    }

    if(combined.length===0){
      try{
        const edamamFallback=await fetchEdamamDiscovery({ query:"popular", cuisine:"", category:"", limit:Math.min(limit,12) });
        if(edamamFallback.length){
          combined=edamamFallback;
          fallbackMode="edamam-live-popular";
          if(!fetchedSources.includes("edamam-live")) fetchedSources.push("edamam-live");
        }
      }catch(error){ console.log("DISCOVERY EDAMAM FALLBACK FAILED:",error.message); }
    }

    combined=sortByRecipeSourcePriority(
      filterRenderableRecipes(
        filterDiscoverySelection(combined,{cuisine,category})
      )
    )
      .filter(recipe=>!nonAlcoholic || isNonAlcoholicDiscoveryRecipe(recipe))
      .slice(0,limit);

    const localized = sortByRecipeSourcePriority(
      await localizeDiscoveryRecipes(combined, lang)
    );
    return res.json({
      recipes:localized,
      meta:{
        niliCreatorCount:niliCreatorResults.length,
        localCount:catalogResults.length,
        mealDbCount:mealDb.length,
        spoonCount:spoon.length,
        liveEdamamCount:liveEdamam.length,
        fetched:fetchedSources.length>0,
        fetchedSources,
        fallbackMode,
        sourceOrder:["nili_database","themealdb","spoonacular","edamam-live"],
        catalogSize:readRecipeCatalog().length
      }
    });
  }catch(error){
    console.log("DISCOVER RECIPES ERROR:", error);
    return res.status(500).json({ error:"Recipe discovery failed" });
  }
});

 /* RECIPES */

 const useSpoonacular =
process.env.USE_SPOONACULAR === "true";

const useEdamam =
process.env.USE_EDAMAM === "true";

const useTheMealDB =
process.env.USE_THEMEALDB === "true";

async function fetchSpoonacularRecipesByIngredients(ingredients, limit){
  if(!useSpoonacular || !process.env.SPOON_KEY){
    return [];
  }

  const query =
  ingredients.join(",");

  const searchResponse =
  await fetchJsonWithTimeout(
    `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(query)}&number=${Math.min(limit, 6)}&apiKey=${process.env.SPOON_KEY}`,
    {},
    4500
  );

  if(!searchResponse.ok){
    throw new Error(`Spoonacular ${searchResponse.status}`);
  }

  const basicRecipes =
  await searchResponse.json();

  if(!Array.isArray(basicRecipes) || !basicRecipes.length){
    return [];
  }

  const settled =
  await Promise.allSettled(
    basicRecipes.slice(0, limit).map(async recipe => {
      try{
        const detailResponse =
        await fetchJsonWithTimeout(
          `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${process.env.SPOON_KEY}`,
          {},
          4500
        );

        const detail =
        await detailResponse.json();

        return {
          id: recipe.id,
          sourceId: String(recipe.id),
          source: "spoonacular",
          title: recipe.title || "Recipe",
          image: recipe.image || "",
          readyInMinutes: detail.readyInMinutes || 30,
          usedIngredients: normalizeIngredientList(recipe.usedIngredients || []),
          missedIngredients: normalizeIngredientList(recipe.missedIngredients || []),
          extendedIngredients: normalizeIngredientList(detail.extendedIngredients || recipe.usedIngredients || []),
          servings: detail.servings || null,
          analyzedInstructions: detail.analyzedInstructions || [],
          instructions:
            detail.instructions ||
            "No instructions",
          sourceUrl:""
        };
      }catch{
        return {
          id: recipe.id,
          sourceId: String(recipe.id),
          source: "spoonacular",
          title: recipe.title || "Recipe",
          image: recipe.image || "",
          readyInMinutes: 30,
          usedIngredients: normalizeIngredientList(recipe.usedIngredients || []),
          missedIngredients: normalizeIngredientList(recipe.missedIngredients || []),
          extendedIngredients: normalizeIngredientList(recipe.usedIngredients || []),
          instructions: "No instructions",
          sourceUrl: ""
        };
      }
    })
  );

  return filterRenderableRecipes(settled
    .filter(item => item.status === "fulfilled" && item.value)
    .map(item => item.value));
}

async function fetchEdamamRecipesByIngredients(ingredients, limit){
  if(
    !useEdamam ||
    !process.env.EDAMAM_APP_ID ||
    !process.env.EDAMAM_APP_KEY
  ){
    return [];
  }

  const queries = [
    ingredients.slice(0, 3).join(" "),
    ingredients[0],
    ingredients[1]
  ].filter(Boolean);

  for(const query of queries){
    const response =
    await fetchJsonWithTimeout(
      `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(query)}&app_id=${process.env.EDAMAM_APP_ID}&app_key=${process.env.EDAMAM_APP_KEY}`,
      { method: "GET" },
      4500
    );

    if(!response.ok){
      continue;
    }

    const data =
    await response.json();

    if(Array.isArray(data.hits) && data.hits.length){
      return filterRenderableRecipes(data.hits.slice(0, limit).map(item => {
        const recipe = item.recipe || {};
        return {
          id: encodeURIComponent(recipe.uri || recipe.url || recipe.label),
          sourceId: recipe.uri || recipe.url || recipe.label,
          source: "edamam",
          title: recipe.label || "Recipe",
          image: recipe.image || "",
          readyInMinutes:
            recipe.totalTime && recipe.totalTime > 0
              ? recipe.totalTime
              : 30,
          usedIngredients: normalizeIngredientList(recipe.ingredients || []),
          extendedIngredients: normalizeIngredientList(recipe.ingredients || []),
          servings: recipe.yield || null,
          instructions:"",
          sourceUrl:""
        };
      }));
    }
  }

  return [];
}

async function fetchMealDbRecipesByIngredients(ingredients, limit){
  if(!useTheMealDB){
    return [];
  }

  const validIngredients =
  ingredients.filter(item =>
    !item.toLowerCase().includes("apple") &&
    !item.toLowerCase().includes("banana") &&
    !item.toLowerCase().includes("orange") &&
    !item.toLowerCase().includes("bell pepper")
  );

  const mealIngredient =
  validIngredients[0] || ingredients[0];

  const mealResponse =
  await fetchJsonWithTimeout(
    `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(mealIngredient)}`,
    {},
    4500
  );

  if(!mealResponse.ok){
    throw new Error(`TheMealDB ${mealResponse.status}`);
  }

  const mealData =
  await mealResponse.json();

  if(!Array.isArray(mealData.meals) || !mealData.meals.length){
    return [];
  }

  const settled =
  await Promise.allSettled(
    mealData.meals.slice(0, limit).map(async meal => {
      const detailResponse =
      await fetchJsonWithTimeout(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`,
        {},
        4500
      );

      const detailData =
      await detailResponse.json();

      const detail =
      detailData.meals?.[0];

      if(!detail){
        return null;
      }

      let estimatedTime = null;
      const instructionText = detail.strInstructions || "";
      const stepCount =
      instructionText
        .split(".")
        .filter(item => item.trim().length > 20)
        .length;

      if(stepCount <= 4){
        estimatedTime = 20;
      }else if(stepCount <= 7){
        estimatedTime = 30;
      }else if(stepCount <= 10){
        estimatedTime = 45;
      }else{
        estimatedTime = 60;
      }

      const usedIngredients = [];

      for(let index = 1; index <= 20; index++){
        const ing = detail[`strIngredient${index}`];
        const measure = detail[`strMeasure${index}`];

        if(ing && ing.trim()){
          usedIngredients.push({
            name: ing.trim(),
            original: `${measure || ""} ${ing}`.trim()
          });
        }
      }

      return {
        id: detail.idMeal,
        sourceId: String(detail.idMeal),
        source: "themealdb",
        title: detail.strMeal,
        image: detail.strMealThumb,
        readyInMinutes: estimatedTime,
        timeEstimated: true,
        timeLabel: `~${estimatedTime} min`,
        usedIngredients,
        extendedIngredients: usedIngredients,
        instructions:
          detail.strInstructions?.trim() ||
          "Recipe instructions unavailable.",
        sourceUrl:
          detail.strSource ||
          detail.strYoutube ||
          ""
      };
    })
  );

  return settled
    .filter(item => item.status === "fulfilled" && item.value)
    .map(item => item.value);
}

async function localizeRecipeResults(recipes, lang){
  return localizeRecipeCollection(recipes, lang);
}

app.post(
  
  "/recipes",
  async (req, res) => {

    try {

      const ingredients =
      req.body.ingredients || [];

      const originalIngredients =
      Array.isArray(req.body.originalIngredients)
        ? req.body.originalIngredients
        : ingredients;

      const offset =
Number(req.body.offset || 0);

const limit =
Math.min(Math.max(Number(req.body.limit) || 8, 1), 12);

const targetCount =
offset + limit;

      if (!ingredients.length) {
        return res.json([]);
      }

      const turkishIngredients =
      await translateTextBatch(ingredients, "tr", true);

      const ingredientGroups =
      buildIngredientAliasGroups(
        ingredients,
        originalIngredients,
        turkishIngredients
      );

      const approvedCreatorRecipes =
      findApprovedRecipesByIngredients(ingredientGroups);

      const approvedCreatorCards =
      approvedCreatorRecipes.map(recipe => {
        const mediaUrls=discoveryMediaUrls(recipe);

        return {
        id: recipe.id,
        sourceId: String(recipe.id),
        source: "nili_creator",
        title:
          recipe.adminTitleTr ||
          recipe.title ||
          "Creator Recipe",
        image: mediaUrls[0] || "",
        mediaUrl: mediaUrls[0] || "",
        mediaUrls,
        cuisine:
          recipe.cuisine ||
          recipe.country ||
          "",
        country:
          recipe.country ||
          recipe.cuisine ||
          "",
        cuisineKey:
          resolvePriorityCuisineKey(recipe.cuisine || recipe.country),
        category:
          recipe.category ||
          recipe.dishType ||
          recipe.type ||
          "",
        dishType:
          recipe.dishType ||
          recipe.type ||
          recipe.category ||
          "",
        tags:
          recipe.tags || [],
        readyInMinutes:
          recipe.prepTime || 30,
        servings:
          recipe.servings || "",
        usedIngredients:
          recipe.matchedIngredients || [],
        extendedIngredients:
          recipe.adminIngredientsTr
            ? String(recipe.adminIngredientsTr)
                .split(/\r?\n|,/)
                .map(item => ({ original: item.trim(), name: item.trim() }))
                .filter(item => item.original)
            : [],
        instructions:
          recipe.adminInstructionsTr ||
          recipe.instructions ||
          "Recipe instructions unavailable.",
        ingredientsText:
          recipe.adminIngredientsTr ||
          recipe.ingredients ||
          "",
        creatorUsername:
          recipe.creatorUsername || "",
        clicks:
          recipe.clicks || 0,
        totalBonus:
          recipe.totalBonus || 0,
        selectedIngredientCoverage:
          recipe.selectedIngredientCoverage || 0
        };
      });

      const cachedCatalogRecipes =
      searchRecipeCatalogByIngredients(
        ingredientGroups,
        targetCount
      );

      let allRecipes =
      uniqueRecipes([
        ...approvedCreatorCards,
        ...cachedCatalogRecipes
      ]);

      if(allRecipes.length < targetCount){
        const appendSourceRecipes = sourceRecipes => {
          const remaining=Math.min(6,targetCount-allRecipes.length);
          if(remaining<=0 || !Array.isArray(sourceRecipes)) return;
          const matched=filterRecipesByBestIngredientCoverage(
            sourceRecipes,
            ingredientGroups,
            remaining
          );
          if(!matched.length) return;
          upsertRecipeCatalog(matched);
          allRecipes=uniqueRecipes([...allRecipes,...matched]);
        };

        if(allRecipes.length < targetCount){
          try{
            appendSourceRecipes(await fetchMealDbRecipesByIngredients(
              ingredients,
              Math.min(6,targetCount-allRecipes.length)
            ));
          }catch(error){
            console.log("RECIPES THEMEALDB FAILED:",error.message);
          }
        }

        if(allRecipes.length < targetCount){
          try{
            appendSourceRecipes(await fetchSpoonacularRecipesByIngredients(
              ingredients,
              Math.min(6,targetCount-allRecipes.length)
            ));
          }catch(error){
            console.log("RECIPES SPOON FAILED:",error.message);
          }
        }

        if(allRecipes.length < targetCount){
          try{
            appendSourceRecipes(await fetchEdamamRecipesByIngredients(
              ingredients,
              Math.min(6,targetCount-allRecipes.length)
            ));
          }catch(error){
            console.log("RECIPES EDAMAM FAILED:",error.message);
          }
        }
      }

      if(!allRecipes.length && ingredientGroups.length){
        const primaryIngredientGroup=ingredientGroups.slice(0,1);
        const primaryApproved=findApprovedRecipesByIngredients(primaryIngredientGroup)
          .map(recipe=>({
            ...recipe,
            id:recipe.id,
            sourceId:String(recipe.id),
            source:"nili_creator",
            title:recipe.adminTitleTr || recipe.title || "Creator Recipe",
            image:primaryRecipeMediaValue(recipe),
            usedIngredients:recipe.matchedIngredients || [],
            extendedIngredients:String(recipe.adminIngredientsTr || recipe.ingredients || "")
              .split(/\r?\n|,/)
              .map(item=>({ original:item.trim(), name:item.trim() }))
              .filter(item=>item.original),
            instructions:recipe.adminInstructionsTr || recipe.instructions || "Recipe instructions unavailable."
          }));
        const primaryCatalog=searchRecipeCatalogByIngredients(
          primaryIngredientGroup,
          targetCount
        );
        allRecipes=uniqueRecipes([
          ...primaryApproved,
          ...primaryCatalog
        ]);
      }

      console.log("TOTAL RECIPES:", allRecipes.length);

console.log("NILI APPROVED RECIPES:", approvedCreatorCards.length);

const finalRecipes =
sortByRecipeSourcePriority(
  filterRenderableRecipes(allRecipes)
).slice(offset, offset + limit);

const lang =
req.body.lang || "en";

console.log("RECIPE TRANSLATE LANG:", lang);

const localizedRecipes = sortByRecipeSourcePriority(
  await localizeRecipeResults(finalRecipes, lang)
);

return res.json(localizedRecipes);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error: "Recipes failed"
      });

    }

});

/* DETAIL */

app.get(
  "/spoon-recipe/:id",
  async (req,res)=>{

    try{

      const id =
      req.params.id;

      const lang =
      req.query.lang || "en";

      const spoonKey =
      process.env.SPOON_KEY;

      const url =

`https://api.spoonacular.com/recipes/${id}/information?apiKey=${spoonKey}`;

      const r =
      await fetch(url);

      const d =
      await r.json();

      const translatedTitle =
      await translateText(
        d.title,
        lang
      );

      const translatedInstructions =
      await translateText(
        d.instructions ||
        "No instructions",
        lang
      );

      let translatedIngredients =
      [];

      for(
        const i of
        d.extendedIngredients || []
      ){

        const t =
        await translateText(
          i.original,
          lang
        );

        translatedIngredients
        .push(t);

      }

      res.json({

        title:
        translatedTitle,

        image:
        d.image,

        instructions:
        translatedInstructions,

        ingredients:
        translatedIngredients

      });

    }catch(e){

      console.log(e);

      res.json({
        error:true
      });

    }

});

/* START */

const PORT =
process.env.PORT || 3000;

const creatorUploadDir =
storagePath("creator-uploads");

const recipeImportImageDir =
storagePath("recipe-import-images");

const optimizedImageDir =
storagePath("optimized-images");

const optimizedCreatorImageDir =
path.join(optimizedImageDir, "creator");

const optimizedRecipeImportImageDir =
path.join(optimizedImageDir, "recipe-import");

const pendingRecipesDir =
storagePath("pending-recipes");

if(!fs.existsSync(creatorUploadDir)){
  fs.mkdirSync(creatorUploadDir);
}

if(!fs.existsSync(recipeImportImageDir)){
  fs.mkdirSync(recipeImportImageDir);
}

if(!fs.existsSync(pendingRecipesDir)){
  fs.mkdirSync(pendingRecipesDir);
}

fs.mkdirSync(optimizedCreatorImageDir, { recursive: true });
fs.mkdirSync(optimizedRecipeImportImageDir, { recursive: true });

function optimizedImageFileName(fileName) {
  return `${fileName}.webp`;
}

function optimizedRecipeImportUrl(fileName) {
  const optimizedName = optimizedImageFileName(fileName);
  const optimizedPath = path.join(optimizedRecipeImportImageDir, optimizedName);
  return fs.existsSync(optimizedPath)
    ? `/optimized-images/recipe-import/${optimizedName}`
    : `/recipe-import-images/${fileName}`;
}

async function optimizeCreatorUpload(file) {
  const originalUrl = `/creator-uploads/${file.filename}`;
  if (!String(file.mimetype || "").startsWith("image/")) {
    return {
      fileName: file.filename,
      url: originalUrl,
      mimetype: file.mimetype,
      originalFileName: file.filename,
      originalUrl
    };
  }

  try {
    const outputName = optimizedImageFileName(file.filename);
    const outputPath = path.join(optimizedCreatorImageDir, outputName);
    await sharp(file.path, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4, smartSubsample: true })
      .toFile(outputPath);

    return {
      fileName: outputName,
      url: `/optimized-images/creator/${outputName}`,
      mimetype: "image/webp",
      originalFileName: file.filename,
      originalUrl
    };
  } catch (error) {
    console.log("CREATOR IMAGE OPTIMIZE FALLBACK:", error.message);
    return {
      fileName: file.filename,
      url: originalUrl,
      mimetype: file.mimetype || "application/octet-stream",
      originalFileName: file.filename,
      originalUrl
    };
  }
}

async function optimizeRecipeImportFiles(fileNames) {
  const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
  const files = uniqueList(fileNames)
    .map(safeImportImageName)
    .filter(file => supported.has(path.extname(file).toLowerCase()))
    .filter(file => fs.existsSync(path.join(recipeImportImageDir, file)))
    .filter(file => {
      const input = path.join(recipeImportImageDir, file);
      const output = path.join(optimizedRecipeImportImageDir, optimizedImageFileName(file));
      return !fs.existsSync(output) || fs.statSync(output).mtimeMs < fs.statSync(input).mtimeMs;
    });

  let cursor = 0;
  let optimized = 0;
  const workers = Array.from({ length: Math.min(3, files.length) }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      try {
        await sharp(path.join(recipeImportImageDir, file), { failOn: "none" })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 78, effort: 4, smartSubsample: true })
          .toFile(path.join(optimizedRecipeImportImageDir, optimizedImageFileName(file)));
        optimized += 1;
      } catch (error) {
        console.log("IMPORT IMAGE OPTIMIZE ERROR:", file, error.message);
      }
    }
  });
  await Promise.all(workers);
  return { optimized, requested: files.length };
}

async function optimizeRecipeImportLibrary() {
  const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
  const files = fs.readdirSync(recipeImportImageDir)
    .filter(file => supported.has(path.extname(file).toLowerCase()));
  const result = await optimizeRecipeImportFiles(files);
  return result.optimized;
}

const creatorStorage =
multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, creatorUploadDir);
  },

  filename: (req, file, cb) => {
    const originalName = path.basename(String(file.originalname || "media"));
    const safeName = Date.now() + "-" + originalName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+/, "");

    cb(null, safeName || `${Date.now()}-media`);
  }
});

const creatorUpload =
multer({
  storage: creatorStorage,
  limits:{
    files: 8,
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: creatorMediaUploadFilter
});

const creatorChunkUpload=multer({
  dest:uploadTempDir,
  limits:{fileSize:3 * 1024 * 1024}
});

function creatorMediaTokenSecret(){
  return String(
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.SMTP_PASS ||
    "nili-creator-media"
  );
}

function signCreatorMediaToken(payload){
  const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature=crypto
    .createHmac("sha256",creatorMediaTokenSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function readCreatorMediaToken(token){
  const [encoded,signature]=String(token || "").split(".");
  if(!encoded || !signature) return null;
  const expected=crypto
    .createHmac("sha256",creatorMediaTokenSecret())
    .update(encoded)
    .digest("base64url");
  const actualBuffer=Buffer.from(signature);
  const expectedBuffer=Buffer.from(expected);
  if(
    actualBuffer.length!==expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer,expectedBuffer)
  ) return null;
  const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
  if(Date.now()-Number(payload.createdAt || 0)>2 * 60 * 60 * 1000) return null;
  const filePath=path.join(creatorUploadDir,path.basename(payload.filename || ""));
  if(!fs.existsSync(filePath)) return null;
  return {
    filename:path.basename(payload.filename),
    mimetype:String(payload.mimetype || "application/octet-stream")
  };
}

app.post(
  "/upload-creator-media-chunk",
  creatorChunkUpload.single("chunk"),
  (req,res)=>{
    let temporaryPath=req.file?.path || "";
    try{
      if(!req.file) return res.status(400).json({error:"Upload chunk is required"});
      const uploadId=String(req.body.uploadId || "").replace(/[^a-zA-Z0-9_-]/g,"");
      const originalName=path.basename(String(req.body.fileName || "media"));
      const mimetype=String(req.body.fileType || "application/octet-stream");
      const chunkIndex=Number(req.body.chunkIndex);
      const totalChunks=Number(req.body.totalChunks);
      const totalSize=Number(req.body.totalSize);
      const isImage=mimetype.startsWith("image/");
      const isVideo=mimetype.startsWith("video/");
      const extension=path.extname(originalName).toLowerCase();
      const allowedType=(isImage && SAFE_IMAGE_EXTENSIONS.has(extension)) ||
        (isVideo && SAFE_VIDEO_EXTENSIONS.has(extension));
      const maxSize=isImage ? 5 * 1024 * 1024 : isVideo ? 100 * 1024 * 1024 : 0;

      if(
        !uploadId || uploadId.length>80 ||
        !Number.isInteger(chunkIndex) || chunkIndex<0 ||
        !Number.isInteger(totalChunks) || totalChunks<1 || totalChunks>50 ||
        !allowedType || !maxSize || totalSize<1 || totalSize>maxSize
      ){
        return res.status(400).json({error:"Invalid media upload"});
      }

      const safeOriginal=originalName
        .replace(/[^a-zA-Z0-9._-]+/g,"-")
        .replace(/-+/g,"-") || "media";
      const storedName=`${uploadId}-${safeOriginal}`;
      const finalPath=path.join(creatorUploadDir,storedName);
      const chunkBuffer=fs.readFileSync(temporaryPath);
      if(chunkIndex===0) fs.writeFileSync(finalPath,chunkBuffer);
      else fs.appendFileSync(finalPath,chunkBuffer);
      fs.unlinkSync(temporaryPath);
      temporaryPath="";

      if(chunkIndex<totalChunks-1){
        return res.json({success:true,complete:false});
      }
      if(fs.statSync(finalPath).size!==totalSize){
        fs.unlinkSync(finalPath);
        return res.status(400).json({error:"Uploaded media size mismatch"});
      }
      return res.json({
        success:true,
        complete:true,
        token:signCreatorMediaToken({
          filename:storedName,
          mimetype,
          createdAt:Date.now()
        })
      });
    }catch(error){
      console.log("CREATOR CHUNK UPLOAD ERROR:",error.message);
      return res.status(500).json({error:"Media upload failed"});
    }finally{
      if(temporaryPath && fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }
);

const creatorSmartUpload =
multer({
  dest: uploadTempDir,
  limits:{
    files: 1,
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: imageUploadFilter
});

const adminImportUpload =
multer({
  dest: uploadTempDir,
  limits:{
    fileSize: 25 * 1024 * 1024
  }
});

function safeImportImageName(value) {
  const baseName = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[\u0000-\u001f<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return baseName || `recipe-image-${Date.now()}`;
}

const adminImportImageStorage =
multer.diskStorage({
  destination: (req, file, cb) => cb(null, recipeImportImageDir),
  filename: (req, file, cb) => cb(null, safeImportImageName(file.originalname))
});

const adminImportImageUpload =
multer({
  storage: adminImportImageStorage,
  limits:{
    files: 25,
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(String(file.originalname || "")).toLowerCase();
    const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
    const isImage = String(file.mimetype || "").startsWith("image/");
    cb(null, isImage && allowedExtensions.has(extension));
  }
});

function normalizeImportHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s/()-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRecipeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

function firstImportValue(row, headerMap, aliases) {
  for (const alias of aliases) {
    const index = headerMap.get(normalizeImportHeader(alias));
    if (index !== undefined) {
      const value = row[index];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
  }

  return "";
}

function parseNumberLike(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(String(value).replace(",", ".").match(/\d+([.,]\d+)?/)?.[0]);

  return Number.isFinite(number) ? number : String(value).trim();
}

function normalizeMediaLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]/g, "");
}

function resolveImportMediaUrl(item) {
  const rawItem =
  String(item || "").trim().replace(/^["']|["']$/g, "");

  if (/^https?:\/\//i.test(rawItem) || rawItem.startsWith("/")) {
    return rawItem;
  }

  const cleanItem =
  rawItem
    .replace(/^file:\/{2,}/i, "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .trim();

  if (!cleanItem) {
    return "";
  }

  try {
    const files =
    fs.existsSync(recipeImportImageDir)
      ? fs.readdirSync(recipeImportImageDir)
      : [];

    const exact =
    files.find(file => file === cleanItem);

    if (exact) {
      return optimizedRecipeImportUrl(exact);
    }

    const lookupKey =
    normalizeMediaLookupKey(cleanItem);

    const normalized =
    files.find(file =>
      normalizeMediaLookupKey(file) === lookupKey
    );

    if (normalized) {
      return optimizedRecipeImportUrl(normalized);
    }
  } catch (err) {
    console.log("IMPORT MEDIA LOOKUP ERROR:", err.message);
  }

  return "/recipe-import-images/" + cleanItem;
}

function normalizeImportMediaList(value) {
  const normalizedValue =
  String(value || "")
    .replace(/,\s*(png|jpe?g|webp|gif)\b/gi, ".$1");

  return normalizedValue
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(resolveImportMediaUrl)
    .filter(Boolean);
}

function buildAdminImportRecipe(row, headerMap, rowNumber) {
  const systemKey =
  firstImportValue(row, headerMap, [
    "System Key",
    "System ID",
    "Sistem Anahtarı",
    "Sistem Anahtari",
    "Internal ID"
  ]);

  const importRecipeId =
  firstImportValue(row, headerMap, [
    "Recipe ID",
    "RecipeID",
    "Tarif ID",
    "Tarif No",
    "ID",
    "No"
  ]);

  const title =
  firstImportValue(row, headerMap, [
    "Yemek Adı",
    "Tarif Adı",
    "Türkçe Ad",
    "Turkce Ad",
    "Recipe Title",
    "Title",
    "Name"
  ]);

  const type =
  firstImportValue(row, headerMap, [
    "Yemek Tipi",
    "Tür",
    "Tur",
    "Kategori",
    "Dish Type",
    "Type"
  ]);

  const cuisine =
  firstImportValue(row, headerMap, [
    "Ülke / Bölge / Mutfak",
    "Ulke / Bolge / Mutfak",
    "Ana Ülke",
    "Ana Ulke",
    "Ülke",
    "Mutfak",
    "Cuisine",
    "Country"
  ]);

  const servings =
  firstImportValue(row, headerMap, [
    "Kaç Kişilik",
    "Kac Kisilik",
    "Porsiyon",
    "Servings"
  ]);

  const prepTime =
  firstImportValue(row, headerMap, [
    "Hazırlık Süresi",
    "Hazirlik Suresi",
    "Prep Time",
    "Preparation Time"
  ]);

  const cookTime =
  firstImportValue(row, headerMap, [
    "Pişirme Süresi",
    "Pisirme Suresi",
    "Cook Time",
    "Cooking Time"
  ]);

  const ingredients =
  firstImportValue(row, headerMap, [
    "Malzemeler (Ölçülü)",
    "Malzemeler",
    "Ingredients",
    "Measured Ingredients"
  ]);

  const instructions =
  firstImportValue(row, headerMap, [
    "Tarif (Adım Adım)",
    "Tarif Adımları",
    "Tarif Adimlari",
    "Tarif",
    "Yapılış",
    "Yapilis",
    "Instructions",
    "Steps"
  ]);

  const imageUrl =
  firstImportValue(row, headerMap, [
    "Fotoğraf",
    "Fotograf",
    "Fotoğraflar",
    "Fotograflar",
    "Resim",
    "Resimler",
    "Image",
    "Images",
    "Image URL",
    "Photo",
    "Photos",
    "Photo URL",
    "Media URL"
  ]);

  const tags =
  firstImportValue(row, headerMap, [
    "Etiket",
    "Etiketler",
    "Tags",
    "Keywords"
  ]);

  const seoTitle =
  firstImportValue(row, headerMap, [
    "SEO Başlık",
    "SEO Baslik",
    "SEO Title",
    "Meta Title"
  ]);

  const seoDescription =
  firstImportValue(row, headerMap, [
    "SEO Açıklama",
    "SEO Aciklama",
    "SEO Description",
    "Meta Description"
  ]);

  const publishEnabledRaw =
  firstImportValue(row, headerMap, [
    "Yayına Açık",
    "Yayina Acik",
    "Yayınla",
    "Publish",
    "Publish Enabled"
  ]);

  // `Yeni Tarif Yükleme` is the single authoring surface for a new recipe.
  // Keep the richer editorial/card/e-book fields on the recipe object so the
  // professional workbook can distribute them to its normalized sheets after
  // approval without asking the editor to enter the same information twice.
  const professionalContent = {
    originalTitle: firstImportValue(row, headerMap, ["Orijinal Ad", "Original Title"]),
    descriptionTr: firstImportValue(row, headerMap, ["Türkçe Açıklama", "Turkce Aciklama", "Açıklama", "Description"]),
    relatedCountryRegion: firstImportValue(row, headerMap, ["İlişkili Ülke/Bölge", "Iliskili Ulke/Bolge"]),
    region: firstImportValue(row, headerMap, ["Bölge", "Bolge", "Region"]),
    kitchen: firstImportValue(row, headerMap, ["Mutfak", "Kitchen"]),
    passiveTime: firstImportValue(row, headerMap, ["Pasif Süre", "Pasif Sure"]),
    temperature: firstImportValue(row, headerMap, ["Sıcaklık", "Sicaklik", "Temperature"]),
    difficulty: firstImportValue(row, headerMap, ["Zorluk", "Difficulty"]),
    allergens: firstImportValue(row, headerMap, ["Alerjen", "Alerjenler", "Allergens"]),
    sourceUrl: firstImportValue(row, headerMap, ["Kaynak URL", "Kaynak", "Source URL"]),
    tip: firstImportValue(row, headerMap, ["Püf Noktası", "Puf Noktasi", "Tip"]),
    servingSuggestion: firstImportValue(row, headerMap, ["Servis Önerisi", "Servis Onerisi"]),
    storageSuggestion: firstImportValue(row, headerMap, ["Saklama Önerisi", "Saklama Onerisi"]),
    alternatives: firstImportValue(row, headerMap, ["Alternatif Malzemeler", "Alternatives"]),
    cultureOrigin: firstImportValue(row, headerMap, ["Kültür/Köken", "Kultur/Koken", "Kültürel Bilgi"]),
    verificationSource: firstImportValue(row, headerMap, ["Doğrulama Kaynağı", "Dogrulama Kaynagi"]),
    verificationStatus: firstImportValue(row, headerMap, ["Doğrulama Durumu", "Dogrulama Durumu"]),
    cardSummary: firstImportValue(row, headerMap, ["Kart Kısa Açıklama", "Kart Kisa Aciklama"]),
    cardIngredients: firstImportValue(row, headerMap, ["Karta Seçilmiş Malzemeler", "Karta Secilmis Malzemeler"]),
    cardSteps: firstImportValue(row, headerMap, ["Kart Adımları", "Kart Adimlari", "Yaklaşık 6 Kart Adımı"]),
    ebookIntro: firstImportValue(row, headerMap, ["E-Kitap Giriş", "E-Kitap Giris"]),
    donenessControl: firstImportValue(row, headerMap, ["Pişme/Kıvam Kontrolü", "Pisme/Kivam Kontrolu"]),
    ebookImageUrl: firstImportValue(row, headerMap, ["E-Kitap Görsel URL", "E-Kitap Gorsel URL"]),
    imageAltText: firstImportValue(row, headerMap, ["Fotoğraf Alt Metni", "Fotograf Alt Metni", "Alt Metin"]),
    editorialStatus: firstImportValue(row, headerMap, ["Editoryal Durum", "Kontrol Durumu"]),
    editorDecision: firstImportValue(row, headerMap, ["Editör Kararı", "Editor Karari"]),
    editorNote: firstImportValue(row, headerMap, ["Editör Notu", "Editor Notu", "Kontrol Notu"])
  };

  if (!title || !ingredients || !instructions) {
    return null;
  }

  const totalTime =
  [prepTime, cookTime].filter(Boolean).join(" + ");

  const mediaUrls =
  normalizeImportMediaList(imageUrl);

  const primaryMediaUrl =
  mediaUrls[0] || "";

  const recipe = {
    id: systemKey || (importRecipeId ? `admin-import-${normalizeRecipeKey(importRecipeId)}` : `admin-import-${Date.now()}-${rowNumber}`),
    systemKey: systemKey || "",
    importRecipeId: importRecipeId || "",
    creatorUsername: "Nili's Kitchen Admin Import",
    creatorEmail: firstConfiguredEmail(process.env.ADMIN_EMAIL) || firstConfiguredEmail(process.env.SMTP_USER),
    title,
    ingredients,
    instructions,
    adminTitleTr: title,
    adminIngredientsTr: ingredients,
    adminInstructionsTr: instructions,
    prepTime: totalTime || prepTime || cookTime || "",
    prepTimeText: prepTime,
    cookTimeText: cookTime,
    servings: parseNumberLike(servings, servings),
    cuisine,
    type,
    tags,
    seoTitle: seoTitle || title,
    seoDescription: seoDescription || String(instructions).replace(/\s+/g, " ").slice(0, 155),
    originalTitle: professionalContent.originalTitle || title,
    descriptionTr: professionalContent.descriptionTr,
    relatedCountryRegion: professionalContent.relatedCountryRegion,
    region: professionalContent.region,
    kitchen: professionalContent.kitchen || cuisine,
    passiveTimeText: professionalContent.passiveTime,
    temperatureText: professionalContent.temperature,
    difficulty: professionalContent.difficulty,
    allergens: professionalContent.allergens,
    sourceUrl: professionalContent.sourceUrl,
    tip: professionalContent.tip,
    servingSuggestion: professionalContent.servingSuggestion,
    storageSuggestion: professionalContent.storageSuggestion,
    alternativeIngredients: professionalContent.alternatives,
    cultureOrigin: professionalContent.cultureOrigin,
    verificationSource: professionalContent.verificationSource,
    verificationStatus: professionalContent.verificationStatus,
    cardSummary: professionalContent.cardSummary,
    cardIngredients: professionalContent.cardIngredients,
    cardSteps: professionalContent.cardSteps,
    ebookIntro: professionalContent.ebookIntro,
    donenessControl: professionalContent.donenessControl,
    ebookImageUrl: professionalContent.ebookImageUrl,
    imageAltText: professionalContent.imageAltText,
    editorialStatus: professionalContent.editorialStatus,
    editorDecision: professionalContent.editorDecision,
    editorNote: professionalContent.editorNote,
    publishEnabled: !/^(hayir|hayır|no|false|0|kapali|kapalı)$/i.test(String(publishEnabledRaw || "yes").trim()),
    mediaFile: primaryMediaUrl ? path.basename(primaryMediaUrl) : "",
    mediaUrl: primaryMediaUrl,
    mediaType: primaryMediaUrl ? "image" : "",
    image: primaryMediaUrl,
    fullImage: primaryMediaUrl,
    mediaFiles: mediaUrls.map(url => path.basename(url)),
    mediaUrls,
    mediaTypes: mediaUrls.map(() => "image"),
    status: "pending_review",
    source: "admin_excel_import",
    importRow: rowNumber,
    views: 0,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  return recipe;
}

function cleanJsonText(content) {
  return String(content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

app.post(
  "/creator/parse-recipe",
  creatorSmartUpload.single("recipeImage"),
  async (req, res) => {
    try {
      const text = String(req.body.text || "").trim();

      if (!text && !req.file) {
        return res.status(400).json({
          success: false,
          error: "Recipe text or image is required"
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          success: false,
          error: "OPENAI_API_KEY missing"
        });
      }

      const content = [
        {
          type: "text",
          text:
            "Extract a real cooking recipe from the user's text and/or recipe-page photo. Return only valid JSON with this schema: {\"title\":\"\",\"type\":\"Ana yemek\",\"cuisine\":\"Türkiye\",\"servings\":4,\"prepTime\":15,\"cookTime\":30,\"description\":\"\",\"ingredients\":[{\"name\":\"\",\"amount\":\"\",\"unit\":\"\"}],\"steps\":[\"\"]}. Use Turkish field values when possible. Do not invent ingredients if unreadable; infer only obvious cooking structure."
        }
      ];

      if (text) {
        content.push({
          type: "text",
          text: "User recipe text or voice transcript:\n" + text
        });
      }

      if (req.file) {
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString("base64");
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${req.file.mimetype};base64,${base64Image}`
          }
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a recipe extraction engine. Return only strict JSON."
          },
          {
            role: "user",
            content
          }
        ],
        temperature: 0.1
      });

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const parsed = JSON.parse(cleanJsonText(response.choices[0].message.content));

      return res.json({
        success: true,
        recipe: {
          title: parsed.title || "",
          type: parsed.type || "Ana yemek",
          cuisine: parsed.cuisine || "Türkiye",
          servings: parsed.servings || 4,
          prepTime: parsed.prepTime || 15,
          cookTime: parsed.cookTime || 30,
          description: parsed.description || "",
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          steps: Array.isArray(parsed.steps) ? parsed.steps : []
        }
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log("CREATOR PARSE RECIPE ERROR:", err.message);
      await notifyAdminError("creator-parse-recipe", err, {
        hasText: Boolean(req.body?.text),
        hasImage: Boolean(req.file)
      });
      return res.status(500).json({
        success: false,
        error: "Recipe could not be parsed"
      });
    }
  }
);

async function translateRecipeToTurkish({ title, ingredients, instructions }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        titleTr: title,
        ingredientsTr: ingredients,
        instructionsTr: instructions
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You translate recipe content to Turkish for admin review. Return only valid JSON. Do not add extra text."
        },
        {
          role: "user",
          content: JSON.stringify({
            title,
            ingredients,
            instructions,
            task:
              "Translate this recipe to clear Turkish. Keep recipe meaning. Return JSON with titleTr, ingredientsTr, instructionsTr."
          })
        }
      ],
      temperature: 0.2
    });

    let content =
      response.choices[0].message.content || "";

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(content);

    return {
      titleTr: parsed.titleTr || title,
      ingredientsTr: parsed.ingredientsTr || ingredients,
      instructionsTr: parsed.instructionsTr || instructions
    };
  } catch (err) {
    console.log("TRANSLATE RECIPE ERROR:", err.message);

    return {
      titleTr: title,
      ingredientsTr: ingredients,
      instructionsTr: instructions
    };
  }
}

app.post(
  "/submit-recipe",
  creatorUpload.array("media", 8),
  async (req, res) => {

    try{

      const {
        creatorUsername,
        creatorEmail,
        title,
        prepTime,
        servings,
        ingredients,
        instructions
      } = req.body;

      const uploadedMedia =
      Array.isArray(req.files) ? req.files : [];
      let mediaTokens=[];
      try{
        mediaTokens=JSON.parse(req.body.mediaTokens || "[]");
      }catch{
        mediaTokens=[];
      }
      const tokenMedia=(Array.isArray(mediaTokens) ? mediaTokens : [])
        .map(readCreatorMediaToken)
        .filter(Boolean);
      const allUploadedMedia=[...uploadedMedia,...tokenMedia].slice(0,8);

      if(
        !title ||
        !ingredients ||
        !instructions ||
        !allUploadedMedia.length
      ){
        return res.status(400).json({
          error:"Missing required fields"
        });
      }

      const servedMedia =
      await Promise.all(allUploadedMedia.map(optimizeCreatorUpload));

      const primaryMedia =
      servedMedia[0];

      const translated =
await translateRecipeToTurkish({
  title,
  ingredients,
  instructions
});

const recipe =
{
  id: Date.now().toString(),

  creatorUsername: creatorUsername || "Guest creator",
  creatorEmail: creatorEmail || "",

  title,
  ingredients,
  instructions,

  adminTitleTr: translated.titleTr,
  adminIngredientsTr: translated.ingredientsTr,
  adminInstructionsTr: translated.instructionsTr,

  prepTime: prepTime || "",
  servings: servings || "",

  mediaFile: primaryMedia.fileName,
  mediaUrl: primaryMedia.url,
  mediaType: primaryMedia.mimetype,
  image: primaryMedia.url,
  fullImage: primaryMedia.url,
  mediaFiles: servedMedia.map(file => file.fileName),
  mediaUrls: servedMedia.map(file => file.url),
  mediaTypes: servedMedia.map(file => file.mimetype),
  originalMediaFile: primaryMedia.originalFileName,
  originalMediaUrl: primaryMedia.originalUrl,
  originalMediaFiles: servedMedia.map(file => file.originalFileName),
  originalMediaUrls: servedMedia.map(file => file.originalUrl),

  status: "pending_review",

  views: 0,
  clicks: 0,

  createdAt: new Date().toISOString()
};

      const pendingFile =
      path.join(
        pendingRecipesDir,
        "pending_recipes.json"
      );

      let recipes =
      [];

      if(fs.existsSync(pendingFile)){
        recipes =
        JSON.parse(
          fs.readFileSync(pendingFile, "utf8")
        );
      }

      recipes.push(recipe);

      fs.writeFileSync(
  pendingFile,
  JSON.stringify(recipes, null, 2)
);

console.log("NEW CREATOR RECIPE:", recipe.title);

/* USER EMAIL: recipe received */
await sendMailSafe({
  to: creatorEmail,
  subject: "Your recipe has been received",
  text: `Your recipe "${title}" has been received and is now under review.`,
  html: `
    <h2>Your recipe has been received</h2>
    <p>Thank you for submitting your recipe.</p>
    <p><strong>${title}</strong></p>
    <p>Your recipe is now under review. If approved, it may be published on Nili's Kitchen with your creator name.</p>
  `
});

/* ADMIN EMAIL: new recipe submitted */
const adminUrl = `${process.env.SITE_URL || "https://niliskitchen.com"}/admin.html`;

await sendMailSafe({
  to: process.env.ADMIN_EMAIL,
  subject: "New recipe submitted for review",
  text: `New recipe submitted: ${title}\nOpen admin panel: ${adminUrl}`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:620px">
      <h2>New recipe submitted</h2>

      <div style="border:1px solid #e5e5e5;border-radius:16px;padding:16px;margin:16px 0">
        <h3 style="margin-top:0">${title}</h3>
        <p><strong>Creator:</strong> ${creatorUsername}</p>
        <p><strong>Email:</strong> ${creatorEmail}</p>
        <p><strong>Status:</strong> pending review</p>
      </div>

      <a href="${adminUrl}"
         style="display:inline-block;background:#1f7a4d;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">
        Open in Admin Panel
      </a>
    </div>
  `
});
      
return res.json({
  success: true,
  message: "Recipe submitted for review"
});

  } catch (err) {
    console.log("SUBMIT RECIPE ERROR:", err);
    await notifyAdminError("submit-recipe", err, {
      title: req.body?.title,
      creatorEmail: req.body?.creatorEmail
    });

    return res.status(500).json({
      error: "Submit failed"
    });
  }

});

function getRecipeStatusMail(type, lang, recipeTitle) {

  const messages = {
    approved: {
      en: {
        subject: "Your recipe has been published",
        text: `Thank you for sharing your recipe with Nili’s Kitchen. Your recipe "${recipeTitle}" has been reviewed and published. It can now appear in recipe search results.`
      },
      tr: {
        subject: "Tarifiniz yayınlandı",
        text: `Nili’s Kitchen ile tarifinizi paylaştığınız için teşekkür ederiz. "${recipeTitle}" adlı tarifiniz incelendi ve yayınlandı. Artık uygun malzeme aramalarında görünebilir.`
      },
      ru: {
        subject: "Ваш рецепт опубликован",
        text: `Спасибо, что поделились рецептом с Nili’s Kitchen. Ваш рецепт "${recipeTitle}" был проверен и опубликован. Теперь он может появляться в результатах поиска.`
      },
      fr: {
        subject: "Votre recette a été publiée",
        text: `Merci d’avoir partagé votre recette avec Nili’s Kitchen. Votre recette "${recipeTitle}" a été vérifiée et publiée. Elle peut maintenant apparaître dans les résultats de recherche.`
      },
      es: {
        subject: "Tu receta ha sido publicada",
        text: `Gracias por compartir tu receta con Nili’s Kitchen. Tu receta "${recipeTitle}" fue revisada y publicada. Ahora puede aparecer en los resultados de búsqueda.`
      },
      pt: {
        subject: "Sua receita foi publicada",
        text: `Obrigado por compartilhar sua receita com o Nili’s Kitchen. Sua receita "${recipeTitle}" foi revisada e publicada. Agora ela pode aparecer nos resultados de busca.`
      },
      ar: {
        subject: "تم نشر وصفتك",
        text: `شكرًا لمشاركة وصفتك مع Nili’s Kitchen. تمت مراجعة وصفتك "${recipeTitle}" ونشرها. يمكن أن تظهر الآن في نتائج البحث.`
      },
      de: {
  subject: "Ihr Rezept wurde veröffentlicht",
  text: `Vielen Dank, dass Sie Ihr Rezept mit Nili's Kitchen geteilt haben. Ihr Rezept "${recipeTitle}" wurde geprüft und veröffentlicht. Es kann nun in den Suchergebnissen für Rezepte erscheinen.`
},
ja: {
  subject: "あなたのレシピが公開されました",
  text: `Nili's Kitchen にレシピをご投稿いただきありがとうございます。あなたのレシピ「${recipeTitle}」は審査を通過し、公開されました。これからレシピ検索結果に表示される可能性があります。`
},
zh: {
  subject: "您的食谱已发布",
  text: `感谢您与 Nili's Kitchen 分享您的食谱。您的食谱“${recipeTitle}”已通过审核并成功发布。现在它可以出现在食谱搜索结果中。`
},
    },

    rejected: {
      en: {
        subject: "Update about your recipe submission",
        text: `Thank you for sharing your recipe with Nili’s Kitchen. After review, we are not able to publish "${recipeTitle}" at this time. You are welcome to improve it and submit it again.`
      },
      tr: {
        subject: "Tarif başvurunuz hakkında",
        text: `Nili’s Kitchen ile tarifinizi paylaştığınız için teşekkür ederiz. Yapılan inceleme sonucunda "${recipeTitle}" adlı tarifinizi şu anda yayınlayamıyoruz. Dilerseniz tarifi geliştirip tekrar gönderebilirsiniz.`
      },
      ru: {
        subject: "Информация о вашей заявке на рецепт",
        text: `Спасибо, что поделились рецептом с Nili’s Kitchen. После проверки мы пока не можем опубликовать рецепт "${recipeTitle}". Вы можете улучшить его и отправить снова.`
      },
      fr: {
        subject: "Mise à jour concernant votre recette",
        text: `Merci d’avoir partagé votre recette avec Nili’s Kitchen. Après vérification, nous ne pouvons pas publier "${recipeTitle}" pour le moment. Vous pouvez l’améliorer et la soumettre à nouveau.`
      },
      es: {
        subject: "Actualización sobre tu receta",
        text: `Gracias por compartir tu receta con Nili’s Kitchen. Después de revisarla, no podemos publicar "${recipeTitle}" en este momento. Puedes mejorarla y enviarla nuevamente.`
      },
      pt: {
        subject: "Atualização sobre sua receita",
        text: `Obrigado por compartilhar sua receita com o Nili’s Kitchen. Após a análise, não podemos publicar "${recipeTitle}" neste momento. Você pode melhorá-la e enviar novamente.`
      },
      ar: {
        subject: "تحديث بخصوص وصفتك",
        text: `شكرًا لمشاركة وصفتك مع Nili’s Kitchen. بعد المراجعة، لا يمكننا نشر وصفتك "${recipeTitle}" في الوقت الحالي. يمكنك تعديلها وإرسالها مرة أخرى.`
      },
      de: {
  subject: "Aktualisierung zu Ihrer Rezept-Einreichung",
  text: `Vielen Dank, dass Sie Ihr Rezept mit Nili's Kitchen geteilt haben. Nach der Prüfung können wir "${recipeTitle}" derzeit leider nicht veröffentlichen. Sie können es gerne verbessern und erneut einreichen.`
},
ja: {
  subject: "レシピ投稿に関するお知らせ",
  text: `Nili's Kitchen にレシピをご投稿いただきありがとうございます。審査の結果、現在のところ「${recipeTitle}」を公開することができません。内容を改善して再度ご投稿いただき、再申請することができます。`
},
zh: {
  subject: "关于您的食谱投稿的更新",
  text: `感谢您与 Nili's Kitchen 分享您的食谱。经过审核，我们目前无法发布“${recipeTitle}”。欢迎您对其进行改进后再次提交。`
},
      
    }
  };

  return messages[type]?.[lang] || messages[type]?.en;
}


function hashPassword(password){

  const salt =
  crypto.randomBytes(16).toString("hex");

  const hash =
  crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return `${salt}:${hash}`;

}

function verifyPassword(password, saved){

  const [salt, originalHash] =
  saved.split(":");

  const hash =
  crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return hash === originalHash;

}

const creatorsDir=storagePath("creator-users");
const creatorsFile=path.join(creatorsDir,"creators.json");

if(!fs.existsSync(creatorsDir)){
  fs.mkdirSync(creatorsDir);
}

if(!fs.existsSync(creatorsFile)){
  fs.writeFileSync(creatorsFile, "[]");
}

function readCreatorUsers() {
  try {
    if (!fs.existsSync(creatorsFile)) {
      fs.writeFileSync(creatorsFile, "[]");
    }

    const users = JSON.parse(fs.readFileSync(creatorsFile, "utf8"));
    return Array.isArray(users) ? users : [];
  } catch (err) {
    console.log("READ CREATOR USERS ERROR:", err.message);
    return [];
  }
}

app.post("/creator-auth", async (req, res) => {

  console.log("CREATOR AUTH CALLED");
  try {

    const {
      mode,
      username,
      emailOrUser,
      password
    } = req.body;

    const cleanUsername =
username ? username.trim().toLowerCase() : "";

const cleanEmailOrUser =
emailOrUser ? emailOrUser.trim().toLowerCase() : "";

const cleanPassword =
password ? password.trim() : "";

    if(!mode || !cleanEmailOrUser || !cleanPassword){
      return res.status(400).json({
        error:"Missing required fields"
      });
    }

    let users =
    JSON.parse(
      fs.readFileSync(creatorsFile, "utf8")
    );

    if(mode === "signup"){

      if(!cleanUsername){
        return res.status(400).json({
          error:"Username is required"
        });
      }

     const exists =
users.find(user =>
  String(user.email || "").toLowerCase() === cleanEmailOrUser ||
  String(user.username || "").toLowerCase() === cleanUsername
);

      if(exists){
        return res.status(409).json({
          error:"User already exists"
        });
      }

     const newUser =
{
  id: Date.now().toString(),
  username: cleanUsername,
  email: cleanEmailOrUser,
  passwordHash: hashPassword(cleanPassword),
  role:"creator",
  createdAt:new Date().toISOString()
};

      users.push(newUser);

      fs.writeFileSync(
        creatorsFile,
        JSON.stringify(users, null, 2)
      );

      await sendMailSafe({
  to: cleanEmailOrUser,
  subject: "🎉 Welcome to Nili's Kitchen Creator Program",
  html: `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
    
    <h1 style="color:#f97316;">
      Welcome to Nili's Kitchen 🍳
    </h1>

    <p>Hello <strong>${cleanUsername}</strong>,</p>

    <p>
      Your creator account has been successfully created.
    </p>

    <p>
      You can now upload recipes, build your creator profile,
      and share your cooking ideas with food lovers around the world.
    </p>

    <div style="margin:30px 0;">
      <a href="https://niliskitchen.com/creator.html"
         style="
         background:#f97316;
         color:white;
         padding:12px 20px;
         text-decoration:none;
         border-radius:8px;
         font-weight:bold;">
         Upload Your First Recipe
      </a>
    </div>

    <p>
      We are excited to have you in our creator community.
    </p>

    <p>
      — Nili's Kitchen Team
    </p>

  </div>
  `
});
      return res.json({
  success:true,
  username: cleanUsername,
  email: cleanEmailOrUser
});

    }

    if(mode === "login"){

     const user =
users.find(user =>
  String(user.email || "").toLowerCase() === cleanEmailOrUser ||
  String(user.username || "").toLowerCase() === cleanEmailOrUser
);

      if(!user){
        return res.status(401).json({
          error:"User not found"
        });
      }

      const valid =
verifyPassword(cleanPassword, user.passwordHash);

      if(!valid){
        return res.status(401).json({
          error:"Wrong password"
        });
      }

      return res.json({
        success:true,
        username:user.username,
        email:user.email
      });

    }

    return res.status(400).json({
      error:"Invalid mode"
    });

  }catch(err){

    console.log("CREATOR AUTH ERROR:", err);

    return res.status(500).json({
      error:"Creator auth failed"
    });

  }

});

function getPendingRecipesFile() {
  return storagePath("pending-recipes", "pending_recipes.json");
}

 

function readPendingRecipes() {
  const file = getPendingRecipesFile();
  return readProtectedArray(file, "pending-recipes");
}

function writePendingRecipes(recipes, reason = "pending-update") {
  const file = getPendingRecipesFile();
  writeProtectedArray(file, recipes, "pending-recipes", {
    reason,
    snapshot: true
  });
}

function exportIngredientText(value) {
  if (!Array.isArray(value)) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  return value
    .map(item => {
      if (typeof item === "string") return item;
      return item?.original || item?.originalString || item?.text || item?.name || "";
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\r\n?/g, "\n");
}

function exportInstructionText(recipe) {
  if (typeof recipe?.instructions === "string" && recipe.instructions.trim()) {
    return recipe.instructions.replace(/\r\n?/g, "\n");
  }

  if (Array.isArray(recipe?.instructions)) {
    return exportIngredientText(recipe.instructions);
  }

  const groups = Array.isArray(recipe?.analyzedInstructions)
    ? recipe.analyzedInstructions
    : [];

  return groups
    .flatMap(group => Array.isArray(group?.steps) ? group.steps : [])
    .map((step, index) => `${step?.number || index + 1}. ${step?.step || ""}`.trim())
    .join("\n");
}

function approvedRecipeSortValue(recipe) {
  const created = Date.parse(recipe.createdAt || "");
  const approved = Date.parse(recipe.approvedAt || "");
  const nkMatch = String(recipe.importRecipeId || "").match(/NK[-_ ]?0*(\d+)/i);
  return {
    created: Number.isFinite(created) ? created : Number.MAX_SAFE_INTEGER,
    approved: Number.isFinite(approved) ? approved : Number.MAX_SAFE_INTEGER,
    originalSequence: nkMatch ? Number(nkMatch[1]) : Number.MAX_SAFE_INTEGER,
    id: String(recipe.id || "")
  };
}

function approvedRecipeIdNumber(recipe) {
  const candidates = [recipe?.importRecipeId, recipe?.displayRecipeId, recipe?.id];
  for (const candidate of candidates) {
    const match = String(candidate || "").match(/^NK[-_ ]?0*(\d+)$/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function nextAvailableApprovedRecipeId(recipes, excludedRecipeId = "") {
  const existingNumbers = new Set(
    recipes
      .filter(recipe =>
        recipe?.deleted !== true &&
        String(recipe?.id || "") !== String(excludedRecipeId || "")
      )
      .map(approvedRecipeIdNumber)
      .filter(number => Number.isInteger(number) && number > 0)
  );
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) nextNumber += 1;
  return `NK-${String(nextNumber).padStart(6, "0")}`;
}

function compactApprovedRecipeIds(recipes) {
  const activeRecipes = recipes
    .filter(recipe => recipe?.deleted !== true)
    .sort((left, right) => {
      const leftNumber = approvedRecipeIdNumber(left);
      const rightNumber = approvedRecipeIdNumber(right);
      if (leftNumber !== null || rightNumber !== null) {
        if (leftNumber === null) return 1;
        if (rightNumber === null) return -1;
        if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      }

      const a = approvedRecipeSortValue(left);
      const b = approvedRecipeSortValue(right);
      return a.created - b.created ||
        a.approved - b.approved ||
        a.id.localeCompare(b.id);
    });

  activeRecipes.forEach((recipe, index) => {
    const compactId = `NK-${String(index + 1).padStart(6, "0")}`;
    if (String(recipe.importRecipeId || "") !== compactId) {
      recipe.previousImportRecipeId = String(recipe.importRecipeId || "");
      recipe.importRecipeId = compactId;
      recipe.idCompactedAt = new Date().toISOString();
    }
  });

  return recipes;
}

function sequentialApprovedRecipes(recipes) {
  const existingNumbers = new Set(
    recipes
      .map(approvedRecipeIdNumber)
      .filter(number => Number.isInteger(number) && number > 0)
  );
  let nextNumber = 1;

  return [...recipes]
    .sort((left, right) => {
      const leftNumber = approvedRecipeIdNumber(left);
      const rightNumber = approvedRecipeIdNumber(right);
      if (leftNumber !== null || rightNumber !== null) {
        if (leftNumber === null) return 1;
        if (rightNumber === null) return -1;
        if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      }

      const a = approvedRecipeSortValue(left);
      const b = approvedRecipeSortValue(right);
      return a.created - b.created ||
        a.approved - b.approved ||
        a.id.localeCompare(b.id);
    })
    .map(recipe => {
      let number = approvedRecipeIdNumber(recipe);
      if (number === null) {
        while (existingNumbers.has(nextNumber)) nextNumber += 1;
        number = nextNumber;
        existingNumbers.add(number);
        nextNumber += 1;
      }

      return {
        recipe,
        displayRecipeId: `NK-${String(number).padStart(6, "0")}`
      };
    });
}

function getPublicSiteUrl(req) {
  return String(
    process.env.SITE_URL ||
    `${req.protocol || "https"}://${req.get?.("host") || "niliskitchen.com"}` ||
    "https://niliskitchen.com"
  )
    .replace(/^http:\/\/(?=(?:www\.)?niliskitchen\.com)/i, "https://")
    .replace(/\/+$/, "");
}

function getPublicAssetUrl(req) {
  return String(
    process.env.ASSET_URL ||
    process.env.API_URL ||
    `${req.protocol || "https"}://${req.get?.("host") || "api.niliskitchen.com"}` ||
    "https://api.niliskitchen.com"
  )
    .replace(/^http:\/\/(?=api\.niliskitchen\.com)/i, "https://")
    .replace(/\/+$/, "");
}

function toPublicRecipeUrl(value, req) {
  const raw = String(value || "").trim();

  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const cleanPath = raw.replace(/\\/g, "/");
  const isServedAsset =
    cleanPath.startsWith("/optimized-images/") ||
    cleanPath.startsWith("/recipe-import-images/") ||
    cleanPath.startsWith("/creator-uploads/") ||
    cleanPath.startsWith("/uploads/") ||
    cleanPath.startsWith("/flags/");

  const siteUrl = isServedAsset ? getPublicAssetUrl(req) : getPublicSiteUrl(req);

  if (cleanPath.startsWith("/")) {
    return `${siteUrl}${cleanPath}`;
  }

  return `${siteUrl}/${cleanPath.replace(/^\/+/, "")}`;
}

function uniqueList(values) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
}

function firstConfiguredEmail(value) {
  return String(value || "")
    .split(/[;,]/)
    .map(item => item.trim())
    .find(Boolean) || "";
}

function primaryRecipeMediaValue(recipe) {
  const candidates = [
    recipe?.mediaUrl,
    ...(Array.isArray(recipe?.mediaUrls) ? recipe.mediaUrls : []),
    recipe?.fullImage,
    recipe?.image
  ];
  const primary = candidates.map(value => String(value || "").trim()).find(Boolean);

  if (primary) return primary;

  const mediaFile = String(recipe?.mediaFile || "").trim();
  if (!mediaFile) return "";
  if (mediaFile.startsWith("/") || /^https?:\/\//i.test(mediaFile)) return mediaFile;
  return `/creator-uploads/${mediaFile}`;
}

function recipeMediaValues(recipe, req) {
  const primary = primaryRecipeMediaValue(recipe);
  return primary ? [toPublicRecipeUrl(primary, req)] : [];
}

function excelLinkCell(urls, fallback = "") {
  const values = uniqueList(urls);
  const text = values.join("; ") || String(fallback || "");

  if (!values.length) return text;

  return {
    t: "s",
    v: text,
    l: {
      Target: values[0],
      Tooltip: values.length > 1
        ? "Ilk fotografi ac. Diger linkler hucrede listelenir."
        : "Fotografi ac"
    }
  };
}

function isDashboardPublishedRecipe(recipe) {
  const status = String(recipe?.status || "").trim().toLowerCase();

  return recipe &&
    recipe.publishEnabled !== false &&
    !["pending_review", "pending", "rejected", "draft", "archived"].includes(status);
}

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const adminLoginAttempts = new Map();

function adminAuthConfigured() {
  return Boolean((process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORDS) && process.env.ADMIN_SESSION_SECRET);
}

function adminPasswordMatches(password) {
  const submitted = String(password || "");
  const passwords = String(process.env.ADMIN_PASSWORDS || process.env.ADMIN_PASSWORD || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  return passwords.some(passwordValue => secureStringEqual(submitted, passwordValue));
}

function secureStringEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left || "")).digest();
  const rightHash = crypto.createHash("sha256").update(String(right || "")).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex")
  })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!adminAuthConfigured() || !token) return false;

  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra) return false;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  if (!secureStringEqual(signature, expectedSignature)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!verifyAdminToken(token)) {
    return res.status(401).json({
      success: false,
      error: "Admin authorization required"
    });
  }

  next();
}

app.post("/admin/login", (req, res) => {
  if (!adminAuthConfigured()) {
    return res.status(503).json({
      success: false,
      error: "Admin access is not configured"
    });
  }

  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let attempt = adminLoginAttempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + ADMIN_LOGIN_WINDOW_MS };
  }

  if (attempt.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      error: "Too many login attempts. Please try again later."
    });
  }

  if (!adminPasswordMatches(req.body?.password)) {
    attempt.count += 1;
    adminLoginAttempts.set(key, attempt);
    return res.status(401).json({
      success: false,
      error: "Invalid admin password"
    });
  }

  adminLoginAttempts.delete(key);
  res.json({
    success: true,
    token: createAdminToken(),
    expiresIn: ADMIN_SESSION_TTL_MS
  });
});

app.get("/admin/session", requireAdmin, (req, res) => {
  res.json({ success: true });
});

app.post("/contact-message", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const message = String(req.body?.message || "").trim();
    const page = String(req.body?.page || "").trim();
    const lang = String(req.body?.lang || "").trim();

    if (!message || message.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    const recipients =
      process.env.ADMIN_EMAIL ||
      process.env.ALERT_EMAILS ||
      process.env.SMTP_USER;

    await sendMailSafe({
      to: recipients,
      subject: `Nili's Kitchen user message${name ? ` - ${name}` : ""}`,
      text:
        `Name: ${name || "-"}\n` +
        `Email: ${email || "-"}\n` +
        `Language: ${lang || "-"}\n` +
        `Page: ${page || "-"}\n\n` +
        message,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.55">
          <h2>Nili's Kitchen user message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name || "-")}</p>
          <p><strong>Email:</strong> ${escapeHtml(email || "-")}</p>
          <p><strong>Language:</strong> ${escapeHtml(lang || "-")}</p>
          <p><strong>Page:</strong> ${escapeHtml(page || "-")}</p>
          <hr>
          ${escapeHtml(message).split(/\n+/).map(line => `<p>${line}</p>`).join("")}
        </div>
      `
    });

    res.json({ success: true });
  } catch (err) {
    await notifyAdminError("contact-message", err, {
      email: req.body?.email,
      page: req.body?.page
    });
    res.status(500).json({
      success: false,
      error: "Message could not be sent"
    });
  }
});

// Every route registered below this point under /admin requires authentication.
app.use("/admin", requireAdmin);

let activeRecipeCardGeneratorChild = null;
let activeRecipeCardGeneratorStopTimer = null;

function stopActiveRecipeCardGenerator() {
  const child = activeRecipeCardGeneratorChild;
  if (!child || child.exitCode !== null) return false;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide:true });
    } else {
      // The generator is started as its own process group so Chromium and any
      // other descendants stop together with the Node generator.
      process.kill(-child.pid, "SIGTERM");
      activeRecipeCardGeneratorStopTimer = setTimeout(() => {
        try { process.kill(-child.pid, "SIGKILL"); } catch {}
      }, 2000);
      activeRecipeCardGeneratorStopTimer.unref?.();
    }
    return true;
  } catch {
    try { return child.kill("SIGTERM"); } catch { return false; }
  }
}

function stopOrphanedRecipeCardGenerators() {
  if (process.platform === "win32") return;
  try {
    const killer = spawn("pkill", ["-TERM", "-f", "[r]ender-master-reference-karniyarik-card.mjs|[g]enerate-reference-recipe-card.mjs"], {
      detached:true,
      stdio:"ignore"
    });
    killer.unref();
    const forceTimer = setTimeout(() => {
      try {
        const forceKiller = spawn("pkill", ["-KILL", "-f", "[r]ender-master-reference-karniyarik-card.mjs|[g]enerate-reference-recipe-card.mjs"], {
          detached:true,
          stdio:"ignore"
        });
        forceKiller.unref();
      } catch {}
    }, 2000);
    forceTimer.unref?.();
  } catch {}
}

function runRecipeCardGenerator(recipeId, lang = "en") {
  return new Promise((resolve, reject) => {
    // All admin card generation must use the approved Karnıyarık master.
    // The legacy AI visual-base generator produces a different card design and
    // must not be reachable from the production queue.
    const generatorFile = "render-master-reference-karniyarik-card.mjs";
    const child = spawn(process.execPath, [
      path.join(__dirname, generatorFile),
      `--id=${recipeId}`,
      `--lang=${lang}`
    ], { cwd: __dirname, windowsHide: true, detached:process.platform !== "win32" });
    activeRecipeCardGeneratorChild = child;
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Card generation timed out"));
    }, 180000);
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { errorOutput += chunk; });
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      if (activeRecipeCardGeneratorChild === child) activeRecipeCardGeneratorChild = null;
      if (activeRecipeCardGeneratorStopTimer) clearTimeout(activeRecipeCardGeneratorStopTimer);
      activeRecipeCardGeneratorStopTimer = null;
      clearTimeout(timer);
      if (code === 0) {
        try {
          const legacyManifestFile = path.join(__dirname, "recipe-posters", "pending-manifest.json");
          const currentManifestFile = path.join(__dirname, "recipe-posters", "pending-manifest-v2.json");
          const legacy = fs.existsSync(legacyManifestFile) ? JSON.parse(fs.readFileSync(legacyManifestFile, "utf8")) : [];
          const current = fs.existsSync(currentManifestFile) ? JSON.parse(fs.readFileSync(currentManifestFile, "utf8")) : [];
          const merged = Array.isArray(current) ? current : [];
          (Array.isArray(legacy) ? legacy : []).forEach(item => {
            const index = merged.findIndex(existing => existing.key === item.key);
            if (index >= 0) merged[index] = item;
            else merged.push(item);
          });
          writeJsonAtomic(currentManifestFile, merged);
        } catch (manifestError) {
          console.warn("RECIPE CARD MANIFEST SYNC FAILED:", manifestError.message);
        }
        resolve(output.trim());
      }
      else reject(new Error(errorOutput.trim() || output.trim() || `Generator exited with ${code}`));
    });
  });
}

const RECIPE_CARD_LANGUAGES = ["en","tr","de","fr","es","pt","ru","ar","ja","zh"];
const RECIPE_CARD_PRODUCTION_LANGUAGES = ["en","tr","de","fr","es","pt","ru","ar","ja","zh"];
const recipeCardGenerationQueueFile = path.join(__dirname, "recipe-posters", "generation-queue.json");
const recipeCardGenerationControlFile = path.join(__dirname, "recipe-posters", "generation-control.json");

function readRecipeCardGenerationControl() {
  try {
    const value = JSON.parse(fs.readFileSync(recipeCardGenerationControlFile, "utf8"));
    return {
      paused:value?.paused === true,
      updatedAt:value?.updatedAt || "",
      reason:String(value?.reason || ""),
      code:String(value?.code || "")
    };
  } catch {
    return { paused:false, updatedAt:"", reason:"", code:"" };
  }
}

function setRecipeCardGenerationPaused(paused, metadata = {}) {
  const control = {
    paused:Boolean(paused),
    updatedAt:new Date().toISOString(),
    reason:paused ? String(metadata.reason || "") : "",
    code:paused ? String(metadata.code || "") : ""
  };
  writeJsonAtomic(recipeCardGenerationControlFile, control);
  return control;
}
let recipeCardGenerationWorkerRunning = false;

function readRecipeCardGenerationQueue() {
  try {
    const value = JSON.parse(fs.readFileSync(recipeCardGenerationQueueFile, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function recoverInterruptedRecipeCardJobs() {
  const queue = readRecipeCardGenerationQueue();
  let recovered = 0;
  const now = new Date().toISOString();
  queue.forEach(job => {
    if (job.status !== "running") return;
    job.status = "queued";
    job.recoveredAt = now;
    job.updatedAt = now;
    job.error = "Previous card generation was interrupted; queued to resume";
    recovered += 1;
  });
  if (recovered) writeRecipeCardGenerationQueue(queue);
  return recovered;
}

function writeRecipeCardGenerationQueue(items) {
  writeJsonAtomic(recipeCardGenerationQueueFile, items);
}

function recipeCardHasUsableImage(recipe) {
  return Boolean(primaryRecipeMediaValue(recipe));
}

function recipeCardFatalTranslationFailure(error) {
  const message=String(error?.message || error);
  if (/OPENAI_CREDIT_EXHAUSTED|\b429\b|no credits remaining|insufficient_quota|billing|quota exceeded/i.test(message)) {
    return {code:"OPENAI_CREDIT_EXHAUSTED",reason:"OpenAI kredisi tükendi veya kullanım kotası aşıldı. Üretim otomatik durduruldu."};
  }
  if (/MODULE_NOT_FOUND|Cannot find module|Chrome or Chromium is required/i.test(message)) {
    return {code:"GENERATOR_INFRASTRUCTURE_ERROR",reason:"Kart üretim motorunda eksik dosya veya tarayıcı bileşeni bulundu. Toplu hata oluşmaması için üretim otomatik durduruldu."};
  }
  return null;
}

function recipeCardSkippableValidationFailure(error) {
  const message=String(error?.message || error);
  return /card localization validation failed|recipe localization failed|recipe translation semantic validation failed/i.test(message);
}

function queueRecipeCardGeneration(recipeIds, { force = false, reason = "automatic", languages = RECIPE_CARD_PRODUCTION_LANGUAGES } = {}) {
  const requestedIds = new Set((Array.isArray(recipeIds) ? recipeIds : [recipeIds]).map(String).filter(Boolean));
  if (!requestedIds.size) return { added:0, skipped:0 };
  const requestedLanguages = [...new Set((Array.isArray(languages) ? languages : []).map(value => String(value).toLowerCase()))]
    .filter(value => RECIPE_CARD_PRODUCTION_LANGUAGES.includes(value));
  if (!requestedLanguages.length) return { added:0, skipped:0, recipes:0, languages:[] };

  const recipes = readApprovedRecipes().filter(recipe =>
    requestedIds.has(String(recipe.id)) &&
    recipe.status === "approved" &&
    recipe.publishEnabled !== false &&
    recipe.deleted !== true &&
    recipe.archived !== true &&
    recipeCardHasUsableImage(recipe)
  );
  const manifest = readRecipeCardManifest();
  const queue = readRecipeCardGenerationQueue();
  let added = 0;
  let skipped = 0;
  const batchId = `card-batch-${Date.now()}`;

  recipes.forEach(recipe => {
    const urls = recipe.recipeCardUrls && typeof recipe.recipeCardUrls === "object" ? recipe.recipeCardUrls : {};
    const statuses = recipe.recipeCardStatuses && typeof recipe.recipeCardStatuses === "object" ? recipe.recipeCardStatuses : {};
    requestedLanguages.forEach(lang => {
      const key = `${recipe.id}:${lang}`;
      const alreadyApproved = statuses[lang] === "approved" && recipeCardLocalFileExists(urls[lang]);
      const alreadyPending = manifest.some(item => item.key === key && String(item.status || "pending") === "pending");
      const activeJob = queue.some(item => item.key === key && ["queued","running"].includes(item.status));
      if (activeJob || (!force && (alreadyApproved || alreadyPending))) {
        skipped += 1;
        return;
      }
      const previous = queue.findIndex(item => item.key === key);
      const job = {
        key,
        batchId,
        recipeId:String(recipe.id),
        lang,
        status:"queued",
        reason,
        attempts:0,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        error:""
      };
      if (previous >= 0) queue[previous] = job;
      else queue.push(job);
      added += 1;
    });
  });

  writeRecipeCardGenerationQueue(queue);
  // Translation-validation failures are now isolated per card. Clear only the
  // obsolete automatic translation stop when an admin explicitly queues new
  // work. Manual, credit and infrastructure stops remain persistent.
  const control=readRecipeCardGenerationControl();
  if(control.paused && control.code==="TRANSLATION_UNHEALTHY") setRecipeCardGenerationPaused(false);
  setImmediate(processRecipeCardGenerationQueue);
  return { added, skipped, recipes:recipes.length, languages:requestedLanguages };
}

async function processRecipeCardGenerationQueue() {
  if (recipeCardGenerationWorkerRunning) return;
  recipeCardGenerationWorkerRunning = true;
  try {
    while (true) {
      if (readRecipeCardGenerationControl().paused) break;
      const queue = readRecipeCardGenerationQueue();
      const index = queue.findIndex(item => item.status === "queued" || item.status === "running");
      if (index < 0) break;
      const job = queue[index];
      job.status = "running";
      job.attempts = Number(job.attempts || 0) + 1;
      job.startedAt = new Date().toISOString();
      job.updatedAt = job.startedAt;
      writeRecipeCardGenerationQueue(queue);
      try {
        await runRecipeCardGenerator(job.recipeId, job.lang);
        const latestAfterRun = readRecipeCardGenerationQueue().find(item => item.key === job.key);
        if (latestAfterRun?.status === "cancelled") {
          Object.assign(job, latestAfterRun);
        } else {
          job.status = "completed";
          job.completedAt = new Date().toISOString();
          job.error = "";
        }
      } catch (error) {
        const latestAfterError = readRecipeCardGenerationQueue().find(item => item.key === job.key);
        const fatalTranslationFailure = recipeCardFatalTranslationFailure(error);
        const skippableValidationFailure = recipeCardSkippableValidationFailure(error);
        console.error(
          "RECIPE CARD GENERATION FAILED:",
          JSON.stringify({ recipeId:job.recipeId, lang:job.lang, error:String(error?.message || error).slice(0,4000) })
        );
        if (latestAfterError?.status === "cancelled") {
          Object.assign(job, latestAfterError);
        } else if (fatalTranslationFailure) {
          job.status = "failed";
          job.error = String(error?.message || error).slice(0,1000);
          job.failedAt = new Date().toISOString();
          setRecipeCardGenerationPaused(true, fatalTranslationFailure);
        } else if (skippableValidationFailure) {
          // A content-specific validation problem must not block unrelated
          // recipes. Record it once and continue with the next queued card.
          job.status = "failed";
          job.error = String(error?.message || error).slice(0,1000);
          job.failedAt = new Date().toISOString();
        } else if (readRecipeCardGenerationControl().paused) {
          // A manually stopped card stays queued and can be continued later;
          // it must not consume a retry or appear as a translation failure.
          job.status = "queued";
          job.attempts = Math.max(0, Number(job.attempts || 1) - 1);
          job.error = "";
          job.stoppedAt = new Date().toISOString();
        } else {
          job.status = job.attempts < 3 ? "queued" : "failed";
          job.error = String(error?.message || error).slice(0,1000);
          job.failedAt = new Date().toISOString();
        }
      }
      job.updatedAt = new Date().toISOString();
      const latestQueue = readRecipeCardGenerationQueue();
      const latestIndex = latestQueue.findIndex(item => item.key === job.key);
      // An admin cancellation/reset made after this worker started always wins.
      // Never recreate a deleted queue job or overwrite its cancelled state.
      if (latestIndex >= 0 && latestQueue[latestIndex].status !== "cancelled") latestQueue[latestIndex] = job;
      writeRecipeCardGenerationQueue(latestQueue);
    }
  } finally {
    recipeCardGenerationWorkerRunning = false;
  }
}

function recipeCardGenerationQueueSummary() {
  const queue = readRecipeCardGenerationQueue();
  const counts = queue.reduce((result,item) => {
    result[item.status] = Number(result[item.status] || 0) + 1;
    return result;
  },{});
  const batchGroups = new Map();
  queue.forEach(job => {
    const createdAt = String(job.createdAt || "");
    const batchKey = String(job.batchId || `legacy:${createdAt.slice(0, 19)}`);
    if (!batchGroups.has(batchKey)) batchGroups.set(batchKey, { key:batchKey, createdAt, jobs:[] });
    const group = batchGroups.get(batchKey);
    group.jobs.push(job);
    if (createdAt > group.createdAt) group.createdAt = createdAt;
  });
  const latestGroup = [...batchGroups.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const currentBatch = latestGroup ? {
    id:latestGroup.key,
    createdAt:latestGroup.createdAt,
    total:latestGroup.jobs.length,
    counts:latestGroup.jobs.reduce((result, item) => {
      result[item.status] = Number(result[item.status] || 0) + 1;
      return result;
    }, {})
  } : { id:"", createdAt:"", total:0, counts:{} };
  const control=readRecipeCardGenerationControl();
  return { total:queue.length, counts, currentBatch, workerRunning:recipeCardGenerationWorkerRunning, paused:control.paused, pauseReason:control.reason || "", pauseCode:control.code || "", pauseUpdatedAt:control.updatedAt || "" };
}
const recipeCardManifestFile = path.join(__dirname, "recipe-posters", "pending-manifest-v2.json");

function readRecipeCardManifest() {
  try {
    const value = JSON.parse(fs.readFileSync(recipeCardManifestFile, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function recipeCardLocalFileExists(url) {
  const raw = String(url || "").trim();
  if (!raw || /^https?:\/\//i.test(raw)) return Boolean(raw);
  const file = path.resolve(__dirname, raw.replace(/^\/+/, ""));
  const posterRoot = path.resolve(__dirname, "recipe-posters") + path.sep;
  return file.startsWith(posterRoot) && fs.existsSync(file);
}

function writeRecipeCardManifest(items) {
  writeJsonAtomic(recipeCardManifestFile, items);
}

app.get("/admin/recipe-card-queue", (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 60));
  const requestedStatus = String(req.query.status || "pending").toLowerCase();
  const pendingItems = readRecipeCardManifest()
    .filter(item => requestedStatus === "all" || String(item?.status || "pending").toLowerCase() === requestedStatus)
    .sort((a,b) =>
      Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0)
    );
  const offset = (page - 1) * limit;
  const items = pendingItems.slice(offset, offset + limit);
  res.json({
    success:true,
    items,
    page,
    limit,
    total:pendingItems.length,
    hasMore:offset + items.length < pendingItems.length
  });
});

app.get("/admin/recipe-card/:id/languages", (req, res) => {
  const id = String(req.params.id || "");
  const recipe = readApprovedRecipes().find(item => String(item.id) === id);
  if (!recipe) return res.status(404).json({ success:false, error:"Recipe not found" });
  const urls = recipe.recipeCardUrls && typeof recipe.recipeCardUrls === "object" ? recipe.recipeCardUrls : {};
  const statuses = recipe.recipeCardStatuses && typeof recipe.recipeCardStatuses === "object" ? recipe.recipeCardStatuses : {};
  const manifest = readRecipeCardManifest();
  const cards = RECIPE_CARD_LANGUAGES.map(lang => {
    const item = manifest
      .filter(value => String(value.recipeId) === id && String(value.lang) === lang)
      .sort((a,b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0))[0];
    const approvedUrl = statuses[lang] === "approved" && recipeCardLocalFileExists(urls[lang]) ? urls[lang] : "";
    return {
      lang,
      status:approvedUrl ? "approved" : String(item?.status || statuses[lang] || "missing"),
      url:approvedUrl || item?.url || "",
      generatedAt:item?.generatedAt || ""
    };
  });
  return res.json({ success:true, recipeId:id, title:recipe.adminTitleTr || recipe.title || "", cards });
});

app.delete("/admin/recipe-card/:id/:lang", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const lang = String(req.params.lang || "").toLowerCase();
    if (!RECIPE_CARD_LANGUAGES.includes(lang)) return res.status(400).json({ success:false, error:"Unsupported language" });
    const recipes = readApprovedRecipes();
    const recipeIndex = recipes.findIndex(recipe => String(recipe.id) === id);
    if (recipeIndex < 0) return res.status(404).json({ success:false, error:"Recipe not found" });
    const manifest = readRecipeCardManifest();
    const removedItems = manifest.filter(item => String(item.recipeId) === id && String(item.lang) === lang);
    const posterRoot = path.resolve(__dirname, "recipe-posters") + path.sep;
    const files = new Set();
    removedItems.forEach(item => {
      if (item.file) files.add(path.resolve(__dirname, String(item.file).replace(/^\/+/, "")));
      if (item.approvedUrl) files.add(path.resolve(__dirname, String(item.approvedUrl).replace(/^\/+/, "")));
    });
    const recipe = { ...recipes[recipeIndex] };
    const urls = { ...(recipe.recipeCardUrls || {}) };
    const statuses = { ...(recipe.recipeCardStatuses || {}) };
    if (urls[lang]) files.add(path.resolve(__dirname, String(urls[lang]).replace(/^\/+/, "")));
    for (const file of files) {
      if (!file.startsWith(posterRoot)) throw new Error("Unsafe recipe-card file path");
      await removeRecipeCardFileBestEffort(file);
    }
    delete urls[lang];
    delete statuses[lang];
    recipe.recipeCardUrls = urls;
    recipe.recipeCardStatuses = statuses;
    recipes[recipeIndex] = recipe;
    writeApprovedRecipes(recipes, { reason:`recipe-card-delete-${lang}` });
    writeRecipeCardManifest(manifest.filter(item => !(String(item.recipeId) === id && String(item.lang) === lang)));
    const queue = readRecipeCardGenerationQueue();
    queue.forEach(job => {
      if (String(job.recipeId) === id && String(job.lang) === lang && ["queued","running"].includes(job.status)) {
        job.status = "cancelled";
        job.cancelledAt = new Date().toISOString();
        job.updatedAt = job.cancelledAt;
      }
    });
    writeRecipeCardGenerationQueue(queue);
    return res.json({ success:true, recipeId:id, lang, removed:removedItems.length });
  } catch (error) {
    return res.status(500).json({ success:false, error:"Recipe card could not be deleted", details:error.message });
  }
});

app.delete("/admin/recipe-card/:id", async (req, res) => {
  const id = String(req.params.id || "");
  const recipe = readApprovedRecipes().find(item => String(item.id) === id);
  if (!recipe) return res.status(404).json({ success:false, error:"Recipe not found" });
  const results = [];
  for (const lang of RECIPE_CARD_LANGUAGES) {
    const urls = recipe.recipeCardUrls && typeof recipe.recipeCardUrls === "object" ? recipe.recipeCardUrls : {};
    const hasManifest = readRecipeCardManifest().some(item => String(item.recipeId) === id && String(item.lang) === lang);
    if (!urls[lang] && !hasManifest) continue;
    results.push(lang);
  }
  return res.status(400).json({ success:false, error:"Use the per-language delete endpoint", languages:results });
});

app.get("/admin/recipe-card/:id/download", (req, res) => {
  const id=String(req.params.id||"");
  const requestedLang=String(req.query.lang||"").toLowerCase();
  const manifest=readRecipeCardManifest();
  const candidates=manifest.filter(item=>String(item.recipeId)===id&&(!requestedLang||String(item.lang)===requestedLang)).sort((a,b)=>Date.parse(b.generatedAt||0)-Date.parse(a.generatedAt||0));
  const recipe=readApprovedRecipes().find(item=>String(item.id)===id);
  const cardUrls=recipe?.recipeCardUrls&&typeof recipe.recipeCardUrls==="object"?recipe.recipeCardUrls:{};
  const publicUrl=requestedLang?cardUrls[requestedLang]:(cardUrls.en||cardUrls.tr||Object.values(cardUrls)[0]);
  const publicFile=publicUrl?path.join(__dirname,String(publicUrl).replace(/^\/+/,"")):"";
  const manifestFile=candidates.map(item=>path.resolve(__dirname,String(item.file||"").replace(/^\/+/,""))).find(file=>file.startsWith(path.resolve(__dirname,"recipe-posters")+path.sep)&&fs.existsSync(file));
  const file=(publicFile&&fs.existsSync(publicFile)?publicFile:manifestFile);
  if(!file)return res.status(404).json({success:false,error:"Recipe card not found"});
  return res.download(file,path.basename(file));
});

async function removeRecipeCardFile(file) {
  if (!file) return;
  const resolved = path.resolve(file);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.promises.unlink(resolved);
      return;
    } catch (error) {
      if (error?.code === "ENOENT") return;
      if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code) || attempt === 7) throw error;
      try { await fs.promises.chmod(resolved, 0o666); } catch {}
      await new Promise(resolve => setTimeout(resolve, 125 * (attempt + 1)));
    }
  }
}

async function removeRecipeCardFileBestEffort(file) {
  try {
    await removeRecipeCardFile(file);
    return true;
  } catch (error) {
    console.warn("RECIPE CARD CLEANUP DEFERRED:", file, error?.code || error?.message || error);
    return false;
  }
}

app.post("/admin/recipe-card/:id/:lang/decision", async (req, res) => {
  try{
    const id=String(req.params.id||"");
    const lang=String(req.params.lang||"en").toLowerCase();
    const decision=String(req.body?.decision||"").toLowerCase();
    if(!["approved","rejected","pending"].includes(decision))return res.status(400).json({success:false,error:"Unknown decision"});
    const items=readRecipeCardManifest();
    const matchingItems=items.filter(item=>String(item.recipeId)===id&&String(item.lang)===lang);
    const index=items.findIndex(item=>String(item.recipeId)===id&&String(item.lang)===lang);
    const recipes=readApprovedRecipes();
    const recipeIndex=recipes.findIndex(recipe=>String(recipe.id)===id);
    if(recipeIndex<0)return res.status(404).json({success:false,error:"Recipe not found"});
    const previousRecipe=recipes[recipeIndex];
    const recipe={...previousRecipe,recipeCardUrls:{...(previousRecipe.recipeCardUrls||{})},recipeCardStatuses:{...(previousRecipe.recipeCardStatuses||{})}};
    if(index<0&&decision!=="rejected")return res.status(404).json({success:false,error:"Card not found"});
    const safeCardId=String(previousRecipe.importRecipeId||previousRecipe.id).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const fallbackFile=`recipe-posters/pending/${lang}/${safeCardId}-${lang}.webp`;
    const item=index>=0?items[index]:{key:`${id}:${lang}`,recipeId:id,displayId:previousRecipe.importRecipeId||"",title:previousRecipe.adminTitleTr||previousRecipe.title||"",lang,file:fallbackFile};
    const pendingRoot=path.resolve(__dirname,"recipe-posters","pending")+path.sep;
    const pendingFile=path.resolve(__dirname,String(item.file||fallbackFile).replace(/^\/+/ ,""));
    if(!pendingFile.startsWith(pendingRoot))return res.status(400).json({success:false,error:"Unsafe card file path"});
    if(decision!=="rejected"&&!fs.existsSync(pendingFile))return res.status(404).json({success:false,error:"Card file not found"});
    let approvedUrl="";
    if(decision==="approved"){
      const approvedRoot=path.resolve(__dirname,"recipe-posters","approved")+path.sep;
      const approvedDir=path.join(__dirname,"recipe-posters","approved",lang);fs.mkdirSync(approvedDir,{recursive:true});
      const approvedFile=path.join(approvedDir,path.basename(pendingFile));fs.copyFileSync(pendingFile,approvedFile);
      approvedUrl=`/recipe-posters/approved/${lang}/${path.basename(approvedFile)}`;
      const previousApprovedUrl=String(previousRecipe.recipeCardUrls?.[lang]||"");
      if(previousApprovedUrl){
        const previousApprovedFile=path.resolve(__dirname,previousApprovedUrl.replace(/^\/+/,""));
        if(previousApprovedFile.startsWith(approvedRoot)&&previousApprovedFile!==path.resolve(approvedFile))await removeRecipeCardFileBestEffort(previousApprovedFile);
      }
      const pendingFilesToRemove=new Set([pendingFile]);
      matchingItems.forEach(matchingItem=>{
        const matchingPendingFile=path.resolve(__dirname,String(matchingItem.file||"").replace(/^\/+/,""));
        if(matchingPendingFile.startsWith(pendingRoot))pendingFilesToRemove.add(matchingPendingFile);
      });
      for(const obsoletePendingFile of pendingFilesToRemove)await removeRecipeCardFileBestEffort(obsoletePendingFile);
      recipe.recipeCardUrls[lang]=approvedUrl;recipe.recipeCardStatuses[lang]="approved";
    }else{
      delete recipe.recipeCardUrls[lang];recipe.recipeCardStatuses[lang]=decision;
    }
    let responseItem;
    if(decision==="rejected"){
      responseItem={...item,status:"rejected",deleted:true,decidedAt:new Date().toISOString()};
      const files=new Set();
      matchingItems.forEach(matchingItem=>{
        const file=path.resolve(__dirname,String(matchingItem.file||"").replace(/^\/+/,""));
        if(file.startsWith(pendingRoot))files.add(file);
      });
      files.add(path.join(__dirname,"recipe-posters","approved",lang,path.basename(pendingFile)));
      const previousApprovedUrl=String(previousRecipe.recipeCardUrls?.[lang]||"");
      if(previousApprovedUrl){
        const approvedRoot=path.resolve(__dirname,"recipe-posters","approved")+path.sep;
        const previousApprovedFile=path.resolve(__dirname,previousApprovedUrl.replace(/^\/+/,""));
        if(previousApprovedFile.startsWith(approvedRoot))files.add(previousApprovedFile);
      }
      for(const file of files)await removeRecipeCardFileBestEffort(file);
      for(let itemIndex=items.length-1;itemIndex>=0;itemIndex-=1){
        if(String(items[itemIndex].recipeId)===id&&String(items[itemIndex].lang)===lang)items.splice(itemIndex,1);
      }
    }else if(decision==="approved"){
      responseItem={...item,status:"approved",approvedUrl,decidedAt:new Date().toISOString()};
      for(let itemIndex=items.length-1;itemIndex>=0;itemIndex-=1){
        if(String(items[itemIndex].recipeId)===id&&String(items[itemIndex].lang)===lang)items.splice(itemIndex,1);
      }
    }else{
      items[index]={...item,status:decision,approvedUrl:approvedUrl||undefined,decidedAt:new Date().toISOString()};
      responseItem=items[index];
    }
    recipes[recipeIndex]=recipe;
    writeApprovedRecipes(recipes,{reason:`recipe-card-${decision}-${lang}`});
    writeRecipeCardManifest(items);
    return res.json({success:true,item:responseItem});
  }catch(error){return res.status(500).json({success:false,error:"Card decision could not be saved",details:error.message})}
});

app.post("/admin/recipe-card/:id/generate", async (req, res) => {
  try {
    const recipeId = String(req.params.id || "").trim();
    const lang = String(req.body?.lang || "en").trim().toLowerCase();
    const supported = new Set(RECIPE_CARD_PRODUCTION_LANGUAGES);
    if (!supported.has(lang)) return res.status(400).json({ success:false, error:"Unsupported language" });
    const recipe = readApprovedRecipes().find(item => String(item.id) === recipeId);
    if (!recipe) return res.status(404).json({ success:false, error:"Recipe not found" });
    const queued = queueRecipeCardGeneration([recipeId], {
      force:true,
      reason:"admin-single",
      languages:[lang]
    });
    const activeJobs = readRecipeCardGenerationQueue()
      .filter(job => ["queued","running"].includes(job.status));
    const onlyThisSingleJob = activeJobs.length > 0 && activeJobs.every(job =>
      String(job.recipeId) === recipeId && String(job.lang) === lang
    );
    if (onlyThisSingleJob && readRecipeCardGenerationControl().paused) {
      setRecipeCardGenerationPaused(false);
      setImmediate(processRecipeCardGenerationQueue);
    }
    return res.json({ success:true, recipeId, lang, status:"queued", ...queued, queue:recipeCardGenerationQueueSummary() });
  } catch (error) {
    return res.status(500).json({ success:false, error:"Recipe card could not be generated", details:error.message });
  }
});

app.post("/admin/recipe-card/:id/generate-selected", async (req, res) => {
  try {
    const recipeId=String(req.params.id || "").trim();
    const requestedLanguages=[...new Set((Array.isArray(req.body?.languages) ? req.body.languages : [])
      .map(value=>String(value).trim().toLowerCase()))]
      .filter(value=>RECIPE_CARD_PRODUCTION_LANGUAGES.includes(value));
    if(!requestedLanguages.length) return res.status(400).json({success:false,error:"Select at least one supported language"});
    const recipe=readApprovedRecipes().find(item=>String(item.id)===recipeId);
    if(!recipe) return res.status(404).json({success:false,error:"Recipe not found"});
    const queued=queueRecipeCardGeneration([recipeId],{
      force:true,
      reason:"admin-recipe-languages",
      languages:requestedLanguages
    });
    const activeJobs=readRecipeCardGenerationQueue().filter(job=>["queued","running"].includes(job.status));
    const onlyThisRecipe=activeJobs.length>0 && activeJobs.every(job=>String(job.recipeId)===recipeId);
    if(onlyThisRecipe && readRecipeCardGenerationControl().paused){
      setRecipeCardGenerationPaused(false);
      setImmediate(processRecipeCardGenerationQueue);
    }
    return res.json({success:true,recipeId,languages:requestedLanguages,...queued,queue:recipeCardGenerationQueueSummary()});
  }catch(error){
    return res.status(500).json({success:false,error:"Selected recipe cards could not be queued",details:error.message});
  }
});

app.post("/admin/recipe-card/bulk-generate", requireAdmin, (req, res) => {
  try {
    const summary = recipeCardGenerationQueueSummary();
    if (Number(summary.counts.queued || 0) + Number(summary.counts.running || 0) > 0) {
      return res.status(409).json({ success:false, error:"Card generation is already running", queue:summary });
    }
    const requestedLanguages = [...new Set((Array.isArray(req.body?.languages) ? req.body.languages : [])
      .map(value => String(value).toLowerCase()))]
      .filter(value => RECIPE_CARD_PRODUCTION_LANGUAGES.includes(value));
    if (!requestedLanguages.length) {
      return res.status(400).json({ success:false, error:"Select at least one supported language" });
    }
    const recipes = readApprovedRecipes().filter(recipe =>
      recipe.status === "approved" &&
      recipe.publishEnabled !== false &&
      recipe.deleted !== true &&
      recipe.archived !== true &&
      recipeCardHasUsableImage(recipe)
    );
    const result = queueRecipeCardGeneration(
      recipes.map(recipe => recipe.id),
      { force:false, reason:"admin-bulk", languages:requestedLanguages }
    );
    return res.json({ success:true, ...result, languages:requestedLanguages, queue:recipeCardGenerationQueueSummary() });
  } catch (error) {
    return res.status(500).json({ success:false, error:"Bulk card generation could not be queued", details:error.message });
  }
});

app.post("/admin/recipe-card/selected-generate", requireAdmin, (req, res) => {
  try {
    const requestedIds = [...new Set((Array.isArray(req.body?.recipeIds) ? req.body.recipeIds : [])
      .map(value => String(value || "").trim()).filter(Boolean))];
    const requestedLanguages = [...new Set((Array.isArray(req.body?.languages) ? req.body.languages : [])
      .map(value => String(value).toLowerCase()))]
      .filter(value => RECIPE_CARD_PRODUCTION_LANGUAGES.includes(value));
    if (!requestedIds.length) return res.status(400).json({ success:false, error:"Select at least one recipe" });
    if (!requestedLanguages.length) return res.status(400).json({ success:false, error:"Select at least one supported language" });
    const requestedIdSet = new Set(requestedIds);
    const recipes = readApprovedRecipes().filter(recipe =>
      requestedIdSet.has(String(recipe.id)) &&
      recipe.status === "approved" &&
      recipe.publishEnabled !== false &&
      recipe.deleted !== true &&
      recipe.archived !== true &&
      recipeCardHasUsableImage(recipe)
    );
    const result = queueRecipeCardGeneration(
      recipes.map(recipe => recipe.id),
      { force:false, reason:"admin-selected", languages:requestedLanguages }
    );
    setImmediate(processRecipeCardGenerationQueue);
    return res.json({
      success:true,
      requestedRecipes:requestedIds.length,
      eligibleRecipes:recipes.length,
      ...result,
      languages:requestedLanguages,
      queue:recipeCardGenerationQueueSummary()
    });
  } catch (error) {
    return res.status(500).json({ success:false, error:"Selected recipe cards could not be queued", details:error.message });
  }
});

function normalizedIngredientRepairText(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR").replace(/ı/g, "i")
    .replace(/[^a-z0-9çğıöşü]+/giu, " ").replace(/\s+/g, " ").trim();
}

function recipeIngredientRepairHaystack(recipe) {
  const values=[recipe.adminIngredientsTr,recipe.ingredientsText,recipe.ingredients];
  ["extendedIngredients","usedIngredients","missedIngredients"].forEach(field => {
    (Array.isArray(recipe?.[field]) ? recipe[field] : []).forEach(item => {
      values.push(item?.original,item?.name,item);
    });
  });
  return normalizedIngredientRepairText(values.flat(Infinity).filter(Boolean).map(value =>
    typeof value === "object" ? JSON.stringify(value) : String(value)
  ).join("\n"));
}

function ingredientRepairTerms(value) {
  const term=normalizedIngredientRepairText(value);
  const aliases={
    "un":["un","unu"],
    "asma yapragi":["asma yapragi","asma yapraklari","uzum yapragi","uzum yapraklari"],
    "uzum yapragi":["asma yapragi","asma yapraklari","uzum yapragi","uzum yapraklari"],
    "asurelik bugday":["asurelik bugday","asure bugdayi"]
  };
  return aliases[term] || (term ? [term] : []);
}

function ingredientRepairMatches(recipe,term) {
  const haystack=` ${recipeIngredientRepairHaystack(recipe)} `;
  return ingredientRepairTerms(term).some(value => haystack.includes(` ${value} `));
}

function ingredientRepairSelection(term,languages) {
  const requestedLanguages=[...new Set((Array.isArray(languages) ? languages : []).map(value => String(value).toLowerCase()))]
    .filter(value => RECIPE_CARD_PRODUCTION_LANGUAGES.includes(value));
  const recipes=readApprovedRecipes().filter(recipe =>
    recipe.status === "approved" && recipe.publishEnabled !== false && recipe.deleted !== true && recipe.archived !== true &&
    recipeCardHasUsableImage(recipe) && ingredientRepairMatches(recipe,term)
  );
  return {requestedLanguages,recipes};
}

app.post("/admin/recipe-card/ingredient-repair/preview", requireAdmin, (req,res) => {
  const term=String(req.body?.term || "").trim();
  if(!ingredientRepairTerms(term).length) return res.status(400).json({success:false,error:"Enter an ingredient"});
  const {requestedLanguages,recipes}=ingredientRepairSelection(term,req.body?.languages);
  if(!requestedLanguages.length) return res.status(400).json({success:false,error:"Select at least one supported language"});
  return res.json({success:true,term,recipeCount:recipes.length,jobCount:recipes.length*requestedLanguages.length,languages:requestedLanguages,items:recipes.slice(0,100).map(recipe=>({id:recipe.id,title:recipe.adminTitleTr||recipe.title||""}))});
});

app.post("/admin/recipe-card/ingredient-repair/queue", requireAdmin, (req,res) => {
  try {
    const term=String(req.body?.term || "").trim();
    if(!ingredientRepairTerms(term).length) return res.status(400).json({success:false,error:"Enter an ingredient"});
    const {requestedLanguages,recipes}=ingredientRepairSelection(term,req.body?.languages);
    if(!requestedLanguages.length) return res.status(400).json({success:false,error:"Select at least one supported language"});
    const result=queueRecipeCardGeneration(recipes.map(recipe=>recipe.id),{force:true,reason:`ingredient-repair:${normalizedIngredientRepairText(term)}`,languages:requestedLanguages});
    setImmediate(processRecipeCardGenerationQueue);
    return res.json({success:true,term,recipeCount:recipes.length,languages:requestedLanguages,...result,queue:recipeCardGenerationQueueSummary()});
  } catch(error) {
    return res.status(500).json({success:false,error:"Ingredient repair cards could not be queued",details:error.message});
  }
});

app.post("/admin/recipe-card/pause", requireAdmin, (req, res) => {
  const control = setRecipeCardGenerationPaused(true);
  const queue = readRecipeCardGenerationQueue();
  let cancelled = 0;
  const cancelledAt = new Date().toISOString();
  queue.forEach(job => {
    if (!["queued","running"].includes(job.status)) return;
    job.status = "cancelled";
    job.cancelledAt = cancelledAt;
    job.updatedAt = cancelledAt;
    job.error = "";
    cancelled += 1;
  });
  writeRecipeCardGenerationQueue(queue);
  const stopping = stopActiveRecipeCardGenerator();
  stopOrphanedRecipeCardGenerators();
  return res.json({ success:true, stopping, cancelled, control, queue:recipeCardGenerationQueueSummary() });
});

app.post("/admin/recipe-card/resume", requireAdmin, (req, res) => {
  const control = setRecipeCardGenerationPaused(false);
  setImmediate(processRecipeCardGenerationQueue);
  return res.json({ success:true, control, queue:recipeCardGenerationQueueSummary() });
});

app.post("/admin/recipe-card/cancel-queued", requireAdmin, (req, res) => {
  if (!readRecipeCardGenerationControl().paused || activeRecipeCardGeneratorChild) {
    return res.status(409).json({ success:false, error:"Pause generation and wait for the active job to stop first" });
  }
  const queue = readRecipeCardGenerationQueue();
  let cancelled = 0;
  queue.forEach(job => {
    if (!["queued","running"].includes(job.status)) return;
    job.status = "cancelled";
    job.cancelledAt = new Date().toISOString();
    job.updatedAt = job.cancelledAt;
    cancelled += 1;
  });
  writeRecipeCardGenerationQueue(queue);
  return res.json({ success:true, cancelled, queue:recipeCardGenerationQueueSummary() });
});
app.post("/admin/recipe-card/reset-generation-history", requireAdmin, (req,res) => {
  const queue=readRecipeCardGenerationQueue();
  const active=queue.filter(job => ["queued","running"].includes(job.status));
  if(active.length || activeRecipeCardGeneratorChild || recipeCardGenerationWorkerRunning){
    return res.status(409).json({success:false,error:"Pause and cancel active generation before resetting the counters"});
  }
  const removed=queue.length;
  writeRecipeCardGenerationQueue([]);
  // The queue is now empty, so clearing the stale stop reason is safe and
  // cannot restart an old generation job.
  setRecipeCardGenerationPaused(false);
  return res.json({success:true,removed,queue:recipeCardGenerationQueueSummary()});
});
app.get("/admin/recipe-card/generation-status", requireAdmin, (req, res) => {
  const queue = readRecipeCardGenerationQueue();
  const summary = recipeCardGenerationQueueSummary();
  const latestBatchId = summary.currentBatch.id;
  const recipeMap = new Map(readApprovedRecipes().map(recipe => [String(recipe.id), recipe]));
  const failureReason = error => {
    const value = String(error || "");
    if (/EPERM|EACCES|permission denied|erişim engellendi/i.test(value)) return "Dosyaya yazma izni yok.";
    if (/food image could not be found|image.*not found/i.test(value)) return "Yemek fotoğrafı bulunamadı.";
    if (/text overflow/i.test(value)) return "Metin karta sığmadı.";
    if (/localization.*(?:failed|mismatch|not translated|contains|script)|recipe localization failed/i.test(value)) {
      const detailMatches=[...value.matchAll(/(?:Card localization validation failed|Recipe translation semantic validation failed):\s*([^\r\n]+)/gi)];
      const detail=detailMatches.at(-1)?.[1];
      return detail
        ? `Tarif çevirisi doğrulanamadı: ${detail.slice(0,180)}`
        : "Tarif çevirisi doğrulanamadı; kart üretilmedi.";
    }
    if (/timed?\s*out|timeout/i.test(value)) return "Üretim zaman aşımına uğradı.";
    return value.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 240) || "Bilinmeyen hata.";
  };
  return res.json({
    success:true,
    ...summary,
    next:(()=>{const item=queue.find(value => ["running","queued"].includes(value.status));if(!item)return null;const recipe=recipeMap.get(String(item.recipeId));return {...item,displayId:recipe?.importRecipeId||recipe?.displayRecipeId||item.recipeId,title:recipe?.adminTitleTr||recipe?.title||item.recipeId};})(),
    failed:queue.filter(item => {
      const jobBatchId = String(item.batchId || `legacy:${String(item.createdAt || "").slice(0, 19)}`);
      return item.status === "failed" && jobBatchId === latestBatchId;
    }).slice(-20).map(item => {
      const recipe = recipeMap.get(String(item.recipeId));
      return {
        recipeId:item.recipeId,
        displayId:recipe?.importRecipeId || recipe?.displayRecipeId || item.recipeId,
        title:recipe?.adminTitleTr || recipe?.title || item.recipeId,
        lang:item.lang,
        reason:failureReason(item.error)
      };
    })
  });
});

app.post("/admin/recipe-card/retry-failed", requireAdmin, (req, res) => {
  if (recipeCardGenerationWorkerRunning) {
    return res.status(409).json({ success:false, error:"Card generation is already running" });
  }
  const queue = readRecipeCardGenerationQueue();
  const latestBatchId = recipeCardGenerationQueueSummary().currentBatch.id;
  let retried = 0;
  queue.forEach(job => {
    if (job.status !== "failed") return;
    const jobBatchId = String(job.batchId || `legacy:${String(job.createdAt || "").slice(0, 19)}`);
    if (jobBatchId !== latestBatchId) return;
    job.status = "queued";
    job.attempts = 0;
    job.error = "";
    job.updatedAt = new Date().toISOString();
    retried += 1;
  });
  writeRecipeCardGenerationQueue(queue);
  setImmediate(processRecipeCardGenerationQueue);
  return res.json({ success:true, retried, queue:recipeCardGenerationQueueSummary() });
});
app.get("/admin/data-protection/status", (req, res) => {
  try {
    const approvedRecipes = readApprovedRecipes();
    const pendingRecipes = readPendingRecipes();
    const inventory = updateApprovedMediaInventory(approvedRecipes);

    res.json({
      success: true,
      storageRoot: STORAGE_ROOT,
      backupRoot: protectedDataRoot,
      approvedRecipes: approvedRecipes.length,
      approvedFloor: Number(
        readProtectionManifest()["approved-recipesFloor"] || 0
      ),
      pendingRecipes: pendingRecipes.filter(recipe =>
        recipe.status === "pending_review"
      ).length,
      media: inventory,
      approvedBackups: validProtectedSnapshots("approved-recipes").length,
      pendingBackups: validProtectedSnapshots("pending-recipes").length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Data protection status could not be loaded",
      details: error.message
    });
  }
});

app.get("/admin/data-protection/backups", (req, res) => {
  try {
    const dataset = String(req.query.dataset || "approved-recipes").trim();
    if (!new Set(["approved-recipes", "pending-recipes"]).has(dataset)) {
      return res.status(400).json({ success: false, error: "Invalid backup dataset" });
    }

    const backups = validProtectedSnapshots(dataset).map(file => {
      const stat = fs.statSync(file);
      return {
        name: path.basename(file),
        records: readJsonArrayStrict(file).length,
        modifiedAt: stat.mtime.toISOString(),
        bytes: stat.size
      };
    });

    return res.json({ success: true, dataset, backups });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Protected backups could not be listed",
      details: error.message
    });
  }
});

app.get("/admin/data-protection/backup", (req, res) => {
  try {
    const dataset = String(req.query.dataset || "approved-recipes").trim();
    const name = path.basename(String(req.query.name || "").trim());
    if (!new Set(["approved-recipes", "pending-recipes"]).has(dataset) || !name.endsWith(".json")) {
      return res.status(400).json({ success: false, error: "Invalid backup request" });
    }

    const file = path.join(protectedBackupDir(dataset), name);
    if (!validProtectedSnapshots(dataset).includes(file)) {
      return res.status(404).json({ success: false, error: "Backup was not found" });
    }

    return res.json({
      success: true,
      dataset,
      name,
      records: readJsonArrayStrict(file)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Protected backup could not be read",
      details: error.message
    });
  }
});

app.post("/admin/data-protection/backup", (req, res) => {
  try {
    const approvedFile = getApprovedRecipesFile();
    const pendingFile = getPendingRecipesFile();
    const approvedRecipes = readApprovedRecipes();
    const approvedSnapshot = createProtectedSnapshot(
      approvedFile,
      "approved-recipes",
      "manual-admin"
    );
    const pendingSnapshot = createProtectedSnapshot(
      pendingFile,
      "pending-recipes",
      "manual-admin"
    );
    const media = updateApprovedMediaInventory(approvedRecipes);

    res.json({
      success: true,
      approvedSnapshot,
      pendingSnapshot,
      media
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Protected backup could not be created",
      details: error.message
    });
  }
});

function approvedManagementState(recipe) {
  if (recipe?.deleted === true) return "deleted";
  if (recipe?.archived === true || String(recipe?.status || "").toLowerCase() === "archived") {
    return "archived";
  }
  return recipe?.publishEnabled === false ? "hidden" : "published";
}

app.get("/admin/approved-recipes/manage", (req, res) => {
  try {
    const query = normalizeText(req.query.q || "");
    const status = String(req.query.status || "all").trim().toLowerCase();
    const cuisine = normalizeText(req.query.cuisine || "");
    const type = normalizeText(req.query.type || "");
    const creator = normalizeText(req.query.creator || "");
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const ordered = sequentialApprovedRecipes(readApprovedRecipes());
    const requestedTypeKey = Object.entries(DISCOVERY_CATEGORY_ALIASES)
      .find(([, aliases]) =>
        aliases.map(normalizeText).includes(type)
      )?.[0] || "";

    const filtered = ordered.filter(({ recipe, displayRecipeId }) => {
      const state = approvedManagementState(recipe);
      if (status !== "all" && state !== status) return false;
      if (cuisine && normalizeText(recipe.cuisine) !== cuisine) return false;
      if (
        type &&
        !(requestedTypeKey
          ? recipeMatchesCategory(recipe, requestedTypeKey)
          : normalizeText(recipe.type) === type)
      ) return false;
      if (creator && normalizeText(recipe.creatorUsername || recipe.creatorEmail) !== creator) return false;
      if (!query) return true;

      const haystack = normalizeText([
        displayRecipeId,
        recipe.id,
        recipe.importRecipeId,
        recipe.title,
        recipe.adminTitleTr,
        recipe.creatorUsername,
        recipe.creatorEmail,
        recipe.cuisine,
        recipe.type
      ].filter(Boolean).join(" "));
      return haystack.includes(query);
    });

    const start = (page - 1) * limit;
    const cardManifest = readRecipeCardManifest();
    const rows = filtered.slice(start, start + limit).map(({ recipe, displayRecipeId }) => {
      const recipeCardUrls = Object.fromEntries(
        Object.entries(recipe.recipeCardUrls || {}).filter(([, url]) => recipeCardLocalFileExists(url))
      );
      const recipeCardStatuses = { ...(recipe.recipeCardStatuses || {}) };
      cardManifest
        .filter(item => String(item.recipeId) === String(recipe.id) && item.url && item.status !== "rejected")
        .forEach(item => {
          const lang = String(item.lang || "").toLowerCase();
          if (!recipeCardUrls[lang]) recipeCardUrls[lang] = item.url;
          if (!recipeCardStatuses[lang] || recipeCardStatuses[lang] === "missing") recipeCardStatuses[lang] = item.status || "pending";
        });
      return {
        ...recipe,
        recipeCardUrls,
        recipeCardStatuses,
        displayRecipeId,
        managementState: approvedManagementState(recipe),
        mediaPreviewUrl: recipeMediaValues(recipe, req)[0] || ""
      };
    });

    const activeRecipes = ordered
      .map(item => item.recipe)
      .filter(recipe => recipe.deleted !== true);

    res.json({
      success: true,
      recipes: rows,
      pagination: {
        page,
        limit,
        total: filtered.length,
        pages: Math.max(1, Math.ceil(filtered.length / limit))
      },
      counts: ordered.reduce((counts, { recipe }) => {
        const state = approvedManagementState(recipe);
        counts[state] = Number(counts[state] || 0) + 1;
        counts.all += 1;
        return counts;
      }, { all: 0, published: 0, hidden: 0, archived: 0, deleted: 0 }),
      filters: {
        cuisines: uniqueList(activeRecipes.map(recipe => recipe.cuisine)).sort(),
        types: uniqueList([
          ...activeRecipes.map(recipe => recipe.type),
          "Sıcak İçecek",
          "Soğuk İçecek"
        ]).sort(),
        creators: uniqueList(activeRecipes.map(recipe =>
          recipe.creatorUsername || recipe.creatorEmail
        )).sort()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Approved recipes could not be loaded",
      details: error.message
    });
  }
});

app.post(
  "/admin/approved-recipe/:id",
  creatorUpload.single("media"),
  async (req, res) => {
    try {
      const recipes = readApprovedRecipes();
      const index = recipes.findIndex(recipe => String(recipe.id) === String(req.params.id));
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Recipe not found" });
      }

      const recipe = recipes[index];
      const editableFields = [
        "title", "adminTitleTr", "ingredients", "adminIngredientsTr",
        "instructions", "adminInstructionsTr", "prepTime", "prepTimeText",
        "cookTimeText", "servings", "tags", "seoTitle", "seoDescription",
        "creatorUsername", "creatorEmail", "cuisine", "type"
      ];

      editableFields.forEach(field => {
        if (req.body[field] !== undefined) recipe[field] = req.body[field];
      });

      if (req.body.publishEnabled !== undefined) {
        recipe.publishEnabled = String(req.body.publishEnabled) === "true";
        if (recipe.publishEnabled) {
          recipe.deleted = false;
          recipe.archived = false;
          recipe.status = "approved";
          recipe.publishedAt = recipe.publishedAt || new Date().toISOString();
        }
      }

      if (req.file) {
        const servedMedia = await optimizeCreatorUpload(req.file);
        recipe.originalMediaFile = servedMedia.originalFileName;
        recipe.originalMediaUrl = servedMedia.originalUrl;
        recipe.mediaFile = servedMedia.fileName;
        recipe.mediaUrl = servedMedia.url;
        recipe.mediaType = servedMedia.mimetype;
        recipe.mediaFiles = [servedMedia.fileName];
        recipe.mediaUrls = [servedMedia.url];
        recipe.mediaTypes = [servedMedia.mimetype];
        recipe.image = servedMedia.url;
        recipe.fullImage = servedMedia.url;
        recipe.mediaUpdatedAt = new Date().toISOString();
      }

      recipe.updatedAt = new Date().toISOString();
      recipe.updatedBy = "admin-approved-manager";
      recipes[index] = recipe;
      writeApprovedRecipes(recipes, { reason: "admin-approved-edit" });
      return res.json({ success: true, recipe });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Approved recipe could not be updated",
        details: error.message
      });
    }
  }
);

app.post("/admin/approved-recipe/:id/state", (req, res) => {
  try {
    const action = String(req.body?.action || "").trim().toLowerCase();
    const recipes = readApprovedRecipes();
    const index = recipes.findIndex(recipe => String(recipe.id) === String(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Recipe not found" });
    }

    const recipe = recipes[index];
    if (action === "publish") {
      const recipeNumber = approvedRecipeIdNumber(recipe);
      const idConflict = recipeNumber !== null && recipes.some((item, itemIndex) =>
        itemIndex !== index &&
        item.deleted !== true &&
        approvedRecipeIdNumber(item) === recipeNumber
      );
      if (recipe.deleted === true && (recipeNumber === null || idConflict)) {
        recipe.importRecipeId = nextAvailableApprovedRecipeId(recipes, recipe.id);
      }
      recipe.deleted = false;
      recipe.archived = false;
      recipe.status = "approved";
      recipe.publishEnabled = true;
      recipe.publishedAt = recipe.publishedAt || new Date().toISOString();
    } else if (action === "hide") {
      recipe.publishEnabled = false;
    } else if (action === "archive") {
      recipe.archived = true;
      recipe.publishEnabled = false;
      recipe.archivedAt = new Date().toISOString();
    } else if (action === "restore") {
      const recipeNumber = approvedRecipeIdNumber(recipe);
      const idConflict = recipeNumber !== null && recipes.some((item, itemIndex) =>
        itemIndex !== index &&
        item.deleted !== true &&
        approvedRecipeIdNumber(item) === recipeNumber
      );
      if (recipeNumber === null || idConflict) {
        recipe.importRecipeId = nextAvailableApprovedRecipeId(recipes, recipe.id);
      }
      recipe.deleted = false;
      recipe.archived = false;
      recipe.status = "approved";
      recipe.publishEnabled = false;
      recipe.restoredAt = new Date().toISOString();
    } else if (action === "delete") {
      recipe.deleted = true;
      recipe.archived = true;
      recipe.publishEnabled = false;
      recipe.deletedAt = new Date().toISOString();
    } else {
      return res.status(400).json({ success: false, error: "Unknown action" });
    }

    recipe.updatedAt = new Date().toISOString();
    recipe.updatedBy = "admin-approved-manager";
    recipes[index] = recipe;
    writeApprovedRecipes(recipes, { reason: `admin-approved-${action}` });
    return res.json({
      success: true,
      recipe,
      managementState: approvedManagementState(recipe)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Recipe state could not be changed",
      details: error.message
    });
  }
});

app.get("/admin/dashboard", (req, res) => {
  try {
    const pendingRecipes = readPendingRecipes();
    const approvedRecipes = readApprovedRecipes();
    const creatorUsers = readCreatorUsers();
    const favorites = typeof readFavorites === "function" ? readFavorites() : {};
    const rejectedRecipes = pendingRecipes.filter(recipe => recipe.status === "rejected");
    const waitingRecipes = pendingRecipes.filter(recipe => recipe.status === "pending_review");
    const publishedRecipes = approvedRecipes.filter(isDashboardPublishedRecipe);
    const totalClicks = publishedRecipes.reduce((sum, recipe) => sum + Number(recipe.clicks || 0), 0);
    const totalViews = publishedRecipes.reduce((sum, recipe) => sum + Number(recipe.views || 0), 0);
    const totalBonus = publishedRecipes.reduce((sum, recipe) => sum + Number(recipe.totalBonus || 0), 0);
    const favoriteCount = Object.values(favorites).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

    const publicUsers = creatorUsers.map(user => {
      const email = String(user.email || "").trim().toLowerCase();
      const userPending = waitingRecipes.filter(recipe => String(recipe.creatorEmail || "").trim().toLowerCase() === email);
      const userPublished = publishedRecipes.filter(recipe => String(recipe.creatorEmail || "").trim().toLowerCase() === email);

      return {
        id: user.id || "",
        username: user.username || "",
        email: user.email || "",
        role: user.role || "creator",
        createdAt: user.createdAt || "",
        pendingRecipes: userPending.length,
        publishedRecipes: userPublished.length,
        clicks: userPublished.reduce((sum, recipe) => sum + Number(recipe.clicks || 0), 0),
        bonus: userPublished.reduce((sum, recipe) => sum + Number(recipe.totalBonus || 0), 0)
      };
    });

    const recentRecipes = [...waitingRecipes, ...publishedRecipes]
      .sort((left, right) =>
        Date.parse(right.createdAt || right.approvedAt || 0) -
        Date.parse(left.createdAt || left.approvedAt || 0)
      )
      .slice(0, 20)
      .map(recipe => ({
        id: recipe.id,
        title: recipe.adminTitleTr || recipe.title || "",
        status: recipe.status || "",
        creatorUsername: recipe.creatorUsername || "",
        creatorEmail: recipe.creatorEmail || "",
        cuisine: recipe.cuisine || "",
        createdAt: recipe.createdAt || "",
        approvedAt: recipe.approvedAt || "",
        mediaUrl: recipe.mediaUrl || "",
        clicks: Number(recipe.clicks || 0),
        views: Number(recipe.views || 0)
      }));

    res.json({
      success: true,
      stats: {
        activeVisitors: activeVisitorCount(),
        pendingRecipes: waitingRecipes.length,
        approvedRecipes: publishedRecipes.length,
        rejectedRecipes: rejectedRecipes.length,
        creatorUsers: publicUsers.length,
        favorites: favoriteCount,
        totalClicks,
        totalViews,
        totalBonus
      },
      activeVisitors: [...activeVisitors.values()]
        .sort((left, right) => right.lastSeen - left.lastSeen)
        .slice(0, 50)
        .map(visitor => ({
          path: visitor.path,
          lang: visitor.lang,
          userEmail: visitor.userEmail,
          lastSeen: new Date(visitor.lastSeen).toISOString()
        })),
      users: publicUsers,
      pendingRecipes: waitingRecipes,
      approvedRecipes: sequentialApprovedRecipes(publishedRecipes)
        .reverse()
        .map(({ recipe, displayRecipeId }) => ({
          ...recipe,
          displayRecipeId,
          mediaPreviewUrl: recipeMediaValues(recipe, req)[0] || ""
        })),
      recentRecipes
    });
  } catch (err) {
    console.log("ADMIN DASHBOARD ERROR:", err.message);
    notifyAdminError("admin-dashboard", err);
    res.status(500).json({
      success: false,
      error: "Dashboard data could not be loaded",
      details: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  }
});

app.post("/admin/send-mail", async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Recipient, subject and message are required"
      });
    }

    await sendMailSafe({
      to,
      subject,
      text: message,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.55">${message
        .split(/\n+/)
        .map(line => `<p>${String(line).replace(/[&<>"']/g, ch => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        }[ch]))}</p>`)
        .join("")}</div>`
    });

    res.json({ success: true });
  } catch (err) {
    await notifyAdminError("admin-send-mail", err, {
      to: req.body?.to,
      subject: req.body?.subject
    });
    res.status(500).json({
      success: false,
      error: "Mail could not be sent"
    });
  }
});

app.get("/admin/export-recipes", async (req, res) => {
  try {
    if (fs.existsSync(professionalExcelMasterFile)) {
      const exportId = backupId();
      const exportTimestamp = safeBackupTimestamp();
      const fileName = `NILIS_KITCHEN_PROFESYONEL_ANA_EXCEL_${exportTimestamp}_${exportId}.xlsx`;
      const exportArchiveDir = path.join(protectedDataRoot, "excel-exports");
      fs.mkdirSync(exportArchiveDir, { recursive: true });
      fs.copyFileSync(
        professionalExcelMasterFile,
        path.join(exportArchiveDir, fileName)
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      return res.sendFile(professionalExcelMasterFile);
    }

    let XLSX;

    try {
      XLSX = await import("xlsx");
    } catch (dependencyError) {
      return res.status(500).json({
        success: false,
        error: "Excel export package is missing"
      });
    }

    const XLSXLib = XLSX.default || XLSX;
    const approvedRecipes = readApprovedRecipes();
    const exportableApprovedRecipes = approvedRecipes.filter(recipe => recipe.deleted !== true);
    const orderedApprovedRecipes = sequentialApprovedRecipes(exportableApprovedRecipes);
    const catalogRecipes = readRecipeCatalog();
    const workbook = XLSXLib.utils.book_new();
    const exportId = backupId();
    const exportTimestamp = safeBackupTimestamp();

    const niliHeaders = [
      "Recipe ID",
      "Yemek Adı",
      "Yemek Tipi",
      "Ülke / Bölge / Mutfak",
      "Kaç Kişilik",
      "Hazırlık Süresi",
      "Pişirme Süresi",
      "Malzemeler (Ölçülü)",
      "Tarif (Adım Adım)",
      "Fotoğraf",
      "Etiketler",
      "SEO Başlık",
      "SEO Açıklama",
      "Yayına Açık",
      "Kaynak",
      "System Key"
    ];

    const newRecipeHeaders = [
      "Geçici ID", "Recipe ID", "Orijinal Ad", "Türkçe Ad", "Türkçe Açıklama",
      "Tür", "Ana Ülke", "İlişkili Ülke/Bölge", "Bölge", "Mutfak",
      "Porsiyon", "Hazırlık Süresi", "Pasif Süre", "Pişirme Süresi", "Sıcaklık",
      "Zorluk", "Alerjenler", "Malzemeler", "Tarif Adımları", "Pişme/Kıvam Kontrolü",
      "Püf Noktası", "Servis Önerisi", "Saklama Önerisi", "Alternatif Malzemeler",
      "Kültür/Köken", "Kart Kısa Açıklama", "Karta Seçilmiş Malzemeler", "Kart Adımları",
      "E-Kitap Giriş", "Fotoğraf", "E-Kitap Görsel URL", "Fotoğraf Alt Metni",
      "Kaynak URL", "Doğrulama Kaynağı", "Doğrulama Durumu", "Etiketler",
      "SEO Başlık", "SEO Açıklama", "Editoryal Durum", "Editör Kararı",
      "Editör Notu", "Yayına Açık", "System Key"
    ];

    const niliRows = orderedApprovedRecipes.map(({ recipe, displayRecipeId }) => [
      displayRecipeId,
      recipe.adminTitleTr || recipe.title || "",
      recipe.type || "",
      recipe.cuisine || "",
      recipe.servings || "",
      recipe.prepTimeText || recipe.prepTime || "",
      recipe.cookTimeText || "",
      String(recipe.adminIngredientsTr || exportIngredientText(recipe.ingredients)).replace(/\r\n?/g, "\n"),
      String(recipe.adminInstructionsTr || exportInstructionText(recipe)).replace(/\r\n?/g, "\n"),
      excelLinkCell(recipeMediaValues(recipe, req)),
      Array.isArray(recipe.tags) ? recipe.tags.join(", ") : recipe.tags || "",
      recipe.seoTitle || recipe.adminTitleTr || recipe.title || "",
      recipe.seoDescription || "",
      recipe.publishEnabled === false ? "Hayır" : "Evet",
      recipe.source || "nili_creator",
      recipe.id || recipe.systemKey || ""
    ]);

    const externalHeaders = [
      "Kaynak",
      "Kaynak ID",
      "Katalog ID",
      "Harici Tarif Başlığı",
      "Mutfak",
      "Ülke / Bölge",
      "Kategori",
      "Etiketler",
      "Porsiyon",
      "Toplam Süre",
      "Malzemeler",
      "Tarif Adımları",
      "Görsel URL",
      "Kaynak URL",
      "SEO Başlık",
      "SEO Açıklama"
    ];

    const externalRows = catalogRecipes.map(recipe => [
      recipe.source || "external",
      recipe.sourceId || "",
      recipe.id || "",
      recipe.title || "",
      recipe.cuisine || "",
      recipe.country || "",
      recipe.category || "",
      Array.isArray(recipe.tags) ? recipe.tags.join(", ") : recipe.tags || "",
      recipe.servings || "",
      recipe.readyInMinutes ? `${recipe.readyInMinutes} dk` : "",
      exportIngredientText(
        recipe.extendedIngredients?.length
          ? recipe.extendedIngredients
          : recipe.usedIngredients
      ),
      exportInstructionText(recipe),
      excelLinkCell(recipeMediaValues(recipe, req)),
      excelLinkCell([toPublicRecipeUrl(recipe.sourceUrl || "", req)]),
      recipe.seoTitle || recipe.title || "",
      recipe.seoDescription || ""
    ]);

    const summaryRows = [
      ["Nili's Kitchen - Tarif Yönetim Ana Dosyası"],
      ["Yedek Kimliği", exportId],
      ["Oluşturulma Zamanı", new Date().toISOString()],
      [],
      ["Kaynak", "Tarif Sayısı"],
      ["Nili's Kitchen", exportableApprovedRecipes.length],
      ["Spoonacular", catalogRecipes.filter(item => item.source === "spoonacular").length],
      ["TheMealDB", catalogRecipes.filter(item => item.source === "themealdb").length],
      ["Edamam", catalogRecipes.filter(item => item.source === "edamam").length],
      ["TOPLAM", exportableApprovedRecipes.length + catalogRecipes.length],
      [],
      ["Kullanım"],
      ["Mevcut Nili tariflerini güncellemek için Nili Tarif Yönetimi sekmesini düzenleyip tekrar yükleyin."],
      ["Yeni tarifleri Yeni Tarif Yükleme sekmesine ekleyin."],
      ["Harici Tarif Arşivi sekmesi bilgi amaçlıdır ve toplu Nili importuna dahil edilmez."],
      ["Fotoğraf alanı indirilen Excel'de tıklanabilir linktir; birden fazla fotoğraf noktalı virgülle listelenir."],
      ["Recipe ID tarif ilk yüklendiğinde atanır ve sonraki indirme veya güncellemelerde değişmez."],
      ["Gizli System Key sütununu değiştirmeyin; güvenli güncellemeler bu sabit anahtarla eşleştirilir."]
    ];

    const templateRows = [newRecipeHeaders];
    for (let index = 0; index < 25; index += 1) {
      templateRows.push(Array(newRecipeHeaders.length).fill(""));
    }

    const summarySheet = XLSXLib.utils.aoa_to_sheet(summaryRows);
    const niliSheet = XLSXLib.utils.aoa_to_sheet([niliHeaders, ...niliRows]);
    const externalSheet = XLSXLib.utils.aoa_to_sheet([externalHeaders, ...externalRows]);
    const templateSheet = XLSXLib.utils.aoa_to_sheet(templateRows);

    summarySheet["!cols"] = [{ wch: 96 }, { wch: 16 }];
    niliSheet["!cols"] = [
      { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 14 },
      { wch: 18 }, { wch: 18 }, { wch: 60 }, { wch: 72 }, { wch: 42 },
      { wch: 32 }, { wch: 40 }, { wch: 60 }, { wch: 14 }, { wch: 18 },
      { wch: 1, hidden: true }
    ];
    externalSheet["!cols"] = [
      { wch: 16 }, { wch: 22 }, { wch: 26 }, { wch: 34 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 14 },
      { wch: 60 }, { wch: 72 }, { wch: 42 }, { wch: 42 }, { wch: 40 }, { wch: 60 }
    ];
    templateSheet["!cols"] = newRecipeHeaders.map((header) => ({
      wch: /Malzemeler|Adımlar|Açıklama|Giriş|Kültür|Önerisi|Alternatif/.test(header) ? 55 : 20
    }));

    XLSXLib.utils.book_append_sheet(workbook, summarySheet, "Özet");
    XLSXLib.utils.book_append_sheet(workbook, niliSheet, "Nili Tarif Yönetimi");
    XLSXLib.utils.book_append_sheet(workbook, externalSheet, "Harici Tarif Arşivi");
    XLSXLib.utils.book_append_sheet(workbook, templateSheet, "Yeni Tarif Yükleme");

    const output = XLSXLib.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true
    });

    const fileName = `NILIS_TARIF_YONETIM_${exportTimestamp}_${exportId}.xlsx`;
    const exportArchiveDir = path.join(protectedDataRoot, "excel-exports");
    fs.mkdirSync(exportArchiveDir, { recursive: true });
    fs.writeFileSync(path.join(exportArchiveDir, fileName), output);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );
    return res.send(output);
  } catch (err) {
    console.log("ADMIN EXPORT RECIPES ERROR:", err.message);
    await notifyAdminError("admin-export-recipes", err);
    return res.status(500).json({
      success: false,
      error: "Recipe Excel export failed"
    });
  }
});

app.post(
  "/admin/import-images",
  adminImportImageUpload.array("photoFiles", 25),
  async (req, res) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({
          success: false,
          error: "At least one image file is required"
        });
      }

      const optimization = await optimizeRecipeImportFiles(files.map(file => file.filename));
      return res.json({
        success: true,
        uploaded: files.length,
        optimized: optimization.optimized,
        files: files.map(file => ({
          originalName: file.originalname,
          storedName: file.filename,
          mediaUrl: optimizedRecipeImportUrl(file.filename)
        }))
      });
    } catch (err) {
      console.log("ADMIN IMPORT IMAGES ERROR:", err);
      await notifyAdminError("admin-import-images", err, {
        fileCount: Array.isArray(req.files) ? req.files.length : 0
      });
      return res.status(500).json({
        success: false,
        error: "Recipe image upload failed"
      });
    }
  }
);

app.post(
  "/admin/import-recipes",
  adminImportUpload.single("recipesFile"),
  async (req, res) => {
    let importArchive = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Excel file is required"
        });
      }

      importArchive = archiveUploadedExcel(req.file);

      await optimizeRecipeImportLibrary();

      let XLSX;

      try {
        XLSX = await import("xlsx");
      } catch (dependencyError) {
        return res.status(500).json({
          success: false,
          error: "Excel import package is missing. Run npm install after package.json update."
        });
      }

      const XLSXLib =
      XLSX.default || XLSX;

      const workbook =
      XLSXLib.read(fs.readFileSync(req.file.path), {
        type: "buffer",
        cellDates: false,
        cellText: false
      });

      const professionalWorkbookSheets = [
        "Özet",
        "Sisteme Aktarım",
        "Tarifler",
        "Malzemeler",
        "Hazırlama Adımları",
        "Ek İçerikler",
        "Kart İçeriği",
        "E-Kitap İçeriği",
        "Medya",
        "Kalite Kontrol",
        "Harici Tarif Arşivi",
        "Yeni Tarif Yükleme"
      ];
      const isProfessionalWorkbook = professionalWorkbookSheets.every(
        sheetName => workbook.SheetNames.includes(sheetName)
      );

      const requestedSheet =
      normalizeImportHeader(req.body.sheetName || "");

      const pendingRecipes =
      readPendingRecipes();

      const approvedRecipes =
      readApprovedRecipes();

      const pendingByImportId =
      new Map();

      const pendingBySystemKey =
      new Map();

      const pendingByTitle =
      new Map();

      const approvedByImportId =
      new Map();

      const approvedBySystemKey =
      new Map();

      const approvedByTitle =
      new Map();

      pendingRecipes.forEach((recipe, index) => {
        const systemKey =
        normalizeRecipeKey(recipe.id || recipe.systemKey || "");

        if (systemKey) {
          pendingBySystemKey.set(systemKey, index);
        }

        const importIdKey =
        normalizeRecipeKey(recipe.importRecipeId || recipe.id || "");

        if (importIdKey) {
          pendingByImportId.set(importIdKey, index);
        }

        const titleKey =
        normalizeRecipeKey(recipe.title || recipe.adminTitleTr);

        if (titleKey && !pendingByTitle.has(titleKey)) {
          pendingByTitle.set(titleKey, index);
        }
      });

      const approvedKeys =
      new Set();

      approvedRecipes.forEach((recipe, index) => {
        if (recipe.deleted === true) {
          return;
        }

        const systemKey =
        normalizeRecipeKey(recipe.id || recipe.systemKey || "");

        if (systemKey) {
          approvedBySystemKey.set(systemKey, index);
        }

        const importIdKey =
        normalizeRecipeKey(recipe.importRecipeId || recipe.id || "");

        if (importIdKey) {
          approvedByImportId.set(importIdKey, index);
          approvedKeys.add(importIdKey);
        }

        const titleKey =
        normalizeRecipeKey(recipe.title || recipe.adminTitleTr);

        if (titleKey && !approvedByTitle.has(titleKey)) {
          approvedByTitle.set(titleKey, index);
          approvedKeys.add(titleKey);
        }
      });

      const importedRecipes = [];
      const updatedRecipes = [];
      const updatedApprovedRecipes = [];
      const skippedRows = [];
      const duplicateRows = [];
      const processedSheets = [];
      const ignoredSheets = [];
      let managedTransferProcessed = false;

      const importSheetNames =
      requestedSheet
        ? workbook.SheetNames.filter(sheetName =>
            normalizeImportHeader(sheetName) === requestedSheet
          )
        : workbook.SheetNames;

      if (requestedSheet && !importSheetNames.length) {
        return res.status(400).json({
          success: false,
          error: "Requested sheet was not found",
          availableSheets: workbook.SheetNames
        });
      }

      importSheetNames.forEach(sheetName => {
        const isManagedTransferSheet =
        normalizeImportHeader(sheetName) ===
        normalizeImportHeader("Sisteme Aktarım");
        if (isManagedTransferSheet) managedTransferProcessed = true;

        const sheet =
        workbook.Sheets[sheetName];

        const rows =
        XLSXLib.utils.sheet_to_json(sheet, {
          header: 1,
          defval: ""
        });

        const headerRowIndex =
        rows.findIndex(row => {
          const normalized =
          row.map(normalizeImportHeader);

          return normalized.some(item =>
            item.includes("yemek adi") ||
            item.includes("tarif adi") ||
            item.includes("turkce ad") ||
            item === "title" ||
            item === "recipe title"
          );
        });

        if (headerRowIndex === -1) {
          ignoredSheets.push(sheetName);
          return;
        }

        const headers =
        rows[headerRowIndex].map(normalizeImportHeader);

        const headerMap =
        new Map();

        headers.forEach((header, index) => {
          if (header && !headerMap.has(header)) {
            headerMap.set(header, index);
          }
        });

        const sheetStats = {
          sheet: sheetName,
          imported: 0,
          updated: 0,
          skipped: 0,
          duplicates: 0
        };

        rows.slice(headerRowIndex + 1).forEach((row, offset) => {
          const rowNumber =
          headerRowIndex + offset + 2;

          const recipe =
          buildAdminImportRecipe(row, headerMap, rowNumber);

          if (!recipe) {
            if (row.some(cell => String(cell || "").trim())) {
              skippedRows.push({
                sheet: sheetName,
                row: rowNumber
              });
              sheetStats.skipped += 1;
            }
            return;
          }

          recipe.importSheet = sheetName;

          const importIdKey =
          normalizeRecipeKey(recipe.importRecipeId || "");

          const titleKey =
          normalizeRecipeKey(recipe.title);

          const suppliedSystemKey =
          normalizeRecipeKey(recipe.systemKey || "");

          const systemKey =
          suppliedSystemKey ||
          normalizeRecipeKey(recipe.id || "");

          const approvedTitleIndex =
          titleKey ? approvedByTitle.get(titleKey) : undefined;

          const approvedSystemIndex =
          systemKey && approvedBySystemKey.has(systemKey)
            ? approvedBySystemKey.get(systemKey)
            : undefined;

          const approvedImportIndex =
          importIdKey && approvedByImportId.has(importIdKey)
            ? approvedByImportId.get(importIdKey)
            : undefined;

          const approvedIdentityIndexes = new Set(
            [approvedSystemIndex, approvedImportIndex]
              .filter(index => index !== undefined)
          );

          if (approvedIdentityIndexes.size > 1) {
            duplicateRows.push({
              sheet: sheetName,
              row: rowNumber,
              title: recipe.title,
              reason: "system_key_recipe_id_conflict"
            });
            sheetStats.duplicates += 1;
            return;
          }

          const hasExplicitIdentity =
          Boolean(suppliedSystemKey || importIdKey);

          const approvedIndex =
          approvedSystemIndex !== undefined
            ? approvedSystemIndex
            : approvedImportIndex;

          if (approvedIndex === undefined && approvedTitleIndex !== undefined) {
            duplicateRows.push({
              sheet: sheetName,
              row: rowNumber,
              title: recipe.title,
              existingTitle:
              approvedRecipes[approvedTitleIndex].title ||
              approvedRecipes[approvedTitleIndex].adminTitleTr,
              reason: hasExplicitIdentity
                ? "identity_not_found_title_exists"
                : "duplicate_title_existing"
            });
            sheetStats.duplicates += 1;
            return;
          }

          if (approvedIndex !== undefined) {
            const existingTitleKey =
            normalizeRecipeKey(approvedRecipes[approvedIndex].title || approvedRecipes[approvedIndex].adminTitleTr);

            const matchedByImportIdOnly =
            approvedSystemIndex === undefined &&
            approvedImportIndex !== undefined;

            if (matchedByImportIdOnly && titleKey && existingTitleKey && existingTitleKey !== titleKey) {
              duplicateRows.push({
                sheet: sheetName,
                row: rowNumber,
                title: recipe.title,
                existingTitle: approvedRecipes[approvedIndex].title || approvedRecipes[approvedIndex].adminTitleTr,
                reason: "recipe_id_belongs_to_another_recipe"
              });
              sheetStats.duplicates += 1;
              return;
            }

            const existingApprovedRecipe =
            approvedRecipes[approvedIndex];

            const importedMediaValues =
            [
              recipe.mediaUrl,
              ...(Array.isArray(recipe.mediaUrls) ? recipe.mediaUrls : [])
            ].filter(Boolean);

            const importedPrimaryMedia = importedMediaValues[0] || "";
            const existingPrimaryMedia = primaryRecipeMediaValue(existingApprovedRecipe);
            const primaryMedia = importedPrimaryMedia || existingPrimaryMedia;
            const synchronizedMediaFields = primaryMedia
              ? {
                  mediaFile: importedPrimaryMedia
                    ? (recipe.mediaFile || path.basename(importedPrimaryMedia))
                    : (existingApprovedRecipe.mediaFile || path.basename(primaryMedia)),
                  mediaUrl: primaryMedia,
                  mediaType: importedPrimaryMedia
                    ? (recipe.mediaType || "image")
                    : (existingApprovedRecipe.mediaType || "image"),
                  mediaFiles: [importedPrimaryMedia
                    ? (recipe.mediaFile || path.basename(primaryMedia))
                    : (existingApprovedRecipe.mediaFile || path.basename(primaryMedia))],
                  mediaUrls: [primaryMedia],
                  mediaTypes: [importedPrimaryMedia
                    ? (recipe.mediaType || "image")
                    : (existingApprovedRecipe.mediaType || "image")],
                  image: primaryMedia,
                  fullImage: primaryMedia,
                  originalMediaFile: importedPrimaryMedia
                    ? (recipe.originalMediaFile || recipe.mediaFile || path.basename(primaryMedia))
                    : (existingApprovedRecipe.originalMediaFile || ""),
                  originalMediaUrl: importedPrimaryMedia
                    ? (recipe.originalMediaUrl || primaryMedia)
                    : (existingApprovedRecipe.originalMediaUrl || "")
                }
              : {
                  mediaFile: "",
                  mediaUrl: "",
                  mediaType: "",
                  mediaFiles: [],
                  mediaUrls: [],
                  mediaTypes: [],
                  image: "",
                  fullImage: ""
                };

            approvedRecipes[approvedIndex] = {
              ...approvedRecipes[approvedIndex],
              ...recipe,
              ...synchronizedMediaFields,
              id: approvedRecipes[approvedIndex].id,
              systemKey: approvedRecipes[approvedIndex].systemKey || approvedRecipes[approvedIndex].id,
              status: "approved",
              source: approvedRecipes[approvedIndex].source || "nili_creator",
              approvedAt: approvedRecipes[approvedIndex].approvedAt,
              clicks: Number(approvedRecipes[approvedIndex].clicks || 0),
              views: Number(approvedRecipes[approvedIndex].views || 0),
              bonusPerClick: Number(approvedRecipes[approvedIndex].bonusPerClick || BONUS_PER_CLICK || 0),
              totalBonus: Number(approvedRecipes[approvedIndex].totalBonus || 0),
              updatedAt: new Date().toISOString(),
              updatedBy: "admin_excel_import"
            };

            const updatedApproved = approvedRecipes[approvedIndex];
            const updatedSystemKey = normalizeRecipeKey(updatedApproved.id || updatedApproved.systemKey || "");
            const updatedImportId = normalizeRecipeKey(updatedApproved.importRecipeId || updatedApproved.id || "");
            const updatedTitleKey = normalizeRecipeKey(updatedApproved.title || updatedApproved.adminTitleTr);
            if (updatedSystemKey) approvedBySystemKey.set(updatedSystemKey, approvedIndex);
            if (updatedImportId) approvedByImportId.set(updatedImportId, approvedIndex);
            if (updatedTitleKey) approvedByTitle.set(updatedTitleKey, approvedIndex);

            updatedApprovedRecipes.push(updatedApproved);
            sheetStats.updatedApproved =
            Number(sheetStats.updatedApproved || 0) + 1;
            return;
          }

          const pendingTitleIndex =
          titleKey ? pendingByTitle.get(titleKey) : undefined;

          const pendingSystemIndex =
          systemKey && pendingBySystemKey.has(systemKey)
            ? pendingBySystemKey.get(systemKey)
            : undefined;

          const pendingImportIndex =
          importIdKey && pendingByImportId.has(importIdKey)
            ? pendingByImportId.get(importIdKey)
            : undefined;

          const pendingIdentityIndexes = new Set(
            [pendingSystemIndex, pendingImportIndex]
              .filter(index => index !== undefined)
          );

          if (pendingIdentityIndexes.size > 1) {
            duplicateRows.push({
              sheet: sheetName,
              row: rowNumber,
              title: recipe.title,
              reason: "system_key_recipe_id_conflict"
            });
            sheetStats.duplicates += 1;
            return;
          }

          const pendingIndex =
          pendingSystemIndex !== undefined
            ? pendingSystemIndex
            : pendingImportIndex !== undefined
              ? pendingImportIndex
              : !hasExplicitIdentity
                ? pendingTitleIndex
                : undefined;

          if (pendingIndex === undefined && pendingTitleIndex !== undefined) {
            duplicateRows.push({
              sheet: sheetName,
              row: rowNumber,
              title: recipe.title,
              existingTitle:
              pendingRecipes[pendingTitleIndex].title ||
              pendingRecipes[pendingTitleIndex].adminTitleTr,
              reason: hasExplicitIdentity
                ? "identity_not_found_title_exists"
                : "duplicate_title_pending"
            });
            sheetStats.duplicates += 1;
            return;
          }

          if (pendingIndex !== undefined) {
            const existingTitleKey =
            normalizeRecipeKey(pendingRecipes[pendingIndex].title || pendingRecipes[pendingIndex].adminTitleTr);

            if (!systemKey && !importIdKey && titleKey && existingTitleKey && existingTitleKey !== titleKey) {
              duplicateRows.push({
                sheet: sheetName,
                row: rowNumber,
                title: recipe.title,
                existingTitle: pendingRecipes[pendingIndex].title || pendingRecipes[pendingIndex].adminTitleTr,
                reason: "display_id_conflict"
              });
              sheetStats.duplicates += 1;
              return;
            }

            pendingRecipes[pendingIndex] = {
              ...pendingRecipes[pendingIndex],
              ...recipe,
              id: pendingRecipes[pendingIndex].id,
              systemKey: pendingRecipes[pendingIndex].systemKey || pendingRecipes[pendingIndex].id,
              status: "pending_review",
              updatedAt: new Date().toISOString(),
              updatedBy: "admin_excel_import"
            };

            const updatedPending = pendingRecipes[pendingIndex];
            const updatedSystemKey = normalizeRecipeKey(updatedPending.id || updatedPending.systemKey || "");
            const updatedImportId = normalizeRecipeKey(updatedPending.importRecipeId || updatedPending.id || "");
            const updatedTitleKey = normalizeRecipeKey(updatedPending.title || updatedPending.adminTitleTr);
            if (updatedSystemKey) pendingBySystemKey.set(updatedSystemKey, pendingIndex);
            if (updatedImportId) pendingByImportId.set(updatedImportId, pendingIndex);
            if (updatedTitleKey) pendingByTitle.set(updatedTitleKey, pendingIndex);

            updatedRecipes.push(recipe);
            sheetStats.updated += 1;
            return;
          }

          if (hasExplicitIdentity && !isManagedTransferSheet) {
            duplicateRows.push({
              sheet: sheetName,
              row: rowNumber,
              title: recipe.title,
              recipeId: recipe.importRecipeId || "",
              systemKey: recipe.systemKey || recipe.id || "",
              reason: "identity_not_found"
            });
            sheetStats.duplicates += 1;
            return;
          }

          pendingRecipes.push(recipe);
          importedRecipes.push(recipe);
          sheetStats.imported += 1;

          if (importIdKey) {
            pendingByImportId.set(importIdKey, pendingRecipes.length - 1);
          }

          if (systemKey) {
            pendingBySystemKey.set(systemKey, pendingRecipes.length - 1);
          }

          if (titleKey) {
            pendingByTitle.set(titleKey, pendingRecipes.length - 1);
          }
        });

        processedSheets.push(sheetStats);
      });

      if (!processedSheets.length) {
        return res.status(400).json({
          success: false,
          error: "Excel headers could not be recognized"
        });
      }

      writePendingRecipes(pendingRecipes, "admin-excel-import");
      writeApprovedRecipes(approvedRecipes, { reason: "admin-excel-import" });

      if (managedTransferProcessed && isProfessionalWorkbook && importArchive?.path) {
        const incomingMasterFile = `${professionalExcelMasterFile}.incoming`;
        fs.copyFileSync(importArchive.path, incomingMasterFile);
        fs.renameSync(incomingMasterFile, professionalExcelMasterFile);
      }

      if (updatedApprovedRecipes.length && !managedTransferProcessed) {
        queueRecipeCardGeneration(updatedApprovedRecipes.map(recipe => recipe.id), {
          force:true,
          reason:"approved-excel-import"
        });
      }

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const adminUrl =
      `${process.env.SITE_URL || "https://niliskitchen.com"}/admin.html`;

      const sheetSummary =
      processedSheets
        .map(item =>
          `${item.sheet}: new ${item.imported || 0}, pending updated ${item.updated || 0}, approved updated ${item.updatedApproved || 0}, duplicates ${item.duplicates || 0}, skipped ${item.skipped || 0}`
        )
        .join("\n");

      await sendMailSafe({
        to: process.env.ADMIN_EMAIL,
        subject: "Nili's Kitchen Excel import completed",
        text: [
          `Excel import completed: ${req.file?.originalname || "recipes file"}`,
          `Imported: ${importedRecipes.length}`,
          `Pending updated: ${updatedRecipes.length}`,
          `Approved updated: ${updatedApprovedRecipes.length}`,
          `Skipped: ${skippedRows.length}`,
          `Duplicates: ${duplicateRows.length}`,
          "",
          "Sheets:",
          sheetSummary || "-",
          "",
          `Open admin panel: ${adminUrl}`
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:680px;line-height:1.5">
            <h2>Nili's Kitchen Excel import completed</h2>
            <p><strong>File:</strong> ${req.file?.originalname || "recipes file"}</p>
            <p><strong>Backup ID:</strong> ${importArchive?.id || "-"}</p>
            <ul>
              <li><strong>Imported:</strong> ${importedRecipes.length}</li>
              <li><strong>Pending updated:</strong> ${updatedRecipes.length}</li>
              <li><strong>Approved updated:</strong> ${updatedApprovedRecipes.length}</li>
              <li><strong>Skipped:</strong> ${skippedRows.length}</li>
              <li><strong>Duplicates:</strong> ${duplicateRows.length}</li>
            </ul>
            <pre style="background:#f7f1e8;border-radius:12px;padding:14px;white-space:pre-wrap">${sheetSummary || "-"}</pre>
            <p>
              <a href="${adminUrl}" style="display:inline-block;background:#1f7a4d;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">
                Open Admin Panel
              </a>
            </p>
          </div>
        `
      });

      return res.json({
        success: true,
        backupId: importArchive?.id || "",
        backupFile: importArchive?.name || "",
        imported: importedRecipes.length,
        updated: updatedRecipes.length,
        updatedApproved: updatedApprovedRecipes.length,
        skipped: skippedRows.length,
        duplicates: duplicateRows.length,
        sheet: processedSheets.map(item => item.sheet).join(", "),
        processedSheets,
        ignoredSheets,
        skippedRows,
        duplicateRows
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log("ADMIN IMPORT RECIPES ERROR:", err);
      await notifyAdminError("admin-import-recipes", err, {
        file: req.file?.originalname || "",
        backupId: importArchive?.id || ""
      });

      return res.status(500).json({
        success: false,
        error: "Recipe import failed"
      });
    }
  }
);

app.post(
  "/admin/update-recipe/:id",
  creatorUpload.single("media"),
  async (req, res) => {
    try {
      const recipes = readPendingRecipes();

      const recipe =
      recipes.find(item =>
        item.id === req.params.id
      );

      if (!recipe) {
        return res.status(404).json({
          error: "Recipe not found"
        });
      }

      const {
        title,
        adminTitleTr,
        ingredients,
        adminIngredientsTr,
        instructions,
        adminInstructionsTr,
        prepTime,
        servings,
        tags,
        seoTitle,
        seoDescription,
        publishEnabled
      } = req.body;

      if (title !== undefined) {
        recipe.title = title;
      }

      if (adminTitleTr !== undefined) {
        recipe.adminTitleTr = adminTitleTr;
      }

      if (ingredients !== undefined) {
        recipe.ingredients = ingredients;
      }

      if (adminIngredientsTr !== undefined) {
        recipe.adminIngredientsTr = adminIngredientsTr;
      }

      if (instructions !== undefined) {
        recipe.instructions = instructions;
      }

      if (adminInstructionsTr !== undefined) {
        recipe.adminInstructionsTr = adminInstructionsTr;
      }

      if (prepTime !== undefined) {
        recipe.prepTime = prepTime;
      }

      if (servings !== undefined) {
        recipe.servings = servings;
      }

      if (tags !== undefined) {
        recipe.tags = tags;
      }

      if (seoTitle !== undefined) {
        recipe.seoTitle = seoTitle;
      }

      if (seoDescription !== undefined) {
        recipe.seoDescription = seoDescription;
      }

      if (publishEnabled !== undefined) {
        recipe.publishEnabled =
        publishEnabled === true ||
        publishEnabled === "true" ||
        publishEnabled === "on" ||
        publishEnabled === "1";
      }

      if (req.file) {
        const servedMedia = await optimizeCreatorUpload(req.file);
        recipe.originalMediaFile = servedMedia.originalFileName;
        recipe.originalMediaUrl = servedMedia.originalUrl;
        recipe.mediaFile = servedMedia.fileName;
        recipe.mediaUrl = servedMedia.url;
        recipe.mediaType = servedMedia.mimetype;
        recipe.mediaFiles = [servedMedia.fileName];
        recipe.mediaUrls = [servedMedia.url];
        recipe.mediaTypes = [servedMedia.mimetype];
        recipe.image = servedMedia.url;
        recipe.fullImage = servedMedia.url;
        recipe.mediaUpdatedAt = new Date().toISOString();
      }

      recipe.updatedAt = new Date().toISOString();
      recipe.updatedBy = "admin";

      writePendingRecipes(recipes);

      return res.json({
        success: true,
        recipe
      });

    } catch (err) {
      console.log("ADMIN UPDATE RECIPE ERROR:", err);

      return res.status(500).json({
        error: "Recipe update failed"
      });
    }
  }
);

app.get("/admin/pending-recipes", (req, res) => {
  try {
    const recipes = readPendingRecipes();

    const pending = recipes.filter(recipe =>
      recipe.status === "pending_review"
    );

    res.json({
      success: true,
      recipes: pending
    });
  } catch (err) {
    console.log("ADMIN PENDING RECIPES ERROR:", err);

    res.status(500).json({
      error: "Could not load pending recipes"
    });
  }
});


app.post("/admin/reject-recipe/:id", async(req, res) => {
  try {
    const recipes = readPendingRecipes();

    const recipe = recipes.find(item =>
      item.id === req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        error: "Recipe not found"
      });
    }

    recipe.status = "rejected";
    recipe.rejectedAt = new Date().toISOString();

    writePendingRecipes(recipes);

    res.json({
      success: true,
      recipe
    });

    const mail =
getRecipeStatusMail(
  "rejected",
  recipe.creatorLang || recipe.lang || "en",
  recipe.adminTitleTr || recipe.title || "Recipe"
);

await sendMailSafe({
  to: recipe.creatorEmail,
  subject: mail.subject,
  text: mail.text,
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>${mail.subject}</h2>
      <p>${mail.text}</p>
      <p><strong>Nili’s Kitchen Team</strong></p>
    </div>
  `
});
  } catch (err) {
    console.log("REJECT RECIPE ERROR:", err);
    await notifyAdminError("admin-reject-recipe", err, {
      recipeId: req.params.id
    });

    res.status(500).json({
      error: "Reject failed"
    });
  }
});

app.post("/admin/delete-recipe/:id", (req, res) => {
  try {
    let recipes = readPendingRecipes();

    recipes = recipes.filter(item =>
      item.id !== req.params.id
    );

    writePendingRecipes(recipes);

    res.json({
      success: true
    });
  } catch (err) {
    console.log("DELETE RECIPE ERROR:", err);

    res.status(500).json({
      error: "Delete failed"
    });
  }
});

const favoritesFile = process.env.NILI_FAVORITES_FILE
  ? path.resolve(process.env.NILI_FAVORITES_FILE)
  : storagePath("data", "favorites.json");
const favoritesDir = path.dirname(favoritesFile);

function ensureFavoritesFile() {
  fs.mkdirSync(favoritesDir, { recursive: true });
  if (!fs.existsSync(favoritesFile)) {
    fs.writeFileSync(favoritesFile, "{}", "utf8");
  }
}

function readFavorites() {
  ensureFavoritesFile();

  try {
    const data = JSON.parse(fs.readFileSync(favoritesFile, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    const backupFile = `${favoritesFile}.invalid-${Date.now()}`;
    fs.copyFileSync(favoritesFile, backupFile);
    console.log("FAVORITES READ ERROR, BACKUP CREATED:", error.message);
    return {};
  }
}

function writeFavorites(data) {
  ensureFavoritesFile();
  const tempFile = `${favoritesFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");

  try {
    fs.renameSync(tempFile, favoritesFile);
  } catch (error) {
    fs.copyFileSync(tempFile, favoritesFile);
    fs.unlinkSync(tempFile);
  }
}

app.post("/user/favorites", (req, res) => {
  try{
    const { email, recipe } = req.body;

    const emailKey = String(email || "").trim().toLowerCase();

    if(!emailKey || !recipe || !recipe.id){
      return res.status(400).json({
        success:false,
        error:"email and recipe required"
      });
    }

    const data = readFavorites();

    if(!Array.isArray(data[emailKey])){
      data[emailKey] = [];
    }

    const exists =
      data[emailKey].some(item => String(item.id) === String(recipe.id));

    if(exists){
      data[emailKey] =
        data[emailKey].filter(item => String(item.id) !== String(recipe.id));
    }else{
      data[emailKey].push(recipe);
    }

    writeFavorites(data);

    res.json({
      success:true,
      favorites:data[emailKey]
    });

  }catch(err){
    console.log("FAVORITES ERROR:", err);
    res.status(500).json({
      success:false,
      error:"Favorites failed"
    });
  }
});

app.get("/user/favorites/:email", (req, res) => {
  try{
    const data = readFavorites();
    const email = String(req.params.email || "").trim().toLowerCase();

    res.json({
      success:true,
      favorites:data[email] || []
    });

  }catch(err){
    res.status(500).json({
      success:false,
      error:"Favorites load failed"
    });
  }
});


function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();
}

function findApprovedRecipesByIngredients(ingredientsInput) {
  const approvedRecipes =
  readApprovedRecipes();

  const ingredientGroups = Array.isArray(ingredientsInput)
    ? ingredientsInput.map(item =>
        (Array.isArray(item) ? item : [item]).map(normalizeText).filter(Boolean)
      ).filter(group => group.length)
    : String(ingredientsInput || "")
        .split(",")
        .map(item => [normalizeText(item)])
        .filter(group => group[0]);

  return filterRecipesByBestIngredientCoverage(
    approvedRecipes.filter(recipe =>
      recipe.status === "approved" &&
      recipe.publishEnabled !== false &&
      recipe.deleted !== true &&
      recipe.archived !== true
    ),
    ingredientGroups
  );
}

app.post("/community-recipes/search", (req, res) => {
  try {
    const { ingredients } = req.body;

    const recipes =
    findApprovedRecipesByIngredients(ingredients);

    res.json({
      success: true,
      source: "nili_creator",
      recipes
    });

  } catch (err) {
    console.log("COMMUNITY RECIPE SEARCH ERROR:", err);

    res.status(500).json({
      error: "Community recipe search failed"
    });
  }
});

function getApprovedRecipesFile() {
  return path.join(
    STORAGE_ROOT,
    "approved-recipes",
    "approved_recipes.json"
  );
}

const protectedMediaDirs = [
  "recipe-import-images",
  path.join("optimized-images", "recipe-import"),
  "creator-uploads",
  path.join("optimized-images", "creator")
];

function countProtectedMediaFiles() {
  let files = 0;
  let bytes = 0;

  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(target);
      } else if (entry.isFile()) {
        const stat = fs.statSync(target);
        files += 1;
        bytes += stat.size;
      }
    });
  }

  protectedMediaDirs.forEach(relativeDir => visit(storagePath(relativeDir)));
  return { files, bytes };
}

function localProtectedMediaPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return "";
    }
  } else {
    pathname = raw.split(/[?#]/)[0];
  }

  const normalizedPathname = pathname.replace(/\\/g, "/");
  const protectedPrefixes = [
    "/recipe-import-images/",
    "/optimized-images/recipe-import/",
    "/creator-uploads/",
    "/optimized-images/creator/"
  ];
  if (!protectedPrefixes.some(prefix => normalizedPathname.startsWith(prefix))) {
    return "";
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the original path if a legacy URL contains invalid escapes.
  }

  const resolved = path.resolve(STORAGE_ROOT, pathname.replace(/^[/\\]+/, ""));
  const rootWithSeparator = `${STORAGE_ROOT}${path.sep}`;
  return resolved === STORAGE_ROOT || resolved.startsWith(rootWithSeparator)
    ? resolved
    : "";
}

function approvedMediaInventory(recipes) {
  const missing = [];
  let linkedRecipes = 0;

  (Array.isArray(recipes) ? recipes : []).forEach(recipe => {
    const candidates = [
      recipe.mediaUrl,
      ...(Array.isArray(recipe.mediaUrls) ? recipe.mediaUrls : []),
      recipe.originalMediaUrl,
      ...(Array.isArray(recipe.originalMediaUrls) ? recipe.originalMediaUrls : [])
    ].filter(Boolean);

    const localCandidates = candidates
      .map(localProtectedMediaPath)
      .filter(Boolean);

    if (localCandidates.some(file => fs.existsSync(file))) {
      linkedRecipes += 1;
      return;
    }

    missing.push({
      id: recipe.id || recipe.systemKey || "",
      title: recipe.adminTitleTr || recipe.title || "",
      mediaUrl: recipe.mediaUrl || recipe.originalMediaUrl || ""
    });
  });

  return {
    checkedAt: new Date().toISOString(),
    approvedRecipes: Array.isArray(recipes) ? recipes.length : 0,
    linkedRecipes,
    missingCount: missing.length,
    missing: missing.slice(0, 100),
    storage: countProtectedMediaFiles()
  };
}

function updateApprovedMediaInventory(recipes) {
  const inventory = approvedMediaInventory(recipes);
  writeProtectionManifest({ approvedMediaInventory: inventory });
  return inventory;
}

function readApprovedRecipes() {
  const manifest = readProtectionManifest();
  const minimumCount = Math.max(
    configuredApprovedMinimum,
    Number(manifest["approved-recipesFloor"] || 0)
  );
  const recipes = readProtectedArray(
    getApprovedRecipesFile(),
    "approved-recipes",
    { minimumCount }
  );

  if (recipes.length > minimumCount) {
    writeProtectionManifest({
      "approved-recipesFloor": recipes.length,
      "approved-recipesCount": recipes.length
    });
  }
  if (
    !manifest.approvedMediaInventory ||
    Number(manifest.approvedMediaInventory.approvedRecipes || 0) !== recipes.length
  ) {
    updateApprovedMediaInventory(recipes);
  }
  return recipes;
}

function writeApprovedRecipes(recipes, {
  reason = "approved-update",
  snapshot = true
} = {}) {
  if (reason !== "creator-click-stats" && !String(reason).startsWith("recipe-card-")) {
    compactApprovedRecipeIds(recipes);
  }
  writeProtectedArray(
    getApprovedRecipesFile(),
    recipes,
    "approved-recipes",
    {
      preventDecrease: true,
      reason,
      snapshot
    }
  );
  if (reason !== "creator-click-stats") {
    updateApprovedMediaInventory(recipes);
  }
}

app.post("/admin/approve-recipe/:id", async (req, res) => {

  console.log("APPROVE ENDPOINT CALLED:", req.params.id);
  try {
    let pendingRecipes =
    readPendingRecipes();

    let approvedRecipes =
    readApprovedRecipes();

    const recipeIndex =
    pendingRecipes.findIndex(item =>
      item.id === req.params.id
    );

    if (recipeIndex === -1) {
      return res.status(404).json({
        error: "Recipe not found"
      });
    }

    const recipe =
    pendingRecipes[recipeIndex];

    if (!recipe.mediaUrl) {
      return res.status(400).json({
        success: false,
        error: "A recipe photo is required before publishing"
      });
    }

    const approvedRecipe = {
      ...recipe,
      importRecipeId:
        recipe.importRecipeId ||
        nextAvailableApprovedRecipeId(approvedRecipes),
      status: "approved",
      approvedAt: new Date().toISOString(),
      source: "nili_creator",
      clicks: Number(recipe.clicks || 0),
      bonusPerClick: Number(process.env.BONUS_PER_CLICK || 0.01),
      totalBonus: Number(recipe.totalBonus || 0)
    };

    const approvedNumber=approvedRecipeIdNumber(approvedRecipe);
    const approvedIdConflict=approvedNumber !== null && approvedRecipes.some(item =>
      item.deleted !== true &&
      String(item.id || "") !== String(approvedRecipe.id || "") &&
      approvedRecipeIdNumber(item) === approvedNumber
    );
    if(approvedNumber === null || approvedIdConflict){
      approvedRecipe.importRecipeId=nextAvailableApprovedRecipeId(
        approvedRecipes,
        approvedRecipe.id
      );
    }

    const existingApprovedIndex =
    approvedRecipes.findIndex(item =>
      item.id === approvedRecipe.id
    );

    if(existingApprovedIndex !== -1){
      approvedRecipes[existingApprovedIndex] = {
        ...approvedRecipes[existingApprovedIndex],
        ...approvedRecipe
      };
    }else{
      approvedRecipes.push(approvedRecipe);
    }

    pendingRecipes.splice(recipeIndex, 1);

    writeApprovedRecipes(approvedRecipes, { reason: "admin-approve" });
    writePendingRecipes(pendingRecipes, "admin-approve");


    queueRecipeCardGeneration([approvedRecipe.id], {
      reason:"recipe-approved"
    });

    console.log("APPROVED FILE:", getApprovedRecipesFile());
console.log("APPROVED COUNT:", approvedRecipes.length);
console.log("MOVED RECIPE:", approvedRecipe.title);

    console.log("RECIPE MOVED TO APPROVED:", approvedRecipe.title);

   

    const mail =
getRecipeStatusMail(
  "approved",
  recipe.creatorLang || recipe.lang || "en",
  recipe.adminTitleTr || recipe.title || "Recipe"
);

await sendMailSafe({
  to: recipe.creatorEmail,
  subject: mail.subject,
  text: mail.text,
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>${mail.subject}</h2>
      <p>${mail.text}</p>
      <p><strong>Nili’s Kitchen Team</strong></p>
    </div>
  `
});

return res.json({
      success: true,
      recipe: approvedRecipe
    });

  } catch (err) {
    console.log("APPROVE RECIPE ERROR:", err);
    await notifyAdminError("admin-approve-recipe", err, {
      recipeId: req.params.id
    });

    return res.status(500).json({
      error: "Approve failed"
    });
  }
});

app.post("/normalize-ingredients", async (req, res) => {
  try {
    const ingredients =
    req.body.ingredients || [];

    const lang =
    req.body.lang || "en";

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.json({
        success: true,
        ingredients: []
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        ingredients: ingredients.map(item => ({
          original: item,
          canonicalEn: String(item || "").trim().toLowerCase(),
          display: String(item || "").trim()
        }))
      });
    }

    const response =
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You normalize food ingredients. Fix spelling mistakes, translate every ingredient to canonical English for recipe API search, and also provide display name in the requested language. Return only valid JSON array. No extra text."
        },
        {
          role: "user",
          content: JSON.stringify({
            ingredients,
            displayLanguage: lang,
            requiredFormat: [
              {
                original: "original user input",
                canonicalEn: "clean English ingredient name",
                display: "ingredient name in displayLanguage"
              }
            ]
          })
        }
      ],
      temperature: 0.1
    });

    let content =
    response.choices[0].message.content || "";

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let normalized =
    JSON.parse(content);

    if (!Array.isArray(normalized)) {
      normalized = [];
    }

    normalized =
    normalized
      .filter(item => item && item.canonicalEn)
      .map(item => ({
        original: item.original || "",
        canonicalEn: String(item.canonicalEn || "").trim().toLowerCase(),
        display: item.display || item.canonicalEn
      }));

    return res.json({
      success: true,
      ingredients: normalized
    });

  } catch (err) {
    console.log("NORMALIZE INGREDIENTS ERROR:", err.message);

    const ingredients = Array.isArray(req.body?.ingredients)
      ? req.body.ingredients
      : [];

    return res.json({
      success: true,
      fallback: true,
      ingredients: ingredients.map(item => ({
        original: item,
        canonicalEn: String(item || "").trim().toLowerCase(),
        display: String(item || "").trim()
      }))
    });
  }
});

const NILI_ASSISTANT_FALLBACK = {
  en:{
    choose:"Choose at least one ingredient and I will guide you to suitable recipes.",
    quick:"I have set the quick cooking option. Let us choose the best recipes for your time.",
    healthy:"I have set the lighter and healthier option.",
    economic:"I have set the economical option.",
    recipes:"I will show recipes that match your selected ingredients.",
    substitute:"Tell me which ingredient is missing and I will suggest the closest practical substitute.",
    general:"Tell me what you have in your kitchen and what kind of meal you want."
  },
  tr:{
    choose:"En az bir malzeme seç; seni uygun tariflere yönlendireyim.",
    quick:"Hızlı pişirme tercihini ayarladım. Sürene en uygun tarifleri seçelim.",
    healthy:"Daha hafif ve sağlıklı seçeneğini ayarladım.",
    economic:"Ekonomik yemek seçeneğini ayarladım.",
    recipes:"Seçtiğin malzemelerle eşleşen tarifleri göstereceğim.",
    substitute:"Hangi malzemenin eksik olduğunu yaz; en uygun ve ulaşılabilir alternatifi önereyim.",
    general:"Mutfağında neler olduğunu ve nasıl bir yemek istediğini söyle."
  },
  de:{choose:"Wähle mindestens eine Zutat aus.",quick:"Die schnelle Option ist eingestellt.",healthy:"Die leichtere und gesündere Option ist eingestellt.",economic:"Die günstige Option ist eingestellt.",recipes:"Ich zeige passende Rezepte.",substitute:"Nenne die fehlende Zutat, dann schlage ich einen Ersatz vor.",general:"Sag mir, was du hast und was du kochen möchtest."},
  fr:{choose:"Choisissez au moins un ingrédient.",quick:"L'option rapide est sélectionnée.",healthy:"L'option légère et saine est sélectionnée.",economic:"L'option économique est sélectionnée.",recipes:"Je vais afficher les recettes adaptées.",substitute:"Indiquez l'ingrédient manquant pour obtenir un substitut.",general:"Dites-moi ce que vous avez et ce que vous souhaitez cuisiner."},
  es:{choose:"Selecciona al menos un ingrediente.",quick:"He seleccionado la opción rápida.",healthy:"He seleccionado la opción ligera y saludable.",economic:"He seleccionado la opción económica.",recipes:"Mostraré recetas adecuadas.",substitute:"Dime qué ingrediente falta y sugeriré un sustituto.",general:"Dime qué tienes y qué quieres cocinar."},
  pt:{choose:"Selecione pelo menos um ingrediente.",quick:"A opção rápida foi selecionada.",healthy:"A opção leve e saudável foi selecionada.",economic:"A opção econômica foi selecionada.",recipes:"Vou mostrar receitas adequadas.",substitute:"Diga qual ingrediente falta e sugerirei um substituto.",general:"Diga o que tem e o que quer cozinhar."},
  ru:{choose:"Выберите хотя бы один ингредиент.",quick:"Выбран быстрый вариант.",healthy:"Выбран лёгкий и полезный вариант.",economic:"Выбран экономный вариант.",recipes:"Я покажу подходящие рецепты.",substitute:"Назовите недостающий ингредиент, и я предложу замену.",general:"Расскажите, что у вас есть и что вы хотите приготовить."},
  ar:{choose:"اختر مكوناً واحداً على الأقل.",quick:"تم اختيار الطهي السريع.",healthy:"تم اختيار الوجبة الخفيفة والصحية.",economic:"تم اختيار الخيار الاقتصادي.",recipes:"سأعرض الوصفات المناسبة.",substitute:"اكتب المكون الناقص لأقترح بديلاً مناسباً.",general:"أخبرني بما لديك وما تريد طهيه."},
  ja:{choose:"食材を1つ以上選択してください。",quick:"時短オプションを設定しました。",healthy:"軽く健康的なオプションを設定しました。",economic:"節約オプションを設定しました。",recipes:"合うレシピを表示します。",substitute:"足りない食材を教えてください。代用品を提案します。",general:"食材と作りたい料理を教えてください。"},
  zh:{choose:"请至少选择一种食材。",quick:"已设置快速烹饪选项。",healthy:"已设置清淡健康选项。",economic:"已设置实惠选项。",recipes:"我会显示合适的食谱。",substitute:"请告诉我缺少的食材，我会推荐替代品。",general:"告诉我你有什么食材以及想做什么菜。"}
};

const NILI_ASSISTANT_PLAN_FALLBACK={
  en:"I will open the weekly planner so we can choose your budget, time and preferences.",
  tr:"Bütçeni, süreni ve tercihlerini seçebilmen için haftalık planlayıcıyı açıyorum.",
  de:"Ich öffne den Wochenplaner für Budget, Zeit und Vorlieben.",
  fr:"J'ouvre le planificateur hebdomadaire pour choisir votre budget, votre temps et vos préférences.",
  es:"Abriré el planificador semanal para elegir presupuesto, tiempo y preferencias.",
  pt:"Vou abrir o planejador semanal para definir orçamento, tempo e preferências.",
  ru:"Открываю недельный планировщик для выбора бюджета, времени и предпочтений.",
  ar:"سأفتح مخطط الأسبوع لاختيار الميزانية والوقت والتفضيلات.",
  ja:"予算、時間、好みを選べる週間プランナーを開きます。",
  zh:"我将打开每周计划器，设置预算、时间和偏好。"
};

function niliAssistantFallback(message, ingredients, lang){
  const copy=NILI_ASSISTANT_FALLBACK[lang] || NILI_ASSISTANT_FALLBACK.en;
  const text=normalizeText(message);
  const hasIngredients=Array.isArray(ingredients) && ingredients.length>0;

  if(/weekly|week|meal plan|hafta|wochen|semaine|seman|недел|أسبوع|週間|每周/.test(text)){
    return {
      reply:NILI_ASSISTANT_PLAN_FALLBACK[lang] || NILI_ASSISTANT_PLAN_FALLBACK.en,
      action:"open_meal_plan",
      preference:""
    };
  }
  if(/scan|photo|foto|kamera|camera/.test(text)){
    return {reply:copy.general,action:"open_scan",preference:""};
  }
  if(/substitut|alternative|alternatif|yerine|ersatz|remplac|sustitut|замен|代用|替代|بديل/.test(text)){
    return {reply:copy.substitute,action:"none",preference:""};
  }
  if(/light|healthy|hafif|saglik|gesund|léger|sain|salud|saud|полез|健康|صحي/.test(text)){
    return {reply:copy.healthy,action:"open_today",preference:"healthy"};
  }
  if(/economic|cheap|budget|ekonom|ucuz|günst|économ|barat|econ|бюдж|实惠|節約|اقتصاد/.test(text)){
    return {reply:copy.economic,action:"open_today",preference:"economic"};
  }
  if(/quick|fast|hizli|schnell|rapide|rápid|быстр|時短|快速|سريع/.test(text)){
    return {reply:copy.quick,action:"open_today",preference:"easy"};
  }
  if(/recipe|tarif|rezept|recette|receta|receita|рецепт|レシピ|食谱|وصف/.test(text)){
    return hasIngredients
      ? {reply:copy.recipes,action:"find_recipes",preference:""}
      : {reply:copy.choose,action:"open_ingredients",preference:""};
  }
  return {reply:hasIngredients ? copy.recipes : copy.general,action:"none",preference:""};
}

function mealPlanNumber(value, fallback, minimum, maximum){
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed),minimum),maximum);
}

function mealPlanRecipeIngredients(recipe){
  const structured=[
    ...(Array.isArray(recipe?.extendedIngredients) ? recipe.extendedIngredients : []),
    ...(Array.isArray(recipe?.usedIngredients) ? recipe.usedIngredients : [])
  ]
    .map(item=>String(item?.original || item?.originalName || item?.name || item || "").trim())
    .filter(Boolean);

  if(structured.length) return uniqueList(structured);

  return String(
    recipe?.ingredientsText ||
    recipe?.adminIngredientsTr ||
    recipe?.ingredients ||
    ""
  )
    .split(/\r?\n|,(?=\s*[^\d])/)
    .map(item=>item.replace(/^[•*-]\s*/,"").trim())
    .filter(Boolean);
}

function mealPlanRecipeText(recipe){
  return normalizeText([
    recipe?.title,
    recipe?.country,
    recipe?.cuisine,
    recipe?.category,
    recipe?.dishType,
    ...(Array.isArray(recipe?.tags) ? recipe.tags : []),
    ...mealPlanRecipeIngredients(recipe)
  ].filter(Boolean).join(" "));
}

function mealPlanReadyMinutes(recipe){
  const candidates=[
    recipe?.readyInMinutes,
    recipe?.prepTime,
    recipe?.cookingTime,
    recipe?.cookTime
  ];
  for(const candidate of candidates){
    const match=String(candidate ?? "").match(/\d+/);
    if(match){
      const value=Number(match[0]);
      if(Number.isFinite(value) && value>0) return value;
    }
  }
  return 30;
}

const MEAL_PLAN_DIET_EXCLUSIONS={
  vegetarian:/\b(beef|veal|lamb|mutton|chicken|turkey|pork|bacon|ham|sausage|fish|salmon|tuna|shrimp|prawn|anchov|meat|kıyma|kiyma|dana|kuzu|tavuk|hindi|domuz|balık|balik|somon|ton balığı|karides|et)\b/i,
  vegan:/\b(beef|veal|lamb|mutton|chicken|turkey|pork|bacon|ham|sausage|fish|salmon|tuna|shrimp|prawn|anchov|meat|egg|milk|cream|cheese|butter|yogurt|honey|kıyma|kiyma|dana|kuzu|tavuk|hindi|domuz|balık|balik|somon|karides|et|yumurta|süt|sut|krema|peynir|tereyağ|yoğurt|yogurt|bal)\b/i,
  halal:/\b(pork|bacon|ham|prosciutto|salami|wine|beer|brandy|rum|vodka|liqueur|mirin|domuz|şarap|sarap|bira|likör|likor)\b/i,
  gluten_free:/\b(wheat|flour|bread|pasta|noodle|couscous|bulgur|barley|rye|seitan|un|ekmek|makarna|erişte|eriste|bulgur|arpa|çavdar|cavdar)\b/i
};

function mealPlanDietCompatible(recipe,diet){
  const exclusion=MEAL_PLAN_DIET_EXCLUSIONS[diet];
  return !exclusion || !exclusion.test(mealPlanRecipeText(recipe));
}

function mealPlanLooksLikeDinner(recipe){
  return !/\b(drink|beverage|cocktail|smoothie|juice|tea|coffee|dessert|cake|cookie|ice cream|breakfast|içecek|icecek|kokteyl|meyve suyu|çay|cay|kahve|tatlı|tatli|kek|kurabiye|dondurma|kahvaltı|kahvalti)\b/i
    .test(mealPlanRecipeText(recipe));
}

function mealPlanHash(value){
  let hash=2166136261;
  const text=String(value || "");
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function mealPlanBudgetScore(recipe,budget){
  if(budget!=="low") return budget==="flexible" ? 2 : 0;
  const text=mealPlanRecipeText(recipe);
  let score=0;
  if(/\b(bean|lentil|chickpea|rice|pasta|potato|egg|soup|fasulye|mercimek|nohut|pirinç|pirinc|makarna|patates|yumurta|çorba|corba)\b/i.test(text)) score+=18;
  if(/\b(steak|filet|salmon|shrimp|prawn|lobster|truffle|bonfile|somon|karides|ıstakoz|istakoz)\b/i.test(text)) score-=16;
  score+=Math.max(0,14-mealPlanRecipeIngredients(recipe).length);
  return score;
}

function mealPlanIngredientCategory(value){
  const text=normalizeText(value);
  if(/\b(meat|beef|chicken|lamb|pork|fish|salmon|tuna|shrimp|dana|tavuk|kuzu|et|balik|somon|karides)\b/.test(text)) return "protein";
  if(/\b(milk|cream|cheese|butter|yogurt|egg|sut|krema|peynir|tereyag|yogurt|yumurta)\b/.test(text)) return "dairy";
  if(/\b(rice|pasta|flour|bread|noodle|bulgur|grain|pirinc|makarna|un|ekmek|eriste|tahil)\b/.test(text)) return "pantry";
  if(/\b(oil|salt|pepper|spice|sauce|vinegar|sugar|yag|tuz|biber|baharat|sos|sirke|seker)\b/.test(text)) return "pantry";
  return "produce";
}

function scaleMealPlanIngredient(value,factor){
  const text=String(value || "").trim();
  if(!text || !Number.isFinite(factor) || Math.abs(factor-1)<0.05) return text;

  return text.replace(
    /(^|[^\d])(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/,
    (match,prefix,amount)=>{
      let number;
      if(amount.includes("/")){
        const [top,bottom]=amount.split("/").map(part=>Number(part.trim()));
        number=bottom ? top/bottom : top;
      }else{
        number=Number(amount.replace(",","."));
      }
      if(!Number.isFinite(number)) return match;
      const scaled=number*factor;
      const rounded=scaled>=10
        ? Math.round(scaled)
        : Math.round(scaled*4)/4;
      return `${prefix}${String(rounded).replace(".",",")}`;
    }
  );
}

function buildMealPlanShoppingList(recipes,pantry){
  const pantryTerms=(Array.isArray(pantry) ? pantry : [])
    .map(normalizeText)
    .filter(term=>term.length>1);
  const seen=new Set();
  const items=[];

  recipes.forEach(recipe=>{
    mealPlanRecipeIngredients(recipe).forEach(raw=>{
      const name=String(raw || "").trim();
      const normalized=normalizeText(name)
        .replace(/\b\d+(?:[.,]\d+)?\b/g," ")
        .replace(/\b(g|kg|ml|l|cup|cups|tbsp|tsp|tablespoon|teaspoon|adet|gram|kilogram|su bardagi|yemek kasigi|tatli kasigi)\b/g," ")
        .replace(/\s+/g," ")
        .trim();
      if(!normalized || normalized.length<2) return;
      if(pantryTerms.some(term=>normalized.includes(term) || term.includes(normalized))) return;
      if(seen.has(normalized)) return;
      seen.add(normalized);
      items.push({
        id:`shop-${items.length+1}`,
        name,
        category:mealPlanIngredientCategory(name),
        recipeTitle:recipe.title || ""
      });
    });
  });

  return items;
}

app.post("/meal-plan",async(req,res)=>{
  try{
    const days=mealPlanNumber(req.body?.days,5,3,7);
    const servings=mealPlanNumber(req.body?.servings,2,1,10);
    const maxTime=mealPlanNumber(req.body?.maxTime,45,15,120);
    const budget=new Set(["low","medium","flexible"]).has(req.body?.budget)
      ? req.body.budget
      : "medium";
    const diet=new Set(["standard","vegetarian","vegan","halal","gluten_free"]).has(req.body?.diet)
      ? req.body.diet
      : "standard";
    const lang=String(req.body?.lang || "en").trim().toLowerCase();
    const pantry=(Array.isArray(req.body?.pantry) ? req.body.pantry : [])
      .map(item=>String(item || "").trim())
      .filter(Boolean)
      .slice(0,80);
    const disliked=(Array.isArray(req.body?.disliked) ? req.body.disliked : String(req.body?.disliked || "").split(","))
      .map(item=>normalizeText(item))
      .filter(Boolean)
      .slice(0,30);

    const basePool=filterRenderableRecipes(uniqueRecipes(
      searchNiliDiscovery({query:"",cuisine:"",category:"",limit:10000})
    )).filter(mealPlanLooksLikeDinner);

    const dislikeCompatible=recipe=>{
      const text=mealPlanRecipeText(recipe);
      return !disliked.some(term=>term.length>1 && text.includes(term));
    };

    let pool=basePool.filter(recipe=>
      dislikeCompatible(recipe) &&
      mealPlanDietCompatible(recipe,diet) &&
      mealPlanReadyMinutes(recipe)<=maxTime
    );

    if(pool.length<days){
      pool=basePool.filter(recipe=>
        dislikeCompatible(recipe) &&
        mealPlanDietCompatible(recipe,diet) &&
        mealPlanReadyMinutes(recipe)<=Math.max(maxTime,60)
      );
    }
    if(pool.length<days){
      pool=basePool.filter(recipe=>dislikeCompatible(recipe) && mealPlanDietCompatible(recipe,diet));
    }

    const weekKey=new Date().toISOString().slice(0,10);
    const seed=JSON.stringify({days,servings,maxTime,budget,diet,disliked,weekKey});
    const ranked=pool
      .map(recipe=>({
        recipe,
        score:
          (recipe.source==="nili_creator" ? 35 : 0) +
          mealPlanBudgetScore(recipe,budget) +
          Math.max(-20,20-Math.abs(mealPlanReadyMinutes(recipe)-maxTime)/2) +
          (mealPlanHash(`${seed}:${recipe.id || recipe.title}`)%1000)/1000
      }))
      .sort((a,b)=>b.score-a.score);

    const chosen=[];
    const usedCountries=new Map();
    while(chosen.length<days && ranked.length){
      let bestIndex=0;
      let bestAdjusted=-Infinity;
      ranked.forEach((entry,index)=>{
        const country=normalizeText(entry.recipe.country || entry.recipe.cuisine || "");
        const repeatPenalty=(usedCountries.get(country) || 0)*16;
        const adjusted=entry.score-repeatPenalty;
        if(adjusted>bestAdjusted){
          bestAdjusted=adjusted;
          bestIndex=index;
        }
      });
      const [{recipe}]=ranked.splice(bestIndex,1);
      chosen.push(recipe);
      const country=normalizeText(recipe.country || recipe.cuisine || "");
      usedCountries.set(country,(usedCountries.get(country) || 0)+1);
    }

    if(!chosen.length){
      return res.status(404).json({error:"No suitable Nili recipes were found"});
    }

    const localized=await localizeRecipeCollection(chosen,lang);
    const plannedRecipes=localized.map(recipe=>{
      const originalServings=Number(recipe.servings || servings) || servings;
      const factor=servings/originalServings;
      const scaledIngredients=mealPlanRecipeIngredients(recipe)
        .map(item=>scaleMealPlanIngredient(item,factor));
      return {
        ...recipe,
        servings,
        ingredients:scaledIngredients,
        extendedIngredients:scaledIngredients.map(item=>({original:item,name:item}))
      };
    });
    const dayPlans=plannedRecipes.map((recipe,index)=>({
      day:index+1,
      recipe:{
        ...recipe,
        readyInMinutes:mealPlanReadyMinutes(recipe),
        servings
      }
    }));
    const shoppingList=buildMealPlanShoppingList(plannedRecipes,pantry);

    return res.json({
      success:true,
      planId:`NP-${Date.now().toString(36).toUpperCase()}`,
      days,
      servings,
      maxTime,
      budget,
      diet,
      pantry,
      plan:dayPlans,
      shoppingList,
      meta:{
        source:"nili_database",
        availablePool:basePool.length,
        suitablePool:pool.length,
        generatedAt:new Date().toISOString()
      }
    });
  }catch(error){
    console.log("MEAL PLAN FAILED:",error);
    return res.status(500).json({error:"Meal plan could not be created"});
  }
});

const niliAssistantVerificationCodes=new Map();
const NILI_ASSISTANT_CODE_TTL_MS=10*60*1000;
const NILI_ASSISTANT_CODE_RESEND_MS=60*1000;
const NILI_ASSISTANT_SESSION_TTL_MS=30*24*60*60*1000;
const niliAssistantTokenSecret=crypto
  .createHash("sha256")
  .update(
    process.env.NILI_ASSISTANT_TOKEN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.SMTP_PASS ||
    "nili-assistant-local-secret"
  )
  .digest();

const NILI_ASSISTANT_EMAIL_COPY={
  en:{subject:"Your Nili verification code",title:"Verify your email",body:"Use this code to continue chatting with Nili.",expires:"This code expires in 10 minutes."},
  tr:{subject:"Nili doğrulama kodunuz",title:"E-posta adresinizi doğrulayın",body:"Nili ile sohbete devam etmek için bu kodu kullanın.",expires:"Bu kod 10 dakika içinde geçerliliğini yitirir."},
  de:{subject:"Ihr Nili-Bestätigungscode",title:"E-Mail bestätigen",body:"Verwenden Sie diesen Code, um mit Nili weiterzuchatten.",expires:"Dieser Code ist 10 Minuten gültig."},
  fr:{subject:"Votre code de vérification Nili",title:"Vérifiez votre e-mail",body:"Utilisez ce code pour continuer à discuter avec Nili.",expires:"Ce code expire dans 10 minutes."},
  es:{subject:"Tu código de verificación de Nili",title:"Verifica tu correo",body:"Usa este código para seguir conversando con Nili.",expires:"Este código caduca en 10 minutos."},
  pt:{subject:"Seu código de verificação Nili",title:"Verifique seu e-mail",body:"Use este código para continuar conversando com Nili.",expires:"Este código expira em 10 minutos."},
  ru:{subject:"Код подтверждения Nili",title:"Подтвердите электронную почту",body:"Используйте этот код, чтобы продолжить общение с Nili.",expires:"Код действует 10 минут."},
  ar:{subject:"رمز التحقق من Nili",title:"تحقق من بريدك الإلكتروني",body:"استخدم هذا الرمز لمتابعة الدردشة مع Nili.",expires:"تنتهي صلاحية الرمز خلال 10 دقائق."},
  ja:{subject:"Nili認証コード",title:"メールアドレスを確認",body:"Niliとのチャットを続けるには、このコードを使用してください。",expires:"このコードは10分で期限切れになります。"},
  zh:{subject:"Nili 验证码",title:"验证您的电子邮箱",body:"使用此验证码继续与 Nili 聊天。",expires:"验证码将在10分钟后失效。"}
};

function cleanAssistantEmail(value){
  const email=String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
}

function assistantVerificationCodeHash(email,code){
  return crypto
    .createHmac("sha256",niliAssistantTokenSecret)
    .update(`${email}:${code}`)
    .digest("hex");
}

function createNiliAssistantToken(email){
  const payload=Buffer.from(JSON.stringify({
    email,
    exp:Date.now()+NILI_ASSISTANT_SESSION_TTL_MS
  })).toString("base64url");
  const signature=crypto
    .createHmac("sha256",niliAssistantTokenSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyNiliAssistantToken(token){
  try{
    const [payload,signature]=String(token || "").split(".");
    if(!payload || !signature) return null;
    const expected=crypto
      .createHmac("sha256",niliAssistantTokenSecret)
      .update(payload)
      .digest("base64url");
    const left=Buffer.from(signature);
    const right=Buffer.from(expected);
    if(left.length!==right.length || !crypto.timingSafeEqual(left,right)) return null;
    const session=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    const email=cleanAssistantEmail(session?.email);
    if(!email || !Number.isFinite(session?.exp) || session.exp<=Date.now()) return null;
    return {email,exp:session.exp};
  }catch{
    return null;
  }
}

function niliAssistantRequestToken(req){
  const authorization=String(req.headers.authorization || "");
  if(/^Bearer\s+/i.test(authorization)){
    return authorization.replace(/^Bearer\s+/i,"").trim();
  }
  return String(req.body?.verificationToken || "").trim();
}

app.post("/nili-assistant/request-code",async(req,res)=>{
  const email=cleanAssistantEmail(req.body?.email);
  const lang=String(req.body?.lang || "en").trim().toLowerCase();
  const copy=NILI_ASSISTANT_EMAIL_COPY[lang] || NILI_ASSISTANT_EMAIL_COPY.en;

  if(!email){
    return res.status(400).json({error:"A valid email address is required",code:"INVALID_EMAIL"});
  }

  const existing=niliAssistantVerificationCodes.get(email);
  if(existing && Date.now()-existing.sentAt<NILI_ASSISTANT_CODE_RESEND_MS){
    return res.status(429).json({
      error:"Please wait before requesting another code",
      code:"CODE_RATE_LIMIT",
      retryAfter:Math.ceil((NILI_ASSISTANT_CODE_RESEND_MS-(Date.now()-existing.sentAt))/1000)
    });
  }

  const code=String(crypto.randomInt(100000,1000000));
  niliAssistantVerificationCodes.set(email,{
    codeHash:assistantVerificationCodeHash(email,code),
    expiresAt:Date.now()+NILI_ASSISTANT_CODE_TTL_MS,
    sentAt:Date.now(),
    attempts:0
  });

  const sent=await sendMailSafe({
    to:email,
    subject:copy.subject,
    text:`${copy.title}\n\n${copy.body}\n\n${code}\n\n${copy.expires}`,
    html:`
      <div style="max-width:560px;margin:auto;padding:28px;font-family:Arial,sans-serif;background:#fff9ef;color:#26382f;border:1px solid #e4bf6c;border-radius:22px">
        <h1 style="margin:0 0 10px;color:#173f2d">${escapeHtml(copy.title)}</h1>
        <p>${escapeHtml(copy.body)}</p>
        <div style="margin:24px 0;padding:16px;text-align:center;font-size:34px;font-weight:800;letter-spacing:8px;color:#fff;background:#c7602f;border-radius:16px">${code}</div>
        <p style="font-size:13px;color:#6d655b">${escapeHtml(copy.expires)}</p>
      </div>
    `
  });

  if(!sent){
    niliAssistantVerificationCodes.delete(email);
    return res.status(503).json({error:"Verification email could not be sent",code:"MAIL_FAILED"});
  }

  return res.json({success:true,email,expiresIn:600});
});

app.post("/nili-assistant/verify-code",(req,res)=>{
  const email=cleanAssistantEmail(req.body?.email);
  const code=String(req.body?.code || "").replace(/\D/g,"").slice(0,6);
  const entry=email ? niliAssistantVerificationCodes.get(email) : null;

  if(!email || code.length!==6 || !entry){
    return res.status(400).json({error:"The verification code is invalid",code:"INVALID_CODE"});
  }
  if(entry.expiresAt<=Date.now()){
    niliAssistantVerificationCodes.delete(email);
    return res.status(410).json({error:"The verification code has expired",code:"CODE_EXPIRED"});
  }
  if(entry.attempts>=5){
    niliAssistantVerificationCodes.delete(email);
    return res.status(429).json({error:"Too many verification attempts",code:"TOO_MANY_ATTEMPTS"});
  }

  entry.attempts+=1;
  const expected=Buffer.from(entry.codeHash);
  const actual=Buffer.from(assistantVerificationCodeHash(email,code));
  if(expected.length!==actual.length || !crypto.timingSafeEqual(expected,actual)){
    return res.status(401).json({error:"The verification code is incorrect",code:"WRONG_CODE"});
  }

  niliAssistantVerificationCodes.delete(email);
  return res.json({
    success:true,
    email,
    token:createNiliAssistantToken(email),
    expiresIn:Math.floor(NILI_ASSISTANT_SESSION_TTL_MS/1000)
  });
});

app.post("/nili-assistant/session",(req,res)=>{
  const session=verifyNiliAssistantToken(niliAssistantRequestToken(req));
  if(!session){
    return res.status(401).json({valid:false,code:"EMAIL_VERIFICATION_REQUIRED"});
  }
  return res.json({valid:true,email:session.email,expiresAt:session.exp});
});

app.post("/nili-assistant", async (req,res) => {
  const assistantSession=verifyNiliAssistantToken(niliAssistantRequestToken(req));
  if(!assistantSession){
    return res.status(401).json({
      error:"Email verification is required",
      code:"EMAIL_VERIFICATION_REQUIRED"
    });
  }
  const message=String(req.body?.message || "").trim().slice(0,500);
  const lang=String(req.body?.lang || "en").trim().toLowerCase();
  const ingredients=(Array.isArray(req.body?.ingredients) ? req.body.ingredients : [])
    .map(item=>String(item || "").trim().slice(0,80))
    .filter(Boolean)
    .slice(0,30);

  if(!message){
    return res.status(400).json({error:"Message is required"});
  }

  const fallback=niliAssistantFallback(message,ingredients,lang);
  if(!process.env.OPENAI_API_KEY){
    return res.json(fallback);
  }

  try{
    const response=await openai.chat.completions.create({
      model:"gpt-4o-mini",
      response_format:{type:"json_object"},
      temperature:0.25,
      messages:[
        {
          role:"system",
          content:`
You are Nili, the warm and concise personal cooking assistant inside Nili's Kitchen.
Reply only in ${getTargetLanguageName(lang)}.
Use the user's selected ingredients as context.
Never claim that a specific recipe exists in the database.
For substitutions, give practical food-safe alternatives and mention when the result changes.
Keep the reply under 90 words.

Return only JSON with:
{
  "reply":"your helpful answer",
  "action":"none|find_recipes|open_today|open_ingredients|open_scan|open_meal_plan",
  "preference":"easy|economic|healthy|elegant|kids|"
}

Action rules:
- If the user asks to see recipes and ingredients exist, use find_recipes.
- If recipes are requested without ingredients, use open_ingredients.
- For quick, healthy, economical, elegant or kids cooking guidance, use open_today and the matching preference.
- For photo scanning, use open_scan.
- For a weekly meal plan or shopping list, use open_meal_plan.
- For substitutions or general cooking questions, use none.
`
        },
        {
          role:"user",
          content:JSON.stringify({message,selectedIngredients:ingredients})
        }
      ]
    },{
      timeout:12000,
      maxRetries:1
    });

    const parsed=JSON.parse(response?.choices?.[0]?.message?.content || "{}");
    const allowedActions=new Set(["none","find_recipes","open_today","open_ingredients","open_scan","open_meal_plan"]);
    const allowedPreferences=new Set(["","easy","economic","healthy","elegant","kids"]);
    const parsedAction=allowedActions.has(parsed.action) ? parsed.action : fallback.action;
    const safeAction=fallback.action==="none" ? "none" : parsedAction;
    return res.json({
      reply:String(parsed.reply || fallback.reply).trim().slice(0,900),
      action:safeAction,
      preference:allowedPreferences.has(parsed.preference) ? parsed.preference : fallback.preference
    });
  }catch(error){
    console.log("NILI ASSISTANT FAILED:",error.message);
    return res.json({...fallback,fallback:true});
  }
});

app.post("/send-error-alert", async (req, res) => {
  try {
    const { source, error, page, time } = req.body;

    await notifyAdminError(source || "frontend", error || "No error message", {
      page: page || "-",
      time: time || new Date().toISOString()
    });

    res.json({ success: true });

  } catch (e) {
    console.error("ERROR ALERT MAIL FAILED:", e.message);
    res.status(500).json({ success: false });
  }
});

app.get("/creator-dashboard/:email", (req, res) => {
  try {
    const email =
    decodeURIComponent(req.params.email || "").trim().toLowerCase();

    const pendingRecipes =
    readPendingRecipes();

    const approvedRecipes =
    readApprovedRecipes();

    const creatorPending =
    pendingRecipes.filter(recipe =>
      String(recipe.creatorEmail || "").trim().toLowerCase() === email
    );

    const creatorApproved =
    approvedRecipes.filter(recipe =>
      String(recipe.creatorEmail || "").trim().toLowerCase() === email
    );

    const totalViews =
    creatorApproved.reduce((sum, recipe) =>
      sum + Number(recipe.views || 0), 0
    );

    const totalEarnings =
    creatorApproved.reduce((sum, recipe) =>
      sum + Number(recipe.totalBonus || 0), 0
    );

    const totalClicks =
    creatorApproved.reduce((sum, recipe) =>
      sum + Number(recipe.clicks || 0), 0
    );

    return res.json({
      success: true,
      creatorEmail: email,
      stats: {
        totalRecipes: creatorPending.length + creatorApproved.length,
        pending: creatorPending.length,
        published: creatorApproved.length,
        views: totalViews,
        clicks: totalClicks,
        bonusPerClick: BONUS_PER_CLICK,
        earnings: totalEarnings
      },
      pendingRecipes: creatorPending,
      publishedRecipes: creatorApproved
    });

  } catch (err) {
    console.log("CREATOR DASHBOARD ERROR:", err);
    notifyAdminError("creator-dashboard", err, {
      email: req.params.email
    });

    return res.status(500).json({
      success: false,
      error: "Dashboard failed"
    });
  }
});

app.post("/creator-recipe-click/:id", (req, res) => {
  try {
    const requestOrigin = String(req.headers.origin || req.headers.referer || "");
    const isLocalPreview =
      /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/i.test(requestOrigin);

    // Local Live Server reloads whenever this endpoint rewrites the recipe
    // JSON, which otherwise creates an open/reload/open loop in recipe detail.
    if (isLocalPreview) {
      return res.json({ success: true, tracked: false, localPreview: true });
    }

    const recipeId = String(req.params.id || "");
    const approvedRecipes = readApprovedRecipes();
    const index = approvedRecipes.findIndex(recipe =>
      String(recipe.id) === recipeId || String(recipe.sourceId) === recipeId
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Recipe not found"
      });
    }

    const recipe = approvedRecipes[index];
    const bonusPerClick = Number(recipe.bonusPerClick || BONUS_PER_CLICK || 0);

    approvedRecipes[index] = {
      ...recipe,
      clicks: Number(recipe.clicks || 0) + 1,
      views: Number(recipe.views || 0) + 1,
      bonusPerClick,
      totalBonus: Number((Number(recipe.totalBonus || 0) + bonusPerClick).toFixed(4)),
      lastClickedAt: new Date().toISOString()
    };

    writeApprovedRecipes(approvedRecipes, {
      reason: "creator-click-stats",
      snapshot: false
    });

    return res.json({
      success: true,
      recipe: {
        id: approvedRecipes[index].id,
        clicks: approvedRecipes[index].clicks,
        views: approvedRecipes[index].views,
        totalBonus: approvedRecipes[index].totalBonus
      }
    });
  } catch (err) {
    console.log("CREATOR RECIPE CLICK ERROR:", err);
    notifyAdminError("creator-recipe-click", err, {
      recipeId: req.params.id
    });
    return res.status(500).json({
      success: false,
      error: "Click tracking failed"
    });
  }
});

app.use(async (err, req, res, next) => {
  if (err?.status === 404 || err?.statusCode === 404 || err?.code === "ENOENT") {
    if (res.headersSent) return next(err);
    return res.status(404).json({ success: false, error: "File not found" });
  }

  console.log("EXPRESS ERROR:", err);
  await notifyAdminError("express-error", err, {
    method: req.method,
    path: req.originalUrl
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    error: "Server error"
  });
});

try {
  const protectedApprovedRecipes = readApprovedRecipes();
  const protectedPendingRecipes = readPendingRecipes();
  console.log(
    `DATA PROTECTION READY: ${protectedApprovedRecipes.length} approved, ` +
    `${protectedPendingRecipes.length} pending, minimum ${configuredApprovedMinimum}`
  );
} catch (error) {
  console.error("DATA PROTECTION STARTUP BLOCK:", error.message);
  process.exit(1);
}

const httpServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  const recoveredCardJobs = recoverInterruptedRecipeCardJobs();
  if (recoveredCardJobs) console.log(`RECIPE CARD QUEUE: recovered ${recoveredCardJobs} interrupted job(s)`);
  setImmediate(processRecipeCardGenerationQueue);
});

httpServer.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. The API may already be running.`);
    process.exit(1);
  }

  throw err;
});

// NK_BREADCRUMB_VALIDATION_1
function breadcrumbRule(source, lang) {
  if (!/galeta\s+unu?/iu.test(String(source))) return null;
  return {
    en: /\bbread\s*crumbs?\b|\bpanko\b/iu,
    de: /paniermehl|semmelbrösel|brotbrösel|panko/iu,
    fr: /chapelure|miettes\s+de\s+pain/iu,
    es: /pan\s+rallado/iu,
    pt: /farinha\s+de\s+rosca|pão\s+ralado/iu,
    ru: /панировочн\S*\s+сухар/iu,
    ar: /بقسماط|فتات الخبز|خبز مطحون/u,
    ja: /パン粉/u,
    zh: /面包屑|面包糠|麵包屑|麵包糠/u
  }[String(lang || '').toLowerCase()] || null;
}
