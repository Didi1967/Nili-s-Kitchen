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

let currentLang = localStorage.getItem("niliLang") || "en";

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

result.style.display = "grid";
result.style.visibility = "visible";
result.style.opacity = "1";
result.innerHTML = `
  <div class="loading-recipes-box">
    <strong>${t("loadingRecipes")}</strong>
    <span>Please wait...</span>
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

  const btn = document.getElementById("langBtn");
  const box = document.getElementById("langOptions");

  if(btn){
    btn.innerHTML = "🌐 " + lang.toUpperCase();
  }

  if(box){
    box.classList.remove("open");
  }

  applyLanguage();

  if(typeof renderChecklist === "function"){
    renderChecklist();
  }

  applyLanguage();

const dashboardLink = document.getElementById("userDashboardLink");
const addRecipeLink = document.getElementById("userAddRecipeLink");
const favoritesBtn = document.getElementById("userFavoritesBtn");
const logoutBtn = document.getElementById("userLogoutBtn");

if(dashboardLink) dashboardLink.textContent = t("menuDashboard");
if(addRecipeLink) addRecipeLink.textContent = t("menuAddRecipe");
if(favoritesBtn) favoritesBtn.textContent = "❤️ " + t("menuFavorites");
if(logoutBtn) logoutBtn.textContent = t("menuLogout");

if(document.body.classList.contains("show-recipes-page")){
  renderRecipes(currentRecipes);
}

if(modal && modal.style.display === "flex"){
  const id = location.hash.replace("#recipe-", "");
  if(id){
    openRecipe(id);
  }
}

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

if(typeof updateCreatorLinks === "function"){
  updateCreatorLinks();
}

applyLanguage();
initUserSessionMenu();

if(typeof initUserSessionMenu === "function"){
  initUserSessionMenu();
}

if(document.body.classList.contains("show-recipes-page") && currentRecipes.length){
  renderRecipes(currentRecipes);
}

if(modal && modal.style.display === "flex"){
  const id = location.hash.replace("#recipe-", "");
  if(id){
    openRecipe(id);
  }
}

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

  if(username || email){
    userMenu.style.display = "block";
    userMenuName.textContent = username || email;
  }else{
    userMenu.style.display = "none";
  }

  const dashLink = document.getElementById("userDashboardLink");
  const addLink = document.getElementById("userAddRecipeLink");

  if(dashLink){
    dashLink.href = "creator-dashboard.html?lang=" + currentLang;
  }

  if(addLink){
    addLink.href = "creator.html?lang=" + currentLang;
  }
}

const userMenuBtn = document.getElementById("userMenuBtn");
const userMenu = document.getElementById("userMenu");

if(userMenuBtn && userMenu){
  userMenuBtn.addEventListener("click", () => {
    userMenu.classList.toggle("open");
  });

  setText("userDashboardLink", t("menuDashboard"));
setText("userAddRecipeLink", t("menuAddRecipe"));
setText("userFavoritesBtn", "❤️ " + t("menuFavorites"));
setText("userLogoutBtn", t("menuLogout"));
}

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

  const hero = document.querySelector(".hero");
  if(hero){
    hero.style.display = "";
  }

  const oldActions =
    document.getElementById("recipeResultActions");

  if(oldActions){
    oldActions.remove();
  }

  if(result){
    result.innerHTML = "";
    result.style.display = "none";
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