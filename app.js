let currentRecipes = [];
let selected = [];
let activeCategoryKey = null;

let recipePage = 1;
const recipesPerPage = 6;

let lastRecipeIngredients = [];
let activeRecipeId = null;
let isRecipeLangRefreshing = false;
const trackedCreatorRecipeOpens = new Set();
const CATEGORY_DATA = window.CATEGORY_DATA || {};
let currentMobileNiliPicks = [];
 

window.API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.")
    ? `http://${window.location.hostname}:3000`
    : "https://api.niliskitchen.com";

console.log("API_BASE:", window.API_BASE);

function resolveRecipeImageUrl(value) {
  let url = String(value || "").trim().replace(/\\/g, "/");
  if (/\/flags\//i.test(url)) return "";
  url = url
    .replace(/\/recipe-import-images\/optimized-images\//gi, "/optimized-images/")
    .replace(/\/recipe-import-images\/recipe-import-images\//gi, "/recipe-import-images/");
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${window.API_BASE}${url}`;
  return url;
}

function resolveStaticAssetUrl(value) {
  const url = String(value || "").trim().replace(/\\/g, "/");
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${window.API_BASE}${url}`;
  return url;
}

function getRecipeImageCandidates(recipe) {
  const values = [
    recipe?.mediaUrl,
    recipe?.fullImage,
    recipe?.image,
    ...(Array.isArray(recipe?.mediaUrls) ? recipe.mediaUrls : [])
  ];

  return [...new Set(values.map(resolveRecipeImageUrl).filter(Boolean))];
}

function getRecipeImageUrl(recipe) {
  return getRecipeImageCandidates(recipe)[0] || "";
}

function recipeImageAttrs(recipe, index = 0) {
  const candidates = getRecipeImageCandidates(recipe);
  const src = candidates[0] || "";
  const retryList = candidates.slice(1);
  const onError =
    "const list=JSON.parse(this.dataset.fallbacks||'[]');" +
    "const next=list.shift();" +
    "if(next){this.dataset.fallbacks=JSON.stringify(list);this.src=next;}" +
    "else{this.onerror=null;const card=this.closest('.recipe-card,.mobile-nili-pick');if(card){card.remove();}else{this.remove();}}";

  return `src="${escapeHtml(src)}" data-fallbacks="${escapeHtml(JSON.stringify(retryList))}" onerror="${escapeHtml(onError)}"`;
}

function getRecipeCardImageCandidates(recipe) {
  const cardUrls = recipe?.recipeCardUrls && typeof recipe.recipeCardUrls === "object"
    ? recipe.recipeCardUrls
    : {};
  const cardStatuses = recipe?.recipeCardStatuses && typeof recipe.recipeCardStatuses === "object"
    ? recipe.recipeCardStatuses
    : {};
  const language = String(currentLang || "en").toLowerCase();
  const englishCard = resolveRecipeImageUrl(cardUrls.en);
  if (cardStatuses.en !== "approved" || !englishCard) return [];
  const values = [
    cardStatuses[language] === "approved" ? cardUrls[language] : "",
    englishCard
  ];
  return [...new Set(values.map(resolveRecipeImageUrl).filter(Boolean))];
}

function recipeCardImageAttrs(recipe) {
  const candidates = getRecipeCardImageCandidates(recipe);
  const src = candidates[0] || "";
  const retryList = candidates.slice(1);
  const onError =
    "const list=JSON.parse(this.dataset.fallbacks||'[]');" +
    "const next=list.shift();" +
    "if(next){this.dataset.fallbacks=JSON.stringify(list);this.src=next;}" +
    "else{this.onerror=null;this.remove();}";
  return 'src="' + escapeHtml(src) + '" data-fallbacks="' +
    escapeHtml(JSON.stringify(retryList)) + '" onerror="' + escapeHtml(onError) + '"';
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

const statusText = document.getElementById("statusText");
const bar = document.getElementById("bar");
const checklist = document.getElementById("checklist");
const recipeBtn = document.getElementById("recipeBtn");
const confirmCheck = document.getElementById("confirmCheck");
const result = document.getElementById("result");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const recipeFullPage = document.getElementById("recipeFullPage");
const recipeFullPageBody = document.getElementById("recipeFullPageBody");
const manualInput = document.getElementById("manualInput");
const langSelect = document.getElementById("langSelect");

const ingredientModal = document.getElementById("ingredientModal");
const ingredientModalTitle = document.getElementById("ingredientModalTitle");
const ingredientModalItems = document.getElementById("ingredientModalItems");
const ingredientModalSearch = document.getElementById("ingredientModalSearch");
const ingredientSearchEmpty = document.getElementById("ingredientSearchEmpty");
const ingredientModalSubtitle = document.getElementById("ingredientModalSubtitle");
const ingredientModalSelectedTitle = document.getElementById("ingredientModalSelectedTitle");
const ingredientModalSelectedCount = document.getElementById("ingredientModalSelectedCount");
const ingredientModalSelectedChips = document.getElementById("ingredientModalSelectedChips");
const ingredientModalFooterCount = document.getElementById("ingredientModalFooterCount");
const ingredientModalClear = document.getElementById("ingredientModalClear");
const ingredientModalDone = document.getElementById("ingredientModalDone");

const LANG_STORAGE_KEY = "niliKitchenLangV2";

function getSavedLang(){
  return (
    localStorage.getItem("niliLang") ||
    localStorage.getItem("lang") ||
    localStorage.getItem("niliKitchenLangV2") ||
    "en"
  );
}

function saveLang(lang){
  localStorage.setItem("niliLang", lang);
  localStorage.setItem("lang", lang);
  localStorage.setItem("niliKitchenLangV2", lang);
}

const urlLang =
  new URLSearchParams(window.location.search).get("lang");

let currentLang =
  getSavedLang();

if(urlLang){
  currentLang = urlLang;
  saveLang(currentLang);
}

const ingredientTranslationCache = {};
const ingredientTranslationLoading = {};

const ingredientFiles = [
  "vegetables.json",
  "fruits.json",
  "meat.json",
  "seafood.json",
  "dairy_eggs.json",
  "grains_bakery.json",
  "legumes.json",
  "herbs_spices.json",
  "oils_fats.json",
  "sauces_condiments.json",
  "nuts_seeds.json",
  "sweeteners_baking.json"
];

window.allIngredients = [];
window.categoryIngredients = {};
let allIngredientsLoadPromise = null;

async function loadAllIngredients(){

  window.allIngredients = [];
  window.categoryIngredients = {};
  const ingredientById = new Map();

  for(const file of ingredientFiles){

    try{
      let res = await fetch(`/ingredients/${file}`);

      if(!res.ok && window.API_BASE){
        res = await fetch(`${window.API_BASE}/ingredients/${file}`);
      }

      if(!res.ok){
        console.log("Ingredient file not found:", file);
        continue;
      }

      const items = await res.json();

      if(!Array.isArray(items)){
        console.log("Invalid ingredient file:", file);
        continue;
      }

      items.forEach(item => {
        const id = String(item?.id || "").trim().toLowerCase();
        if(!id) return;

        const existing = ingredientById.get(id);
        if(existing){
          existing.name = {...(item.name || {}), ...(existing.name || {})};
          existing.aliases = [...new Set([
            ...(Array.isArray(existing.aliases) ? existing.aliases : []),
            ...(Array.isArray(item.aliases) ? item.aliases : [])
          ])];
          return;
        }

        const normalizedItem = {...item,id};
        ingredientById.set(id, normalizedItem);
        window.allIngredients.push(normalizedItem);

        const cat = normalizedItem.category || "unknown";

        if(!window.categoryIngredients[cat]){
          window.categoryIngredients[cat] = [];
        }

        window.categoryIngredients[cat].push(normalizedItem);

      });

    }catch(err){
      console.log("Ingredient load error:", file, err.message);
    }
  }

  console.log("TOTAL INGREDIENTS LOADED:", window.allIngredients.length);
  console.log("CATEGORIES:", Object.keys(window.categoryIngredients));
}

function getAllCategoryIngredients(){

  if(window.allIngredients && window.allIngredients.length){

    return window.allIngredients.map(item =>
      item.name?.en || item.id
    );

  }

  if(window.NilisIngredients){

    return Object.keys(
      window.NilisIngredients.ingredients || {}
    );

  }

  return [
    ...new Set(
      Object.values(CATEGORY_DATA)
        .flat()
        .filter(Boolean)
    )
  ];

}

function getIngredientLabel(item){

  if(typeof item === "object"){
    const englishName = item.name?.en || item.id;
    return item.name?.[currentLang] ||
      ingredientTranslationCache[currentLang]?.[englishName] ||
      englishName;
  }

  const found =
    window.allIngredients?.find(x =>
      x.id === item ||
      x.name?.en === item
    );

  if(found){
    return getIngredientLabel(found);
  }

  if(currentLang === "en") return item;

  return ingredientTranslationCache[currentLang]?.[item] || item;
}

async function preloadIngredientTranslations(lang){
  if(!lang || lang === "en") return;

  if(ingredientTranslationCache[lang]) return;

  if(ingredientTranslationLoading[lang]){
    return ingredientTranslationLoading[lang];
  }

  const allItems = getAllCategoryIngredients();

  ingredientTranslationLoading[lang] = fetch(`${API_BASE}/translate-ingredients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items: allItems,
      lang
    })
  })
  .then(res => res.json())
  .then(data => {
    const translated = {};

    if(data && Array.isArray(data.items)){
      allItems.forEach((item, index) => {
        translated[item] = data.items[index] || item;
      });
    }

    ingredientTranslationCache[lang] = translated;
  })
  .catch(err => {
    console.error("Preload ingredient translations error:", err);
  });

  return ingredientTranslationLoading[lang];
}

if(localStorage.getItem("niliLastPage") === "recipes"){
  document.documentElement.classList.add("restore-recipes");
}

const translations = {
  en: {
    appSubtitle: "AI Recipe Assistant",
    scanTitle: "Scan ingredients by photo",
    scanSubtitle: "Upload a photo and let AI detect ingredients",
    manualTitle: "Add ingredients manually",
    manualPlaceholder: "Add ingredient",
    categoryTitle: "Add ingredients by category",

    selectedTitle: "Selected ingredients",
    selectedDesc: "Review your ingredients before finding recipes.",
    confirmIngredients: "Confirm ingredients",
    getRecipes: "Get Recipes",
    clearSelected: "Clear selected",
    emptySelected: "No ingredients selected yet.",

    signup: "Sign up",
    login: "Login",
    becomeCreator: "Become a creator",
    creatorDesc: "Upload recipes and earn rewards in the future.",
    creatorLogin: "Creator login",
    creatorLoginDesc: "Continue to your recipe upload page.",
    username: "Username",
    email: "Email address",
    emailOrUsername: "Email or username",
    password: "Password",
    show: "Show",
    hide: "Hide",
    continue: "Continue",

    alertIngredient: "Please add at least one ingredient.",
    alertConfirm: "Please confirm your ingredients first.",
    alertUsername: "Please enter a username.",
    alertEmail: "Please enter your email.",
    alertEmailOrUser: "Please enter your email or username.",
    alertPassword: "Please enter your password.",
    statusUpload: "Upload ingredients photo",
    statusAdded: "Ingredient added",
    statusAnalyzing: "Analyzing photo...",
    statusDetected: "Ingredients detected",
    statusNoIngredients: "No ingredients found",
    statusAnalyzeFailed: "Analyze failed",

    loadingRecipes: "Loading recipes...",
    recipesFailed: "Recipes failed",
    noRecipesFound: "No recipes found",

    usesIngredients: "Uses",
    ingredientsWord: "ingredients",

    recipeNotFound: "Recipe not found",
    recipeTitleFallback: "Recipe",
    timeMin: "min",
    ingredientsTitle: "Ingredients",
    instructionsTitle: "Instructions",
    instructionsUnavailable: "Recipe instructions unavailable.",
    heroBadge: "AI Powered Real Recipes",
    heroTitle: "Cook smarter with what you already have",
    heroDesc: "Upload ingredients, select what you have, and discover real recipes instantly.",
    heroKicker: "A brighter, more refined way to turn everyday ingredients into beautiful meals.",
    heroPrimaryBtn: "Scan Ingredients",
    heroSecondaryBtn: "Join Free",
    heroStrip1Label: "Smart Scan",
    heroStrip1Text: "Photo-powered ingredient detection",
    heroStrip2Label: "Nili's Recipe Archive",
    heroStrip2Text: "Explore every published Nili's recipe",
    heroStrip3Label: "Multi-Language",
    heroStrip3Text: "Cook in the language you prefer",
    galleryBtn: "Choose from gallery",
    becomeCreator: "Become a creator",
    creatorDesc: "Upload recipes and earn rewards in the future.",
    footerNote: "© 2026 Nili's Kitchen AI. All rights reserved.",
    ingredientDetailsUnavailable: "Ingredient details unavailable",
    timeUnavailable: "Time unavailable",
    serviceTemporaryUnavailable: "Service is temporarily unavailable due to a technical issue. Please try again later.",
    menuDashboard: "Dashboard",
    menuAddRecipe: "Add Recipe",
    menuFavorites: "Favorites",
    menuLogout: "Logout",
    menuHowItWorks: "How It Works",
    menuContact: "Send Message",
    contactEyebrow: "Message",
    contactTitle: "Send us a message",
    contactDesc: "Tell us what you noticed, liked, or want improved.",
    contactName: "Your name",
    contactEmail: "Your email",
    contactMessage: "Your message",
    contactSend: "Send message",
    contactSending: "Sending...",
    contactDone: "Thank you. Your message has been sent.",
    contactError: "Message could not be sent. Please try again.",
    contactRequired: "Please write a message.",

    howTitle: "👋 How Nili's Kitchen Works",
    howStep1: "1️⃣ Select ingredients from categories.",
    howStep2: "2️⃣ Add extra ingredients manually if you want.",
    howStep3: "3️⃣ Confirm your ingredients and tap Get Recipes.",
    howStep4: "4️⃣ Save your favorite recipes with a free account.",
    howStep5: "5️⃣ Creators can upload their own recipes.",
    howStart: "Start Exploring",
    howMoreInfo: "Learn More About Nili's Kitchen →",

    loadingRecipes: "Loading recipes...",
    pleaseWait: "Please wait",

    loginButton: "Login",

    signupTitle: "Create your free account",
signupDesc: "Save favorites, sync recipes and unlock more searches.",
signupContinue: "Continue",
continueGuest: "Continue as Guest",
signupTabText: "Sign Up",
loginTabText: "Login",

smartScanTitle: "📸 Smart Scan",
smartScanDesc: "Turn ingredients into possibilities",

cookSmarterTitle: "🍳 Cook Smarter",
cookSmarterDesc: "Recipes from what you already have",

mobileFeature1Title: "📸 AI Scan",
mobileFeature1Desc: "Photo ingredients",
mobileFeature2Title: "🥗 Smart Picks",
mobileFeature2Desc: "Choose by category",
mobileFeature3Title: "❤️ Save",
mobileFeature3Desc: "Keep favorites",

joinNiliTitle: "Join Nili's Kitchen",
joinNiliDesc: "Save favorites, upload recipes and unlock creator features.",
joinNiliBtn: "Join Free",

continueSelecting: "+ Continue selecting ingredients",



   categories: {
  vegetables: "Vegetables",
  fruits: "Fruits",
  meat: "Meat",
  seafood: "Seafood",
  dairy_eggs: "Dairy",
  grains_bakery: "Grains",
  legumes: "Legumes",
  herbs_spices: "Herbs",
  oils_fats: "Oils",
  sauces_condiments: "Sauces",
  nuts_seeds: "Nuts",
  sweeteners_baking: "Baking"
}

  },

  tr: {
    appSubtitle: "Yapay Zeka Tarif Asistanı",
    scanTitle: "Fotoğrafla malzemeleri tara",
    scanSubtitle: "Fotoğraf yükle, yapay zeka malzemeleri bulsun",
    manualTitle: "Malzemeyi elle ekle",
    manualPlaceholder: "Malzeme ekle",
    categoryTitle: "Kategoriye göre malzeme ekle",

    selectedTitle: "Seçilen malzemeler",
    selectedDesc: "Tarifleri bulmadan önce malzemeleri kontrol et.",
    confirmIngredients: "Malzemeleri onaylıyorum",
    getRecipes: "Tarifleri Bul",
    clearSelected: "Seçilenleri temizle",
    emptySelected: "Henüz malzeme seçilmedi.",

    signup: "Kayıt ol",
    login: "Giriş yap",
    becomeCreator: "Tarif üreticisi ol",
    creatorDesc: "Kendi tariflerini yükle, ileride ödül kazan.",
    creatorLogin: "Üretici girişi",
    creatorLoginDesc: "Tarif yükleme sayfana devam et.",
    username: "Kullanıcı adı",
    email: "E-posta adresi",
    emailOrUsername: "E-posta veya kullanıcı adı",
    password: "Şifre",
    show: "Göster",
    hide: "Gizle",
    continue: "Devam et",

    alertIngredient: "Lütfen en az bir malzeme ekleyin.",
    alertConfirm: "Lütfen önce malzemeleri onaylayın.",
    alertUsername: "Lütfen kullanıcı adı girin.",
    alertEmail: "Lütfen e-posta adresinizi girin.",
    alertEmailOrUser: "Lütfen e-posta veya kullanıcı adınızı girin.",
    alertPassword: "Lütfen şifrenizi girin.",
    statusUpload: "Malzeme fotoğrafı yükle",
    statusAdded: "Malzeme eklendi",
    statusAnalyzing: "Fotoğraf analiz ediliyor...",
    statusDetected: "Malzemeler bulundu",
    statusNoIngredients: "Malzeme bulunamadı",
    statusAnalyzeFailed: "Analiz başarısız",

    loadingRecipes: "Tarifler yükleniyor...",
    recipesFailed: "Tarifler alınamadı",
    noRecipesFound: "Tarif bulunamadı",

    usesIngredients: "Kullanıyor",
    ingredientsWord: "malzeme",

    recipeNotFound: "Tarif bulunamadı",
    recipeTitleFallback: "Tarif",
    timeMin: "dk",
    ingredientsTitle: "Malzemeler",
    instructionsTitle: "Hazırlanış",
    instructionsUnavailable: "Tarif açıklaması mevcut değil.",
    heroBadge: "Yapay Zeka Destekli Gerçek Tarifler",
    heroTitle: "Elindeki malzemelerle daha akıllı yemek pişir",
    heroDesc: "Malzemeleri yükle, elindekileri seç ve gerçek tarifleri anında keşfet.",
    heroKicker: "Günlük malzemeleri güzel yemeklere dönüştürmenin daha aydınlık ve daha rafine bir yolu.",
    heroPrimaryBtn: "Malzemeleri Tara",
    heroSecondaryBtn: "Ücretsiz Katıl",
    heroStrip1Label: "Akıllı Tarama",
    heroStrip1Text: "Fotoğrafla çalışan malzeme algılama",
    heroStrip2Label: "Nili's Tarif Arşivi",
    heroStrip2Text: "Yayınlanmış tüm Nili's tariflerini keşfet",
    heroStrip3Label: "Çok Dilli",
    heroStrip3Text: "İstediğin dilde yemek pişir",
    galleryBtn: "Galeriden seç",
    becomeCreator: "Tarif üreticisi ol",
    creatorDesc: "Tariflerini yükle, ileride ödüller kazan.",
    footerNote: "© 2026 Nili's Kitchen AI. Tüm hakları saklıdır.",
    ingredientDetailsUnavailable: "Malzeme detayları mevcut değil",
    timeUnavailable: "Süre bilgisi mevcut değil",
    serviceTemporaryUnavailable: "Teknik bir sorun nedeniyle hizmet şu anda geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyiniz.",
    menuDashboard: "Panel",
    menuAddRecipe: "Tarif Ekle",
    menuFavorites: "Favoriler",
    menuLogout: "Çıkış Yap",
    menuHowItWorks: "Nasıl Kullanılır",
    menuContact: "Mesaj Gönder",
    contactEyebrow: "Mesaj",
    contactTitle: "Bize mesaj gönder",
    contactDesc: "Gördüğün hata, eleştiri, öneri ya da aklına gelen fikri yaz.",
    contactName: "Adın",
    contactEmail: "E-posta adresin",
    contactMessage: "Mesajın",
    contactSend: "Mesajı gönder",
    contactSending: "Gönderiliyor...",
    contactDone: "Teşekkürler. Mesajın gönderildi.",
    contactError: "Mesaj gönderilemedi. Lütfen tekrar dene.",
    contactRequired: "Lütfen bir mesaj yaz.",

    
    howTitle: "👋 Nili's Kitchen Nasıl Çalışır?",
    howStep1: "1️⃣ Kategorilerden malzemelerinizi seçin.",
    howStep2: "2️⃣ İsterseniz ekstra malzemeleri manuel ekleyin.",
    howStep3: "3️⃣ Malzemeleri onaylayın ve Tarifleri Getir'e basın.",
    howStep4: "4️⃣ Ücretsiz hesap ile favori tariflerinizi kaydedin.",
    howStep5: "5️⃣ İçerik üreticileri kendi tariflerini ekleyebilir.",
    howStart: "Keşfetmeye Başla",
    howMoreInfo: "Daha Fazla Bilgi ve Açıklama →",

    loadingRecipes: "Tarifler yükleniyor...",
    pleaseWait: "Lütfen bekleyin",

    loginButton: "Giriş",

    signupTitle: "Ücretsiz hesabını oluştur",
signupDesc: "Favorileri kaydet, tariflerini senkronize et ve daha fazla arama hakkı kazan.",
signupContinue: "Devam Et",
continueGuest: "Misafir Olarak Devam Et",
signupTabText: "Üye Ol",
loginTabText: "Giriş Yap",


 smartScanTitle: "📸 Akıllı Tarama",
smartScanDesc: "Malzemeleri lezzetli fikirlere dönüştür",

cookSmarterTitle: "🍳 Daha Akıllı Pişir",
cookSmarterDesc: "Elindeki malzemelerle tarifler keşfet",

mobileFeature1Title: "📸 AI Tarama",
mobileFeature1Desc: "Malzemeleri fotoğrafla tanı",
mobileFeature2Title: "🥗 Akıllı Seçimler",
mobileFeature2Desc: "Kategoriye göre seç",
mobileFeature3Title: "❤️ Kaydet",
mobileFeature3Desc: "Favorileri sakla",

joinNiliTitle: "Nili's Kitchen’a Katıl",
joinNiliDesc: "Favorilerini kaydet, tarif yükle ve creator özelliklerini aç.",
joinNiliBtn: "Ücretsiz Katıl",

continueSelecting: "+ Malzeme seçmeye devam et",


   categories: {
  vegetables: "Sebzeler",
  fruits: "Meyveler",
  meat: "Et",
  seafood: "Deniz Ürünleri",
  dairy_eggs: "Süt Ürünleri",
  grains_bakery: "Tahıllar",
  legumes: "Bakliyat",
  herbs_spices: "Otlar",
  oils_fats: "Yağlar",
  sauces_condiments: "Soslar",
  nuts_seeds: "Kuruyemişler",
  sweeteners_baking: "Pastacılık"
}
  },

  ru: {
    appSubtitle: "AI помощник рецептов",
    scanTitle: "Сканировать ингредиенты по фото",
    scanSubtitle: "Загрузите фото, и AI определит ингредиенты",
    manualTitle: "Добавить ингредиенты вручную",
    manualPlaceholder: "Добавить ингредиент",
    categoryTitle: "Добавить по категории",

    selectedTitle: "Выбранные ингредиенты",
    selectedDesc: "Проверьте ингредиенты перед поиском рецептов.",
    confirmIngredients: "Подтвердить ингредиенты",
    getRecipes: "Найти рецепты",
    clearSelected: "Очистить выбранное",
    emptySelected: "Ингредиенты пока не выбраны.",

    signup: "Регистрация",
    login: "Вход",
    becomeCreator: "Стать автором",
    creatorDesc: "Загружайте рецепты и получайте награды в будущем.",
    creatorLogin: "Вход автора",
    creatorLoginDesc: "Перейти на страницу загрузки рецепта.",
    username: "Имя пользователя",
    email: "Email",
    emailOrUsername: "Email или имя пользователя",
    password: "Пароль",
    show: "Показать",
    hide: "Скрыть",
    continue: "Продолжить",

    alertIngredient: "Добавьте хотя бы один ингредиент.",
    alertConfirm: "Сначала подтвердите ингредиенты.",
    alertUsername: "Введите имя пользователя.",
    alertEmail: "Введите email.",
    alertEmailOrUser: "Введите email или имя пользователя.",
    alertPassword: "Введите пароль.",
    statusUpload: "Загрузите фото ингредиентов",
    statusAdded: "Ингредиент добавлен",
    statusAnalyzing: "Фото анализируется...",
    statusDetected: "Ингредиенты найдены",
    statusNoIngredients: "Ингредиенты не найдены",
    statusAnalyzeFailed: "Ошибка анализа",

    loadingRecipes: "Рецепты загружаются...",
    recipesFailed: "Не удалось загрузить рецепты",
    noRecipesFound: "Рецепты не найдены",

    usesIngredients: "Использует",
    ingredientsWord: "ингредиентов",

    recipeNotFound: "Рецепт не найден",
    recipeTitleFallback: "Рецепт",
    timeMin: "мин",
    ingredientsTitle: "Ингредиенты",
    instructionsTitle: "Инструкции",
    instructionsUnavailable: "Инструкции рецепта недоступны.",
    heroBadge: "Реальные рецепты с поддержкой ИИ",
    heroTitle: "Готовьте умнее из того, что уже есть дома",
    heroDesc: "Загрузите ингредиенты, выберите то, что у вас есть, и мгновенно находите реальные рецепты.",
    heroKicker: "Более светлый и изящный способ превращать обычные ингредиенты в красивые блюда.",
    heroPrimaryBtn: "Сканировать ингредиенты",
    heroSecondaryBtn: "Присоединиться бесплатно",
    heroStrip1Label: "Умное сканирование",
    heroStrip1Text: "Распознавание ингредиентов по фото",
    heroStrip2Label: "Архив рецептов Nili's",
    heroStrip2Text: "Все опубликованные рецепты Nili's",
    heroStrip3Label: "Много языков",
    heroStrip3Text: "Готовьте на удобном вам языке",
    galleryBtn: "Выбрать из галереи",
    becomeCreator: "Стать автором",
    creatorDesc: "Загружайте рецепты и получайте награды в будущем.",
    footerNote: "© 2026 Nili's Kitchen AI. Все права защищены.",
    ingredientDetailsUnavailable: "Детали ингредиентов недоступны",
    timeUnavailable: "Время недоступно",
    serviceTemporaryUnavailable:"Сервис временно недоступен из-за технической проблемы. Пожалуйста, попробуйте позже.",
    menuDashboard: "Панель",
    menuAddRecipe: "Добавить рецепт",
    menuFavorites: "Избранное",
    menuLogout: "Выйти",
    menuHowItWorks: "Как это работает",

    howTitle: "👋 Как работает Nili's Kitchen",
    howStep1: "1️⃣ Выберите ингредиенты из категорий.",
    howStep2: "2️⃣ При желании добавьте свои ингредиенты вручную.",
    howStep3: "3️⃣ Подтвердите ингредиенты и нажмите Получить рецепты.",
    howStep4: "4️⃣ Сохраняйте любимые рецепты с бесплатной учетной записью.",
    howStep5: "5️⃣ Авторы могут добавлять собственные рецепты.",
    howStart: "Начать",
    howMoreInfo: "Подробнее о Nili's Kitchen →",

    loadingRecipes: "Рецепты загружаются...",
    pleaseWait: "Пожалуйста, подождите",

    loginButton: "Войти",

    signupTitle: "Создайте бесплатный аккаунт",
signupDesc: "Сохраняйте избранное, синхронизируйте рецепты и получайте больше поисков.",
signupContinue: "Продолжить",
continueGuest: "Продолжить как гость",
signupTabText: "Регистрация",
loginTabText: "Вход",

smartScanTitle: "📸 Умное сканирование",
smartScanDesc: "Превратите ингредиенты в новые идеи",

cookSmarterTitle: "🍳 Готовьте умнее",
cookSmarterDesc: "Рецепты из того, что уже есть у вас дома",

mobileFeature1Title: "📸 AI Сканирование",
mobileFeature1Desc: "Распознайте ингредиенты по фото",
mobileFeature2Title: "🥗 Умный выбор",
mobileFeature2Desc: "Выбор по категории",
mobileFeature3Title: "❤️ Сохранить",
mobileFeature3Desc: "Сохраняйте избранное",

joinNiliTitle: "Присоединяйтесь к Nili's Kitchen",
joinNiliDesc: "Сохраняйте избранное и добавляйте рецепты.",
joinNiliBtn: "Присоединиться бесплатно",

continueSelecting: "+ Продолжить выбор ингредиентов",
    

   categories: {
  vegetables: "Овощи",
  fruits: "Фрукты",
  meat: "Мясо",
  seafood: "Морепродукты",
  dairy_eggs: "Молочные",
  grains_bakery: "Крупы",
  legumes: "Бобовые",
  herbs_spices: "Травы",
  oils_fats: "Масла",
  sauces_condiments: "Соусы",
  nuts_seeds: "Орехи",
  sweeteners_baking: "Выпечка"
}
  },

  fr: {
    appSubtitle: "Assistant de recettes IA",
    scanTitle: "Scanner les ingrédients par photo",
    scanSubtitle: "Téléversez une photo et l’IA détectera les ingrédients",
    manualTitle: "Ajouter manuellement",
    manualPlaceholder: "Ajouter un ingrédient",
    categoryTitle: "Ajouter par catégorie",

    selectedTitle: "Ingrédients sélectionnés",
    selectedDesc: "Vérifiez vos ingrédients avant de chercher des recettes.",
    confirmIngredients: "Confirmer les ingrédients",
    getRecipes: "Trouver des recettes",
    clearSelected: "Effacer la sélection",
    emptySelected: "Aucun ingrédient sélectionné.",

    signup: "S’inscrire",
    login: "Connexion",
    becomeCreator: "Devenir créateur",
    creatorDesc: "Téléversez vos recettes et gagnez des récompenses plus tard.",
    creatorLogin: "Connexion créateur",
    creatorLoginDesc: "Continuer vers votre page de recette.",
    username: "Nom d’utilisateur",
    email: "Adresse e-mail",
    emailOrUsername: "E-mail ou nom d’utilisateur",
    password: "Mot de passe",
    show: "Afficher",
    hide: "Masquer",
    continue: "Continuer",

    alertIngredient: "Veuillez ajouter au moins un ingrédient.",
    alertConfirm: "Veuillez confirmer vos ingrédients.",
    alertUsername: "Veuillez entrer un nom d’utilisateur.",
    alertEmail: "Veuillez entrer votre e-mail.",
    alertEmailOrUser: "Veuillez entrer votre e-mail ou nom d’utilisateur.",
    alertPassword: "Veuillez entrer votre mot de passe.",
    statusUpload: "Téléverser une photo d’ingrédients",
    statusAdded: "Ingrédient ajouté",
    statusAnalyzing: "Analyse de la photo...",
    statusDetected: "Ingrédients détectés",
    statusNoIngredients: "Aucun ingrédient trouvé",
    statusAnalyzeFailed: "Échec de l’analyse",

    loadingRecipes: "Chargement des recettes...",
    recipesFailed: "Échec du chargement des recettes",
    noRecipesFound: "Aucune recette trouvée",

    usesIngredients: "Utilise",
    ingredientsWord: "ingrédients",

    recipeNotFound: "Recette introuvable",
    recipeTitleFallback: "Recette",
    timeMin: "min",
    ingredientsTitle: "Ingrédients",
    instructionsTitle: "Instructions",
    instructionsUnavailable: "Instructions de recette indisponibles.",
    heroBadge: "De vraies recettes avec l’IA",
    heroTitle: "Cuisinez plus intelligemment avec ce que vous avez déjà",
    heroDesc: "Téléchargez vos ingrédients, sélectionnez ce que vous avez et découvrez instantanément de vraies recettes.",
    heroKicker: "Une façon plus lumineuse et plus raffinée de transformer des ingrédients du quotidien en beaux plats.",
    heroPrimaryBtn: "Scanner les ingrédients",
    heroSecondaryBtn: "Rejoindre gratuitement",
    heroStrip1Label: "Scan intelligent",
    heroStrip1Text: "Détection des ingrédients par photo",
    heroStrip2Label: "Archives de recettes Nili's",
    heroStrip2Text: "Découvrez toutes les recettes publiées",
    heroStrip3Label: "Multilingue",
    heroStrip3Text: "Cuisinez dans la langue de votre choix",
    galleryBtn: "Choisir dans la galerie",
    becomeCreator: "Devenir créateur",
    creatorDesc: "Ajoutez vos recettes et gagnez des récompenses plus tard.",
    footerNote: "© 2026 Nili's Kitchen AI. Tous droits réservés.",
    ingredientDetailsUnavailable: "Détails des ingrédients indisponibles",
    timeUnavailable: "Temps indisponible",
    serviceTemporaryUnavailable:"Le service est temporairement indisponible en raison d’un problème technique. Veuillez réessayer plus tard.",
    menuDashboard: "Tableau de bord",
    menuAddRecipe: "Ajouter une recette",
    menuFavorites: "Favoris",
    menuLogout: "Déconnexion",
    menuHowItWorks: "Comment ça marche",

    howTitle: "👋 Comment fonctionne Nili's Kitchen",
    howStep1: "1️⃣ Sélectionnez vos ingrédients par catégorie.",
    howStep2: "2️⃣ Ajoutez d'autres ingrédients manuellement si nécessaire.",
    howStep3: "3️⃣ Confirmez vos ingrédients et cliquez sur Obtenir des recettes.",
    howStep4: "4️⃣ Enregistrez vos recettes préférées avec un compte gratuit.",
    howStep5: "5️⃣ Les créateurs peuvent publier leurs propres recettes.",
    howStart: "Commencer",
    howMoreInfo: "En savoir plus sur Nili's Kitchen →",

    loadingRecipes: "Chargement des recettes...",
    pleaseWait: "Veuillez patienter",

    loginButton: "Connexion",

    signupTitle: "Créez votre compte gratuit",
signupDesc: "Enregistrez vos favoris, synchronisez vos recettes et débloquez plus de recherches.",
signupContinue: "Continuer",
continueGuest: "Continuer en tant qu'invité",
signupTabText: "S'inscrire",
loginTabText: "Connexion",

smartScanTitle: "📸 Scan Intelligent",
smartScanDesc: "Transformez vos ingrédients en possibilités",

cookSmarterTitle: "🍳 Cuisinez Plus Malin",
cookSmarterDesc: "Des recettes avec ce que vous avez déjà",

mobileFeature1Title: "📸 Scan IA",
mobileFeature1Desc: "Identifier les ingrédients par photo",
mobileFeature2Title: "🥗 Choix Intelligents",
mobileFeature2Desc: "Choisir par catégorie",
mobileFeature3Title: "❤️ Enregistrer",
mobileFeature3Desc: "Conserver les favoris",

joinNiliTitle: "Rejoignez Nili's Kitchen",
joinNiliDesc: "Enregistrez vos favoris et ajoutez des recettes.",
joinNiliBtn: "Rejoindre gratuitement",

continueSelecting: "+ Continuer à choisir des ingrédients",
 


    categories: {
  vegetables: "Légumes",
  fruits: "Fruits",
  meat: "Viande",
  seafood: "Fruits de mer",
  dairy_eggs: "Produits laitiers",
  grains_bakery: "Céréales",
  legumes: "Légumineuses",
  herbs_spices: "Herbes",
  oils_fats: "Huiles",
  sauces_condiments: "Sauces",
  nuts_seeds: "Noix",
  sweeteners_baking: "Pâtisserie"
}
  },

  es: {
    appSubtitle: "Asistente de recetas con IA",
    scanTitle: "Escanear ingredientes por foto",
    scanSubtitle: "Sube una foto y la IA detectará ingredientes",
    manualTitle: "Añadir ingredientes manualmente",
    manualPlaceholder: "Añadir ingrediente",
    categoryTitle: "Añadir por categoría",

    selectedTitle: "Ingredientes seleccionados",
    selectedDesc: "Revisa tus ingredientes antes de buscar recetas.",
    confirmIngredients: "Confirmar ingredientes",
    getRecipes: "Buscar recetas",
    clearSelected: "Limpiar selección",
    emptySelected: "Aún no hay ingredientes seleccionados.",

    signup: "Registrarse",
    login: "Iniciar sesión",
    becomeCreator: "Ser creador",
    creatorDesc: "Sube tus recetas y gana recompensas en el futuro.",
    creatorLogin: "Acceso creador",
    creatorLoginDesc: "Continúa a tu página de recetas.",
    username: "Nombre de usuario",
    email: "Correo electrónico",
    emailOrUsername: "Correo o usuario",
    password: "Contraseña",
    show: "Mostrar",
    hide: "Ocultar",
    continue: "Continuar",

    alertIngredient: "Añade al menos un ingrediente.",
    alertConfirm: "Confirma tus ingredientes primero.",
    alertUsername: "Introduce un nombre de usuario.",
    alertEmail: "Introduce tu correo.",
    alertEmailOrUser: "Introduce tu correo o usuario.",
    alertPassword: "Introduce tu contraseña.",
    statusUpload: "Subir foto de ingredientes",
    statusAdded: "Ingrediente añadido",
    statusAnalyzing: "Analizando foto...",
    statusDetected: "Ingredientes detectados",
    statusNoIngredients: "No se encontraron ingredientes",
    statusAnalyzeFailed: "Error en el análisis",

    loadingRecipes: "Cargando recetas...",
    recipesFailed: "No se pudieron cargar las recetas",
    noRecipesFound: "No se encontraron recetas",

    usesIngredients: "Usa",
    ingredientsWord: "ingredientes",

    recipeNotFound: "Receta no encontrada",
    recipeTitleFallback: "Receta",
    timeMin: "min",
    ingredientsTitle: "Ingredientes",
    instructionsTitle: "Instrucciones",
    instructionsUnavailable: "Instrucciones de receta no disponibles.",
    heroBadge: "Recetas reales con IA",
    heroTitle: "Cocina de forma más inteligente con lo que ya tienes",
    heroDesc: "Sube tus ingredientes, selecciona lo que tienes y descubre recetas reales al instante.",
    heroKicker: "Una forma más luminosa y refinada de convertir ingredientes cotidianos en platos hermosos.",
    heroPrimaryBtn: "Escanear ingredientes",
    heroSecondaryBtn: "Unirse gratis",
    heroStrip1Label: "Escaneo inteligente",
    heroStrip1Text: "Detección de ingredientes por foto",
    heroStrip2Label: "Archivo de recetas Nili's",
    heroStrip2Text: "Explora todas las recetas publicadas",
    heroStrip3Label: "Multilenguaje",
    heroStrip3Text: "Cocina en el idioma que prefieras",
    galleryBtn: "Elegir de la galería",
    becomeCreator: "Ser creador",
    creatorDesc: "Sube tus recetas y gana recompensas en el futuro.",
    footerNote: "© 2026 Nili's Kitchen AI. Todos los derechos reservados.",
    ingredientDetailsUnavailable: "Detalles de ingredientes no disponibles",
    timeUnavailable: "Tiempo no disponible",
    serviceTemporaryUnavailable:"El servicio no está disponible temporalmente debido a un problema técnico. Por favor, inténtelo de nuevo más tarde.",
    menuDashboard: "Panel",
    menuAddRecipe: "Agregar receta",
    menuFavorites: "Favoritos",
    menuLogout: "Cerrar sesión",
    menuHowItWorks: "Como funciona",
    
    howTitle: "👋 Cómo funciona Nili's Kitchen",
    howStep1: "1️⃣ Selecciona ingredientes por categorías.",
    howStep2: "2️⃣ Añade ingredientes adicionales manualmente si lo deseas.",
    howStep3: "3️⃣ Confirma los ingredientes y pulsa Obtener Recetas.",
    howStep4: "4️⃣ Guarda tus recetas favoritas con una cuenta gratuita.",
    howStep5: "5️⃣ Los creadores pueden subir sus propias recetas.",
    howStart: "Comenzar",
    howMoreInfo: "Más información sobre Nili's Kitchen →",

    loadingRecipes: "Cargando recetas...",
    pleaseWait: "Por favor espera",

    loginButton: "Ingresar",

    signupTitle: "Crea tu cuenta gratuita",
signupDesc: "Guarda favoritos, sincroniza recetas y desbloquea más búsquedas.",
signupContinue: "Continuar",
continueGuest: "Continuar como invitado",
signupTabText: "Registrarse",
loginTabText: "Iniciar sesión",

smartScanTitle: "📸 Escaneo Inteligente",
smartScanDesc: "Convierte ingredientes en posibilidades",

cookSmarterTitle: "🍳 Cocina Mejor",
cookSmarterDesc: "Recetas con lo que ya tienes",

mobileFeature1Title: "📸 Escaneo IA",
mobileFeature1Desc: "Reconoce ingredientes por foto",
mobileFeature2Title: "🥗 Selecciones Inteligentes",
mobileFeature2Desc: "Elige por categoría",
mobileFeature3Title: "❤️ Guardar",
mobileFeature3Desc: "Mantén tus favoritos",

joinNiliTitle: "Únete a Nili's Kitchen",
joinNiliDesc: "Guarda favoritos, publica recetas y desbloquea funciones de creador.",
joinNiliBtn: "Unirse gratis",

continueSelecting: "+ Continuar seleccionando ingredientes",

   categories: {
  vegetables: "Verduras",
  fruits: "Frutas",
  meat: "Carne",
  seafood: "Mariscos",
  dairy_eggs: "Lácteos",
  grains_bakery: "Granos",
  legumes: "Legumbres",
  herbs_spices: "Hierbas",
  oils_fats: "Aceites",
  sauces_condiments: "Salsas",
  nuts_seeds: "Frutos secos",
  sweeteners_baking: "Repostería"
}
  },

  pt: {
    appSubtitle: "Assistente de receitas com IA",
    scanTitle: "Escanear ingredientes por foto",
    scanSubtitle: "Envie uma foto e a IA detectará os ingredientes",
    manualTitle: "Adicionar manualmente",
    manualPlaceholder: "Adicionar ingrediente",
    categoryTitle: "Adicionar por categoria",

    selectedTitle: "Ingredientes selecionados",
    selectedDesc: "Revise seus ingredientes antes de buscar receitas.",
    confirmIngredients: "Confirmar ingredientes",
    getRecipes: "Buscar receitas",
    clearSelected: "Limpar seleção",
    emptySelected: "Nenhum ingrediente selecionado ainda.",

    signup: "Criar conta",
    login: "Entrar",
    becomeCreator: "Torne-se criador",
    creatorDesc: "Envie suas receitas e ganhe recompensas no futuro.",
    creatorLogin: "Login do criador",
    creatorLoginDesc: "Continue para sua página de receitas.",
    username: "Nome de usuário",
    email: "E-mail",
    emailOrUsername: "E-mail ou usuário",
    password: "Senha",
    show: "Mostrar",
    hide: "Ocultar",
    continue: "Continuar",

    alertIngredient: "Adicione pelo menos um ingrediente.",
    alertConfirm: "Confirme seus ingredientes primeiro.",
    alertUsername: "Digite um nome de usuário.",
    alertEmail: "Digite seu e-mail.",
    alertEmailOrUser: "Digite seu e-mail ou usuário.",
    alertPassword: "Digite sua senha.",
    statusUpload: "Enviar foto dos ingredientes",
    statusAdded: "Ingrediente adicionado",
    statusAnalyzing: "Analisando foto...",
    statusDetected: "Ingredientes detectados",
    statusNoIngredients: "Nenhum ingrediente encontrado",
    statusAnalyzeFailed: "Falha na análise",

    loadingRecipes: "Carregando receitas...",
    recipesFailed: "Falha ao carregar receitas",
    noRecipesFound: "Nenhuma receita encontrada",

    usesIngredients: "Usa",
    ingredientsWord: "ingredientes",

    recipeNotFound: "Receita não encontrada",
    recipeTitleFallback: "Receita",
    timeMin: "min",
    ingredientsTitle: "Ingredientes",
    instructionsTitle: "Instruções",
    instructionsUnavailable: "Instruções da receita indisponíveis.",
    heroBadge: "Receitas reais com IA",
    heroTitle: "Cozinhe de forma mais inteligente com o que você já tem",
    heroDesc: "Envie seus ingredientes, selecione o que você tem e descubra receitas reais instantaneamente.",
    heroKicker: "Uma maneira mais leve e refinada de transformar ingredientes do dia a dia em pratos bonitos.",
    heroPrimaryBtn: "Escanear ingredientes",
    heroSecondaryBtn: "Participar grátis",
    heroStrip1Label: "Escaneamento inteligente",
    heroStrip1Text: "Detecção de ingredientes por foto",
    heroStrip2Label: "Arquivo de receitas Nili's",
    heroStrip2Text: "Explore todas as receitas publicadas",
    heroStrip3Label: "Multilíngue",
    heroStrip3Text: "Cozinhe no idioma que preferir",
    galleryBtn: "Elegir de la galería",
    becomeCreator: "Torne-se criador",
    creatorDesc: "Envie suas receitas e ganhe recompensas no futuro.",
    footerNote: "© 2026 Nili's Kitchen AI. Todos os direitos reservados.",
    ingredientDetailsUnavailable: "Detalhes dos ingredientes indisponíveis",
    timeUnavailable: "Tempo indisponível",
    serviceTemporaryUnavailable:"O serviço está temporariamente indisponível devido a um problema técnico. Por favor, tente novamente mais tarde.",
    menuDashboard: "Painel",
    menuAddRecipe: "Adicionar receita",
    menuFavorites: "Favoritos",
    menuLogout: "Sair",
    menuHowItWorks: "Como funciona", 

    howTitle: "👋 Como funciona o Nili's Kitchen",
    howStep1: "1️⃣ Selecione ingredientes por categorias.",
    howStep2: "2️⃣ Adicione ingredientes extras manualmente se desejar.",
    howStep3: "3️⃣ Confirme os ingredientes e toque em Obter Receitas.",
    howStep4: "4️⃣ Salve suas receitas favoritas com uma conta gratuita.",
    howStep5: "5️⃣ Criadores podem enviar suas próprias receitas.",
    howStart: "Começar",
    howMoreInfo: "Mais informações sobre o Nili's Kitchen →",

    loadingRecipes: "Carregando receitas...",
    pleaseWait: "Por favor, aguarde",

    loginButton: "Entrar",

    signupTitle: "Crie sua conta gratuita",
signupDesc: "Salve favoritos, sincronize receitas e desbloqueie mais pesquisas.",
signupContinue: "Continuar",
continueGuest: "Continuar como visitante",
signupTabText: "Cadastrar-se",
loginTabText: "Entrar",

smartScanTitle: "📸 Escaneamento Inteligente",
smartScanDesc: "Transforme ingredientes em possibilidades",

cookSmarterTitle: "🍳 Cozinhe Melhor",
cookSmarterDesc: "Receitas com o que você já tem",

mobileFeature1Title: "📸 Digitalização IA",
mobileFeature1Desc: "Reconheça ingredientes por foto",
mobileFeature2Title: "🥗 Escolhas Inteligentes",
mobileFeature2Desc: "Escolha por categoria",
mobileFeature3Title: "❤️ Salvar",
mobileFeature3Desc: "Guarde seus favoritos",

joinNiliTitle: "Junte-se ao Nili's Kitchen",
joinNiliDesc: "Salve favoritos, publique receitas e desbloqueie recursos de criador.",
joinNiliBtn: "Participar grátis",

continueSelecting: "+ Continuar selecionando ingredientes",


    categories: {
  vegetables: "Vegetais",
  fruits: "Frutas",
  meat: "Carne",
  seafood: "Frutos do mar",
  dairy_eggs: "Laticínios",
  grains_bakery: "Grãos",
  legumes: "Leguminosas",
  herbs_spices: "Ervas",
  oils_fats: "Óleos",
  sauces_condiments: "Molhos",
  nuts_seeds: "Nozes",
  sweeteners_baking: "Confeitaria"
}
  },

  ar: {
    appSubtitle: "مساعد وصفات بالذكاء الاصطناعي",
    scanTitle: "مسح المكونات بالصورة",
    scanSubtitle: "ارفع صورة ودع الذكاء الاصطناعي يكتشف المكونات",
    manualTitle: "إضافة المكونات يدويًا",
    manualPlaceholder: "أضف مكونًا",
    categoryTitle: "إضافة حسب الفئة",

    selectedTitle: "المكونات المختارة",
    selectedDesc: "راجع المكونات قبل البحث عن وصفات.",
    confirmIngredients: "تأكيد المكونات",
    getRecipes: "البحث عن وصفات",
    clearSelected: "مسح المحدد",
    emptySelected: "لم يتم اختيار مكونات بعد.",

    signup: "إنشاء حساب",
    login: "تسجيل الدخول",
    becomeCreator: "كن منشئ وصفات",
    creatorDesc: "ارفع وصفاتك واحصل على مكافآت مستقبلًا.",
    creatorLogin: "دخول المنشئ",
    creatorLoginDesc: "تابع إلى صفحة رفع الوصفات.",
    username: "اسم المستخدم",
    email: "البريد الإلكتروني",
    emailOrUsername: "البريد أو اسم المستخدم",
    password: "كلمة المرور",
    show: "إظهار",
    hide: "إخفاء",
    continue: "متابعة",

    alertIngredient: "يرجى إضافة مكون واحد على الأقل.",
    alertConfirm: "يرجى تأكيد المكونات أولاً.",
    alertUsername: "يرجى إدخال اسم المستخدم.",
    alertEmail: "يرجى إدخال البريد الإلكتروني.",
    alertEmailOrUser: "يرجى إدخال البريد أو اسم المستخدم.",
    alertPassword: "يرجى إدخال كلمة المرور.",
    statusUpload: "رفع صورة المكونات",
    statusAdded: "تمت إضافة المكون",
    statusAnalyzing: "جارٍ تحليل الصورة...",
    statusDetected: "تم اكتشاف المكونات",
    statusNoIngredients: "لم يتم العثور على مكونات",
    statusAnalyzeFailed: "فشل التحليل",

    loadingRecipes: "جارٍ تحميل الوصفات...",
    recipesFailed: "فشل تحميل الوصفات",
    noRecipesFound: "لم يتم العثور على وصفات",

    usesIngredients: "يستخدم",
    ingredientsWord: "مكونات",

    recipeNotFound: "الوصفة غير موجودة",
    recipeTitleFallback: "وصفة",
    timeMin: "دقيقة",
    ingredientsTitle: "المكونات",
    instructionsTitle: "طريقة التحضير",
    instructionsUnavailable: "تعليمات الوصفة غير متوفرة.",
    heroBadge: "وصفات حقيقية مدعومة بالذكاء الاصطناعي",
    heroTitle: "اطبخ بذكاء أكبر بما لديك بالفعل",
    heroDesc: "حمّل المكونات، واختر ما لديك، واكتشف وصفات حقيقية فورًا.",
    heroKicker: "طريقة أكثر إشراقًا ورقيًا لتحويل المكونات اليومية إلى أطباق جميلة.",
    heroPrimaryBtn: "امسح المكونات",
    heroSecondaryBtn: "انضم مجانًا",
    heroStrip1Label: "مسح ذكي",
    heroStrip1Text: "اكتشاف المكونات بالصور",
    heroStrip2Label: "أرشيف وصفات Nili's",
    heroStrip2Text: "استكشف جميع وصفات Nili's المنشورة",
    heroStrip3Label: "متعدد اللغات",
    heroStrip3Text: "اطبخ باللغة التي تفضلها",
    galleryBtn: "اختر من المعرض",
    becomeCreator: "كن منشئ وصفات",
    creatorDesc: "ارفع وصفاتك واحصل على مكافآت مستقبلًا.",
    footerNote: "© 2026 Nili's Kitchen AI. جميع الحقوق محفوظة.",
    ingredientDetailsUnavailable: "تفاصيل المكونات غير متوفرة",
    timeUnavailable: "وقت التحضير غير متوفر",
    serviceTemporaryUnavailable:"الخدمة غير متاحة مؤقتًا بسبب مشكلة تقنية. يرجى المحاولة مرة أخرى لاحقًا.",
    menuDashboard: "لوحة التحكم",
    menuAddRecipe: "إضافة وصفة",
    menuFavorites: "المفضلة",
    menuLogout: "تسجيل الخروج",
    menuHowItWorks: "كيف يعمل",

    howTitle: "👋 كيف يعمل Nili's Kitchen",
    howStep1: "1️⃣ اختر المكونات من الفئات المختلفة.",
    howStep2: "2️⃣ أضف مكونات إضافية يدويًا إذا أردت.",
    howStep3: "3️⃣ أكد المكونات واضغط على الحصول على الوصفات.",
    howStep4: "4️⃣ احفظ وصفاتك المفضلة بحساب مجاني.",
    howStep5: "5️⃣ يمكن للمنشئين إضافة وصفاتهم الخاصة.",
    howStart: "ابدأ الاستكشاف",
    howMoreInfo: "مزيد من المعلومات حول Nili's Kitchen →",

    loadingRecipes: "جارٍ تحميل الوصفات...",
    pleaseWait: "يرجى الانتظار",

    loginButton: "تسجيل الدخول",

    signupTitle: "أنشئ حسابك المجاني",
signupDesc: "احفظ المفضلة، وقم بمزامنة الوصفات، واحصل على المزيد من عمليات البحث.",
signupContinue: "متابعة",
continueGuest: "المتابعة كضيف",
signupTabText: "إنشاء حساب",
loginTabText: "تسجيل الدخول",

smartScanTitle: "📸 مسح ذكي",
smartScanDesc: "حوّل المكونات إلى أفكار ووصفات",

cookSmarterTitle: "🍳 اطبخ بذكاء",
cookSmarterDesc: "وصفات باستخدام ما لديك بالفعل",

mobileFeature1Title: "📸 مسح بالذكاء الاصطناعي",
mobileFeature1Desc: "التعرف على المكونات من الصورة",
mobileFeature2Title: "🥗 اختيارات ذكية",
mobileFeature2Desc: "اختر حسب الفئة",
mobileFeature3Title: "❤️ حفظ",
mobileFeature3Desc: "احتفظ بالمفضلة",

joinNiliTitle: "انضم إلى Nili's Kitchen",
joinNiliDesc: "احفظ المفضلة، وارفع الوصفات، وافتح ميزات صانع المحتوى.",
joinNiliBtn: "انضم مجانًا",

continueSelecting: "+ اختر المزيد من المكونات",

    categories: {
  vegetables: "خضروات",
  fruits: "فواكه",
  meat: "لحوم",
  seafood: "مأكولات بحرية",
  dairy_eggs: "ألبان",
  grains_bakery: "حبوب",
  legumes: "بقوليات",
  herbs_spices: "أعشاب",
  oils_fats: "زيوت",
  sauces_condiments: "صلصات",
  nuts_seeds: "مكسرات",
  sweeteners_baking: "مخبوزات"
}
  },

  de: {
  appSubtitle: "KI-Rezeptassistent",
  scanTitle: "Zutaten per Foto scannen",
  scanSubtitle: "Lade ein Foto hoch und lasse die KI Zutaten erkennen",
  manualTitle: "Zutaten manuell hinzufügen",
  manualPlaceholder: "Zutat hinzufügen",
  categoryTitle: "Zutaten nach Kategorie hinzufügen",

  selectedTitle: "Ausgewählte Zutaten",
  selectedDesc: "Überprüfe deine Zutaten, bevor du Rezepte suchst.",
  confirmIngredients: "Zutaten bestätigen",
  getRecipes: "Rezepte anzeigen",
  clearSelected: "Auswahl löschen",
  emptySelected: "Noch keine Zutaten ausgewählt.",

  signup: "Registrieren",
  login: "Anmelden",
  becomeCreator: "Creator werden",
  creatorDesc: "Rezepte hochladen und künftig Belohnungen erhalten.",
  creatorLogin: "Creator-Anmeldung",
  creatorLoginDesc: "Weiter zur Rezept-Upload-Seite.",
  username: "Benutzername",
  email: "E-Mail-Adresse",
  emailOrUsername: "E-Mail oder Benutzername",
  password: "Passwort",
  show: "Anzeigen",
  hide: "Ausblenden",
  continue: "Weiter",

  alertIngredient: "Bitte mindestens eine Zutat hinzufügen.",
  alertConfirm: "Bitte zuerst Zutaten bestätigen.",
  alertUsername: "Bitte Benutzernamen eingeben.",
  alertEmail: "Bitte E-Mail eingeben.",
  alertEmailOrUser: "Bitte E-Mail oder Benutzernamen eingeben.",
  alertPassword: "Bitte Passwort eingeben.",

  statusUpload: "Zutatenfoto hochladen",
  statusAdded: "Zutat hinzugefügt",
  statusAnalyzing: "Foto wird analysiert...",
  statusDetected: "Zutaten erkannt",
  statusNoIngredients: "Keine Zutaten gefunden",
  statusAnalyzeFailed: "Analyse fehlgeschlagen",

  loadingRecipes: "Rezepte werden geladen...",
  recipesFailed: "Rezepte konnten nicht geladen werden",
  noRecipesFound: "Keine Rezepte gefunden",

  usesIngredients: "Verwendet",
  ingredientsWord: "Zutaten",

  recipeNotFound: "Rezept nicht gefunden",
  recipeTitleFallback: "Rezept",
  timeMin: "Min",
  ingredientsTitle: "Zutaten",
  instructionsTitle: "Anleitung",
  instructionsUnavailable: "Rezeptanleitung nicht verfügbar.",

  heroBadge: "KI-gestützte echte Rezepte",
  heroTitle: "Koche intelligenter mit dem, was du bereits hast",
  heroDesc: "Lade Zutaten hoch, wähle aus was du hast und entdecke sofort echte Rezepte.",
  heroKicker: "Ein hellerer und raffinierterer Weg, alltägliche Zutaten in schöne Gerichte zu verwandeln.",
  heroPrimaryBtn: "Zutaten scannen",
  heroSecondaryBtn: "Kostenlos beitreten",
  heroStrip1Label: "Smarter Scan",
  heroStrip1Text: "Foto-basierte Zutaten-Erkennung",
  heroStrip2Label: "Nili's Rezeptarchiv",
  heroStrip2Text: "Alle veröffentlichten Rezepte entdecken",
  heroStrip3Label: "Mehrsprachig",
  heroStrip3Text: "Koche in deiner bevorzugten Sprache",

  galleryBtn: "Aus Galerie wählen",

  footerNote: "© 2026 Nili's Kitchen AI. Alle Rechte vorbehalten.",

  ingredientDetailsUnavailable: "Zutatendetails nicht verfügbar",
  timeUnavailable: "Zeit nicht verfügbar",
  serviceTemporaryUnavailable: "Der Dienst ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.",

  menuDashboard: "Dashboard",
  menuAddRecipe: "Rezept hinzufügen",
  menuFavorites: "Favoriten",
  menuLogout: "Abmelden",
  menuHowItWorks: "So funktioniert es",

  howTitle: "👋 So funktioniert Nili's Kitchen",
  howStep1: "1️⃣ Zutaten aus Kategorien auswählen.",
  howStep2: "2️⃣ Weitere Zutaten manuell hinzufügen.",
  howStep3: "3️⃣ Zutaten bestätigen und auf Rezepte tippen.",
  howStep4: "4️⃣ Lieblingsrezepte mit kostenlosem Konto speichern.",
  howStep5: "5️⃣ Creator können eigene Rezepte hochladen.",
  howStart: "Jetzt entdecken",
  howMoreInfo: "Mehr über Nili's Kitchen erfahren →",

  pleaseWait: "Bitte warten",

  loginButton: "Anmelden",

  signupTitle: "Kostenloses Konto erstellen",
  signupDesc: "Favoriten speichern, Rezepte synchronisieren und mehr Suchen freischalten.",
  signupContinue: "Weiter",
  continueGuest: "Als Gast fortfahren",
  signupTabText: "Registrieren",
  loginTabText: "Anmelden",

  smartScanTitle: "📸 Intelligenter Scan",
  smartScanDesc: "Zutaten in Möglichkeiten verwandeln",

  cookSmarterTitle: "🍳 Intelligenter kochen",
  cookSmarterDesc: "Rezepte aus den Zutaten, die du bereits hast",

  mobileFeature1Title: "📸 KI-Scan",
  mobileFeature1Desc: "Zutaten per Foto erkennen",
  mobileFeature2Title: "🥗 Intelligente Auswahl",
  mobileFeature2Desc: "Nach Kategorie auswählen",
  mobileFeature3Title: "❤️ Speichern",
  mobileFeature3Desc: "Favoriten behalten",

  joinNiliTitle: "Nili's Kitchen beitreten",
  joinNiliDesc: "Favoriten speichern, Rezepte hochladen und Creator-Funktionen freischalten.",
  joinNiliBtn: "Kostenlos beitreten",

  continueSelecting: "+ Zutaten weiter auswählen",


categories: {
  vegetables: "Gemüse",
  fruits: "Obst",
  meat: "Fleisch",
  seafood: "Meeresfrüchte",
  dairy_eggs: "Milchprodukte",
  grains_bakery: "Getreide",
  legumes: "Hülsenfrüchte",
  herbs_spices: "Kräuter",
  oils_fats: "Öle",
  sauces_condiments: "Saucen",
  nuts_seeds: "Nüsse",
  sweeteners_baking: "Backen"
}
},


ja: {
  appSubtitle: "AIレシピアシスタント",
  scanTitle: "写真で食材をスキャン",
  scanSubtitle: "写真をアップロードしてAIに食材を認識させましょう",
  manualTitle: "食材を手動で追加",
  manualPlaceholder: "食材を追加",
  categoryTitle: "カテゴリから食材を追加",

  selectedTitle: "選択した食材",
  selectedDesc: "レシピを探す前に食材を確認してください。",
  confirmIngredients: "食材を確認",
  getRecipes: "レシピを見る",
  clearSelected: "選択をクリア",
  emptySelected: "まだ食材が選択されていません。",

  signup: "登録",
  login: "ログイン",
  becomeCreator: "クリエイターになる",
  creatorDesc: "レシピを投稿し、将来的に報酬を獲得できます。",
  creatorLogin: "クリエイターログイン",
  creatorLoginDesc: "レシピ投稿ページへ進みます。",
  username: "ユーザー名",
  email: "メールアドレス",
  emailOrUsername: "メールまたはユーザー名",
  password: "パスワード",
  show: "表示",
  hide: "非表示",
  continue: "続ける",

  alertIngredient: "少なくとも1つの食材を追加してください。",
  alertConfirm: "まず食材を確認してください。",
  alertUsername: "ユーザー名を入力してください。",
  alertEmail: "メールアドレスを入力してください。",
  alertEmailOrUser: "メールまたはユーザー名を入力してください。",
  alertPassword: "パスワードを入力してください。",

  statusUpload: "食材の写真をアップロード",
  statusAdded: "食材を追加しました",
  statusAnalyzing: "写真を分析中...",
  statusDetected: "食材を検出しました",
  statusNoIngredients: "食材が見つかりません",
  statusAnalyzeFailed: "分析に失敗しました",

  loadingRecipes: "レシピを読み込み中...",
  recipesFailed: "レシピの取得に失敗しました",
  noRecipesFound: "レシピが見つかりません",

  usesIngredients: "使用",
  ingredientsWord: "食材",

  recipeNotFound: "レシピが見つかりません",
  recipeTitleFallback: "レシピ",
  timeMin: "分",
  ingredientsTitle: "材料",
  instructionsTitle: "作り方",
  instructionsUnavailable: "レシピの説明は利用できません。",

  heroBadge: "AIによる本物のレシピ",
  heroTitle: "今ある食材で賢く料理しよう",
  heroDesc: "食材をアップロードし、持っているものを選ぶだけで本物のレシピをすぐ発見。",
  heroKicker: "毎日の食材を美しい料理に変える、より明るく洗練された方法。",
  heroPrimaryBtn: "食材をスキャン",
  heroSecondaryBtn: "無料で参加",
  heroStrip1Label: "スマートスキャン",
  heroStrip1Text: "写真で食材を検出",
  heroStrip2Label: "Nili's レシピアーカイブ",
  heroStrip2Text: "公開中の全レシピを見る",
  heroStrip3Label: "多言語対応",
  heroStrip3Text: "好きな言語で料理できます",

  galleryBtn: "ギャラリーから選択",

  footerNote: "© 2026 Nili's Kitchen AI. 無断転載を禁じます。",

  ingredientDetailsUnavailable: "食材の詳細は利用できません",
  timeUnavailable: "時間情報なし",
  serviceTemporaryUnavailable: "技術的な問題によりサービスは一時的に利用できません。後ほどお試しください。",

  menuDashboard: "ダッシュボード",
  menuAddRecipe: "レシピ追加",
  menuFavorites: "お気に入り",
  menuLogout: "ログアウト",
  menuHowItWorks: "使い方",

  howTitle: "👋 Nili's Kitchen の使い方",
  howStep1: "1️⃣ カテゴリから食材を選択。",
  howStep2: "2️⃣ 必要なら手動で食材を追加。",
  howStep3: "3️⃣ 食材を確認してレシピを取得。",
  howStep4: "4️⃣ 無料アカウントでお気に入りを保存。",
  howStep5: "5️⃣ クリエイターは独自のレシピを投稿可能。",
  howStart: "始める",
  howMoreInfo: "Nili's Kitchenについて詳しく →",

  pleaseWait: "お待ちください",

  loginButton: "ログイン",

  signupTitle: "無料アカウントを作成",
  signupDesc: "お気に入りを保存し、レシピを同期してさらに多くの検索を利用できます。",
  signupContinue: "続ける",
  continueGuest: "ゲストとして続行",
  signupTabText: "登録",
  loginTabText: "ログイン",

  smartScanTitle: "📸 スマートスキャン",
  smartScanDesc: "食材を可能性に変える",

  cookSmarterTitle: "🍳 もっと賢く料理",
  cookSmarterDesc: "今ある食材からレシピを発見",

  mobileFeature1Title: "📸 AIスキャン",
  mobileFeature1Desc: "写真から食材を認識",
  mobileFeature2Title: "🥗 スマート選択",
  mobileFeature2Desc: "カテゴリ別に選択",
  mobileFeature3Title: "❤️ 保存",
  mobileFeature3Desc: "お気に入りを保存",

  joinNiliTitle: "Nili's Kitchenに参加",
  joinNiliDesc: "お気に入りを保存し、レシピを投稿してクリエイター機能を利用できます。",
  joinNiliBtn: "無料で参加",

  continueSelecting: "+ 食材の選択を続ける",

  categories: {
    vegetables: "野菜",
    fruits: "果物",
    meat: "肉",
    seafood: "魚介類",
    dairy_eggs: "乳製品",
    grains_bakery: "穀物",
    legumes: "豆類",
    herbs_spices: "ハーブ",
    oils_fats: "油脂",
    sauces_condiments: "ソース",
    nuts_seeds: "ナッツ",
    sweeteners_baking: "ベーキング"
  }
},

zh: {
  appSubtitle: "AI 食谱助手",
  scanTitle: "通过照片扫描食材",
  scanSubtitle: "上传照片，让 AI 识别食材",
  manualTitle: "手动添加食材",
  manualPlaceholder: "添加食材",
  categoryTitle: "按类别添加食材",

  selectedTitle: "已选择的食材",
  selectedDesc: "在查找食谱之前检查您的食材。",
  confirmIngredients: "确认食材",
  getRecipes: "获取食谱",
  clearSelected: "清除已选",
  emptySelected: "尚未选择任何食材。",

  signup: "注册",
  login: "登录",
  becomeCreator: "成为创作者",
  creatorDesc: "上传食谱，并在未来获得奖励。",
  creatorLogin: "创作者登录",
  creatorLoginDesc: "继续前往食谱上传页面。",
  username: "用户名",
  email: "电子邮箱",
  emailOrUsername: "邮箱或用户名",
  password: "密码",
  show: "显示",
  hide: "隐藏",
  continue: "继续",

  alertIngredient: "请至少添加一种食材。",
  alertConfirm: "请先确认食材。",
  alertUsername: "请输入用户名。",
  alertEmail: "请输入电子邮箱。",
  alertEmailOrUser: "请输入邮箱或用户名。",
  alertPassword: "请输入密码。",

  statusUpload: "上传食材照片",
  statusAdded: "食材已添加",
  statusAnalyzing: "正在分析照片...",
  statusDetected: "已识别食材",
  statusNoIngredients: "未找到食材",
  statusAnalyzeFailed: "分析失败",

  loadingRecipes: "正在加载食谱...",
  recipesFailed: "获取食谱失败",
  noRecipesFound: "未找到食谱",

  usesIngredients: "使用",
  ingredientsWord: "种食材",

  recipeNotFound: "未找到食谱",
  recipeTitleFallback: "食谱",
  timeMin: "分钟",
  ingredientsTitle: "食材",
  instructionsTitle: "制作步骤",
  instructionsUnavailable: "暂无食谱说明。",

  heroBadge: "AI 驱动的真实食谱",
  heroTitle: "利用现有食材更聪明地烹饪",
  heroDesc: "上传食材，选择您拥有的食材，即可立即发现真实食谱。",
  heroKicker: "一种更明亮、更精致的方式，把日常食材变成漂亮的菜肴。",
  heroPrimaryBtn: "扫描食材",
  heroSecondaryBtn: "免费加入",
  heroStrip1Label: "智能扫描",
  heroStrip1Text: "通过照片识别食材",
  heroStrip2Label: "Nili's 食谱档案",
  heroStrip2Text: "浏览全部已发布食谱",
  heroStrip3Label: "多语言",
  heroStrip3Text: "用你喜欢的语言烹饪",

  galleryBtn: "从图库选择",

  footerNote: "© 2026 Nili's Kitchen AI. 版权所有。",

  ingredientDetailsUnavailable: "暂无食材详情",
  timeUnavailable: "暂无时间信息",
  serviceTemporaryUnavailable: "由于技术问题，服务暂时不可用。请稍后再试。",

  menuDashboard: "控制面板",
  menuAddRecipe: "添加食谱",
  menuFavorites: "收藏夹",
  menuLogout: "退出登录",
  menuHowItWorks: "使用说明",

  howTitle: "👋 Nili's Kitchen 使用指南",
  howStep1: "1️⃣ 从分类中选择食材。",
  howStep2: "2️⃣ 如有需要，手动添加更多食材。",
  howStep3: "3️⃣ 确认食材并点击获取食谱。",
  howStep4: "4️⃣ 使用免费账户保存您喜欢的食谱。",
  howStep5: "5️⃣ 创作者可以上传自己的食谱。",
  howStart: "开始探索",
  howMoreInfo: "了解更多关于 Nili's Kitchen →",

  pleaseWait: "请稍候",

  loginButton: "登录",

  signupTitle: "创建免费账户",
  signupDesc: "保存收藏、同步食谱并解锁更多搜索功能。",
  signupContinue: "继续",
  continueGuest: "以游客身份继续",
  signupTabText: "注册",
  loginTabText: "登录",

  smartScanTitle: "📸 智能扫描",
  smartScanDesc: "让食材变成无限可能",

  cookSmarterTitle: "🍳 更聪明地烹饪",
  cookSmarterDesc: "利用现有食材发现食谱",

  mobileFeature1Title: "📸 AI 扫描",
  mobileFeature1Desc: "通过照片识别食材",
  mobileFeature2Title: "🥗 智能推荐",
  mobileFeature2Desc: "按类别选择",
  mobileFeature3Title: "❤️ 保存",
  mobileFeature3Desc: "保存收藏内容",

  joinNiliTitle: "加入 Nili's Kitchen",
  joinNiliDesc: "保存收藏、上传食谱并解锁创作者功能。",
  joinNiliBtn: "免费加入",

  continueSelecting: "+ 继续选择食材",

  categories: {
    vegetables: "蔬菜",
    fruits: "水果",
    meat: "肉类",
    seafood: "海鲜",
    dairy_eggs: "乳制品",
    grains_bakery: "谷物",
    legumes: "豆类",
    herbs_spices: "香草与香料",
    oils_fats: "油脂",
    sauces_condiments: "酱料",
    nuts_seeds: "坚果与种子",
    sweeteners_baking: "烘焙与甜味剂"
  }
}

};

Object.entries(window.NILI_I18N_EXTRA?.main || {}).forEach(([lang, values]) => {
  translations[lang] = { ...(translations[lang] || translations.en), ...values };
});

const mobilePicksCopy = {
  en:["NILI'S DAILY TABLE","A little inspiration for today"],
  tr:["NILI'NİN GÜNLÜK SOFRASI","Bugün için biraz ilham"],
  de:["NILIS TÄGLICHE TAFEL","Ein wenig Inspiration für heute"],
  fr:["LA TABLE DU JOUR DE NILI","Un peu d'inspiration pour aujourd'hui"],
  es:["LA MESA DIARIA DE NILI","Un poco de inspiración para hoy"],
  pt:["A MESA DIÁRIA DA NILI","Um pouco de inspiração para hoje"],
  ru:["ЕЖЕДНЕВНЫЙ СТОЛ НИЛИ","Немного вдохновения на сегодня"],
  ar:["مائدة نيلي اليومية","قليل من الإلهام لليوم"],
  ja:["NILIの今日の食卓","今日のための小さなひらめき"],
  zh:["NILI 今日餐桌","给今天一点灵感"]
};

function t(key){
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

const ingredientCache = {};

function ingredientCacheKey(item){
  return currentLang + ":" + String(item).trim().toLowerCase();
}

function ingredientLabel(item){
  if(currentLang === "en") return item;

  const key = ingredientCacheKey(item);

  return ingredientCache[key] || item;
}

async function translateSelectedIngredients(){

  if(currentLang === "en") return;

  const missing =
  selected.filter(item => !ingredientCache[ingredientCacheKey(item)]);

  if(!missing.length) return;

  try{

    const res = await fetch(`${API_BASE}/translate-ingredients`, {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        items:missing,
        lang:currentLang
      })
    });

    const data = await res.json();

    if(data && Array.isArray(data.items)){

      missing.forEach((item, index) => {
        ingredientCache[ingredientCacheKey(item)] =
        data.items[index] || item;
      });

      renderChecklist();
    }

 }catch(err){

  showUserFriendlyError("recipe-search", err);

  if(result){
    result.innerHTML = `
      <div class="loading-recipes-box">
        <strong>
          ${t("serviceTemporaryUnavailable") || "Service is temporarily unavailable."}
        </strong>
        <span>Please try again later.</span>
      </div>
    `;
  }

}

}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function setTextSelector(selector, value){
  const el = document.querySelector(selector);
  if(el) el.textContent = value;
}

function setPlaceholder(selector, text){
  const el = document.querySelector(selector);
  if(el){
    el.placeholder = text;
  }
}
 
function applyLanguage(){

  console.log("APPLY LANGUAGE:", currentLang);

  const langDropdown =
  document.getElementById("langSelect");

if(langDropdown){
  langDropdown.value = currentLang;
}
  
  console.log(
  "HERO FOUND:",
  document.querySelectorAll(".hero-title-text").length,
  t("heroTitle")
);

const langBtnText = document.getElementById("langBtnText");
const langBtnFlag = document.getElementById("langBtnFlag");

if(langBtnText){
  langBtnText.textContent = currentLang.toUpperCase();
}

if(langBtnFlag){
  langBtnFlag.src = `/flags/${currentLang}.svg`;
  langBtnFlag.style.visibility = "visible";
}

  document.documentElement.lang =
  currentLang;

  document.documentElement.dir =
  currentLang === "ar" ? "rtl" : "ltr";

 document.querySelectorAll(".hero-badge-text").forEach(el => {
  el.textContent = t("heroBadge");
});

document.querySelectorAll(".hero-title-text").forEach(el => {
  el.textContent = t("heroTitle");
});

document.querySelectorAll(".hero-desc-text").forEach(el => {
  el.textContent = t("heroDesc");
});

setText("heroKickerText", t("heroKicker"));
setText("heroPrimaryBtn", t("heroPrimaryBtn"));
setText("heroSecondaryBtn", t("heroSecondaryBtn"));
setText("heroStrip1Label", t("heroStrip1Label"));
setText("heroStrip1Text", t("heroStrip1Text"));
setText("heroStrip2Label", t("heroStrip2Label"));
setText("heroStrip2Text", t("heroStrip2Text"));
setText("niliArchiveEntryTitle", t("heroStrip2Label"));
setText("niliArchiveEntryText", t("heroStrip2Text"));
setText("heroStrip3Label", t("heroStrip3Label"));
setText("heroStrip3Text", t("heroStrip3Text"));

const niliArchiveEntry = document.getElementById("niliArchiveEntry");
if(niliArchiveEntry){
  niliArchiveEntry.href = `nili-archive.html?lang=${encodeURIComponent(currentLang)}`;
}

setText("appSubtitle", t("appSubtitle"));

const mobilePicksText = mobilePicksCopy[currentLang] || mobilePicksCopy.en;
setText("mobilePicksEyebrow", mobilePicksText[0]);
setText("mobilePicksTitle", mobilePicksText[1]);

setText("scanTitle", t("scanTitle"));
setText("statusText", t("scanSubtitle"));

const galleryBtnText = document.getElementById("galleryBtnText");

if(galleryBtnText){
  galleryBtnText.innerHTML = `🖼️ ${t("galleryBtn")}`;
}

setText(".manual-panel .panel-title", t("manualTitle"));
setPlaceholder("#manualInput", t("manualPlaceholder"));

  

setTextSelector(".selected-tray-header h2", t("selectedTitle"));
setTextSelector(".selected-tray-header p", t("selectedDesc"));
setTextSelector(".tray-confirm span", t("confirmIngredients"));
setTextSelector("#trayGetRecipesBtn", t("getRecipes"));
setTextSelector(".selected-clear-bottom", t("clearSelected"));

setTextSelector(".continue-selecting-btn", t("continueSelecting"));

setText("#signupTab", t("signup"));
setText("#loginTab", t("login"));

 
setText("categoryTitle", t("categoryTitle"));
 

setText("#creatorCardTitle", t("becomeCreator"));
setText("#creatorCardDesc", t("creatorDesc"));
setText("footerNoteText", t("footerNote"));
setText("userDashboardLink", t("menuDashboard"));
setText("userAddRecipeLink", t("menuAddRecipe"));
setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
setText("userContactBtn", "✉ " + t("menuContact"));
setText("userLogoutBtn", t("menuLogout"));

setText("contactEyebrow", t("contactEyebrow"));
setText("contactTitle", t("contactTitle"));
setText("contactDesc", t("contactDesc"));
setPlaceholder("#contactName", t("contactName"));
setPlaceholder("#contactEmail", t("contactEmail"));
setPlaceholder("#contactMessage", t("contactMessage"));
setText("contactSubmitBtn", t("contactSend"));

setText("howTitle", t("howTitle"));
setText("howStep1", t("howStep1"));
setText("howStep2", t("howStep2"));
setText("howStep3", t("howStep3"));
setText("howStep4", t("howStep4"));
setText("howStep5", t("howStep5"));
setText("howStartBtn", t("howStart"));

setText("#signupInviteTitle", t("signupTitle"));
setText("#signupInviteDesc", t("signupDesc"));

setText("#signupTab", t("signupTabText"));
setText("#loginTab", t("loginTabText"));

setText("#signupContinueBtn", t("signupContinue"));
setText("#continueGuestBtn", t("continueGuest"));

setText("userHowLink", t("menuHowItWorks"));

setText("howMoreInfoLink", t("howMoreInfo"));

setText("smartScanTitle", t("smartScanTitle"));
setText("smartScanDesc", t("smartScanDesc"));

setText("cookSmarterTitle", t("cookSmarterTitle"));
setText("cookSmarterDesc", t("cookSmarterDesc"));

setText("mobileFeature1Title", t("mobileFeature1Title"));
setText("mobileFeature1Desc", t("mobileFeature1Desc"));

setText("mobileFeature2Title", t("mobileFeature2Title"));
setText("mobileFeature2Desc", t("mobileFeature2Desc"));

setText("mobileFeature3Title", t("mobileFeature3Title"));
setText("mobileFeature3Desc", t("mobileFeature3Desc"));

setText("joinNiliTitle", t("joinNiliTitle"));
setText("joinNiliDesc", t("joinNiliDesc"));
setText("joinNiliBtn", t("joinNiliBtn"));

if(typeof applyWorldSearchLanguage === "function"){
  applyWorldSearchLanguage();
}


  const title =
  document.getElementById("creatorCardTitle");

  const desc =
  document.getElementById("creatorCardDesc");

  const signupTab =
  document.getElementById("signupTab");

  const mode =
  signupTab && signupTab.classList.contains("active")
    ? "signup"
    : "login";

  if(title && desc){

    if(mode === "signup"){
      title.textContent = t("becomeCreator");
      desc.textContent = t("creatorDesc");
    }else{
      title.textContent = t("creatorLogin");
      desc.textContent = t("creatorLoginDesc");
    }

  }

  if(!isUserLoggedIn()){
  setText("userMenuName", t("loginButton"));
}

  const usernameInput =
  document.getElementById("creatorUsernameInput");

  const emailInput =
  document.getElementById("creatorEmailInput");

  const passwordInput =
  document.getElementById("creatorPasswordInput");

  if(usernameInput){
    usernameInput.placeholder = t("username");
  }

  if(emailInput){
    emailInput.placeholder =
    mode === "signup"
      ? t("email")
      : t("emailOrUsername");
  }

  if(passwordInput){
    passwordInput.placeholder = t("password");
  }

  const passBtn =
  document.querySelector(".creator-password-wrap button");

  if(passBtn){
    passBtn.textContent =
    passwordInput && passwordInput.type === "text"
      ? t("hide")
      : t("show");
  }

  setText(".creator-continue-btn", t("continue"));

  document.querySelectorAll(".category-btn").forEach(btn => {

    const key =
    btn.dataset.category;

    if(!key) return;

    const icon =
btn.dataset.icon || "";

const shortCategoryLabels = {
  dairy_eggs: "Dairy",
  grains_bakery: "Grains",
  herbs_spices: "Herbs",
  oils_fats: "Oils",
  sauces_condiments: "Sauces",
  nuts_seeds: "Nuts",
  sweeteners_baking: "Baking"
};

let label =
translations[currentLang]?.categories?.[key] ||
translations.en.categories[key] ||
shortCategoryLabels[key] ||
key;

label =
String(label)
  .replace(/_/g, " ");

btn.innerHTML =
icon
  ? `<span class="cat-icon">${icon}</span> ${label}`
  : label;

  });

 /*if(
  typeof setCreatorMode === "function" &&
  !document.getElementById("signupInviteModal")?.style.display.includes("flex")
){
  setCreatorMode(window.creatorMode || "signup");
}*/

}

function saveState(){

  localStorage.setItem(
    "selectedIngredients",
    JSON.stringify(selected)
  );

}

function loadState(){

  const saved =
  localStorage.getItem("selectedIngredients");

  if(saved){

    try{
      selected = JSON.parse(saved) || [];
    }catch{
      selected = [];
    }

  }

  renderChecklist();

}

function addIngredient(item){

  if(!item) return;

  const resolved = window.NilisIngredients
    ? window.NilisIngredients.resolveIngredient(item)
    : { id:item };

  const cleanItem =
  String(resolved.id || item)
    .trim()
    .toLowerCase();

  if(!cleanItem) return;

  if(!selected.includes(cleanItem)){
    selected.push(cleanItem);
  }

  console.log("SELECTED UPDATED:", selected);

  saveState();
  renderChecklist();
  syncIngredientModalSelection();

}

window.removeIngredient = function(value){

  selected =
  selected.filter(item => item !== value);

  saveState();
  renderChecklist();
  syncIngredientModalSelection();

};

window.clearIngredients = function(){

  selected = [];

  saveState();
  renderChecklist();
  syncIngredientModalSelection();

};

const manualSuggestions = document.getElementById("manualSuggestions");

function normalizeIngredientLookup(value){
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function ingredientSearchValues(item){
  const names = item && typeof item.name === "object"
    ? Object.values(item.name)
    : [item?.name];
  const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
  return [item?.id, ...names, ...aliases].filter(Boolean);
}

function ingredientSearchText(item, fallback = ""){
  if(item && typeof item === "object"){
    return ingredientSearchValues(item)
      .map(normalizeIngredientLookup)
      .join(" ");
  }

  const found =
    window.allIngredients?.find(x =>
      x.id === item ||
      x.name?.en === item ||
      Object.values(x.name || {}).includes(item)
    );

  const values = found
    ? ingredientSearchValues(found)
    : [item, fallback];

  return values
    .filter(Boolean)
    .map(normalizeIngredientLookup)
    .join(" ");
}

function findManualIngredientMatches(query){
  const needle = normalizeIngredientLookup(query);
  if(!needle || !Array.isArray(window.allIngredients)) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);

  return window.allIngredients
    .map(item => {
      const values = ingredientSearchValues(item);
      const normalized = values.map(normalizeIngredientLookup);
      const exact = normalized.includes(needle);
      const starts = normalized.some(value => value.startsWith(needle));
      const searchable = normalized.join(" ");
      const contains = tokens.every(token => searchable.includes(token));
      return { item, exact, starts, contains };
    })
    .filter(match => match.exact || match.starts || match.contains)
    .sort((a,b) => Number(b.exact) - Number(a.exact) || Number(b.starts) - Number(a.starts))
    .slice(0,7)
    .map(match => match.item);
}

function closeManualSuggestions(){
  if(!manualSuggestions) return;
  manualSuggestions.innerHTML = "";
  manualSuggestions.classList.remove("open");
}

function chooseManualSuggestion(item){
  if(!manualInput || !item) return;
  manualInput.value = getIngredientLabel(item);
  manualInput.dataset.ingredientId = item.id;
  closeManualSuggestions();
}

function renderManualSuggestions(){
  if(!manualInput || !manualSuggestions) return;
  const matches = findManualIngredientMatches(manualInput.value);
  manualSuggestions.innerHTML = "";

  if(!matches.length){
    manualSuggestions.classList.remove("open");
    return;
  }

  matches.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "manual-suggestion-item";
    button.setAttribute("role", "option");
    const icon = document.createElement("span");
    icon.className = "manual-suggestion-icon";
    icon.textContent = "✦";

    const label = document.createElement("span");
    label.className = "manual-suggestion-label";
    label.textContent = getIngredientLabel(item);

    button.append(icon, label);
    button.addEventListener("mousedown", event => {
      event.preventDefault();
      chooseManualSuggestion(item);
    });
    manualSuggestions.appendChild(button);
  });

  manualSuggestions.classList.add("open");
}

async function normalizeUnknownIngredient(value){
  try{
    const response = await fetch(`${window.API_BASE}/normalize-ingredients`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ ingredients:[value], lang:currentLang })
    });
    const data = await response.json();
    const normalized = data?.ingredients?.[0]?.canonicalEn;
    return String(normalized || value).trim().toLowerCase();
  }catch(error){
    console.warn("Manual ingredient normalization failed:", error);
    return String(value).trim().toLowerCase();
  }
}

window.addManual = async function(){
  const rawValue = manualInput?.value.trim();
  if(!rawValue) return;

  let ingredientId = manualInput.dataset.ingredientId || "";

  if(!ingredientId){
    const matches = findManualIngredientMatches(rawValue);
    const exactMatch = matches
      .find(item => ingredientSearchValues(item)
        .some(value => normalizeIngredientLookup(value) === normalizeIngredientLookup(rawValue)));
    ingredientId = exactMatch?.id || matches[0]?.id || await normalizeUnknownIngredient(rawValue);
  }

  addIngredient(ingredientId);
  manualInput.value = "";
  delete manualInput.dataset.ingredientId;
  closeManualSuggestions();

  if(statusText){
    statusText.innerText = t("statusAdded");
  }
};

if(manualInput){
  manualInput.addEventListener("input", async () => {
    delete manualInput.dataset.ingredientId;
    if(!window.allIngredients?.length){
      await (allIngredientsLoadPromise || (allIngredientsLoadPromise = loadAllIngredients()));
    }
    renderManualSuggestions();
  });

  manualInput.addEventListener("keydown", e => {
    if(e.key === "Escape"){
      closeManualSuggestions();
      return;
    }

    if(e.key === "Tab" && manualSuggestions?.classList.contains("open")){
      const firstMatch = findManualIngredientMatches(manualInput.value)[0];
      if(firstMatch) chooseManualSuggestion(firstMatch);
      return;
    }

    if(e.key === "Enter"){
      e.preventDefault();
      const firstMatch = findManualIngredientMatches(manualInput.value)[0];
      if(firstMatch && !manualInput.dataset.ingredientId){
        chooseManualSuggestion(firstMatch);
      }
      window.addManual();
    }
  });

  document.addEventListener("click", event => {
    if(!event.target.closest(".manual-input-wrap")) closeManualSuggestions();
  });
}

function resetUploadStatus(){

  if(statusText){
    statusText.innerText = t("statusUpload");
  }

  if(bar){
    bar.style.width = "0%";
  }

  const photoCamera = document.getElementById("photoCamera");
  const photoGallery = document.getElementById("photoGallery");

  if(photoCamera){
    photoCamera.value = "";
  }

  if(photoGallery){
    photoGallery.value = "";
  }

}

async function handlePhotoUpload(e){

  const file = e.target.files[0];

  if(!file) return;

  if(statusText){
    statusText.innerText = t("statusAnalyzing");
  }

  if(bar){
    bar.style.width = "35%";
  }

  const formData = new FormData();

  formData.append("photo", file);

  try{

    if(bar){
      bar.style.width = "65%";
    }

    const res =
    await fetch(`${API_BASE}/analyze`, {
      method:"POST",
      body:formData
    });

    const data =
    await res.json();

    if(!res.ok){

      if(statusText){
        statusText.innerText =
        data.details || "Analyze failed";
      }

      if(bar){
        bar.style.width = "0%";
      }

      return;

    }

    if(data.ingredients && data.ingredients.length){

      data.ingredients.forEach(item => {

  const resolved = window.NilisIngredients
    ? window.NilisIngredients.resolveIngredient(item)
    : { id:item };

  addIngredient(resolved.id);

});

      renderChecklist();

      if(statusText){
        statusText.innerText = t("statusDetected");
      }

      if(bar){
        bar.style.width = "100%";
      }

      setTimeout(() => {
        resetUploadStatus();
      }, 1200);

    } else {

      if(statusText){
        statusText.innerText = t("statusNoIngredients");
      }

      setTimeout(() => {
        resetUploadStatus();
      }, 1200);

    }

  }catch(err){

  showUserFriendlyError("photo-analyze", err);

  if(bar){
    bar.style.width = "0%";
  }

  setTimeout(() => {
    resetUploadStatus();
  }, 2500);

}

}

const photo = document.getElementById("photo");
const photoGallery = document.getElementById("photoGallery");

if(photo){
  photo.addEventListener("change", handlePhotoUpload);
}

if(photoGallery){
  photoGallery.addEventListener("change", handlePhotoUpload);
}

window.toggleCategories = function(){

  const grid =
  document.getElementById("categoryGrid");

  const arrow =
  document.getElementById("categoryArrow");

  if(!grid) return;

  grid.classList.toggle("collapsed");

  if(arrow){
    arrow.innerText =
    grid.classList.contains("collapsed")
    ? "▼"
    : "▲";
  }

};

const ingredientModalUiCopy = {
  en:{subtitle:"Select the ingredients you want to use",selected:"Selected",count:n=>`${n} ingredients selected`,clear:"Clear",done:"Complete selection",empty:"No ingredients selected yet"},
  tr:{subtitle:"Tarifinde kullanacağın malzemeleri seç",selected:"Seçilenler",count:n=>`${n} malzeme seçildi`,clear:"Temizle",done:"Seçimi tamamla",empty:"Henüz malzeme seçilmedi"},
  de:{subtitle:"Wähle die Zutaten für dein Rezept",selected:"Ausgewählt",count:n=>`${n} Zutaten ausgewählt`,clear:"Löschen",done:"Auswahl bestätigen",empty:"Noch keine Zutaten ausgewählt"},
  fr:{subtitle:"Choisissez les ingrédients de votre recette",selected:"Sélectionnés",count:n=>`${n} ingrédients sélectionnés`,clear:"Effacer",done:"Terminer la sélection",empty:"Aucun ingrédient sélectionné"},
  es:{subtitle:"Elige los ingredientes de tu receta",selected:"Seleccionados",count:n=>`${n} ingredientes seleccionados`,clear:"Limpiar",done:"Completar selección",empty:"Aún no hay ingredientes"},
  pt:{subtitle:"Escolha os ingredientes da sua receita",selected:"Selecionados",count:n=>`${n} ingredientes selecionados`,clear:"Limpar",done:"Concluir seleção",empty:"Nenhum ingrediente selecionado"},
  ru:{subtitle:"Выберите ингредиенты для рецепта",selected:"Выбрано",count:n=>`Выбрано ингредиентов: ${n}`,clear:"Очистить",done:"Завершить выбор",empty:"Ингредиенты еще не выбраны"},
  ar:{subtitle:"اختر المكونات التي ستستخدمها في وصفتك",selected:"المحدد",count:n=>`تم اختيار ${n} مكونات`,clear:"مسح",done:"إتمام الاختيار",empty:"لم يتم اختيار مكونات بعد"},
  ja:{subtitle:"レシピに使う食材を選んでください",selected:"選択済み",count:n=>`${n}個の食材を選択`,clear:"クリア",done:"選択を完了",empty:"食材はまだ選択されていません"},
  zh:{subtitle:"选择食谱中要使用的食材",selected:"已选择",count:n=>`已选择 ${n} 种食材`,clear:"清除",done:"完成选择",empty:"尚未选择食材"}
};

function ingredientLabelForValue(value){
  const button = ingredientModalItems?.querySelector(
    `.modal-ingredient-btn[data-value="${CSS.escape(String(value))}"]`
  );
  if(button){
    return button.querySelector("span")?.textContent?.trim() || value;
  }

  const item = window.allIngredients?.find(entry =>
    String(entry?.id || "").trim().toLowerCase() === String(value).trim().toLowerCase()
  );
  return item ? getIngredientLabel(item) : String(value).replace(/[_-]+/g, " ");
}

function renderIngredientModalSummary(){
  const ui = ingredientModalUiCopy[currentLang] || ingredientModalUiCopy.en;
  if(ingredientModalSubtitle) ingredientModalSubtitle.textContent = ui.subtitle;
  if(ingredientModalSelectedTitle) ingredientModalSelectedTitle.textContent = ui.selected;
  if(ingredientModalSelectedCount) ingredientModalSelectedCount.textContent = selected.length;
  if(ingredientModalFooterCount) ingredientModalFooterCount.textContent = ui.count(selected.length);
  if(ingredientModalClear) ingredientModalClear.textContent = ui.clear;
  if(ingredientModalDone) ingredientModalDone.textContent = ui.done;

  if(ingredientModalSelectedChips){
    ingredientModalSelectedChips.innerHTML = selected.length
      ? selected.map((value, index) => `
          <button type="button" data-remove-ingredient="${escapeHtml(value)}" class="ingredient-selected-chip ingredient-selected-chip-${index % 3}">
            <span>${escapeHtml(ingredientLabelForValue(value))}</span>
            <strong aria-hidden="true">×</strong>
          </button>
        `).join("")
      : `<span class="ingredient-selected-empty">${escapeHtml(ui.empty)}</span>`;
  }
}

async function openIngredientModal(categoryKey, items){

  if(!ingredientModal || !ingredientModalItems) return;

  activeCategoryKey = categoryKey;
let safeItems =
  Array.isArray(items) && items.length
    ? items
    : [];

if(!safeItems.length){

  safeItems =
    window.categoryIngredients?.[categoryKey] ||
    [];

}

if(!safeItems.length && window.NilisIngredients){

  safeItems = Object.values(window.NilisIngredients.ingredients || {})
    .filter(item => item.category === categoryKey);

}

 if(!safeItems.length){

  safeItems =
    window.categoryIngredients?.[categoryKey] ||
    CATEGORY_DATA[categoryKey] ||
    [];

}

 if(ingredientModalTitle){

  const categoryLabel =
    translations[currentLang]?.categories?.[categoryKey] ||
    translations.en.categories?.[categoryKey] ||
    categoryKey;

  const categoryIcon =
    document.querySelector(
      `.category-btn[data-category="${categoryKey}"]`
    )?.dataset.icon || "";

  ingredientModalTitle.innerHTML =
    `${categoryIcon} ${categoryLabel}`;
}

  if(!safeItems.length){

    ingredientModalItems.innerHTML = `
      <p style="font-weight:800;color:#777;">
        No ingredients found.
      </p>
    `;

    ingredientModal.style.display = "flex";
    return;

  }

  ingredientModalItems.innerHTML =
  safeItems.map((item, index) => {

    const itemObj =
      typeof item === "object"
        ? item
        : window.allIngredients?.find(x =>
            x.id === item || x.name?.en === item
          );

    const value = String(
      itemObj?.id || item || ""
    ).trim().toLowerCase();

    const label =
      itemObj
        ? getIngredientLabel(itemObj)
        : getIngredientLabel(item);

    const searchText =
      ingredientSearchText(itemObj || item, label);

    const isSelected =
      selected.includes(value);

   return `
  <button
    class="modal-ingredient-btn ${isSelected ? "active" : ""}"
    type="button"
    data-value="${value}"
    data-index="${index}"
    data-search="${searchText.replace(/"/g, "&quot;")}"
    aria-pressed="${isSelected ? "true" : "false"}"
  >
    <span>${label}</span>
    <strong class="ingredient-mark">${isSelected ? "✓" : "+"}</strong>
  </button>
`;

  }).join("");

  const searchCopy = {
    en:["Search ingredients","No ingredients found."],
    tr:["Malzeme ara","Malzeme bulunamadı."],
    de:["Zutaten suchen","Keine Zutaten gefunden."],
    fr:["Rechercher un ingrédient","Aucun ingrédient trouvé."],
    es:["Buscar ingredientes","No se encontraron ingredientes."],
    pt:["Buscar ingredientes","Nenhum ingrediente encontrado."],
    ru:["Поиск ингредиентов","Ингредиенты не найдены."],
    ar:["ابحث عن المكونات","لم يتم العثور على مكونات."],
    ja:["食材を検索","食材が見つかりません。"],
    zh:["搜索食材","未找到食材。"]
  };
  const localizedSearch = searchCopy[currentLang] || searchCopy.en;

  if(ingredientModalSearch){
    ingredientModalSearch.value = "";
    ingredientModalSearch.placeholder = localizedSearch[0];
  }

  if(ingredientSearchEmpty){
    ingredientSearchEmpty.textContent = localizedSearch[1];
    ingredientSearchEmpty.classList.remove("show");
  }

  filterIngredientModalItems();
  renderIngredientModalSummary();

  ingredientModal.style.display = "flex";
  translateVisibleIngredientItems(safeItems, categoryKey);

}

async function translateVisibleIngredientItems(items, categoryKey){
  if(!currentLang || currentLang === "en" || !Array.isArray(items) || !items.length) return;

  const englishNames = items
    .map(item => typeof item === "object" ? (item.name?.en || item.id) : String(item))
    .filter(Boolean);
  const unresolved = [...new Set(englishNames.filter((name, index) => {
    const item = items[index];
    const localName = typeof item === "object" ? item.name?.[currentLang] : "";
    return !localName || normalizeIngredientLookup(localName) === normalizeIngredientLookup(name);
  }))];

  if(!unresolved.length) return;

  try{
    const response = await fetch(`${window.API_BASE}/translate-ingredients`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({items:unresolved,lang:currentLang})
    });
    if(!response.ok) return;
    const data = await response.json();
    if(!Array.isArray(data.items)) return;

    if(!ingredientTranslationCache[currentLang]){
      ingredientTranslationCache[currentLang] = {};
    }
    unresolved.forEach((name,index) => {
      ingredientTranslationCache[currentLang][name] = data.items[index] || name;
    });

    if(activeCategoryKey !== categoryKey) return;
    ingredientModalItems?.querySelectorAll(".modal-ingredient-btn").forEach(button => {
      const item = window.allIngredients.find(entry => entry.id === button.dataset.value);
      if(!item) return;
      const label = getIngredientLabel(item);
      const labelElement = button.querySelector("span");
      if(labelElement) labelElement.textContent = label;
      button.dataset.search = ingredientSearchText(item,label);
    });
    filterIngredientModalItems();
    renderIngredientModalSummary();
  }catch(error){
    console.warn("Ingredient category translation skipped:",error);
  }
}

window.closeIngredientModal = function(){

  activeCategoryKey =
  null;

  if(ingredientModal){
    ingredientModal.style.display = "none";
  }

  returnHomeAfterOverlayClose();

};

function filterIngredientModalItems(){
  if(!ingredientModalSearch || !ingredientModalItems) return;

  const query =
  normalizeIngredientLookup(ingredientModalSearch.value);
  const queryTokens = query.split(/\s+/).filter(Boolean);

  let visibleCount = 0;

  ingredientModalItems
    .querySelectorAll(".modal-ingredient-btn")
    .forEach(button => {
      const label =
      button.dataset.search ||
      normalizeIngredientLookup(button.textContent);

      const visible =
      !query || queryTokens.every(token => label.includes(token));

      button.hidden = !visible;
      button.classList.toggle("is-filtered-out", !visible);
      button.style.display = visible ? "" : "none";

      if(visible){
        visibleCount++;
      }
    });

  if(ingredientSearchEmpty){
    ingredientSearchEmpty.classList.toggle(
      "show",
      visibleCount === 0
    );
  }
}

if(ingredientModalSearch){
  ingredientModalSearch.addEventListener(
    "input",
    filterIngredientModalItems
  );
}

document
.querySelectorAll(".category-btn")
.forEach(btn => {

  btn.addEventListener("click", async () => {

    const key =
    btn.dataset.category;

    let items = [];

    if(!window.allIngredients?.length){
      await (allIngredientsLoadPromise || (allIngredientsLoadPromise = loadAllIngredients()));
    }

if(window.categoryIngredients?.[key]?.length){

  items = window.categoryIngredients[key];

}else if(window.NilisIngredients){

  items = Object.values(window.NilisIngredients.ingredients || {})
    .filter(item => item.category === key);

}else{

  items = CATEGORY_DATA[key] || [];

}

    document
    .querySelectorAll(".category-btn")
    .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    openIngredientModal(
      key,
      items
    );

  });

});

if(ingredientModalItems){

  ingredientModalItems.addEventListener("click", e => {

    const btn =
    e.target.closest(".modal-ingredient-btn");

    if(!btn) return;

    const value =
    String(btn.dataset.value || "").trim().toLowerCase();

    if(selected.includes(value)){

      selected =
      selected.filter(item => item !== value);

      btn.classList.remove("active");

    } else {

      selected.push(value);

      btn.classList.add("active");

    }

    const mark = btn.querySelector(".ingredient-mark");
    const isActive = selected.includes(value);
    btn.setAttribute("aria-pressed", String(isActive));
    if(mark) mark.textContent = isActive ? "✓" : "+";

    saveState();
    renderChecklist();
    renderIngredientModalSummary();

  });

}

if(ingredientModalSelectedChips){
  ingredientModalSelectedChips.addEventListener("click", event => {
    const chip = event.target.closest("[data-remove-ingredient]");
    if(!chip) return;
    const value = String(chip.dataset.removeIngredient || "").trim().toLowerCase();
    selected = selected.filter(item => item !== value);
    saveState();
    renderChecklist();
    syncIngredientModalSelection();
    renderIngredientModalSummary();
  });
}

if(ingredientModalClear){
  ingredientModalClear.addEventListener("click", () => {
    selected = [];
    saveState();
    renderChecklist();
    syncIngredientModalSelection();
    renderIngredientModalSummary();
  });
}

if(ingredientModalDone){
  ingredientModalDone.addEventListener("click", closeIngredientModal);
}

function continueSelectingIngredients(){
  closeSelectedTray();

  const hero = document.getElementById("hero");
  if(hero){
    hero.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

 async function getRecipesFromIngredients(ingredientsForRecipe){

  console.log("GET RECIPES START", ingredientsForRecipe);

  lastRecipeIngredients = [...ingredientsForRecipe];

  if(
    !ingredientsForRecipe ||
    !ingredientsForRecipe.length
  ){
    alert(t("alertIngredient"));
    return;
  }

  console.log("FETCH START");

  document.body.classList.add("show-recipes-page");

const floatingLang = document.querySelector(".floating-lang");
if(floatingLang && window.innerWidth <= 980){
  floatingLang.style.display = "none";
}

result.style.display = "grid";
result.style.visibility = "visible";
result.style.opacity = "1";
result.innerHTML = `
  <div class="loading-recipes">
    <h2>${t("loadingRecipes")}</h2>
    <p>${t("pleaseWait")}</p>
  </div>
`;

  try{

    const normalizeRes =
await fetch(`${window.API_BASE}/normalize-ingredients`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    ingredients: ingredientsForRecipe,
    lang: currentLang
  })
});

const normalizeData =
await normalizeRes.json();

let normalizedIngredientsForRecipe =
ingredientsForRecipe;

if (
  normalizeData.success &&
  Array.isArray(normalizeData.ingredients)
) {
  normalizedIngredientsForRecipe =
  normalizeData.ingredients
    .map(item => item.canonicalEn)
    .filter(Boolean);
}

console.log(
  "NORMALIZED INGREDIENTS FOR SEARCH:",
  normalizedIngredientsForRecipe
);

const res = await fetch(`${window.API_BASE}/recipes`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    ingredients: normalizedIngredientsForRecipe,
    originalIngredients: ingredientsForRecipe,
    lang: currentLang,
    limit: 12,
    offset: 0
  })
});

    const data =
    await res.json();

    

    console.log("FETCH STATUS:", res.status);
    console.log("FETCH DATA:", data);

    if(!res.ok){

      console.error(data);

      result.innerHTML =
`<p>${t("recipesFailed")}</p>`;

      return;

    }

    /*
      Backend bazen array dönebilir:
      [ ...recipes ]

      Yeni sistemde bazen object dönebilir:
      { recipes: [...], hasMore: true }
    */

    const recipes =
  Array.isArray(data)
    ? data
    : data.recipes || data.results || data.meals || data.data || [];

    currentRecipes =
    recipes;

    if(
      !Array.isArray(recipes)
      ||
      !recipes.length
    ){

      result.innerHTML =
`<p>${t("noRecipesFound")}</p>`;

      return;

    }
visibleRecipeCount = 6;

 
    renderRecipes(recipes);

    document.body.classList.add("show-recipes-page");

const hero = document.querySelector(".hero");
const content = document.querySelector(".content");

if(hero){
  hero.style.display = "none";
}

setTimeout(() => {
  if(result){
    result.style.display = "grid";
    result.style.visibility = "visible";
    result.style.opacity = "1";

    result.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if(content && result){
  content.scrollTo({
    top: result.offsetTop,
    behavior: "smooth"
  });
}
}, 100);

  }catch(err){

  showUserFriendlyError("recipe-search", err);

  if(result){
    result.innerHTML = `
      <div class="loading-recipes-box">
        <strong>
          ${t("serviceTemporaryUnavailable") || "Service is temporarily unavailable."}
        </strong>
        <span>Please try again later.</span>
      </div>
    `;
  }

}

}

 

async function confirmAndGetRecipes(){

  if(!checkGuestSearchLimit()){
  return;
}

  const confirmCheck =
  document.getElementById("confirmCheck");

  if(!selected.length){
    alert(t("alertIngredient"));
    return;
  }

  if(
    !confirmCheck ||
    !confirmCheck.checked
  ){
    alert(t("alertConfirm"));
    return;
  }

  const ingredientsForRecipe =
  [...selected];

  closeSelectedTray();

  selected = [];

  renderChecklist();

  await getRecipesFromIngredients(
    ingredientsForRecipe
  );

}


function getAllRecipeIngredients(recipe){
  const source =
    Array.isArray(recipe.extendedIngredients) && recipe.extendedIngredients.length
      ? recipe.extendedIngredients
      : [
          ...(Array.isArray(recipe.usedIngredients) ? recipe.usedIngredients : []),
          ...(Array.isArray(recipe.missedIngredients) ? recipe.missedIngredients : [])
        ];

  const seen = new Set();

  return source.filter(item => {
    const label = String(
      item?.original || item?.originalName || item?.name || item || ""
    ).trim();
    const key = label.toLocaleLowerCase();

    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateRecipePageHeader(visibleCount){
  const copyByLang = {
    en:["CURATED FOR YOUR KITCHEN","Recipes worth cooking","personal selections"],
    tr:["MUTFAĞIN İÇİN ÖZENLE SEÇİLDİ","Pişirmeye değer tarifler","kişisel tarif seçimi"],
    de:["FÜR DEINE KÜCHE AUSGEWÄHLT","Rezepte, die sich lohnen","persönliche Empfehlungen"],
    fr:["SÉLECTIONNÉ POUR VOTRE CUISINE","Des recettes à cuisiner","sélections personnalisées"],
    es:["SELECCIONADO PARA TU COCINA","Recetas que vale la pena cocinar","selecciones personales"],
    pt:["SELECIONADO PARA SUA COZINHA","Receitas que valem a pena","seleções pessoais"],
    ru:["ПОДОБРАНО ДЛЯ ВАШЕЙ КУХНИ","Рецепты, которые стоит приготовить","персональных рецептов"],
    ar:["مختارة لمطبخك","وصفات تستحق الطهي","اختيارات شخصية"],
    ja:["あなたのキッチンに厳選","作る価値のあるレシピ","件のおすすめ"],
    zh:["为你的厨房精选","值得烹饪的食谱","份个性推荐"]
  };
  const copy = copyByLang[currentLang] || copyByLang.en;
  const eyebrow = document.getElementById("recipePageEyebrow");
  const title = document.getElementById("recipePageTitle");
  const summary = document.getElementById("recipePageSummary");

  if(eyebrow) eyebrow.textContent = copy[0];
  if(title) title.textContent = copy[1];
  if(summary) summary.textContent = `${visibleCount} ${copy[2]}`;
}

const worldSearchCopy = {
  en:{open:"Explore world cuisines",eyebrow:"WORLD CUISINES",title:"What would you like to cook?",intro:"Search by dish name, choose a cuisine, or select a category.",dish:"Dish name",placeholder:"Pizza, ramen, baklava...",find:"Find recipes",cuisine:"Choose a cuisine",category:"Category",required:"Enter a dish name or choose an option.",loading:"Searching our recipe collection...",empty:"No recipes found. Try another search.",error:"Recipes could not be loaded. Please try again."},
  tr:{open:"Dünya mutfaklarını keşfet",eyebrow:"DÜNYA MUTFAKLARI",title:"Ne pişirmek istersin?",intro:"Yemek adıyla ara, bir ülke mutfağı veya kategori seç.",dish:"Yemek adı",placeholder:"Pizza, ramen, baklava...",find:"Tarifleri bul",cuisine:"Bir mutfak seç",category:"Kategori",required:"Yemek adı yaz veya bir seçenek belirle.",loading:"Tarif arşivimiz taranıyor...",empty:"Tarif bulunamadı. Başka bir arama deneyin.",error:"Tarifler yüklenemedi. Lütfen tekrar deneyin."},
  de:{open:"Weltküchen entdecken",eyebrow:"KÜCHEN DER WELT",title:"Was möchten Sie kochen?",intro:"Nach Gericht suchen oder Küche und Kategorie wählen.",dish:"Gericht",placeholder:"Pizza, Ramen, Baklava...",find:"Rezepte finden",cuisine:"Küche wählen",category:"Kategorie",required:"Gericht eingeben oder Option wählen.",loading:"Rezeptsammlung wird durchsucht...",empty:"Keine Rezepte gefunden.",error:"Rezepte konnten nicht geladen werden."},
  fr:{open:"Explorer les cuisines du monde",eyebrow:"CUISINES DU MONDE",title:"Que souhaitez-vous cuisiner ?",intro:"Recherchez un plat ou choisissez une cuisine et une catégorie.",dish:"Nom du plat",placeholder:"Pizza, ramen, baklava...",find:"Trouver des recettes",cuisine:"Choisir une cuisine",category:"Catégorie",required:"Saisissez un plat ou choisissez une option.",loading:"Recherche dans nos recettes...",empty:"Aucune recette trouvée.",error:"Impossible de charger les recettes."},
  es:{open:"Explorar cocinas del mundo",eyebrow:"COCINAS DEL MUNDO",title:"¿Qué te gustaría cocinar?",intro:"Busca un plato o elige cocina y categoría.",dish:"Nombre del plato",placeholder:"Pizza, ramen, baklava...",find:"Buscar recetas",cuisine:"Elegir cocina",category:"Categoría",required:"Escribe un plato o elige una opción.",loading:"Buscando en nuestras recetas...",empty:"No se encontraron recetas.",error:"No se pudieron cargar las recetas."},
  pt:{open:"Explorar cozinhas do mundo",eyebrow:"COZINHAS DO MUNDO",title:"O que gostaria de cozinhar?",intro:"Pesquise um prato ou escolha cozinha e categoria.",dish:"Nome do prato",placeholder:"Pizza, ramen, baklava...",find:"Encontrar receitas",cuisine:"Escolher cozinha",category:"Categoria",required:"Digite um prato ou escolha uma opção.",loading:"Pesquisando nossas receitas...",empty:"Nenhuma receita encontrada.",error:"Não foi possível carregar as receitas."},
  ru:{open:"Кухни мира",eyebrow:"КУХНИ МИРА",title:"Что вы хотите приготовить?",intro:"Найдите блюдо или выберите кухню и категорию.",dish:"Название блюда",placeholder:"Пицца, рамен, баклава...",find:"Найти рецепты",cuisine:"Выберите кухню",category:"Категория",required:"Введите блюдо или выберите вариант.",loading:"Ищем в коллекции рецептов...",empty:"Рецепты не найдены.",error:"Не удалось загрузить рецепты."},
  ar:{open:"استكشف مطابخ العالم",eyebrow:"مطابخ العالم",title:"ماذا تريد أن تطبخ؟",intro:"ابحث باسم الطبق أو اختر المطبخ والفئة.",dish:"اسم الطبق",placeholder:"بيتزا، رامن، بقلاوة...",find:"ابحث عن وصفات",cuisine:"اختر المطبخ",category:"الفئة",required:"اكتب اسم طبق أو اختر خياراً.",loading:"جارٍ البحث في مجموعة الوصفات...",empty:"لم يتم العثور على وصفات.",error:"تعذر تحميل الوصفات."},
  ja:{open:"世界の料理を探す",eyebrow:"世界の料理",title:"何を作りたいですか？",intro:"料理名で検索するか、国とカテゴリーを選んでください。",dish:"料理名",placeholder:"ピザ、ラーメン、バクラヴァ...",find:"レシピを探す",cuisine:"国の料理を選ぶ",category:"カテゴリー",required:"料理名を入力するか、項目を選んでください。",loading:"レシピを検索しています...",empty:"レシピが見つかりません。",error:"レシピを読み込めませんでした。"},
  zh:{open:"探索世界美食",eyebrow:"世界美食",title:"你想做什么？",intro:"按菜名搜索，或选择国家和类别。",dish:"菜名",placeholder:"披萨、拉面、果仁蜜饼...",find:"查找食谱",cuisine:"选择国家美食",category:"类别",required:"请输入菜名或选择一个选项。",loading:"正在搜索食谱库...",empty:"未找到食谱。",error:"无法加载食谱，请重试。"}
};

const worldCuisineIds = ["turkey","italy","mexico","india","china","japan","france","greece","usa","thailand"];
const worldCuisineLabels = {
  en:["Turkey","Italy","Mexico","India","China","Japan","France","Greece","USA","Thailand"],
  tr:["Türkiye","İtalya","Meksika","Hindistan","Çin","Japonya","Fransa","Yunanistan","ABD","Tayland"],
  de:["Türkei","Italien","Mexiko","Indien","China","Japan","Frankreich","Griechenland","USA","Thailand"],
  fr:["Turquie","Italie","Mexique","Inde","Chine","Japon","France","Grèce","États-Unis","Thaïlande"],
  es:["Turquía","Italia","México","India","China","Japón","Francia","Grecia","EE. UU.","Tailandia"],
  pt:["Turquia","Itália","México","Índia","China","Japão","França","Grécia","EUA","Tailândia"],
  ru:["Турция","Италия","Мексика","Индия","Китай","Япония","Франция","Греция","США","Таиланд"],
  ar:["تركيا","إيطاليا","المكسيك","الهند","الصين","اليابان","فرنسا","اليونان","أمريكا","تايلاند"],
  ja:["トルコ","イタリア","メキシコ","インド","中国","日本","フランス","ギリシャ","アメリカ","タイ"],
  zh:["土耳其","意大利","墨西哥","印度","中国","日本","法国","希腊","美国","泰国"]
};
const worldCategories = ["main course","side dish","dessert","appetizer","salad","soup","breakfast","pasta","seafood"];
const worldCategoryLabels = {
  en:["Main course","Side dish","Dessert","Appetizer","Salad","Soup","Breakfast","Pasta","Seafood"],
  tr:["Ana yemek","Yan yemek","Tatlı","Başlangıç","Salata","Çorba","Kahvaltı","Makarna","Deniz ürünleri"],
  de:["Hauptgericht","Beilage","Dessert","Vorspeise","Salat","Suppe","Frühstück","Pasta","Meeresfrüchte"],
  fr:["Plat principal","Accompagnement","Dessert","Entrée","Salade","Soupe","Petit-déjeuner","Pâtes","Fruits de mer"],
  es:["Plato principal","Guarnición","Postre","Entrante","Ensalada","Sopa","Desayuno","Pasta","Mariscos"],
  pt:["Prato principal","Acompanhamento","Sobremesa","Entrada","Salada","Sopa","Café da manhã","Massa","Frutos do mar"],
  ru:["Основное блюдо","Гарнир","Десерт","Закуска","Салат","Суп","Завтрак","Паста","Морепродукты"],
  ar:["طبق رئيسي","طبق جانبي","حلوى","مقبلات","سلطة","شوربة","إفطار","معكرونة","مأكولات بحرية"],
  ja:["メイン料理","副菜","デザート","前菜","サラダ","スープ","朝食","パスタ","シーフード"],
  zh:["主菜","配菜","甜点","开胃菜","沙拉","汤","早餐","意大利面","海鲜"]
};
let selectedWorldCuisine = "";
let selectedWorldCategory = "";
let lastWorldSearchPayload = null;
let currentRecipeSearchMeta = null;

function getWorldSearchCopy(){
  return worldSearchCopy[currentLang] || worldSearchCopy.en;
}

function applyWorldSearchLanguage(){
  const copy = getWorldSearchCopy();
  const values = {worldSearchOpenText:copy.open,worldSearchEyebrow:copy.eyebrow,worldSearchTitle:copy.title,worldSearchIntro:copy.intro,worldQueryLabel:copy.dish,worldSearchSubmit:copy.find,worldCuisineLabel:copy.cuisine,worldCategoryLabel:copy.category};
  Object.entries(values).forEach(([id,value]) => { const node=document.getElementById(id); if(node) node.textContent=value; });
  const query=document.getElementById("worldRecipeQuery");
  if(query) query.placeholder=copy.placeholder;
  document.querySelectorAll("[data-world-open-label]").forEach(node => { node.textContent=copy.open; });
  renderWorldSearchOptions();
}

function renderWorldSearchOptions(){
  const cuisineBox=document.getElementById("worldCuisineOptions");
  const categoryBox=document.getElementById("worldCategoryOptions");
  const cuisineLabels=worldCuisineLabels[currentLang] || worldCuisineLabels.en;
  const categoryLabels=worldCategoryLabels[currentLang] || worldCategoryLabels.en;
  if(cuisineBox){
    cuisineBox.innerHTML=worldCuisineIds.map((id,index) => `<button type="button" class="world-option ${selectedWorldCuisine===id?"selected":""}" data-world-cuisine="${id}">${cuisineLabels[index]}</button>`).join("");
  }
  if(categoryBox){
    categoryBox.innerHTML=worldCategories.map((value,index) => `<button type="button" class="world-category-option ${selectedWorldCategory===value?"selected":""}" data-world-category="${value}">${categoryLabels[index]}</button>`).join("");
  }
}

function openWorldSearch(cuisine=""){
  const params=new URLSearchParams({lang:currentLang || "en"});
  if(cuisine) params.set("cuisine",cuisine);
  window.location.href=`/world-cuisines.html?${params.toString()}`;
}

function returnHomeAfterOverlayClose(){
  const modalOpen =
    modal && modal.style.display === "flex";

  const recipeDetailOpen =
    document.body.classList.contains("recipe-full-page-open");

  if(
    !modalOpen &&
    !recipeDetailOpen &&
    document.body.classList.contains("show-recipes-page")
  ){
    backToHome();
  }
}

function closeWorldSearch(){
  const modal=document.getElementById("worldSearchModal");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("world-search-active");
}

async function searchWorldRecipes(){
  const copy=getWorldSearchCopy();
  const query=document.getElementById("worldRecipeQuery")?.value.trim() || "";
  const status=document.getElementById("worldSearchStatus");
  const submit=document.getElementById("worldSearchSubmit");
  if(!query && !selectedWorldCuisine && !selectedWorldCategory){ if(status) status.textContent=copy.required; return; }
  if(status) status.textContent=copy.loading;
  if(submit) submit.disabled=true;
  try{
    const payloadToSend = {query,cuisine:selectedWorldCuisine,category:selectedWorldCategory,lang:currentLang,limit:24};
    lastWorldSearchPayload = payloadToSend;
    currentRecipeSearchMeta = null;
    const response=await fetch(`${window.API_BASE}/discover-recipes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payloadToSend)});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Search failed");
    if(!Array.isArray(payload.recipes) || !payload.recipes.length){ if(status) status.textContent=copy.empty; return; }
    currentRecipeSearchMeta = payload.meta || null;
    recipePage=1;
    lastRecipeIngredients=[];
    closeWorldSearch();
    renderRecipes(payload.recipes);
  }catch(error){
    console.error("WORLD RECIPE SEARCH ERROR:",error);
    if(status) status.textContent=copy.error;
  }finally{
    if(submit) submit.disabled=false;
  }
}

async function loadSimilarWorldRecipes(){
  if(!lastWorldSearchPayload) return;
  const actions=document.getElementById("recipeResultActions");
  const button=document.getElementById("showSimilarRecipesBtn");
  const labels={
    tr:"Benzer tarifler aranıyor...",
    en:"Finding similar recipes...",
    de:"Ähnliche Rezepte werden gesucht...",
    fr:"Recherche de recettes similaires...",
    es:"Buscando recetas similares...",
    pt:"Buscando receitas semelhantes...",
    ru:"Ищем похожие рецепты...",
    ar:"جارٍ البحث عن وصفات مشابهة...",
    ja:"似たレシピを検索中...",
    zh:"正在查找相似食谱..."
  };
  if(button){
    button.disabled=true;
    button.textContent=labels[currentLang] || labels.en;
  }
  try{
    const response=await fetch(`${window.API_BASE}/discover-recipes`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...lastWorldSearchPayload,includeExternal:true,limit:24})
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Search failed");
    if(Array.isArray(payload.recipes) && payload.recipes.length){
      currentRecipeSearchMeta = payload.meta || null;
      renderRecipes(payload.recipes);
    }
  }catch(error){
    console.error("SIMILAR WORLD RECIPE SEARCH ERROR:",error);
    if(actions){
      actions.insertAdjacentHTML("beforeend",`<span class="recipe-action-error">${(getWorldSearchCopy().error || "Recipes could not be loaded.")}</span>`);
    }
  }finally{
    if(button) button.disabled=false;
  }
}

document.addEventListener("click", event => {
  const cuisine=event.target.closest("[data-world-cuisine]");
  const category=event.target.closest("[data-world-category]");
  if(cuisine){ selectedWorldCuisine=selectedWorldCuisine===cuisine.dataset.worldCuisine?"":cuisine.dataset.worldCuisine; renderWorldSearchOptions(); }
  if(category){ selectedWorldCategory=selectedWorldCategory===category.dataset.worldCategory?"":category.dataset.worldCategory; renderWorldSearchOptions(); }
  if(event.target.id==="worldSearchModal") closeWorldSearch();
});

document.addEventListener("keydown", event => {
  if(event.key==="Escape" && document.getElementById("worldSearchModal")?.classList.contains("open")) closeWorldSearch();
  if(event.key==="Enter" && event.target.id==="worldRecipeQuery") searchWorldRecipes();
});

document.addEventListener("DOMContentLoaded", applyWorldSearchLanguage);
document.addEventListener("DOMContentLoaded", loadMobileNiliPicks);

function placeMobileWorldSearch(){
  const bar=document.querySelector(".mobile-world-search-bar");
  const mobileHero=document.querySelector(".mobile-hero-big");
  const content=document.getElementById("content");
  if(!bar) return;
  if(window.innerWidth<=980 && mobileHero && bar.nextElementSibling!==mobileHero){
    mobileHero.parentElement.insertBefore(bar,mobileHero);
  }else if(window.innerWidth>980 && content && bar.parentElement!==content){
    content.prepend(bar);
  }
}

document.addEventListener("DOMContentLoaded", placeMobileWorldSearch);
window.addEventListener("resize", placeMobileWorldSearch);

function renderRecipes(data, preservePage = false){

  currentRecipes = data;
  if(!preservePage) recipePage = 1;

  console.log("RENDER RECIPES COUNT:", data.length);

  if(!result){
    console.error("Recipe result element not found");
    return;
  }

  localStorage.setItem("niliLastRecipes", JSON.stringify(data));

  if(location.hash !== "#recipes"){
    history.replaceState(null, "", "#recipes");
  }

  document.body.classList.add("show-recipes-page");
  document.body.classList.add("hide-mobile-top-menu");

  if(window.innerWidth <= 980){
  const floatingLang = document.querySelector(".floating-lang");
  if(floatingLang){
    floatingLang.style.display = "none";
  }
}

  result.style.display = "grid";
  result.style.visibility = "visible";
  result.style.opacity = "1";

const totalPages = Math.min(2, Math.max(1, Math.ceil(data.length / recipesPerPage)));
recipePage = Math.min(Math.max(recipePage, 1), totalPages);
const pageStart = (recipePage - 1) * recipesPerPage;
const visibleRecipes = data.slice(pageStart, pageStart + recipesPerPage);

const openRecipeLabels = {
  en:"View recipe", tr:"Tarifi gör", de:"Rezept ansehen", fr:"Voir la recette",
  es:"Ver receta", pt:"Ver receita", ru:"Открыть рецепт", ar:"عرض الوصفة",
  ja:"レシピを見る", zh:"查看食谱"
};
const openRecipeLabel = openRecipeLabels[currentLang] || openRecipeLabels.en;

updateRecipePageHeader(visibleRecipes.length);

  result.innerHTML =
    visibleRecipes.map((recipe, index) => {

      const allIngredients = getAllRecipeIngredients(recipe);
      const usedCount =
        allIngredients.length ||
        recipe.usedIngredientCount ||
        recipe.usedCount ||
        0;

      const visibleIngredients =
        allIngredients.length
          ? allIngredients
              .slice(0, 6)
              .map(item => `
                <li class="recipe-ingredient-row">
                  <span class="recipe-ingredient-bullet">•</span>
                  <span>${item.original || item.originalName || item.name || item}</span>
                </li>
              `)
              .join("")
          : `<li class="recipe-ingredient-row">
               <span class="recipe-ingredient-bullet">•</span>
               <span>${t("ingredientDetailsUnavailable")}</span>
             </li>`;

      const countryBadge =
        getRecipeCountryBadge(recipe);

      const cuisineLabel =
        getRecipeCuisineLabel(recipe);

      return `
        <div class="card recipe-card" data-recipe-id="${recipe.id}">

          <h3 class="recipe-card-title">${recipe.title || t("recipeTitleFallback")}</h3>

          <div class="recipe-card-image-wrap">

            <button
              class="favorite-btn"
              data-recipe-id="${recipe.id}"
              type="button"
            >🤍</button>

            <img
              ${recipeImageAttrs(recipe, pageStart + index)}
              alt="${recipe.title || t("recipeTitleFallback")}"
            >
          </div>

          <div class="card-body recipe-card-body">

            ${
              countryBadge
                ? `<div class="recipe-card-country-wrap">${countryBadge}</div>`
                : cuisineLabel
                  ? `<div class="recipe-card-cuisine">${cuisineLabel}</div>`
                  : ""
            }

            <div class="recipe-card-meta">
              <span class="recipe-meta-pill recipe-time">
              ${
                recipe.readyInMinutes
                  ? `⏱ ${recipe.timeEstimated ? "~" : ""}${recipe.readyInMinutes} ${t("timeMin")}`
                  : `⏱ ${recipe.timeLabel || t("timeUnavailable") || "Time unavailable"}`
              }
              </span>

              <span class="recipe-meta-pill ingredients-count">
                🥗 ${t("usesIngredients")} ${usedCount} ${t("ingredientsWord")}
              </span>

              ${
                recipe.servings
                  ? `<span class="recipe-meta-pill recipe-servings">👥 ${recipe.servings}</span>`
                  : ""
              }
            </div>

            <div class="recipe-card-ingredients-panel">
              <div class="recipe-card-ingredients-title">🥗 ${t("ingredientsTitle")}</div>
              <ul class="recipe-ingredients-list">
                ${visibleIngredients}
              </ul>
            </div>

            <button class="recipe-card-open-btn" type="button" data-open-recipe="${recipe.id}">
              <span>${openRecipeLabel}</span><span aria-hidden="true">→</span>
            </button>

          </div>

        </div>
      `;

    }).join("");

    const oldActions =
  document.getElementById("recipeResultActions");

if(oldActions){
  oldActions.remove();
}

const shouldOfferSimilar =
  currentRecipeSearchMeta?.fallbackMode === "nili-exact" &&
  lastWorldSearchPayload;
const similarLabels = {
  tr:"Benzer tarifleri de göster",
  en:"Show similar recipes",
  de:"Ähnliche Rezepte zeigen",
  fr:"Voir des recettes similaires",
  es:"Ver recetas similares",
  pt:"Mostrar receitas semelhantes",
  ru:"Показать похожие рецепты",
  ar:"عرض وصفات مشابهة",
  ja:"似たレシピも表示",
  zh:"显示相似食谱"
};
const navigationLabels = {
  tr:{previous:"← Geri",home:"⌂ Ana sayfa",next:"İleri →"},
  en:{previous:"← Back",home:"⌂ Home",next:"Next →"},
  de:{previous:"← Zurück",home:"⌂ Startseite",next:"Weiter →"},
  fr:{previous:"← Retour",home:"⌂ Accueil",next:"Suivant →"},
  es:{previous:"← Atrás",home:"⌂ Inicio",next:"Siguiente →"},
  pt:{previous:"← Voltar",home:"⌂ Início",next:"Seguinte →"},
  ru:{previous:"← Назад",home:"⌂ Главная",next:"Далее →"},
  ar:{previous:"→ السابق",home:"⌂ الرئيسية",next:"التالي ←"},
  ja:{previous:"← 戻る",home:"⌂ ホーム",next:"次へ →"},
  zh:{previous:"← 上一页",home:"⌂ 首页",next:"下一页 →"}
};
const navLabels = navigationLabels[currentLang] || navigationLabels.en;

result.insertAdjacentHTML("afterend", `
  <div id="recipeResultActions" class="recipe-result-actions">

    ${recipePage > 1
      ? `<button type="button" class="recipe-back-btn" onclick="previousRecipePage()">${navLabels.previous}</button>`
      : ""
    }

    <button type="button" class="recipe-home-btn" onclick="backToHome()">
      ${navLabels.home}
    </button>

    ${
      shouldOfferSimilar
        ? `<button
            id="showSimilarRecipesBtn"
            type="button"
            class="show-more-recipes-btn"
            onclick="loadSimilarWorldRecipes()">
            ${similarLabels[currentLang] || similarLabels.en}
          </button>`
        : ""
    }

    ${
      recipePage < totalPages
        ? `
          <button
            type="button"
            class="recipe-next-btn"
            onclick="nextRecipePage()">
            ${navLabels.next}
          </button>
        `
        : ""
    }

  </div>
`);

  renderFavoritesUI();

  setTimeout(() => {
    result.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);

}



if(result){

  result.addEventListener("click", e => {

    const favBtn = e.target.closest(".favorite-btn");

if(favBtn){
  e.preventDefault();
  e.stopPropagation();
  toggleFavorite(favBtn.dataset.recipeId);
  return;
}

    const card =
    e.target.closest(".card");

    if(!card) return;

    const id =
    card.dataset.recipeId;

    localStorage.setItem("niliOpenRecipeId", id);

    history.replaceState(null, "", "#recipe-" + id);

    openRecipe(id);

  });

}

document.addEventListener("click", event => {
  const mobilePick = event.target.closest("[data-mobile-pick-id]");
  if(!mobilePick) return;

  const recipeId = mobilePick.dataset.mobilePickId;
  if(!currentMobileNiliPicks.length) return;

  renderRecipes(currentMobileNiliPicks);

  requestAnimationFrame(() => {
    localStorage.setItem("niliOpenRecipeId", recipeId);
    history.replaceState(null, "", "#recipe-" + recipeId);
    openRecipe(recipeId);
  });
});

const persistentSidebar = document.getElementById("sidebar");
if(persistentSidebar){
  persistentSidebar.addEventListener("click", event => {
    if(!document.body.classList.contains("show-recipes-page")) return;

    const actionable = event.target.closest(
      ".upload-card, .category-btn, .manual button, #manualInput, #joinNiliBtn"
    );

    if(actionable){
      backToHome();
    }
  }, true);
}

function trackCreatorRecipeOpen(recipe){
  if(!recipe || recipe.source !== "nili_creator"){
    return;
  }

  const isLocalPreview =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.startsWith("192.168.") ||
    location.hostname.startsWith("10.") ||
    location.hostname.startsWith("172.");

  // Live Server watches the workspace. Updating the local click-stat JSON on
  // every recipe open makes it reload the page and reopen the recipe forever.
  if(isLocalPreview){
    return;
  }

  const recipeId =
    recipe.sourceId ||
    recipe.id;

  if(!recipeId || trackedCreatorRecipeOpens.has(String(recipeId))){
    return;
  }

  trackedCreatorRecipeOpens.add(String(recipeId));

  fetch(`${window.API_BASE}/creator-recipe-click/${encodeURIComponent(recipeId)}`, {
    method:"POST"
  }).catch(err => {
    console.warn("Creator bonus tracking skipped:", err);
  });
}

async function ensureRecipeDetailLanguage(recipe){
  if(
    recipe?._localizedLang===String(currentLang || "en").toLowerCase() &&
    recipe?._detailsLocalized===true
  ){
    return recipe;
  }

  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`${window.API_BASE}/localize-recipe-detail`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({recipe,lang:currentLang}),
      signal:controller.signal
    });
    const payload=await response.json();
    if(!response.ok || !payload?.recipe){
      throw new Error(payload?.error || "Recipe translation failed");
    }
    const localized=payload.recipe;
    currentRecipes=currentRecipes.map(item=>
      String(item.id)===String(recipe.id) ? localized : item
    );
    currentMobileNiliPicks=currentMobileNiliPicks.map(item=>
      String(item.id)===String(recipe.id) ? localized : item
    );
    return localized;
  }finally{
    clearTimeout(timeoutId);
  }
}

async function openRecipe(id){

  activeRecipeId = id;

  let recipe =
  currentRecipes.find(
    item => String(item.id) === String(id)
  );

  if(!recipe){
    if(recipeFullPageBody){
      recipeFullPageBody.innerHTML = `<div class="recipe-page-empty"><h2>${t("recipeNotFound") || "Recipe not found"}</h2></div>`;
    }
    if(recipeFullPage) recipeFullPage.setAttribute("aria-hidden", "false");
    document.body.classList.add("recipe-full-page-open");
    return;

  }

  try{
    if(
      recipe?._localizedLang!==String(currentLang || "en").toLowerCase() ||
      recipe?._detailsLocalized!==true
    ){
      if(recipeFullPageBody){
        recipeFullPageBody.innerHTML=`<div class="recipe-page-empty"><h2>${t("loadingRecipes") || "Loading recipe..."}</h2></div>`;
      }
      if(recipeFullPage) recipeFullPage.setAttribute("aria-hidden","false");
      document.body.classList.add("recipe-full-page-open");
      recipe=await ensureRecipeDetailLanguage(recipe);
    }
  }catch(error){
    console.warn("RECIPE DETAIL LANGUAGE FALLBACK:",error);
  }

  trackCreatorRecipeOpen(recipe);

  const allIngredients = getAllRecipeIngredients(recipe);
  const ingredientHtml =
    allIngredients.length
      ? allIngredients.map(item => `
          <li class="recipe-detail-ingredient">
            <span class="recipe-detail-bullet">🥄</span>
            <span>${item.original || item.originalName || item.name || item}</span>
          </li>
        `).join("")
      : `<li class="recipe-detail-ingredient">
             <span class="recipe-detail-bullet">🥄</span>
             <span>${t("ingredientDetailsUnavailable")}</span>
         </li>`;

  const instructionSteps = getInstructionSteps(recipe);

  const instructionsHtml = instructionSteps.length
    ? instructionSteps
        .map((step, index) => `
          <li class="recipe-detail-step">
            <span class="recipe-step-number">${index + 1}</span>
            <span class="recipe-step-text">${escapeHtml(step)}</span>
          </li>
        `).join("")
    : `<li class="recipe-detail-step">
         <span class="recipe-step-number">•</span>
         <span>${t("instructionsUnavailable")}</span>
       </li>`;

  const servingsValue =
    recipe.servings ||
    recipe.yields ||
    recipe.aggregateLikes && recipe.servings ? recipe.servings : "";

  const countryBadge =
  getRecipeCountryBadge(recipe);

  const cuisineLabel =
  getRecipeCuisineLabel(recipe);

  const detailNavigationLabels = {
    tr:{back:"Geri",home:"Ana sayfa",brand:"NILI'S KITCHEN TARİFİ"},
    en:{back:"Back",home:"Home",brand:"A NILI'S KITCHEN RECIPE"},
    de:{back:"Zurück",home:"Startseite",brand:"EIN NILI'S KITCHEN REZEPT"},
    fr:{back:"Retour",home:"Accueil",brand:"UNE RECETTE NILI'S KITCHEN"},
    es:{back:"Atrás",home:"Inicio",brand:"UNA RECETA DE NILI'S KITCHEN"},
    pt:{back:"Voltar",home:"Início",brand:"UMA RECEITA NILI'S KITCHEN"},
    ru:{back:"Назад",home:"Главная",brand:"РЕЦЕПТ NILI'S KITCHEN"},
    ar:{back:"رجوع",home:"الرئيسية",brand:"وصفة من NILI'S KITCHEN"},
    ja:{back:"戻る",home:"ホーム",brand:"NILI'S KITCHEN レシピ"},
    zh:{back:"返回",home:"首页",brand:"NILI'S KITCHEN 食谱"}
  };
  const detailNav = detailNavigationLabels[currentLang] || detailNavigationLabels.en;

  const viewerFlag = recipeFlagInfo(recipe);
  const approvedCardCandidates = getRecipeCardImageCandidates(recipe);
  const isLocalRecipePreview =
    location.port === "5500" ||
    String(window.API_BASE || "").includes(":3000") ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1" ||
    location.hostname.startsWith("192.168.") ||
    location.hostname.startsWith("10.") ||
    location.hostname.startsWith("172.");
  const hasApprovedRecipeCard =
    approvedCardCandidates.length > 0 && !isLocalRecipePreview;
  if(recipeFullPage){
    recipeFullPage.classList.toggle("recipe-detail-mode", !hasApprovedRecipeCard);
  }

  if(hasApprovedRecipeCard){
  recipeFullPageBody.innerHTML = `
    <article class="recipe-card-viewer">
      <nav class="recipe-card-viewer-nav" aria-label="Recipe navigation">
        <button type="button" onclick="closeModal()"><span aria-hidden="true">←</span> ${detailNav.back}</button>
        <button type="button" onclick="closeRecipeToHome()">${detailNav.home} <span aria-hidden="true">⌂</span></button>

      </nav>
      <div class="recipe-card-viewer-stage">
        <img
          class="recipe-card-viewer-image"
          ${recipeCardImageAttrs(recipe)}
          alt="${escapeHtml(recipe.title || "Recipe")}"
        >
        <span class="recipe-card-country-badge">
          ${viewerFlag.src ? `<img src="${escapeHtml(viewerFlag.src)}" alt="">` : ""}
          <strong>${escapeHtml(cuisineLabel || viewerFlag.label || "World")}</strong>
        </span>
      </div>
    </article>
  `;

  if(recipeFullPage){
    recipeFullPage.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("recipe-full-page-open");
  history.replaceState(null, "", `#recipe-${encodeURIComponent(id)}`);
  window.scrollTo({top:0, behavior:"instant"});
  return;
  }

  recipeFullPageBody.innerHTML = `
    <article class="recipe-story-page">
      <nav class="recipe-story-nav" aria-label="Recipe navigation">
        <button type="button" onclick="closeModal()"><span aria-hidden="true">←</span> ${detailNav.back}</button>
        <button type="button" onclick="closeRecipeToHome()">${detailNav.home} <span aria-hidden="true">⌂</span></button>
      </nav>

      <div class="recipe-story-frame">
        <header class="recipe-story-heading">
          <span class="recipe-detail-wordmark">${detailNav.brand}</span>
          <h1>${escapeHtml(recipe.title || "Recipe")}</h1>

          <div class="recipe-story-origin">
            ${countryBadge}
          </div>
        </header>

        <div class="recipe-story-lead">
          <div class="recipe-detail-hero">
            <img
              ${recipeImageAttrs(recipe)}
              alt="${escapeHtml(recipe.title || "Recipe")}"
            >
          </div>

          <div class="recipe-story-summary">
            <div class="recipe-detail-meta">
              <span class="recipe-detail-pill">
                <small>⏱</small>
                <strong>${recipe.readyInMinutes ? `${recipe.readyInMinutes} ${t("timeMin")}` : `${recipe.timeLabel || t("timeUnavailable") || "-"}`}</strong>
              </span>
              ${servingsValue ? `<span class="recipe-detail-pill"><small>👥</small><strong>${servingsValue}</strong></span>` : ""}
              <span class="recipe-detail-pill"><small>🥗</small><strong>${allIngredients.length}</strong></span>
            </div>

            <div class="recipe-detail-ingredients-panel">
              <h2>🥗 ${t("ingredientsTitle")}</h2>
              <ul class="recipe-detail-ingredients">
                ${ingredientHtml}
              </ul>
            </div>
          </div>
        </div>

        <section class="recipe-detail-content">
          <div class="recipe-story-section-title">
            <span>👨‍🍳</span>
            <h2>${t("instructionsTitle")}</h2>
          </div>
          <ol class="recipe-detail-steps">
            ${instructionsHtml}
          </ol>
        </section>

        <footer class="recipe-story-footer">
          <span>Nili's Kitchen</span>
          <button type="button" onclick="closeModal()">← ${detailNav.back}</button>
        </footer>
      </div>
    </article>
  `;

  if(recipeFullPage){
    recipeFullPage.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("recipe-full-page-open");
  history.replaceState(null, "", `#recipe-${encodeURIComponent(id)}`);
  window.scrollTo({top:0, behavior:"instant"});
  return;

  /* Legacy modal markup retained below temporarily for compatibility. */
  modalBody.innerHTML = `
    <div class="recipe-detail-shell recipe-detail-portrait">
      <div class="recipe-detail-fixed">
        <div class="recipe-detail-heading">
        <span class="recipe-detail-wordmark">NILI'S KITCHEN</span>
        <h1>${recipe.title || "Recipe"}</h1>

        ${countryBadge}
        </div>

        <div class="recipe-detail-hero">
          <img
            ${recipeImageAttrs(recipe)}
            alt="${recipe.title || "Recipe"}"
          >
        </div>

        <div class="recipe-detail-meta">
          <span class="recipe-detail-pill">
            ⏱ ${
              recipe.readyInMinutes
                ? `${recipe.readyInMinutes} ${t("timeMin")}`
                : `${recipe.timeLabel || t("timeUnavailable") || "Time unavailable"}`
            }
          </span>
          ${
            servingsValue
              ? `<span class="recipe-detail-pill">👥 ${servingsValue}</span>`
              : ""
          }
        </div>

        <div class="recipe-detail-ingredients-panel">
        <h2>🥗 ${t("ingredientsTitle")}</h2>
        <ul class="recipe-detail-ingredients recipe-detail-ingredients-fixed">
          ${ingredientHtml}
        </ul>
        </div>
      </div>

      <div class="recipe-detail-content">
        <h2>👨‍🍳 ${t("instructionsTitle")}</h2>
        <ol class="recipe-detail-steps">
          ${instructionsHtml}
        </ol>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  document.body.classList.add("recipe-modal-open");

  const modalContent = modal.querySelector(".modal-content");
  if(modalContent){
    modalContent.classList.add("recipe-portrait-modal");
  }
  if(modalContent) modalContent.scrollTop = 0;
  if(modalBody) modalBody.scrollTop = 0;

  requestAnimationFrame(() => {
    if(modalContent) modalContent.scrollTop = 0;
    if(modalBody) modalBody.scrollTop = 0;
  });

}

function getRecipeCuisineLabel(recipe){
  return (
    recipe.country ||
    recipe.cuisine ||
    recipe.category ||
    ""
  );
}

const recipeCountryLabels = {
  turkey:{tr:"Türkiye",en:"Turkey",de:"Türkei",fr:"Turquie",es:"Turquía",pt:"Turquia",ru:"Турция",ar:"تركيا",ja:"トルコ",zh:"土耳其"},
  italy:{tr:"İtalya",en:"Italy",de:"Italien",fr:"Italie",es:"Italia",pt:"Itália",ru:"Италия",ar:"إيطاليا",ja:"イタリア",zh:"意大利"},
  mexico:{tr:"Meksika",en:"Mexico",de:"Mexiko",fr:"Mexique",es:"México",pt:"México",ru:"Мексика",ar:"المكسيك",ja:"メキシコ",zh:"墨西哥"},
  india:{tr:"Hindistan",en:"India",de:"Indien",fr:"Inde",es:"India",pt:"Índia",ru:"Индия",ar:"الهند",ja:"インド",zh:"印度"},
  china:{tr:"Çin",en:"China",de:"China",fr:"Chine",es:"China",pt:"China",ru:"Китай",ar:"الصين",ja:"中国",zh:"中国"},
  japan:{tr:"Japonya",en:"Japan",de:"Japan",fr:"Japon",es:"Japón",pt:"Japão",ru:"Япония",ar:"اليابان",ja:"日本",zh:"日本"},
  france:{tr:"Fransa",en:"France",de:"Frankreich",fr:"France",es:"Francia",pt:"França",ru:"Франция",ar:"فرنسا",ja:"フランス",zh:"法国"},
  greece:{tr:"Yunanistan",en:"Greece",de:"Griechenland",fr:"Grèce",es:"Grecia",pt:"Grécia",ru:"Греция",ar:"اليونان",ja:"ギリシャ",zh:"希腊"},
  thailand:{tr:"Tayland",en:"Thailand",de:"Thailand",fr:"Thaïlande",es:"Tailandia",pt:"Tailândia",ru:"Таиланд",ar:"تايلاند",ja:"タイ",zh:"泰国"},
  usa:{tr:"ABD",en:"USA",de:"USA",fr:"États-Unis",es:"EE. UU.",pt:"EUA",ru:"США",ar:"أمريكا",ja:"アメリカ",zh:"美国"}
};

const recipeCountryFlagRules = [
  { key:"turkey", code:"tr", match:["turk", "turkish", "turkiye", "turkey", "türkiye"] },
  { key:"italy", code:"it", match:["ital", "italian", "italy", "italia"] },
  { key:"mexico", code:"mx", match:["mexic", "mexico", "méxico"] },
  { key:"india", code:"in", match:["indian", "india", "hindistan"] },
  { key:"china", code:"cn", match:["chinese", "china", "çin"] },
  { key:"japan", code:"jp", match:["japan", "japanese", "japon"] },
  { key:"france", code:"fr", match:["french", "france", "fransa"] },
  { key:"greece", code:"gr", match:["greek", "greece", "yunan"] },
  { key:"thailand", code:"th", match:["thai", "thailand", "tayland"] },
  { key:"usa", code:"us", match:["american", "usa", "united states", "abd"] },
  { key:"morocco", code:"ma", match:["morocco", "moroccan", "fas"] },
  { key:"uzbekistan", code:"uz", match:["uzbek", "uzbekistan", "özbek"] },
  { key:"kazakhstan", code:"kz", match:["kazakh", "kazakhstan", "kazak"] },
  { key:"azerbaijan", code:"az", match:["azerbaijan", "azeri", "azerbaycan"] },
  { key:"georgia", code:"ge", match:["georgia", "georgian", "gürcü"] },
  { key:"korea", code:"kr", match:["korea", "korean", "kore"] },
  { key:"vietnam", code:"vn", match:["vietnam", "vietnamese"] },
  { key:"spain", code:"es", match:["spain", "spanish", "ispanya"] },
  { key:"portugal", code:"pt", match:["portugal", "portuguese"] },
  { key:"germany", code:"de", match:["germany", "german", "almanya"] },
  { key:"iran", code:"ir", match:["iran", "persian", "iranian"] },
  { key:"lebanon", code:"lb", match:["lebanon", "lebanese", "lübnan"] },
  { key:"syria", code:"sy", match:["syria", "syrian", "suriye"] },
  { key:"egypt", code:"eg", match:["egypt", "egyptian", "mısır"] },
  { key:"croatia", code:"hr", match:["croatia", "croatian", "hırvat"] },
  { key:"indonesia", code:"id", match:["indonesia", "indonesian", "endonezya"] },
  { key:"argentina", code:"ar", match:["argentina", "argentinian", "arjantin"] },
  { key:"albania", code:"al", match:["albania", "albanian", "arnavut"] },
  { key:"australia", code:"au", match:["australia", "australian", "avustralya"] },
  { key:"austria", code:"at", match:["austria", "austrian", "avusturya"] },
  { key:"belgium", code:"be", match:["belgium", "belgian", "belçika"] },
  { key:"bolivia", code:"bo", match:["bolivia", "bolivian", "bolivya"] },
  { key:"bosnia", code:"ba", match:["bosnia", "bosnian", "bosna"] },
  { key:"brazil", code:"br", match:["brazil", "brazilian", "brezilya"] },
  { key:"bulgaria", code:"bg", match:["bulgaria", "bulgarian", "bulgar"] },
  { key:"uk", code:"gb", match:["united kingdom", "british", "britanya", "birleşik krallık", "ingiltere", "ingiliz", "galler"] },
  { key:"algeria", code:"dz", match:["algeria", "algerian", "cezayir"] },
  { key:"czechia", code:"cz", match:["czech", "çek"] },
  { key:"denmark", code:"dk", match:["denmark", "danish", "danimarka"] },
  { key:"ecuador", code:"ec", match:["ecuador", "ecuadorian", "ekvador"] },
  { key:"estonia", code:"ee", match:["estonia", "estonian", "estonya"] },
  { key:"ethiopia", code:"et", match:["ethiopia", "ethiopian", "etiyopya"] },
  { key:"philippines", code:"ph", match:["philippines", "filipino", "filipinler"] },
  { key:"finland", code:"fi", match:["finland", "finnish", "finlandiya"] },
  { key:"ghana", code:"gh", match:["ghana", "ghanaian", "gana"] },
  { key:"south-africa", code:"za", match:["south africa", "güney afrika"] },
  { key:"netherlands", code:"nl", match:["netherlands", "dutch", "hollanda"] },
  { key:"iraq", code:"iq", match:["iraq", "iraqi", "ırak"] },
  { key:"ireland", code:"ie", match:["ireland", "irish", "irlanda"] },
  { key:"israel", code:"il", match:["israel", "israeli", "israil"] },
  { key:"sweden", code:"se", match:["sweden", "swedish", "isveç"] },
  { key:"switzerland", code:"ch", match:["switzerland", "swiss", "isviçre"] },
  { key:"canada", code:"ca", match:["canada", "canadian", "kanada"] },
  { key:"colombia", code:"co", match:["colombia", "colombian", "kolombiya"] },
  { key:"cuba", code:"cu", match:["cuba", "cuban", "küba"] },
  { key:"malaysia", code:"my", match:["malaysia", "malaysian", "malezya"] },
  { key:"nepal", code:"np", match:["nepal", "nepali"] },
  { key:"norway", code:"no", match:["norway", "norwegian", "norveç"] },
  { key:"peru", code:"pe", match:["peru", "peruvian"] },
  { key:"poland", code:"pl", match:["poland", "polish", "polonya"] },
  { key:"romania", code:"ro", match:["romania", "romanian", "romanya"] },
  { key:"russia", code:"ru", match:["russia", "russian", "rusya"] },
  { key:"serbia", code:"rs", match:["serbia", "serbian", "sırp"] },
  { key:"singapore", code:"sg", match:["singapore", "singaporean", "singapur"] },
  { key:"sri-lanka", code:"lk", match:["sri lanka", "sri lankan"] },
  { key:"chile", code:"cl", match:["chile", "chilean", "şili"] },
  { key:"taiwan", code:"tw", match:["taiwan", "taiwanese", "tayvan"] },
  { key:"tunisia", code:"tn", match:["tunisia", "tunisian", "tunus"] },
  { key:"ukraine", code:"ua", match:["ukraine", "ukrainian", "ukrayna"] },
  { key:"uruguay", code:"uy", match:["uruguay", "uruguayan"] },
  { key:"jordan", code:"jo", match:["jordan", "jordanian", "ürdün"] },
  { key:"venezuela", code:"ve", match:["venezuela", "venezuelan"] },
  { key:"yemen", code:"ye", match:["yemen", "yemeni"] },
  { key:"new-zealand", code:"nz", match:["new zealand", "yeni zelanda"] },
  { key:"palestine", code:"ps", match:["palestine", "palestinian", "filistin"] }
];

const recipeRegionFlagRules = [
  { key:"central-asia", match:["central asia", "orta asya"] },
  { key:"middle-east", match:["middle east", "arab", "levant", "orta dogu", "orta doğu"] },
  { key:"mediterranean", match:["mediterranean", "akdeniz"] },
  { key:"balkan", match:["balkan"] },
  { key:"east-asia", match:["east asia", "far east", "uzak dogu", "uzak doğu"] },
  { key:"north-africa", match:["north africa", "kuzey afrika"] },
  { key:"latin-america", match:["latin america", "latin"] },
  { key:"caucasus", match:["caucasus", "kafkas"] }
];

function recipeFlagInfo(recipe){
  const raw = normalizeIngredientLookup([
    recipe?.cuisineKey,
    recipe?.country,
    recipe?.cuisine,
    recipe?.category,
    recipe?.area,
    recipe?.region,
    recipe?.origin
  ].filter(Boolean).join(" "));

  const country = recipeCountryFlagRules.find(item =>
    item.match.some(keyword => raw.includes(normalizeIngredientLookup(keyword)))
  );

  if(country){
    return {
      key: country.key,
      label: recipeCountryLabel(country.key, recipe?.country || recipe?.cuisine || country.key),
      src: resolveStaticAssetUrl(`/flags/countries/${country.code}.svg`)
    };
  }

  const region = recipeRegionFlagRules.find(item =>
    item.match.some(keyword => raw.includes(normalizeIngredientLookup(keyword)))
  );

  if(region){
    return {
      key: region.key,
      label: recipe?.region || recipe?.cuisine || "World",
      src: resolveStaticAssetUrl(`/flags/regions/${region.key}.svg`)
    };
  }

  return {
    key: "world",
    label: recipe?.country || recipe?.cuisine || "World",
    src: resolveStaticAssetUrl("/flags/regions/world.svg")
  };
}

function recipeCountryLabel(key, fallback){
  const langKey = currentLang || "en";
  return recipeCountryLabels[key]?.[langKey] ||
    recipeCountryLabels[key]?.en ||
    fallback;
}

function getRecipeCountryBadge(recipe){
  const found = recipeFlagInfo(recipe);
  const fallbackFlag = resolveStaticAssetUrl("/flags/regions/world.svg");

  return `
    <div class="recipe-detail-country">
      <img class="recipe-detail-country-flag" src="${found.src}" alt="" onerror="this.onerror=null;this.src='${fallbackFlag}'">
      <span class="recipe-detail-country-label">${escapeHtml(found.label)}</span>
    </div>
  `;
}

function getRecipeFlagImage(recipe) {
  const flag = recipeFlagInfo(recipe);
  const fallbackFlag = resolveStaticAssetUrl("/flags/regions/world.svg");
  return `<img src="${flag.src}" alt="${escapeHtml(flag.label)}" onerror="this.onerror=null;this.src='${fallbackFlag}'">`;
}

function mobileRecipeImageAttrs(recipe,index=0){
  const thumbnail=resolveRecipeImageUrl(recipe?.thumbnail);
  return recipeImageAttrs(
    thumbnail ? {...recipe,mediaUrl:thumbnail} : recipe,
    index
  );
}

function renderMobileNiliPicks(recipes) {
  const grid = document.getElementById("mobileNiliPicksGrid");
  if(!grid) return;

  const safeRecipes = Array.isArray(recipes) ? recipes.slice(0, 12) : [];

  if(!safeRecipes.length) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = safeRecipes.map((recipe, index) => {
    const title = recipe.title || t("recipeTitleFallback") || "Recipe";

    return `
      <button
        class="mobile-nili-pick"
        type="button"
        data-mobile-pick-id="${escapeHtml(recipe.id)}"
        aria-label="${escapeHtml(title)}"
      >
        <img
          ${mobileRecipeImageAttrs(recipe, index)}
          alt="${escapeHtml(title)}"
          loading="${index<4 ? "eager" : "lazy"}"
          fetchpriority="${index<2 ? "high" : "auto"}"
        >
        <span class="mobile-nili-pick-name">${escapeHtml(title)}</span>
        <span class="mobile-nili-pick-flag">${getRecipeFlagImage(recipe)}</span>
      </button>
    `;
  }).join("");
}

const MOBILE_NILI_PICKS_CACHE_VERSION="v3";
let mobileNiliPicksRequestToken=0;

function mobileNiliPicksCacheKey(lang){
  return `nili-mobile-picks-${MOBILE_NILI_PICKS_CACHE_VERSION}-${lang}`;
}

function readMobileNiliPicksCache(key){
  try{
    const parsed=JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(parsed?.recipes) ? parsed.recipes.slice(0,12) : [];
  }catch{
    return [];
  }
}

function writeMobileNiliPicksCache(key,recipes){
  try{
    localStorage.setItem(key,JSON.stringify({
      savedAt:Date.now(),
      recipes:(Array.isArray(recipes) ? recipes : []).slice(0,12)
    }));
  }catch(error){
    console.warn("MOBILE PICKS CACHE SKIPPED:",error);
  }
}

async function fetchMobileNiliPicks({lang,fast,timeoutMs}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);

  try{
    const response=await fetch(`${window.API_BASE}/discover-recipes`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({
        niliOnly:true,
        featured:true,
        fast,
        lang,
        limit:12
      })
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Mobile picks failed");
    return Array.isArray(payload.recipes) ? payload.recipes.slice(0,12) : [];
  }finally{
    clearTimeout(timeout);
  }
}

async function loadMobileNiliPicks() {
  const grid = document.getElementById("mobileNiliPicksGrid");
  if(!grid || window.innerWidth > 980) return;

  const requestLang=String(currentLang || "en").toLowerCase();
  const requestToken=++mobileNiliPicksRequestToken;
  const localizedCacheKey=mobileNiliPicksCacheKey(requestLang);
  const quickCacheKey=`nili-mobile-picks-${MOBILE_NILI_PICKS_CACHE_VERSION}-quick`;
  const localizedCache=readMobileNiliPicksCache(localizedCacheKey);
  const quickCache=readMobileNiliPicksCache(quickCacheKey);
  const initialRecipes=localizedCache.length ? localizedCache : quickCache;

  if(initialRecipes.length){
    currentMobileNiliPicks=initialRecipes;
    renderMobileNiliPicks(initialRecipes);
  }else{
    grid.innerHTML=`<div class="mobile-nili-picks-loading">${t("loadingRecipes") || "Loading recipes..."}</div>`;
  }

  try {
    const quickRecipes=await fetchMobileNiliPicks({
      lang:requestLang,
      fast:true,
      timeoutMs:10000
    });
    if(requestToken!==mobileNiliPicksRequestToken) return;
    if(quickRecipes.length){
      writeMobileNiliPicksCache(quickCacheKey,quickRecipes);
      if(!localizedCache.length){
        currentMobileNiliPicks=quickRecipes;
        renderMobileNiliPicks(quickRecipes);
      }
    }
  } catch(error) {
    console.warn("MOBILE NILI PICKS QUICK ERROR:",error);
  }

  try{
    const localizedRecipes=await fetchMobileNiliPicks({
      lang:requestLang,
      fast:false,
      timeoutMs:60000
    });
    if(requestToken!==mobileNiliPicksRequestToken) return;
    if(localizedRecipes.length){
      currentMobileNiliPicks=localizedRecipes;
      writeMobileNiliPicksCache(localizedCacheKey,localizedRecipes);
      renderMobileNiliPicks(localizedRecipes);
    }
  }catch(error){
    console.warn("MOBILE NILI PICKS LOCALIZE ERROR:",error);
    if(
      requestToken===mobileNiliPicksRequestToken &&
      !currentMobileNiliPicks.length
    ){
      grid.innerHTML=`<div class="mobile-nili-picks-loading">${t("recipesLoadError") || "Recipes could not be loaded."}</div>`;
    }
  }
}

function getInstructionText(recipe){
  if(Array.isArray(recipe.analyzedInstructions) && recipe.analyzedInstructions.length){
    const steps = recipe.analyzedInstructions
      .flatMap(block => Array.isArray(block.steps) ? block.steps : [])
      .map(step => step?.step)
      .filter(Boolean);

    if(steps.length){
      return steps.join(" ");
    }
  }

  if(typeof recipe.instructions === "string" && recipe.instructions.trim()){
    return recipe.instructions
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

function getInstructionSteps(recipe){
  const cleanStep = value => String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/^(?:(?:step|adım|étape|etape|paso|schritt)\s*)?\d{1,2}\s*[.)\-:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const usableSteps = values => values
    .map(value => cleanStep(value?.step ?? value?.text ?? value))
    .filter(value => value && !/^\d+[.)\-:]?$/.test(value));

  if(Array.isArray(recipe.analyzedInstructions) && recipe.analyzedInstructions.length){
    const steps = usableSteps(
      recipe.analyzedInstructions
        .flatMap(block => Array.isArray(block.steps) ? block.steps : [])
    );

    if(steps.length){
      return steps;
    }
  }

  if(Array.isArray(recipe.steps) && recipe.steps.length){
    const steps = usableSteps(recipe.steps);
    if(steps.length) return steps;
  }

  if(Array.isArray(recipe.instructions) && recipe.instructions.length){
    const steps = usableSteps(recipe.instructions);
    if(steps.length) return steps;
  }

  const rawInstructions = String(recipe.instructions || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  if(!rawInstructions) return [];

  const markerPattern = /(?:^|\s)(?:(?:step|adım|étape|etape|paso|schritt)\s*)?\d{1,2}\s*[.)\-:]\s+/gi;
  const markers = [...rawInstructions.matchAll(markerPattern)];

  if(markers.length){
    const numberedSteps = markers.map((marker, index) => {
      const start = marker.index + marker[0].length;
      const end = index + 1 < markers.length ? markers[index + 1].index : rawInstructions.length;
      return rawInstructions.slice(start, end);
    });
    const steps = usableSteps(numberedSteps);
    if(steps.length) return steps.slice(0, 40);
  }

  const lineSteps = usableSteps(rawInstructions.split(/\n+/));
  if(lineSteps.length > 1) return lineSteps.slice(0, 40);

  return usableSteps(rawInstructions.split(/(?<=[.!?])\s+/)).slice(0, 40);
}

window.closeModal = function(){

  if(document.body.classList.contains("recipe-full-page-open")){
    document.body.classList.remove("recipe-full-page-open");
    if(recipeFullPage) recipeFullPage.setAttribute("aria-hidden", "true");
    history.replaceState(null, "", "#recipes");
    window.scrollTo({top:0, behavior:"instant"});
    return;
  }

  history.replaceState(null, "", "#recipes");

  if(modal){
    const modalContent = modal.querySelector(".modal-content");
    if(modalContent){
      modalContent.classList.remove("recipe-portrait-modal");
    }
    modal.style.display = "none";
  }

  document.body.classList.remove("recipe-modal-open");

  returnHomeAfterOverlayClose();

}

window.closeRecipeToHome = function(){
  document.body.classList.remove("recipe-full-page-open");
  if(recipeFullPage) recipeFullPage.setAttribute("aria-hidden", "true");
  backToHome();
};

function renderChecklist(){

  const tray =
  document.getElementById("selectedTray");

  const itemsBox =
  document.getElementById("selectedTrayItems");

  const confirmCheck =
  document.getElementById("confirmCheck");

  if(!tray || !itemsBox){
    console.log("SELECTED TRAY NOT FOUND");
    return;
  }

 if(!selected.length){
  itemsBox.innerHTML = "";
  tray.classList.remove("has-items");
  syncIngredientModalSelection();
  updateTodayCookIngredients();
  updateNiliAssistantContext();

  if(confirmCheck){
    confirmCheck.checked = false;
  }

  return;
}

  tray.classList.add("has-items");

  if(confirmCheck){
    confirmCheck.checked = false;
  }

  itemsBox.innerHTML =
  selected.map((item, index) => `
    <div class="selected-chip">
      <span>${typeof getIngredientLabel === "function" ? getIngredientLabel(item) : item}</span>

      <button
        type="button"
        class="selected-chip-remove"
        data-selected-index="${index}"
        aria-label="Remove ${typeof getIngredientLabel === "function" ? getIngredientLabel(item) : item}"
      >
        ×
      </button>
    </div>
  `).join("");

  itemsBox.querySelectorAll(".selected-chip-remove").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(button.dataset.selectedIndex);
      if(Number.isInteger(index)) removeSelectedIngredientAt(index);
    });
  });

  syncIngredientModalSelection();

  translateSelectedIngredients();
  updateTodayCookIngredients();
  updateNiliAssistantContext();

}

function removeSelectedIngredientAt(index){
  if(index < 0 || index >= selected.length) return;
  selected.splice(index, 1);
  saveState();
  syncIngredientModalSelection();
  renderChecklist();
}

const TODAY_COOK_COPY = {
  en:{launch:"What should I cook today?",launchHint:"Get 3 personal suggestions",eyebrow:"NILI'S QUICK CHOICE",title:"What should I cook today?",description:"Tell us how you want to cook. Nili will select the best 3 recipes.",ingredients:"Your ingredients",noIngredients:"No ingredients selected yet.",chooseIngredients:"Choose ingredients",scanPhoto:"Scan a photo",servings:"How many people?",time:"How much time?",minute:"min",preference:"What matters today?",easy:"Easy",economic:"Economical",healthy:"Healthy",elegant:"Elegant",kids:"For kids",submit:"Find my 3 recipes",selectFirst:"Please select or scan at least one ingredient.",loading:"Nili is choosing your best 3 recipes...",none:"No suitable recipe was found. Try another time or preference.",all:"All ingredients are available",one:"Only 1 ingredient is missing",two:"Can be made with 2 alternatives",best:"Best match for you"},
  tr:{launch:"Bugün Ne Pişirsem?",launchHint:"Sana özel 3 öneri al",eyebrow:"NILI'NİN HIZLI SEÇİMİ",title:"Bugün Ne Pişirsem?",description:"Nasıl pişirmek istediğini seç. Nili sana en uygun 3 tarifi bulsun.",ingredients:"Malzemelerin",noIngredients:"Henüz malzeme seçilmedi.",chooseIngredients:"Malzeme seç",scanPhoto:"Fotoğraf tara",servings:"Kaç kişilik?",time:"Ne kadar vaktin var?",minute:"dk",preference:"Bugün ne önemli?",easy:"Kolay",economic:"Ekonomik",healthy:"Sağlıklı",elegant:"Şık",kids:"Çocuklara uygun",submit:"3 tarifimi bul",selectFirst:"Lütfen en az bir malzeme seç veya fotoğraf tara.",loading:"Nili sana en uygun 3 tarifi seçiyor...",none:"Uygun tarif bulunamadı. Süreyi veya tercihi değiştir.",all:"Bütün malzemeler bende",one:"Sadece 1 malzeme eksik",two:"2 alternatif malzemeyle yapılabilir",best:"Sana en uygun eşleşme"},
  de:{launch:"Was koche ich heute?",launchHint:"3 persönliche Vorschläge",eyebrow:"NILIS SCHNELLAUSWAHL",title:"Was koche ich heute?",description:"Wähle, wie du heute kochen möchtest. Nili findet die besten 3 Rezepte.",ingredients:"Deine Zutaten",noIngredients:"Noch keine Zutaten ausgewählt.",chooseIngredients:"Zutaten wählen",scanPhoto:"Foto scannen",servings:"Für wie viele?",time:"Wie viel Zeit?",minute:"Min.",preference:"Was ist heute wichtig?",easy:"Einfach",economic:"Günstig",healthy:"Gesund",elegant:"Elegant",kids:"Für Kinder",submit:"Meine 3 Rezepte finden",selectFirst:"Bitte wähle oder scanne mindestens eine Zutat.",loading:"Nili wählt deine besten 3 Rezepte...",none:"Kein passendes Rezept gefunden.",all:"Alle Zutaten vorhanden",one:"Nur 1 Zutat fehlt",two:"Mit 2 Alternativen möglich",best:"Beste Übereinstimmung"},
  fr:{launch:"Que cuisiner aujourd'hui ?",launchHint:"3 suggestions personnalisées",eyebrow:"LE CHOIX RAPIDE DE NILI",title:"Que cuisiner aujourd'hui ?",description:"Choisissez votre façon de cuisiner. Nili sélectionne les 3 meilleures recettes.",ingredients:"Vos ingrédients",noIngredients:"Aucun ingrédient sélectionné.",chooseIngredients:"Choisir les ingrédients",scanPhoto:"Scanner une photo",servings:"Pour combien ?",time:"Combien de temps ?",minute:"min",preference:"Votre priorité ?",easy:"Facile",economic:"Économique",healthy:"Sain",elegant:"Élégant",kids:"Pour enfants",submit:"Trouver mes 3 recettes",selectFirst:"Sélectionnez ou scannez au moins un ingrédient.",loading:"Nili choisit vos 3 meilleures recettes...",none:"Aucune recette adaptée trouvée.",all:"Tous les ingrédients sont là",one:"Il manque 1 ingrédient",two:"Possible avec 2 alternatives",best:"Meilleure sélection"},
  es:{launch:"¿Qué cocino hoy?",launchHint:"3 sugerencias personales",eyebrow:"SELECCIÓN RÁPIDA DE NILI",title:"¿Qué cocino hoy?",description:"Elige cómo quieres cocinar. Nili seleccionará las 3 mejores recetas.",ingredients:"Tus ingredientes",noIngredients:"Aún no hay ingredientes.",chooseIngredients:"Elegir ingredientes",scanPhoto:"Escanear foto",servings:"¿Para cuántos?",time:"¿Cuánto tiempo?",minute:"min",preference:"¿Qué importa hoy?",easy:"Fácil",economic:"Económico",healthy:"Saludable",elegant:"Elegante",kids:"Para niños",submit:"Buscar mis 3 recetas",selectFirst:"Selecciona o escanea al menos un ingrediente.",loading:"Nili elige tus 3 mejores recetas...",none:"No se encontró una receta adecuada.",all:"Tengo todos los ingredientes",one:"Solo falta 1 ingrediente",two:"Posible con 2 alternativas",best:"Mejor coincidencia"},
  pt:{launch:"O que cozinhar hoje?",launchHint:"3 sugestões pessoais",eyebrow:"ESCOLHA RÁPIDA DA NILI",title:"O que cozinhar hoje?",description:"Escolha como quer cozinhar. Nili selecionará as 3 melhores receitas.",ingredients:"Seus ingredientes",noIngredients:"Nenhum ingrediente selecionado.",chooseIngredients:"Escolher ingredientes",scanPhoto:"Digitalizar foto",servings:"Para quantas pessoas?",time:"Quanto tempo?",minute:"min",preference:"O que importa hoje?",easy:"Fácil",economic:"Econômico",healthy:"Saudável",elegant:"Elegante",kids:"Para crianças",submit:"Encontrar 3 receitas",selectFirst:"Selecione ou digitalize pelo menos um ingrediente.",loading:"Nili está escolhendo suas 3 melhores receitas...",none:"Nenhuma receita adequada encontrada.",all:"Tenho todos os ingredientes",one:"Falta apenas 1 ingrediente",two:"Possível com 2 alternativas",best:"Melhor combinação"},
  ru:{launch:"Что приготовить сегодня?",launchHint:"3 личных предложения",eyebrow:"БЫСТРЫЙ ВЫБОР NILI",title:"Что приготовить сегодня?",description:"Выберите условия, и Nili найдет 3 лучших рецепта.",ingredients:"Ваши ингредиенты",noIngredients:"Ингредиенты еще не выбраны.",chooseIngredients:"Выбрать ингредиенты",scanPhoto:"Сканировать фото",servings:"На сколько человек?",time:"Сколько времени?",minute:"мин",preference:"Что важно сегодня?",easy:"Просто",economic:"Экономно",healthy:"Полезно",elegant:"Изысканно",kids:"Для детей",submit:"Найти 3 рецепта",selectFirst:"Выберите или отсканируйте хотя бы один ингредиент.",loading:"Nili выбирает 3 лучших рецепта...",none:"Подходящий рецепт не найден.",all:"Все ингредиенты есть",one:"Не хватает 1 ингредиента",two:"Можно с 2 заменами",best:"Лучшее совпадение"},
  ar:{launch:"ماذا أطبخ اليوم؟",launchHint:"3 اقتراحات شخصية",eyebrow:"اختيار نيلي السريع",title:"ماذا أطبخ اليوم؟",description:"اختر طريقة الطهي وستحدد نيلي أفضل 3 وصفات.",ingredients:"مكوناتك",noIngredients:"لم يتم اختيار مكونات بعد.",chooseIngredients:"اختر المكونات",scanPhoto:"امسح صورة",servings:"لِكم شخص؟",time:"كم لديك من الوقت؟",minute:"د",preference:"ما المهم اليوم؟",easy:"سهل",economic:"اقتصادي",healthy:"صحي",elegant:"أنيق",kids:"للأطفال",submit:"اعثر على 3 وصفات",selectFirst:"اختر أو امسح مكوناً واحداً على الأقل.",loading:"تختار نيلي أفضل 3 وصفات لك...",none:"لم يتم العثور على وصفة مناسبة.",all:"كل المكونات متوفرة",one:"ينقص مكون واحد فقط",two:"يمكن إعدادها ببديلين",best:"أفضل تطابق"},
  ja:{launch:"今日は何を作る？",launchHint:"あなた向けの3提案",eyebrow:"NILIのクイックセレクト",title:"今日は何を作る？",description:"条件を選ぶと、Niliが最適な3レシピを選びます。",ingredients:"食材",noIngredients:"食材がまだ選択されていません。",chooseIngredients:"食材を選ぶ",scanPhoto:"写真をスキャン",servings:"何人分？",time:"調理時間は？",minute:"分",preference:"今日の優先は？",easy:"簡単",economic:"節約",healthy:"健康的",elegant:"おしゃれ",kids:"子ども向け",submit:"3レシピを探す",selectFirst:"食材を1つ以上選択またはスキャンしてください。",loading:"Niliが最適な3レシピを選んでいます...",none:"適したレシピが見つかりません。",all:"材料がすべて揃っています",one:"足りない材料は1つ",two:"2つの代替材料で作れます",best:"おすすめの組み合わせ"},
  zh:{launch:"今天做什么？",launchHint:"获取3个专属建议",eyebrow:"NILI快速选择",title:"今天做什么？",description:"选择你的烹饪方式，Nili会挑选最合适的3个食谱。",ingredients:"你的食材",noIngredients:"尚未选择食材。",chooseIngredients:"选择食材",scanPhoto:"扫描照片",servings:"几人份？",time:"有多少时间？",minute:"分钟",preference:"今天最看重什么？",easy:"简单",economic:"实惠",healthy:"健康",elegant:"精致",kids:"儿童友好",submit:"寻找3个食谱",selectFirst:"请至少选择或扫描一种食材。",loading:"Nili正在挑选最适合你的3个食谱...",none:"没有找到合适的食谱。",all:"所有食材都齐全",one:"只缺1种食材",two:"可用2种替代食材制作",best:"最适合你的选择"}
};

const todayCookState = {servings:2,time:30,preference:"easy"};
let todaySuggestionBadges = new Map();

function todayCopy(key){
  return TODAY_COOK_COPY[currentLang]?.[key] || TODAY_COOK_COPY.en[key] || key;
}

function updateTodayCookCopy(){
  document.querySelectorAll("[data-today-copy]").forEach(element => {
    element.textContent = todayCopy(element.dataset.todayCopy);
  });
}

function updateTodayCookIngredients(){
  const count = document.getElementById("todayCookIngredientCount");
  const preview = document.getElementById("todayCookIngredientPreview");
  if(count) count.textContent = selected.length;
  if(preview){
    preview.textContent = selected.length
      ? selected.slice(0,6).map(getIngredientLabel).join(" • ") + (selected.length > 6 ? ` +${selected.length - 6}` : "")
      : todayCopy("noIngredients");
  }
}

window.openTodayCookFlow = function(){
  updateTodayCookCopy();
  updateTodayCookIngredients();
  const modal = document.getElementById("todayCookModal");
  if(!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
};

window.closeTodayCookFlow = function(){
  const modal = document.getElementById("todayCookModal");
  if(!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
};

function syncTodayCookLaunchSize(){
  const launch = document.querySelector(".hero-content > .today-cook-launch:not(.today-cook-launch-mobile)");
  const firstStripButton = document.querySelector(".hero-floating-strip .hero-strip-item");
  const heroContent = document.querySelector(".hero-content");
  if(!launch) return;
  if(window.innerWidth <= 980 || !firstStripButton || !heroContent){
    launch.style.removeProperty("width");
    launch.style.removeProperty("margin-left");
    return;
  }
  const buttonRect = firstStripButton.getBoundingClientRect();
  const contentRect = heroContent.getBoundingClientRect();
  launch.style.width = `${buttonRect.width}px`;
  launch.style.marginLeft = `${buttonRect.left - contentRect.left}px`;
}

window.todayCookChooseIngredients = function(){
  closeTodayCookFlow();
  const panel = document.querySelector(".category-panel");
  panel?.scrollIntoView({behavior:"smooth",block:"center"});
};

window.todayCookScanPhoto = function(){
  closeTodayCookFlow();
  document.getElementById("photoGallery")?.click();
};

function recipeReadyMinutes(recipe){
  const value = Number(recipe?.readyInMinutes || recipe?.prepTime || 0);
  return Number.isFinite(value) && value > 0 ? value : 45;
}

function todayRecipeText(recipe){
  return [
    recipe?.title, recipe?.category, recipe?.dishType, recipe?.cuisine,
    ...(Array.isArray(recipe?.tags) ? recipe.tags : []),
    ...getAllRecipeIngredients(recipe).map(item => item?.name || item?.original || item)
  ].join(" ").toLocaleLowerCase();
}

function todayPreferenceScore(recipe, preference){
  const text = todayRecipeText(recipe);
  const ingredientCount = getAllRecipeIngredients(recipe).length || 12;
  const minutes = recipeReadyMinutes(recipe);
  if(preference === "easy") return Math.max(0,18 - ingredientCount) + Math.max(0,45 - minutes) / 4;
  if(preference === "economic") return Math.max(0,20 - ingredientCount) + (/bean|lentil|rice|pasta|potato|egg|soup|fasulye|mercimek|pilav|makarna|patates|yumurta/.test(text) ? 18 : 0);
  if(preference === "healthy") return /healthy|salad|vegetable|vegan|vegetarian|fish|grill|sebze|salata|balık|ızgara/.test(text) ? 28 : 0;
  if(preference === "elegant") return /elegant|steak|salmon|risotto|tart|roast|filet|somon|bonfile|şık/.test(text) ? 28 : 0;
  if(preference === "kids") return /pasta|pizza|chicken|meatball|pancake|burger|makarna|pizza|tavuk|köfte|krep/.test(text) ? 28 : (/spicy|chili|acı/.test(text) ? -18 : 0);
  return 0;
}

function todayMatchBadge(recipe, chosenIngredients = []){
  const selectedTerms = chosenIngredients.flatMap(value => {
    const item = window.allIngredients?.find(entry => entry.id === value);
    return item ? ingredientSearchValues(item) : [value];
  }).map(normalizeIngredientLookup).filter(term => term.length > 2);

  const pantryPattern = /\b(salt|pepper|water|oil|tuz|karabiber|su|yağ|seasoning|baharat)\b/i;
  const recipeTerms = getAllRecipeIngredients(recipe)
    .map(item => String(item?.original || item?.originalName || item?.name || item || ""))
    .filter(text => text && !pantryPattern.test(text));
  const calculatedMissing = recipeTerms.filter(text => {
    const normalized = normalizeIngredientLookup(text);
    return !selectedTerms.some(term => normalized.includes(term) || term.includes(normalized));
  }).length;

  if(recipeTerms.length && calculatedMissing === 0) return todayCopy("all");
  if(calculatedMissing === 1) return todayCopy("one");
  if(calculatedMissing === 2) return todayCopy("two");
  if(recipeTerms.length) return todayCopy("best");

  const missed = Array.isArray(recipe?.missedIngredients) ? recipe.missedIngredients.length : null;
  if(missed === 0) return todayCopy("all");
  if(missed === 1) return todayCopy("one");
  if(missed === 2) return todayCopy("two");
  return todayCopy("best");
}

function decorateTodaySuggestionCards(){
  document.querySelectorAll("#result .recipe-card").forEach(card => {
    const label = todaySuggestionBadges.get(String(card.dataset.recipeId));
    if(!label) return;
    card.querySelector(".today-match-badge")?.remove();
    card.insertAdjacentHTML("afterbegin",`<div class="today-match-badge">${escapeHtml(label)}</div>`);
  });
}

window.getTodayCookSuggestions = async function(){
  const status = document.getElementById("todayCookStatus");
  const submit = document.getElementById("todayCookSubmit");
  if(!selected.length){
    if(status) status.textContent = todayCopy("selectFirst");
    return;
  }
  if(!checkGuestSearchLimit()) return;
  if(status) status.textContent = todayCopy("loading");
  if(submit) submit.disabled = true;

  try{
    const ingredientsForRecipe = [...selected];
    const normalizeRes = await fetch(`${window.API_BASE}/normalize-ingredients`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ingredients:ingredientsForRecipe,lang:currentLang})
    });
    const normalizeData = await normalizeRes.json();
    const normalized = normalizeData?.success && Array.isArray(normalizeData.ingredients)
      ? normalizeData.ingredients.map(item => item.canonicalEn).filter(Boolean)
      : ingredientsForRecipe;

    const response = await fetch(`${window.API_BASE}/recipes`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ingredients:normalized,
        originalIngredients:ingredientsForRecipe,
        lang:currentLang,
        limit:12,
        offset:0
      })
    });
    const payload = await response.json();
    if(!response.ok) throw new Error(payload?.error || "Recipe search failed");
    const recipes = Array.isArray(payload) ? payload : payload?.recipes || payload?.results || [];

    const ranked = recipes
      .map(recipe => {
        const minutes = recipeReadyMinutes(recipe);
        const coverage = Number(recipe.selectedIngredientCoverage || 0);
        const timeScore = minutes <= todayCookState.time ? 35 : Math.max(-25,35 - (minutes - todayCookState.time) * 2);
        const sourceScore = recipe.source === "nili_creator" ? 24 : 0;
        const servingScore = recipe.servings && Number(recipe.servings) >= todayCookState.servings ? 8 : 0;
        return {recipe,score:coverage * 55 + timeScore + sourceScore + servingScore + todayPreferenceScore(recipe,todayCookState.preference)};
      })
      .sort((a,b) => b.score - a.score);

    const withinTime = ranked.filter(item => recipeReadyMinutes(item.recipe) <= todayCookState.time);
    const chosen = (withinTime.length >= 3 ? withinTime : ranked).slice(0,3).map(item => item.recipe);
    if(!chosen.length){
      if(status) status.textContent = todayCopy("none");
      return;
    }

    todaySuggestionBadges = new Map(chosen.map(recipe => [
      String(recipe.id),
      todayMatchBadge(recipe,ingredientsForRecipe)
    ]));
    lastRecipeIngredients = ingredientsForRecipe;
    recipePage = 1;
    if(status) status.textContent = "";
    closeTodayCookFlow();
    renderRecipes(chosen);
    decorateTodaySuggestionCards();
  }catch(error){
    console.error("TODAY COOK FAILED:",error);
    if(status) status.textContent = t("serviceTemporaryUnavailable") || "Service is temporarily unavailable.";
  }finally{
    if(submit) submit.disabled = false;
  }
};

document.addEventListener("DOMContentLoaded",() => {
  document.querySelectorAll("[data-today-group]").forEach(group => {
    group.addEventListener("click",event => {
      const button = event.target.closest("button[data-value]");
      if(!button) return;
      group.querySelectorAll("button").forEach(item => item.classList.toggle("is-active",item === button));
      todayCookState[group.dataset.todayGroup] =
        group.dataset.todayGroup === "preference" ? button.dataset.value : Number(button.dataset.value);
    });
  });
  document.getElementById("todayCookModal")?.addEventListener("click",event => {
    if(event.target.id === "todayCookModal") closeTodayCookFlow();
  });
  updateTodayCookCopy();
  updateTodayCookIngredients();
  requestAnimationFrame(syncTodayCookLaunchSize);
});
window.addEventListener("resize",syncTodayCookLaunchSize);

const NILI_ASSISTANT_COPY = {
  en:{launch:"Ask Nili",launchHint:"Your personal kitchen assistant",eyebrow:"YOUR KITCHEN COMPANION",online:"Ready to help",context:"Selected ingredients",emptyContext:"No ingredients selected yet",greeting:"Hello! Tell me what you have or how you would like to cook today.",greetingSelected:"Hello! I can see your ingredients. Would you like something quick, lighter, economical, or a direct recipe suggestion?",quick:"Make it quick",lighter:"Make it lighter",substitute:"Suggest a substitute",recipes:"Show recipes",quickPrompt:"I want a quick meal with my ingredients.",lighterPrompt:"I want a lighter and healthier meal with my ingredients.",substitutePrompt:"Suggest practical substitutes for ingredients I may be missing.",recipesPrompt:"Show me recipes I can cook with my selected ingredients.",placeholder:"Ask Nili anything about cooking...",thinking:"Nili is thinking...",error:"I could not answer right now. Please try again.",chooseFirst:"Choose at least one ingredient so I can find the right recipes."},
  tr:{launch:"Nili'ye Sor",launchHint:"Kişisel mutfak asistanın",eyebrow:"MUTFAK ARKADAŞIN",online:"Yardım etmeye hazır",context:"Seçili malzemeler",emptyContext:"Henüz malzeme seçilmedi",greeting:"Merhaba! Evinde neler olduğunu veya bugün nasıl bir yemek istediğini söyle.",greetingSelected:"Merhaba! Malzemelerini görüyorum. Hızlı, hafif, ekonomik bir yemek mi, yoksa doğrudan tarif önerisi mi istersin?",quick:"Hızlı olsun",lighter:"Daha hafif olsun",substitute:"Alternatif öner",recipes:"Tarifleri göster",quickPrompt:"Malzemelerimle hızlı hazırlanacak bir yemek istiyorum.",lighterPrompt:"Malzemelerimle daha hafif ve sağlıklı bir yemek istiyorum.",substitutePrompt:"Eksik olabilecek malzemeler için uygun alternatifler öner.",recipesPrompt:"Seçtiğim malzemelerle yapabileceğim tarifleri göster.",placeholder:"Nili'ye yemekle ilgili istediğini sor...",thinking:"Nili düşünüyor...",error:"Şu anda cevap veremedim. Lütfen tekrar dene.",chooseFirst:"Doğru tarifleri bulabilmem için en az bir malzeme seç."},
  de:{launch:"Nili fragen",launchHint:"Deine persönliche Küchenhilfe",eyebrow:"DEINE KÜCHENBEGLEITERIN",online:"Bereit zu helfen",context:"Ausgewählte Zutaten",emptyContext:"Noch keine Zutaten ausgewählt",greeting:"Hallo! Sag mir, was du zu Hause hast oder wie du heute kochen möchtest.",greetingSelected:"Hallo! Ich sehe deine Zutaten. Soll es schnell, leicht, günstig oder direkt ein Rezept sein?",quick:"Schnell kochen",lighter:"Leichter kochen",substitute:"Ersatz vorschlagen",recipes:"Rezepte zeigen",quickPrompt:"Ich möchte mit meinen Zutaten schnell kochen.",lighterPrompt:"Ich möchte mit meinen Zutaten leichter und gesünder kochen.",substitutePrompt:"Schlage praktische Alternativen für fehlende Zutaten vor.",recipesPrompt:"Zeige Rezepte mit meinen ausgewählten Zutaten.",placeholder:"Frag Nili etwas über das Kochen...",thinking:"Nili denkt nach...",error:"Ich konnte gerade nicht antworten. Bitte versuche es erneut.",chooseFirst:"Wähle mindestens eine Zutat aus."},
  fr:{launch:"Demander à Nili",launchHint:"Votre assistante de cuisine",eyebrow:"VOTRE COMPAGNE EN CUISINE",online:"Prête à vous aider",context:"Ingrédients sélectionnés",emptyContext:"Aucun ingrédient sélectionné",greeting:"Bonjour ! Dites-moi ce que vous avez ou ce que vous souhaitez cuisiner aujourd'hui.",greetingSelected:"Bonjour ! Je vois vos ingrédients. Préférez-vous un plat rapide, léger, économique ou une suggestion directe ?",quick:"Cuisine rapide",lighter:"Plus léger",substitute:"Trouver un substitut",recipes:"Voir les recettes",quickPrompt:"Je veux un plat rapide avec mes ingrédients.",lighterPrompt:"Je veux un plat plus léger et sain avec mes ingrédients.",substitutePrompt:"Propose des substituts pratiques pour les ingrédients manquants.",recipesPrompt:"Montre les recettes possibles avec mes ingrédients.",placeholder:"Posez une question culinaire à Nili...",thinking:"Nili réfléchit...",error:"Je ne peux pas répondre maintenant. Réessayez.",chooseFirst:"Choisissez au moins un ingrédient."},
  es:{launch:"Preguntar a Nili",launchHint:"Tu asistente personal de cocina",eyebrow:"TU COMPAÑERA DE COCINA",online:"Lista para ayudar",context:"Ingredientes seleccionados",emptyContext:"Aún no hay ingredientes",greeting:"¡Hola! Dime qué tienes o cómo te gustaría cocinar hoy.",greetingSelected:"¡Hola! Veo tus ingredientes. ¿Quieres algo rápido, ligero, económico o recetas directas?",quick:"Que sea rápido",lighter:"Más ligero",substitute:"Sugerir sustituto",recipes:"Ver recetas",quickPrompt:"Quiero una comida rápida con mis ingredientes.",lighterPrompt:"Quiero una comida más ligera y saludable.",substitutePrompt:"Sugiere sustitutos prácticos para los ingredientes que falten.",recipesPrompt:"Muéstrame recetas con mis ingredientes.",placeholder:"Pregunta a Nili sobre cocina...",thinking:"Nili está pensando...",error:"No pude responder. Inténtalo de nuevo.",chooseFirst:"Selecciona al menos un ingrediente."},
  pt:{launch:"Perguntar à Nili",launchHint:"Sua assistente pessoal de cozinha",eyebrow:"SUA COMPANHEIRA DE COZINHA",online:"Pronta para ajudar",context:"Ingredientes selecionados",emptyContext:"Nenhum ingrediente selecionado",greeting:"Olá! Diga o que tem em casa ou como quer cozinhar hoje.",greetingSelected:"Olá! Vejo seus ingredientes. Quer algo rápido, leve, econômico ou receitas diretas?",quick:"Fazer rápido",lighter:"Mais leve",substitute:"Sugerir substituto",recipes:"Ver receitas",quickPrompt:"Quero uma refeição rápida com meus ingredientes.",lighterPrompt:"Quero uma refeição mais leve e saudável.",substitutePrompt:"Sugira substitutos práticos para ingredientes em falta.",recipesPrompt:"Mostre receitas com meus ingredientes.",placeholder:"Pergunte à Nili sobre cozinha...",thinking:"Nili está pensando...",error:"Não consegui responder agora. Tente novamente.",chooseFirst:"Selecione pelo menos um ingrediente."},
  ru:{launch:"Спросить Nili",launchHint:"Ваш личный кухонный помощник",eyebrow:"ВАШ КУХОННЫЙ ПОМОЩНИК",online:"Готова помочь",context:"Выбранные ингредиенты",emptyContext:"Ингредиенты не выбраны",greeting:"Здравствуйте! Расскажите, что у вас есть и что вы хотите приготовить.",greetingSelected:"Здравствуйте! Я вижу ваши ингредиенты. Хотите быстрое, лёгкое, экономное блюдо или готовые рецепты?",quick:"Быстро",lighter:"Полегче",substitute:"Найти замену",recipes:"Показать рецепты",quickPrompt:"Хочу быстрое блюдо из выбранных ингредиентов.",lighterPrompt:"Хочу более лёгкое и полезное блюдо.",substitutePrompt:"Предложи практичные замены недостающим ингредиентам.",recipesPrompt:"Покажи рецепты из выбранных ингредиентов.",placeholder:"Спросите Nili о приготовлении...",thinking:"Nili думает...",error:"Сейчас не удалось ответить. Попробуйте ещё раз.",chooseFirst:"Выберите хотя бы один ингредиент."},
  ar:{launch:"اسأل نيلي",launchHint:"مساعدتك الشخصية في المطبخ",eyebrow:"رفيقتك في المطبخ",online:"جاهزة للمساعدة",context:"المكونات المختارة",emptyContext:"لم يتم اختيار مكونات",greeting:"مرحباً! أخبرني بما لديك أو بما ترغب في طهيه اليوم.",greetingSelected:"مرحباً! أرى مكوناتك. هل تريد وجبة سريعة أو خفيفة أو اقتصادية أو وصفات مباشرة؟",quick:"وجبة سريعة",lighter:"وجبة أخف",substitute:"اقترح بديلاً",recipes:"اعرض الوصفات",quickPrompt:"أريد وجبة سريعة بالمكونات المختارة.",lighterPrompt:"أريد وجبة أخف وأكثر صحة.",substitutePrompt:"اقترح بدائل عملية للمكونات الناقصة.",recipesPrompt:"اعرض وصفات بالمكونات المختارة.",placeholder:"اسأل نيلي عن الطهي...",thinking:"نيلي تفكر...",error:"تعذر الرد الآن. حاول مرة أخرى.",chooseFirst:"اختر مكوناً واحداً على الأقل."},
  ja:{launch:"Niliに聞く",launchHint:"あなた専用の料理アシスタント",eyebrow:"キッチンのパートナー",online:"お手伝いできます",context:"選択した食材",emptyContext:"食材が未選択です",greeting:"こんにちは。家にある食材や今日作りたい料理を教えてください。",greetingSelected:"食材を確認しました。時短、ヘルシー、節約、またはレシピを直接表示しますか？",quick:"時短料理",lighter:"ヘルシーに",substitute:"代用品を提案",recipes:"レシピを見る",quickPrompt:"選んだ食材で早く作れる料理が欲しいです。",lighterPrompt:"選んだ食材で軽く健康的な料理が欲しいです。",substitutePrompt:"足りない食材の実用的な代用品を提案してください。",recipesPrompt:"選んだ食材で作れるレシピを見せてください。",placeholder:"料理についてNiliに質問...",thinking:"Niliが考えています...",error:"現在回答できません。もう一度お試しください。",chooseFirst:"食材を1つ以上選択してください。"},
  zh:{launch:"询问Nili",launchHint:"你的私人厨房助手",eyebrow:"你的厨房伙伴",online:"随时提供帮助",context:"已选食材",emptyContext:"尚未选择食材",greeting:"你好！告诉我你家里有什么，或者今天想怎样烹饪。",greetingSelected:"你好！我看到了你的食材。想要快捷、清淡、实惠的菜，还是直接查看食谱？",quick:"快速烹饪",lighter:"更清淡",substitute:"推荐替代品",recipes:"查看食谱",quickPrompt:"我想用已选食材快速做一道菜。",lighterPrompt:"我想用已选食材做一道更清淡健康的菜。",substitutePrompt:"请为缺少的食材推荐实用替代品。",recipesPrompt:"显示可以用已选食材制作的食谱。",placeholder:"向Nili询问烹饪问题...",thinking:"Nili正在思考...",error:"暂时无法回答，请重试。",chooseFirst:"请至少选择一种食材。"}
};

let niliAssistantStarted=false;
let niliAssistantVerified=false;
let niliAssistantVerifiedEmail="";
let niliAssistantPendingEmail="";
const NILI_ASSISTANT_TOKEN_KEY="niliAssistantVerifiedTokenV1";
const NILI_ASSISTANT_EMAIL_KEY="niliAssistantVerifiedEmailV1";

const NILI_ASSISTANT_PLAN_COPY={
  en:{plan:"Plan my week",planPrompt:"Create a personal weekly dinner plan and shopping list for me."},
  tr:{plan:"Haftamı planla",planPrompt:"Bana kişisel bir haftalık akşam yemeği planı ve alışveriş listesi hazırla."},
  de:{plan:"Woche planen",planPrompt:"Erstelle einen persönlichen Wochenplan mit Einkaufsliste."},
  fr:{plan:"Planifier ma semaine",planPrompt:"Crée mon programme de dîners et ma liste de courses pour la semaine."},
  es:{plan:"Planificar mi semana",planPrompt:"Crea mi plan semanal de cenas y la lista de compras."},
  pt:{plan:"Planejar minha semana",planPrompt:"Crie meu plano semanal de jantares e a lista de compras."},
  ru:{plan:"Спланировать неделю",planPrompt:"Создай мой недельный план ужинов и список покупок."},
  ar:{plan:"خطط أسبوعي",planPrompt:"أنشئ لي خطة عشاء أسبوعية شخصية وقائمة تسوق."},
  ja:{plan:"一週間を計画",planPrompt:"一週間の夕食プランと買い物リストを作ってください。"},
  zh:{plan:"规划一周",planPrompt:"请为我创建每周晚餐计划和购物清单。"}
};

const NILI_ASSISTANT_AUTH_COPY={
  en:{verifyTitle:"Verify your email",verifyDesc:"Enter your email and we will send a 6-digit verification code.",emailPlaceholder:"Email address",sendCode:"Send code",codePlaceholder:"6-digit code",verifyCode:"Verify and chat",changeEmail:"Use another email",privacy:"Your email is used only to secure this conversation.",codeSent:"We sent a verification code to your email.",verified:"Email verified. You can now chat with Nili.",invalidEmail:"Enter a valid email address.",registeredEmail:"This email is already registered. Please use another email address.",invalidCode:"Enter the 6-digit code.",mailError:"The verification email could not be sent. Please try again.",codeError:"The code is incorrect or has expired.",sessionError:"Please verify your email to continue.",close:"Close",send:"Send"},
  tr:{verifyTitle:"E-postanı doğrula",verifyDesc:"E-posta adresini yaz; sana 6 haneli bir doğrulama kodu gönderelim.",emailPlaceholder:"E-posta adresi",sendCode:"Kodu gönder",codePlaceholder:"6 haneli kod",verifyCode:"Doğrula ve sohbete başla",changeEmail:"Başka e-posta kullan",privacy:"E-posta adresin yalnızca bu sohbeti güvenli tutmak için kullanılır.",codeSent:"Doğrulama kodunu e-posta adresine gönderdik.",verified:"E-posta doğrulandı. Artık Nili ile sohbet edebilirsin.",invalidEmail:"Geçerli bir e-posta adresi yaz.",registeredEmail:"Bu e-posta sistemde kayıtlı. Lütfen başka bir e-posta adresi kullan.",invalidCode:"6 haneli kodu yaz.",mailError:"Doğrulama e-postası gönderilemedi. Tekrar dene.",codeError:"Kod hatalı veya süresi dolmuş.",sessionError:"Devam etmek için e-postanı doğrula.",close:"Kapat",send:"Gönder"},
  de:{verifyTitle:"E-Mail bestätigen",verifyDesc:"Gib deine E-Mail ein. Wir senden dir einen 6-stelligen Bestätigungscode.",emailPlaceholder:"E-Mail-Adresse",sendCode:"Code senden",codePlaceholder:"6-stelliger Code",verifyCode:"Bestätigen und chatten",changeEmail:"Andere E-Mail verwenden",privacy:"Deine E-Mail wird nur zur Sicherung dieses Chats verwendet.",codeSent:"Wir haben einen Bestätigungscode an deine E-Mail gesendet.",verified:"E-Mail bestätigt. Du kannst jetzt mit Nili chatten.",invalidEmail:"Gib eine gültige E-Mail-Adresse ein.",registeredEmail:"Diese E-Mail ist bereits registriert. Bitte verwende eine andere Adresse.",invalidCode:"Gib den 6-stelligen Code ein.",mailError:"Die Bestätigungs-E-Mail konnte nicht gesendet werden.",codeError:"Der Code ist falsch oder abgelaufen.",sessionError:"Bestätige deine E-Mail, um fortzufahren.",close:"Schließen",send:"Senden"},
  fr:{verifyTitle:"Vérifiez votre e-mail",verifyDesc:"Saisissez votre e-mail pour recevoir un code de vérification à 6 chiffres.",emailPlaceholder:"Adresse e-mail",sendCode:"Envoyer le code",codePlaceholder:"Code à 6 chiffres",verifyCode:"Vérifier et discuter",changeEmail:"Utiliser un autre e-mail",privacy:"Votre e-mail sert uniquement à sécuriser cette conversation.",codeSent:"Un code de vérification a été envoyé à votre e-mail.",verified:"E-mail vérifié. Vous pouvez maintenant discuter avec Nili.",invalidEmail:"Saisissez une adresse e-mail valide.",registeredEmail:"Cet e-mail est déjà enregistré. Veuillez utiliser une autre adresse.",invalidCode:"Saisissez le code à 6 chiffres.",mailError:"L'e-mail de vérification n'a pas pu être envoyé.",codeError:"Le code est incorrect ou expiré.",sessionError:"Vérifiez votre e-mail pour continuer.",close:"Fermer",send:"Envoyer"},
  es:{verifyTitle:"Verifica tu correo",verifyDesc:"Introduce tu correo y te enviaremos un código de verificación de 6 dígitos.",emailPlaceholder:"Correo electrónico",sendCode:"Enviar código",codePlaceholder:"Código de 6 dígitos",verifyCode:"Verificar y conversar",changeEmail:"Usar otro correo",privacy:"Tu correo se usa únicamente para proteger esta conversación.",codeSent:"Enviamos un código de verificación a tu correo.",verified:"Correo verificado. Ya puedes conversar con Nili.",invalidEmail:"Introduce un correo válido.",registeredEmail:"Este correo ya está registrado. Usa otra dirección de correo.",invalidCode:"Introduce el código de 6 dígitos.",mailError:"No se pudo enviar el correo de verificación.",codeError:"El código es incorrecto o ha caducado.",sessionError:"Verifica tu correo para continuar.",close:"Cerrar",send:"Enviar"},
  pt:{verifyTitle:"Verifique seu e-mail",verifyDesc:"Digite seu e-mail para receber um código de verificação de 6 dígitos.",emailPlaceholder:"Endereço de e-mail",sendCode:"Enviar código",codePlaceholder:"Código de 6 dígitos",verifyCode:"Verificar e conversar",changeEmail:"Usar outro e-mail",privacy:"Seu e-mail é usado apenas para proteger esta conversa.",codeSent:"Enviamos um código de verificação para seu e-mail.",verified:"E-mail verificado. Agora você pode conversar com Nili.",invalidEmail:"Digite um e-mail válido.",registeredEmail:"Este e-mail já está cadastrado. Use outro endereço de e-mail.",invalidCode:"Digite o código de 6 dígitos.",mailError:"Não foi possível enviar o e-mail de verificação.",codeError:"O código está incorreto ou expirou.",sessionError:"Verifique seu e-mail para continuar.",close:"Fechar",send:"Enviar"},
  ru:{verifyTitle:"Подтвердите электронную почту",verifyDesc:"Введите e-mail, и мы отправим 6-значный код подтверждения.",emailPlaceholder:"Электронная почта",sendCode:"Отправить код",codePlaceholder:"6-значный код",verifyCode:"Подтвердить и начать чат",changeEmail:"Использовать другой e-mail",privacy:"Ваш e-mail используется только для защиты этой беседы.",codeSent:"Код подтверждения отправлен на вашу почту.",verified:"Почта подтверждена. Теперь можно общаться с Nili.",invalidEmail:"Введите правильный адрес почты.",registeredEmail:"Этот адрес уже зарегистрирован. Используйте другой e-mail.",invalidCode:"Введите 6-значный код.",mailError:"Не удалось отправить письмо с кодом.",codeError:"Код неверен или истёк.",sessionError:"Подтвердите почту, чтобы продолжить.",close:"Закрыть",send:"Отправить"},
  ar:{verifyTitle:"تحقق من بريدك الإلكتروني",verifyDesc:"أدخل بريدك الإلكتروني وسنرسل رمز تحقق من 6 أرقام.",emailPlaceholder:"البريد الإلكتروني",sendCode:"إرسال الرمز",codePlaceholder:"رمز من 6 أرقام",verifyCode:"تحقق وابدأ الدردشة",changeEmail:"استخدم بريداً آخر",privacy:"يُستخدم بريدك فقط لتأمين هذه المحادثة.",codeSent:"أرسلنا رمز التحقق إلى بريدك الإلكتروني.",verified:"تم التحقق من البريد. يمكنك الآن الدردشة مع Nili.",invalidEmail:"أدخل بريداً إلكترونياً صالحاً.",registeredEmail:"هذا البريد مسجل بالفعل. استخدم عنوان بريد إلكتروني آخر.",invalidCode:"أدخل الرمز المكون من 6 أرقام.",mailError:"تعذر إرسال رسالة التحقق.",codeError:"الرمز غير صحيح أو منتهي الصلاحية.",sessionError:"تحقق من بريدك للمتابعة.",close:"إغلاق",send:"إرسال"},
  ja:{verifyTitle:"メールアドレスを確認",verifyDesc:"メールアドレスを入力すると、6桁の認証コードを送信します。",emailPlaceholder:"メールアドレス",sendCode:"コードを送信",codePlaceholder:"6桁のコード",verifyCode:"認証してチャット",changeEmail:"別のメールを使用",privacy:"メールはこの会話の安全確保にのみ使用されます。",codeSent:"認証コードをメールで送信しました。",verified:"メール認証が完了しました。Niliとチャットできます。",invalidEmail:"有効なメールアドレスを入力してください。",registeredEmail:"このメールは登録済みです。別のメールアドレスを使用してください。",invalidCode:"6桁のコードを入力してください。",mailError:"認証メールを送信できませんでした。",codeError:"コードが正しくないか期限切れです。",sessionError:"続行するにはメールを認証してください。",close:"閉じる",send:"送信"},
  zh:{verifyTitle:"验证您的电子邮箱",verifyDesc:"输入邮箱，我们将发送6位验证码。",emailPlaceholder:"电子邮箱",sendCode:"发送验证码",codePlaceholder:"6位验证码",verifyCode:"验证并开始聊天",changeEmail:"使用其他邮箱",privacy:"您的邮箱仅用于保护本次对话。",codeSent:"验证码已发送到您的邮箱。",verified:"邮箱验证成功。现在可以与 Nili 聊天。",invalidEmail:"请输入有效的邮箱地址。",registeredEmail:"此邮箱已注册，请使用其他邮箱地址。",invalidCode:"请输入6位验证码。",mailError:"无法发送验证邮件，请重试。",codeError:"验证码错误或已过期。",sessionError:"请验证邮箱后继续。",close:"关闭",send:"发送"}
};

function niliAssistantCopy(key){
  const planCopy=NILI_ASSISTANT_PLAN_COPY[currentLang] || NILI_ASSISTANT_PLAN_COPY.en;
  if(planCopy[key]) return planCopy[key];
  const authCopy=NILI_ASSISTANT_AUTH_COPY[currentLang] || NILI_ASSISTANT_AUTH_COPY.en;
  if(authCopy[key]) return authCopy[key];
  return NILI_ASSISTANT_COPY[currentLang]?.[key] ||
    NILI_ASSISTANT_COPY.en[key] ||
    key;
}

function updateNiliAssistantCopy(){
  document.querySelectorAll("[data-nili-assistant-copy]").forEach(element => {
    element.textContent=niliAssistantCopy(element.dataset.niliAssistantCopy);
  });
  document.querySelectorAll("[data-nili-assistant-placeholder]").forEach(element => {
    element.placeholder=niliAssistantCopy(element.dataset.niliAssistantPlaceholder);
  });
  document.querySelectorAll("[data-nili-assistant-aria]").forEach(element => {
    element.setAttribute("aria-label",niliAssistantCopy(element.dataset.niliAssistantAria));
  });
  const send=document.getElementById("niliAssistantSend");
  if(send) send.setAttribute("aria-label",niliAssistantCopy("send"));
  updateNiliAssistantContext();
}

function updateNiliAssistantContext(){
  const context=document.getElementById("niliAssistantContext");
  if(!context) return;
  const labels=selected.slice(0,5).map(getIngredientLabel);
  const suffix=selected.length>5 ? ` +${selected.length-5}` : "";
  context.innerHTML=selected.length
    ? `<strong>${escapeHtml(niliAssistantCopy("context"))}:</strong> ${escapeHtml(labels.join(" • ")+suffix)}`
    : `<strong>${escapeHtml(niliAssistantCopy("context"))}:</strong> ${escapeHtml(niliAssistantCopy("emptyContext"))}`;
}

function addNiliAssistantMessage(text,type="nili",extraClass=""){
  const messages=document.getElementById("niliAssistantMessages");
  if(!messages || !text) return null;
  const item=document.createElement("div");
  item.className=`nili-assistant-message is-${type}${extraClass ? ` ${extraClass}` : ""}`;
  item.textContent=text;
  messages.appendChild(item);
  messages.scrollTop=messages.scrollHeight;
  return item;
}

function niliAssistantStoredToken(){
  return localStorage.getItem(NILI_ASSISTANT_TOKEN_KEY) || "";
}

function niliAssistantSetAuthStatus(message="",success=false){
  const status=document.getElementById("niliAssistantAuthStatus");
  if(!status) return;
  status.textContent=message;
  status.classList.toggle("is-success",success);
}

function startNiliAssistantConversation(){
  if(niliAssistantStarted) return;
  addNiliAssistantMessage(selected.length
    ? niliAssistantCopy("greetingSelected")
    : niliAssistantCopy("greeting"));
  niliAssistantStarted=true;
}

function setNiliAssistantLocked(locked){
  const panel=document.querySelector(".nili-assistant-panel");
  panel?.classList.toggle("is-locked",locked);
  niliAssistantVerified=!locked;
  if(!locked){
    startNiliAssistantConversation();
    setTimeout(()=>document.getElementById("niliAssistantInput")?.focus(),120);
  }
}

function resetNiliAssistantVerification(){
  niliAssistantPendingEmail="";
  document.getElementById("niliAssistantEmailStep")?.classList.remove("is-hidden");
  document.getElementById("niliAssistantCodeStep")?.classList.add("is-hidden");
  document.getElementById("niliAssistantChangeEmail")?.classList.add("is-hidden");
  const code=document.getElementById("niliAssistantCode");
  if(code) code.value="";
  niliAssistantSetAuthStatus("");
}

async function validateNiliAssistantSession(){
  const token=niliAssistantStoredToken();
  if(!token){
    setNiliAssistantLocked(true);
    return false;
  }

  try{
    const response=await fetch(`${window.API_BASE}/nili-assistant/session`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${token}`
      },
      body:JSON.stringify({verificationToken:token})
    });
    const payload=await response.json();
    if(!response.ok || !payload.valid) throw new Error("Invalid assistant session");
    niliAssistantVerifiedEmail=payload.email || localStorage.getItem(NILI_ASSISTANT_EMAIL_KEY) || "";
    setNiliAssistantLocked(false);
    return true;
  }catch{
    localStorage.removeItem(NILI_ASSISTANT_TOKEN_KEY);
    localStorage.removeItem(NILI_ASSISTANT_EMAIL_KEY);
    niliAssistantVerifiedEmail="";
    setNiliAssistantLocked(true);
    return false;
  }
}

async function requestNiliAssistantCode(){
  const emailInput=document.getElementById("niliAssistantEmail");
  const button=document.getElementById("niliAssistantCodeRequest");
  const email=String(emailInput?.value || "").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    niliAssistantSetAuthStatus(niliAssistantCopy("invalidEmail"));
    emailInput?.focus();
    return;
  }

  if(button) button.disabled=true;
  niliAssistantSetAuthStatus("");
  try{
    const response=await fetch(`${window.API_BASE}/nili-assistant/request-code`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email,lang:currentLang})
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload?.code || "MAIL_FAILED");
    niliAssistantPendingEmail=email;
    document.getElementById("niliAssistantEmailStep")?.classList.add("is-hidden");
    document.getElementById("niliAssistantCodeStep")?.classList.remove("is-hidden");
    document.getElementById("niliAssistantChangeEmail")?.classList.remove("is-hidden");
    niliAssistantSetAuthStatus(niliAssistantCopy("codeSent"),true);
    document.getElementById("niliAssistantCode")?.focus();
  }catch(error){
    niliAssistantSetAuthStatus(
      error.message==="CODE_RATE_LIMIT"
        ? niliAssistantCopy("codeSent")
        : niliAssistantCopy("mailError")
    );
  }finally{
    if(button) button.disabled=false;
  }
}

async function verifyNiliAssistantCode(){
  const codeInput=document.getElementById("niliAssistantCode");
  const button=document.getElementById("niliAssistantCodeVerify");
  const code=String(codeInput?.value || "").replace(/\D/g,"").slice(0,6);
  if(code.length!==6 || !niliAssistantPendingEmail){
    niliAssistantSetAuthStatus(niliAssistantCopy("invalidCode"));
    codeInput?.focus();
    return;
  }

  if(button) button.disabled=true;
  niliAssistantSetAuthStatus("");
  try{
    const response=await fetch(`${window.API_BASE}/nili-assistant/verify-code`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:niliAssistantPendingEmail,code})
    });
    const payload=await response.json();
    if(!response.ok || !payload.token) throw new Error(payload?.code || "WRONG_CODE");
    localStorage.setItem(NILI_ASSISTANT_TOKEN_KEY,payload.token);
    localStorage.setItem(NILI_ASSISTANT_EMAIL_KEY,payload.email || niliAssistantPendingEmail);
    niliAssistantVerifiedEmail=payload.email || niliAssistantPendingEmail;
    niliAssistantSetAuthStatus(niliAssistantCopy("verified"),true);
    setNiliAssistantLocked(false);
  }catch{
    niliAssistantSetAuthStatus(niliAssistantCopy("codeError"));
  }finally{
    if(button) button.disabled=false;
  }
}

window.openNiliAssistant=function(){
  const assistant=document.getElementById("niliAssistant");
  if(!assistant) return;
  updateNiliAssistantCopy();
  assistant.classList.add("is-open");
  assistant.setAttribute("aria-hidden","false");
  document.getElementById("niliAssistantLauncher")?.setAttribute("aria-expanded","true");
  document.body.style.overflow="hidden";
  const suggestedEmail=
    localStorage.getItem(NILI_ASSISTANT_EMAIL_KEY) ||
    localStorage.getItem("creatorEmail") ||
    localStorage.getItem("niliUserEmail") ||
    "";
  const emailInput=document.getElementById("niliAssistantEmail");
  if(emailInput && !emailInput.value) emailInput.value=suggestedEmail;
  if(niliAssistantVerified){
    setNiliAssistantLocked(false);
  }else{
    setNiliAssistantLocked(true);
    validateNiliAssistantSession().then(valid=>{
      if(!valid) setTimeout(()=>document.getElementById("niliAssistantEmail")?.focus(),120);
    });
  }
};

window.closeNiliAssistant=function(){
  const assistant=document.getElementById("niliAssistant");
  if(!assistant) return;
  assistant.classList.remove("is-open");
  assistant.setAttribute("aria-hidden","true");
  document.getElementById("niliAssistantLauncher")?.setAttribute("aria-expanded","false");
  document.body.style.overflow="";
};

function setAssistantTodayPreference(preference){
  if(!preference || !["easy","economic","healthy","elegant","kids"].includes(preference)) return;
  todayCookState.preference=preference;
  const group=document.querySelector('[data-today-group="preference"]');
  group?.querySelectorAll("button").forEach(button => {
    button.classList.toggle("is-active",button.dataset.value===preference);
  });
}

function handleNiliAssistantAction(payload){
  const action=payload?.action || "none";
  if(action==="find_recipes"){
    if(!selected.length){
      addNiliAssistantMessage(niliAssistantCopy("chooseFirst"));
      return;
    }
    const ingredients=[...selected];
    setTimeout(() => {
      closeNiliAssistant();
      getRecipesFromIngredients(ingredients);
    },500);
    return;
  }
  if(action==="open_today"){
    setAssistantTodayPreference(payload?.preference || "easy");
    setTimeout(() => {
      closeNiliAssistant();
      openTodayCookFlow();
    },500);
    return;
  }
  if(action==="open_scan"){
    setTimeout(() => {
      closeNiliAssistant();
      document.getElementById("photoGallery")?.click();
    },350);
    return;
  }
  if(action==="open_ingredients"){
    setTimeout(() => {
      closeNiliAssistant();
      document.querySelector(".category-panel")?.scrollIntoView({behavior:"smooth",block:"center"});
    },350);
    return;
  }
  if(action==="open_meal_plan"){
    setTimeout(() => {
      closeNiliAssistant();
      window.location.href=`meal-plan.html?lang=${encodeURIComponent(currentLang)}`;
    },350);
  }
}

async function askNiliAssistant(message){
  const clean=String(message || "").trim();
  if(!clean) return;
  const verificationToken=niliAssistantStoredToken();
  if(!niliAssistantVerified || !verificationToken){
    setNiliAssistantLocked(true);
    niliAssistantSetAuthStatus(niliAssistantCopy("sessionError"));
    document.getElementById("niliAssistantEmail")?.focus();
    return;
  }
  const status=document.getElementById("niliAssistantStatus");
  const send=document.getElementById("niliAssistantSend");
  addNiliAssistantMessage(clean,"user");
  const thinking=addNiliAssistantMessage(niliAssistantCopy("thinking"),"nili","is-thinking");
  if(status) status.textContent="";
  if(send) send.disabled=true;

  try{
    const response=await fetch(`${window.API_BASE}/nili-assistant`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${verificationToken}`
      },
      body:JSON.stringify({
        message:clean,
        ingredients:selected.map(getIngredientLabel),
        ingredientIds:[...selected],
        lang:currentLang,
        verificationToken
      })
    });
    const payload=await response.json();
    if(response.status===401 && payload?.code==="EMAIL_VERIFICATION_REQUIRED"){
      localStorage.removeItem(NILI_ASSISTANT_TOKEN_KEY);
      localStorage.removeItem(NILI_ASSISTANT_EMAIL_KEY);
      niliAssistantVerifiedEmail="";
      setNiliAssistantLocked(true);
      niliAssistantSetAuthStatus(niliAssistantCopy("sessionError"));
      thinking?.remove();
      return;
    }
    if(!response.ok) throw new Error(payload?.error || "Assistant failed");
    thinking?.remove();
    addNiliAssistantMessage(payload.reply || niliAssistantCopy("error"));
    // Keep the conversation open after every answer; navigation must be user initiated.
  }catch(error){
    thinking?.remove();
    if(status) status.textContent=niliAssistantCopy("error");
    console.error("NILI ASSISTANT ERROR:",error);
  }finally{
    if(send) send.disabled=false;
  }
}

document.addEventListener("DOMContentLoaded",() => {
  updateNiliAssistantCopy();
  document.getElementById("niliAssistantCodeRequest")?.addEventListener("click",requestNiliAssistantCode);
  document.getElementById("niliAssistantCodeVerify")?.addEventListener("click",verifyNiliAssistantCode);
  document.getElementById("niliAssistantChangeEmail")?.addEventListener("click",()=>{
    resetNiliAssistantVerification();
    document.getElementById("niliAssistantEmail")?.focus();
  });
  document.getElementById("niliAssistantEmail")?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      event.preventDefault();
      requestNiliAssistantCode();
    }
  });
  document.getElementById("niliAssistantCode")?.addEventListener("input",event=>{
    event.target.value=event.target.value.replace(/\D/g,"").slice(0,6);
  });
  document.getElementById("niliAssistantCode")?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){
      event.preventDefault();
      verifyNiliAssistantCode();
    }
  });
  document.getElementById("niliAssistant")?.addEventListener("click",event => {
    if(event.target.id==="niliAssistant") closeNiliAssistant();
  });
  document.getElementById("niliAssistantForm")?.addEventListener("submit",event => {
    event.preventDefault();
    const input=document.getElementById("niliAssistantInput");
    const message=input?.value || "";
    if(input) input.value="";
    askNiliAssistant(message);
  });
  document.querySelectorAll("[data-assistant-prompt]").forEach(button => {
    button.addEventListener("click",() => {
      const key=`${button.dataset.assistantPrompt}Prompt`;
      askNiliAssistant(niliAssistantCopy(key));
    });
  });
});

window.removeSelectedIngredient = function(item){

  selected =
  selected.filter(x => x !== item);

  saveState();
  syncIngredientModalSelection();
  renderChecklist();
};

function clearSelectedIngredients(){

  selected = [];
  saveState();
  syncIngredientModalSelection();

  const tray =
  document.getElementById("selectedTray");

  const itemsBox =
  document.getElementById("selectedTrayItems");

  const confirmCheck =
  document.getElementById("confirmCheck");

  if(tray){
    tray.classList.add("has-items");
  }

  if(itemsBox){
    itemsBox.innerHTML = `
      <div class="empty-selected-message">
        No ingredients selected yet.
      </div>
    `;
  }

  if(confirmCheck){
    confirmCheck.checked = false;
  }

}

function closeSelectedTray(){

  const tray =
  document.getElementById("selectedTray");

  if(tray){
    tray.classList.remove("has-items");
  }

}

window.addEventListener("DOMContentLoaded", () => {

  loadUserFavorites();

  selected = [];

  const tray =
  document.getElementById("selectedTray");

  const itemsBox =
  document.getElementById("selectedTrayItems");

  const confirmCheck =
  document.getElementById("confirmCheck");

  if(tray){
    tray.classList.remove("has-items");
  }

  if(itemsBox){
    itemsBox.innerHTML = "";
  }

  if(confirmCheck){
    confirmCheck.checked = false;
  }

});

function updateUserMenuText(){
  setText("userDashboardLink", t("menuDashboard"));
  const mealPlanLabels={
    en:"Weekly Meal Plan",tr:"Haftalık Yemek Planı",de:"Wochenplan",fr:"Programme de la semaine",
    es:"Plan semanal",pt:"Plano semanal",ru:"План на неделю",ar:"خطة الوجبات الأسبوعية",
    ja:"週間献立",zh:"每周膳食计划"
  };
  setText("userMealPlanLink",mealPlanLabels[currentLang] || mealPlanLabels.en);
  setText("userAddRecipeLink", t("menuAddRecipe"));
  setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
  setText("userContactBtn", "✉ " + t("menuContact"));
  setText("userHowLink", t("menuHowItWorks"));
  setText("userLogoutBtn", t("menuLogout"));
}


let creatorMode = "signup";

window.setCreatorMode = function(mode){

  creatorMode = mode;

  const signupTab = document.getElementById("signupTab");
  const loginTab = document.getElementById("loginTab");
  const title = document.getElementById("creatorCardTitle");
  const desc = document.getElementById("creatorCardDesc");
  const usernameInput = document.getElementById("creatorUsernameInput");
  const emailInput = document.getElementById("creatorEmailInput");

  const passwordInput =
document.getElementById("creatorPasswordInput");

  if(signupTab){
    signupTab.classList.toggle("active", mode === "signup");
  }

  if(loginTab){
    loginTab.classList.toggle("active", mode === "login");
  }

  if(title){
    title.textContent =
    mode === "signup"
      ? t("becomeCreator")
      : t("creatorLogin");
  }

  if(desc){
    desc.textContent =
    mode === "signup"
      ? t("creatorDesc")
      : t("creatorLoginDesc");
  }

  if(usernameInput){
    usernameInput.style.display =
    mode === "signup" ? "block" : "none";

    usernameInput.placeholder = t("username");
  }

  if(emailInput){
    emailInput.type =
    mode === "signup" ? "email" : "text";

    emailInput.placeholder =
    mode === "signup"
      ? t("email")
      : t("emailOrUsername");
  }

  if(passwordInput){
  passwordInput.placeholder =
  creatorText("password", "Password");
}

};

const langSelectEl =
document.getElementById("langSelect");

function updateCreatorLinks(){
  document
    .querySelectorAll('a[href="creator.html"], a[href="/creator.html"], a[href="creator-dashboard.html"], a[href="/creator-dashboard.html"]')
    .forEach(a => {
      const cleanHref = a.getAttribute("href").split("?")[0];
      a.setAttribute("href", cleanHref + "?lang=" + currentLang);
    });
}

function updateAllLinks(){

  document.querySelectorAll("a[href]").forEach(a => {

    const href = a.getAttribute("href");

    if(
      !href ||
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ){
      return;
    }

    const cleanHref = href.split("?")[0];

    a.setAttribute(
      "href",
      cleanHref + "?lang=" + currentLang
    );

  });

}

if(langSelectEl){

  langSelectEl.value = currentLang;

  langSelectEl.addEventListener("change", () => {

    currentLang = langSelectEl.value;

    localStorage.setItem("niliLang", currentLang);
    localStorage.setItem("lang", currentLang);

    applyLanguage();
    updateTodayCookCopy();
    updateNiliAssistantCopy();
    updateCreatorLinks();

    updateAllLinks();

    if(typeof renderChecklist === "function"){
      renderChecklist();
    }

    if(
      ingredientModal &&
      ingredientModal.style.display === "flex" &&
      activeCategoryKey
    ){
      openIngredientModal(
        activeCategoryKey,
        CATEGORY_DATA[activeCategoryKey] || []
      );
    }

  });

  applyLanguage();
  updateCreatorLinks();
  updateAllLinks();

}


/* =========================
   CREATOR AUTH FINAL FIX
========================= */

window.creatorMode =
window.creatorMode || "signup";

function creatorText(key, fallback){
  if(typeof t === "function"){
    return t(key);
  }
  return fallback;
}

window.setCreatorMode = function(mode){

  window.creatorMode = mode;

  const signupTab =
  document.getElementById("signupTab");

  const loginTab =
  document.getElementById("loginTab");

  const title =
  document.getElementById("creatorCardTitle");

  const desc =
  document.getElementById("creatorCardDesc");

  const usernameInput =
  document.getElementById("creatorUsernameInput");

  const emailInput =
  document.getElementById("creatorEmailInput");

  if(signupTab){
    signupTab.classList.toggle("active", mode === "signup");
  }

  if(loginTab){
    loginTab.classList.toggle("active", mode === "login");
  }

  if(title){
    title.textContent =
    mode === "signup"
      ? creatorText("becomeCreator", "Become a creator")
      : creatorText("creatorLogin", "Creator login");
  }

  if(desc){
    desc.textContent =
    mode === "signup"
      ? creatorText("creatorDesc", "Upload recipes and earn rewards in the future.")
      : creatorText("creatorLoginDesc", "Continue to your recipe upload page.");
  }

  if(usernameInput){
    usernameInput.style.display =
    mode === "signup" ? "block" : "none";

    usernameInput.placeholder =
    creatorText("username", "Username");
  }

  if(emailInput){
    emailInput.type =
    mode === "signup" ? "email" : "text";

    emailInput.placeholder =
    mode === "signup"
      ? creatorText("email", "Email address")
      : creatorText("emailOrUsername", "Email or username");
  }

};

window.API_BASE =
  window.API_BASE ||
  (
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:3000"
      : "https://api.niliskitchen.com"
  );

window.goToCreatorPage = async function(){

  console.log("GO TO CREATOR CLICKED");

  const usernameInput =
  document.getElementById("creatorUsernameInput");

  const emailInput =
  document.getElementById("creatorEmailInput");

  const passwordInput =
  document.getElementById("creatorPasswordInput");

  const username =
  usernameInput ? usernameInput.value.trim() : "";

  const emailOrUser =
  emailInput ? emailInput.value.trim() : "";

  const password =
  passwordInput ? passwordInput.value.trim() : "";

  if(window.creatorMode === "signup" && !username){
    alert(creatorText("alertUsername", "Please enter a username."));
    return;
  }

  if(!emailOrUser){
    alert(
      window.creatorMode === "signup"
        ? creatorText("alertEmail", "Please enter your email.")
        : creatorText("alertEmailOrUser", "Please enter your email or username.")
    );
    return;
  }

  if(!password){
    alert(creatorText("alertPassword", "Please enter your password."));
    return;
  }

  try{

    const res = await fetch(`${window.API_BASE}/creator-auth`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  credentials: "include",
  body: JSON.stringify({
    mode: window.creatorMode,
    username: username,
    emailOrUser: emailOrUser,
    password: password
  })
});

    const data = await res.json();

    console.log("CREATOR AUTH RESPONSE:", data);

    if(!res.ok){
      alert(data.error || "Creator auth failed");
      return;
    }

    localStorage.setItem("creatorMode", window.creatorMode);
    localStorage.setItem("creatorUsername", data.username || username);
    localStorage.setItem("creatorEmail", data.email || emailOrUser);
    localStorage.setItem("creatorEmailOrUser", data.email || emailOrUser);

    const savedLang =
  localStorage.getItem("niliLang") ||
  localStorage.getItem("lang") ||
  currentLang ||
  "en";

window.location.href = `${window.location.origin}/?lang=${savedLang}`;

  }catch(err){

  showUserFriendlyError("creator-auth", err);

  alert(
    t("serviceTemporaryUnavailable") ||
    "Service is temporarily unavailable due to a technical issue. Please try again later."
  );

}

};

window.toggleCreatorPassword = function(){

  const passwordInput =
  document.getElementById("creatorPasswordInput");

  const showBtn =
  document.querySelector(".creator-password-wrap button");

  if(!passwordInput) return;

  const willShow =
  passwordInput.type === "password";

  passwordInput.type =
  willShow ? "text" : "password";

  if(showBtn){
    showBtn.textContent =
    willShow
      ? creatorText("hide", "Hide")
      : creatorText("show", "Show");
  }

};

document.addEventListener("DOMContentLoaded", () => {

  currentLang = getSavedLang();

  if(langSelectEl){
    langSelectEl.value = currentLang;
  }

  applyLanguage();

  const signupTab =
  document.getElementById("signupTab");

  const loginTab =
  document.getElementById("loginTab");

  const continueBtn =
  document.querySelector(".creator-continue-btn");

  if(signupTab){
    signupTab.onclick = () => window.setCreatorMode("signup");
  }

  if(loginTab){
    loginTab.onclick = () => window.setCreatorMode("login");
  }

  if(continueBtn){
    continueBtn.onclick = () => window.goToCreatorPage();
  }

  if (window.setCreatorMode) {
    window.setCreatorMode("signup");
  }

if(langSelectEl){
  langSelectEl.value = currentLang;
}

});

window.toggleLangMenu = function(){
  const box = document.getElementById("langOptions");
  if(box){
    box.classList.toggle("open");
  }
};

async function refreshVisibleRecipesForLanguage(){
  if(
    !document.body.classList.contains("show-recipes-page") ||
    isRecipeLangRefreshing
  ){
    return;
  }

  const detailWasOpen =
    document.body.classList.contains("recipe-full-page-open");
  const previousRecipeId = activeRecipeId;

  isRecipeLangRefreshing = true;

  try{
    if(lastRecipeIngredients.length){
      await getRecipesFromIngredients([...lastRecipeIngredients]);
    }else if(lastWorldSearchPayload){
      const requestPayload = {
        ...lastWorldSearchPayload,
        lang: currentLang
      };

      lastWorldSearchPayload = requestPayload;

      const response = await fetch(`${window.API_BASE}/discover-recipes`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(requestPayload)
      });
      const payload = await response.json();

      if(!response.ok){
        throw new Error(payload.error || "Recipe translation failed");
      }

      currentRecipeSearchMeta = payload.meta || null;
      renderRecipes(Array.isArray(payload.recipes) ? payload.recipes : []);
    }else{
      return;
    }

    if(detailWasOpen && previousRecipeId != null){
      const translatedRecipe = currentRecipes.find(
        recipe => String(recipe.id) === String(previousRecipeId)
      );

      if(translatedRecipe){
        openRecipe(translatedRecipe.id);
      }
    }
  }catch(error){
    console.error("VISIBLE RECIPE LANGUAGE REFRESH ERROR:", error);
  }finally{
    isRecipeLangRefreshing = false;
  }
}

window.setLang = function(lang){

  currentLang = lang;

  localStorage.setItem("niliLang", lang);
  localStorage.setItem("lang", lang);

  const flagMap = {
    en: "/flags/en.svg",
    tr: "/flags/tr.svg",
    ru: "/flags/ru.svg",
    fr: "/flags/fr.svg",
    es: "/flags/es.svg",
    pt: "/flags/pt.svg",
    ar: "/flags/ar.svg",
    de: "/flags/de.svg",
    ja: "/flags/ja.svg",
    zh: "/flags/zh.svg"
  };

  const flag =
    document.getElementById("langBtnFlag");

  const text =
    document.getElementById("langBtnText");

  const box =
    document.getElementById("langOptions");

  if(flag){
    flag.src = flagMap[lang] || flagMap.en;
  }

  if(text){
    text.textContent = lang.toUpperCase();
  }

  if(box){
    box.classList.remove("open");
  }

   applyLanguage();
  updateTodayCookCopy();
  updateNiliAssistantCopy();

  if(typeof initUserSessionMenu === "function"){
    initUserSessionMenu();
  }

  applyLanguage();

  if(typeof updateCreatorLinks === "function"){
    updateCreatorLinks();
  }

  if(typeof updateAllLinks === "function"){
    updateAllLinks();
  }

  if(typeof renderChecklist === "function"){
    renderChecklist();
  }

  if(typeof loadMobileNiliPicks === "function"){
    loadMobileNiliPicks();
  }

  refreshVisibleRecipesForLanguage();

  if(
    ingredientModal &&
    ingredientModal.style.display === "flex" &&
    activeCategoryKey
  ){
    openIngredientModal(
      activeCategoryKey,
      CATEGORY_DATA[activeCategoryKey] || []
    );
  }

  const dashboardLink = document.getElementById("userDashboardLink");
  const addRecipeLink = document.getElementById("userAddRecipeLink");
  const favoritesBtn = document.getElementById("userFavoritesBtn");
  const howLink = document.getElementById("userHowLink");
  const contactBtn = document.getElementById("userContactBtn");
  const logoutBtn = document.getElementById("userLogoutBtn");

  if(dashboardLink) dashboardLink.textContent = t("menuDashboard");
  if(addRecipeLink) addRecipeLink.textContent = t("menuAddRecipe");
  if(favoritesBtn) favoritesBtn.textContent = "❤️ " + t("menuFavorites");
  if(howLink) howLink.textContent = t("menuHowItWorks");
  if(contactBtn) contactBtn.textContent = "✉ " + t("menuContact");
  if(logoutBtn) logoutBtn.textContent = t("menuLogout");

};

document.querySelectorAll(".hero-strip-button").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    saveLang(currentLang);
    window.location.href =
      "how-it-works.html?lang=" + encodeURIComponent(currentLang);
  });
});

function showUserFriendlyError(source, err){

  const message =
    t("serviceTemporaryUnavailable") ||
    "Service is temporarily unavailable due to a technical issue. Please try again later.";

  if(statusText){
    statusText.innerText = message;
  }

  console.error("APP ERROR:", source, err);

  fetch(`${API_BASE}/send-error-alert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: source || "frontend",
      error: err?.message || String(err),
      page: window.location.href,
      time: new Date().toISOString()
    })
  }).catch(() => {});

}

function getFavorites(){
  return JSON.parse(localStorage.getItem("niliFavorites") || "[]");
}

function saveFavorites(favorites){
  localStorage.setItem("niliFavorites", JSON.stringify(favorites));
}

async function toggleFavorite(recipeId){

  const email =
  localStorage.getItem("creatorEmail") ||
  localStorage.getItem("niliUserEmail");

if(!email){
  openSignupInvite();
  return;
}

  if(!isUserLoggedIn()){
    openSignupInvite();
    return;
  }

  let favorites = getFavorites();

  const recipe =
    currentRecipes.find(r => String(r.id) === String(recipeId));

  const exists =
    favorites.some(item => String(item.id) === String(recipeId));

  if(exists){
    favorites =
      favorites.filter(item => String(item.id) !== String(recipeId));
  }else if(recipe){
    favorites.push(recipe);
  }

  if(recipe){

  try {
    const response = await fetch(`${window.API_BASE}/user/favorites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        recipe
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Favorite save failed");
    }

    favorites = Array.isArray(data.favorites) ? data.favorites : favorites;
  } catch (err) {
    console.log("FAVORITE SAVE ERROR:", err);
  }

}

  saveFavorites(favorites);
  renderFavoritesUI();
}

function renderFavoritesUI(){
  const favorites = getFavorites();

  document.querySelectorAll(".favorite-btn").forEach(btn => {
    const id = btn.dataset.recipeId;

    const active =
      favorites.some(item => String(item.id) === String(id));

    btn.textContent = active ? "❤️" : "🤍";
    btn.classList.toggle("active", active);
  });
}

async function loadUserFavorites(){

  const email =
    localStorage.getItem("creatorEmail") ||
    localStorage.getItem("niliUserEmail");

  if(!email) return;

  try{

    const res =
      await fetch(
        `${window.API_BASE}/user/favorites/${encodeURIComponent(email)}`
      );

    const data =
      await res.json();

    if(data.success){
      localStorage.setItem(
        "niliFavorites",
        JSON.stringify(data.favorites || [])
      );
    }

  }catch(err){
    console.log("LOAD FAVORITES ERROR:", err);
  }

}

window.addEventListener("DOMContentLoaded", () => {
  const hash = location.hash;
  const savedRecipes = localStorage.getItem("niliLastRecipes");

  if(!savedRecipes) return;

  if(hash === "#recipes" || hash.startsWith("#recipe-")){
    const recipes = JSON.parse(savedRecipes);

    currentRecipes = recipes;
    recipePage = 1;
    renderRecipes(recipes);

    if(hash.startsWith("#recipe-")){
      const id = hash.replace("#recipe-", "");

      setTimeout(() => {
        openRecipe(id);
      }, 200);
    }
  }
});

function isUserLoggedIn(){
  return !!localStorage.getItem("creatorEmail") ||
         !!localStorage.getItem("niliUserEmail");
}

function openSignupInvite(){
  const modal = document.getElementById("signupInviteModal");

  if(modal){
    modal.style.display = "flex";
  }

  if(typeof setCreatorMode === "function"){
    setCreatorMode(window.creatorMode || "signup");
  }

  translateSignupPopup();
}

function closeSignupInvite(){
  const modal = document.getElementById("signupInviteModal");
  if(modal){
    modal.style.display = "none";
  }
  returnHomeAfterOverlayClose();
}

function goToSignup(){
  window.location.href = "creator.html?lang=" + currentLang;
}

 function checkGuestSearchLimit(){
  if(isUserLoggedIn()){
    return true;
  }

  let count =
    Number(localStorage.getItem("guestSearchCount") || "0");

  count++;

  localStorage.setItem("guestSearchCount", String(count));

  if(count > 3){
    openSignupInvite();
    return false;
  }

  return true;
}

function initUserSessionMenu(){
  const username =
    localStorage.getItem("creatorUsername") ||
    localStorage.getItem("niliCreatorUsername") ||
    localStorage.getItem("niliUsername");

  const email =
    localStorage.getItem("creatorEmail") ||
    localStorage.getItem("niliCreatorEmail") ||
    localStorage.getItem("niliUserEmail");

  const userMenu = document.getElementById("userMenu");
  const userMenuName = document.getElementById("userMenuName");

  if(!userMenu || !userMenuName) return;

  userMenu.style.display = "block";

if(username || email){
  userMenuName.textContent = username || email;
}else{
  userMenuName.textContent = t("loginButton") || "Login";
  userMenu.classList.remove("open");
}

  const dashLink = document.getElementById("userDashboardLink");
  const mealPlanLink = document.getElementById("userMealPlanLink");
  const addLink = document.getElementById("userAddRecipeLink");
  const howLink = document.getElementById("userHowLink");

  if(dashLink){
    dashLink.href = "creator-dashboard.html?lang=" + currentLang;
  }

  if(addLink){
    addLink.href = "creator.html?lang=" + currentLang;
  }

  if(mealPlanLink){
    mealPlanLink.href = "meal-plan.html?lang=" + currentLang;
  }

  if(howLink){
  howLink.href = "how-it-works.html?lang=" + currentLang;
}
}

const userMenuBtn = document.getElementById("userMenuBtn");
const userMenu = document.getElementById("userMenu");

if(userMenuBtn && userMenu){
  userMenuBtn.addEventListener("click", () => {

    if(isUserLoggedIn()){
      userMenu.classList.toggle("open");
    }else{
      openSignupInvite();
     }

  });

 if(!isUserLoggedIn()){
  const userMenuName = document.getElementById("userMenuName");
  if(userMenuName){
    userMenuName.textContent = t("loginButton");
  }
}
}

setText("userDashboardLink", t("menuDashboard"));
const mealPlanMenuLabels={
  en:"Weekly Meal Plan",tr:"Haftalık Yemek Planı",de:"Wochenplan",fr:"Programme de la semaine",
  es:"Plan semanal",pt:"Plano semanal",ru:"План на неделю",ar:"خطة الوجبات الأسبوعية",
  ja:"週間献立",zh:"每周膳食计划"
};
setText("userMealPlanLink",mealPlanMenuLabels[currentLang] || mealPlanMenuLabels.en);
setText("userAddRecipeLink", t("menuAddRecipe"));
setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
setText("userContactBtn", "✉ " + t("menuContact"));
setText("userLogoutBtn", t("menuLogout"));


function logoutUser(){
  localStorage.removeItem("creatorUsername");
  localStorage.removeItem("creatorEmail");
  localStorage.removeItem("creatorEmailOrUser");
  localStorage.removeItem("creatorMode");
  localStorage.removeItem("niliCreatorUsername");
  localStorage.removeItem("niliCreatorEmail");
  localStorage.removeItem("niliUserEmail");
  localStorage.removeItem("niliUsername");
  localStorage.removeItem("niliFavorites");

  const userMenu = document.getElementById("userMenu");
  if(userMenu){
    userMenu.style.display = "none";
    userMenu.classList.remove("open");
  }

  const savedLang =
  localStorage.getItem("niliLang") ||
  localStorage.getItem("lang") ||
  "en";

location.href = "/?lang=" + savedLang;

console.log("RETURN LANG:", localStorage.getItem("niliLang"));
console.log("RETURN LANG2:", localStorage.getItem("lang"));
console.log("CURRENT LANG:", currentLang);
}

initUserSessionMenu();

loadUserFavorites();

function backToHome(){
  history.replaceState(null, "", location.pathname);

  document.body.classList.remove("show-recipes-page");
  document.body.classList.remove("hide-mobile-top-menu");

  const hero = document.querySelector(".hero");
  if(hero){
    hero.style.display = "";
  }

  if(result){
    result.innerHTML = "";
    result.style.display = "none";
  }

  const actions = document.getElementById("recipeResultActions");
  if(actions){
    actions.remove();
  }
}

function nextRecipePage(){
  const totalPages = Math.min(2, Math.max(1, Math.ceil(currentRecipes.length / recipesPerPage)));
  if(recipePage >= totalPages) return;
  recipePage++;
  document.body.classList.add("show-recipes-page");
  document.body.classList.add("hide-mobile-top-menu");
  renderRecipes(currentRecipes, true);

  const sidebar = document.getElementById("sidebar");
  if(sidebar && window.innerWidth > 980){
    sidebar.style.setProperty("display", "block", "important");
    sidebar.style.setProperty("visibility", "visible", "important");
    sidebar.style.setProperty("opacity", "1", "important");
  }
}

function previousRecipePage(){
  if(recipePage <= 1) return;
  recipePage--;
  renderRecipes(currentRecipes, true);
}

function syncIngredientModalSelection(){
  if(!ingredientModalItems) return;

  ingredientModalItems
    .querySelectorAll(".modal-ingredient-btn")
    .forEach(button => {
      const value = String(button.dataset.value || "").trim().toLowerCase();
      const isActive = selected.includes(value);
      const mark = button.querySelector(".ingredient-mark");

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      if(mark) mark.textContent = isActive ? "✓" : "+";
    });

  renderIngredientModalSummary();
}

function openFavoritesPage(){
  const favorites = getFavorites();

  if(!favorites.length){
    const emptyFavorites = {
      en:"No favorite recipes yet.",tr:"Henüz favori tarifiniz yok.",de:"Noch keine Lieblingsrezepte.",
      fr:"Aucune recette favorite pour le moment.",es:"Aún no hay recetas favoritas.",pt:"Ainda não há receitas favoritas.",
      ru:"Пока нет избранных рецептов.",ar:"لا توجد وصفات مفضلة بعد.",ja:"お気に入りのレシピはまだありません。",zh:"暂无收藏的食谱。"
    };
    alert(emptyFavorites[currentLang] || emptyFavorites.en);
    return;
  }

  recipePage = 1;
  renderRecipes(favorites);
}

function getLoggedUserEmail(){
  return (
    localStorage.getItem("creatorEmail") ||
    localStorage.getItem("niliCreatorEmail") ||
    localStorage.getItem("niliUserEmail") ||
    ""
  );
}

function getLoggedUserName(){
  return (
    localStorage.getItem("creatorUsername") ||
    localStorage.getItem("niliCreatorUsername") ||
    localStorage.getItem("niliUsername") ||
    ""
  );
}

window.openContactModal = function(){
  const modal = document.getElementById("contactModal");
  const nameInput = document.getElementById("contactName");
  const emailInput = document.getElementById("contactEmail");
  const messageInput = document.getElementById("contactMessage");
  const status = document.getElementById("contactStatus");

  if(!modal) return;

  if(nameInput && !nameInput.value) nameInput.value = getLoggedUserName();
  if(emailInput && !emailInput.value) emailInput.value = getLoggedUserEmail();
  if(status) status.textContent = "";

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    (messageInput || emailInput || nameInput)?.focus();
  }, 80);
};

window.closeContactModal = function(){
  const modal = document.getElementById("contactModal");
  if(!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  returnHomeAfterOverlayClose();
};

window.sendContactMessage = async function(){
  const nameInput = document.getElementById("contactName");
  const emailInput = document.getElementById("contactEmail");
  const messageInput = document.getElementById("contactMessage");
  const status = document.getElementById("contactStatus");
  const submit = document.getElementById("contactSubmitBtn");
  const message = messageInput?.value.trim() || "";

  if(!message){
    if(status) status.textContent = t("contactRequired");
    messageInput?.focus();
    return;
  }

  if(status) status.textContent = t("contactSending");
  if(submit) submit.disabled = true;

  try{
    const res = await fetch(`${window.API_BASE}/contact-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput?.value.trim() || "",
        email: emailInput?.value.trim() || "",
        message,
        lang: currentLang,
        page: location.pathname + location.search + location.hash
      })
    });

    const data = await res.json().catch(() => ({}));

    if(!res.ok || !data.success){
      throw new Error(data.error || "Contact failed");
    }

    if(status) status.textContent = t("contactDone");
    if(messageInput) messageInput.value = "";
  }catch(error){
    console.error("CONTACT MESSAGE ERROR:", error);
    if(status) status.textContent = t("contactError");
  }finally{
    if(submit) submit.disabled = false;
  }
};

document.addEventListener("click", event => {
  const contactModal = document.getElementById("contactModal");
  if(contactModal && event.target === contactModal){
    closeContactModal();
  }
});

document.addEventListener("keydown", event => {
  const contactModal = document.getElementById("contactModal");
  if(event.key === "Escape" && contactModal?.classList.contains("open")){
    closeContactModal();
  }
});

function closeOpenMenus(){
  document.getElementById("userMenu")?.classList.remove("open");
  document.getElementById("langOptions")?.classList.remove("open");
}

function closeOverlayFromBackdrop(event){
  const target = event.target;

  if(target?.id === "ingredientModal"){
    closeIngredientModal();
    return true;
  }

  if(target?.id === "selectedTray"){
    closeSelectedTray();
    return true;
  }

  if(target?.id === "worldSearchModal"){
    closeWorldSearch();
    return true;
  }

  if(target?.id === "signupInviteModal"){
    closeSignupInvite();
    return true;
  }

  if(target?.id === "contactModal"){
    closeContactModal();
    return true;
  }

  if(target?.id === "howItWorksModal"){
    closeHowItWorks();
    return true;
  }

  if(target?.id === "modal"){
    closeModal();
    return true;
  }

  return false;
}

document.addEventListener("click", event => {
  if(closeOverlayFromBackdrop(event)){
    return;
  }

  if(!event.target.closest("#userMenu, #langWrapper, #langOptions")){
    closeOpenMenus();
  }
});

document.addEventListener("keydown", event => {
  if(event.key !== "Escape") return;

  closeOpenMenus();

  if(ingredientModal?.style.display === "flex"){
    closeIngredientModal();
  }

  if(document.getElementById("selectedTray")?.classList.contains("has-items")){
    closeSelectedTray();
  }

  if(document.getElementById("worldSearchModal")?.classList.contains("open")){
    closeWorldSearch();
  }

  if(document.getElementById("signupInviteModal")?.style.display === "flex"){
    closeSignupInvite();
  }

  if(document.getElementById("howItWorksModal")?.style.display === "flex"){
    closeHowItWorks();
  }
});

function openHowItWorks(){
  applyLanguage();

  const moreInfoLink =
  document.getElementById("howMoreInfoLink");

if(moreInfoLink){
  moreInfoLink.href =
    "how-it-works.html?lang=" + currentLang;
}
}

function closeHowItWorks(){
  const modal = document.getElementById("howItWorksModal");
  if(modal){
    modal.style.display = "none";
  }

  localStorage.setItem("niliHowSeen", "1");
  returnHomeAfterOverlayClose();
}

window.addEventListener("load", () => {
  if(!localStorage.getItem("niliHowSeen")){
    setTimeout(openHowItWorks, 700);
  }
});

async function autoDetectLanguageAndShowIntro(){

  console.log("AUTO LANG STARTED");

 if(localStorage.getItem("niliLangManual") === "1"){
  console.log("STOP: manual language selected");
  return;
}

  try{
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 2500);

  const res = await fetch("https://ipapi.co/json/", {
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  const data = await res.json();

    const country = data.country_code;

    console.log("IP COUNTRY:", country);

    const langMap = {
  // Turkish
  TR: "tr",
  CY: "tr",

  // Russian / CIS
  RU: "ru",
  KZ: "ru",
  BY: "ru",
  KG: "ru",
  TJ: "ru",
  UZ: "ru",
  AM: "ru",
  AZ: "ru",
  GE: "ru",
  MD: "ru",
  TM: "ru",

  // French
  FR: "fr",
  BE: "fr",
  CH: "fr",
  MC: "fr",
  LU: "fr",
  CA: "fr",
  MA: "fr",
  DZ: "fr",
  TN: "fr",
  SN: "fr",
  CI: "fr",
  CM: "fr",
  CD: "fr",
  CG: "fr",
  GA: "fr",
  ML: "fr",
  NE: "fr",
  BF: "fr",
  BJ: "fr",
  TG: "fr",

  // Spanish
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PE: "es",
  UY: "es",
  PY: "es",
  BO: "es",
  EC: "es",
  VE: "es",
  CR: "es",
  PA: "es",
  DO: "es",
  GT: "es",
  HN: "es",
  SV: "es",
  NI: "es",
  CU: "es",
  PR: "es",

  // Portuguese
  PT: "pt",
  BR: "pt",
  AO: "pt",
  MZ: "pt",
  CV: "pt",
  GW: "pt",

  // Arabic
  SA: "ar",
  AE: "ar",
  EG: "ar",
  QA: "ar",
  KW: "ar",
  BH: "ar",
  OM: "ar",
  JO: "ar",
  LB: "ar",
  IQ: "ar",
  SY: "ar",
  YE: "ar",
  PS: "ar",
  MA: "ar",
  DZ: "ar",
  TN: "ar",
  LY: "ar",
  SD: "ar",

  // German
  DE: "de",
  AT: "de",

  // Japanese
  JP: "ja",

  // Chinese
  CN: "zh",
  TW: "zh",
  HK: "zh",

  // English fallback countries
  US: "en",
  GB: "en",
  IE: "en",
  AU: "en",
  NZ: "en",
  ZA: "en",
  IN: "en",
  PK: "en",
  NG: "en",
  KE: "en",
  GH: "en",
  SG: "en",
  MY: "en",
  PH: "en"
};

    const detectedLang =
  langMap[country] || "en";

setLang(detectedLang);

localStorage.setItem("niliLangDetected", "1");

setTimeout(() => {
  openHowItWorks();
}, 500);

  }catch(err){
  console.log("AUTO LANG ERROR:", err.message);

  const browserLang =
  (navigator.language || "en").slice(0, 2);

const supported =
  ["en","tr","ru","fr","es","pt","ar","de","ja","zh"];

setLang(
  supported.includes(browserLang)
    ? browserLang
    : "en"
);

  localStorage.setItem("niliLangManual", "1");
}
}

translateSignupPopup();
document.addEventListener("DOMContentLoaded", () => {
  autoDetectLanguageAndShowIntro();

  allIngredientsLoadPromise = loadAllIngredients();
}

);

function translateSignupPopup(){
  setText("signupInviteTitle", t("signupTitle"));
  setText("signupInviteDesc", t("signupDesc"));

  setText("signupTab", t("signupTabText"));
  setText("loginTab", t("loginTabText"));

  setText("signupContinueBtn", t("signupContinue"));
  setText("continueGuestBtn", t("continueGuest"));

  const userMenuName = document.getElementById("userMenuName");
  if(userMenuName && !isUserLoggedIn()){
    userMenuName.textContent = t("loginButton");
  }
}

function ensureVisitorId(){
  let visitorId = localStorage.getItem("niliVisitorId");

  if(!visitorId){
    visitorId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("niliVisitorId", visitorId);
  }

  return visitorId;
}

function sendAnalyticsPing(){
  if(!window.API_BASE) return;

  if(
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.startsWith("192.168.") ||
    location.hostname.startsWith("10.") ||
    location.hostname.startsWith("172.")
  ){
    return;
  }

  const payload = {
    visitorId: ensureVisitorId(),
    path: location.pathname + location.search + location.hash,
    lang: currentLang,
    userEmail:
      localStorage.getItem("creatorEmail") ||
      localStorage.getItem("niliUserEmail") ||
      ""
  };

  fetch(`${window.API_BASE}/analytics/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

sendAnalyticsPing();
setInterval(sendAnalyticsPing, 30000);

window.addEventListener("pageshow", () => {
  currentLang =
    localStorage.getItem("niliLang") ||
    localStorage.getItem("lang") ||
    currentLang ||
    "en";

  if(langSelectEl){
    langSelectEl.value = currentLang;
  }

  applyLanguage();
  updateCreatorLinks();
  updateAllLinks();
});

document.addEventListener("DOMContentLoaded",()=>{
  const params=new URLSearchParams(location.search);
  if(params.get("login")==="1"){
    openSignupInvite();
    params.delete("login");
    const query=params.toString();
    history.replaceState(null,"",location.pathname+(query?`?${query}`:"")+location.hash);
  }
});
