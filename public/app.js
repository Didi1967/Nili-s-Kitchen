let currentRecipes = [];
let selected = [];
let activeCategoryKey = null;

const photo = document.getElementById("photo");
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
localStorage.getItem(LANG_STORAGE_KEY) || "en";

const CATEGORY_DATA = {
  vegetables: [
    "tomato",
    "onion",
    "potato",
    "carrot",
    "broccoli",
    "spinach",
    "lettuce",
    "green pepper",
    "red pepper",
    "garlic",
    "mushroom",
    "zucchini"
  ],

  meat: [
    "chicken",
    "beef",
    "lamb",
    "turkey",
    "steak",
    "sausage",
    "ground beef",
    "pork"
  ],

  seafood: [
    "salmon",
    "shrimp",
    "tuna",
    "cod",
    "sea bass",
    "sardines",
    "mussels"
  ],

  vegan: [
    "tofu",
    "lentils",
    "chickpeas",
    "beans",
    "quinoa",
    "mushroom",
    "eggplant",
    "avocado"
  ],

  pasta: [
    "spaghetti",
    "penne",
    "macaroni",
    "noodles",
    "parmesan",
    "basil",
    "tomato sauce"
  ],

  dessert: [
    "chocolate",
    "banana",
    "strawberry",
    "cream",
    "sugar",
    "flour",
    "butter",
    "vanilla"
  ],

  fruits: [
    "apple",
    "banana",
    "orange",
    "grapes",
    "lemon",
    "watermelon",
    "strawberry",
    "avocado"
  ],

  dairy: [
    "milk",
    "cheese",
    "yogurt",
    "cream",
    "butter",
    "mozzarella",
    "parmesan"
  ],

  grains: [
    "rice",
    "bulgur",
    "oats",
    "quinoa",
    "bread",
    "flour",
    "corn"
  ],

  legumes: [
    "lentils",
    "beans",
    "chickpeas",
    "peas",
    "black beans",
    "kidney beans"
  ],

  spices: [
    "salt",
    "black pepper",
    "paprika",
    "cumin",
    "oregano",
    "cinnamon",
    "turmeric",
    "chili flakes"
  ],

  oils: [
    "olive oil",
    "sunflower oil",
    "butter",
    "coconut oil",
    "sesame oil"
  ],

  sauces: [
    "tomato sauce",
    "soy sauce",
    "hot sauce",
    "mustard",
    "mayonnaise",
    "vinegar",
    "pesto"
  ]
};

const ingredientTranslationCache = {};
const ingredientTranslationLoading = {};

function getAllCategoryIngredients(){
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

  ingredientTranslationLoading[lang] = fetch("/translate-ingredients", {
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



    categories: {
  vegetables: "Vegetables",
  meat: "Meat",
  seafood: "Seafood",
  vegan: "Vegan",
  pasta: "Pasta",
  dessert: "Dessert",
  fruits: "Fruits",
  dairy: "Dairy",
  grains: "Grains",
  legumes: "Legumes",
  spices: "Spices",
  oils: "Oils",
  sauces: "Sauces"
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

    categories: {
  vegetables: "Sebzeler",
  meat: "Et",
  seafood: "Deniz ürünleri",
  vegan: "Vegan",
  pasta: "Makarna",
  dessert: "Tatlı",
  fruits: "Meyveler",
  dairy: "Süt ürünleri",
  grains: "Tahıllar",
  legumes: "Bakliyat",
  spices: "Baharatlar",
  oils: "Yağlar",
  sauces: "Soslar"
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

  categories: {
  vegetables: "Овощи",
  meat: "Мясо",
  seafood: "Морепродукты",
  vegan: "Веган",
  pasta: "Паста",
  dessert: "Десерт",
  fruits: "Фрукты",
  dairy: "Молочные",
  grains: "Крупы",
  legumes: "Бобовые",
  spices: "Специи",
  oils: "Масла",
  sauces: "Соусы"
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


    categories: {
  vegetables: "Légumes",
  meat: "Viande",
  seafood: "Fruits de mer",
  vegan: "Vegan",
  pasta: "Pâtes",
  dessert: "Dessert",
  fruits: "Fruits",
  dairy: "Produits laitiers",
  grains: "Céréales",
  legumes: "Légumineuses",
  spices: "Épices",
  oils: "Huiles",
  sauces: "Sauces"
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

    categories: {
  vegetables: "Verduras",
  meat: "Carne",
  seafood: "Mariscos",
  vegan: "Vegano",
  pasta: "Pasta",
  dessert: "Postre",
  fruits: "Frutas",
  dairy: "Lácteos",
  grains: "Granos",
  legumes: "Legumbres",
  spices: "Especias",
  oils: "Aceites",
  sauces: "Salsas"
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

    categories: {
  vegetables: "Vegetais",
  meat: "Carne",
  seafood: "Frutos do mar",
  vegan: "Vegano",
  pasta: "Massa",
  dessert: "Sobremesa",
  fruits: "Frutas",
  dairy: "Laticínios",
  grains: "Grãos",
  legumes: "Leguminosas",
  spices: "Temperos",
  oils: "Óleos",
  sauces: "Molhos"
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

    categories: {
  vegetables: "خضروات",
  meat: "لحوم",
  seafood: "مأكولات بحرية",
  vegan: "نباتي",
  pasta: "معكرونة",
  dessert: "حلويات",
  fruits: "فواكه",
  dairy: "ألبان",
  grains: "حبوب",
  legumes: "بقوليات",
  spices: "توابل",
  oils: "زيوت",
  sauces: "صلصات"
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

    const res = await fetch("/translate-ingredients", {
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
    console.error("Selected ingredient translate error:", err);
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

    btn.textContent =
    translations[currentLang]?.categories?.[key] ||
    translations.en.categories[key] ||
    key;

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

  const cleanItem =
  String(item)
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

  addIngredient(value);

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

  if(photo){
    photo.value = "";
  }

}

if(photo){

  photo.addEventListener("change", async () => {

    const file = photo.files[0];

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
      await fetch("/analyze", {
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
          addIngredient(item);
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

      console.error("FRONT ANALYZE ERROR:", err);

      if(statusText){
        statusText.innerText = t("statusAnalyzeFailed");
      }

      if(bar){
        bar.style.width = "0%";
      }

      setTimeout(() => {
        resetUploadStatus();
      }, 1200);

    }

  });

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

  const safeItems =
    Array.isArray(items) && items.length
      ? items
      : CATEGORY_DATA[categoryKey] || [];

  if(ingredientModalTitle){
    ingredientModalTitle.innerText =
      translations[currentLang]?.categories?.[categoryKey] ||
      translations.en.categories[categoryKey] ||
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

  // Önce malzemeleri hemen göster
  ingredientModalItems.innerHTML =
    safeItems.map((item, index) => `
      <button
        class="modal-ingredient-btn ${selected.includes(item) ? "active" : ""}"
        type="button"
        data-value="${item}"
        data-index="${index}"
      >
        ${item}
      </button>
    `).join("");

  ingredientModal.style.display = "flex";

  // İngilizce ise çeviri yok
  if(currentLang === "en") return;

  // Sonra çeviri gelince buton yazılarını değiştir
  try{

    console.log("TRANSLATE POPUP START:", currentLang, safeItems);

    const res = await fetch("/translate-ingredients", {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        items:safeItems,
        lang:currentLang
      })
    });

    const data = await res.json();

    console.log("TRANSLATE POPUP DATA:", data);

    if(data && Array.isArray(data.items)){
      document
        .querySelectorAll("#ingredientModalItems .modal-ingredient-btn")
        .forEach((btn, index) => {
          btn.textContent = data.items[index] || safeItems[index];
        });
    }

  }catch(err){
    console.error("Ingredient translate error:", err);
  }

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

    const items =
    CATEGORY_DATA[key] || [];

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

  result.innerHTML =
`<p>${t("loadingRecipes")}</p>`;

  try{

    const normalizeRes =
await fetch("/normalize-ingredients", {
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

const res =
await fetch("/recipes", {
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
      : data.recipes || [];

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

    renderRecipes(recipes);

    const hero =
    document.querySelector(".hero");

    if(hero){
      hero.style.display = "none";
    }

    result.scrollIntoView({
      behavior:"smooth"
    });

  }catch(err){

    console.error("FRONT RECIPES ERROR:", err);

    result.innerHTML =
    "<p>Recipes failed</p>";

  }

}

async function confirmAndGetRecipes(){

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

  result.innerHTML =
  data.map(recipe => {

    const usedCount =
Array.isArray(recipe.usedIngredients) && recipe.usedIngredients.length
  ? recipe.usedIngredients.length
  : recipe.usedIngredientCount || recipe.usedCount || selected.length || 0;

    const usedList =
    recipe.usedIngredients && recipe.usedIngredients.length
    ? recipe.usedIngredients
        .slice(0,4)
        .map(item => `<span>${item.name || item.original || item}</span>`)
        .join("")
    : selected
        .slice(0,4)
        .map(item => `<span>${item}</span>`)
        .join("");

    return `

      <div
        class="card"
        data-recipe-id="${recipe.id}"
      >

        <img
          src="${
            recipe.image ||
            "https://img.spoonacular.com/recipes/716429-556x370.jpg"
          }"
          alt="${recipe.title || t("recipeTitleFallback")}"
        >

        <div class="card-body">

          <h3>
            ${recipe.title || t("recipeTitleFallback")}
          </h3>

          <p class="time">
            ⏱ ${recipe.readyInMinutes || 30} ${t("timeMin")}
          </p>

          <div class="ingredients-count">
            🥗 ${t("usesIngredients")} ${usedCount} ${t("ingredientsWord")}
          </div>

          <div class="ingredients">
            ${usedList}
          </div>

        </div>

      </div>

    `;

  }).join("");

}

if(result){

  result.addEventListener("click", e => {

    const card =
    e.target.closest(".card");

    if(!card) return;

    const id =
    card.dataset.recipeId;

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
          ${item.name || item.original || item}
        </span>
      `).join("")
  : selected
      .map(item => `
        <span>
          ${item}
        </span>
      `).join("");

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
      ⏱ ${recipe.readyInMinutes || 30} min
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

  if(modal){
    modal.style.display = "none";
  }

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

if(langSelectEl){

  langSelectEl.value =
  currentLang;

  langSelectEl.addEventListener("change", () => {

    currentLang =
    langSelectEl.value;

    console.log("LANG SELECT CHANGED:", currentLang);

    localStorage.setItem("niliLang", currentLang);

    applyLanguage();

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

}

/* =========================
   CATEGORY MODAL FINAL FIX
========================= */

const categoryGridFinal =
document.getElementById("categoryGrid");

if(categoryGridFinal){

  categoryGridFinal.addEventListener("click", (e) => {

    const btn =
    e.target.closest(".category-btn");

    if(!btn) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const key =
    btn.dataset.category;

    const items =
    CATEGORY_DATA[key] || [];

    console.log("FINAL CATEGORY KEY:", key);
    console.log("FINAL CATEGORY ITEMS:", items);

    document
    .querySelectorAll(".category-btn")
    .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    openIngredientModal(key, items);

  }, true);

}

setCreatorMode("signup");
applyLanguage();

const creatorContinueBtn =
document.getElementById("creatorContinueBtn");

if(creatorContinueBtn){

  creatorContinueBtn.addEventListener("click", () => {

    console.log("CREATOR CONTINUE CLICKED");

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

    if(creatorMode === "signup" && !username){
      alert(t("alertUsername"));
      return;
    }

    if(!emailOrUser){
      alert(
        creatorMode === "signup"
          ? t("alertEmail")
          : t("alertEmailOrUser")
      );
      return;
    }

    if(!password){
      alert(t("alertPassword"));
      return;
    }

    localStorage.setItem("creatorMode", creatorMode);
    localStorage.setItem("creatorUsername", username);
    localStorage.setItem("creatorEmailOrUser", emailOrUser);

    window.location.href = "/creator.html";

  });

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

    const res = await fetch("/creator-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    window.location.href = "/creator.html";

  }catch(err){

    console.error("CREATOR AUTH FRONTEND ERROR:", err);
    alert("Connection error. Please try again.");

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

  window.setCreatorMode("signup");

});

function toggleLangMenu(){
  document.getElementById("langOptions").classList.toggle("open");
}

function setLang(lang){

  currentLang = lang;

  localStorage.setItem(LANG_STORAGE_KEY, lang);

  const btn = document.getElementById("langBtn");

  document.getElementById("langOptions").classList.remove("open");

  if(btn){
    btn.textContent = "🌐 " + lang.toUpperCase();
  }

  const options = document.getElementById("langOptions");

  if(options){
    options.classList.remove("open");
  }

  applyLanguage();

  preloadIngredientTranslations(currentLang).then(() => {
  if(
    ingredientModal &&
    ingredientModal.style.display === "flex" &&
    activeCategoryKey
  ){
    openIngredientModal(
      activeCategoryKey,
      CATEGORY_DATA[activeCategoryKey]
    );
  }
});
  renderChecklist();

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

}

 