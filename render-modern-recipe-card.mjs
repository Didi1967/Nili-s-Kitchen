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

const dataUri=(mime,bytes)=>"data:"+mime+";base64,"+bytes.toString("base64");
const fontUri=file=>dataUri("font/ttf",fs.readFileSync(path.join(root,"assets","fonts",file)));
const {buildModernRecipeCard}=await import("./modern-recipe-card-layout.mjs");
const originalTitle=String(recipe.originalTitle||recipe.originalName||recipe.adminTitleTr||recipe.title);
const numberFrom=v=>{const m=String(v??"").match(/\d+/);return m?Number(m[0]):undefined};
const prep=numberFrom(recipe.prepTimeText??localized.prepTime);
const cook=numberFrom(recipe.cookTimeText??localized.cookTime);
const total=prep!==undefined&&cook!==undefined?prep+cook:numberFrom(localized.readyInMinutes);
const servingCopies={
en:"Serve freshly prepared.",tr:"Taze hazırlanmış olarak servis edin.",de:"Frisch zubereitet servieren.",fr:"Servez fraîchement préparé.",es:"Sirve recién preparado.",pt:"Sirva logo após preparar.",ru:"Подавайте свежеприготовленным.",ar:"قدّمه طازج التحضير.",ja:"できたてをお召し上がりください。",zh:"请趁新鲜享用。"
};
const iconKinds=[
[/yumurta|egg/i,"egg"],[/domates|tomato/i,"tomato"],[/biber|pepper/i,"pepper"],
[/soğan|onion/i,"onion"],[/sarımsak|garlic/i,"garlic"],[/yağ|oil|butter/i,"oil"],
[/et|kıyma|meat|beef/i,"meat"],[/peynir|cheese/i,"cheese"],[/şeker|sugar/i,"sugar"],[/tuz|salt|baharat|spice/i,"spice"]
];
const sourceIngredients=sourceIngredientTexts(recipe);
const ingredientIcons=ingredients.map((text,i)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -20 36 40">'+ingredientIcon(iconKinds.find(([re])=>re.test(sourceIngredients[i]||text))?.[1]||"garnish",0,0)+'</svg>');
const html=buildModernRecipeCard({
lang,title:originalTitle,descriptor:localized.title===originalTitle?String(localized.category||localized.cuisine||""):localized.title,
country:localized.country||localized.cuisine||recipe.country||recipe.cuisine||"",
ingredients,steps,servings:localized.servings||recipe.servings,prep,cook,total,
difficulty:localized.difficulty||"",tip:String(localized.tip||genericCopy[lang].tipLines.join(" ")),
servingSuggestion:String(localized.servingSuggestion||servingCopies[lang]),
foodData:dataUri("image/png",await sharp(foodInput).rotate().resize(1600,1000,{fit:"cover"}).png().toBuffer()),
logoData:dataUri("image/png",fs.readFileSync(path.join(root,"logo-transparent.png"))),
flagData:fs.existsSync(flagFile)?dataUri("image/svg+xml",fs.readFileSync(flagFile)):"",
ingredientIcons,fonts:{body:fontUri(lang==="ja"?"NotoSansCJKjp-Bold.otf":lang==="zh"?"NotoSansCJKsc-Bold.otf":"Baloo2-Variable.ttf"),script:fontUri(["ar","ja","zh"].includes(lang)?(lang==="ja"?"NotoSansCJKjp-Bold.otf":lang==="zh"?"NotoSansCJKsc-Bold.otf":"Baloo2-Variable.ttf"):"Caveat-Variable.ttf")}
});
const token=process.pid+"-"+Date.now();
const htmlName="recipe-foreground-"+token+".html";
const htmlFile=path.join(root,htmlName);
const previewDir=path.join(root,"recipe-posters","design-mockups");
fs.mkdirSync(previewDir,{recursive:true});
const screenshot=path.join(previewDir,".modern-"+token+".png");
const profile=path.join(previewDir,".chrome-modern-"+token);
const browser=[process.env.NILI_CARD_BROWSER,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser","C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(f=>f&&fs.existsSync(f));
if(!browser)throw Error("Chrome or Edge is required for project fonts");
let png;
try{
fs.writeFileSync(htmlFile,html);
const result=spawnSync(browser,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--hide-scrollbars","--window-size=1254,1254","--force-device-scale-factor=1","--virtual-time-budget=15000","--user-data-dir="+profile,"--dump-dom","--screenshot="+screenshot,"http://127.0.0.1:3000/"+htmlName],{cwd:root,windowsHide:true,encoding:"utf8",timeout:60000,maxBuffer:64*1024*1024});
if(result.error||result.status!==0||!fs.existsSync(screenshot))throw Error("Chrome card render failed: "+String(result.error||result.stderr).slice(-1000));
if(!/<meta name="card-layout" content="ok">/.test(result.stdout||""))throw Error("Card layout validation failed: content overflow or missing image");
png=fs.readFileSync(screenshot);
}finally{
for(const file of [htmlFile,screenshot])try{fs.unlinkSync(file)}catch{}
try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
}
const safeId=String(recipe.importRecipeId||recipe.id).toLowerCase().replace(/[^a-z0-9]+/g,"-");
if(process.argv.includes("--preview")){
const outputPng=path.join(previewDir,safeId+"-"+lang+"-modern-preview.png");
await sharp(png).toFile(outputPng);
console.log(JSON.stringify({outputPng,previewOnly:true}));process.exit(0);
}
const outputName=safeId+"-"+lang+"-"+token+".webp";
const outputFile=path.join(root,"recipe-posters","pending",lang,outputName);
fs.mkdirSync(path.dirname(outputFile),{recursive:true});
await sharp(png).webp({quality:94,effort:5}).toFile(outputFile);
const manifestFile=path.join(root,"recipe-posters","pending-manifest-v2.json");
const raw=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,"utf8")):[];
const manifest=Array.isArray(raw)?raw:[];
const entry={key:recipe.id+":"+lang,recipeId:String(recipe.id),displayId:recipe.importRecipeId,title:originalTitle,lang,status:"pending",url:"/recipe-posters/pending/"+lang+"/"+outputName,file:"recipe-posters/pending/"+lang+"/"+outputName,generatedAt:new Date().toISOString(),renderer:"modern-menemen-v1",sourceImage:resolvedMediaUrl,ingredientCount:ingredients.length,stepCount:steps.length};
const index=manifest.findIndex(i=>i.key===entry.key);if(index<0)manifest.push(entry);else manifest[index]=entry;
await writeTextWithRetry(manifestFile,JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({outputWebp:outputFile,entry}));
