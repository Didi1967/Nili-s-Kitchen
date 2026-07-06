let currentRecipes = [];
let selected = [];
let activeCategoryKey = null;

let recipePage = 1;
const recipesPerPage = 6;

let lastRecipeIngredients = [];
let activeRecipeId = null;
let isRecipeLangRefreshing = false;
 

window.API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.")
    ? `http://${window.location.hostname}:3000`
    : "https://api.niliskitchen.com";

console.log("API_BASE:", window.API_BASE);

const statusText = document.getElementById("statusText");
const bar = document.getElementById("bar");
const checklist = document.getElementById("checklist");
const recipeBtn = document.getElementById("recipeBtn");
const confirmCheck = document.getElementById("confirmCheck");
const result = document.getElementById("result");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const manualInput = document.getElementById("manualInput");
const langSelect = document.getElementById("langSelect");

const ingredientModal = document.getElementById("ingredientModal");
const ingredientModalTitle = document.getElementById("ingredientModalTitle");
const ingredientModalItems = document.getElementById("ingredientModalItems");
const ingredientModalSearch = document.getElementById("ingredientModalSearch");
const ingredientSearchEmpty = document.getElementById("ingredientSearchEmpty");

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

async function loadAllIngredients(){

  window.allIngredients = [];
  window.categoryIngredients = {};

  for(const file of ingredientFiles){

    try{
      const res = await fetch(`/ingredients/${file}`);

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

        window.allIngredients.push(item);

        const cat = item.category || "unknown";

        if(!window.categoryIngredients[cat]){
          window.categoryIngredients[cat] = [];
        }

        window.categoryIngredients[cat].push(item);

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
    return item.name?.[currentLang] || item.name?.en || item.id;
  }

  const found =
    window.allIngredients?.find(x =>
      x.id === item ||
      x.name?.en === item
    );

  if(found){
    return found.name?.[currentLang] || found.name?.en || found.id;
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
    heroStrip2Label: "Real Recipes",
    heroStrip2Text: "From APIs and creator submissions",
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
    heroStrip2Label: "Gerçek Tarifler",
    heroStrip2Text: "API'lerden ve creator tariflerinden",
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
    heroStrip2Label: "Настоящие рецепты",
    heroStrip2Text: "Из API и рецептов авторов",
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
    heroStrip2Label: "Vraies recettes",
    heroStrip2Text: "Depuis les API et les créateurs",
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
    heroStrip2Label: "Recetas reales",
    heroStrip2Text: "De APIs y recetas de creadores",
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
    heroStrip2Label: "Receitas reais",
    heroStrip2Text: "De APIs e receitas de criadores",
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
    heroStrip2Label: "وصفات حقيقية",
    heroStrip2Text: "من واجهات API ووصفات المبدعين",
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
  heroStrip2Label: "Echte Rezepte",
  heroStrip2Text: "Aus APIs und von Creators",
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
  heroStrip2Label: "本物のレシピ",
  heroStrip2Text: "APIとクリエイター投稿から",
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
  heroStrip2Label: "真实食谱",
  heroStrip2Text: "来自 API 和创作者投稿",
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
setText("heroStrip3Label", t("heroStrip3Label"));
setText("heroStrip3Text", t("heroStrip3Text"));

setText("appSubtitle", t("appSubtitle"));

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
setText("userLogoutBtn", t("menuLogout"));

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

  renderChecklist();

}

window.removeIngredient = function(value){

  selected =
  selected.filter(item => item !== value);

  saveState();
  renderChecklist();

};

window.clearIngredients = function(){

  selected = [];

  saveState();
  renderChecklist();

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

function findManualIngredientMatches(query){
  const needle = normalizeIngredientLookup(query);
  if(!needle || !Array.isArray(window.allIngredients)) return [];

  return window.allIngredients
    .map(item => {
      const values = ingredientSearchValues(item);
      const normalized = values.map(normalizeIngredientLookup);
      const exact = normalized.includes(needle);
      const starts = normalized.some(value => value.startsWith(needle));
      const contains = normalized.some(value => value.includes(needle));
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
    const exactMatch = findManualIngredientMatches(rawValue)
      .find(item => ingredientSearchValues(item)
        .some(value => normalizeIngredientLookup(value) === normalizeIngredientLookup(rawValue)));
    ingredientId = exactMatch?.id || await normalizeUnknownIngredient(rawValue);
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
  manualInput.addEventListener("input", () => {
    delete manualInput.dataset.ingredientId;
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

    const value =
      itemObj?.id || item;

    const label =
      itemObj
        ? getIngredientLabel(itemObj)
        : getIngredientLabel(item);

    const isSelected =
      selected.includes(value);

   return `
  <button
    class="modal-ingredient-btn ${isSelected ? "active" : ""}"
    type="button"
    data-value="${value}"
    data-index="${index}"
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

  ingredientModal.style.display = "flex";

}

window.closeIngredientModal = function(){

  activeCategoryKey =
  null;

  if(ingredientModal){
    ingredientModal.style.display = "none";
  }

};

function filterIngredientModalItems(){
  if(!ingredientModalSearch || !ingredientModalItems) return;

  const query =
  normalizeIngredientLookup(ingredientModalSearch.value);

  let visibleCount = 0;

  ingredientModalItems
    .querySelectorAll(".modal-ingredient-btn")
    .forEach(button => {
      const label =
      normalizeIngredientLookup(button.textContent);

      const visible =
      !query || label.includes(query);

      button.hidden = !visible;

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

  btn.addEventListener("click", () => {

    const key =
    btn.dataset.category;

    let items = [];

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
    btn.dataset.value;

    if(selected.includes(value)){

      selected =
      selected.filter(item => item !== value);

      btn.classList.remove("active");

    } else {

      selected.push(value);

      btn.classList.add("active");

    }

    saveState();
    renderChecklist();

  });

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
    lang: currentLang
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
    ru:["ПОДОБРАНО ДЛЯ ВАШЕЙ КУХНИ","Рецепты, которые стоит приготовить","персональных рецептов"]
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
  ar:{open:"استكشف مطابخ العالم",eyebrow:"مطابخ العالم",title:"ماذا تريد أن تطبخ؟",intro:"ابحث باسم الطبق أو اختر المطبخ والفئة.",dish:"اسم الطبق",placeholder:"بيتزا، رامن، بقلاوة...",find:"ابحث عن وصفات",cuisine:"اختر المطبخ",category:"الفئة",required:"اكتب اسم طبق أو اختر خياراً.",loading:"جارٍ البحث في مجموعة الوصفات...",empty:"لم يتم العثور على وصفات.",error:"تعذر تحميل الوصفات."}
};

const worldCuisines = [
  ["turkey","Türkiye"],["italy","İtalya"],["mexico","Meksika"],["india","Hindistan"],["china","Çin"],
  ["japan","Japonya"],["france","Fransa"],["greece","Yunanistan"],["usa","ABD"],["thailand","Tayland"]
];
const worldCuisineEnglish = {turkey:"Turkey",italy:"Italy",mexico:"Mexico",india:"India",china:"China",japan:"Japan",france:"France",greece:"Greece",usa:"USA",thailand:"Thailand"};
const worldCategories = ["main course","side dish","dessert","appetizer","salad","soup","breakfast","pasta","seafood"];
let selectedWorldCuisine = "";
let selectedWorldCategory = "";

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
  if(cuisineBox){
    cuisineBox.innerHTML=worldCuisines.map(([id,trLabel]) => `<button type="button" class="world-option ${selectedWorldCuisine===id?"selected":""}" data-world-cuisine="${id}">${currentLang==="tr"?trLabel:worldCuisineEnglish[id]}</button>`).join("");
  }
  if(categoryBox){
    categoryBox.innerHTML=worldCategories.map(value => `<button type="button" class="world-category-option ${selectedWorldCategory===value?"selected":""}" data-world-category="${value}">${value}</button>`).join("");
  }
}

function openWorldSearch(cuisine=""){
  const params=new URLSearchParams({lang:currentLang || "en"});
  if(cuisine) params.set("cuisine",cuisine);
  window.location.href=`world-cuisines.html?${params.toString()}`;
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
    const response=await fetch(`${window.API_BASE}/discover-recipes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,cuisine:selectedWorldCuisine,category:selectedWorldCategory,lang:currentLang,limit:24})});
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error || "Search failed");
    if(!Array.isArray(payload.recipes) || !payload.recipes.length){ if(status) status.textContent=copy.empty; return; }
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

function renderRecipes(data){

  currentRecipes = data;

  console.log("RENDER RECIPES COUNT:", data.length);

  if(!result){
    alert("Result element not found");
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

const visibleRecipes = data;

updateRecipePageHeader(visibleRecipes.length);

const totalPages = 1;

  result.innerHTML =
    visibleRecipes.map(recipe => {

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
              src="${
                recipe.image ||
                "https://img.spoonacular.com/recipes/716429-556x370.jpg"
              }"
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

          </div>

        </div>
      `;

    }).join("");

    const oldActions =
  document.getElementById("recipeResultActions");

if(oldActions){
  oldActions.remove();
}

result.insertAdjacentHTML("afterend", `
  <div id="recipeResultActions" class="recipe-result-actions">

    <button
      type="button"
      class="recipe-back-btn"
      onclick="backToHome()">
      ← Back
    </button>

     

    ${
      recipePage < totalPages
        ? `
          <button
            type="button"
            class="recipe-next-btn"
            onclick="nextRecipePage()">
            Next →
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

function openRecipe(id){

  activeRecipeId = id;

  const recipe =
  currentRecipes.find(
    item => String(item.id) === String(id)
  );

  if(!recipe){

    modalBody.innerHTML =
    "<h2>Recipe not found</h2>";

    modal.style.display = "flex";

    return;

  }

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
            <span>${step}</span>
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

  modalBody.innerHTML = `
    <div class="recipe-detail-shell recipe-detail-portrait">
      <div class="recipe-detail-fixed">
        <div class="recipe-detail-heading">
        <h1>${recipe.title || "Recipe"}</h1>

        ${
          cuisineLabel
            ? `<p class="recipe-detail-subtitle">${cuisineLabel}</p>`
            : ""
        }

        ${countryBadge}
        </div>

        <div class="recipe-detail-hero">
          <img
            src="${
              recipe.image ||
              "https://img.spoonacular.com/recipes/716429-556x370.jpg"
            }"
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

function getRecipeCountryBadge(recipe){
  const raw =
  normalizeText(
    recipe.country ||
    recipe.cuisine ||
    recipe.category ||
    ""
  );

  const countryMap = [
    { match:["turk", "turkish", "turkiye"], flag:"🇹🇷", label:"Türkiye" },
    { match:["ital", "italian"], flag:"🇮🇹", label:"Italy" },
    { match:["mexic"], flag:"🇲🇽", label:"Mexico" },
    { match:["indian", "india"], flag:"🇮🇳", label:"India" },
    { match:["chinese", "china"], flag:"🇨🇳", label:"China" },
    { match:["japan", "japanese"], flag:"🇯🇵", label:"Japan" },
    { match:["french", "france"], flag:"🇫🇷", label:"France" },
    { match:["greek", "greece"], flag:"🇬🇷", label:"Greece" },
    { match:["thai", "thailand"], flag:"🇹🇭", label:"Thailand" },
    { match:["american", "usa", "united states"], flag:"🇺🇸", label:"USA" }
  ];

  const found =
  countryMap.find(item =>
    item.match.some(keyword => raw.includes(keyword))
  );

  if(!found){
    return "";
  }

  return `
    <div class="recipe-detail-country">
      <span class="recipe-detail-country-flag">${found.flag}</span>
      <span class="recipe-detail-country-label">${found.label}</span>
    </div>
  `;
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
  if(Array.isArray(recipe.analyzedInstructions) && recipe.analyzedInstructions.length){
    const steps = recipe.analyzedInstructions
      .flatMap(block => Array.isArray(block.steps) ? block.steps : [])
      .map(step => step?.step)
      .filter(Boolean);

    if(steps.length){
      return steps;
    }
  }

  const plainText = getInstructionText(recipe);
  if(!plainText){
    return [];
  }

  return plainText
    .split(/(?<=[.!?])\s+/)
    .map(step => step.trim())
    .filter(Boolean)
    .slice(0, 8);
}

window.closeModal = function(){

  history.replaceState(null, "", "#recipes");

  if(modal){
    const modalContent = modal.querySelector(".modal-content");
    if(modalContent){
      modalContent.classList.remove("recipe-portrait-modal");
    }
    modal.style.display = "none";
  }

}

function getFavoritesFile(){
  return path.join(__dirname, "data", "favorites.json");
}

function readFavorites(){
  const file = getFavoritesFile();

  const dir = path.dirname(file);
  if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }

  if(!fs.existsSync(file)){
    fs.writeFileSync(file, "{}");
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeFavorites(data){
  const file = getFavoritesFile();

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

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
  selected.map(item => `
    <div class="selected-chip">
      <span>${typeof ingredientLabel === "function" ? ingredientLabel(item) : item}</span>

      <button
        type="button"
        onclick="removeSelectedIngredient('${item.replace(/'/g, "\\'")}')"
      >
        ×
      </button>
    </div>
  `).join("");

  translateSelectedIngredients();

}

function removeSelectedIngredient(item){

  selected =
  selected.filter(x => x !== item);

  renderChecklist();

}

function clearSelectedIngredients(){

  selected = [];

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
  setText("userAddRecipeLink", t("menuAddRecipe"));
  setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
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

  if(
  document.body.classList.contains("show-recipes-page") &&
  lastRecipeIngredients.length &&
  !isRecipeLangRefreshing
){
  isRecipeLangRefreshing = true;

  const oldRecipeId = activeRecipeId;

  getRecipesFromIngredients(lastRecipeIngredients)
    .then(() => {
      if(oldRecipeId && modal && modal.style.display === "flex"){
        openRecipe(oldRecipeId);
      }
    })
    .finally(() => {
      isRecipeLangRefreshing = false;
    });
}

  if(modal && modal.style.display === "flex"){
    const id = location.hash.replace("#recipe-", "");

    if(id){
      openRecipe(id);
    }
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

  const dashboardLink = document.getElementById("userDashboardLink");
  const addRecipeLink = document.getElementById("userAddRecipeLink");
  const favoritesBtn = document.getElementById("userFavoritesBtn");
  const howLink = document.getElementById("userHowLink");
  const logoutBtn = document.getElementById("userLogoutBtn");

  if(dashboardLink) dashboardLink.textContent = t("menuDashboard");
  if(addRecipeLink) addRecipeLink.textContent = t("menuAddRecipe");
  if(favoritesBtn) favoritesBtn.textContent = "❤️ " + t("menuFavorites");
  if(howLink) howLink.textContent = t("menuHowItWorks");
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

function toggleFavorite(recipeId){

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

  fetch("/user/favorites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      recipe
    })
  }).catch(err =>
    console.log("FAVORITE SAVE ERROR:", err)
  );

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
        `/user/favorites/${encodeURIComponent(email)}`
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
  const addLink = document.getElementById("userAddRecipeLink");
  const howLink = document.getElementById("userHowLink");

  if(dashLink){
    dashLink.href = "creator-dashboard.html?lang=" + currentLang;
  }

  if(addLink){
    addLink.href = "creator.html?lang=" + currentLang;
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
setText("userAddRecipeLink", t("menuAddRecipe"));
setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
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
  recipePage++;
  document.body.classList.add("show-recipes-page");
  document.body.classList.add("hide-mobile-top-menu");
  renderRecipes(currentRecipes);

  const sidebar = document.getElementById("sidebar");
  if(sidebar && window.innerWidth > 980){
    sidebar.style.setProperty("display", "block", "important");
    sidebar.style.setProperty("visibility", "visible", "important");
    sidebar.style.setProperty("opacity", "1", "important");
  }
}

function openFavoritesPage(){
  const favorites = getFavorites();

  if(!favorites.length){
    alert("No favorite recipes yet.");
    return;
  }

  recipePage = 1;
  renderRecipes(favorites);
}

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

  loadAllIngredients();
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
