import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const root = process.cwd();
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function writeTextWithRetry(file, content, attempts = 12) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tempFile = `${file}.tmp-${process.pid}-${Date.now()}-${attempt}`;
    try {
      fs.writeFileSync(tempFile, content, "utf8");
      try {
        fs.renameSync(tempFile, file);
      } catch {
        fs.copyFileSync(tempFile, file);
        fs.unlinkSync(tempFile);
      }
      return;
    } catch (error) {
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
      if (!["EPERM", "EBUSY", "EACCES"].includes(error?.code) || attempt === attempts) throw error;
      await wait(150 * attempt);
    }
  }
}
const recipes = JSON.parse(fs.readFileSync(path.join(root, "approved-recipes", "approved_recipes.json"), "utf8"));
const arg = name => String(process.argv.find(value => value.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || "").trim();
const lang = (arg("lang") || "tr").toLowerCase();
const supportedLanguages = ["en", "tr", "de", "fr", "es", "pt", "ru", "ar", "ja", "zh"];
if (!supportedLanguages.includes(lang)) throw new Error(`Unsupported language: ${lang}`);
const requestedId = arg("id") || "1783602828950";
const recipe = recipes.find(item => String(item.id) === requestedId || item.importRecipeId === requestedId);
if (!recipe) throw new Error(`Recipe not found: ${requestedId}`);
const isKarniyarik = recipe.importRecipeId === "NK-000001" || /karn[ıi]yar[ıi]k/i.test(String(recipe.adminTitleTr || recipe.title || ""));
const servingIdentity = [recipe.adminTitleTr, recipe.title, recipe.originalName, recipe.category, recipe.type, recipe.cuisine]
  .map(value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("tr-TR"))
  .join(" ");
const servingProfile = isKarniyarik ? "special"
  : /pizza|pide|lahmacun|flatbread|focaccia|naan|tortilla|tarte flambee|flammkuchen/.test(servingIdentity) ? "board"
  : /corba|soup|stew|curry|ramen|pho|noodle|risotto|pilav|rice|chili|gumbo|bisque|broth|hotpot/.test(servingIdentity) ? "bowl"
  : /lasagn|lazany|casserole|gratin|guvec|güveç|roast|firin|fırın|baked|bake|moussaka|musakka/.test(servingIdentity) ? "tray"
  : "plate";

const localizedResponse = await fetch(`http://127.0.0.1:3000/public-recipe/${encodeURIComponent(recipe.id)}?lang=${encodeURIComponent(lang)}`);
if (!localizedResponse.ok) {
  let failure = {};
  try { failure = await localizedResponse.json(); } catch {}
  throw new Error(`Recipe localization failed: ${localizedResponse.status} ${failure.error || ""} ${failure.details || ""}`.trim());
}
const localized = (await localizedResponse.json()).recipe;

function sourceIngredientTexts(value) {
  const raw = value.adminIngredientsTr || value.ingredients || [];
  return (Array.isArray(raw) ? raw : String(raw).split(/\r?\n|;+/))
    .map(item => String(item?.original || item?.name || item || "").trim())
    .filter(Boolean);
}

function sourceStepTexts(value) {
  const raw = value.adminInstructionsTr || value.instructions || "";
  return String(raw).replace(/\\n/g, "\n").split(/\r?\n|(?=\s*\d{1,2}[.)]\s+)/)
    .map(item => item.replace(/^\s*\d{1,2}[.)]\s*/, "").trim()).filter(Boolean);
}

function validateCardLocalization({ source, localizedRecipe, targetLang, localizedIngredients, localizedSteps }) {
  const issues = [];
  const sourceIngredients = sourceIngredientTexts(source);
  const sourceSteps = sourceStepTexts(source);
  const normalized = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  const hasLetters = value => /\p{L}/u.test(String(value || ""));
  const targetScripts = {
    ar:/[\u0600-\u06ff]/u,
    ru:/[\u0400-\u04ff]/u,
    ja:/[\u3040-\u30ff\u3400-\u9fff]/u,
    zh:/[\u3400-\u9fff]/u
  };
  const turkishLeak = /(?:[ğıİş]|\b(?:adet|yemek kaşığı|çay kaşığı|su bardağı|tatlı kaşığı|soğan|sarımsak|tereyağı|zeytinyağı|karabiber|kırmızı biber|pul biber|yumurta|patlıcan|domates|maydanoz|yoğurt|peynir|buğday|aşurelik|asma yaprağı|üzüm yaprağı|pirinç|mercimek|nohut|fasulye|kıyma|tavuk|karides|mantar|şeker|tuz)\b)/iu;
  // Some protected product names are legitimately retained in translations.
  // Do not mistake their Turkish characters for an untranslated whole line.
  const withoutProtectedCulinaryNames = value => String(value || "")
    .replace(/pastırma/giu, "")
    .replace(/sucuk/giu, "");
  const sourceTurkishMarker = /(?:[çğıöşü]|\b(?:adet|yemek kaşığı|çay kaşığı|su bardağı|tatlı kaşığı|soğan|sarımsak|tereyağı|zeytinyağı|karabiber|kırmızı biber|pul biber|yumurta|patlıcan|domates|maydanoz|yoğurt|peynir|buğday|aşurelik|asma yaprağı|üzüm yaprağı|pirinç|mercimek|nohut|fasulye|kıyma|tavuk|karides|mantar|şeker|tuz|un)\b)/iu;
  const englishLeakByTarget = {
    de:/\b(?:flour|tablespoons?|teaspoons?|cups?|onions?|garlic|water|black pepper|red pepper|eggs?|sugar)\b/i,
    fr:/\b(?:flour|tablespoons?|teaspoons?|cups?|onions?|garlic|water|black pepper|red pepper|eggs?)\b/i,
    es:/\b(?:flour|tablespoons?|teaspoons?|cups?|onions?|garlic|water|black pepper|red pepper|eggs?|butter)\b/i,
    pt:/\b(?:flour|tablespoons?|teaspoons?|cups?|onions?|garlic|water|black pepper|red pepper|eggs?|butter)\b/i
  };
  const requiredTerms = {
    flour:{source:/\b(?:un|unu)\b/iu,targets:{en:/\bflour\b/i,de:/mehl\b/i,fr:/\bfarine\b/i,es:/\bharina\b/i,pt:/\bfarinha\b/i,ru:/мук/iu,ar:/دقيق/u,ja:/粉/u,zh:/面粉|麦粉/u}},
    bulgur:{source:/\bbulgur\b/iu,targets:{en:/\bbulgur\b/i,de:/\bbulgur\b/i,fr:/\bboulgour\b/i,es:/\bbulgur\b/i,pt:/\bbulgur|trigo para quibe/i,ru:/булгур/iu,ar:/برغل/u,ja:/ブルグル/u,zh:/碎小麦|布格麦/u}},
    allspice:{source:/\byenibahar\b/iu,targets:{en:/\ballspice\b/i,de:/\bpiment\b/i,fr:/piment de la jamaïque/i,es:/pimienta de jamaica/i,pt:/pimenta[- ]da[- ]jamaica/i,ru:/душист.*пер/iu,ar:/بهار حلو|فلفل إفرنجي/u,ja:/オールスパイス/u,zh:/多香果|牙买加胡椒/u}},
    ashureWheat:{source:/aşurelik\s+buğday/iu,targets:{en:/wheat berr/i,de:/weizenkörner|weizenkorn/iu,fr:/grains? de blé/iu,es:/granos? de trigo/iu,pt:/grãos? de trigo/iu,ru:/з[её]рна? пшениц/iu,ar:/حبوب القمح/u,ja:/小麦粒/u,zh:/小麦粒/u}},
    grapeLeaves:{source:/(?:asma|üzüm)\s+yapra(?:ğı|kları?)/iu,targets:{en:/grape leaves?/i,de:/weinblätter|weinblatt/iu,fr:/feuilles? de vigne/iu,es:/hojas? de parra/iu,pt:/folhas? de videira/iu,ru:/виноградн.*листь/iu,ar:/أوراق العنب/u,ja:/ブドウの葉/u,zh:/葡萄叶/u}}
  };
  const inventedMeat = {
    en:/\b(?:lamb|beef|pork|chicken)\b/i,de:/\b(?:lamm|rind|schwein|huhn|hähnchen)\b/i,
    fr:/\b(?:agneau|bœuf|boeuf|porc|poulet)\b/i,es:/\b(?:cordero|ternera|cerdo|pollo)\b/i,
    pt:/\b(?:cordeiro|bovina?|boi|porco|frango)\b/i,ru:/(?:баранин|говядин|свинин|куриц)/iu,
    ar:/(?:خروف|ضأن|بقر|دجاج|خنزير)/u,ja:/(?:ラム|羊肉|牛肉|豚肉|鶏肉)/u,zh:/(?:羊肉|牛肉|猪肉|雞肉|鸡肉)/u
  };
  if (!localizedRecipe || localizedRecipe._localizedLang !== targetLang || localizedRecipe._detailsLocalized !== true) {
    issues.push("localization metadata mismatch");
  }
  if (localizedIngredients.length !== sourceIngredients.length) {
    issues.push(`ingredient count mismatch (${sourceIngredients.length}/${localizedIngredients.length})`);
  }
  if (sourceSteps.length > 1 && localizedSteps.length < sourceSteps.length) {
    issues.push(`step count decreased (${sourceSteps.length}/${localizedSteps.length})`);
  }
  if (targetLang !== "tr") {
    const localizedTitle = String(localizedRecipe?.title || "").trim();
    const sourceTitle = String(source.adminTitleTr || source.title || "").trim();
    if (!localizedTitle) issues.push("localized title is empty");
    if (sourceTitle && normalized(localizedTitle) === normalized(sourceTitle) && sourceTurkishMarker.test(sourceTitle)) issues.push("title was not translated");
    if (turkishLeak.test(withoutProtectedCulinaryNames(localizedTitle))) issues.push("title contains Turkish text");
    if (targetScripts[targetLang] && !targetScripts[targetLang].test(localizedTitle)) issues.push(`title is not in ${targetLang} script`);
    localizedIngredients.forEach((text, index) => {
      const sourceText = sourceIngredients[index] || "";
      if (!String(text).trim()) issues.push(`ingredient ${index + 1} is empty`);
      if (sourceText && normalized(text) === normalized(sourceText) && hasLetters(sourceText) && sourceTurkishMarker.test(sourceText)) issues.push(`ingredient ${index + 1} was not translated`);
      if (turkishLeak.test(withoutProtectedCulinaryNames(text))) issues.push(`ingredient ${index + 1} contains Turkish text`);
      if (targetScripts[targetLang] && !targetScripts[targetLang].test(String(text))) issues.push(`ingredient ${index + 1} is not in ${targetLang} script`);
      if (englishLeakByTarget[targetLang]?.test(String(text))) issues.push(`ingredient ${index + 1} contains English text`);
      Object.entries(requiredTerms).forEach(([term,rule]) => {
        if(rule.source.test(sourceText) && rule.targets[targetLang] && !rule.targets[targetLang].test(String(text))) issues.push(`ingredient ${index + 1} mistranslates ${term}`);
      });
    });
    localizedSteps.forEach((text, index) => {
      if (!String(text).trim()) issues.push(`step ${index + 1} is empty`);
      if (turkishLeak.test(withoutProtectedCulinaryNames(text))) issues.push(`step ${index + 1} contains Turkish text`);
      if (targetScripts[targetLang] && !targetScripts[targetLang].test(String(text))) issues.push(`step ${index + 1} is not in ${targetLang} script`);
    });
    const sourceWhole=[source.adminTitleTr,source.title,source.adminIngredientsTr,source.ingredients,source.adminInstructionsTr,source.instructions].join(" ").toLocaleLowerCase("tr-TR");
    const translatedContent=[...localizedIngredients,...localizedSteps].join(" ");
    const sourceNamesSpecificMeat=/\b(?:kuzu|koyun|dana|sığır|tavuk|hindi|domuz)\b/iu.test(sourceWhole);
    const meatCheckText = targetLang === "ja" && /\brom\b/iu.test(sourceWhole)
      ? translatedContent.replace(/ラム(?!肉)(?:酒|エッセンス|フレーバー)?/gu, "")
      : translatedContent;
    if(!sourceNamesSpecificMeat && inventedMeat[targetLang]?.test(meatCheckText)) issues.push("translation invents a meat type");
    // Title text may legitimately include an internationally recognized dish name
    // or a meat-bearing cuisine label without inventing a new ingredient meat.
    // romanized dish name (for example Yum Woon Sen) beside its CJK description.
    // Line 114 already guarantees that the target script itself is present.
  }
  if (localizedIngredients.some(text => /(?:\\n|undefined|null|\[object Object\])/i.test(String(text)))) issues.push("ingredient output contains broken text");
  if (localizedSteps.some(text => /(?:\\n|undefined|null|\[object Object\])/i.test(String(text)))) issues.push("step output contains broken text");
  if (issues.length) throw new Error(`Card localization validation failed: ${[...new Set(issues)].slice(0, 12).join("; ")}`);
}

const localizedIngredientSource = [localized.extendedIngredients, localized.usedIngredients, localized.ingredients]
  .find(value => Array.isArray(value) && value.length) || [];
const ingredients = localizedIngredientSource
  .map(item => String(item?.original || item?.name || item || "").trim()).filter(Boolean);
const structuredSteps = (localized.analyzedInstructions || [])
  .flatMap(group => Array.isArray(group?.steps) ? group.steps : [])
  .map(item => String(item?.step || "").trim())
  .filter(Boolean);
const instructionText = String(localized.instructions || recipe.adminInstructionsTr || recipe.instructions || "")
  .replace(/\r/g, "")
  .replace(/\\n/g, "\n")
  .replace(/(?:^|\s)(\d{1,2})[.)]\s+/g, "\n$1. ");

function splitInstructionBlock(value) {
  const normalized = String(value || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/(?:^|\s)(\d{1,2})[.)]\s+/g, "\n$1. ")
    .trim();
  if (!normalized) return [];

  const lines = normalized.split(/\n+/).map(item => item.trim()).filter(Boolean);
  return lines.flatMap(line => {
    const withoutNumber = line.replace(/^\s*\d{1,2}[.)]\s*/, "").trim();
    if (!withoutNumber) return [];
    return withoutNumber
      .split(/(?<=[.!?。！？])(?:\s+|(?=[^\s]))/u)
      .map(item => item.trim())
      .filter(item => item.length > 2);
  });
}

const stepSource = structuredSteps.length ? structuredSteps : [instructionText];
const steps = stepSource.flatMap(splitInstructionBlock)
  .map(value => value.replace(/^(?:\\n|\s)*\d{1,2}[.)]\s*/, "").trim())
  .filter(value => value && !/^(?:\\n|\s)*\d{1,2}[.)]?$/.test(value));
if (!ingredients.length || !steps.length) throw new Error("Recipe ingredients and steps are required");
validateCardLocalization({source:recipe, localizedRecipe:localized, targetLang:lang, localizedIngredients:ingredients, localizedSteps:steps});

const referenceFile = path.join(root, "recipe-posters", "design-mockups", "master-reference.jpeg");
const mediaCandidates = [...new Set([
  localized.image, localized.mediaUrl, ...(localized.mediaUrls || []),
  recipe.mediaUrl, ...(recipe.mediaUrls || []), recipe.image,
  recipe.originalMediaUrl, ...(recipe.originalMediaUrls || [])
].map(value => String(value || "").trim()).filter(Boolean))];
let foodInput = null;
let resolvedMediaUrl = "";
for (const mediaValue of mediaCandidates) {
  const candidateUrl = /^https?:\/\//i.test(mediaValue)
    ? mediaValue
    : `http://127.0.0.1:3000/${mediaValue.replace(/^\/+/, "")}`;
  try {
    const response = await fetch(candidateUrl);
    if (!response.ok) continue;
    foodInput = Buffer.from(await response.arrayBuffer());
    resolvedMediaUrl = candidateUrl;
    break;
  } catch {}
}
if (!foodInput) {
  const mediaNames = [...new Set([
    recipe.mediaFile,
    ...mediaCandidates.map(value => {
      try { return path.basename(decodeURIComponent(new URL(value, "http://localhost").pathname)); }
      catch { return ""; }
    })
  ].map(value => String(value || "").trim()).filter(Boolean))];
  const mediaRoots = [
    path.join(root, "optimized-images", "recipe-import"),
    path.join(root, "recipe-import-images"),
    path.join(root, "creator-uploads")
  ];
  outer: for (const mediaRoot of mediaRoots) {
    for (const mediaName of mediaNames) {
      for (const candidateName of [mediaName, mediaName.replace(/\.webp$/i, "")]) {
        const candidateFile = path.join(mediaRoot, candidateName);
        if (!fs.existsSync(candidateFile)) continue;
        foodInput = fs.readFileSync(candidateFile);
        resolvedMediaUrl = candidateFile;
        break outer;
      }
    }
  }
}
if (!foodInput) throw new Error("Recipe food image could not be found");
const characterFile = path.join(root, "recipe-posters", "nili-character-crossed-arms-alpha-v1.png");
const decorativeOverlayFile = path.join(root, "recipe-posters", "decorative-vegetable-overlay-v1.png");
const cuisineIdentity = String(recipe.country || recipe.cuisine || localized.country || localized.cuisine || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/ş/g,"s").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ö/g,"o").replace(/ç/g,"c");
const flagRules = [
  ["tr",/turkiye|turkey|turk mutfagi|osmanli|anadolu|gaziantep|hatay/],["us",/\babd\b|united states|amerika|louisiana|new england|florida/],
  ["de",/almanya|alman mutfagi|germany|bavyera|berlin/],["ar",/arjantin|argentina/],["al",/arnavut|albania/],
  ["au",/avustralya|australia/],["at",/avusturya|austria/],["az",/azerbaycan|azerbaijan/],["bb",/barbados/],["by",/belarus/],["be",/belcika|belgium/],
  ["gb-wls",/galler|wales/],["gb",/birlesik krallik|ingiltere|ingiliz|britanya|united kingdom|england|cornwall/],
  ["bo",/bolivya|bolivia/],["ba",/bosna|bosnia/],["br",/brezilya|brazil/],["dz",/cezayir|algeria/],
  ["cz",/cek mutfagi|czech/],["cn",/cin|china|chinese|kanton|pekin|sichuan|sanghay|shanghai|shaanxi|jiangsu/],
  ["dk",/danimarka|denmark/],["do",/dominik|dominican/],["ec",/ekvador|ecuador/],["sv",/el salvador/],
  ["id",/endonezya|indonesia/],["ee",/estonya|estonia/],["et",/etiyopya|ethiopia/],["ma",/fas|morocco|marakes|magrip/],
  ["ph",/filipin|philippin/],["ps",/filistin|palestin/],["fi",/finlandiya|finland|karelya/],["fr",/fransa|fransiz|france|french|provence|burgonya|lorraine|normandiya|bretonya|bretanya|alsace|lyon|nice|savoie|auvergne/],
  ["gh",/gana|ghana/],["gy",/guyana/],["za",/guney afrika|south africa/],["ge",/gurcistan|georgia|kafkasya/],
  ["ht",/haiti/],["hr",/hirvat|croatia/],["in",/hindistan|hint mutfagi|india|pencap|punjab|kesmir|kashmir|mumbai/],
  ["nl",/hollanda|netherlands/],["hn",/honduras/],["hk",/hong kong/],["iq",/irak|iraq/],["ir",/iran/],
  ["ie",/irlanda|ireland/],["il",/israil|israel/],["se",/isvec|sweden/],["ch",/isvicre|switzerland/],
  ["it",/italya|italyan|italy|sicilya|sicily|toscana|roma|napoli|floransa|ligurya|lombardiya|piyemonte|milano/],
  ["es",/ispanya|ispanyol|spain|spanish|bask/],["is",/izlanda|iceland/],["jm",/jamaika|jamaica/],["jp",/japon|japan|osaka/],["ca",/kanada|canada|quebec/],
  ["co",/kolombiya|colombia/],["kr",/kore|korea/],["cr",/kosta rika|costa rica/],["cu",/kuba|cuba/],
  ["la",/laos/],["lv",/letonya|latvia/],["lt",/litvanya|lithuania/],["hu",/macar|hungary/],["my",/malezya|malaysia/],
  ["mx",/meksika|mexico/],["eg",/misir|egypt/],["mg",/madagaskar|madagascar/],["mm",/myanmar/],["np",/nepal/],["ng",/nijerya|nigeria/],
  ["ni",/nikaragua|nicaragua/],["no",/norvec|norway/],["pa",/panama/],["py",/paraguay/],["pe",/peru/],
  ["pl",/polonya|poland/],["pt",/portekiz|portugal|porto/],["pr",/porto riko|puerto rico/],["ro",/romanya|romania/],
  ["ru",/rusya|russia|sibirya/],["sn",/senegal/],["rs",/sirp|serbia/],["sg",/singapur|singapore/],
  ["sk",/slovak/],["lk",/sri lanka/],["sr",/surinam/],["sy",/suriye|syria|halep/],["cl",/sili|chile/],
  ["th",/tayland|tay mutfagi|thailand|thai/],["tw",/tayvan|taiwan/],["tt",/trinidad/],["tn",/tunus|tunisia/],
  ["ua",/ukrayna|ukraine/],["uy",/uruguay/],["jo",/urdun|jordan/],["ve",/venezuela/],["vn",/vietnam/],
  ["ye",/yemen/],["nz",/yeni zelanda|new zealand|maori/],["gr",/yunan|greece|greek|girit|santorini/],
  ["arab",/levant|orta dogu|middle east|korfez|arab/],["eu",/balkan|avrupa|europe|iskandinav/],
  ["un",/bati afrika|guney asya|guneydogu asya|orta asya|dogu ve guneydogu asya|and bolgesi/]
];
const matchingFlagCodes = [...new Set(
  flagRules.filter(([,rule]) => rule.test(cuisineIdentity)).map(([code]) => code)
)];
const countryFlagCodes = matchingFlagCodes.filter(code => !["arab", "eu", "un"].includes(code));
const isUnitedKingdomCuisine = /birlesik krallik|ingiltere|ingiliz|britanya|united kingdom|england|cornwall/.test(cuisineIdentity);
const regionBadgeRules = [
  ["ME", /orta dogu|middle east/], ["LEV", /levant/], ["BLK", /balkan/],
  ["WAF", /bati afrika|west africa/], ["NAF", /kuzey afrika|north africa/],
  ["SAS", /guney asya|south asia/], ["SEA", /guneydogu asya|southeast asia/],
  ["CAS", /orta asya|central asia/], ["EAS", /dogu asya|east asia/],
  ["NORD", /iskandinav|nordic/], ["CAU", /kafkas|caucasus/],
  ["LAT", /latin amerika|latin america/], ["CAR", /karayip|caribbean/],
  ["AND", /and bolgesi|andean/], ["EUR", /avrupa|europe/],
  ["GLF", /korfez|gulf/], ["WLD", /kuresel|global|dunya|world/]
];
const matchedRegionBadge = regionBadgeRules.find(([,rule]) => rule.test(cuisineIdentity))?.[0] || "WLD";
const regionBadge = !isUnitedKingdomCuisine && countryFlagCodes.length > 1
  ? "MULTI"
  : !isUnitedKingdomCuisine && countryFlagCodes.length === 0
    ? matchedRegionBadge
    : "";
const worldMapLandPaths = `<path d="M21 73l10-17 19-11 27-2 17 8 17-5 13 9-4 11 13 9-10 12-17 6-4 13-15 5-2 19-11 13-8-16 3-17-13-9-17-4-12-12-10-4z"/><path d="M89 135l14 5 14 16 2 20 9 15-6 23-12 24-9-6-2-20-8-19-9-21-3-20z"/><path d="M144 54l15-9 18 3 10-5 18 4 13-8 32 3 21 11 22 1 17 11-7 13-18 2-8 10-15 1-9 11-13-3-8 10-15-6-10-12-14-2-8 8-12-6-15 5-11-10-18-1-5-11z"/><path d="M167 94l19 2 13 12 8 21-8 24-13 26-13-3-7-20-10-15 4-19-9-13z"/><path d="M260 139l18-7 22 6 7 14-12 10-27-3-12-10z"/><path d="M49 28l16-12 22 5 7 12-17 8-22-3z"/>`;
const regionMapAreas = {
  ME:[[208,101,22,13,-8]], LEV:[[207,94,13,9,-8]], BLK:[[181,72,17,10,0]],
  WAF:[[168,126,21,17,0]], NAF:[[181,105,27,12,0]], SAS:[[228,105,22,18,12]],
  SEA:[[263,120,25,15,12]], CAS:[[226,70,30,12,0]], EAS:[[272,79,31,18,0]],
  NORD:[[174,49,24,11,0]], CAU:[[207,76,17,9,0]], LAT:[[105,174,19,42,-12]],
  CAR:[[103,116,20,8,0]], AND:[[102,183,12,35,-10]], EUR:[[177,68,26,15,0]],
  GLF:[[218,109,14,9,0]], WLD:[[190,108,150,88,0]],
  MULTI:[[102,112,16,11,0],[202,78,17,10,0],[263,116,19,13,0]]
};
const regionHighlightAreas = (regionMapAreas[regionBadge] || regionMapAreas.WLD)
  .map(([cx,cy,rx,ry,rotate]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})"/>`)
  .join("");
const flagCode = isUnitedKingdomCuisine
  ? "gb"
  : countryFlagCodes.length > 1
    ? "un"
    : countryFlagCodes[0] || matchingFlagCodes[0] || "un";
const flagFile = path.join(root, "flags", "countries", `${flagCode}.svg`);
for (const file of [referenceFile, characterFile, decorativeOverlayFile, flagFile]) {
  if (!fs.existsSync(file)) throw new Error(`Missing asset: ${file}`);
}
const brushMaskFile = path.join(root, "recipe-posters", "brush-stroke-mask.svg");

const esc = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[char]);

function wrapWords(value, maxChars) {
  const raw = String(value).trim();
  if (!/\s/.test(raw) && raw.length > maxChars) {
    return Array.from(raw).reduce((lines, character) => {
      const last = lines[lines.length - 1] || "";
      if (last.length >= maxChars) lines.push(character);
      else lines[lines.length - 1] = last + character;
      return lines;
    }, [""]);
  }
  const words = raw.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function tspans(lines, x, y, lineHeight) {
  return lines.map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${esc(line)}</tspan>`).join("");
}

function brushPath(x, y, width, height) {
  return `M${x + 24} ${y}L${x + width - 13} ${y + 4}L${x + width} ${y + 16}L${x + width - 18} ${y + 28}L${x + width - 4} ${y + height - 10}L${x + width - 28} ${y + height}L${x + 19} ${y + height - 3}L${x} ${y + height - 15}L${x + 17} ${y + height - 27}L${x + 4} ${y + 13}Z`;
}

async function realBrush(width, height, color) {
  const accent = color === "#315b14" ? "#416f28" : color === "#df5a20" ? "#ef7438" : color;
  const solid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset=".52" stop-color="${accent}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><path d="M0 ${height*.35}Q${width*.25} ${height*.18} ${width*.5} ${height*.38}T${width} ${height*.28}" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="${Math.max(2,height*.08)}"/></svg>`);
  const mask = await sharp(brushMaskFile).resize(width, height, { fit:"fill" }).png().toBuffer();
  return sharp(solid).composite([{ input:mask, blend:"dest-in" }]).png().toBuffer();
}

async function withOpacity(input, opacity) {
  const meta = await sharp(input).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><rect width="100%" height="100%" fill="white" fill-opacity="${opacity}"/></svg>`);
  return sharp(input).ensureAlpha().composite([{ input:mask, blend:"dest-in" }]).png().toBuffer();
}

async function fadeLeftEdge(input) {
  const meta = await sharp(input).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><defs><linearGradient id="fade"><stop stop-color="white" stop-opacity="0"/><stop offset=".16" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#fade)"/></svg>`);
  return sharp(input).ensureAlpha().composite([{ input:mask, blend:"dest-in" }]).png().toBuffer();
}

async function fadeDecorativeCorner(input) {
  const meta = await sharp(input).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><defs><radialGradient id="corner" cx="18%" cy="86%" r="92%"><stop offset="0" stop-color="white"/><stop offset=".5" stop-color="white" stop-opacity=".82"/><stop offset=".78" stop-color="white" stop-opacity=".38"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#corner)"/></svg>`);
  return sharp(input).ensureAlpha().composite([{ input:mask, blend:"dest-in" }]).blur(.45).png().toBuffer();
}

async function referenceBrush(crop, width, height, color) {
  const { data, info } = await sharp(referenceFile).extract(crop).removeAlpha().raw().toBuffer({ resolveWithObject:true });
  const alpha = Buffer.alloc(info.width * info.height);
  for (let y = 0; y < info.height; y++) {
    let first = info.width, last = -1, count = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isBrushGreen = g > 42 && r < 120 && b < 105 && g > r * 1.12 && g > b * 1.28;
      if (isBrushGreen) { first = Math.min(first, x); last = x; count++; }
    }
    if (count > info.width * .08 && last > first) {
      for (let x = first; x <= last; x++) alpha[y * info.width + x] = 255;
    }
  }
  // Close the old lettering inside the reference stroke without replacing its
  // genuinely ragged, painted perimeter with a geometric rectangle.
  const alphaMask = await sharp(alpha, { raw:{ width:info.width, height:info.height, channels:1 } })
    .resize(width, height, { fit:"fill" }).png().toBuffer();
  const mask = await sharp({ create:{ width, height, channels:3, background:{ r:255, g:255, b:255 } } })
    .joinChannel(alphaMask).png().toBuffer();
  const solid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".035 .16" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .08 0 0 0 0 .11 0 0 0 0 .04 0 0 0 .13 0"/></filter></defs><rect width="100%" height="100%" fill="${color}"/><rect width="100%" height="100%" filter="url(#grain)" opacity=".42"/></svg>`);
  return sharp(solid).composite([{ input:mask, blend:"dest-in" }]).png().toBuffer();
}

async function renderTransparentSvgWithBrowser(svg) {
  const token = `${process.pid}-${Date.now()}`;
  const htmlName = `recipe-foreground-${token}.html`;
  const htmlFile = path.join(root, htmlName);
  const screenshotFile = path.join(root, "recipe-posters", "design-mockups", `.foreground-${token}.png`);
  const profileDir = path.join(root, `.chrome-foreground-${token}`);
  const browser = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    ,"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].find(file => fs.existsSync(file));
  if (!browser) throw new Error("Chrome or Edge is required for project fonts");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1254px;height:1254px;overflow:hidden;background:transparent}</style></head><body>${svg}</body></html>`;
  try {
    fs.writeFileSync(htmlFile, html, "utf8");
    const result = spawnSync(browser, [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars",
      "--window-size=1254,1254", "--force-device-scale-factor=1",
      "--default-background-color=00000000", "--virtual-time-budget=3000",
      `--user-data-dir=${profileDir}`, `--screenshot=${screenshotFile}`,
      `http://127.0.0.1:3000/${htmlName}`
    ], { cwd:root, windowsHide:true, encoding:"utf8", timeout:30000 });
    if (!fs.existsSync(screenshotFile)) {
      const details = String(result.stderr || result.stdout || "").trim().slice(-1800);
      throw new Error(`Chrome foreground render failed${details ? `: ${details}` : ""}`);
    }
    return fs.readFileSync(screenshotFile);
  } finally {
    for (const file of [htmlFile, screenshotFile]) try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    try { if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive:true, force:true }); } catch {}
  }
}

const ingredientIconKinds = ["eggplant", "meat", "onion", "pepper", "tomato", "garlic", "paste", "water", "oil", "spice", "garnish"];
function ingredientIcon(kind, x, y) {
  const g = (body) => `<g transform="translate(${x} ${y})">${body}</g>`;
  const icons = {
    eggplant: `<ellipse cx="0" cy="0" rx="7" ry="12" fill="#6f3b80" transform="rotate(28)"/><path d="M-3-10q5-5 9-1M3-10q3-6 7-7" fill="none" stroke="#4f7a27" stroke-width="2.6" stroke-linecap="round"/>`,
    meat: `<path d="M-10 3q1-12 11-13q11 2 10 12q-2 10-12 10q-9-1-9-9Z" fill="#bb5b4d"/><circle cx="2" cy="0" r="4" fill="#f4c7a6"/><circle cx="2" cy="0" r="1.8" fill="#fff3dc"/>`,
    onion: `<path d="M0-12q11 8 10 15q-1 10-10 10q-9 0-10-10q-1-7 10-15Z" fill="#c99bd6"/><path d="M0-12v-5M-5-14l-4-4M5-14l4-4" stroke="#4f7a27" stroke-width="2" stroke-linecap="round"/>`,
    pepper: `<path d="M-9-4q5-8 11-4q9 0 8 8q-2 11-12 12q-9-1-7-16Z" fill="#4e962f"/><path d="M1-9q0-6 6-8" fill="none" stroke="#315d20" stroke-width="2.5" stroke-linecap="round"/>`,
    pasta: `<path d="M-11-8q7 4 3 16M-5-10q8 7 3 20M2-10q-5 8 3 19M8-8q-7 8 2 16" fill="none" stroke="#d9a928" stroke-width="3" stroke-linecap="round"/>`,
    egg: `<ellipse cx="0" cy="1" rx="12" ry="10" fill="#fff7df" stroke="#d7c6a2"/><circle cx="1" cy="1" r="5" fill="#eab52f"/>`,
    cheese: `<path d="M-11 8V-5L8-11l4 18Z" fill="#efc847" stroke="#ba8b22"/><circle cx="4" cy="-4" r="2" fill="#d7a72d"/><circle cx="-4" cy="3" r="2" fill="#d7a72d"/>`,
    seafood: `<path d="M-10 2q8-13 19-4q-3 12-14 11q-6-1-5-7Z" fill="#ef8b67" stroke="#b95343"/><path d="M8-2l7-6v12Z" fill="#ef8b67" stroke="#b95343"/><circle cx="3" cy="-3" r="1.5" fill="#44251d"/>`,
    citrus: `<circle cx="0" cy="0" r="11" fill="#9bcf45" stroke="#55842a"/><path d="M0 0L8-6M0 0L-8-6M0 0v10" stroke="#f5efad" stroke-width="1.5"/>`,
    root: `<path d="M-10 7q7-4 8-15q4 7 9 3q-2 6 5 8q-8 0-9 9q-4-6-13-5Z" fill="#d6a46c" stroke="#8d663d"/>`,
    sauce: `<path d="M-7-13h14v5l4 5v15h-22V-3l4-5Z" fill="#a55c31" stroke="#67391f"/><path d="M-6 2h12" stroke="#f0cf91" stroke-width="2"/>`,
    sugar: `<path d="M-10 7L0-11L10 7Z" fill="#f5eee0" stroke="#bda98a"/><circle cx="0" cy="3" r="2" fill="#fff"/>`,
    tomato: `<circle cx="0" cy="1" r="11" fill="#db4b37"/><path d="M0-9l3 5l6-2l-4 5M0-9l-3 5l-6-2l4 5" fill="#4c812d"/>`,
    garlic: `<path d="M0-10q-5 1-5 6q-8 2-7 9q2 8 12 7q10 1 12-7q1-7-7-9q0-5-5-6Z" fill="#efe2c5" stroke="#b99c76"/><path d="M0-10v-7M0-13l-5-4M0-13l5-4" stroke="#5e8c35" stroke-width="2"/>`,
    paste: `<rect x="-10" y="-7" width="20" height="17" rx="3" fill="#d8492c"/><path d="M-11-8h22M-8-12h16" stroke="#7d2f22" stroke-width="2"/><ellipse cx="0" cy="1" rx="6" ry="4" fill="#f28a46"/>`,
    water: `<path d="M0-14q10 13 10 18a10 10 0 1 1-20 0q0-5 10-18Z" fill="#55b8df"/><path d="M-5 4q1 5 6 6" fill="none" stroke="#d9f5ff" stroke-width="2" stroke-linecap="round"/>`,
    oil: `<path d="M-6-13h12v5l5 5v15h-22V-3l5-5Z" fill="#e5b932" stroke="#9c7620"/><path d="M-5-13h10M-7 2h14" stroke="#fff1a1" stroke-width="2"/>`,
    spice: `<rect x="-8" y="-7" width="16" height="18" rx="3" fill="#d48745"/><path d="M-9-8h18M-6-12h12" stroke="#714324" stroke-width="2"/><circle cx="-3" cy="3" r="1"/><circle cx="3" cy="1" r="1"/><circle cx="2" cy="6" r="1"/>`,
    garnish: `<path d="M-11 10Q0-8 11-12M-5 2q-9-1-8-8q8-1 10 5M2-4q-3-9 4-11q5 7-1 12M5 2q9-4 11 3q-6 6-12 1" fill="#5c9835" stroke="#3f7025" stroke-width="1.4"/>`
  };
  return g(icons[kind] || icons.garnish);
}

const stepIconKinds = ["soak", "roast", "pan", "mix", "fill", "tray", "oven"];
function stepIcon(kind, x, y) {
  const common = `fill="none" stroke="#31551d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    soak: `<path d="M-13 1q2 13 13 13T13 1Z" ${common}/><path d="M-10 0h20M-8-7q3-4 6 0t6 0t6 0" ${common}/><path d="M-11-12l5 5M11-12L6-7" stroke="#58a9cf" stroke-width="2"/>`,
    roast: `<path d="M-13 6h22q5 0 5 5H-9q-4-1-4-5Z" ${common}/><path d="M9 6l9-7M-7 2q0-7 5-9M2 2q0-7 5-9" ${common}/>` ,
    pan: `<ellipse cx="-2" cy="6" rx="13" ry="7" ${common}/><path d="M10 3l10-7M-8-3q0-7 5-9M1-3q0-7 5-9" ${common}/>` ,
    mix: `<path d="M-13 2q2 13 13 13T13 2Z" ${common}/><path d="M-10 1h20M-6-8q5 6 12 7M9-13L0 3" ${common}/>` ,
    fill: `<ellipse cx="0" cy="5" rx="14" ry="8" ${common}/><path d="M-10 5q10-9 20 0M0-13v13M-5-8L0-3l5-5" ${common}/>` ,
    tray: `<rect x="-15" y="-7" width="30" height="19" rx="3" ${common}/><path d="M-10-2h20M-7 4h14M-17-3h2M15-3h2" ${common}/>` ,
    oven: `<rect x="-14" y="-14" width="28" height="29" rx="3" ${common}/><circle cx="-7" cy="-8" r="1.3" fill="#df5a20"/><circle cx="0" cy="-8" r="1.3" fill="#df5a20"/><rect x="-9" y="-2" width="18" height="12" rx="2" ${common}/><path d="M-4 6q4-6 8 0" stroke="#df5a20" stroke-width="2" fill="none"/>`
  };
  return `<g transform="translate(${x} ${y})">${icons[kind] || icons.mix}</g>`;
}

const cardCopy = {
  tr:{auth:"Geleneksel",title:"Karnıyarık",descriptor:"Kıyma Dolgulu Patlıcan",tag1:"Patlıcanla buluşan kıymalı harç,",tag2:"yarım asırlık bir lezzet klasiği.",serv:"KİŞİLİK",prep:"HAZIRLIK",cook:"PİŞİRME",total:"TOPLAM",difficulty:"ZORLUK",medium:"ORTA",ingredients:"MALZEMELER",steps:"NASIL YAPILIR",tip:"İPUCU",tipLines:["Patlıcanları tuzlu suda","bekletin; acılığı azalır","ve daha az yağ çeker."],love:"Sevgiyle • Nili's Kitchen ♡",fresh:"Taze • Geleneksel • Lezzetli ♡",unit:"DK"},
  en:{auth:"Traditional",title:"Karnıyarık",descriptor:"Minced Meat-Stuffed Eggplant",tag1:"Savory minced meat meets tender eggplant,",tag2:"a timeless classic of Turkish cuisine.",serv:"SERVINGS",prep:"PREP",cook:"COOK",total:"TOTAL",difficulty:"DIFFICULTY",medium:"MEDIUM",ingredients:"INGREDIENTS",steps:"HOW TO MAKE",tip:"TIP",tipLines:["Soak the eggplants in salted water;","this reduces bitterness","and helps them absorb less oil."],love:"Made with love • Nili's Kitchen ♡",fresh:"Fresh • Traditional • Delicious ♡",unit:"MIN"},
  de:{auth:"Traditionell",title:"Karnıyarık",descriptor:"Aubergine mit Hackfleischfüllung",tag1:"Zarte Aubergine trifft würzige Hackfüllung,",tag2:"ein zeitloser türkischer Klassiker.",serv:"PORTIONEN",prep:"VORBEREITUNG",cook:"GARZEIT",total:"GESAMT",difficulty:"SCHWIERIGKEIT",medium:"MITTEL",ingredients:"ZUTATEN",steps:"ZUBEREITUNG",tip:"TIPP",tipLines:["Auberginen in Salzwasser einweichen;","das mildert die Bitterkeit","und sie nehmen weniger Öl auf."],love:"Mit Liebe • Nili's Kitchen ♡",fresh:"Frisch • Traditionell • Köstlich ♡",unit:"MIN"},
  fr:{auth:"Traditionnel",title:"Karnıyarık",descriptor:"Aubergine farcie à la viande hachée",tag1:"L'aubergine fondante rencontre la viande épicée,",tag2:"un grand classique de la cuisine turque.",serv:"PORTIONS",prep:"PRÉPARATION",cook:"CUISSON",total:"TOTAL",difficulty:"DIFFICULTÉ",medium:"MOYEN",ingredients:"INGRÉDIENTS",steps:"PRÉPARATION",tip:"ASTUCE",tipLines:["Faites tremper les aubergines dans l'eau salée;","elles seront moins amères","et absorberont moins d'huile."],love:"Avec amour • Nili's Kitchen ♡",fresh:"Frais • Traditionnel • Savoureux ♡",unit:"MIN"},
  es:{auth:"Tradicional",title:"Karnıyarık",descriptor:"Berenjena rellena de carne picada",tag1:"Berenjena tierna con sabroso relleno de carne,",tag2:"un clásico eterno de la cocina turca.",serv:"PORCIONES",prep:"PREPARACIÓN",cook:"COCCIÓN",total:"TOTAL",difficulty:"DIFICULTAD",medium:"MEDIA",ingredients:"INGREDIENTES",steps:"PREPARACIÓN",tip:"CONSEJO",tipLines:["Remoja las berenjenas en agua salada;","así pierden el amargor","y absorben menos aceite."],love:"Con cariño • Nili's Kitchen ♡",fresh:"Fresco • Tradicional • Delicioso ♡",unit:"MIN"},
  pt:{auth:"Tradicional",title:"Karnıyarık",descriptor:"Berinjela recheada com carne moída",tag1:"Berinjela macia com recheio saboroso de carne,",tag2:"um clássico eterno da cozinha turca.",serv:"PORÇÕES",prep:"PREPARO",cook:"COZIMENTO",total:"TOTAL",difficulty:"DIFICULDADE",medium:"MÉDIA",ingredients:"INGREDIENTES",steps:"MODO DE PREPARO",tip:"DICA",tipLines:["Deixe as berinjelas em água salgada;","isso reduz o amargor","e a absorção de óleo."],love:"Com carinho • Nili's Kitchen ♡",fresh:"Fresco • Tradicional • Delicioso ♡",unit:"MIN"},
  ru:{auth:"Традиционное",title:"Karnıyarık",descriptor:"Баклажан, фаршированный мясом",tag1:"Нежный баклажан с ароматной мясной начинкой,",tag2:"вечная классика турецкой кухни.",serv:"ПОРЦИИ",prep:"ПОДГОТОВКА",cook:"ГОТОВКА",total:"ВСЕГО",difficulty:"СЛОЖНОСТЬ",medium:"СРЕДНЕ",ingredients:"ИНГРЕДИЕНТЫ",steps:"ПРИГОТОВЛЕНИЕ",tip:"СОВЕТ",tipLines:["Замочите баклажаны в солёной воде;","так уйдёт горечь","и впитается меньше масла."],love:"С любовью • Nili's Kitchen ♡",fresh:"Свежо • Традиционно • Вкусно ♡",unit:"МИН"},
  ar:{auth:"تقليدي",title:"Karnıyarık",descriptor:"باذنجان محشو باللحم المفروم",tag1:"باذنجان طري مع حشوة لحم شهية،",tag2:"طبق تركي كلاسيكي خالد.",serv:"الحصص",prep:"التحضير",cook:"الطهي",total:"الإجمالي",difficulty:"الصعوبة",medium:"متوسط",ingredients:"المكونات",steps:"طريقة التحضير",tip:"نصيحة",tipLines:["انقع الباذنجان في ماء مملح؛","لتخفيف المرارة","وامتصاص كمية أقل من الزيت."],love:"بحب • Nili's Kitchen ♡",fresh:"طازج • تقليدي • لذيذ ♡",unit:"دقيقة"},
  ja:{auth:"伝統の味",title:"Karnıyarık",descriptor:"ひき肉詰めナス",tag1:"やわらかなナスと香ばしいひき肉の出会い、",tag2:"時代を超えて愛されるトルコの定番料理。",serv:"人数",prep:"準備",cook:"調理",total:"合計",difficulty:"難易度",medium:"普通",ingredients:"材料",steps:"作り方",tip:"コツ",tipLines:["ナスを塩水に浸すと、","苦味が和らぎ、","油の吸収も抑えられます。"],love:"愛情を込めて • Nili's Kitchen ♡",fresh:"新鮮 • 伝統 • おいしい ♡",unit:"分"},
  zh:{auth:"传统风味",title:"Karnıyarık",descriptor:"肉末酿茄子",tag1:"软嫩茄子邂逅香浓肉馅，",tag2:"历久弥新的土耳其经典风味。",serv:"份量",prep:"准备",cook:"烹饪",total:"总计",difficulty:"难度",medium:"中等",ingredients:"食材",steps:"制作方法",tip:"小贴士",tipLines:["将茄子浸泡在盐水中，","可减轻苦味，","并减少吸油。"],love:"用心制作 • Nili's Kitchen ♡",fresh:"新鲜 • 传统 • 美味 ♡",unit:"分钟"}
};
const genericCopy = {
  tr:{tag1:"Özenle hazırlanan nefis bir tarif,",tag2:"sofranıza lezzet katmaya hazır.",tipLines:["Tarifi baştan sona okuyun,","malzemeleri önceden hazırlayın","ve tazeyken servis edin."]},
  en:{tag1:"A delicious recipe prepared with care,",tag2:"ready to bring flavor to your table.",tipLines:["Read the full recipe first,","prepare every ingredient","and serve it fresh."]},
  de:{tag1:"Ein köstliches, sorgfältig zubereitetes Rezept,",tag2:"das Geschmack auf den Tisch bringt.",tipLines:["Lesen Sie zuerst das Rezept,","bereiten Sie alle Zutaten vor","und servieren Sie es frisch."]},
  fr:{tag1:"Une délicieuse recette préparée avec soin,",tag2:"prête à régaler toute la table.",tipLines:["Lisez d'abord toute la recette,","préparez tous les ingrédients","et servez le plat frais."]},
  es:{tag1:"Una deliciosa receta preparada con cariño,",tag2:"lista para llenar tu mesa de sabor.",tipLines:["Lee primero toda la receta,","prepara todos los ingredientes","y sirve el plato recién hecho."]},
  pt:{tag1:"Uma receita deliciosa preparada com carinho,",tag2:"pronta para levar sabor à sua mesa.",tipLines:["Leia primeiro toda a receita,","prepare todos os ingredientes","e sirva o prato fresco."]},
  ru:{tag1:"Вкусный рецепт, приготовленный с заботой,",tag2:"украсит ваш стол ярким вкусом.",tipLines:["Сначала прочитайте весь рецепт,","подготовьте все ингредиенты","и подавайте блюдо свежим."]},
  ar:{tag1:"وصفة شهية محضرة بعناية،",tag2:"جاهزة لتضيف مذاقاً رائعاً إلى مائدتك.",tipLines:["اقرأ الوصفة كاملة أولاً،","وجهّز جميع المكونات","وقدّم الطبق طازجاً."]},
  ja:{tag1:"丁寧に作るおいしいレシピ、",tag2:"食卓に豊かな味わいを届けます。",tipLines:["最初にレシピを最後まで読み、","材料をすべて準備して、","できたてをお召し上がりください。"]},
  zh:{tag1:"用心制作的美味食谱，",tag2:"为您的餐桌增添丰富滋味。",tipLines:["请先阅读完整食谱，","备齐所有食材，","并趁新鲜享用。"]}
};
const originalTitle = String(recipe.originalTitle || recipe.adminTitleTr || recipe.title || localized.title || "Recipe").trim();
const localizedTitle = String(localized.title || originalTitle).trim();
const descriptor = localizedTitle.toLocaleLowerCase(lang) !== originalTitle.toLocaleLowerCase(lang)
  ? localizedTitle
  : String(localized.category || localized.type || localized.cuisine || recipe.type || recipe.cuisine || "").trim();
const c = isKarniyarik
  ? cardCopy[lang]
  : { ...cardCopy[lang], title:originalTitle, descriptor:descriptor || localizedTitle, ...genericCopy[lang] };

const visibleIngredients = ingredients.slice(0, 16);
const visibleSteps = steps.slice(0, 10);
let ingredientY = 637;
const baseIngredientWrap = ["ja", "zh"].includes(lang) ? 18
  : lang === "ru" ? 28
  : visibleIngredients.length > 13 ? 43 : 38;
const ingredientFontSize = visibleIngredients.length <= 8 ? 18 : visibleIngredients.length <= 11 ? 16 : visibleIngredients.length <= 13 ? 14 : 12;
const stepFontSizeCandidate = visibleSteps.length <= 7 ? 16.5 : visibleSteps.length === 8 ? 14 : 12;
const baseContentFontSize = Math.min(ingredientFontSize, stepFontSizeCandidate);
const baseStepWrap = ["ja", "zh"].includes(lang) ? 23
  : lang === "ru" ? 36
  : visibleSteps.length > 8 ? 53 : 48;

// Long translations (especially FR/DE/ES) can create many more visual lines
// than the item count suggests. Select the largest shared font that fits both
// columns, widening the character wrap proportionally as the font gets smaller.
let contentLayout = null;
for (let size = baseContentFontSize; size >= 8; size -= 0.5) {
  const ingredientWrap = Math.floor(baseIngredientWrap * (baseContentFontSize / size));
  const stepWrap = Math.floor(baseStepWrap * (baseContentFontSize / size));
  const ingredientLines = visibleIngredients.map(item => wrapWords(item, ingredientWrap));
  const stepLines = visibleSteps.map(item => wrapWords(item, stepWrap));
  const ingredientLineCount = ingredientLines.reduce((sum, lines) => sum + lines.length, 0);
  const stepLineCount = stepLines.reduce((sum, lines) => sum + lines.length, 0);
  const lineHeight = Math.ceil(size + 4);
  const ingredientHeight = ingredientLineCount * lineHeight + visibleIngredients.length * 2;
  const stepHeight = stepLineCount * lineHeight + visibleSteps.length * 3;
  if (ingredientHeight <= 363 && stepHeight <= 517) {
    contentLayout = { size, ingredientLines, stepLines, ingredientLineCount, stepLineCount, lineHeight };
    break;
  }
}
if (!contentLayout) throw new Error("Text overflow: adaptive layout exhausted");
const contentFontSize = contentLayout.size;
const ingredientKind = value => {
  const text = String(value).toLocaleLowerCase("tr-TR");
  if (/spagetti|spaghetti|pasta|makarna|noodle|nudel|麺|面条/.test(text)) return "pasta";
  if (/karides|shrimp|prawn|gamber|crevette|camar[oó]|кревет|روبيان|海老|虾/.test(text)) return "seafood";
  if (/limon|lemon|lime|citron|lima|лайм|лимон|ليمون|レモン|ライム|柠檬/.test(text)) return "citrus";
  if (/zencefil|ginger|ingwer|gingembre|jengibre|gengibre|имбир|زنجبيل|しょうが|姜/.test(text)) return "root";
  if (/sos|sauce|soy|соус|صلصة|ソース|酱/.test(text)) return "sauce";
  if (/şeker|sugar|zucker|sucre|az[uú]car|açúcar|сахар|سكر|砂糖|糖/.test(text)) return "sugar";
  if (/yumurta|\begg|oeuf|eier|huevo|ovo|яйц|بيض|卵|鸡蛋/.test(text)) return "egg";
  if (/peynir|cheese|pecorino|parmesan|parmesan|käse|fromage|queso|queijo|сыр|جبن|チーズ|奶酪/.test(text)) return "cheese";
  if (/patlıcan|eggplant|aubergine|茄子|ナス/.test(text)) return "eggplant";
  if (/kıyma|\bet\b|meat|beef|lamb|chicken|tavuk|guanciale|pancetta|bacon|肉|鶏/.test(text)) return "meat";
  if (/soğan|onion|zwiebel|oignon|cebolla|cebola|лук|بصل|玉ねぎ|洋葱/.test(text)) return "onion";
  if (/biber|pepper|chili|辣椒|こしょう/.test(text)) return "pepper";
  if (/domates|tomato|tomate|番茄|トマト/.test(text)) return "tomato";
  if (/sarımsak|garlic|ail|ajo|alho|чеснок|ثوم|にんにく|大蒜/.test(text)) return "garlic";
  if (/salça|paste|concentr/.test(text)) return "paste";
  if (/su|water|wasser|eau|agua|вода|ماء|水/.test(text)) return "water";
  if (/yağ|oil|öl|huile|aceite|масло|زيت|油/.test(text)) return "oil";
  if (/tuz|salt|baharat|spice|gewürz|épice|especia|спец|بهار|塩|盐/.test(text)) return "spice";
  return "garnish";
};
const stepKind = value => {
  const text = String(value).toLocaleLowerCase("tr-TR");
  if (/fırın|oven|bake|back|four|horno|forno|духов|فرن|オーブン|烤/.test(text)) return "oven";
  if (/tepsi|tray|casserole|dish|dish into|baking dish|烤盘|天板/.test(text)) return "tray";
  if (/doldur|stuff|fill|farc|rellen|reche|начин|احش|詰め|填/.test(text)) return "fill";
  if (/tava|pan|sauté|saute|fried|fry|kavur|炒|フライパン/.test(text)) return "pan";
  if (/haşla|boil|kaynat|cook.*water|koch|bouill|herv|ferver|вар|اسلق|茹|煮/.test(text)) return "roast";
  if (/beklet|ıslat|soak|marinat|einweich|tremp|remo|замоч|انقع|浸/.test(text)) return "soak";
  return "mix";
};
const ingredientLines = contentLayout.ingredientLines;
const ingredientLineCount = contentLayout.ingredientLineCount;
const ingredientLineHeight = contentLayout.lineHeight;
const ingredientGap = Math.max(2, Math.min(26, Math.floor((342 - ingredientLineCount * ingredientLineHeight) / Math.max(1, visibleIngredients.length))));
const ingredientMarkup = visibleIngredients.map((item, index) => {
  const lines = ingredientLines[index];
  const y = ingredientY;
  ingredientY += lines.length * ingredientLineHeight + ingredientGap;
  return `${ingredientIcon(isKarniyarik ? ingredientIconKinds[index] : ingredientKind(item), 39, y - 5)}<text class="ingredient">${tspans(lines, 59, y, ingredientLineHeight)}</text>`;
}).join("");

let stepY = 638;
const stepLines = contentLayout.stepLines;
const stepLineCount = contentLayout.stepLineCount;
const stepLineHeight = contentLayout.lineHeight;
const stepGap = Math.max(3, Math.min(20, Math.floor((350 - stepLineCount * stepLineHeight) / Math.max(1, visibleSteps.length))));
const stepMarkup = visibleSteps.map((item, index) => {
  const lines = stepLines[index];
  const y = stepY;
  const bottom = y + lines.length * stepLineHeight + 4;
  stepY += lines.length * stepLineHeight + stepGap;
  return `
    ${stepIcon(isKarniyarik ? stepIconKinds[index] : stepKind(item), 435, y - 4)}
    <text class="step">${tspans(lines, 463, y, stepLineHeight)}</text>
    <line x1="460" y1="${bottom}" x2="798" y2="${bottom}" stroke="#d7aa77" stroke-width="1" stroke-dasharray="2 3"/>`;
}).join("");
if (ingredientY > 1000 || stepY > 1155) throw new Error(`Text overflow: ingredients=${ingredientY}, steps=${stepY}`);

const prep = Number(String(recipe.prepTimeText || "").match(/\d+/)?.[0] || 30);
const cook = Number(String(recipe.cookTimeText || "").match(/\d+/)?.[0] || 45);
const total = prep + cook;
const title = String(c.title || recipe.adminTitleTr || recipe.title).toLocaleUpperCase("tr-TR");
const titleLines = wrapWords(title, 18).slice(0, 3);
const longestTitleLine = Math.max(...titleLines.map(line => Array.from(line).length), 1);
const titleHasJapanese = /[\u3040-\u30ff]/.test(title);
const titleHasCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(title);
const titleHasArabicOrCyrillic = /[\u0600-\u06ff\u0400-\u04ff]/.test(title);
const titleNeedsNonLatinFont = titleHasCjk || titleHasArabicOrCyrillic;
const compactTitleLanguage = titleNeedsNonLatinFont;
const titleSizeCap = titleLines.length === 3 ? 38 : compactTitleLanguage ? 44 : 46;
const longTitle = titleLines.length >= 3 || longestTitleLine >= 14;
const titleUsesWideGlyphs = titleNeedsNonLatinFont;
const titleGlyphFactor = titleUsesWideGlyphs ? .82 : .68;
const titleWidthBudget = longTitle ? 400 : 470;
const titleX = longTitle ? 385 : 350;
const titleMinSize = longTitle ? 23 : 27;
const titleSize = Math.max(titleMinSize, Math.min(titleSizeCap, Math.floor(titleWidthBudget / Math.max(1, longestTitleLine * titleGlyphFactor))));
const titleLineHeight = Math.round(titleSize * .88);
const titleY = titleLines.length === 3 ? 126 : titleLines.length === 2 ? 166 : 202;
const estimatedTitleWidth = Math.min(titleWidthBudget, longestTitleLine * titleSize * titleGlyphFactor);
const flagX = longTitle ? 32 : Math.round(Math.max(28, titleX - estimatedTitleWidth / 2 - 84));
const titleBlockTop = titleY - titleSize * .78;
const titleBlockBottom = titleY + (titleLines.length - 1) * titleLineHeight + titleSize * .18;
const flagY = Math.round((titleBlockTop + titleBlockBottom - 43) / 2);
const descriptorLines = wrapWords(c.descriptor, ["ja", "zh"].includes(lang) ? 12 : 25).slice(0, 2);
const descriptorLongest = Math.max(...descriptorLines.map(line => Array.from(line).length), 1);
const compactCjkDescriptor = ["ja", "zh"].includes(lang);
const calculatedDescriptorSize = descriptorLines.length > 1
  ? Math.max(23, Math.min(28, Math.floor(390 / Math.max(8, descriptorLongest * .58))))
  : Math.max(23, Math.min(compactCjkDescriptor ? 30 : 34, Math.floor(390 / Math.max(8, descriptorLongest * .58))));
const descriptorSize = titleLines.length === 3 ? Math.min(26, calculatedDescriptorSize) : calculatedDescriptorSize;
const titleLastBaseline = titleY + (titleLines.length - 1) * titleLineHeight;
const descriptorY = titleLastBaseline + (descriptorLines.length > 1 ? 32 : 38);
const descriptorLineHeight = descriptorLines.length > 1 ? 31 : 34;
const paper = "#f8e9d4";
const green = "#315b14";
const orange = "#df5a20";
const headingFont = "NiliHeading";
const bodyFont = "NiliBody";
const nonLatinLanguage = ["ru", "ar", "ja", "zh"].includes(lang);
const displayFont = lang === "ja" ? "NiliJapanese"
  : lang === "zh" ? "NiliChinese"
  : lang === "ru" ? "NiliCaveat"
  : nonLatinLanguage ? "Segoe UI"
  : headingFont;
const textFont = lang === "ja" ? "NiliJapanese"
  : lang === "zh" ? "NiliChinese"
  : lang === "ru" ? "NiliJapanese"
  : nonLatinLanguage ? "Segoe UI"
  : bodyFont;
const decorativeTextFont = lang === "ru" ? displayFont : textFont;
const titleFont = titleHasJapanese ? "NiliJapanese"
  : titleHasCjk ? "NiliChinese"
  : titleHasArabicOrCyrillic ? "Segoe UI"
  : "NiliTitleCondensed";
const embeddedFontSource = (fileName, format = "opentype") => {
  const fontFile = path.join(root, "assets", "fonts", fileName);
  if (!fs.existsSync(fontFile)) throw new Error(`Required card font is missing: ${fontFile}`);
  const extension = path.extname(fileName).toLowerCase();
  const mime = extension === ".otf" ? "font/otf" : "font/ttf";
  return `url("data:${mime};base64,${fs.readFileSync(fontFile).toString("base64")}") format("${format}")`;
};
// CJK fonts are embedded in the SVG so headless Chrome cannot capture the
// foreground before a large external font request has completed.
const japaneseFontSource = ["ja", "ru"].includes(lang)
  ? embeddedFontSource("NotoSansCJKjp-Bold.otf")
  : "url('/assets/fonts/NotoSansCJKjp-Bold.otf') format('opentype')";
const chineseFontSource = lang === "zh"
  ? embeddedFontSource("NotoSansCJKsc-Bold.otf")
  : "url('/assets/fonts/NotoSansCJKsc-Bold.otf') format('opentype')";
const authLength = Math.max(1, Array.from(String(c.auth || "")).length);
const authSize = Math.max(23, Math.min(34, Math.floor(280 / (authLength * (nonLatinLanguage ? .62 : .55)))));
const previewKey = String(process.env.CARD_PREVIEW_KEY || "v39-large-photo-clean-brand-brushes").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
const previewOnly = process.env.CARD_PREVIEW_ONLY === "1";

const coverSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">
  <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="#c99d69" opacity=".12"/></pattern></defs>
  <rect x="20" y="9" width="680" height="307" fill="${paper}"/><rect x="20" y="9" width="680" height="307" fill="url(#dots)"/>
  <rect x="594" y="0" width="660" height="620" fill="${paper}"/><rect x="594" y="0" width="660" height="620" fill="url(#dots)"/>
  <path d="M594 5H1248V620" fill="none" stroke="#c99b45" stroke-width="2"/>
  <rect x="25" y="407" width="675" height="130" fill="${paper}"/>
  <rect x="25" y="407" width="675" height="130" fill="url(#dots)"/>
  <rect x="630" y="407" width="624" height="145" fill="${paper}"/>
  <rect x="630" y="407" width="624" height="145" fill="url(#dots)"/>
  <rect x="20" y="538" width="790" height="82" fill="${paper}"/>
  <rect x="20" y="538" width="790" height="82" fill="url(#dots)"/>
  <rect x="25" y="610" width="369" height="390" fill="${paper}"/>
  <rect x="410" y="610" width="402" height="550" fill="${paper}"/>
  <rect x="810" y="552" width="444" height="692" fill="${paper}"/>
  <rect x="810" y="552" width="444" height="692" fill="url(#dots)"/>
  <g fill="none" stroke="#6f8b4b" stroke-width="2" opacity=".13">
    <path d="M850 1080Q895 960 868 826M868 910q40-12 51-54M867 950q-40-9-51-47M1192 1050q-42-118-17-238M1177 905q-39-13-48-54M1176 948q39-8 52-45"/>
    <path d="M874 856q28-21 45 0q-28 23-45 0ZM817 903q29-18 48 5q-30 20-48-5ZM1129 851q28-21 46 1q-29 22-46-1ZM1174 904q30-18 48 6q-31 19-48-6Z"/>
  </g>
  <rect x="20" y="999" width="378" height="241" fill="${paper}"/>
  <rect x="20" y="999" width="378" height="241" fill="url(#dots)"/>
  <rect x="398" y="1138" width="856" height="106" fill="${paper}"/>
  <rect x="398" y="1138" width="856" height="106" fill="url(#dots)"/>
  <line x1="396" y1="552" x2="396" y2="1174" stroke="#d5a36c" stroke-width="1" stroke-dasharray="2 3"/>
  <line x1="809" y1="552" x2="809" y2="1160" stroke="#d5a36c" stroke-width="1" stroke-dasharray="2 3"/>
</svg>`);

const foregroundSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">
  <defs><linearGradient id="sep" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${orange}" stop-opacity=".2"/><stop offset=".5" stop-color="${orange}" stop-opacity=".75"/><stop offset="1" stop-color="${green}" stop-opacity=".2"/></linearGradient><filter id="flagWave" x="-20%" y="-25%" width="140%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".018 .055" numOctaves="1" seed="7" result="waveNoise"/><feDisplacementMap in="SourceGraphic" in2="waveNoise" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter><clipPath id="ingredientColumnClip"><rect x="25" y="610" width="369" height="390"/></clipPath><clipPath id="stepColumnClip"><rect x="410" y="610" width="399" height="550"/></clipPath></defs>
  <style>
    @font-face{font-family:NiliHeading;src:url('/assets/fonts/Baloo2-Variable.ttf')}
    @font-face{font-family:NiliBody;src:url('/assets/fonts/Kalam-Bold.ttf')}
    @font-face{font-family:NiliCaveat;src:url('/assets/fonts/Caveat-Variable.ttf')}
    @font-face{font-family:NiliTitleCondensed;src:url('/assets/fonts/LilitaOne-Regular.ttf')}
    @font-face{font-family:NiliJapanese;src:${japaneseFontSource};font-weight:700 900;font-display:block}
    @font-face{font-family:NiliChinese;src:${chineseFontSource};font-weight:700 900;font-display:block}
    .script{font-family:"${decorativeTextFont}","Segoe UI",sans-serif;font-weight:700}
    .tagline{font-family:"${decorativeTextFont}","Segoe UI",sans-serif;font-size:20px;font-weight:700;letter-spacing:.05px;fill:white;stroke:white;stroke-width:.2px;paint-order:stroke;text-anchor:middle}
    .title{font-family:"${titleFont}","Segoe UI",sans-serif;font-weight:900;letter-spacing:.8px;fill:${green}}
    .descriptor{font-family:"${lang === "ru" || compactCjkDescriptor ? displayFont : textFont}","Segoe UI",sans-serif;font-weight:${compactCjkDescriptor ? 900 : 700};letter-spacing:.05px}
    .section{font-family:"${displayFont}","Segoe UI",sans-serif;font-size:19px;font-weight:850;letter-spacing:.15px;fill:white;text-anchor:middle}
    .ingredient,.step{font-family:"${textFont}","Segoe UI",sans-serif;font-size:${lang === "ar" ? Math.max(15, contentFontSize) : contentFontSize}px;font-weight:700;fill:#151a14}
    .statLabel{font-family:"${displayFont}","Segoe UI",sans-serif;font-size:14px;font-weight:900;fill:#121912;text-anchor:middle}
    .statValue{font-family:"${displayFont}","Segoe UI",sans-serif;font-size:21px;font-weight:900;fill:#111711;text-anchor:middle}
  </style>
  <g fill="none" stroke="${green}" stroke-width="2.1" stroke-linecap="round" opacity=".68">
    <path d="M105 91q-19 10-28 27q18-3 29-17M116 94q17 7 25 22q-17 0-27-11"/>
    <path d="M558 94q19 10 28 27q-18-3-29-17M547 97q-17 7-25 22q17 0 27-11"/>
  </g>
  <text x="350" y="73" class="script" font-size="${authSize}" fill="${green}" text-anchor="middle">${esc(c.auth)}</text>
  <path d="M72 42q-12-15-21 0q8 14 21 23q13-9 21-23q-9-15-21 0" fill="none" stroke="${orange}" stroke-width="2.6" opacity=".82"/>
  <text x="565" y="72" class="script" font-size="38" fill="${orange}" opacity=".82">♡</text>
  ${regionBadge
    ? `<g transform="translate(${flagX} ${flagY}) rotate(-3 31 21.5)"><rect x=".8" y=".8" width="60.4" height="41.4" rx="4" fill="#8ec8dc" stroke="#c89542" stroke-width="1.35"/><g transform="translate(4.7 1.3) scale(.17)" fill="#3f754b" stroke="#f7efd9" stroke-width="3.2" stroke-linejoin="round">${worldMapLandPaths}</g><g transform="translate(4.7 1.3) scale(.17)" fill="#f06a2d" stroke="#fff4d9" stroke-width="3.6" opacity=".98">${regionHighlightAreas}</g></g>`
    : `<image href="data:image/svg+xml;base64,${fs.readFileSync(flagFile).toString("base64")}" x="${flagX}" y="${flagY}" width="62" height="43" preserveAspectRatio="xMidYMid meet" filter="url(#flagWave)" transform="rotate(-3 ${flagX + 31} ${flagY + 21.5})"/>`}
  <text x="${titleX}" y="${titleY}" class="title" font-size="${titleSize}" text-anchor="middle">${tspans(titleLines, titleX, titleY, titleLineHeight)}</text>
  <text x="350" y="${descriptorY}" class="descriptor" font-size="${descriptorSize}" fill="${orange}" text-anchor="middle">${tspans(descriptorLines, 350, descriptorY, descriptorLineHeight)}</text>
  <text x="350" y="344" class="tagline">${esc(c.tag1)}</text>
  <text x="350" y="379" class="tagline">${esc(c.tag2)} ♡</text>

  <g stroke="url(#sep)" stroke-width="1.5" stroke-linecap="round">
    <path d="M154 423v107M297 423v107M419 423v107M541 423v107" stroke-dasharray="2 6"/>
  </g>
  <g fill="${orange}" opacity=".7"><path d="M154 470l4 6l-4 6l-4-6Z"/><path d="M297 470l4 6l-4 6l-4-6Z"/><path d="M419 470l4 6l-4 6l-4-6Z"/><path d="M541 470l4 6l-4 6l-4-6Z"/></g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.7">
    <g stroke="${green}"><circle cx="80" cy="433" r="7"/><circle cx="64" cy="438" r="5"/><circle cx="96" cy="438" r="5"/><path d="M68 459q1-15 12-15t12 15M52 459q1-11 12-11q4 0 7 3M108 459q-1-11-12-11q-4 0-7 3"/></g>
    <g stroke="${orange}"><circle cx="226" cy="441" r="18"/><path d="M226 427v15l9 6"/><path d="M219 417h14"/></g>
    <g stroke="${green}"><path d="M337 447h38q-3 15-19 15t-19-15Z"/><path d="M341 443h30M347 436q-3-7 3-12M357 436q-3-9 3-15M367 436q-3-7 3-12"/></g>
    <g stroke="${orange}"><circle cx="484" cy="441" r="18"/><path d="M484 427v15l8 8"/><path d="M477 417h14"/></g>
    <g stroke="${green}"><path d="M596 449v-11q0-7 7-8q1-11 11-11q10 0 11 11q7 1 7 8v11M599 449h30v13h-30Z"/></g>
  </g>
  <g><text x="80" y="484" class="statLabel" style="fill:${green}">${esc(c.serv)}</text><text x="80" y="518" class="statValue" style="fill:${orange}">${esc(localized.servings || recipe.servings || 4)}</text>
  <text x="226" y="484" class="statLabel" style="fill:${orange}">${esc(c.prep)}</text><text x="226" y="518" class="statValue" style="fill:${green}">${prep} ${esc(c.unit)}</text>
  <text x="356" y="484" class="statLabel" style="fill:${green}">${esc(c.cook)}</text><text x="356" y="518" class="statValue" style="fill:${orange}">${cook} ${esc(c.unit)}</text>
  <text x="484" y="484" class="statLabel" style="fill:${orange}">${esc(c.total)}</text><text x="484" y="518" class="statValue" style="fill:${green}">${total} ${esc(c.unit)}</text>
  <text x="610" y="484" class="statLabel" style="fill:${green}">${esc(c.difficulty)}</text><text x="610" y="518" class="statValue" style="fill:${orange}">${esc(c.medium)}</text></g>

  <text x="206" y="594" class="section">${esc(c.ingredients)}</text>
  <text x="607" y="594" class="section">${esc(c.steps)} ♡</text>
  <g fill="none" stroke="${green}" stroke-width="1.8" stroke-linecap="round" opacity=".35">
    <path d="M391 1082q12-15 22-3M399 1074q-9-5-11-13q10 0 14 9M399 1074q4-11 13-13q1 9-8 15"/>
    <path d="M843 1050q-12-15-22-3M835 1042q9-5 11-13q-10 0-14 9M835 1042q-4-11-13-13q-1 9 8 15"/>
  </g>
  <g clip-path="url(#ingredientColumnClip)">${ingredientMarkup}</g>
  <g clip-path="url(#stepColumnClip)">${stepMarkup}</g>

  <rect x="31" y="1023" width="350" height="174" rx="21" fill="none" stroke="${green}" stroke-width="1.3" stroke-dasharray="5 4" opacity=".58"/>
  <text x="52" y="1068" font-family="${displayFont},'Segoe UI',sans-serif" font-size="29" font-weight="800" fill="${green}">${esc(c.tip)} <tspan fill="${orange}">♡</tspan></text>
  <path d="M52 1078h92" stroke="${orange}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <text x="52" y="1110" font-family="${textFont},'Segoe UI',sans-serif" font-size="16" font-weight="620" fill="#1b211b">${tspans(c.tipLines, 52, 1110, 25)}</text>

  <text x="592" y="1194" class="script" font-size="${lang === "ar" || lang === "ja" || lang === "zh" ? 16 : 19}" fill="white" text-anchor="middle">${esc(c.love)}</text>
  <text x="1007" y="1194" class="script" font-size="${lang === "ar" || lang === "ja" || lang === "zh" ? 15 : 18}" fill="white" text-anchor="middle">${esc(c.fresh)}</text>
  <path d="M1248 552V1248H810" fill="none" stroke="#c99b45" stroke-width="2"/>
  <path d="M1248 1208h-10v30h-30M1242 1217h-10v15h-15" fill="none" stroke="#c99b45" stroke-width="1.5"/>
</svg>`;
const foregroundSvg = Buffer.from(foregroundSvgString);

const foodCrop = await sharp(foodInput).resize(660, 620, { fit:"cover", position:"attention" }).png().toBuffer();
const foodMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="620"><defs><linearGradient id="f" x1="0" x2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".1" stop-color="white" stop-opacity=".22"/><stop offset=".21" stop-color="white" stop-opacity=".78"/><stop offset=".3" stop-color="white"/></linearGradient></defs><rect width="660" height="620" fill="url(#f)"/></svg>`);
const foodBottomFade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="620"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset=".61" stop-color="white"/><stop offset=".75" stop-color="white" stop-opacity=".86"/><stop offset=".89" stop-color="white" stop-opacity=".34"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="660" height="620" fill="url(#b)"/></svg>`);
const maskedFood = await sharp(foodCrop).composite([{ input:foodMask, blend:"dest-in" }, { input:foodBottomFade, blend:"dest-in" }]).png().toBuffer();
const characterTrimmed = await sharp(characterFile).trim().png().toBuffer();
const characterMeta = await sharp(characterTrimmed).metadata();
const characterCropHeight = Math.round(characterMeta.height * 0.535);
const characterBase = await sharp(characterTrimmed)
  .extract({ left:0, top:0, width:characterMeta.width, height:characterCropHeight })
  .resize({ width:300 })
  .png().toBuffer();
const characterBaseMeta = await sharp(characterBase).metadata();
const characterFadeMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${characterBaseMeta.width}" height="${characterBaseMeta.height}"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#fade)"/></svg>`);
const character = await sharp(characterBase)
  .ensureAlpha()
  .composite([{ input:characterFadeMask, blend:"dest-in" }])
  .png().toBuffer();
const decorativeLeftRaw = await sharp(decorativeOverlayFile)
  .extract({ left:0, top:700, width:530, height:554 })
  .resize({ width:540 })
  .png().toBuffer();
const decorativeRightRaw = await sharp(decorativeOverlayFile)
  .extract({ left:720, top:450, width:534, height:804 })
  .resize({ width:405 })
  .png().toBuffer();
const decorativeLeft = await withOpacity(await fadeDecorativeCorner(decorativeLeftRaw), .42);
const decorativeRight = await withOpacity(decorativeRightRaw, .42);
const heroBrush = await realBrush(562, 94, green);
const ingredientBrush = await realBrush(311, 77, orange);
const stepBrush = await realBrush(379, 77, green);
const footerLeftBrush = await realBrush(348, 77, orange);
const footerRightBrush = await realBrush(452, 77, green);
const foregroundLayer = await renderTransparentSvgWithBrowser(foregroundSvgString);
const frameLayer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#9d6b17"/><stop offset=".32" stop-color="#f3d889"/><stop offset=".58" stop-color="#c28b28"/><stop offset="1" stop-color="#79500f"/>
    </linearGradient>
    <g id="corner" fill="none" stroke="url(#gold)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 54V7h47" stroke-width="2.4"/>
      <path d="M14 46V14h32" stroke-width="1.25"/>
      <path d="M21 39V21h18M21 29h9v10" stroke-width="1.8"/>
      <path d="M7 63h7v-9h9M63 7v7h-9v9" stroke-width="1.2"/>
      <path d="M14 14q12 2 14 14q2-12 14-14" stroke-width="1.1" opacity=".85"/>
    </g>
  </defs>
  <rect x="7" y="7" width="1240" height="1240" rx="1" fill="none" stroke="url(#gold)" stroke-width="2.2"/>
  <rect x="13" y="13" width="1228" height="1228" rx="1" fill="none" stroke="#d7ad55" stroke-width=".8" opacity=".72"/>
  <use href="#corner"/>
  <use href="#corner" transform="translate(1254 0) scale(-1 1)"/>
  <use href="#corner" transform="translate(0 1254) scale(1 -1)"/>
  <use href="#corner" transform="translate(1254 1254) scale(-1 -1)"/>
</svg>`);

const safeOutputId = String(recipe.importRecipeId || recipe.id).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "recipe";
const outputVersion = `${Date.now()}-${process.pid}`;
const outputPng = path.join(root, "recipe-posters", "design-mockups", `${safeOutputId}-${lang}-heading-${previewKey}.png`);
const outputFileName = `${safeOutputId}-${lang}-${outputVersion}.webp`;
const outputWebp = path.join(root, "recipe-posters", "pending", lang, outputFileName);
fs.mkdirSync(path.dirname(outputWebp), { recursive:true });
const png = await sharp(referenceFile).composite([
  { input:coverSvg, left:0, top:0 },
  { input:decorativeLeft, left:-95, top:690 },
  { input:decorativeRight, left:838, top:606 },
  { input:heroBrush, left:70, top:305 },
  { input:ingredientBrush, left:51, top:544 },
  { input:stepBrush, left:417, top:544 },
  { input:footerLeftBrush, left:417, top:1148 },
  { input:maskedFood, left:594, top:0 },
  { input:character, left:941, top:535 },
  { input:footerRightBrush, left:782, top:1148 },
  { input:foregroundLayer, left:0, top:0 },
  { input:frameLayer, left:0, top:0 }
]).png().toBuffer();
if (previewOnly) {
  await sharp(png).toFile(outputPng);
  console.log(JSON.stringify({ outputPng, headingFont, bodyFont, previewOnly:true }, null, 2));
  process.exit(0);
}
await sharp(png).webp({ quality:94, effort:5 }).toFile(outputWebp);

const manifestFile = path.join(root, "recipe-posters", "pending-manifest-v2.json");
const raw = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : [];
const manifest = Array.isArray(raw) ? raw : [];
const entry = { key:`${recipe.id}:${lang}`, recipeId:String(recipe.id), displayId:recipe.importRecipeId, title:c.title||localized.title||recipe.adminTitleTr||recipe.title, lang, status:"pending", url:`/recipe-posters/pending/${lang}/${outputFileName}`, file:`recipe-posters/pending/${lang}/${outputFileName}`, generatedAt:new Date().toISOString(), renderer:"master-reference-v43-production", sourceImage:recipe.mediaUrl || resolvedMediaUrl, ingredientCount:ingredients.length, stepCount:steps.length };
const index = manifest.findIndex(item => item.key === entry.key);
if (index >= 0) manifest[index] = entry; else manifest.push(entry);
await writeTextWithRetry(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputPng, outputWebp, entry, ingredientY, stepY }, null, 2));
