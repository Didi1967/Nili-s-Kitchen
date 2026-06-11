let currentRecipes = [];
let selected = [];
let activeCategoryKey = null;

let recipePage = 1;
const recipesPerPage = 6;
 

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

const LANG_STORAGE_KEY = "niliKitchenLangV2";

let currentLang =
  localStorage.getItem("niliLang") ||
  localStorage.getItem("lang") ||
  "en";

const ingredientTranslationCache = {};
const ingredientTranslationLoading = {};

function getAllCategoryIngredients(){

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
mobileFeature1Desc: "Malzemelerin fotoğrafını çek",

mobileFeature2Title: "🥗 Akıllı Seçimler",
mobileFeature2Desc: "Kategoriye göre seç",

mobileFeature3Title: "❤️ Kaydet",
mobileFeature3Desc: "Favorilerini sakla",

joinNiliTitle: "Nili's Kitchen'a Katıl",
joinNiliDesc: "Favorileri kaydet, tarif yükle ve içerik üretici özelliklerini aç.",
joinNiliBtn: "Ücretsiz Katıl",


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
mobileFeature1Desc: "Сканируйте ингредиенты по фото",

mobileFeature2Title: "🥗 Умный Выбор",
mobileFeature2Desc: "Выбирайте по категориям",

mobileFeature3Title: "❤️ Сохранить",
mobileFeature3Desc: "Храните избранное",

joinNiliTitle: "Присоединяйтесь к Nili's Kitchen",
joinNiliDesc: "Сохраняйте избранное, загружайте рецепты и открывайте возможности автора.",
joinNiliBtn: "Присоединиться бесплатно",
    

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
mobileFeature1Desc: "Photographiez vos ingrédients",

mobileFeature2Title: "🥗 Choix Intelligents",
mobileFeature2Desc: "Choisissez par catégorie",

mobileFeature3Title: "❤️ Sauvegarder",
mobileFeature3Desc: "Conservez vos favoris",

joinNiliTitle: "Rejoignez Nili's Kitchen",
joinNiliDesc: "Enregistrez vos favoris, publiez des recettes et débloquez les fonctionnalités créateur.",
joinNiliBtn: "Rejoindre gratuitement",
 


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
mobileFeature1Desc: "Fotografía tus ingredientes",

mobileFeature2Title: "🥗 Selección Inteligente",
mobileFeature2Desc: "Elige por categoría",

mobileFeature3Title: "❤️ Guardar",
mobileFeature3Desc: "Guarda tus favoritos",

joinNiliTitle: "Únete a Nili's Kitchen",
joinNiliDesc: "Guarda favoritos, publica recetas y desbloquea funciones de creador.",
joinNiliBtn: "Unirse gratis",

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

mobileFeature1Title: "📸 Escaneamento IA",
mobileFeature1Desc: "Fotografe seus ingredientes",

mobileFeature2Title: "🥗 Escolhas Inteligentes",
mobileFeature2Desc: "Escolha por categoria",

mobileFeature3Title: "❤️ Salvar",
mobileFeature3Desc: "Guarde seus favoritos",

joinNiliTitle: "Junte-se ao Nili's Kitchen",
joinNiliDesc: "Salve favoritos, publique receitas e desbloqueie recursos de criador.",
joinNiliBtn: "Participar grátis",


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
mobileFeature1Desc: "صوّر المكونات",

mobileFeature2Title: "🥗 اختيارات ذكية",
mobileFeature2Desc: "اختر حسب الفئة",

mobileFeature3Title: "❤️ حفظ",
mobileFeature3Desc: "احتفظ بالمفضلة",

joinNiliTitle: "انضم إلى Nili's Kitchen",
joinNiliDesc: "احفظ المفضلة، وارفع الوصفات، وافتح ميزات صانع المحتوى.",
joinNiliBtn: "انضم مجانًا",

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
scanSubtitle: "Laden Sie ein Foto hoch und lassen Sie die KI die Zutaten erkennen",
manualTitle: "Zutaten manuell hinzufügen",
manualPlaceholder: "Zutat hinzufügen",
categoryTitle: "Zutaten nach Kategorie hinzufügen",

selectedTitle: "Ausgewählte Zutaten",
selectedDesc: "Überprüfen Sie Ihre Zutaten, bevor Sie Rezepte suchen.",
confirmIngredients: "Zutaten bestätigen",
getRecipes: "Rezepte anzeigen",
clearSelected: "Auswahl löschen",
emptySelected: "Noch keine Zutaten ausgewählt.",

signup: "Registrieren",
login: "Anmelden",
becomeCreator: "Creator werden",
creatorDesc: "Laden Sie Rezepte hoch und verdienen Sie künftig Belohnungen.",
creatorLogin: "Creator-Anmeldung",
creatorLoginDesc: "Weiter zu Ihrer Rezept-Upload-Seite.",
username: "Benutzername",
email: "E-Mail-Adresse",
emailOrUsername: "E-Mail oder Benutzername",
password: "Passwort",
show: "Anzeigen",
hide: "Ausblenden",
continue: "Weiter",

alertIngredient: "Bitte fügen Sie mindestens eine Zutat hinzu.",
alertConfirm: "Bitte bestätigen Sie zuerst Ihre Zutaten.",
alertUsername: "Bitte geben Sie einen Benutzernamen ein.",
alertEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
alertEmailOrUser: "Bitte geben Sie Ihre E-Mail-Adresse oder Ihren Benutzernamen ein.",
alertPassword: "Bitte geben Sie Ihr Passwort ein.",

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
heroTitle: "Intelligenter kochen mit dem, was Sie bereits haben",
heroDesc: "Laden Sie Zutaten hoch, wählen Sie aus, was Sie haben, und entdecken Sie sofort echte Rezepte.",

galleryBtn: "Aus Galerie wählen",

footerNote: "© 2026 Nili's Kitchen AI. Alle Rechte vorbehalten.",

ingredientDetailsUnavailable: "Zutatendetails nicht verfügbar",
timeUnavailable: "Zeit nicht verfügbar",

serviceTemporaryUnavailable: "Der Dienst ist aufgrund eines technischen Problems vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",

menuDashboard: "Dashboard",
menuAddRecipe: "Rezept hinzufügen",
menuFavorites: "Favoriten",
menuLogout: "Abmelden",
menuHowItWorks: "So funktioniert es",

howTitle: "👋 So funktioniert Nili's Kitchen",
howStep1: "1️⃣ Zutaten aus Kategorien auswählen.",
howStep2: "2️⃣ Weitere Zutaten manuell hinzufügen.",
howStep3: "3️⃣ Zutaten bestätigen und auf Rezepte anzeigen tippen.",
howStep4: "4️⃣ Speichern Sie Lieblingsrezepte mit einem kostenlosen Konto.",
howStep5: "5️⃣ Creator können eigene Rezepte hochladen.",
howStart: "Jetzt entdecken",
howMoreInfo: "Mehr über Nili's Kitchen erfahren →",

pleaseWait: "Bitte warten",

loginButton: "Anmelden",

signupTitle: "Erstellen Sie Ihr kostenloses Konto",
signupDesc: "Speichern Sie Favoriten, synchronisieren Sie Rezepte und erhalten Sie mehr Suchmöglichkeiten.",
signupContinue: "Weiter",
continueGuest: "Als Gast fortfahren",
signupTabText: "Registrieren",
loginTabText: "Anmelden",

smartScanTitle: "📸 Intelligenter Scan",
smartScanDesc: "Verwandeln Sie Zutaten in Möglichkeiten",

cookSmarterTitle: "🍳 Clever kochen",
cookSmarterDesc: "Rezepte aus den Zutaten, die Sie bereits haben",

mobileFeature1Title: "📸 KI-Scan",
mobileFeature1Desc: "Zutaten fotografieren",

mobileFeature2Title: "🥗 Intelligente Auswahl",
mobileFeature2Desc: "Nach Kategorie auswählen",

mobileFeature3Title: "❤️ Speichern",
mobileFeature3Desc: "Favoriten behalten",

joinNiliTitle: "Nili's Kitchen beitreten",
joinNiliDesc: "Favoriten speichern, Rezepte hochladen und Creator-Funktionen freischalten.",
joinNiliBtn: "Kostenlos beitreten",

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
categoryTitle: "カテゴリーから食材を追加",

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
emailOrUsername: "メールアドレスまたはユーザー名",
password: "パスワード",
show: "表示",
hide: "非表示",
continue: "続行",

heroBadge: "AIによる本物のレシピ",
heroTitle: "今ある食材で賢く料理",
heroDesc: "食材をアップロードし、手元にあるものを選ぶだけで、本物のレシピをすぐに発見できます。",

galleryBtn: "ギャラリーから選択",

menuDashboard: "ダッシュボード",
menuAddRecipe: "レシピ追加",
menuFavorites: "お気に入り",
menuLogout: "ログアウト",
menuHowItWorks: "使い方",

loginButton: "ログイン",

signupTitle: "無料アカウントを作成",
signupDesc: "お気に入りを保存し、レシピを同期して、さらに多くの検索を利用できます。",
signupContinue: "続行",
continueGuest: "ゲストとして続行",
signupTabText: "登録",
loginTabText: "ログイン",

smartScanTitle: "📸 スマートスキャン",
smartScanDesc: "食材を可能性に変える",

cookSmarterTitle: "🍳 もっと賢く料理",
cookSmarterDesc: "今ある食材からレシピを発見",

mobileFeature1Title: "📸 AIスキャン",
mobileFeature1Desc: "食材を撮影",

mobileFeature2Title: "🥗 スマート選択",
mobileFeature2Desc: "カテゴリーから選択",

mobileFeature3Title: "❤️ 保存",
mobileFeature3Desc: "お気に入りを保存",

joinNiliTitle: "Nili's Kitchenに参加",
joinNiliDesc: "お気に入りを保存し、レシピを投稿してクリエイター機能を利用しましょう。",
joinNiliBtn: "無料で参加",

categories: {
  vegetables: "野菜",
  fruits: "果物",
  meat: "肉",
  seafood: "魚介類",
  dairy_eggs: "乳製品",
  grains_bakery: "穀物",
  legumes: "豆類",
  herbs_spices: "ハーブ",
  oils_fats: "油",
  sauces_condiments: "ソース",
  nuts_seeds: "ナッツ",
  sweeteners_baking: "製菓"
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
clearSelected: "清除选择",
emptySelected: "尚未选择任何食材。",

signup: "注册",
login: "登录",
becomeCreator: "成为创作者",
creatorDesc: "上传食谱，未来可获得奖励。",
creatorLogin: "创作者登录",
creatorLoginDesc: "继续前往您的食谱上传页面。",
username: "用户名",
email: "电子邮箱",
emailOrUsername: "电子邮箱或用户名",
password: "密码",
show: "显示",
hide: "隐藏",
continue: "继续",

heroBadge: "AI 驱动的真实食谱",
heroTitle: "利用现有食材更聪明地烹饪",
heroDesc: "上传食材，选择您拥有的食材，立即发现真实食谱。",

galleryBtn: "从图库选择",

menuDashboard: "控制面板",
menuAddRecipe: "添加食谱",
menuFavorites: "收藏",
menuLogout: "退出登录",
menuHowItWorks: "使用方法",

loginButton: "登录",

signupTitle: "创建您的免费账户",
signupDesc: "保存收藏、同步食谱并解锁更多搜索功能。",
signupContinue: "继续",
continueGuest: "以访客身份继续",
signupTabText: "注册",
loginTabText: "登录",

smartScanTitle: "📸 智能扫描",
smartScanDesc: "让食材变成无限可能",

cookSmarterTitle: "🍳 更聪明地烹饪",
cookSmarterDesc: "利用现有食材发现食谱",

mobileFeature1Title: "📸 AI扫描",
mobileFeature1Desc: "拍摄食材照片",

mobileFeature2Title: "🥗 智能选择",
mobileFeature2Desc: "按类别选择",

mobileFeature3Title: "❤️ 保存",
mobileFeature3Desc: "保存收藏",

joinNiliTitle: "加入 Nili's Kitchen",
joinNiliDesc: "保存收藏、上传食谱并解锁创作者功能。",
joinNiliBtn: "免费加入",

categories: {
  vegetables: "蔬菜",
  fruits: "水果",
  meat: "肉类",
  seafood: "海鲜",
  dairy_eggs: "乳制品",
  grains_bakery: "谷物",
  legumes: "豆类",
  herbs_spices: "香草",
  oils_fats: "油脂",
  sauces_condiments: "酱料",
  nuts_seeds: "坚果",
  sweeteners_baking: "烘焙"
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

function setText(selector, text){
  const el = document.querySelector(selector);
  if(el){
    el.textContent = text;
  }
}

function setPlaceholder(selector, text){
  const el = document.querySelector(selector);
  if(el){
    el.placeholder = text;
  }
}
 
function applyLanguage(){

  console.log("APPLY LANGUAGE:", currentLang);
  
  console.log(
  "HERO FOUND:",
  document.querySelectorAll(".hero-title-text").length,
  t("heroTitle")
);

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

  setText("#appSubtitle", t("appSubtitle"));

setText("#scanTitle", t("scanTitle"));
setText("#statusText", t("scanSubtitle"));

const galleryBtnText = document.getElementById("galleryBtnText");

if(galleryBtnText){
  galleryBtnText.innerHTML = `🖼️ ${t("galleryBtn")}`;
}

setText(".manual-panel .panel-title", t("manualTitle"));
  setPlaceholder("#manualInput", t("manualPlaceholder"));

  setText(".category-panel .panel-title", t("categoryTitle"));

  setText(".selected-tray-header h2", t("selectedTitle"));
  setText(".selected-tray-header p", t("selectedDesc"));
  setText(".tray-confirm span", t("confirmIngredients"));
  setText("#trayGetRecipesBtn", t("getRecipes"));
  setText(".selected-clear-bottom", t("clearSelected"));

  setText("#signupTab", t("signup"));
  setText("#loginTab", t("login"));

  setText("#creatorCardTitle", t("becomeCreator"));
setText("#creatorCardDesc", t("creatorDesc"));
setText("#footerNoteText", t("footerNote"));
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

setText("#joinNiliTitle", t("joinNiliTitle"));
setText("#joinNiliDesc", t("joinNiliDesc"));
setText("#joinNiliBtn", t("joinNiliBtn"));

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
label
  .replace(/_/g, " ")
  .replace(/\b\w/g, c => c.toUpperCase());

btn.innerHTML =
icon
  ? `<span class="cat-icon">${icon}</span> ${label}`
  : label;

  });

  if(
  typeof setCreatorMode === "function" &&
  !document.getElementById("signupInviteModal")?.style.display.includes("flex")
){
  setCreatorMode(window.creatorMode || "signup");
}

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

window.addManual = function(){

  const value =
  manualInput.value
  .trim()
  .toLowerCase();

  if(!value) return;

  const item = window.NilisIngredients
  ? window.NilisIngredients.resolveIngredient(value)
  : { id:value };

addIngredient(item.id);

  manualInput.value = "";

  if(statusText){
    statusText.innerText = t("statusAdded");
  }

};

if(manualInput){

  manualInput.addEventListener("keydown", e => {

    if(e.key === "Enter"){

      e.preventDefault();

      window.addManual();

    }

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

  if(!safeItems.length && window.NilisIngredients){

    safeItems = Object.values(window.NilisIngredients.ingredients || {})
      .filter(item => item.category === categoryKey)
      .map(item => item.id);

  }

  if(!safeItems.length){

    safeItems =
      CATEGORY_DATA[categoryKey] || [];

  }

  if(ingredientModalTitle){
    ingredientModalTitle.innerText =
      translations[currentLang]?.categories?.[categoryKey] ||
      translations.en.categories?.[categoryKey] ||
      categoryKey;
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

      const label =
        window.NilisIngredients?.ingredients?.[item]?.name?.[currentLang] ||
        window.NilisIngredients?.ingredients?.[item]?.name?.en ||
        item;

      const isSelected =
  selected.includes(item);

return `
  <button
    class="modal-ingredient-btn ${isSelected ? "active" : ""}"
    type="button"
    data-value="${item}"
    data-index="${index}"
  >
    <span>${label}</span>
    <strong class="ingredient-mark">${isSelected ? "✓" : "+"}</strong>
  </button>
`;

    }).join("");

  ingredientModal.style.display = "flex";

}

window.closeIngredientModal = function(){

  activeCategoryKey =
  null;

  if(ingredientModal){
    ingredientModal.style.display = "none";
  }

};

document
.querySelectorAll(".category-btn")
.forEach(btn => {

  btn.addEventListener("click", () => {

    const key =
    btn.dataset.category;

    let items = [];

if(window.NilisIngredients){

  items = Object.values(window.NilisIngredients.ingredients || {})
    .filter(item => item.category === key)
    .map(item => item.id);

}

if(!items.length){

  items =
  CATEGORY_DATA[key] || [];

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
if(floatingLang){
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

 const startIndex =
  (recipePage - 1) * recipesPerPage;

const endIndex =
  startIndex + recipesPerPage;

const visibleRecipes =
  data.slice(startIndex, endIndex);

const totalPages =
  Math.ceil(data.length / recipesPerPage);

  result.innerHTML =
    visibleRecipes.map(recipe => {

      const usedCount =
        Array.isArray(recipe.usedIngredients) && recipe.usedIngredients.length
          ? recipe.usedIngredients.length
          : recipe.usedIngredientCount || recipe.usedCount || 0;

      const usedList =
        recipe.usedIngredients && recipe.usedIngredients.length
          ? recipe.usedIngredients
              .slice(0,4)
              .map(item => `<span>${item.original || item.name || item}</span>`)
              .join("")
          : `<span>${t("ingredientDetailsUnavailable")}</span>`;

      return `
        <div class="card recipe-card" data-recipe-id="${recipe.id}">

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

            <h3>${recipe.title || t("recipeTitleFallback")}</h3>

            <p class="time recipe-time">
              ${
                recipe.readyInMinutes
                  ? `⏱ ${recipe.timeEstimated ? "~" : ""}${recipe.readyInMinutes} ${t("timeMin")}`
                  : `⏱ ${recipe.timeLabel || t("timeUnavailable") || "Time unavailable"}`
              }
            </p>

            <div class="ingredients-count">
              🥗 ${t("usesIngredients")} ${usedCount} ${t("ingredientsWord")}
            </div>

            <div class="ingredients recipe-ingredients">
              ${usedList}
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

function openRecipe(id){

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

  const ingredientHtml =
  recipe.usedIngredients && recipe.usedIngredients.length
  ? recipe.usedIngredients
      .map(item => `
        <span>
          ${item.original || item.name || item}
        </span>
      `).join("")
  : `<span>${t("ingredientDetailsUnavailable")}</span>`;

  modalBody.innerHTML = `

    <img
      src="${
        recipe.image ||
        "https://img.spoonacular.com/recipes/716429-556x370.jpg"
      }"
      style="
        width:100%;
        max-height:340px;
        object-fit:cover;
        border-radius:24px;
        margin-bottom:24px;
      "
    >

    <h1>
      ${recipe.title || "Recipe"}
    </h1>

    <p class="time">
  ${
    recipe.readyInMinutes
      ? `⏱ ${recipe.readyInMinutes} min`
      : `⏱ ${recipe.timeLabel || "Time unavailable"}`
  }
</p>

    <h2>
  ${t("ingredientsTitle")}
</h2>

    <div class="ingredients">
      ${ingredientHtml}
    </div>

    <br>

    <h2>
  ${t("instructionsTitle")}
</h2>

    <p style="line-height:1.8;">
      ${
        recipe.instructions ||
        t("instructionsUnavailable")
      }
    </p>

  `;

  modal.style.display = "flex";

}

window.closeModal = function(){

  history.replaceState(null, "", "#recipes");

  if(modal){
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

if(langSelectEl){

  langSelectEl.value = currentLang;

  langSelectEl.addEventListener("change", () => {

    currentLang = langSelectEl.value;

    localStorage.setItem("niliLang", String(currentLang));
    localStorage.setItem("lang", String(currentLang));

    console.log("APP selected currentLang:", currentLang);
    console.log("APP localStorage niliLang:", localStorage.getItem("niliLang"));
    console.log("APP localStorage lang:", localStorage.getItem("lang"));

    applyLanguage();
    updateCreatorLinks();

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

    window.location.href = `${window.location.origin}/?lang=${currentLang}`;

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

  currentLang = "en";

  applyLanguage("en");

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

  if(typeof updateCreatorLinks === "function"){
    updateCreatorLinks();
  }

  if(typeof renderChecklist === "function"){
    renderChecklist();
  }

  if(
    document.body.classList.contains("show-recipes-page") &&
    Array.isArray(currentRecipes) &&
    currentRecipes.length
  ){
    renderRecipes(currentRecipes);
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

  location.href = "/?lang=" + currentLang;
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
  renderRecipes(currentRecipes);
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

  if(localStorage.getItem("niliLangDetected")){
    console.log("STOP: niliLangDetected exists");
    return;
  }

  if(localStorage.getItem("niliLang")){
    console.log("STOP: niliLang exists", localStorage.getItem("niliLang"));
    return;
  }

  try{
    const res = await fetch("https://ipapi.co/json/");
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
    console.log("AUTO LANG ERROR:", err);
  }
}

translateSignupPopup();
document.addEventListener("DOMContentLoaded", () => {
  autoDetectLanguageAndShowIntro();
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