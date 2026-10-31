const IS_LOCAL_PREVIEW = ["127.0.0.1","localhost"].includes(window.location.hostname);
const API_BASE = window.NILI_API_BASE || (IS_LOCAL_PREVIEW ? "http://127.0.0.1:3000" : "https://api.niliskitchen.com");
const APPROVED_CARD_BASE = window.NILI_CARD_BASE || "https://api.niliskitchen.com";
const selectedRecipes = new Map();
let visibleRecipes = [];
let currentOffset = 0;
let hasMore = false;
const PAGE_SIZE = 30;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
const mediaUrl = value => {
  const url = String(value || "");
  if(!url) return "/logo.jpeg";
  if(/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}/${url.replace(/^\/+/,"")}`;
};
const recipeImage = recipe => recipe.image || recipe.mediaUrl || recipe.originalMediaUrl || recipe.imageUrl || recipe.photo || recipe.mediaUrls?.[0] || "";
const targetSize = () => $("bookSize").value === "full" ? Infinity : Number($("bookSize").value);

function setDraftStatus(message, tone = ""){
  const node=$("draftStatus");
  if(!node) return;
  node.className=`draft-status${tone ? ` is-${tone}` : ""}`;
  node.textContent=message;
}

function priceForSize(value){
  if(String(value) === "50") return "€0*";
  if(value === "full") return "€49,90";
  const size = Number(value);
  if(size <= 20) return "€7,90";
  if(size <= 50) return "€11,90";
  if(size <= 100) return "€16,90";
  if(size <= 300) return "€24,90";
  if(size <= 500) return "€32,90";
  return "€44,90";
}

function updateBookSummary(){
  const rawTarget = $("bookSize").value;
  const target = targetSize();
  $("coverTitle").textContent = $("bookTitle").value.trim() || "Benim Tarif Kitabım";
  $("coverCount").textContent = rawTarget === "full" ? "Tüm" : rawTarget;
  $("bookPrice").textContent = priceForSize(rawTarget);
  $("priceNote").textContent = String(rawTarget) === "50" ? "* İlk 100 adet için lansman hediyesi." : "Ödeme sistemi sonraki aşamada bağlanacak.";
  const recipient=$("recipientName").value.trim();
  const message=$("bookMessage").value.trim() || "Nili's Kitchen'dan sevgiyle";
  $("coverDedication").textContent=`${recipient ? `${recipient}’ye ` : ""}${message} ♡`;
  $("selectedCount").textContent = selectedRecipes.size;
  $("targetCount").textContent = rawTarget === "full" ? "Tümü" : rawTarget;
  $("selectionProgress").style.width = `${target === Infinity ? (selectedRecipes.size ? 12 : 0) : Math.min(100, selectedRecipes.size / target * 100)}%`;
  renderSelectedRecipes();
}

function renderSelectedRecipes(){
  const tray=$("selectedRecipeTray");
  const recipes=[...selectedRecipes.values()];
  tray.hidden=!recipes.length;
  $("selectedTrayCount").textContent=`${recipes.length} tarif`;
  $("selectedRecipeList").innerHTML=recipes.map(recipe=>{
    const id=String(recipe.id || recipe.sourceId || "");
    return `<article class="selected-recipe-item">
      <img src="${escapeHtml(mediaUrl(recipeImage(recipe)))}" alt="" onerror="this.src='/logo.jpeg'">
      <span>${escapeHtml(recipe.title || "İsimsiz tarif")}</span>
      <button type="button" data-remove-recipe="${escapeHtml(id)}" aria-label="${escapeHtml(recipe.title || "Tarif")} tarifini kitaptan çıkar">×</button>
    </article>`;
  }).join("");
}

async function loadOptions(){
  try{
    const response = await fetch(`${API_BASE}/world-recipe-options`);
    const data = await response.json();
    (data.cuisines || []).forEach(item => $("recipeCuisine").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`));
    (data.categories || []).forEach(item => {
      const value=typeof item === "object" ? item.id : item;
      const label=typeof item === "object" ? item.label : item;
      $("recipeCategory").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
    });
  }catch(error){ console.warn("Book options failed", error); }
}

function renderRecipes(){
  $("recipeResults").innerHTML = visibleRecipes.map(recipe => {
    const id = String(recipe.id || recipe.sourceId || "");
    const selected = selectedRecipes.has(id);
    const image = recipeImage(recipe);
    return `<label class="recipe-choice${selected ? " is-selected" : ""}" data-id="${escapeHtml(id)}">
      <input type="checkbox" ${selected ? "checked" : ""} aria-label="Tarifi seç">
      <img src="${escapeHtml(mediaUrl(image))}" alt="" loading="lazy" onerror="this.src='/logo.jpeg'">
      <section><h3>${escapeHtml(recipe.title || "İsimsiz tarif")}</h3><p><b>${escapeHtml(recipe.country || recipe.cuisine || "Nili's Kitchen")}</b><span>${escapeHtml(recipe.category || recipe.dishType || "Tarif")}</span></p></section>
    </label>`;
  }).join("");
  $("loadMore").hidden = !hasMore;
  $("resultStatus").textContent = `${visibleRecipes.length} tarif gösteriliyor · ${selectedRecipes.size} seçili`;
}

async function searchRecipes(reset = true){
  if(reset){ currentOffset = 0; visibleRecipes = []; }
  $("resultStatus").textContent = "Tarifler aranıyor...";
  try{
    const response = await fetch(`${API_BASE}/discover-recipes`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query:$("recipeQuery").value.trim(),cuisine:$("recipeCuisine").value,category:$("recipeCategory").value,lang:$("bookLanguage").value,niliOnly:true,limit:PAGE_SIZE,offset:currentOffset})
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || "Tarifler yüklenemedi");
    const incoming = Array.isArray(data.recipes) ? data.recipes : [];
    const known = new Set(visibleRecipes.map(item => String(item.id || item.sourceId)));
    visibleRecipes.push(...incoming.filter(item => !known.has(String(item.id || item.sourceId))));
    currentOffset += incoming.length;
    hasMore = Boolean(data.meta?.hasMore);
    renderRecipes();
  }catch(error){ $("resultStatus").textContent = `Tarifler yüklenemedi: ${error.message}`; }
}

$("recipeResults").addEventListener("change", event => {
  const card = event.target.closest(".recipe-choice");
  if(!card) return;
  const recipe = visibleRecipes.find(item => String(item.id || item.sourceId) === card.dataset.id);
  if(event.target.checked){
    if(targetSize() !== Infinity && selectedRecipes.size >= targetSize()){
      event.target.checked = false;
      alert(`Bu kitap için en fazla ${targetSize()} tarif seçebilirsiniz.`);
      return;
    }
    selectedRecipes.set(card.dataset.id, recipe);
  }else selectedRecipes.delete(card.dataset.id);
  renderRecipes(); updateBookSummary();
});

$("recipeSearchForm").addEventListener("submit", event => { event.preventDefault(); searchRecipes(true); });
$("recipeQuery").addEventListener("input", () => {
  if(!$("recipeQuery").value.trim()) return;
  $("recipeCuisine").value="";
  $("recipeCategory").value="";
});
$("recipeCuisine").addEventListener("change", () => {
  $("recipeQuery").value="";
  searchRecipes(true);
});
$("recipeCategory").addEventListener("change", () => {
  $("recipeQuery").value="";
  searchRecipes(true);
});
$("loadMore").addEventListener("click", () => searchRecipes(false));
$("selectVisible").addEventListener("click", () => {
  for(const recipe of visibleRecipes){
    if(targetSize() !== Infinity && selectedRecipes.size >= targetSize()) break;
    selectedRecipes.set(String(recipe.id || recipe.sourceId), recipe);
  }
  renderRecipes(); updateBookSummary();
});
$("clearSelection").addEventListener("click", () => { selectedRecipes.clear(); renderRecipes(); updateBookSummary(); });
$("selectedRecipeList").addEventListener("click",event=>{
  const button=event.target.closest("[data-remove-recipe]");
  if(!button) return;
  selectedRecipes.delete(button.dataset.removeRecipe);
  renderRecipes();
  updateBookSummary();
});
$("bookTitle").addEventListener("input", updateBookSummary);
$("recipientName").addEventListener("input", updateBookSummary);
$("bookMessage").addEventListener("input", updateBookSummary);
$("bookSize").addEventListener("change", () => {
  const target = targetSize();
  if(target !== Infinity && selectedRecipes.size > target){
    [...selectedRecipes.keys()].slice(target).forEach(id => selectedRecipes.delete(id));
    renderRecipes();
  }
  updateBookSummary();
});
$("bookLanguage").addEventListener("change", () => searchRecipes(true));
let flipbookPages=[];
let flipbookIndex=0;

const BOOK_COPY={
  tr:{story:"Nili’s Kitchen’a hoş geldiniz",storyText:"Dünyanın farklı mutfaklarından özenle seçilen tarifleri sıcak, anlaşılır ve neşeli bir sofrada buluşturuyoruz.",personal:"Bu kitap sana özel",personalText:"Seçtiğin tarifler, tercih ettiğin dil ve kişisel mesajınla yalnızca senin için hazırlandı.",contents:"İçindekiler",contentsHint:"Tarife gitmek için adına dokun.",thanks:"Birlikte pişirdiğimiz için teşekkürler",thanksText:"Her tarifin sofranıza güzel anılar ve paylaşılacak yeni lezzetler getirmesini dileriz.",copyright:"Bu dijital kitap yalnızca satın alan kişinin kişisel kullanımı içindir. İzinsiz çoğaltılamaz, satılamaz veya dağıtılamaz."},
  en:{story:"Welcome to Nili’s Kitchen",storyText:"We bring carefully selected recipes from world cuisines together around a warm, clear and joyful table.",personal:"This book is made for you",personalText:"Your chosen recipes, language and personal message were brought together especially for you.",contents:"Contents",contentsHint:"Tap a recipe name to open it.",thanks:"Thank you for cooking with us",thanksText:"May every recipe bring beautiful memories and new flavours to your table.",copyright:"This digital book is licensed for the purchaser’s personal use only. It may not be copied, resold or distributed."},
  de:{story:"Willkommen bei Nili’s Kitchen",storyText:"Sorgfältig ausgewählte Rezepte aus aller Welt treffen sich an einem warmen und fröhlichen Tisch.",personal:"Dieses Buch ist für dich",personalText:"Deine Rezepte, deine Sprache und deine persönliche Nachricht wurden nur für dich zusammengestellt.",contents:"Inhalt",contentsHint:"Tippe auf einen Rezeptnamen.",thanks:"Danke, dass du mit uns kochst",thanksText:"Möge jedes Rezept schöne Erinnerungen und neue Aromen an deinen Tisch bringen.",copyright:"Dieses digitale Buch ist nur für den persönlichen Gebrauch des Käufers bestimmt."},
  fr:{story:"Bienvenue chez Nili’s Kitchen",storyText:"Des recettes soigneusement choisies dans les cuisines du monde se retrouvent autour d’une table chaleureuse et joyeuse.",personal:"Ce livre est pour vous",personalText:"Vos recettes, votre langue et votre message ont été réunis spécialement pour vous.",contents:"Sommaire",contentsHint:"Touchez un nom pour ouvrir la recette.",thanks:"Merci de cuisiner avec nous",thanksText:"Que chaque recette apporte de beaux souvenirs et de nouvelles saveurs à votre table.",copyright:"Ce livre numérique est réservé à l’usage personnel de son acheteur."},
  es:{story:"Bienvenido a Nili’s Kitchen",storyText:"Reunimos recetas cuidadosamente elegidas de cocinas del mundo en una mesa cálida y alegre.",personal:"Este libro es para ti",personalText:"Tus recetas, idioma y mensaje personal se reunieron especialmente para ti.",contents:"Contenido",contentsHint:"Toca el nombre para abrir la receta.",thanks:"Gracias por cocinar con nosotros",thanksText:"Que cada receta traiga hermosos recuerdos y nuevos sabores a tu mesa.",copyright:"Este libro digital es solo para uso personal del comprador."},
  pt:{story:"Bem-vindo à Nili’s Kitchen",storyText:"Reunimos receitas escolhidas de cozinhas do mundo numa mesa acolhedora e alegre.",personal:"Este livro é para você",personalText:"Suas receitas, idioma e mensagem foram reunidos especialmente para você.",contents:"Conteúdo",contentsHint:"Toque no nome para abrir a receita.",thanks:"Obrigado por cozinhar conosco",thanksText:"Que cada receita leve boas memórias e novos sabores à sua mesa.",copyright:"Este livro digital destina-se apenas ao uso pessoal do comprador."},
  ru:{story:"Добро пожаловать в Nili’s Kitchen",storyText:"Мы собираем тщательно отобранные рецепты кухонь мира за теплым и радостным столом.",personal:"Эта книга создана для вас",personalText:"Выбранные рецепты, язык и личное послание собраны специально для вас.",contents:"Содержание",contentsHint:"Нажмите на название рецепта.",thanks:"Спасибо, что готовите с нами",thanksText:"Пусть каждый рецепт приносит приятные воспоминания и новые вкусы.",copyright:"Эта цифровая книга предназначена только для личного использования покупателем."},
  ar:{story:"مرحباً بكم في Nili’s Kitchen",storyText:"نجمع وصفات مختارة بعناية من مطابخ العالم حول مائدة دافئة ومبهجة.",personal:"هذا الكتاب صُمم لك",personalText:"وصفاتك ولغتك ورسالتك الشخصية جُمعت خصيصاً لك.",contents:"المحتويات",contentsHint:"اضغط على اسم الوصفة لفتحها.",thanks:"شكراً للطهي معنا",thanksText:"نتمنى أن تضيف كل وصفة ذكريات جميلة ونكهات جديدة إلى مائدتك.",copyright:"هذا الكتاب الرقمي للاستخدام الشخصي للمشتري فقط."},
  ja:{story:"Nili’s Kitchenへようこそ",storyText:"世界の料理から厳選したレシピを、温かく楽しい食卓へお届けします。",personal:"あなたのための一冊",personalText:"選んだレシピ、言語、メッセージで特別に作られました。",contents:"目次",contentsHint:"料理名を押すとレシピへ移動します。",thanks:"一緒に料理してくれてありがとう",thanksText:"すべてのレシピが素敵な思い出と新しい味を届けますように。",copyright:"このデジタルブックは購入者の個人利用に限られます。"},
  zh:{story:"欢迎来到 Nili’s Kitchen",storyText:"我们把来自世界各地的精选食谱带到温暖、快乐的餐桌上。",personal:"这是为你制作的书",personalText:"你选择的食谱、语言和留言被特别整理在这本书中。",contents:"目录",contentsHint:"点击菜名即可打开食谱。",thanks:"感谢与我们一起烹饪",thanksText:"愿每道食谱都为你的餐桌带来美好回忆和全新风味。",copyright:"本数字书仅供购买者个人使用，不得复制、转售或传播。"}
};

function bookCopy(lang){return BOOK_COPY[lang] || BOOK_COPY.en;}

const BOOK_LABELS={
  tr:{servings:"Kişilik",prep:"Hazırlık",cook:"Pişirme",total:"Toplam",difficulty:"Zorluk",ingredients:"Malzemeler",method:"Nasıl yapılır?",tip:"Püf noktası",serving:"Servis önerisi",storage:"Saklama",culture:"Kültür & hikâye",special:"özel tarif",fresh:"Taze Malzemeler · Geleneksel Lezzetler · Mutlu Sofralar",share:"Lezzet, paylaştıkça çoğalır",love:"Sevgiyle pişirilen her yemek daha lezzetlidir"},
  en:{servings:"Servings",prep:"Prep",cook:"Cooking",total:"Total",difficulty:"Difficulty",ingredients:"Ingredients",method:"How to make it",tip:"Chef's tip",serving:"Serving idea",storage:"Storage",culture:"Culture & story",special:"special recipe",fresh:"Fresh Ingredients · Traditional Flavours · Happy Tables",share:"Flavour grows when shared",love:"Every meal tastes better when cooked with love"},
  de:{servings:"Portionen",prep:"Vorbereitung",cook:"Garzeit",total:"Gesamt",difficulty:"Schwierigkeit",ingredients:"Zutaten",method:"Zubereitung",tip:"Küchentipp",serving:"Serviervorschlag",storage:"Aufbewahrung",culture:"Kultur & Geschichte",special:"besonderes Rezept",fresh:"Frische Zutaten · Traditioneller Geschmack · Schöne Tafeln",share:"Geteilter Genuss verbindet",love:"Mit Liebe gekocht schmeckt jedes Gericht besser"},
  fr:{servings:"Portions",prep:"Préparation",cook:"Cuisson",total:"Total",difficulty:"Difficulté",ingredients:"Ingrédients",method:"Préparation",tip:"Astuce",serving:"Suggestion",storage:"Conservation",culture:"Culture & histoire",special:"recette spéciale",fresh:"Ingrédients frais · Saveurs traditionnelles · Belles tables",share:"La saveur grandit en partageant",love:"Chaque plat est meilleur lorsqu'il est cuisiné avec amour"},
  es:{servings:"Porciones",prep:"Preparación",cook:"Cocción",total:"Total",difficulty:"Dificultad",ingredients:"Ingredientes",method:"Preparación",tip:"Consejo",serving:"Sugerencia",storage:"Conservación",culture:"Cultura e historia",special:"receta especial",fresh:"Ingredientes frescos · Sabores tradicionales · Mesas felices",share:"El sabor crece al compartir",love:"Cada plato sabe mejor cuando se cocina con amor"},
  pt:{servings:"Porções",prep:"Preparação",cook:"Cozimento",total:"Total",difficulty:"Dificuldade",ingredients:"Ingredientes",method:"Modo de preparo",tip:"Dica",serving:"Sugestão",storage:"Conservação",culture:"Cultura e história",special:"receita especial",fresh:"Ingredientes frescos · Sabores tradicionais · Mesas felizes",share:"O sabor cresce quando partilhado",love:"Todo prato fica melhor quando é feito com amor"},
  ru:{servings:"Порции",prep:"Подготовка",cook:"Готовка",total:"Всего",difficulty:"Сложность",ingredients:"Ингредиенты",method:"Приготовление",tip:"Совет",serving:"Подача",storage:"Хранение",culture:"Культура и история",special:"особый рецепт",fresh:"Свежие продукты · Традиционные вкусы · Тёплые встречи",share:"Вкус становится ярче, когда им делятся",love:"С любовью приготовленное блюдо всегда вкуснее"},
  ar:{servings:"الحصص",prep:"التحضير",cook:"الطهي",total:"الإجمالي",difficulty:"الصعوبة",ingredients:"المكونات",method:"طريقة التحضير",tip:"نصيحة",serving:"اقتراح التقديم",storage:"الحفظ",culture:"الثقافة والحكاية",special:"وصفة مميزة",fresh:"مكونات طازجة · نكهات أصيلة · موائد سعيدة",share:"النكهة أجمل حين نتشاركها",love:"كل طبق يصبح ألذ حين يُطهى بحب"},
  ja:{servings:"人数",prep:"準備",cook:"調理",total:"合計",difficulty:"難易度",ingredients:"材料",method:"作り方",tip:"コツ",serving:"盛り付け",storage:"保存",culture:"文化と物語",special:"特別なレシピ",fresh:"新鮮な食材 · 伝統の味 · 幸せな食卓",share:"おいしさは分かち合うほど広がる",love:"愛情を込めた料理はもっとおいしい"},
  zh:{servings:"份量",prep:"准备",cook:"烹饪",total:"总计",difficulty:"难度",ingredients:"食材",method:"制作方法",tip:"小贴士",serving:"食用建议",storage:"保存",culture:"文化与故事",special:"特色食谱",fresh:"新鲜食材 · 传统风味 · 幸福餐桌",share:"分享让美味加倍",love:"用爱烹制的每一道菜都更美味"}
};
function bookLabels(lang){return BOOK_LABELS[lang] || BOOK_LABELS.en;}

function approvedCardUrl(recipe,lang){
  const urls=recipe.recipeCardUrls || {};
  const statuses=recipe.recipeCardStatuses || {};
  const chosen=statuses[lang] === "approved" && urls[lang]
    ? urls[lang]
    : statuses.en === "approved" && urls.en
      ? urls.en
      : "";
  if(!chosen) return "";
  if(/^https?:\/\//i.test(chosen)) return chosen;
  return `${APPROVED_CARD_BASE}/${String(chosen).replace(/^\/+/,"")}`;
}

function recipeIngredients(recipe){
  const source=recipe.extendedIngredients || recipe.usedIngredients || [];
  if(Array.isArray(source) && source.length) return source.map(item=>String(item?.original || item?.name || item || "").trim()).filter(Boolean);
  return String(recipe.ingredientsText || recipe.ingredients || "").split(/\r?\n|\s*[;•]\s*/).map(item=>item.trim()).filter(Boolean);
}

function recipeSteps(recipe){
  const analyzed=(recipe.analyzedInstructions || []).flatMap(group=>group?.steps || []).map(item=>String(item?.step || item || "").trim()).filter(Boolean);
  if(analyzed.length) return analyzed;
  if(Array.isArray(recipe.steps) && recipe.steps.length) return recipe.steps.map(item=>String(item?.step || item || "").trim()).filter(Boolean);
  return String(recipe.instructions || "").replace(/\r/g,"").split(/(?:^|\s)\d{1,2}[.)]\s+|\n+/).map(item=>item.trim()).filter(Boolean);
}

function firstRecipeValue(recipe,keys,fallback=""){
  for(const key of keys){
    const value=recipe?.[key];
    if(Array.isArray(value) && value.length) return value.join(", ");
    if(value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return fallback;
}

function compactBookText(value,maxLength=165){
  const text=String(value || "").replace(/\s+/g," ").trim();
  if(text.length<=maxLength) return text;
  const clipped=text.slice(0,maxLength+1).replace(/\s+\S*$/,"").replace(/[,:;\s]+$/,"");
  return `${clipped}.`;
}

function ingredientIcon(value){
  const text=String(value || "").toLocaleLowerCase("tr");
  if(/patlıcan|auberg|eggplant|aubergine|berenjena|berinjela|баклажан|باذنجان|なす|ナス|茄子/.test(text)) return "🍆";
  if(/domates|tomat|tomate|pomodoro|томат|طماطم|トマト|番茄|西红柿/.test(text)) return "🍅";
  if(/biber|pepper|paprika|piment|pimiento|pimentão|перец|فلفل|こしょう|ピーマン|辣椒/.test(text)) return "🌶️";
  if(/soğan|onion|zwiebel|oignon|cebolla|cebola|лук|sarımsak|garlic|knoblauch|ail|ajo|alho|чеснок|بصل|ثوم|玉ねぎ|にんにく|洋葱|大蒜/.test(text)) return "🧅";
  if(/kıyma|beef|lamb|chicken|tavuk|fleisch|rind|lamm|poulet|boeuf|agneau|carne|pollo|frango|говя|баран|куриц|لحم|دجاج|牛肉|羊肉|鶏肉|鸡肉/.test(text)) return "🥩";
  if(/\bsu\b|water|wasser|eau|agua|вода|ماء|水|süt|milk|milch|lait|leche|leite|молок|حليب|牛乳/.test(text)) return "💧";
  if(/yağ|oil|öl|huile|aceite|azeite|масло|زيت|油/.test(text)) return "🫙";
  if(/pirinç|rice|reis|riz|arroz|рис|أرز|米|\bun\b|flour|mehl|farine|harina|farinha|мук|دقيق|小麦粉|面粉/.test(text)) return "🌾";
  if(/maydanoz|fesleğen|herb|dill|petersilie|basilikum|persil|basilic|perejil|albahaca|salsa|manjericão|петруш|базилик|بقدونس|ريحان|パセリ|バジル|香菜|罗勒/.test(text)) return "🌿";
  return "✦";
}

function stepIcon(value){
  const text=String(value || "").toLocaleLowerCase("tr");
  if(/fırın|oven|bake|backofen|four|horno|forno|духов|فرن|オーブン|烤箱/.test(text)) return "▣";
  if(/kızart|tava|kavur|sauté|fry|braten|poêle|frire|freír|fritar|жар|قلي|炒め|揚げ|煎|炒/.test(text)) return "◒";
  if(/doğra|kes|slice|chop|schneid|couper|cortar|нарез|قطع|切る|刻む|切/.test(text)) return "◇";
  if(/karıştır|yoğur|mix|knead|misch|rühr|mélang|mezcl|mistur|перемеш|замес|اخلط|اعجن|混ぜ|こね|搅拌|揉/.test(text)) return "⌁";
  if(/beklet|dinlen|rest|ruh|repos|dejar|descans|repous|остав|отдых|اترك|راحة|休ませ|置く|静置|醒/.test(text)) return "◷";
  return "♨";
}

function factIcon(key){
  return ({servings:"♧",prep:"◷",cook:"♨",total:"◷",difficulty:"♙",cuisine:"⌂"})[key] || "♡";
}

function factValue(key,value,lang){
  const text=String(value || "").trim();
  if(["prep","cook","total"].includes(key) && /^\d+$/.test(text)) return `${text} ${lang==="tr" ? "dk" : "min"}`;
  return key==="difficulty" ? text.toLocaleUpperCase(lang) : text;
}

function bookSubtitle(recipe){
  const title=String(recipe?.title || "").toLocaleLowerCase("tr");
  if(title.includes("karnıyarık")) return "Kıyma Dolgulu Patlıcan";
  return firstRecipeValue(recipe,["originalTitle"],recipe.category || recipe.dishType || "");
}

function bookTitleParts(recipe){
  const title=String(recipe?.title || "Tarif").trim();
  const parts=title.split(/\s+[–—-]\s+/).map(item=>item.trim()).filter(Boolean);
  if(parts.length>1 && (title.length>20 || parts[0].length<=18)){
    return {title:parts.shift(),subtitle:parts.join(" – ")};
  }
  return {title,subtitle:bookSubtitle(recipe)};
}

function renderRecipeSpread(page){
  const recipe=page.recipe;
  const lang=page.lang || $("bookLanguage").value;
  const labels=bookLabels(lang);
  const ingredients=recipeIngredients(recipe);
  const steps=recipeSteps(recipe);
  const dense=ingredients.length+steps.length>20 ? " is-dense" : "";
  const sparse=ingredients.length<=8 ? " is-sparse" : "";
  const titleParts=bookTitleParts(recipe);
  const facts=[
    ["servings",labels.servings,firstRecipeValue(recipe,["servings","servingText"])],
    ["prep",labels.prep,firstRecipeValue(recipe,["prepTimeText","prepTime"])],
    ["cook",labels.cook,firstRecipeValue(recipe,["cookTimeText","cookTime"])],
    ["total",labels.total,firstRecipeValue(recipe,["totalTime","readyInMinutes"])],
    ["difficulty",labels.difficulty,firstRecipeValue(recipe,["difficulty"])]
  ].filter(item=>item[2]);
  const notes=[
    ["Püf noktası",firstRecipeValue(recipe,["tip","tips","editorTip"])],
    ["Servis önerisi",firstRecipeValue(recipe,["servingSuggestion","servingNotes"])],
    ["Saklama",firstRecipeValue(recipe,["storage","storageInstructions"])],
    ["Alternatifler",firstRecipeValue(recipe,["alternatives","substitutions"])],
    ["Kültür ve hikâye",firstRecipeValue(recipe,["culturalNote","cultureStory","ebookIntro","description","seoDescription"])],
    ["Alerjenler",firstRecipeValue(recipe,["allergens"])]
  ].filter(item=>item[1]);
  const noteMap=Object.fromEntries(notes);
  const intro=compactBookText(firstRecipeValue(recipe,["localizedSubtitle","description","seoDescription"],""),105);
  return `<article class="recipe-spread${dense}${sparse}" lang="${escapeHtml(lang)}" dir="ltr">
    <section class="book-leaf recipe-left-page">
      <div class="corner-flourish corner-flourish-left">❧</div>
      <aside class="personal-note">${escapeHtml($("recipientName").value.trim() || "Nili")} ♡</aside>
      <aside class="heritage-note">${escapeHtml(recipe.country || recipe.cuisine || "Nili's Kitchen")}<br>${escapeHtml(recipe.category || labels.special)}</aside>
      <header><span>NILI'S KITCHEN</span><h2>${escapeHtml(titleParts.title)}</h2><em>${escapeHtml(titleParts.subtitle)}</em></header>
      <aside class="photo-side-note">${escapeHtml(intro)}</aside>
      <div class="spread-food-photo"><img src="${escapeHtml(mediaUrl(recipeImage(recipe)))}" alt="${escapeHtml(recipe.title || "Tarif")}" onerror="this.src='/logo.jpeg'"></div>
      <div class="spread-facts">${facts.map(([key,label,value])=>`<span><i>${factIcon(key)}</i><small>${escapeHtml(label)}</small><b>${escapeHtml(factValue(key,value,lang))}</b></span>`).join("")}</div>
      <h3>${escapeHtml(labels.ingredients)} ♡</h3><ul class="spread-ingredients">${ingredients.map(item=>`<li><i>${ingredientIcon(item)}</i><span>${escapeHtml(item)}</span></li>`).join("")}</ul>
      <footer><span>${page.pageNumber || ""}</span><b>${escapeHtml(labels.fresh)} ♡</b></footer>
    </section>
    <section class="book-leaf recipe-right-page">
      <div class="corner-flourish corner-flourish-right">❧</div>
      <header><h2>${escapeHtml(labels.method)} ♡</h2></header>
      <ol class="spread-steps">${steps.map(item=>`<li><b></b><i>${stepIcon(item)}</i><span>${escapeHtml(item)}</span></li>`).join("")}</ol>
      <aside class="love-note">♡ ${escapeHtml(labels.love)} ♡</aside>
      <div class="spread-notes">${[[labels.tip,noteMap["Püf noktası"]],[labels.serving,noteMap["Servis önerisi"]],[labels.storage,noteMap["Saklama"]],[labels.culture,noteMap["Kültür ve hikâye"] || noteMap["Alternatifler"]]].filter(item=>item[1]).map(([label,value],index)=>`<section class="note-${index+1}"><h4>${escapeHtml(label)} ♡</h4><p>${escapeHtml(compactBookText(value,index===3 ? 175 : 145))}</p></section>`).join("")}</div>
      <img class="spread-nili" src="/recipe-posters/nili-character-cheek-hand-alpha-v2.png" alt="Nili">
      <footer><b>${escapeHtml(labels.share)} ♡</b><span>${(page.pageNumber || 0)+1 || ""}</span></footer>
    </section>
  </article>`;
}

function createBookPages(chosen, cover){
  const lang=$("bookLanguage").value;
  const copy=bookCopy(lang);
  const ordered=[...chosen].sort((a,b)=>String(a.title || "").localeCompare(String(b.title || ""),lang,{sensitivity:"base"}));
  const contentsPages=[];
  const chunkSize=10;
  for(let offset=0;offset<ordered.length;offset+=chunkSize){
    contentsPages.push({
      type:"contents",
      part:contentsPages.length+1,
      items:ordered.slice(offset,offset+chunkSize)
    });
  }
  const firstRecipePage=4+(contentsPages.length*2);
  const recipePages=ordered.map((recipe,index)=>({
    type:"recipe",
    recipeId:String(recipe.id || recipe.sourceId || ""),
    title:recipe.title,
    recipe,
    lang,copy,
    pageNumber:firstRecipePage+(index*2)
  }));
  const pages=[cover,{
    type:"intro",
    recipient:$("recipientName").value.trim(),
    message:$("bookMessage").value.trim() || "Nili's Kitchen'dan sevgiyle",
    recipeCount:recipePages.length,
    coverImage:cover.image,
    lang,copy
  },...contentsPages.map(page=>({...page,lang,copy})),...recipePages,
  {type:"colophon",lang,copy,recipient:$("recipientName").value.trim(),pageNumber:firstRecipePage+(recipePages.length*2)},
  {type:"backcover",lang,copy,recipeCount:recipePages.length}];
  const targets=new Map();
  pages.forEach((page,index)=>{ if(page.recipeId) targets.set(page.recipeId,index); });
  pages.filter(page=>page.type==="contents").forEach(page=>{
    page.items=page.items.map(recipe=>{
      const recipeId=String(recipe.id || recipe.sourceId || "");
      const mappedIndex=targets.get(recipeId);
      const recipePage=recipePages.find(item=>item.recipeId===recipeId);
      return {recipeId,title:recipe.title,recipe,target:mappedIndex,pageNumber:recipePage?.pageNumber || ""};
    });
  });
  return pages;
}

function renderIntroSpread(page){
  return `<article class="opening-spread" lang="${escapeHtml(page.lang)}" dir="${page.lang==="ar" ? "rtl" : "ltr"}">
    <section class="opening-leaf opening-story"><div class="opening-frame"></div><i class="opening-heart">♡</i><span>NILI'S KITCHEN</span><h2>${escapeHtml(page.copy.story)}</h2><div class="opening-brush"><b>${escapeHtml(page.copy.storyText)}</b></div><p class="opening-signature">${escapeHtml(page.copy.thanksText)}</p><div class="opening-values"><b>♡ Nili's</b><b>♡ Kitchen</b><b>♡ ${page.recipeCount}</b></div><img class="opening-nili" src="/recipe-posters/nili-character-cheek-hand-alpha-v2.png" alt="Nili"></section>
    <section class="opening-leaf opening-personal"><div class="opening-frame"></div><i class="opening-heart">♡</i><small>${escapeHtml(page.recipient || "Emilie")} ♡</small><h2>${escapeHtml(page.copy.personal)}</h2><p>${escapeHtml(page.copy.personalText)}</p><blockquote>“${escapeHtml(page.message)}”</blockquote><div class="opening-how"><span><b>${page.recipeCount}</b>${escapeHtml(page.copy.contents)}</span><span><b>1</b>Nili's Kitchen</span><span><b>♡</b>${escapeHtml(page.copy.thanks)}</span></div><div class="opening-gift">${escapeHtml(page.copy.storyText)} ♡</div></section>
  </article>`;
}

function renderContentsSpread(page){
  const cards=page.items.map(item=>{
    const recipe=item.recipe || {};
    const meta=[recipe.country || recipe.cuisine,recipe.category || recipe.dishType].filter(Boolean).join(" · ");
    const target=Number.isInteger(item.target) ? item.target : 0;
    const initial=String(item.title || "•").trim().charAt(0).toLocaleUpperCase(page.lang);
    return `<li><button type="button" data-book-page="${target}"><span class="contents-initial">${escapeHtml(initial)}</span><img src="${escapeHtml(mediaUrl(recipeImage(recipe)))}" alt="" onerror="this.src='/logo.jpeg'"><span class="contents-copy"><small>${escapeHtml(meta)}</small><b>${escapeHtml(item.title)}</b></span><i>${escapeHtml(item.pageNumber)}</i></button></li>`;
  }).join("");
  return `<article class="contents-page premium-contents" lang="${escapeHtml(page.lang)}" dir="${page.lang==="ar" ? "rtl" : "ltr"}"><div class="contents-frame"></div><header><span>NILI'S KITCHEN</span><h2>${escapeHtml(page.copy.contents)} ♡</h2><p>${page.part>1 ? `${escapeHtml(page.copy.contents)} · ${page.part}` : escapeHtml(page.copy.contentsHint)}</p></header><ol class="contents-count-${page.items.length}">${cards}</ol><footer>${escapeHtml(page.copy.contentsHint)} ♡</footer></article>`;
}

function renderColophonPage(page){
  return `<article class="colophon-page" lang="${escapeHtml(page.lang)}" dir="${page.lang==="ar" ? "rtl" : "ltr"}">
    <div class="single-page-gold-frame"></div><i class="colophon-heart">♡</i>
    <span class="colophon-brand">NILI'S KITCHEN</span><h2>${escapeHtml(page.copy.thanks)}</h2>
    <div class="colophon-brush"><p>${escapeHtml(page.copy.thanksText)}</p></div>
    <img class="colophon-nili" src="/recipe-posters/nili-character-cheek-hand-alpha-v2.png" alt="Nili">
    <div class="copyright-card"><b>Copyright © ${new Date().getFullYear()} Nili's Kitchen</b><p>${escapeHtml(page.copy.copyright)}</p></div>
    <small>${escapeHtml(page.recipient || "")} · niliskitchen.com · ${page.pageNumber || ""} ♡</small>
  </article>`;
}

function renderBackCover(page){
  return `<article class="back-cover" lang="${escapeHtml(page.lang)}" dir="${page.lang==="ar" ? "rtl" : "ltr"}">
    <div class="single-page-gold-frame"></div><img class="back-cover-logo" src="/logo-transparent.png" alt="Nili's Kitchen">
    <i>♡</i><h2>Nili's Kitchen</h2><p>${escapeHtml(page.copy.storyText)}</p>
    <div class="back-cover-brush">${page.recipeCount} · ${escapeHtml(page.copy.contents)} ♡</div><small>niliskitchen.com</small>
  </article>`;
}

function renderFlipbook(direction="next"){
  const page=flipbookPages[flipbookIndex];
  const holder=$("flipbookPage");
  holder.className=`flipbook-page page-${page.type} turn-${direction}`;
  holder.innerHTML=page.type === "cover"
    ? `<article class="digital-cover nili-book-cover">
        <img class="approved-cover-concept" src="/recipe-posters/ebook-cover-portrait-concept-v1.png" alt="${escapeHtml(page.title)}">
        <div class="book-gold-frame"></div><i class="cover-heart">♡</i>
        <img class="cover-food-image" src="${escapeHtml(page.image)}" alt="">
        <div class="cover-photo-fade"></div>
        <img class="cover-nili-character" src="/recipe-posters/nili-character-crossed-arms-alpha-v1.png" alt="Nili">
        <div class="digital-cover-copy"><span>NILI'S KITCHEN</span><em>KİŞİYE ÖZEL TARİF KİTABI</em><h2>${escapeHtml(page.title)}</h2><p>${page.recipeCount} özel tarif</p><small>${escapeHtml(page.dedication)}</small></div>
        <div class="cover-brush-message">Taze • Geleneksel • Lezzetli ♡</div>
      </article>`
    : page.type === "intro"
      ? renderIntroSpread(page)
    : page.type === "contents"
      ? renderContentsSpread(page)
    : page.type === "colophon"
      ? renderColophonPage(page)
    : page.type === "backcover"
      ? renderBackCover(page)
      : renderRecipeSpread(page);
  $("previousPage").disabled=flipbookIndex===0;
  $("nextPage").disabled=flipbookIndex===flipbookPages.length-1;
  $("pageCounter").textContent=page.type==="cover" ? "Kapak" : page.type==="intro" ? "2–3" : page.type==="contents" ? `${page.copy.contents} ${page.part}` : page.type==="colophon" ? "Teşekkür ve telif" : page.type==="backcover" ? "Arka kapak" : `${flipbookIndex+1} / ${flipbookPages.length}`;
}

async function openTenRecipeProductPreview(){
  const button=$("productPreviewButton");
  const originalLabel=button.textContent;
  button.disabled=true;
  button.textContent="10 tarif hazırlanıyor...";
  setDraftStatus("Örnek kitap hazırlanıyor...");
  try{
    const response=await fetch(`${API_BASE}/discover-recipes`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query:"",cuisine:"",category:"",lang:$("bookLanguage").value,niliOnly:true,limit:10,offset:0})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || "Örnek tarifler yüklenemedi");
    const chosen=(Array.isArray(data.recipes) ? data.recipes : []).slice(0,10);
    if(chosen.length<10) throw new Error("10 tarif bulunamadı");
    const cover={type:"cover",title:$("bookTitle").value.trim() || "Benim Tarif Kitabım",image:mediaUrl(recipeImage(chosen[0])),recipeCount:10,dedication:`${$("recipientName").value.trim() || "Emilie"}’ye ${$("bookMessage").value.trim() || "Nili's Kitchen’dan sevgiyle"} ♡`};
    flipbookPages=createBookPages(chosen,cover);
    flipbookIndex=0;
    renderFlipbook();
    $("draftModal").hidden=false;
    setDraftStatus("Örnek kitap açıldı.", "success");
  }catch(error){
    setDraftStatus(`Örnek kitap açılamadı: ${error.message}`, "error");
    alert(error.message);
  }finally{
    button.disabled=false;
    button.textContent=originalLabel;
  }
}

$("productPreviewButton").addEventListener("click",openTenRecipeProductPreview);

$("draftButton").addEventListener("click", () => {
  if(!selectedRecipes.size){
    setDraftStatus("Önce kitabına en az bir tarif eklemelisin.", "error");
    return alert("Önce kitabına en az bir tarif eklemelisin.");
  }
  setDraftStatus("Kitap taslağı hazırlanıyor...");
  const lang=$("bookLanguage").value;
  const chosen=[...selectedRecipes.values()];
  const cover={
    type:"cover",
    title:$("bookTitle").value.trim() || "Benim Tarif Kitabım",
    image:mediaUrl(recipeImage(chosen.find(recipe=>recipeImage(recipe)) || chosen[0])),
    recipeCount:chosen.length,
    dedication:`${$("recipientName").value.trim() ? `${$("recipientName").value.trim()}’ye ` : ""}${$("bookMessage").value.trim() || "Nili's Kitchen'dan sevgiyle"} ♡`
  };
  flipbookPages=createBookPages(chosen,cover);
  flipbookIndex=0;
  renderFlipbook();
  $("draftModal").hidden=false;
  setDraftStatus("Kitap taslağı açıldı. Sayfaları oklarla çevirebilirsin.", "success");
});
$("previousPage").addEventListener("click",()=>{if(flipbookIndex>0){flipbookIndex--;renderFlipbook("previous");}});
$("nextPage").addEventListener("click",()=>{if(flipbookIndex<flipbookPages.length-1){flipbookIndex++;renderFlipbook("next");}});
$("flipbookPage").addEventListener("click",event=>{
  const jump=event.target.closest("[data-book-page]");
  if(jump){
    flipbookIndex=Number(jump.dataset.bookPage);
    renderFlipbook("next");
    return;
  }
  const rect=event.currentTarget.getBoundingClientRect();
  if(event.clientX < rect.left + rect.width/2) $("previousPage").click();
  else $("nextPage").click();
});
$("closeDraft").addEventListener("click", () => $("draftModal").hidden = true);
$("draftModal").addEventListener("click", event => { if(event.target === $("draftModal")) $("draftModal").hidden = true; });

updateBookSummary();
loadOptions();
searchRecipes(true);
