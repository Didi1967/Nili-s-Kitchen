const isLocalPreview =
  ["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.hostname.startsWith("192.168.");

const API_BASE =
  window.API_BASE ||
  (isLocalPreview ? location.origin : "https://api.niliskitchen.com");
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const MAX_PHOTOS = 5;
const MAX_VIDEOS = 3;
const MEDIA_CHUNK_BYTES = 2 * 1024 * 1024;
const urlLang = new URLSearchParams(location.search).get("lang");
let currentLang =
  urlLang ||
  localStorage.getItem("niliLang") ||
  localStorage.getItem("lang") ||
  "en";

if(urlLang){
  localStorage.setItem("niliLang", urlLang);
  localStorage.setItem("lang", urlLang);
}

document.documentElement.lang = currentLang;

const speechLangMap = {
  en:"en-US",
  tr:"tr-TR",
  ru:"ru-RU",
  de:"de-DE",
  fr:"fr-FR",
  es:"es-ES",
  pt:"pt-PT",
  ar:"ar-SA",
  ja:"ja-JP",
  zh:"zh-CN"
};

const creatorI18n = {
  en:{
    pageTitle:"Recipe Creator | Nili's Kitchen", sidebarAria:"Creator steps", homeAria:"Nili's Kitchen home page", uploadLimitsAria:"Upload limits", quickUnitAria:"Quick unit selection",
    brandSubtitle:"Recipe Creator", stepBasic:"1. Basic Info", stepIngredients:"2. Ingredients", stepSteps:"3. Steps", stepMedia:"4. Photo / Video", stepPreview:"5. Preview",
    smartCardTitle:"Smart input", smartCardText:"Type 2-3 letters to get ingredient suggestions. Units are selected from a ready list.",
    heroEyebrow:"User recipe submission screen", heroTitle:"Add recipes easily, keep the system clean.", heroText:"The user writes less; the form standardizes ingredients, units, time and media.", pillPhoto:"1+ photo", creatorLoading:"Creator information loading...",
    smartFillTitle:"Fill recipe fast", smartFillText:"Upload a recipe-page photo, dictate by voice, or paste text. Nili fills the form for you.",
    photoSourceTitle:"Recipe photo", photoSourceText:"Notebook, book, screenshot or ready recipe page.", voiceTitle:"Voice input", voiceText:"Press the microphone and describe the recipe naturally.", voiceStart:"🎙 Start", voiceListening:"Listening...",
    quickTextLabel:"Text or voice transcript", quickTextPlaceholder:"Example: Karniyarik. 4 eggplants, 300 g ground beef... First fry the eggplants...",
    smartFillButton:"Auto-fill form", clearSmart:"Clear this area", basicTitle:"Basic Info", basicText:"Dish name, cuisine, type, servings and time.",
    titleLabel:"Recipe title *", titlePlaceholder:"Example: Karniyarik", typeLabel:"Dish type", cuisineLabel:"Cuisine", servingsLabel:"Servings?", prepLabel:"Prep time", cookLabel:"Cook time", totalLabel:"Total time", descriptionLabel:"Short description", descriptionPlaceholder:"Briefly describe the recipe.",
    ingredientsTitle:"Ingredients", ingredientsText:"Type 2-3 letters to get suggestions. Units are selected from a ready list.", ingredientNameLabel:"Ingredient *", amountLabel:"Amount *", unitLabel:"Unit *", addIngredient:"+ Add", tableIngredient:"Ingredient", tableAmount:"Amount", tableUnit:"Unit",
    ingredientPlaceholder:"eggplant", amountPlaceholder:"4", remove:"Remove",
    stepsTitle:"Recipe Steps", stepsText:"Write each step separately so cards and admin review stay readable.", addStep:"+ Add recipe step", stepPlaceholder:"Write the recipe step",
    mediaTitle:"Photos / Videos", mediaText:"Upload food photos and optional videos. Every file can be previewed and removed.", choosePhoto:"Choose photos", photoLimit:"Up to 5 photos, 5 MB each", chooseVideo:"Choose videos", videoLimit:"Up to 3 videos, 100 MB each", mediaWaiting:"Waiting for photos or videos.",
    previewTitle:"Preview and Submit", previewText:"Check the recipe card before sending.", previewButton:"Create preview", submitButton:"Submit for review", clearButton:"Clear",
    creator:"Creator", guest:"Guest creator", ingredientRequired:"Ingredient name and amount are required.", needSource:"Photo, voice transcript or text is required.", reading:"Reading recipe and preparing the form...", filled:"Form filled. You can review and submit.", fallbackFilled:"Server unavailable, basic filling was created from text.", parseFailed:"Recipe could not be read.", voiceUnsupported:"This browser does not support voice input.", voicePrompt:"Describe the recipe, recording will stop automatically.", voiceError:"Voice could not be captured. Try again.", voiceReady:"Voice converted to text. You can auto-fill the form.", photoLimitError:"Up to {count} photos can be uploaded.", photoSizeError:"{name} exceeds the 5 MB limit.", videoLimitError:"Up to {count} videos can be uploaded.", videoSizeError:"{name} exceeds the 100 MB limit.", selectedPhotos:"{count} photos", selectedVideos:"{count} videos", uploadingMedia:"Uploading media {current}/{total}: {name}", mediaUploadFailed:"Media upload failed: {name}", people:"servings", cuisineMeta:"Cuisine", typeMeta:"Type", minuteShort:"min", titleRequired:"Recipe title is required.", ingredientsRequired:"Add at least one ingredient.", stepsRequired:"Add at least one recipe step.", mediaRequired:"At least one photo or video is required.", mediaCheck:"Check media limits.", submitting:"Submitting recipe for review...", submitted:"Recipe submitted for review. Thank you!", submitError:"An error occurred while submitting.", serverJsonError:"Server did not return JSON. Status: {status}", submitFailed:"Submit failed.", aiReadFailed:"AI reading failed."
  },
  tr:{
    pageTitle:"Recipe Creator | Nili's Kitchen", sidebarAria:"Creator adımları", homeAria:"Nili's Kitchen ana sayfa", uploadLimitsAria:"Yükleme limitleri", quickUnitAria:"Hızlı ölçü seçimi",
    brandSubtitle:"Recipe Creator", stepBasic:"1. Temel Bilgiler", stepIngredients:"2. Malzemeler", stepSteps:"3. Tarif Adımları", stepMedia:"4. Fotoğraf / Video", stepPreview:"5. Önizleme",
    smartCardTitle:"Akıllı giriş", smartCardText:"Malzeme adında 2-3 harf yazınca öneri gelir. Ölçüler hazır listeden seçilir.",
    heroEyebrow:"Kullanıcı tarif gönderme ekranı", heroTitle:"Tarifi kolay ekle, sistemi düzenli tut.", heroText:"Kullanıcı az yazar; form malzeme, ölçü, süre ve medya alanlarını standartlaştırır.", pillPhoto:"1+ foto", creatorLoading:"Creator bilgisi yükleniyor...",
    smartFillTitle:"Tarifi hızlı doldur", smartFillText:"Hazır tarif sayfasının fotoğrafını yükle, sesle anlat veya metin yapıştır. Nili formu senin için doldursun.",
    photoSourceTitle:"Tarif fotoğrafı", photoSourceText:"Defter, kitap, ekran görüntüsü veya hazır tarif sayfası.", voiceTitle:"Sesli anlat", voiceText:"Mikrofona bas, tarifi doğal şekilde anlat.", voiceStart:"🎙 Başlat", voiceListening:"Dinleniyor...",
    quickTextLabel:"Metin veya ses dökümü", quickTextPlaceholder:"Örn: Karnıyarık. 4 patlıcan, 300 gram kıyma... Önce patlıcanları kızart...",
    smartFillButton:"Formu otomatik doldur", clearSmart:"Bu alanı temizle", basicTitle:"Temel Bilgiler", basicText:"Yemeğin adı, mutfağı, türü, porsiyon ve süre bilgileri.",
    titleLabel:"Tarif adı *", titlePlaceholder:"Örn: Karnıyarık", typeLabel:"Yemek türü", cuisineLabel:"Mutfak", servingsLabel:"Kaç kişilik?", prepLabel:"Hazırlık süresi", cookLabel:"Pişirme süresi", totalLabel:"Toplam süre", descriptionLabel:"Kısa açıklama", descriptionPlaceholder:"Tarifi kısaca anlatın.",
    ingredientsTitle:"Malzemeler", ingredientsText:"Malzeme adında 2-3 harf yazınca öneri gelir. Ölçü birimleri hazır listeden seçilir.", ingredientNameLabel:"Malzeme *", amountLabel:"Miktar *", unitLabel:"Ölçü *", addIngredient:"+ Ekle", tableIngredient:"Malzeme", tableAmount:"Miktar", tableUnit:"Ölçü",
    ingredientPlaceholder:"pat", amountPlaceholder:"4", remove:"Sil",
    stepsTitle:"Tarif Adımları", stepsText:"Her adımı ayrı yaz. Kart ve admin ekranı daha okunur olur.", addStep:"+ Tarif adımı ekle", stepPlaceholder:"Tarif adımını yazın",
    mediaTitle:"Fotoğraflar / Videolar", mediaText:"Yemek fotoğraflarını ve isteğe bağlı videoları yükle. Her dosya önizlenebilir ve silinebilir.", choosePhoto:"Fotoğrafları seç", photoLimit:"En fazla 5 fotoğraf, her biri 5 MB", chooseVideo:"Videoları seç", videoLimit:"En fazla 3 video, her biri 100 MB", mediaWaiting:"Fotoğraf veya video bekleniyor.",
    previewTitle:"Önizleme ve Gönderim", previewText:"Göndermeden önce tarif kartını kontrol et.", previewButton:"Önizleme oluştur", submitButton:"İncelemeye gönder", clearButton:"Temizle",
    creator:"Creator", guest:"Guest creator", ingredientRequired:"Malzeme adı ve miktar gerekli.", needSource:"Fotoğraf, ses dökümü veya metin gerekli.", reading:"Tarif okunuyor, form hazırlanıyor...", filled:"Form dolduruldu. Sadece kontrol edip gönderebilirsin.", fallbackFilled:"Sunucuya ulaşılamadı, metinden temel doldurma yapıldı.", parseFailed:"Tarif okunamadı.", voiceUnsupported:"Bu tarayıcı sesli yazmayı desteklemiyor.", voicePrompt:"Tarifi anlat, kayıt otomatik duracak.", voiceError:"Ses alınamadı. Tekrar deneyebilirsin.", voiceReady:"Ses metne çevrildi. İstersen formu otomatik doldur.", photoLimitError:"En fazla {count} fotoğraf yüklenebilir.", photoSizeError:"{name} 5 MB sınırını aşıyor.", videoLimitError:"En fazla {count} video yüklenebilir.", videoSizeError:"{name} 100 MB sınırını aşıyor.", selectedPhotos:"{count} fotoğraf", selectedVideos:"{count} video", uploadingMedia:"Medya yükleniyor {current}/{total}: {name}", mediaUploadFailed:"Medya yüklenemedi: {name}", people:"kişilik", cuisineMeta:"Mutfak", typeMeta:"Tür", minuteShort:"dk", titleRequired:"Tarif adı gerekli.", ingredientsRequired:"En az bir malzeme eklemelisin.", stepsRequired:"En az bir tarif adımı eklemelisin.", mediaRequired:"En az bir fotoğraf veya video gerekli.", mediaCheck:"Medya limitlerini kontrol et.", submitting:"Tarif inceleme için gönderiliyor...", submitted:"Tarif incelemeye gönderildi. Teşekkürler!", submitError:"Gönderim sırasında hata oluştu.", serverJsonError:"Sunucu JSON dönmedi. Status: {status}", submitFailed:"Gönderim başarısız.", aiReadFailed:"AI okuma başarısız."
  }
};

["ru","de","fr","es","pt","ar","ja","zh"].forEach(lang => {
  creatorI18n[lang] = { ...creatorI18n.en };
});

Object.assign(creatorI18n.ru, { brandSubtitle:"Автор рецептов", heroTitle:"Добавляйте рецепты легко.", smartFillTitle:"Быстро заполнить рецепт", smartFillButton:"Заполнить форму", submitButton:"Отправить на проверку", clearButton:"Очистить", mediaWaiting:"Ожидается фото. Видео нет.", creator:"Автор", submitting:"Рецепт отправляется...", submitted:"Рецепт отправлен на проверку. Спасибо!" });
Object.assign(creatorI18n.de, { brandSubtitle:"Rezept Creator", heroTitle:"Rezepte einfach hinzufügen.", smartFillTitle:"Rezept schnell ausfüllen", smartFillButton:"Formular automatisch füllen", submitButton:"Zur Prüfung senden", clearButton:"Leeren", mediaWaiting:"Foto wird erwartet. Kein Video.", creator:"Creator", submitting:"Rezept wird gesendet...", submitted:"Rezept wurde zur Prüfung gesendet. Danke!" });
Object.assign(creatorI18n.fr, { brandSubtitle:"Créateur de recettes", heroTitle:"Ajoutez des recettes facilement.", smartFillTitle:"Remplir vite la recette", smartFillButton:"Remplir automatiquement", submitButton:"Envoyer à la révision", clearButton:"Effacer", mediaWaiting:"Photo attendue. Pas de vidéo.", creator:"Créateur", submitting:"Envoi de la recette...", submitted:"Recette envoyée pour révision. Merci !" });
Object.assign(creatorI18n.es, { brandSubtitle:"Creador de recetas", heroTitle:"Añade recetas fácilmente.", smartFillTitle:"Rellenar receta rápido", smartFillButton:"Autocompletar formulario", submitButton:"Enviar a revisión", clearButton:"Limpiar", mediaWaiting:"Esperando foto. Sin video.", creator:"Creador", submitting:"Enviando receta...", submitted:"Receta enviada a revisión. Gracias." });
Object.assign(creatorI18n.pt, { brandSubtitle:"Criador de receitas", heroTitle:"Adicione receitas facilmente.", smartFillTitle:"Preencher receita rápido", smartFillButton:"Preencher formulário", submitButton:"Enviar para revisão", clearButton:"Limpar", mediaWaiting:"Aguardando foto. Sem vídeo.", creator:"Criador", submitting:"Enviando receita...", submitted:"Receita enviada para revisão. Obrigado." });
Object.assign(creatorI18n.ar, { brandSubtitle:"منشئ الوصفات", heroTitle:"أضف الوصفات بسهولة.", smartFillTitle:"املأ الوصفة بسرعة", smartFillButton:"املأ النموذج تلقائياً", submitButton:"إرسال للمراجعة", clearButton:"مسح", mediaWaiting:"بانتظار صورة. لا يوجد فيديو.", creator:"المنشئ", submitting:"جارٍ إرسال الوصفة...", submitted:"تم إرسال الوصفة للمراجعة. شكراً." });
Object.assign(creatorI18n.ja, { brandSubtitle:"レシピクリエイター", heroTitle:"レシピを簡単に追加。", smartFillTitle:"レシピをすばやく入力", smartFillButton:"フォームを自動入力", submitButton:"審査に提出", clearButton:"クリア", mediaWaiting:"写真待ち。動画なし。", creator:"クリエイター", submitting:"レシピを送信中...", submitted:"レシピを審査に提出しました。ありがとうございます。" });
Object.assign(creatorI18n.zh, { brandSubtitle:"食谱创作者", heroTitle:"轻松添加食谱。", smartFillTitle:"快速填写食谱", smartFillButton:"自动填写表单", submitButton:"提交审核", clearButton:"清空", mediaWaiting:"等待照片。无视频。", creator:"创作者", submitting:"正在提交食谱...", submitted:"食谱已提交审核，谢谢。" });

Object.entries(window.NILI_I18N_EXTRA?.creator || {}).forEach(([lang, values]) => {
  creatorI18n[lang] = { ...(creatorI18n[lang] || creatorI18n.en), ...values };
});

Object.assign(creatorI18n.tr, {
  brandSubtitle:"Tarif Üreticisi", creator:"Üretici", guest:"Misafir üretici"
});
Object.assign(creatorI18n.es, {
  stepSteps:"3. Pasos", stepMedia:"4. Foto / Video", stepPreview:"5. Vista previa",
  smartCardTitle:"Entrada inteligente",
  smartCardText:"Escribe 2 o 3 letras para recibir sugerencias de ingredientes. Elige las unidades de la lista preparada.",
  heroEyebrow:"Pantalla de envío de recetas",
  heroTitle:"Añade recetas fácilmente y mantén el sistema organizado.",
  heroText:"El usuario escribe menos; el formulario estandariza ingredientes, unidades, tiempos y archivos multimedia."
});

function ct(key, vars = {}){
  let value =
    creatorI18n[currentLang]?.[key] ||
    creatorI18n.en[key] ||
    key;

  Object.entries(vars).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, replacement);
  });

  return value;
}

const UNITS = ["adet", "gram", "kg", "ml", "litre", "yemek kaşığı", "tatlı kaşığı", "çay kaşığı", "su bardağı", "çay bardağı", "tutam", "diş", "paket"];
const UNIT_LABELS = {
  en:["piece","gram","kg","ml","liter","tablespoon","teaspoon","small teaspoon","cup","tea glass","pinch","clove","pack"],
  tr:["adet","gram","kg","ml","litre","yemek kaşığı","tatlı kaşığı","çay kaşığı","su bardağı","çay bardağı","tutam","diş","paket"],
  ru:["шт","грамм","кг","мл","литр","столовая ложка","десертная ложка","чайная ложка","стакан","чайный стакан","щепотка","зубчик","пакет"],
  de:["Stück","Gramm","kg","ml","Liter","Esslöffel","Dessertlöffel","Teelöffel","Glas","Teeglas","Prise","Zehe","Packung"],
  fr:["pièce","gramme","kg","ml","litre","cuillère à soupe","cuillère à dessert","cuillère à café","verre","verre à thé","pincée","gousse","paquet"],
  es:["unidad","gramo","kg","ml","litro","cucharada","cucharadita","cucharadita pequeña","vaso","vaso de té","pizca","diente","paquete"],
  pt:["unidade","grama","kg","ml","litro","colher de sopa","colher de sobremesa","colher de chá","copo","copo de chá","pitada","dente","pacote"],
  ar:["قطعة","غرام","كغ","مل","لتر","ملعقة كبيرة","ملعقة حلوى","ملعقة صغيرة","كوب","كوب شاي","رشة","فص","عبوة"],
  ja:["個","グラム","kg","ml","リットル","大さじ","デザートスプーン","小さじ","カップ","ティーグラス","ひとつまみ","片","袋"],
  zh:["个","克","公斤","毫升","升","汤匙","甜点匙","茶匙","杯","茶杯","少许","瓣","包"]
};
const DISH_TYPES = {
  en:["Main dish","Meat dishes","Vegetable dishes","Pasta","Soup","Breakfast","Dessert","Appetizer"],
  tr:["Ana yemek","Et yemekleri","Sebze yemekleri","Makarna","Çorba","Kahvaltı","Tatlı","Meze"],
  ru:["Основное блюдо","Мясные блюда","Овощные блюда","Паста","Суп","Завтрак","Десерт","Закуска"],
  de:["Hauptgericht","Fleischgerichte","Gemüsegerichte","Pasta","Suppe","Frühstück","Dessert","Vorspeise"],
  fr:["Plat principal","Plats de viande","Plats de légumes","Pâtes","Soupe","Petit-déjeuner","Dessert","Entrée"],
  es:["Plato principal","Platos de carne","Platos de verduras","Pasta","Sopa","Desayuno","Postre","Entrante"],
  pt:["Prato principal","Pratos de carne","Pratos de legumes","Massa","Sopa","Café da manhã","Sobremesa","Entrada"],
  ar:["طبق رئيسي","أطباق اللحوم","أطباق الخضار","معكرونة","شوربة","إفطار","حلوى","مقبلات"],
  ja:["メイン料理","肉料理","野菜料理","パスタ","スープ","朝食","デザート","前菜"],
  zh:["主菜","肉类菜肴","蔬菜菜肴","意大利面","汤","早餐","甜点","开胃菜"]
};
const CUISINES = {
  en:["Turkey","Italy","Mexico","India","China","Japan","France","Greece","USA","Thailand"],
  tr:["Türkiye","İtalya","Meksika","Hindistan","Çin","Japonya","Fransa","Yunanistan","ABD","Tayland"],
  ru:["Турция","Италия","Мексика","Индия","Китай","Япония","Франция","Греция","США","Таиланд"],
  de:["Türkei","Italien","Mexiko","Indien","China","Japan","Frankreich","Griechenland","USA","Thailand"],
  fr:["Turquie","Italie","Mexique","Inde","Chine","Japon","France","Grèce","États-Unis","Thaïlande"],
  es:["Turquía","Italia","México","India","China","Japón","Francia","Grecia","EE. UU.","Tailandia"],
  pt:["Turquia","Itália","México","Índia","China","Japão","França","Grécia","EUA","Tailândia"],
  ar:["تركيا","إيطاليا","المكسيك","الهند","الصين","اليابان","فرنسا","اليونان","أمريكا","تايلاند"],
  ja:["トルコ","イタリア","メキシコ","インド","中国","日本","フランス","ギリシャ","アメリカ","タイ"],
  zh:["土耳其","意大利","墨西哥","印度","中国","日本","法国","希腊","美国","泰国"]
};
const INGREDIENTS = [
  "patlıcan", "patates", "domates", "soğan", "sarımsak", "yeşil biber", "kırmızı biber",
  "dana kıyma", "tavuk göğsü", "tavuk but", "biftek", "kuzu eti", "somon", "karides",
  "pirinç", "bulgur", "makarna", "erişte", "un", "mısır unu", "galeta unu",
  "yumurta", "süt", "yoğurt", "tereyağı", "zeytinyağı", "ayçiçek yağı", "krema",
  "kaşar peyniri", "beyaz peynir", "mozzarella", "parmesan", "mercimek", "nohut",
  "fasulye", "bezelye", "havuç", "kabak", "brokoli", "ıspanak", "mantar", "marul",
  "maydanoz", "dereotu", "nane", "fesleğen", "kişniş", "limon", "portakal", "elma",
  "çilek", "muz", "avokado", "tuz", "karabiber", "pul biber", "kekik", "kimyon",
  "zerdeçal", "tarçın", "şeker", "bal", "domates salçası", "biber salçası", "sirke",
  "soya sosu", "hardal", "mayonez"
];
const INGREDIENTS_BY_LANG = {
  tr: INGREDIENTS,
  en: [
    "eggplant", "potato", "tomato", "onion", "garlic", "green pepper", "red pepper",
    "ground beef", "chicken breast", "chicken thigh", "steak", "lamb", "salmon", "shrimp",
    "rice", "bulgur", "pasta", "noodles", "flour", "corn flour", "breadcrumbs",
    "egg", "milk", "yogurt", "butter", "olive oil", "sunflower oil", "cream",
    "cheddar cheese", "feta cheese", "mozzarella", "parmesan", "lentils", "chickpeas",
    "beans", "peas", "carrot", "zucchini", "broccoli", "spinach", "mushroom", "lettuce",
    "parsley", "dill", "mint", "basil", "cilantro", "lemon", "orange", "apple",
    "strawberry", "banana", "avocado", "salt", "black pepper", "red pepper flakes",
    "thyme", "cumin", "turmeric", "cinnamon", "sugar", "honey", "tomato paste",
    "pepper paste", "vinegar", "soy sauce", "mustard", "mayonnaise"
  ]
};

const form = document.getElementById("recipeCreatorForm");
const prepTime = document.getElementById("prepTime");
const cookTime = document.getElementById("cookTime");
const totalTime = document.getElementById("totalTime");
const ingredientName = document.getElementById("ingredientName");
const ingredientAmount = document.getElementById("ingredientAmount");
const ingredientUnit = document.getElementById("ingredientUnit");
const ingredientSuggestions = document.getElementById("ingredientSuggestions");
const addIngredientBtn = document.getElementById("addIngredientBtn");
const ingredientsTable = document.getElementById("ingredientsTable");
const stepsList = document.getElementById("stepsList");
const addStepBtn = document.getElementById("addStepBtn");
const photos = document.getElementById("photos");
const video = document.getElementById("video");
const mediaStatus = document.getElementById("mediaStatus");
const previewBtn = document.getElementById("previewBtn");
const previewBox = document.getElementById("previewBox");
const imagePreviewGrid = document.getElementById("imagePreviewGrid");
const formMessage = document.getElementById("formMessage");
const clearFormBtn = document.getElementById("clearFormBtn");
const recipePhotoSource = document.getElementById("recipePhotoSource");
const quickRecipeText = document.getElementById("quickRecipeText");
const smartFillBtn = document.getElementById("smartFillBtn");
const voiceFillBtn = document.getElementById("voiceFillBtn");
const clearSmartBtn = document.getElementById("clearSmartBtn");
const smartFillStatus = document.getElementById("smartFillStatus");

let recipeIngredients = [];
let selectedPhotos = [];
let selectedVideos = [];

function normalizeText(value){
  return String(value || "").toLocaleLowerCase("tr-TR").trim();
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCreatorIdentity(){
  const username = localStorage.getItem("creatorUsername") || localStorage.getItem("niliCreatorUsername") || ct("guest");
  const email = localStorage.getItem("creatorEmail") || localStorage.getItem("creatorEmailOrUser") || localStorage.getItem("niliCreatorEmail") || "";
  document.getElementById("creatorUsernameHidden").value = username;
  document.getElementById("creatorEmailHidden").value = email;
  document.getElementById("creatorInfo").textContent = email ? `${ct("creator")}: ${username} - ${email}` : `${ct("creator")}: ${username}`;
}

function applyCreatorLanguage(){
  document.title = ct("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = ct(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    element.placeholder = ct(element.dataset.i18nPlaceholder);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
    element.setAttribute("aria-label", ct(element.dataset.i18nAriaLabel));
  });

  const homeLink = document.getElementById("creatorHomeLink");
  if(homeLink){
    homeLink.href = `/?lang=${currentLang}`;
  }
}

function getLocalizedList(source){
  return source[currentLang] || source.en;
}

function setSelectOptions(selectId, options, selectedValue = ""){
  const select = document.getElementById(selectId);
  if(!select) return;
  const previous = selectedValue || select.value;
  select.innerHTML = options.map((label, index) =>
    `<option value="${escapeHtml(label)}" data-index="${index}">${escapeHtml(label)}</option>`
  ).join("");

  const normalizedPrevious = normalizeText(previous);
  const matchingOption = [...select.options].find(option =>
    normalizeText(option.value) === normalizedPrevious ||
    normalizeText(option.textContent) === normalizedPrevious
  );

  if(matchingOption){
    select.value = matchingOption.value;
  }
}

function renderSelectOptions(){
  setSelectOptions("type", getLocalizedList(DISH_TYPES));
  setSelectOptions("cuisine", getLocalizedList(CUISINES));
}

function renderUnits(){
  const units = getLocalizedList(UNIT_LABELS);
  ingredientUnit.innerHTML = units.map(unit => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("");
  document.getElementById("quickUnits").innerHTML = units.slice(0, 7).map(unit =>
    `<button type="button" data-quick-unit="${escapeHtml(unit)}">${escapeHtml(unit)}</button>`
  ).join("");
}

function updateTotalTime(){
  const prep = Number(prepTime.value || 0);
  const cook = Number(cookTime.value || 0);
  totalTime.value = `${prep + cook} ${ct("minuteShort")}`;
}

function showSuggestions(){
  const query = normalizeText(ingredientName.value);
  if(query.length < 2){
    ingredientSuggestions.hidden = true;
    ingredientSuggestions.innerHTML = "";
    return;
  }
  const matches = (INGREDIENTS_BY_LANG[currentLang] || INGREDIENTS_BY_LANG.en)
    .filter(item => normalizeText(item).includes(query))
    .slice(0, 6);
  if(!matches.length){
    ingredientSuggestions.hidden = true;
    return;
  }
  ingredientSuggestions.innerHTML = matches.map(item =>
    `<button type="button" data-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`
  ).join("");
  ingredientSuggestions.hidden = false;
}

function addIngredient(){
  const name = ingredientName.value.trim();
  const amount = ingredientAmount.value.trim();
  const unit = ingredientUnit.value;
  if(!name || !amount){
    formMessage.textContent = ct("ingredientRequired");
    formMessage.style.color = "#b45309";
    return;
  }
  recipeIngredients.push({ name, amount, unit });
  ingredientName.value = "";
  ingredientAmount.value = "";
  ingredientSuggestions.hidden = true;
  renderIngredients();
  ingredientName.focus();
}

function renderIngredients(){
  ingredientsTable.innerHTML = recipeIngredients.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.amount)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td><button class="row-remove" type="button" data-remove-ingredient="${index}" aria-label="${escapeHtml(ct("remove"))}">x</button></td>
    </tr>
  `).join("");
}

function addStep(value = ""){
  const item = document.createElement("div");
  item.className = "step-item";
  item.innerHTML = `
    <span class="step-no"></span>
    <textarea class="step-text" rows="2" placeholder="${escapeHtml(ct("stepPlaceholder"))}">${escapeHtml(value)}</textarea>
    <button class="step-remove" type="button" aria-label="${escapeHtml(ct("remove"))}">x</button>
  `;
  stepsList.appendChild(item);
  renumberSteps();
}

function fillRecipeForm(data){
  if(!data || typeof data !== "object") return;
  document.getElementById("title").value = data.title || "";
  setSelectOptions("type", getLocalizedList(DISH_TYPES), data.type || document.getElementById("type").value);
  setSelectOptions("cuisine", getLocalizedList(CUISINES), data.cuisine || document.getElementById("cuisine").value);
  document.getElementById("servings").value = data.servings || 4;
  prepTime.value = Number(data.prepTime || 15);
  cookTime.value = Number(data.cookTime || 30);
  document.getElementById("description").value = data.description || "";
  updateTotalTime();

  recipeIngredients = Array.isArray(data.ingredients)
    ? data.ingredients.map(item => ({
      name: item.name || item.ingredient || "",
      amount: item.amount || item.quantity || "",
      unit: item.unit || getLocalizedList(UNIT_LABELS)[0]
    })).filter(item => item.name && item.amount)
    : [];
  renderIngredients();

  stepsList.innerHTML = "";
  const steps = Array.isArray(data.steps) ? data.steps : [];
  if(steps.length){
    steps.forEach(step => addStep(step));
  }else{
    addStep();
  }

  document.getElementById("basic").scrollIntoView({ behavior:"smooth", block:"start" });
}

function parseRecipeLocally(text){
  const lines = String(text || "")
    .split(/\n|\. /)
    .map(line => line.trim())
    .filter(Boolean);
  const title = lines[0]?.replace(/^tarif[:\s-]*/i, "").slice(0, 80) || "";
  const ingredients = [];
  const steps = [];
  const amountPattern = /^(\d+[\d\/.,]*|yarım|bir|iki|üç|dört|beş)\s+([a-zçğıöşü\s]+?)\s+(.+)$/i;
  lines.slice(1).forEach(line => {
    const match = line.match(amountPattern);
    if(match && ingredients.length < 30){
      ingredients.push({ amount: match[1], unit: match[2].trim(), name: match[3].trim() });
    }else if(line.length > 18){
      steps.push(line);
    }
  });
  return {
    title,
    type:getLocalizedList(DISH_TYPES)[0],
    cuisine:getLocalizedList(CUISINES)[0],
    servings:4,
    prepTime:15,
    cookTime:30,
    description:lines.slice(1, 3).join(" "),
    ingredients,
    steps
  };
}

async function smartFillRecipe(){
  const text = quickRecipeText.value.trim();
  const image = recipePhotoSource.files[0];
  if(!text && !image){
    smartFillStatus.textContent = ct("needSource");
    smartFillStatus.style.color = "#b45309";
    return;
  }

  smartFillStatus.textContent = ct("reading");
  smartFillStatus.style.color = "#74675d";

  try{
    const payload = new FormData();
    payload.append("text", text);
    if(image) payload.append("recipeImage", image);

    const response = await fetch(`${API_BASE}/creator/parse-recipe`, {
      method:"POST",
      body:payload
    });
    const data = await response.json();
    if(!response.ok || !data.success) throw new Error(data.error || ct("aiReadFailed"));
    fillRecipeForm(data.recipe);
    smartFillStatus.textContent = ct("filled");
    smartFillStatus.style.color = "#315c45";
  }catch(err){
    const fallback = parseRecipeLocally(text);
    if(fallback.title || fallback.ingredients.length || fallback.steps.length){
      fillRecipeForm(fallback);
      smartFillStatus.textContent = ct("fallbackFilled");
      smartFillStatus.style.color = "#b45309";
      return;
    }
    smartFillStatus.textContent = err.message || ct("parseFailed");
    smartFillStatus.style.color = "#b91c1c";
  }
}

function startVoiceFill(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    smartFillStatus.textContent = ct("voiceUnsupported");
    smartFillStatus.style.color = "#b45309";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = speechLangMap[currentLang] || "en-US";
  recognition.interimResults = false;
  recognition.continuous = true;
  voiceFillBtn.textContent = ct("voiceListening");
  smartFillStatus.textContent = ct("voicePrompt");
  recognition.onresult = event => {
    const text = [...event.results].map(result => result[0].transcript).join(" ");
    quickRecipeText.value = `${quickRecipeText.value} ${text}`.trim();
  };
  recognition.onerror = () => {
    smartFillStatus.textContent = ct("voiceError");
    smartFillStatus.style.color = "#b45309";
  };
  recognition.onend = () => {
    voiceFillBtn.textContent = ct("voiceStart");
    if(quickRecipeText.value.trim()){
      smartFillStatus.textContent = ct("voiceReady");
      smartFillStatus.style.color = "#315c45";
    }
  };
  recognition.start();
  setTimeout(() => recognition.stop(), 45000);
}

function renumberSteps(){
  [...stepsList.querySelectorAll(".step-item")].forEach((item, index) => {
    item.querySelector(".step-no").textContent = index + 1;
  });
}

function validateMedia(){
  const messages = [];
  if(selectedPhotos.length > MAX_PHOTOS) messages.push(ct("photoLimitError", { count: MAX_PHOTOS }));
  selectedPhotos.forEach(file => {
    if(file.size > PHOTO_MAX_BYTES) messages.push(ct("photoSizeError", { name:file.name }));
  });
  if(selectedVideos.length > MAX_VIDEOS) messages.push(ct("videoLimitError", { count:MAX_VIDEOS }));
  selectedVideos.forEach(file => {
    if(file.size > VIDEO_MAX_BYTES) messages.push(ct("videoSizeError", { name:file.name }));
  });
  if(messages.length){
    mediaStatus.innerHTML = messages.map(message => `⚠ ${escapeHtml(message)}`).join("<br>");
    mediaStatus.style.color = "#b45309";
    return false;
  }
  mediaStatus.style.color = "";
  mediaStatus.textContent = `${ct("selectedPhotos", { count:selectedPhotos.length })} · ${ct("selectedVideos", { count:selectedVideos.length })}`;
  return true;
}

function renderMediaPreview(){
  imagePreviewGrid.innerHTML = "";
  const files = [...selectedPhotos, ...selectedVideos];
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const thumb = document.createElement("div");
    thumb.className = "media-thumb";
    thumb.innerHTML = `<button type="button" data-remove-media="${index}" aria-label="${escapeHtml(ct("remove"))}">x</button>`;
    if(file.type.startsWith("video/")){
      const vid = document.createElement("video");
      vid.src = url;
      vid.controls = true;
      vid.playsInline = true;
      thumb.prepend(vid);
    }else{
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      thumb.prepend(img);
    }
    imagePreviewGrid.appendChild(thumb);
  });
  validateMedia();
}

function collectRecipeData(){
  const steps = [...stepsList.querySelectorAll(".step-text")]
    .map(input => input.value.trim())
    .filter(Boolean);
  return {
    title: document.getElementById("title").value.trim(),
    type: document.getElementById("type").value,
    cuisine: document.getElementById("cuisine").value,
    servings: document.getElementById("servings").value || "4",
    prepTime: totalTime.value,
    description: document.getElementById("description").value.trim(),
    ingredients: [...recipeIngredients],
    steps
  };
}

function validateRecipeData(data){
  if(!data.title) return ct("titleRequired");
  if(!data.ingredients.length) return ct("ingredientsRequired");
  if(!data.steps.length) return ct("stepsRequired");
  if(!selectedPhotos.length && !selectedVideos.length) return ct("mediaRequired");
  if(!validateMedia()) return ct("mediaCheck");
  return "";
}

function getPrimaryImageUrl(){
  if(selectedPhotos[0]) return URL.createObjectURL(selectedPhotos[0]);
  return "";
}

function renderRecipeCard(data){
  const imageUrl = getPrimaryImageUrl();
  const ingredients = data.ingredients.slice(0, 8).map(item =>
    `<span>${escapeHtml(item.amount)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}</span>`
  ).join("");
  const steps = data.steps.map((step, index) =>
    `<p><strong>${index + 1}.</strong> ${escapeHtml(step)}</p>`
  ).join("");
  return `
    <article class="preview-card">
      ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(data.title)}">` : ""}
      <div class="preview-body">
        <h3>${escapeHtml(data.title)}</h3>
        <div class="preview-meta">
          <span>${escapeHtml(data.cuisine)}</span>
          <span>${escapeHtml(data.servings)} ${ct("people")}</span>
          <span>${escapeHtml(data.prepTime)}</span>
        </div>
        <div class="preview-ingredients">${ingredients}</div>
        <div class="preview-steps">${steps}</div>
      </div>
    </article>
  `;
}

function showRecipePreview(){
  const data = collectRecipeData();
  const error = validateRecipeData(data);
  if(error){
    formMessage.textContent = error;
    formMessage.style.color = "#b45309";
    return;
  }
  previewBox.innerHTML = renderRecipeCard(data);
  previewBox.hidden = false;
  formMessage.textContent = "";
}

async function uploadCreatorMediaFile(file,fileIndex,totalFiles){
  const uploadId=(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/[^a-zA-Z0-9_-]/g,"");
  const totalChunks=Math.ceil(file.size/MEDIA_CHUNK_BYTES);
  let token="";

  formMessage.textContent=ct("uploadingMedia",{
    current:fileIndex+1,
    total:totalFiles,
    name:file.name
  });

  for(let chunkIndex=0;chunkIndex<totalChunks;chunkIndex+=1){
    const start=chunkIndex*MEDIA_CHUNK_BYTES;
    const formData=new FormData();
    formData.append("chunk",file.slice(start,Math.min(start+MEDIA_CHUNK_BYTES,file.size)),file.name);
    formData.append("uploadId",uploadId);
    formData.append("fileName",file.name);
    formData.append("fileType",file.type || "application/octet-stream");
    formData.append("chunkIndex",String(chunkIndex));
    formData.append("totalChunks",String(totalChunks));
    formData.append("totalSize",String(file.size));

    const response=await fetch(`${API_BASE}/upload-creator-media-chunk`,{
      method:"POST",
      body:formData
    });
    const raw=await response.text();
    let result={};
    try{result=JSON.parse(raw)}catch{}
    if(!response.ok){
      throw new Error(result.error || ct("mediaUploadFailed",{name:file.name}));
    }
    if(result.complete) token=result.token || "";
  }

  if(!token) throw new Error(ct("mediaUploadFailed",{name:file.name}));
  return token;
}

async function submitRecipe(data){
  const mediaFiles=[...selectedPhotos,...selectedVideos];
  const mediaTokens=[];
  for(let index=0;index<mediaFiles.length;index+=1){
    mediaTokens.push(await uploadCreatorMediaFile(mediaFiles[index],index,mediaFiles.length));
  }

  const payload = new FormData();
  payload.append("creatorUsername", document.getElementById("creatorUsernameHidden").value);
  payload.append("creatorEmail", document.getElementById("creatorEmailHidden").value);
  payload.append("title", data.title);
  payload.append("prepTime", data.prepTime);
  payload.append("servings", data.servings);
  payload.append("ingredients", data.ingredients.map(item => `${item.amount} ${item.unit} ${item.name}`).join("\n"));
  payload.append("instructions", [
    data.description,
    `${ct("cuisineMeta")}: ${data.cuisine}`,
    `${ct("typeMeta")}: ${data.type}`,
    "",
    ...data.steps.map((step, index) => `${index + 1}. ${step}`)
  ].filter(Boolean).join("\n"));
  payload.append("mediaTokens",JSON.stringify(mediaTokens));

  const response = await fetch(`${API_BASE}/submit-recipe`, {
    method: "POST",
    body: payload
  });
  const raw = await response.text();
  let result = {};
  try{
    result = JSON.parse(raw);
  }catch(err){
    throw new Error(ct("serverJsonError", { status: response.status }));
  }
  if(!response.ok){
    throw new Error(result.error || ct("submitFailed"));
  }
  return result;
}

function clearCreatorForm(){
  form.reset();
  recipeIngredients = [];
  selectedPhotos = [];
  selectedVideos = [];
  renderIngredients();
  imagePreviewGrid.innerHTML = "";
  previewBox.hidden = true;
  previewBox.innerHTML = "";
  mediaStatus.textContent = ct("mediaWaiting");
  formMessage.textContent = "";
  stepsList.innerHTML = "";
  updateTotalTime();
  addStep();
}

prepTime.addEventListener("input", updateTotalTime);
cookTime.addEventListener("input", updateTotalTime);
ingredientName.addEventListener("input", showSuggestions);
ingredientSuggestions.addEventListener("click", event => {
  const button = event.target.closest("[data-suggestion]");
  if(!button) return;
  ingredientName.value = button.dataset.suggestion;
  ingredientSuggestions.hidden = true;
  ingredientAmount.focus();
});
document.addEventListener("click", event => {
  if(!event.target.closest(".ingredient-name-wrap")) ingredientSuggestions.hidden = true;
});
addIngredientBtn.addEventListener("click", addIngredient);
ingredientName.addEventListener("keydown", event => {
  if(event.key === "Enter"){
    event.preventDefault();
    addIngredient();
  }
});
ingredientsTable.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-ingredient]");
  if(!button) return;
  recipeIngredients.splice(Number(button.dataset.removeIngredient), 1);
  renderIngredients();
});
document.getElementById("quickUnits").addEventListener("click", event => {
  const button = event.target.closest("[data-quick-unit]");
  if(button) ingredientUnit.value = button.dataset.quickUnit;
});
addStepBtn.addEventListener("click", () => addStep());
stepsList.addEventListener("click", event => {
  if(!event.target.closest(".step-remove")) return;
  event.target.closest(".step-item").remove();
  renumberSteps();
});
photos.addEventListener("change", () => {
  selectedPhotos = [...selectedPhotos, ...Array.from(photos.files)].slice(0, MAX_PHOTOS);
  photos.value = "";
  renderMediaPreview();
});
video.addEventListener("change", () => {
  selectedVideos = [...selectedVideos, ...Array.from(video.files)].slice(0, MAX_VIDEOS);
  video.value = "";
  renderMediaPreview();
});
imagePreviewGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-media]");
  if(!button) return;
  const index = Number(button.dataset.removeMedia);
  if(index < selectedPhotos.length){
    selectedPhotos.splice(index, 1);
  }else{
    selectedVideos.splice(index-selectedPhotos.length, 1);
  }
  renderMediaPreview();
});
previewBtn.addEventListener("click", showRecipePreview);
clearFormBtn.addEventListener("click", clearCreatorForm);
smartFillBtn.addEventListener("click", smartFillRecipe);
voiceFillBtn.addEventListener("click", startVoiceFill);
clearSmartBtn.addEventListener("click", () => {
  quickRecipeText.value = "";
  recipePhotoSource.value = "";
  smartFillStatus.textContent = "";
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = collectRecipeData();
  const error = validateRecipeData(data);
  if(error){
    formMessage.textContent = error;
    formMessage.style.color = "#b45309";
    return;
  }
  formMessage.textContent = ct("submitting");
  formMessage.style.color = "#74675d";
  try{
    await submitRecipe(data);
    formMessage.textContent = ct("submitted");
    formMessage.style.color = "#315c45";
    clearCreatorForm();
  }catch(err){
    formMessage.textContent = err.message || ct("submitError");
    formMessage.style.color = "#b91c1c";
  }
});

applyCreatorLanguage();
renderSelectOptions();
setCreatorIdentity();
renderUnits();
updateTotalTime();
addStep();
