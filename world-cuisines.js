const API_BASE = ["localhost","127.0.0.1"].includes(location.hostname) || /^(192\.168\.|10\.|172\.)/.test(location.hostname)
  ? `http://${location.hostname}:3000` : "https://api.niliskitchen.com";

const languages=["en","tr","ru","de","fr","es","pt","ar","ja","zh"];
const languageFlags={en:"gb",tr:"tr",ru:"ru",de:"de",fr:"fr",es:"es",pt:"pt",ar:"sa",ja:"jp",zh:"cn"};
const cuisineData=[
  ["turkey","tr"],["italy","it"],["mexico","mx"],["india","in"],["china","cn"],
  ["japan","jp"],["france","fr"],["greece","gr"],["usa","us"],["thailand","th"]
];
const typeIds=["main course","meat","vegetarian","pasta","seafood","soup","salad","breakfast","dessert","appetizer"];
const cuisineSearchHints={
  turkey:"kebab",
  italy:"pasta",
  mexico:"tacos",
  india:"curry",
  china:"noodles",
  japan:"sushi",
  france:"croissant",
  greece:"gyros",
  usa:"burger",
  thailand:"tom yum"
};
const typeSearchHints={
  "main course":"dinner",
  meat:"meat",
  vegetarian:"vegetarian",
  pasta:"pasta",
  seafood:"seafood",
  soup:"soup",
  salad:"salad",
  breakfast:"breakfast",
  dessert:"dessert",
  appetizer:"appetizer"
};
const weeklyCuratedSets=[
  [
    {query:"baklava",cuisine:"turkey",category:"dessert"},
    {query:"pasta",cuisine:"italy",category:"pasta"},
    {query:"ramen",cuisine:"japan",category:"soup"}
  ],
  [
    {query:"tacos",cuisine:"mexico",category:"main course"},
    {query:"curry",cuisine:"india",category:"main course"},
    {query:"croissant",cuisine:"france",category:"breakfast"}
  ],
  [
    {query:"noodles",cuisine:"china",category:"main course"},
    {query:"gyros",cuisine:"greece",category:"meat"},
    {query:"burger",cuisine:"usa",category:"main course"}
  ],
  [
    {query:"tom yum",cuisine:"thailand",category:"soup"},
    {query:"doner",cuisine:"turkey",category:"meat"},
    {query:"sushi",cuisine:"japan",category:"seafood"}
  ]
];

const copy={
en:{brand:"World Cuisine Collection",home:"Home kitchen",ce:"EXPLORE BY COUNTRY",ct:"World cuisines",te:"WHAT TO COOK",tt:"Dish types",me:"A TABLE WITHOUT BORDERS",mt:"Discover the world's most loved dishes",mx:"Search by name, country or dish type. Every discovery grows Nili's recipe collection.",m1:"Fresh discoveries",m2:"Cook around the world",se:"FIND A DISH",st:"What are you craving?",ph:"Pizza, ramen, baklava...",find:"Find recipes",re:"CURATED RESULTS",rt:"Recipes worth discovering",idle:"Choose a country, dish type, or search by name.",loading:"Searching our collection and trusted recipe sources...",empty:"No recipes found. Try another choice.",error:"Recipes could not be loaded. Please try again.",ingredients:"Ingredients",instructions:"Preparation",servings:"servings",minutes:"min",source:"View original source",count:"recipes",countries:["Turkey","Italy","Mexico","India","China","Japan","France","Greece","USA","Thailand"],types:["Main dishes","Meat dishes","Vegetable dishes","Pasta","Seafood","Soups","Salads","Breakfast","Desserts","Appetizers"]},
tr:{brand:"Dünya Mutfağı Koleksiyonu",home:"Ana mutfak",ce:"ÜLKEYE GÖRE KEŞFET",ct:"Dünya mutfakları",te:"NE PİŞİRMEK İSTERSİN",tt:"Yemek türleri",me:"SINIRSIZ BİR SOFRA",mt:"Dünyanın en sevilen yemeklerini keşfet",mx:"İsim, ülke veya yemek türüyle ara. Her keşif Nili's tarif arşivini büyütür.",m1:"Taze keşifler",m2:"Dünyayı pişir",se:"YEMEK BUL",st:"Canın ne çekiyor?",ph:"Pizza, ramen, baklava...",find:"Tarifleri bul",re:"ÖZENLE SEÇİLENLER",rt:"Keşfetmeye değer tarifler",idle:"Bir ülke, yemek türü seç veya isimle ara.",loading:"Arşivimiz ve güvenilir tarif kaynakları taranıyor...",empty:"Tarif bulunamadı. Başka bir seçim deneyin.",error:"Tarifler yüklenemedi. Lütfen tekrar deneyin.",ingredients:"Malzemeler",instructions:"Hazırlanışı",servings:"kişilik",minutes:"dk",source:"Orijinal kaynağı aç",count:"tarif",countries:["Türkiye","İtalya","Meksika","Hindistan","Çin","Japonya","Fransa","Yunanistan","ABD","Tayland"],types:["Ana yemekler","Et yemekleri","Sebze yemekleri","Makarna","Deniz ürünleri","Çorbalar","Salatalar","Kahvaltı","Tatlılar","Başlangıçlar"]},
ru:{brand:"Коллекция мировой кухни",home:"Главная кухня",ce:"ВЫБЕРИТЕ СТРАНУ",ct:"Кухни мира",te:"ЧТО ПРИГОТОВИТЬ",tt:"Виды блюд",me:"СТОЛ БЕЗ ГРАНИЦ",mt:"Откройте любимые блюда мира",mx:"Ищите по названию, стране или виду блюда.",m1:"Свежие открытия",m2:"Готовьте весь мир",se:"НАЙТИ БЛЮДО",st:"Чего вам хочется?",ph:"Пицца, рамен, баклава...",find:"Найти рецепты",re:"ПОДБОРКА",rt:"Рецепты для открытий",idle:"Выберите страну, вид блюда или введите название.",loading:"Ищем рецепты...",empty:"Рецепты не найдены.",error:"Не удалось загрузить рецепты.",ingredients:"Ингредиенты",instructions:"Приготовление",servings:"порций",minutes:"мин",source:"Открыть источник",count:"рецептов",countries:["Турция","Италия","Мексика","Индия","Китай","Япония","Франция","Греция","США","Таиланд"],types:["Основные блюда","Мясные блюда","Овощные блюда","Паста","Морепродукты","Супы","Салаты","Завтрак","Десерты","Закуски"]},
de:{brand:"Sammlung der Weltküchen",home:"Hauptküche",ce:"NACH LAND ENTDECKEN",ct:"Küchen der Welt",te:"WAS KOCHEN",tt:"Gerichtarten",me:"EIN TISCH OHNE GRENZEN",mt:"Entdecke die beliebtesten Gerichte der Welt",mx:"Suche nach Name, Land oder Gerichtart.",m1:"Frische Entdeckungen",m2:"Koche um die Welt",se:"GERICHT FINDEN",st:"Worauf hast du Lust?",ph:"Pizza, Ramen, Baklava...",find:"Rezepte finden",re:"AUSGEWÄHLTE ERGEBNISSE",rt:"Rezepte zum Entdecken",idle:"Wähle ein Land, eine Gerichtart oder suche nach Namen.",loading:"Rezepte werden gesucht...",empty:"Keine Rezepte gefunden.",error:"Rezepte konnten nicht geladen werden.",ingredients:"Zutaten",instructions:"Zubereitung",servings:"Portionen",minutes:"Min.",source:"Originalquelle öffnen",count:"Rezepte",countries:["Türkei","Italien","Mexiko","Indien","China","Japan","Frankreich","Griechenland","USA","Thailand"],types:["Hauptgerichte","Fleischgerichte","Gemüsegerichte","Pasta","Meeresfrüchte","Suppen","Salate","Frühstück","Desserts","Vorspeisen"]},
fr:{brand:"Collection des cuisines du monde",home:"Cuisine principale",ce:"EXPLORER PAR PAYS",ct:"Cuisines du monde",te:"QUE CUISINER",tt:"Types de plats",me:"UNE TABLE SANS FRONTIÈRES",mt:"Découvrez les plats les plus aimés au monde",mx:"Recherchez par nom, pays ou type de plat.",m1:"Nouvelles découvertes",m2:"Cuisinez le monde",se:"TROUVER UN PLAT",st:"De quoi avez-vous envie ?",ph:"Pizza, ramen, baklava...",find:"Trouver des recettes",re:"RÉSULTATS SÉLECTIONNÉS",rt:"Recettes à découvrir",idle:"Choisissez un pays, un type ou recherchez un nom.",loading:"Recherche des recettes...",empty:"Aucune recette trouvée.",error:"Impossible de charger les recettes.",ingredients:"Ingrédients",instructions:"Préparation",servings:"portions",minutes:"min",source:"Voir la source",count:"recettes",countries:["Turquie","Italie","Mexique","Inde","Chine","Japon","France","Grèce","États-Unis","Thaïlande"],types:["Plats principaux","Plats de viande","Plats de légumes","Pâtes","Fruits de mer","Soupes","Salades","Petit-déjeuner","Desserts","Entrées"]},
es:{brand:"Colección de cocinas del mundo",home:"Cocina principal",ce:"EXPLORAR POR PAÍS",ct:"Cocinas del mundo",te:"QUÉ COCINAR",tt:"Tipos de platos",me:"UNA MESA SIN FRONTERAS",mt:"Descubre los platos más queridos del mundo",mx:"Busca por nombre, país o tipo de plato.",m1:"Nuevos descubrimientos",m2:"Cocina por el mundo",se:"BUSCAR UN PLATO",st:"¿Qué te apetece?",ph:"Pizza, ramen, baklava...",find:"Buscar recetas",re:"RESULTADOS SELECCIONADOS",rt:"Recetas por descubrir",idle:"Elige un país, tipo de plato o busca por nombre.",loading:"Buscando recetas...",empty:"No se encontraron recetas.",error:"No se pudieron cargar las recetas.",ingredients:"Ingredientes",instructions:"Preparación",servings:"porciones",minutes:"min",source:"Ver fuente original",count:"recetas",countries:["Turquía","Italia","México","India","China","Japón","Francia","Grecia","EE. UU.","Tailandia"],types:["Platos principales","Platos de carne","Platos de verduras","Pasta","Mariscos","Sopas","Ensaladas","Desayuno","Postres","Entrantes"]},
pt:{brand:"Coleção de cozinhas do mundo",home:"Cozinha principal",ce:"EXPLORAR POR PAÍS",ct:"Cozinhas do mundo",te:"O QUE COZINHAR",tt:"Tipos de pratos",me:"UMA MESA SEM FRONTEIRAS",mt:"Descubra os pratos mais amados do mundo",mx:"Pesquise por nome, país ou tipo de prato.",m1:"Novas descobertas",m2:"Cozinhe pelo mundo",se:"ENCONTRAR UM PRATO",st:"O que deseja comer?",ph:"Pizza, ramen, baklava...",find:"Encontrar receitas",re:"RESULTADOS SELECIONADOS",rt:"Receitas para descobrir",idle:"Escolha um país, tipo ou pesquise pelo nome.",loading:"Pesquisando receitas...",empty:"Nenhuma receita encontrada.",error:"Não foi possível carregar as receitas.",ingredients:"Ingredientes",instructions:"Preparação",servings:"porções",minutes:"min",source:"Ver fonte original",count:"receitas",countries:["Turquia","Itália","México","Índia","China","Japão","França","Grécia","EUA","Tailândia"],types:["Pratos principais","Pratos de carne","Pratos de legumes","Massa","Frutos do mar","Sopas","Saladas","Café da manhã","Sobremesas","Entradas"]},
ar:{brand:"مجموعة مطابخ العالم",home:"المطبخ الرئيسي",ce:"استكشف حسب البلد",ct:"مطابخ العالم",te:"ماذا نطبخ",tt:"أنواع الأطباق",me:"مائدة بلا حدود",mt:"اكتشف أشهر أطباق العالم",mx:"ابحث بالاسم أو البلد أو نوع الطبق.",m1:"اكتشافات جديدة",m2:"اطبخ حول العالم",se:"ابحث عن طبق",st:"ماذا تشتهي؟",ph:"بيتزا، رامن، بقلاوة...",find:"ابحث عن وصفات",re:"نتائج مختارة",rt:"وصفات تستحق الاكتشاف",idle:"اختر بلداً أو نوع طبق أو ابحث بالاسم.",loading:"جارٍ البحث عن الوصفات...",empty:"لم يتم العثور على وصفات.",error:"تعذر تحميل الوصفات.",ingredients:"المكونات",instructions:"طريقة التحضير",servings:"حصص",minutes:"دقيقة",source:"فتح المصدر الأصلي",count:"وصفات",countries:["تركيا","إيطاليا","المكسيك","الهند","الصين","اليابان","فرنسا","اليونان","أمريكا","تايلاند"],types:["أطباق رئيسية","أطباق اللحوم","أطباق الخضار","معكرونة","مأكولات بحرية","شوربات","سلطات","إفطار","حلويات","مقبلات"]},
ja:{brand:"世界料理コレクション",home:"メインキッチン",ce:"国から探す",ct:"世界の料理",te:"何を作る",tt:"料理の種類",me:"国境のない食卓",mt:"世界で愛される料理を発見",mx:"料理名、国、種類から検索できます。",m1:"新しい発見",m2:"世界を料理する",se:"料理を探す",st:"何が食べたいですか？",ph:"ピザ、ラーメン、バクラヴァ...",find:"レシピを探す",re:"おすすめ結果",rt:"発見したいレシピ",idle:"国、料理の種類、または名前を選んでください。",loading:"レシピを検索中...",empty:"レシピが見つかりません。",error:"レシピを読み込めませんでした。",ingredients:"材料",instructions:"作り方",servings:"人分",minutes:"分",source:"元のサイトを見る",count:"レシピ",countries:["トルコ","イタリア","メキシコ","インド","中国","日本","フランス","ギリシャ","アメリカ","タイ"],types:["メイン料理","肉料理","野菜料理","パスタ","シーフード","スープ","サラダ","朝食","デザート","前菜"]},
zh:{brand:"世界美食收藏",home:"主厨房",ce:"按国家探索",ct:"世界美食",te:"想做什么",tt:"菜肴类型",me:"无国界餐桌",mt:"发现世界最受欢迎的菜肴",mx:"按名称、国家或菜肴类型搜索。",m1:"新鲜发现",m2:"烹饪全世界",se:"寻找菜肴",st:"你想吃什么？",ph:"披萨、拉面、果仁蜜饼...",find:"查找食谱",re:"精选结果",rt:"值得发现的食谱",idle:"选择国家、菜肴类型或按名称搜索。",loading:"正在搜索食谱...",empty:"未找到食谱。",error:"无法加载食谱。",ingredients:"配料",instructions:"制作方法",servings:"人份",minutes:"分钟",source:"查看原始来源",count:"食谱",countries:["土耳其","意大利","墨西哥","印度","中国","日本","法国","希腊","美国","泰国"],types:["主菜","肉类菜肴","蔬菜菜肴","意大利面","海鲜","汤","沙拉","早餐","甜点","开胃菜"]}
};

const sidebarCopy={
en:["Scan ingredients by photo","Take a photo and let AI detect ingredients","Choose from gallery","Search a dish","Join Nili's Kitchen","Save favorites, upload recipes and unlock creator features.","Join Free","All rights reserved."],
tr:["Fotoğrafla malzemeleri tara","Fotoğraf yükle, yapay zeka malzemeleri bulsun","Galeriden seç","Yemek ara","Nili's Kitchen’a Katıl","Favorilerini kaydet, tarif yükle ve creator özelliklerini aç.","Ücretsiz Katıl","Tüm hakları saklıdır."],
ru:["Сканировать ингредиенты","Загрузите фото для распознавания","Выбрать из галереи","Найти блюдо","Присоединяйтесь к Nili's Kitchen","Сохраняйте избранное и добавляйте рецепты.","Бесплатно","Все права защищены."],
de:["Zutaten per Foto scannen","Foto hochladen und Zutaten erkennen","Aus Galerie wählen","Gericht suchen","Nili's Kitchen beitreten","Favoriten speichern und Rezepte hochladen.","Kostenlos beitreten","Alle Rechte vorbehalten."],
fr:["Scanner les ingrédients","Téléchargez une photo pour les détecter","Choisir dans la galerie","Rechercher un plat","Rejoignez Nili's Kitchen","Enregistrez vos favoris et publiez des recettes.","Rejoindre gratuitement","Tous droits réservés."],
es:["Escanear ingredientes","Sube una foto para detectar ingredientes","Elegir de la galería","Buscar un plato","Únete a Nili's Kitchen","Guarda favoritos y publica recetas.","Unirse gratis","Todos los derechos reservados."],
pt:["Digitalizar ingredientes","Envie uma foto para detectar ingredientes","Escolher da galeria","Pesquisar prato","Participe da Nili's Kitchen","Salve favoritos e publique receitas.","Participar grátis","Todos os direitos reservados."],
ar:["مسح المكونات بالصورة","ارفع صورة لاكتشاف المكونات","اختر من المعرض","ابحث عن طبق","انضم إلى Nili's Kitchen","احفظ المفضلة وانشر الوصفات.","انضم مجاناً","جميع الحقوق محفوظة."],
ja:["写真で材料をスキャン","写真から材料を検出します","ギャラリーから選択","料理を検索","Nili's Kitchenに参加","お気に入りを保存してレシピを投稿。","無料で参加","無断転載を禁じます。"],
zh:["拍照扫描食材","上传照片识别食材","从相册选择","搜索菜肴","加入 Nili's Kitchen","保存收藏并发布食谱。","免费加入","版权所有。"]
};
const detectedCopy={
en:["SMART SCAN","Detected ingredients","Check the ingredients before searching for recipes.","Scan again","Find recipes"],tr:["AKILLI TARAMA","Algılanan malzemeler","Tarif aramadan önce malzemeleri kontrol edin.","Tekrar tara","Tarifleri bul"],ru:["УМНОЕ СКАНИРОВАНИЕ","Найденные ингредиенты","Проверьте ингредиенты перед поиском.","Сканировать снова","Найти рецепты"],de:["SMART SCAN","Erkannte Zutaten","Prüfe die Zutaten vor der Suche.","Erneut scannen","Rezepte finden"],fr:["SCAN INTELLIGENT","Ingrédients détectés","Vérifiez les ingrédients avant la recherche.","Scanner à nouveau","Trouver des recettes"],es:["ESCANEO INTELIGENTE","Ingredientes detectados","Revisa los ingredientes antes de buscar.","Escanear de nuevo","Buscar recetas"],pt:["SCAN INTELIGENTE","Ingredientes detectados","Confira os ingredientes antes da pesquisa.","Digitalizar novamente","Encontrar receitas"],ar:["مسح ذكي","المكونات المكتشفة","تحقق من المكونات قبل البحث.","مسح مرة أخرى","ابحث عن وصفات"],ja:["スマートスキャン","検出された材料","検索前に材料を確認してください。","再スキャン","レシピを探す"],zh:["智能扫描","识别出的食材","搜索前请检查食材。","重新扫描","查找食谱"]
};

let lang=new URLSearchParams(location.search).get("lang") || localStorage.getItem("niliKitchenLangV2") || "en";
if(!languages.includes(lang)) lang="en";
let selectedCuisine=new URLSearchParams(location.search).get("cuisine") || "";
let selectedType="";
let recipes=[];

const $=id=>document.getElementById(id);
const textMap={brandSub:"brand",cuisineEyebrow:"ce",cuisineTitle:"ct",typeEyebrow:"te",typeTitle:"tt",mosaicEyebrow:"me",mosaicTitle:"mt",mosaicText:"mx",mosaicCardOne:"m1",mosaicCardTwo:"m2",searchEyebrow:"se",searchTitle:"st",searchLead:"idle",searchButton:"find",resultsEyebrow:"re",resultsTitle:"rt"};
const languageButtonHtml=value=>`<img src="https://flagcdn.com/w40/${languageFlags[value]}.png" alt="${value.toUpperCase()} flag"><span>${value.toUpperCase()}</span>`;

function applyLanguage(){
  const t=copy[lang];
  document.documentElement.lang=lang;document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  Object.entries(textMap).forEach(([id,key])=>{if($(id)) $(id).textContent=t[key]});
  $("backHome").querySelector("span").textContent=t.home;$("worldQuery").placeholder=t.ph;$("languageButton").innerHTML=languageButtonHtml(lang);
  if($("worldMobileLanguageButton")) $("worldMobileLanguageButton").innerHTML=languageButtonHtml(lang);
  localStorage.setItem("niliKitchenLangV2",lang);
  const side=sidebarCopy[lang]||sidebarCopy.en;
  [["worldScanTitle",0],["worldScanDesc",1],["worldGalleryText",2],["worldJoinTitle",4],["worldJoinDesc",5],["worldJoinButton",6]].forEach(([id,index])=>{if($(id))$(id).textContent=side[index]});
  if($("worldManualInput")) $("worldManualInput").placeholder=side[3];
  if($("worldFooter")) $("worldFooter").textContent=`© 2026 Nili's Kitchen AI. ${side[7]}`;
  const detected=detectedCopy[lang]||detectedCopy.en;
  [["worldDetectedEyebrow",0],["worldDetectedTitle",1],["worldDetectedText",2],["worldDetectedCancel",3],["worldDetectedConfirm",4]].forEach(([id,index])=>{if($(id))$(id).textContent=detected[index]});
  if($("mobileFeaturedEyebrow")) $("mobileFeaturedEyebrow").textContent=t.re;
  if($("mobileFeaturedTitle")) $("mobileFeaturedTitle").textContent=t.rt;
  [["heroSearchActionEyebrow","se"],["heroSearchActionTitle","st"],["heroResultsActionEyebrow","re"],["heroResultsActionTitle","rt"]].forEach(([id,key])=>{if($(id))$(id).textContent=t[key]});
  if($("heroResultsActionEyebrow")){
    $("heroResultsActionEyebrow").style.color="#e7c77f";
    $("heroResultsActionEyebrow").style.textShadow="0 1px 2px rgba(0,0,0,.24)";
  }
  if($("heroResultsActionTitle")){
    $("heroResultsActionTitle").style.color="#fffaf0";
    $("heroResultsActionTitle").style.textShadow="0 1px 2px rgba(0,0,0,.24)";
  }
  renderFilters();renderResults();
  if(!recipes.length) setStatus(t.idle,true);
}

function worldUserIsLoggedIn(){return !!(localStorage.getItem("creatorEmail")||localStorage.getItem("niliUserEmail"))}
function initWorldMobileControls(){
  const userButton=$("worldMobileUserButton"),userName=$("worldMobileUserName"),userMenu=$("worldMobileUserMenu");
  const languageButton=$("worldMobileLanguageButton"),languageMenu=$("worldMobileLanguageMenu");
  if(!userButton||!userName||!userMenu||!languageButton||!languageMenu)return;
  const username=localStorage.getItem("creatorUsername")||localStorage.getItem("niliCreatorUsername")||localStorage.getItem("niliUsername");
  const email=localStorage.getItem("creatorEmail")||localStorage.getItem("niliCreatorEmail")||localStorage.getItem("niliUserEmail");
  userName.textContent=username||email||(lang==="tr"?"Giriş":"Login");
  $("worldMobileDashboard").href=`creator-dashboard.html?lang=${lang}`;
  $("worldMobileAddRecipe").href=`creator.html?lang=${lang}`;
  $("worldMobileHow").href=`how-it-works.html?lang=${lang}`;
  languageMenu.innerHTML=languages.map(value=>`<button type="button" data-mobile-lang="${value}">${languageButtonHtml(value)}</button>`).join("");
  languageButton.innerHTML=languageButtonHtml(lang);
}

$("worldMobileUserButton").addEventListener("click",()=>{
  if(!worldUserIsLoggedIn()){location.href=`index.html?lang=${lang}&login=1`;return}
  $("worldMobileUserMenu").classList.toggle("open");$("worldMobileLanguageMenu").classList.remove("open");
});
$("worldMobileLanguageButton").addEventListener("click",()=>{
  $("worldMobileLanguageMenu").classList.toggle("open");$("worldMobileUserMenu").classList.remove("open");
});
$("worldMobileLanguageMenu").addEventListener("click",event=>{
  const button=event.target.closest("[data-mobile-lang]");if(!button)return;
  lang=button.dataset.mobileLang;$("worldMobileLanguageMenu").classList.remove("open");
  history.replaceState(null,"",`?lang=${lang}${selectedCuisine?`&cuisine=${selectedCuisine}`:""}`);applyLanguage();renderFilters();initWorldMobileControls();
});
$("worldMobileLogout").addEventListener("click",()=>{
  ["creatorUsername","creatorEmail","creatorEmailOrUser","creatorMode","niliCreatorUsername","niliCreatorEmail","niliUserEmail","niliUsername","niliFavorites"].forEach(key=>localStorage.removeItem(key));
  $("worldMobileUserMenu").classList.remove("open");initWorldMobileControls();
});
document.addEventListener("click",event=>{
  if(!event.target.closest(".wc-mobile-account"))$("worldMobileUserMenu").classList.remove("open");
  if(!event.target.closest(".wc-mobile-language"))$("worldMobileLanguageMenu").classList.remove("open");
});

function renderFilters(){
  const t=copy[lang];
  const cuisineBox=$("worldSidebarCuisineList")||$("cuisineList");
  cuisineBox.innerHTML=cuisineData.map(([id,flag],i)=>`<button class="category-btn ${selectedCuisine===id?"active":""}" data-cuisine="${id}"><img src="https://flagcdn.com/w40/${flag}.png" alt=""><span>${t.countries[i]}</span><i aria-hidden="true"></i></button>`).join("");
  $("typeList").innerHTML=typeIds.map((id,i)=>`<button class="wc-filter-button ${selectedType===id?"active":""}" data-type="${id}" title="${esc(t.types[i])}">${t.types[i]}</button>`).join("");
}

function setStatus(message,show){$("worldStatus").textContent=message;$("worldStatus").classList.toggle("show",show)}
function ingredientList(recipe){return recipe.extendedIngredients || recipe.usedIngredients || []}
function ingredientText(item){
  if(!item) return "";
  if(typeof item === "string") return item;
  return item.original || item.originalName || item.name || item.text || item.food || "";
}
function instructionText(recipe){
  if(typeof recipe.instructions==="string") return recipe.instructions.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const steps=recipe.analyzedInstructions?.flatMap(group=>group.steps||[]).map(step=>step.step).filter(Boolean);return steps?.join(" ")||"";
}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}

function renderResults(){
  const t=copy[lang];$("resultsMeta").textContent=recipes.length?`${recipes.length} ${t.count}`:"";
  document.body.classList.toggle("wc-has-results",recipes.length>0);
  $("worldResults").innerHTML=recipes.map((recipe,index)=>{
    const list=ingredientList(recipe);const preview=list.slice(0,5).map(ingredientText).filter(Boolean).join(" · ");
    return `<article class="wc-recipe-card" data-index="${index}"><img src="${esc(recipe.image||"YEMEK-2.webp")}" alt="${esc(recipe.title)}"><div class="wc-recipe-body"><h3>${esc(recipe.title)}</h3><div class="wc-meta"><span>⏱ ${recipe.readyInMinutes||30} ${t.minutes}</span>${recipe.servings?`<span>◉ ${recipe.servings} ${t.servings}</span>`:""}<span>${esc(recipe.cuisine||recipe.category||"")}</span></div><p class="wc-ingredients-preview">${esc(preview)}</p></div></article>`;
  }).join("");
}

async function fetchDiscoverRecipes(payload){
  const response=await fetch(`${API_BASE}/discover-recipes`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Search failed");
  return Array.isArray(data.recipes) ? data.recipes : [];
}

async function fetchRecipesFromIngredients(ingredients){
  const normalizedResponse=await fetch(`${API_BASE}/normalize-ingredients`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ingredients,lang})
  });
  const normalizedData=await normalizedResponse.json();
  const normalizedIngredients=
    normalizedData?.success && Array.isArray(normalizedData.ingredients)
      ? normalizedData.ingredients.map(item=>item.canonicalEn).filter(Boolean)
      : ingredients;

  const response=await fetch(`${API_BASE}/recipes`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ingredients:normalizedIngredients,lang})
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Recipes failed");
  return Array.isArray(data)
    ? data
    : data.recipes || data.results || data.meals || data.data || [];
}

async function loadWorldRecipes(payload){
  const t=copy[lang];
  recipes=[];
  renderResults();
  document.body.classList.add("wc-has-results");
  setStatus(t.loading,true);
  $("searchButton").disabled=true;

  try{
    recipes=await fetchDiscoverRecipes(payload);
    renderResults();
    setStatus(recipes.length?"":t.empty,!recipes.length);
    closeWorldSearchPanel();
    $("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    setStatus(t.error,true);
  }finally{
    $("searchButton").disabled=false;
  }
}

async function discoverRecipes(){
  const query=$("worldQuery").value.trim(),t=copy[lang];
  if(!query&&!selectedCuisine&&!selectedType){setStatus(t.idle,true);return}
  const broadType=["meat","vegetarian"].includes(selectedType);
  const fallbackQuery =
    query ||
    (selectedCuisine ? cuisineSearchHints[selectedCuisine] : "") ||
    (selectedType ? typeSearchHints[selectedType] : "") ||
    "";
  await loadWorldRecipes({
    query:(fallbackQuery || broadType) ? (fallbackQuery || selectedType) : "",
    cuisine:selectedCuisine,
    category:broadType ? "main course" : selectedType,
    lang,
    limit:24
  });
}

function getWeeklyCuratedSet(){
  const start=new Date("2026-01-05T00:00:00Z");
  const now=new Date();
  const weekIndex=Math.max(0,Math.floor((now-start)/(7*24*60*60*1000)));
  return weeklyCuratedSets[weekIndex % weeklyCuratedSets.length];
}

async function showWeeklyFeaturedRecipes(){
  const t=copy[lang];
  const presets=getWeeklyCuratedSet();
  recipes=[];
  renderResults();
  document.body.classList.add("wc-has-results");
  setStatus(t.loading,true);
  $("worldQuery").value="";
  selectedCuisine="";
  selectedType="";
  renderFilters();

  try{
    const settled=await Promise.allSettled(
      presets.map(preset=>fetchDiscoverRecipes({
        query:preset.query || "",
        cuisine:preset.cuisine || "",
        category:preset.category || "",
        lang,
        limit:1
      }))
    );

    recipes=settled
      .filter(item=>item.status==="fulfilled")
      .flatMap(item=>item.value)
      .slice(0,3);

    renderResults();
    setStatus(recipes.length?"":t.empty,!recipes.length);
    $("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    setStatus(t.error,true);
  }
}

function openRecipe(index){
  const recipe=recipes[index],t=copy[lang];if(!recipe)return;
  const ingredients=ingredientList(recipe).map(item=>`<li>${esc(ingredientText(item))}</li>`).join("");
  $("recipeModalBody").innerHTML=`<img class="wc-modal-hero" src="${esc(recipe.image||"YEMEK-2.webp")}" alt="${esc(recipe.title)}"><h2>${esc(recipe.title)}</h2><div class="wc-meta"><span>⏱ ${recipe.readyInMinutes||30} ${t.minutes}</span>${recipe.servings?`<span>◉ ${recipe.servings} ${t.servings}</span>`:""}</div><h3>${t.ingredients}</h3><ul>${ingredients}</ul><h3>${t.instructions}</h3><p>${esc(instructionText(recipe))}</p>`;
  $("recipeModal").classList.add("open");$("recipeModal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
}
function closeModal(){$("recipeModal").classList.remove("open");$("recipeModal").setAttribute("aria-hidden","true");document.body.style.overflow=""}

$("languageMenu").innerHTML=languages.map(value=>`<button type="button" data-lang="${value}">${languageButtonHtml(value)}</button>`).join("");
$("languageButton").addEventListener("click",()=>$("languageMenu").classList.toggle("open"));
$("languageMenu").addEventListener("click",event=>{const button=event.target.closest("[data-lang]");if(!button)return;lang=button.dataset.lang;$("languageMenu").classList.remove("open");history.replaceState(null,"",`?lang=${lang}${selectedCuisine?`&cuisine=${selectedCuisine}`:""}`);applyLanguage()});
$("worldSidebarCuisineList").addEventListener("click",event=>{const button=event.target.closest("[data-cuisine]");if(!button)return;selectedCuisine=button.dataset.cuisine;renderFilters();discoverRecipes()});
$("typeList").addEventListener("click",event=>{const button=event.target.closest("[data-type]");if(!button)return;selectedType=button.dataset.type;renderFilters();discoverRecipes()});
$("worldSearchForm").addEventListener("submit",event=>{event.preventDefault();discoverRecipes()});
$("worldResults").addEventListener("click",event=>{const card=event.target.closest("[data-index]");if(card)openRecipe(Number(card.dataset.index))});
$("modalClose").addEventListener("click",closeModal);$("recipeModal").addEventListener("click",event=>{if(event.target===$("recipeModal"))closeModal()});document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});

$("worldManualButton").addEventListener("click",()=>{const value=$("worldManualInput").value.trim();if(!value)return;$("worldQuery").value=value;discoverRecipes()});
$("worldManualInput").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();$("worldManualButton").click()}});
$("worldJoinButton").addEventListener("click",()=>{location.href=`creator.html?lang=${lang}`});
$("worldScanButton").addEventListener("click",event=>{if(event.target.closest("#worldGalleryButton"))return;$("worldPhoto").click()});
$("worldGalleryButton").addEventListener("click",event=>{event.stopPropagation();$("worldPhotoGallery").click()});
async function analyzeWorldPhoto(event){
  const file=event.target.files?.[0];if(!file)return;const t=copy[lang],side=sidebarCopy[lang]||sidebarCopy.en;
  $("worldScanDesc").textContent=t.loading;$("worldScanBar").style.width="55%";
  try{const form=new FormData();form.append("photo",file);const response=await fetch(`${API_BASE}/analyze`,{method:"POST",body:form});const data=await response.json();if(!response.ok)throw new Error(data.error||"Analyze failed");const ingredients=data.ingredients||[];$("worldScanBar").style.width="100%";if(ingredients.length){openDetectedIngredients(ingredients)}else setStatus(t.empty,true)}catch(error){console.error(error);setStatus(t.error,true)}finally{setTimeout(()=>{$("worldScanBar").style.width="0";$("worldScanDesc").textContent=side[1];event.target.value=""},900)}
}
$("worldPhoto").addEventListener("change",analyzeWorldPhoto);$("worldPhotoGallery").addEventListener("change",analyzeWorldPhoto);

let detectedWorldIngredients=[];
function openDetectedIngredients(items){detectedWorldIngredients=[...new Set(items.map(item=>String(item).trim()).filter(Boolean))];$("worldDetectedItems").innerHTML=detectedWorldIngredients.map(item=>`<span>${esc(item)}</span>`).join("");$("worldDetectedModal").classList.add("open");$("worldDetectedModal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden"}
function closeDetectedIngredients(){$("worldDetectedModal").classList.remove("open");$("worldDetectedModal").setAttribute("aria-hidden","true");document.body.style.overflow=""}
async function findDetectedIngredientRecipes(){
  if(!detectedWorldIngredients.length) return;

  $("worldDetectedConfirm").disabled=true;
  const t=copy[lang];

  try{
    closeDetectedIngredients();
    recipes=[];
    renderResults();
    document.body.classList.add("wc-has-results");
    setStatus(t.loading,true);
    recipes=await fetchRecipesFromIngredients(detectedWorldIngredients);
    renderResults();
    setStatus(recipes.length?"":t.empty,!recipes.length);
    $("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    setStatus(t.error,true);
  }finally{
    $("worldDetectedConfirm").disabled=false;
  }
}
$("worldDetectedClose").addEventListener("click",closeDetectedIngredients);$("worldDetectedCancel").addEventListener("click",()=>{closeDetectedIngredients();$("worldPhotoGallery").click()});$("worldDetectedConfirm").addEventListener("click",findDetectedIngredientRecipes);$("worldDetectedModal").addEventListener("click",event=>{if(event.target===$("worldDetectedModal"))closeDetectedIngredients()});
function openWorldSearchPanel(){const card=$("worldSearchForm").closest(".wc-search-card");card.classList.add("open");document.body.classList.add("wc-search-open");setTimeout(()=>$("worldQuery").focus(),80)}
function closeWorldSearchPanel(){const card=$("worldSearchForm").closest(".wc-search-card");card.classList.remove("open");document.body.classList.remove("wc-search-open")}
$("heroSearchAction").addEventListener("click",openWorldSearchPanel);
$("heroResultsAction").addEventListener("click",showWeeklyFeaturedRecipes);
$("mobileFeaturedButton").addEventListener("click",showWeeklyFeaturedRecipes);
$("worldSearchClose").addEventListener("click",closeWorldSearchPanel);

const mobileFlow=$("worldMobileFlow");
let mobileWorldArranged=false;
let mobilePlaceholders=[];
function arrangeWorldMobile(){
  if(window.innerWidth<=980 && !mobileWorldArranged){
    const mosaicCards=Array.from(document.querySelectorAll(".wc-mosaic-small"));
    const nodes=[
      document.querySelector(".nk-brand-card"),
      document.querySelector(".wc-mosaic-main"),
      document.querySelector(".world-country-panel"),
      ...mosaicCards.slice(0,1),
      $("mobileFeaturedButton"),
      ...mosaicCards.slice(1,2),
      document.querySelector(".wc-results"),
      document.querySelector(".world-sidebar .join-area"),
      document.querySelector(".world-sidebar .site-footer-note")
    ].filter((node,index,self)=>node && self.indexOf(node)===index);
    mobilePlaceholders=nodes.map(node=>{const marker=document.createComment("world-mobile-slot");node.parentNode.insertBefore(marker,node);mobileFlow.appendChild(node);return {node,marker}});
    document.body.classList.add("world-mobile-arranged");
    mobileWorldArranged=true;
  }else if(window.innerWidth>980 && mobileWorldArranged){
    mobilePlaceholders.forEach(({node,marker})=>marker.replaceWith(node));
    mobilePlaceholders=[];document.body.classList.remove("world-mobile-arranged");mobileWorldArranged=false;
    mobileFlow.appendChild($("mobileFeaturedButton"));
  }
}
arrangeWorldMobile();window.addEventListener("resize",arrangeWorldMobile);

applyLanguage();
initWorldMobileControls();
if(selectedCuisine) discoverRecipes();
