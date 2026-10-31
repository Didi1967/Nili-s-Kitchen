const API_BASE = ["localhost","127.0.0.1"].includes(location.hostname) || /^(192\.168\.|10\.|172\.)/.test(location.hostname)
  ? `http://${location.hostname}:3000` : "https://api.niliskitchen.com";

const languages=["en","tr","ru","de","fr","es","pt","ar","ja","zh"];
const languageFlags={en:"gb",tr:"tr",ru:"ru",de:"de",fr:"fr",es:"es",pt:"pt",ar:"sa",ja:"jp",zh:"cn"};
const cuisineData=[
  ["turkey","tr"],["italy","it"],["mexico","mx"],["india","in"],["china","cn"],
  ["japan","jp"],["france","fr"],["greece","gr"],["usa","us"],["thailand","th"]
];
const typeIds=["main course","meat","vegetarian","pasta","seafood","soup","salad","breakfast","dessert","appetizer","hot beverage","cold beverage"];
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
  appetizer:"appetizer",
  "hot beverage":"hot chocolate",
  "cold beverage":"lemonade"
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
en:{brand:"World Cuisine Collection",home:"Home kitchen",ce:"EXPLORE BY COUNTRY",ct:"World cuisines",te:"WHAT TO COOK",tt:"Dish types",me:"A TABLE WITHOUT BORDERS",mt:"Discover the world's most loved dishes",mx:"Search by name, country or dish type. Every discovery grows Nili's recipe collection.",m1:"Fresh discoveries",m2:"Cook around the world",se:"FIND A DISH",st:"What are you craving?",ph:"Pizza, ramen, baklava...",find:"Find recipes",re:"CURATED RESULTS",rt:"Recipes worth discovering",idle:"Choose a country, dish type, or search by name.",loading:"Searching our collection and trusted recipe sources...",empty:"No recipes found. Try another choice.",error:"Recipes could not be loaded. Please try again.",ingredients:"Ingredients",instructions:"Preparation",servings:"servings",minutes:"min",source:"View original source",count:"recipes",countries:["Turkey","Italy","Mexico","India","China","Japan","France","Greece","USA","Thailand"],types:["Main dishes","Meat dishes","Vegetable dishes","Pasta","Seafood","Soups","Salads","Breakfast","Desserts","Appetizers","Hot drinks","Cold drinks"]},
tr:{brand:"Dünya Mutfağı Koleksiyonu",home:"Ana mutfak",ce:"ÜLKEYE GÖRE KEŞFET",ct:"Dünya mutfakları",te:"NE PİŞİRMEK İSTERSİN",tt:"Yemek türleri",me:"SINIRSIZ BİR SOFRA",mt:"Dünyanın en sevilen yemeklerini keşfet",mx:"İsim, ülke veya yemek türüyle ara. Her keşif Nili's tarif arşivini büyütür.",m1:"Taze keşifler",m2:"Dünyayı pişir",se:"YEMEK BUL",st:"Canın ne çekiyor?",ph:"Pizza, ramen, baklava...",find:"Tarifleri bul",re:"ÖZENLE SEÇİLENLER",rt:"Keşfetmeye değer tarifler",idle:"Bir ülke, yemek türü seç veya isimle ara.",loading:"Arşivimiz ve güvenilir tarif kaynakları taranıyor...",empty:"Tarif bulunamadı. Başka bir seçim deneyin.",error:"Tarifler yüklenemedi. Lütfen tekrar deneyin.",ingredients:"Malzemeler",instructions:"Hazırlanışı",servings:"kişilik",minutes:"dk",source:"Orijinal kaynağı aç",count:"tarif",countries:["Türkiye","İtalya","Meksika","Hindistan","Çin","Japonya","Fransa","Yunanistan","ABD","Tayland"],types:["Ana yemekler","Et yemekleri","Sebze yemekleri","Makarna","Deniz ürünleri","Çorbalar","Salatalar","Kahvaltı","Tatlılar","Başlangıçlar","Sıcak içecekler","Soğuk içecekler"]},
ru:{brand:"Коллекция мировой кухни",home:"Главная кухня",ce:"ВЫБЕРИТЕ СТРАНУ",ct:"Кухни мира",te:"ЧТО ПРИГОТОВИТЬ",tt:"Виды блюд",me:"СТОЛ БЕЗ ГРАНИЦ",mt:"Откройте любимые блюда мира",mx:"Ищите по названию, стране или виду блюда.",m1:"Свежие открытия",m2:"Готовьте весь мир",se:"НАЙТИ БЛЮДО",st:"Чего вам хочется?",ph:"Пицца, рамен, баклава...",find:"Найти рецепты",re:"ПОДБОРКА",rt:"Рецепты для открытий",idle:"Выберите страну, вид блюда или введите название.",loading:"Ищем рецепты...",empty:"Рецепты не найдены.",error:"Не удалось загрузить рецепты.",ingredients:"Ингредиенты",instructions:"Приготовление",servings:"порций",minutes:"мин",source:"Открыть источник",count:"рецептов",countries:["Турция","Италия","Мексика","Индия","Китай","Япония","Франция","Греция","США","Таиланд"],types:["Основные блюда","Мясные блюда","Овощные блюда","Паста","Морепродукты","Супы","Салаты","Завтрак","Десерты","Закуски","Горячие напитки","Холодные напитки"]},
de:{brand:"Sammlung der Weltküchen",home:"Hauptküche",ce:"NACH LAND ENTDECKEN",ct:"Küchen der Welt",te:"WAS KOCHEN",tt:"Gerichtarten",me:"EIN TISCH OHNE GRENZEN",mt:"Entdecke die beliebtesten Gerichte der Welt",mx:"Suche nach Name, Land oder Gerichtart.",m1:"Frische Entdeckungen",m2:"Koche um die Welt",se:"GERICHT FINDEN",st:"Worauf hast du Lust?",ph:"Pizza, Ramen, Baklava...",find:"Rezepte finden",re:"AUSGEWÄHLTE ERGEBNISSE",rt:"Rezepte zum Entdecken",idle:"Wähle ein Land, eine Gerichtart oder suche nach Namen.",loading:"Rezepte werden gesucht...",empty:"Keine Rezepte gefunden.",error:"Rezepte konnten nicht geladen werden.",ingredients:"Zutaten",instructions:"Zubereitung",servings:"Portionen",minutes:"Min.",source:"Originalquelle öffnen",count:"Rezepte",countries:["Türkei","Italien","Mexiko","Indien","China","Japan","Frankreich","Griechenland","USA","Thailand"],types:["Hauptgerichte","Fleischgerichte","Gemüsegerichte","Pasta","Meeresfrüchte","Suppen","Salate","Frühstück","Desserts","Vorspeisen","Heißgetränke","Kaltgetränke"]},
fr:{brand:"Collection des cuisines du monde",home:"Cuisine principale",ce:"EXPLORER PAR PAYS",ct:"Cuisines du monde",te:"QUE CUISINER",tt:"Types de plats",me:"UNE TABLE SANS FRONTIÈRES",mt:"Découvrez les plats les plus aimés au monde",mx:"Recherchez par nom, pays ou type de plat.",m1:"Nouvelles découvertes",m2:"Cuisinez le monde",se:"TROUVER UN PLAT",st:"De quoi avez-vous envie ?",ph:"Pizza, ramen, baklava...",find:"Trouver des recettes",re:"RÉSULTATS SÉLECTIONNÉS",rt:"Recettes à découvrir",idle:"Choisissez un pays, un type ou recherchez un nom.",loading:"Recherche des recettes...",empty:"Aucune recette trouvée.",error:"Impossible de charger les recettes.",ingredients:"Ingrédients",instructions:"Préparation",servings:"portions",minutes:"min",source:"Voir la source",count:"recettes",countries:["Turquie","Italie","Mexique","Inde","Chine","Japon","France","Grèce","États-Unis","Thaïlande"],types:["Plats principaux","Plats de viande","Plats de légumes","Pâtes","Fruits de mer","Soupes","Salades","Petit-déjeuner","Desserts","Entrées","Boissons chaudes","Boissons froides"]},
es:{brand:"Colección de cocinas del mundo",home:"Cocina principal",ce:"EXPLORAR POR PAÍS",ct:"Cocinas del mundo",te:"QUÉ COCINAR",tt:"Tipos de platos",me:"UNA MESA SIN FRONTERAS",mt:"Descubre los platos más queridos del mundo",mx:"Busca por nombre, país o tipo de plato.",m1:"Nuevos descubrimientos",m2:"Cocina por el mundo",se:"BUSCAR UN PLATO",st:"¿Qué te apetece?",ph:"Pizza, ramen, baklava...",find:"Buscar recetas",re:"RESULTADOS SELECCIONADOS",rt:"Recetas por descubrir",idle:"Elige un país, tipo de plato o busca por nombre.",loading:"Buscando recetas...",empty:"No se encontraron recetas.",error:"No se pudieron cargar las recetas.",ingredients:"Ingredientes",instructions:"Preparación",servings:"porciones",minutes:"min",source:"Ver fuente original",count:"recetas",countries:["Turquía","Italia","México","India","China","Japón","Francia","Grecia","EE. UU.","Tailandia"],types:["Platos principales","Platos de carne","Platos de verduras","Pasta","Mariscos","Sopas","Ensaladas","Desayuno","Postres","Entrantes","Bebidas calientes","Bebidas frías"]},
pt:{brand:"Coleção de cozinhas do mundo",home:"Cozinha principal",ce:"EXPLORAR POR PAÍS",ct:"Cozinhas do mundo",te:"O QUE COZINHAR",tt:"Tipos de pratos",me:"UMA MESA SEM FRONTEIRAS",mt:"Descubra os pratos mais amados do mundo",mx:"Pesquise por nome, país ou tipo de prato.",m1:"Novas descobertas",m2:"Cozinhe pelo mundo",se:"ENCONTRAR UM PRATO",st:"O que deseja comer?",ph:"Pizza, ramen, baklava...",find:"Encontrar receitas",re:"RESULTADOS SELECIONADOS",rt:"Receitas para descobrir",idle:"Escolha um país, tipo ou pesquise pelo nome.",loading:"Pesquisando receitas...",empty:"Nenhuma receita encontrada.",error:"Não foi possível carregar as receitas.",ingredients:"Ingredientes",instructions:"Preparação",servings:"porções",minutes:"min",source:"Ver fonte original",count:"receitas",countries:["Turquia","Itália","México","Índia","China","Japão","França","Grécia","EUA","Tailândia"],types:["Pratos principais","Pratos de carne","Pratos de legumes","Massa","Frutos do mar","Sopas","Saladas","Café da manhã","Sobremesas","Entradas","Bebidas quentes","Bebidas frias"]},
ar:{brand:"مجموعة مطابخ العالم",home:"المطبخ الرئيسي",ce:"استكشف حسب البلد",ct:"مطابخ العالم",te:"ماذا نطبخ",tt:"أنواع الأطباق",me:"مائدة بلا حدود",mt:"اكتشف أشهر أطباق العالم",mx:"ابحث بالاسم أو البلد أو نوع الطبق.",m1:"اكتشافات جديدة",m2:"اطبخ حول العالم",se:"ابحث عن طبق",st:"ماذا تشتهي؟",ph:"بيتزا، رامن، بقلاوة...",find:"ابحث عن وصفات",re:"نتائج مختارة",rt:"وصفات تستحق الاكتشاف",idle:"اختر بلداً أو نوع طبق أو ابحث بالاسم.",loading:"جارٍ البحث عن الوصفات...",empty:"لم يتم العثور على وصفات.",error:"تعذر تحميل الوصفات.",ingredients:"المكونات",instructions:"طريقة التحضير",servings:"حصص",minutes:"دقيقة",source:"فتح المصدر الأصلي",count:"وصفات",countries:["تركيا","إيطاليا","المكسيك","الهند","الصين","اليابان","فرنسا","اليونان","أمريكا","تايلاند"],types:["أطباق رئيسية","أطباق اللحوم","أطباق الخضار","معكرونة","مأكولات بحرية","شوربات","سلطات","إفطار","حلويات","مقبلات","مشروبات ساخنة","مشروبات باردة"]},
ja:{brand:"世界料理コレクション",home:"メインキッチン",ce:"国から探す",ct:"世界の料理",te:"何を作る",tt:"料理の種類",me:"国境のない食卓",mt:"世界で愛される料理を発見",mx:"料理名、国、種類から検索できます。",m1:"新しい発見",m2:"世界を料理する",se:"料理を探す",st:"何が食べたいですか？",ph:"ピザ、ラーメン、バクラヴァ...",find:"レシピを探す",re:"おすすめ結果",rt:"発見したいレシピ",idle:"国、料理の種類、または名前を選んでください。",loading:"レシピを検索中...",empty:"レシピが見つかりません。",error:"レシピを読み込めませんでした。",ingredients:"材料",instructions:"作り方",servings:"人分",minutes:"分",source:"元のサイトを見る",count:"レシピ",countries:["トルコ","イタリア","メキシコ","インド","中国","日本","フランス","ギリシャ","アメリカ","タイ"],types:["メイン料理","肉料理","野菜料理","パスタ","シーフード","スープ","サラダ","朝食","デザート","前菜","温かい飲み物","冷たい飲み物"]},
zh:{brand:"世界美食收藏",home:"主厨房",ce:"按国家探索",ct:"世界美食",te:"想做什么",tt:"菜肴类型",me:"无国界餐桌",mt:"发现世界最受欢迎的菜肴",mx:"按名称、国家或菜肴类型搜索。",m1:"新鲜发现",m2:"烹饪全世界",se:"寻找菜肴",st:"你想吃什么？",ph:"披萨、拉面、果仁蜜饼...",find:"查找食谱",re:"精选结果",rt:"值得发现的食谱",idle:"选择国家、菜肴类型或按名称搜索。",loading:"正在搜索食谱...",empty:"未找到食谱。",error:"无法加载食谱。",ingredients:"配料",instructions:"制作方法",servings:"人份",minutes:"分钟",source:"查看原始来源",count:"食谱",countries:["土耳其","意大利","墨西哥","印度","中国","日本","法国","希腊","美国","泰国"],types:["主菜","肉类菜肴","蔬菜菜肴","意大利面","海鲜","汤","沙拉","早餐","甜点","开胃菜","热饮","冷饮"]}
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

const resultActionCopy={
  en:{previous:"← Back",more:"Next →",open:"View recipe",other:"Flavours from other countries",back:"World cuisines",home:"Home",otherTitle:"Flavours beyond the featured ten"},
  tr:{previous:"← Geri",more:"İleri →",open:"Tarifi gör",other:"Diğer ülke lezzetleri",back:"Dünya mutfakları",home:"Ana sayfa",otherTitle:"Ana 10 ülke dışından lezzetler"},
  ru:{previous:"← Назад",more:"Далее →",open:"Открыть рецепт",other:"Вкусы других стран",back:"Кухни мира",home:"Главная",otherTitle:"Вкусы за пределами основной десятки"},
  de:{previous:"← Zurück",more:"Weiter →",open:"Rezept ansehen",other:"Aromen anderer Länder",back:"Weltküchen",home:"Startseite",otherTitle:"Aromen außerhalb der zehn Hauptländer"},
  fr:{previous:"← Retour",more:"Suivant →",open:"Voir la recette",other:"Saveurs d'autres pays",back:"Cuisines du monde",home:"Accueil",otherTitle:"Saveurs au-delà des dix pays principaux"},
  es:{previous:"← Atrás",more:"Siguiente →",open:"Ver receta",other:"Sabores de otros países",back:"Cocinas del mundo",home:"Inicio",otherTitle:"Sabores fuera de los diez países principales"},
  pt:{previous:"← Voltar",more:"Seguinte →",open:"Ver receita",other:"Sabores de outros países",back:"Cozinhas do mundo",home:"Início",otherTitle:"Sabores além dos dez países principais"},
  ar:{previous:"→ السابق",more:"التالي ←",open:"عرض الوصفة",other:"نكهات من دول أخرى",back:"مطابخ العالم",home:"الرئيسية",otherTitle:"نكهات خارج الدول العشر الرئيسية"},
  ja:{previous:"← 戻る",more:"次へ →",open:"レシピを見る",other:"その他の国の味",back:"世界の料理",home:"ホーム",otherTitle:"主要10か国以外の味"},
  zh:{previous:"← 上一页",more:"下一页 →",open:"查看食谱",other:"其他国家风味",back:"世界美食",home:"首页",otherTitle:"十大国家之外的风味"}
};

let lang=String(new URLSearchParams(location.search).get("lang") || localStorage.getItem("niliKitchenLangV2") || "en").toLowerCase();
if(!languages.includes(lang)) lang="en";
let selectedCuisine=new URLSearchParams(location.search).get("cuisine") || "";
let selectedType="";
let recipes=[];
let lastDiscoverPayload=null;
let lastDiscoverMeta=null;
let worldResultsMode="standard";
let worldResultPage=1;
let activeWorldRecipeId=null;
let worldLanguageRefreshInProgress=false;

const $=id=>document.getElementById(id);
const textMap={brandSub:"brand",cuisineEyebrow:"ce",cuisineTitle:"ct",typeEyebrow:"te",typeTitle:"tt",mosaicEyebrow:"me",mosaicTitle:"mt",mosaicText:"mx",mosaicCardOne:"m1",mosaicCardTwo:"m2",searchEyebrow:"se",searchTitle:"st",searchLead:"idle",searchButton:"find",resultsEyebrow:"re",resultsTitle:"rt"};
const staticAssetSrc=value=>/^(?:https?:|data:|blob:)/i.test(String(value||""))?value:`${API_BASE}${String(value||"").startsWith("/")?value:`/${value}`}`;
const languageButtonHtml=value=>`<img src="${staticAssetSrc(`/flags/${value}.svg`)}" alt="${value.toUpperCase()} flag"><span>${value.toUpperCase()}</span>`;
const countryFlagSrc=code=>staticAssetSrc(`/flags/countries/${code}.svg`);
const regionFlagSrc=name=>staticAssetSrc(`/flags/regions/${name}.svg`);
const recipeFlagRules=[
  {code:"tr",match:["turk","turkish","turkiye","türkiye","turkey"]},
  {code:"it",match:["ital","italian","italy","italia"]},
  {code:"mx",match:["mexic","mexico","méxico"]},
  {code:"in",match:["india","indian","hindistan"]},
  {code:"cn",match:["china","chinese","çin"]},
  {code:"jp",match:["japan","japanese","japon"]},
  {code:"fr",match:["france","french","fransa"]},
  {code:"gr",match:["greece","greek","yunan"]},
  {code:"us",match:["usa","american","united states","abd"]},
  {code:"th",match:["thai","thailand","tayland"]},
  {code:"ma",match:["morocco","moroccan","fas"]},
  {code:"uz",match:["uzbek","uzbekistan","özbek"]},
  {code:"kz",match:["kazakh","kazakhstan","kazak"]},
  {code:"az",match:["azerbaijan","azeri","azerbaycan"]},
  {code:"ge",match:["georgia","georgian","gürcü"]},
  {code:"kr",match:["korea","korean","kore"]},
  {code:"vn",match:["vietnam","vietnamese"]},
  {code:"es",match:["spain","spanish","ispanya"]},
  {code:"pt",match:["portugal","portuguese"]},
  {code:"de",match:["germany","german","almanya"]},
  {code:"ir",match:["iran","persian","iranian"]},
  {code:"lb",match:["lebanon","lebanese","lübnan"]},
  {code:"sy",match:["syria","syrian","suriye"]},
  {code:"eg",match:["egypt","egyptian","mısır"]},
  {code:"hr",match:["croatia","croatian","hırvat"]},
  {code:"id",match:["indonesia","indonesian","endonezya"]},
  {code:"ar",match:["argentina","argentinian","arjantin"]},
  {code:"al",match:["albania","albanian","arnavut"]},
  {code:"au",match:["australia","australian","avustralya"]},
  {code:"at",match:["austria","austrian","avusturya"]},
  {code:"be",match:["belgium","belgian","belçika"]},
  {code:"bo",match:["bolivia","bolivian","bolivya"]},
  {code:"ba",match:["bosnia","bosnian","bosna"]},
  {code:"br",match:["brazil","brazilian","brezilya"]},
  {code:"bg",match:["bulgaria","bulgarian","bulgar"]},
  {code:"gb",match:["united kingdom","british","britanya","birleşik krallık","ingiltere","ingiliz","galler"]},
  {code:"dz",match:["algeria","algerian","cezayir"]},
  {code:"cz",match:["czech","çek"]},
  {code:"dk",match:["denmark","danish","danimarka"]},
  {code:"ec",match:["ecuador","ecuadorian","ekvador"]},
  {code:"ee",match:["estonia","estonian","estonya"]},
  {code:"et",match:["ethiopia","ethiopian","etiyopya"]},
  {code:"ph",match:["philippines","filipino","filipinler"]},
  {code:"fi",match:["finland","finnish","finlandiya"]},
  {code:"gh",match:["ghana","ghanaian","gana"]},
  {code:"za",match:["south africa","güney afrika"]},
  {code:"nl",match:["netherlands","dutch","hollanda"]},
  {code:"iq",match:["iraq","iraqi","ırak"]},
  {code:"ie",match:["ireland","irish","irlanda"]},
  {code:"il",match:["israel","israeli","israil"]},
  {code:"se",match:["sweden","swedish","isveç"]},
  {code:"ch",match:["switzerland","swiss","isviçre"]},
  {code:"ca",match:["canada","canadian","kanada"]},
  {code:"co",match:["colombia","colombian","kolombiya"]},
  {code:"cu",match:["cuba","cuban","küba"]},
  {code:"my",match:["malaysia","malaysian","malezya"]},
  {code:"np",match:["nepal","nepali"]},
  {code:"no",match:["norway","norwegian","norveç"]},
  {code:"pe",match:["peru","peruvian"]},
  {code:"pl",match:["poland","polish","polonya"]},
  {code:"ro",match:["romania","romanian","romanya"]},
  {code:"ru",match:["russia","russian","rusya"]},
  {code:"rs",match:["serbia","serbian","sırp"]},
  {code:"sg",match:["singapore","singaporean","singapur"]},
  {code:"lk",match:["sri lanka","sri lankan"]},
  {code:"cl",match:["chile","chilean","şili"]},
  {code:"tw",match:["taiwan","taiwanese","tayvan"]},
  {code:"tn",match:["tunisia","tunisian","tunus"]},
  {code:"ua",match:["ukraine","ukrainian","ukrayna"]},
  {code:"uy",match:["uruguay","uruguayan"]},
  {code:"jo",match:["jordan","jordanian","ürdün"]},
  {code:"ve",match:["venezuela","venezuelan"]},
  {code:"ye",match:["yemen","yemeni"]},
  {code:"nz",match:["new zealand","yeni zelanda"]},
  {code:"ps",match:["palestine","palestinian","filistin"]}
];
const regionFlagRules=[
  {icon:"central-asia",match:["central asia","orta asya"]},
  {icon:"middle-east",match:["middle east","arab","levant","orta dogu","orta doğu"]},
  {icon:"mediterranean",match:["mediterranean","akdeniz"]},
  {icon:"balkan",match:["balkan"]},
  {icon:"east-asia",match:["east asia","far east","uzak dogu","uzak doğu"]},
  {icon:"north-africa",match:["north africa","kuzey afrika"]},
  {icon:"latin-america",match:["latin america","latin"]},
  {icon:"caucasus",match:["caucasus","kafkas"]}
];

function ensureWorldVisitorId(){
  let visitorId = localStorage.getItem("niliVisitorId");

  if(!visitorId){
    visitorId =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("niliVisitorId", visitorId);
  }

  return visitorId;
}

function sendWorldAnalyticsPing(){
  fetch(`${API_BASE}/analytics/ping`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      visitorId:ensureWorldVisitorId(),
      path:location.pathname+location.search+location.hash,
      lang,
      userEmail:localStorage.getItem("creatorEmail")||localStorage.getItem("niliUserEmail")||""
    }),
    keepalive:true
  }).catch(()=>{});
}

sendWorldAnalyticsPing();
setInterval(sendWorldAnalyticsPing,30000);

function applyLanguage(){
  lang=String(lang || "en").toLowerCase();
  if(!languages.includes(lang)) lang="en";
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
  updateResultActions();
  [["heroSearchActionEyebrow","se"],["heroSearchActionTitle","st"],["heroResultsActionEyebrow","re"],["heroResultsActionTitle","rt"]].forEach(([id,key])=>{if($(id))$(id).textContent=t[key]});
  renderFilters();renderResults();
  if(!recipes.length) setStatus(t.idle,true);
}

async function changeWorldLanguage(nextLang){
  lang=String(nextLang || "en").toLowerCase();
  if(!languages.includes(lang)) lang="en";

  const detailWasOpen=document.body.classList.contains("recipe-full-page-open");
  const previousRecipeId=activeWorldRecipeId;

  history.replaceState(
    null,
    "",
    `?lang=${lang}${selectedCuisine?`&cuisine=${selectedCuisine}`:""}`
  );
  applyLanguage();
  initWorldMobileControls();

  if(!recipes.length || !lastDiscoverPayload || worldLanguageRefreshInProgress){
    return;
  }

  worldLanguageRefreshInProgress=true;
  try{
    await loadWorldRecipes({...lastDiscoverPayload,lang});

    if(detailWasOpen && previousRecipeId != null){
      const translatedIndex=recipes.findIndex(
        recipe=>String(recipe.id)===String(previousRecipeId)
      );
      if(translatedIndex>=0) openRecipe(translatedIndex);
    }
  }finally{
    worldLanguageRefreshInProgress=false;
  }
}

function worldUserIsLoggedIn(){return !!(localStorage.getItem("creatorEmail")||localStorage.getItem("niliUserEmail"))}
function initWorldMobileControls(){
  const userButton=$("worldMobileUserButton"),userName=$("worldMobileUserName"),userMenu=$("worldMobileUserMenu");
  const languageButton=$("worldMobileLanguageButton"),languageMenu=$("worldMobileLanguageMenu");
  if(!userButton||!userName||!userMenu||!languageButton||!languageMenu)return;
  const username=localStorage.getItem("creatorUsername")||localStorage.getItem("niliCreatorUsername")||localStorage.getItem("niliUsername");
  const email=localStorage.getItem("creatorEmail")||localStorage.getItem("niliCreatorEmail")||localStorage.getItem("niliUserEmail");
  const loginLabels={en:"Login",tr:"Giriş",ru:"Войти",de:"Anmelden",fr:"Connexion",es:"Iniciar sesión",pt:"Entrar",ar:"تسجيل الدخول",ja:"ログイン",zh:"登录"};
  userName.textContent=username||email||loginLabels[lang]||loginLabels.en;
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
  $("worldMobileLanguageMenu").classList.remove("open");
  changeWorldLanguage(button.dataset.mobileLang);
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
  cuisineBox.innerHTML=cuisineData.map(([id,flag],i)=>`<button class="category-btn ${selectedCuisine===id?"active":""}" data-cuisine="${id}"><img src="${countryFlagSrc(flag)}" alt=""><span>${t.countries[i]}</span><i aria-hidden="true"></i></button>`).join("");
  $("typeList").innerHTML=typeIds.map((id,i)=>`<button class="wc-filter-button ${selectedType===id?"active":""}" data-type="${id}" title="${esc(t.types[i])}">${t.types[i]}</button>`).join("");
}

function setStatus(message,show){$("worldStatus").textContent=message;$("worldStatus").classList.toggle("show",show)}
function showSimilarRecipesPrompt(payload){
  const labels={
    en:["Nili's Kitchen recipe found first.","Show similar recipes"],
    tr:["Önce Nili's Kitchen tarifi bulundu.","Benzer tarifleri de göster"],
    ru:["Сначала найден рецепт Nili's Kitchen.","Показать похожие рецепты"],
    de:["Zuerst wurde ein Nili's Kitchen Rezept gefunden.","Ähnliche Rezepte zeigen"],
    fr:["Une recette Nili's Kitchen a été trouvée en premier.","Voir des recettes similaires"],
    es:["Primero se encontró una receta de Nili's Kitchen.","Ver recetas similares"],
    pt:["Receita da Nili's Kitchen encontrada primeiro.","Mostrar receitas semelhantes"],
    ar:["تم العثور أولاً على وصفة من Nili's Kitchen.","عرض وصفات مشابهة"],
    ja:["Nili's Kitchen のレシピが先に見つかりました。","似たレシピも表示"],
    zh:["已优先找到 Nili's Kitchen 食谱。","显示相似食谱"]
  };
  const t=labels[lang]||labels.en;
  const status=$("worldStatus");
  status.innerHTML=`<span>${esc(t[0])}</span><button type="button" class="wc-similar-btn" data-show-similar>${esc(t[1])}</button>`;
  status.classList.add("show","wc-similar-status");
  lastDiscoverPayload=payload;
}
function ingredientList(recipe){return recipe.extendedIngredients || recipe.usedIngredients || []}
function ingredientText(item){
  if(!item) return "";
  if(typeof item === "string") return item;
  return item.original || item.originalName || item.name || item.text || item.food || "";
}

function normalize(value){
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

const alcoholicRecipeTerms=[
  "alcohol","beer","wine","vodka","rum","gin","tequila","whiskey","whisky",
  "bourbon","brandy","cognac","liqueur","champagne","prosecco","vermouth",
  "cocktail","spiked"
];
function isNonAlcoholicRecipe(recipe){
  const searchable=normalize([
    recipe?.title,
    recipe?.category,
    recipe?.dishType,
    ...(recipe?.tags || []),
    ...ingredientList(recipe).map(ingredientText)
  ].filter(Boolean).join(" "));
  return !alcoholicRecipeTerms.some(term=>searchable.includes(term));
}

function recipeFlagImage(recipe){
  const raw=normalize([
    recipe?.cuisineKey,
    recipe?.country,
    recipe?.cuisine,
    recipe?.category,
    recipe?.area,
    recipe?.region,
    recipe?.origin
  ].filter(Boolean).join(" "));
  const country=recipeFlagRules.find(item=>item.match.some(keyword=>raw.includes(normalize(keyword))));
  if(country) return countryFlagSrc(country.code);
  const region=regionFlagRules.find(item=>item.match.some(keyword=>raw.includes(normalize(keyword))));
  return region ? regionFlagSrc(region.icon) : regionFlagSrc("world");
}
function recipeFlagAttrs(recipe){
  const fallback=regionFlagSrc("world");
  const onError=`this.onerror=null;this.src='${fallback}'`;
  return `src="${esc(recipeFlagImage(recipe))}" onerror="${esc(onError)}"`;
}
function instructionText(recipe){
  if(typeof recipe.instructions==="string") return recipe.instructions.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const steps=recipe.analyzedInstructions?.flatMap(group=>group.steps||[]).map(step=>step.step).filter(Boolean);return steps?.join(" ")||"";
}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}

function recipeImageCandidates(recipe,index=0){
  const normalizeImage=value=>{
    let url=String(value||"").trim().replace(/\\/g,"/");
    if(!url || /\/flags\//i.test(url)) return "";
    url=url
      .replace(/\/recipe-import-images\/optimized-images\//gi,"/optimized-images/")
      .replace(/\/recipe-import-images\/recipe-import-images\//gi,"/recipe-import-images/");
    return staticAssetSrc(url);
  };
  const values=[
    recipe?.mediaUrl,
    recipe?.fullImage,
    recipe?.image,
    ...(Array.isArray(recipe?.mediaUrls)?recipe.mediaUrls:[])
  ];
  return [...new Set(values.map(normalizeImage).filter(Boolean))];
}

function recipeImage(recipe,index=0){
  return recipeImageCandidates(recipe,index)[0] || "";
}

function recipeImageAttrs(recipe,index=0){
  const candidates=recipeImageCandidates(recipe,index);
  const src=candidates[0]||"";
  const fallbacks=candidates.slice(1);
  const onError="const list=JSON.parse(this.dataset.fallbacks||'[]');const next=list.shift();if(next){this.dataset.fallbacks=JSON.stringify(list);this.src=next;}else{this.onerror=null;const card=this.closest('.wc-recipe-card');if(card){card.remove();}else{this.remove();}}";
  return `src="${esc(src)}" data-fallbacks="${esc(JSON.stringify(fallbacks))}" onerror="${esc(onError)}"`;
}

function approvedRecipeCardUrl(recipe){
  const urls=recipe?.recipeCardUrls&&typeof recipe.recipeCardUrls==="object"?recipe.recipeCardUrls:{};
  const statuses=recipe?.recipeCardStatuses&&typeof recipe.recipeCardStatuses==="object"?recipe.recipeCardStatuses:{};
  const current=String(lang||"en").toLowerCase();
  if(statuses[current]==="approved"&&urls[current]) return staticAssetSrc(urls[current]);
  if(statuses.en==="approved"&&urls.en) return staticAssetSrc(urls.en);
  return "";
}

function approvedRecipeCardImageAttrs(recipe){
  const src=approvedRecipeCardUrl(recipe);
  return `src="${esc(src)}" onerror="this.onerror=null;this.remove()"`;
}

function renderResults(){
  const t=copy[lang],actions=resultActionCopy[lang]||resultActionCopy.en;$("resultsMeta").textContent=recipes.length?`${recipes.length} ${t.count}`:"";
  document.body.classList.toggle("wc-has-results",recipes.length>0);
  $("worldResults").innerHTML=recipes.map((recipe,index)=>{
    const list=ingredientList(recipe);const preview=list.slice(0,5).map(ingredientText).filter(Boolean).join(" · ");
    return `<article class="wc-recipe-card" data-index="${index}"><img class="wc-recipe-photo" ${recipeImageAttrs(recipe,index)} alt="${esc(recipe.title)}"><span class="wc-recipe-flag"><img ${recipeFlagAttrs(recipe)} alt=""></span><div class="wc-recipe-body"><h3>${esc(recipe.title)}</h3><div class="wc-meta"><span>⏱ ${recipe.readyInMinutes||30} ${t.minutes}</span>${recipe.servings?`<span>◉ ${recipe.servings} ${t.servings}</span>`:""}<span>${esc(recipe.cuisine||recipe.category||"")}</span></div><p class="wc-ingredients-preview">${esc(preview)}</p><button class="recipe-card-open-btn wc-recipe-open-btn" type="button"><span>${esc(actions.open)}</span><span aria-hidden="true">→</span></button></div></article>`;
  }).join("");
  updateResultActions();
}

function updateResultActions(){
  const actions=$("worldResultsActions");
  if(!actions) return;
  const labels=resultActionCopy[lang]||resultActionCopy.en;
  $("worldPreviousPage").textContent=labels.previous;
  $("worldLoadMore").textContent=labels.more;
  $("worldOtherCuisines").textContent=labels.other;
  $("worldResultsBack").textContent=labels.back;
  $("worldResultsHome").textContent=labels.home;
  $("worldPreviousPage").hidden=worldResultPage<=1;
  $("worldLoadMore").hidden=!lastDiscoverMeta?.hasMore||worldResultPage>=2;
  $("worldOtherCuisines").hidden=worldResultsMode==="other";
  actions.hidden=!recipes.length;
  if($("resultsTitle")) $("resultsTitle").textContent=worldResultsMode==="other"?labels.otherTitle:copy[lang].rt;
}

function closeWorldResultsPage(){
  recipes=[];
  lastDiscoverPayload=null;
  lastDiscoverMeta=null;
  worldResultsMode="standard";
  worldResultPage=1;
  renderResults();
  document.body.classList.remove("wc-has-results");
  setStatus("",false);
  const main=document.querySelector(".wc-main");
  if(main) main.scrollTo({top:0,behavior:"smooth"});
  window.scrollTo({top:0,behavior:"smooth"});
}

async function fetchDiscoverRecipes(payload){
  const response=await fetch(`${API_BASE}/discover-recipes`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Search failed");
  return {
    recipes:Array.isArray(data.recipes) ? data.recipes : [],
    meta:data.meta || {}
  };
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
    body:JSON.stringify({
      ingredients:normalizedIngredients,
      originalIngredients:ingredients,
      lang
    })
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Recipes failed");
  return Array.isArray(data)
    ? data
    : data.recipes || data.results || data.meals || data.data || [];
}

async function loadWorldRecipes(payload){
  const t=copy[lang];
  const requestPayload={...payload};
  recipes=[];
  renderResults();
  document.body.classList.add("wc-has-results");
  setStatus(t.loading,true);
  $("searchButton").disabled=true;
  lastDiscoverMeta=null;

  try{
    const result=await fetchDiscoverRecipes(requestPayload);
    recipes=(result.recipes||[]).filter(recipe=>!requestPayload.nonAlcoholic||isNonAlcoholicRecipe(recipe));
    lastDiscoverMeta=result.meta || {};
    lastDiscoverPayload={...requestPayload,offset:0};
    worldResultsMode=requestPayload.otherCuisines?"other":"standard";
    worldResultPage=Math.floor((Number(requestPayload.offset)||0)/6)+1;
    renderResults();
    if(recipes.length && lastDiscoverMeta.fallbackMode==="nili-exact" && !requestPayload.includeExternal){
      showSimilarRecipesPrompt(requestPayload);
    }else{
      setStatus(recipes.length?"":t.empty,!recipes.length);
    }
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
  const beverageType=["hot beverage","cold beverage"].includes(selectedType);
  await loadWorldRecipes({
    query,
    cuisine:selectedCuisine,
    category:selectedType,
    beverageTemperature:beverageType ? selectedType.split(" ")[0] : "",
    nonAlcoholic:beverageType,
    lang,
    limit:6,
    offset:0
  });
}

async function loadMoreWorldRecipes(){
  if(!lastDiscoverPayload || !lastDiscoverMeta?.hasMore || worldResultPage>=2) return;
  const button=$("worldLoadMore");
  button.disabled=true;
  try{
    await loadWorldRecipes({
      ...lastDiscoverPayload,
      offset:worldResultPage*6,
      limit:6
    });
  }finally{
    button.disabled=false;
  }
}

async function loadPreviousWorldRecipes(){
  if(!lastDiscoverPayload || worldResultPage<=1) return;
  await loadWorldRecipes({
    ...lastDiscoverPayload,
    offset:(worldResultPage-2)*6,
    limit:6
  });
}

async function showOtherCuisineRecipes(){
  $("worldQuery").value="";
  selectedCuisine="";
  selectedType="";
  renderFilters();
  await loadWorldRecipes({
    query:"",
    cuisine:"",
    category:"",
    lang,
    limit:6,
    offset:0,
    niliOnly:true,
    otherCuisines:true
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
  recipes=[];
  renderResults();
  document.body.classList.add("wc-has-results");
  setStatus(t.loading,true);
  $("worldQuery").value="";
  selectedCuisine="";
  selectedType="";
  renderFilters();

  try{
    const result=await fetchDiscoverRecipes({
      query:"",
      cuisine:"",
      category:"",
      lang,
      limit:3,
      niliOnly:true,
      featured:true
    });
    recipes=(result.recipes||[]).slice(0,3);
    lastDiscoverMeta={...(result.meta||{}),hasMore:false};
    lastDiscoverPayload={query:"",cuisine:"",category:"",lang,limit:6,offset:0,niliOnly:true,featured:true};
    worldResultsMode="standard";

    renderResults();
    setStatus(recipes.length?"":t.empty,!recipes.length);
    $("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
    console.error(error);
    setStatus(t.error,true);
  }
}

async function loadSimilarWorldRecipes(){
  if(!lastDiscoverPayload) return;
  await loadWorldRecipes({...lastDiscoverPayload,includeExternal:true,limit:24});
}

async function ensureWorldRecipeDetailLanguage(recipe){
  if(
    recipe?._localizedLang===String(lang || "en").toLowerCase() &&
    recipe?._detailsLocalized===true
  ) return recipe;

  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`${API_BASE}/localize-recipe-detail`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({recipe,lang}),
      signal:controller.signal
    });
    const payload=await response.json();
    if(!response.ok || !payload?.recipe){
      throw new Error(payload?.error || "Recipe translation failed");
    }
    return payload.recipe;
  }finally{
    clearTimeout(timeoutId);
  }
}

async function openRecipe(index){
  let recipe=recipes[index],t=copy[lang];if(!recipe)return;
  activeWorldRecipeId=recipe.id;
  try{
    if(
      recipe?._localizedLang!==String(lang || "en").toLowerCase() ||
      recipe?._detailsLocalized!==true
    ){
      $("recipeFullPageBody").innerHTML=`<div class="recipe-page-empty"><h2>${esc(t.loading || "Loading recipe...")}</h2></div>`;
      $("recipeFullPage").setAttribute("aria-hidden","false");
      document.body.classList.add("recipe-full-page-open");
      recipe=await ensureWorldRecipeDetailLanguage(recipe);
      recipes[index]=recipe;
    }
  }catch(error){
    console.warn("WORLD RECIPE DETAIL LANGUAGE FALLBACK:",error);
  }
  if(recipe.source==="nili_creator"){
    fetch(`${API_BASE}/creator-recipe-click/${encodeURIComponent(recipe.sourceId||recipe.id)}`,{method:"POST"}).catch(()=>{});
  }
  const allIngredients=ingredientList(recipe);
  const ingredients=allIngredients.map(item=>`<li class="recipe-detail-ingredient"><span class="recipe-detail-bullet">🥄</span><span>${esc(ingredientText(item))}</span></li>`).join("");
  const rawInstructions=instructionText(recipe);
  const instructionSteps=(recipe.analyzedInstructions||[])
    .flatMap(group=>group.steps||[])
    .map(step=>step.step)
    .filter(Boolean);
  const cleanStep=value=>String(value||"")
    .replace(/^\s*(?:step\s*)?\d+\s*[.)\-:]?\s*/i,"")
    .trim();
  const usableSteps=values=>values.map(cleanStep).filter(step=>step && !/^\d+[.)-]?$/.test(step));
  const numberedMarkers=[...rawInstructions.matchAll(/(?:^|\s)(\d{1,2})\s*[.)]\s*/g)];
  let fallbackSteps=[];
  if(numberedMarkers.length>1){
    fallbackSteps=usableSteps(numberedMarkers.map((marker,markerIndex)=>{
      const start=marker.index+marker[0].length;
      const end=markerIndex+1<numberedMarkers.length?numberedMarkers[markerIndex+1].index:rawInstructions.length;
      return rawInstructions.slice(start,end);
    }));
  }
  if(!fallbackSteps.length){
    fallbackSteps=usableSteps(rawInstructions.split(/\n+|(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-ÝĞİŞÇ])/u));
  }
  const steps=usableSteps(instructionSteps.length?instructionSteps:fallbackSteps);
  const stepsHtml=(steps.length?steps:[rawInstructions||t.instructions])
    .map((step,stepIndex)=>`<li class="recipe-detail-step"><span class="recipe-step-number">${stepIndex+1}</span><span class="recipe-step-text">${esc(step)}</span></li>`)
    .join("");
  const cuisineLabel=recipe.country||recipe.cuisine||recipe.category||"World";

  const nav=resultActionCopy[lang]||resultActionCopy.en;
  const brandLabels={tr:"NILI'S KITCHEN TARİFİ",en:"A NILI'S KITCHEN RECIPE",de:"EIN NILI'S KITCHEN REZEPT",fr:"UNE RECETTE NILI'S KITCHEN",es:"UNA RECETA DE NILI'S KITCHEN",pt:"UMA RECEITA NILI'S KITCHEN",ru:"РЕЦЕПТ NILI'S KITCHEN",ar:"وصفة من NILI'S KITCHEN",ja:"NILI'S KITCHEN レシピ",zh:"NILI'S KITCHEN 食谱"};
  const backLabel=String(nav.previous||"← Back").replace(/[←→]/g,"").trim();
  const recipePageBody=$("recipeFullPageBody");
  const approvedCardUrl=approvedRecipeCardUrl(recipe);
  if(approvedCardUrl){
  recipePageBody.innerHTML=`
    <article class="recipe-card-viewer">
      <nav class="recipe-card-viewer-nav" aria-label="Recipe navigation">
        <button type="button" onclick="closeModal()"><span aria-hidden="true">←</span> ${esc(backLabel)}</button>
        <button type="button" onclick="closeWorldRecipeToHome()">${esc(nav.home||t.home||"Home")} <span aria-hidden="true">⌂</span></button>
      </nav>
      <div class="recipe-card-viewer-stage">
        <img class="recipe-card-viewer-image" ${approvedRecipeCardImageAttrs(recipe)} alt="${esc(recipe.title||"Recipe")}">
        
        <span class="recipe-card-country-badge">
          <img ${recipeFlagAttrs(recipe)} alt="">
          <strong>${esc(cuisineLabel)}</strong>
        </span>
      </div>
    </article>
  `;
  $("recipeFullPage").setAttribute("aria-hidden","false");
  document.body.classList.add("recipe-full-page-open");
  history.replaceState(null,"",`${location.pathname}?lang=${lang}#recipe-${encodeURIComponent(recipe.id||index)}`);
  window.scrollTo({top:0,behavior:"instant"});
  return;
  }
  recipePageBody.innerHTML=`
    <article class="recipe-story-page">
      <nav class="recipe-story-nav" aria-label="Recipe navigation">
        <button type="button" onclick="closeModal()"><span aria-hidden="true">←</span> ${esc(backLabel)}</button>
        <button type="button" onclick="closeWorldRecipeToHome()">${esc(nav.home||t.home||"Home")} <span aria-hidden="true">⌂</span></button>
      </nav>
      <div class="recipe-story-frame">
        <header class="recipe-story-heading">
          <span class="recipe-detail-wordmark">${esc(brandLabels[lang]||brandLabels.en)}</span>
          <h1>${esc(recipe.title)}</h1>
          <div class="recipe-story-origin">
            <span class="recipe-detail-country"><img ${recipeFlagAttrs(recipe)} alt=""><span>${esc(cuisineLabel)}</span></span>
          </div>
        </header>
        <div class="recipe-story-lead">
          <div class="recipe-detail-hero">
            <img ${recipeImageAttrs(recipe,index)} alt="${esc(recipe.title)}">
          </div>
          <div class="recipe-story-summary">
            <div class="recipe-detail-meta">
              <span class="recipe-detail-pill"><small>⏱</small><strong>${recipe.readyInMinutes||30} ${esc(t.minutes)}</strong></span>
              ${recipe.servings?`<span class="recipe-detail-pill"><small>👥</small><strong>${esc(recipe.servings)} ${esc(t.servings)}</strong></span>`:""}
              <span class="recipe-detail-pill"><small>🥗</small><strong>${allIngredients.length}</strong></span>
            </div>
            <section class="recipe-detail-ingredients-panel">
              <h2>🥗 ${esc(t.ingredients)}</h2>
              <ul class="recipe-detail-ingredients">${ingredients}</ul>
            </section>
          </div>
        </div>
        <section class="recipe-detail-content">
          <div class="recipe-story-section-title"><span>👨‍🍳</span><h2>${esc(t.instructions)}</h2></div>
          <ol class="recipe-detail-steps">${stepsHtml}</ol>
        </section>
        <footer class="recipe-story-footer"><span>Nili's Kitchen</span><button type="button" onclick="closeModal()">← ${esc(backLabel)}</button></footer>
      </div>
    </article>`;
  $("recipeFullPage").setAttribute("aria-hidden","false");
  document.body.classList.add("recipe-full-page-open");
  history.replaceState(null,"",`${location.pathname}?lang=${lang}#recipe-${encodeURIComponent(recipe.id||index)}`);
  window.scrollTo({top:0,behavior:"instant"});
}
function closeModal(){
  if(document.body.classList.contains("recipe-full-page-open")){
    document.body.classList.remove("recipe-full-page-open");
    $("recipeFullPage").setAttribute("aria-hidden","true");
    history.replaceState(null,"",`${location.pathname}?lang=${lang}#results`);
    window.scrollTo({top:0,behavior:"instant"});
    return;
  }
  $("recipeModal").classList.remove("open");$("recipeModal").setAttribute("aria-hidden","true");document.body.style.overflow="";
}
function closeWorldRecipeToHome(){window.location.href=`index.html?lang=${encodeURIComponent(lang)}`}

function linkedRecipeId(){
  const queryId=new URLSearchParams(location.search).get("recipe");
  if(queryId) return queryId;
  const match=String(location.hash || "").match(/^#recipe-(.+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function openLinkedRecipe(){
  const recipeId=linkedRecipeId();
  if(!recipeId) return false;

  const t=copy[lang];
  document.body.classList.add("wc-has-results");
  setStatus(t.loading,true);
  try{
    const response=await fetch(
      `${API_BASE}/public-recipe/${encodeURIComponent(recipeId)}?lang=${encodeURIComponent(lang)}`
    );
    const payload=await response.json();
    if(!response.ok || !payload?.recipe){
      throw new Error(payload?.error || "Recipe not found");
    }
    recipes=[payload.recipe];
    lastDiscoverPayload=null;
    lastDiscoverMeta={hasMore:false};
    worldResultPage=1;
    renderResults();
    setStatus("",false);
    await openRecipe(0);
    return true;
  }catch(error){
    console.error("LINKED RECIPE LOAD ERROR:",error);
    setStatus(t.error,true);
    return false;
  }
}

$("languageMenu").innerHTML=languages.map(value=>`<button type="button" data-lang="${value}">${languageButtonHtml(value)}</button>`).join("");
$("languageButton").addEventListener("click",()=>$("languageMenu").classList.toggle("open"));
$("languageMenu").addEventListener("click",event=>{const button=event.target.closest("[data-lang]");if(!button)return;$("languageMenu").classList.remove("open");changeWorldLanguage(button.dataset.lang)});
$("worldSidebarCuisineList").addEventListener("click",event=>{
  const button=event.target.closest("[data-cuisine]");
  if(!button)return;
  selectedCuisine=button.dataset.cuisine;
  selectedType="";
  $("worldQuery").value="";
  $("worldManualInput").value="";
  renderFilters();
  discoverRecipes();
});
$("typeList").addEventListener("click",event=>{
  const button=event.target.closest("[data-type]");
  if(!button)return;
  selectedType=button.dataset.type;
  $("worldQuery").value="";
  $("worldManualInput").value="";
  renderFilters();
  discoverRecipes();
});
$("worldSearchForm").addEventListener("submit",event=>{
  event.preventDefault();
  if($("worldQuery").value.trim()){
    selectedCuisine="";
    selectedType="";
    renderFilters();
  }
  discoverRecipes();
});
$("worldResults").addEventListener("click",event=>{const card=event.target.closest("[data-index]");if(card)openRecipe(Number(card.dataset.index))});
$("worldResultsBack").addEventListener("click",closeWorldResultsPage);
$("worldPreviousPage").addEventListener("click",loadPreviousWorldRecipes);
$("worldLoadMore").addEventListener("click",loadMoreWorldRecipes);
$("worldOtherCuisines").addEventListener("click",showOtherCuisineRecipes);
$("worldResultsHome").addEventListener("click",()=>{location.href=`index.html?lang=${lang}`});
$("worldStatus").addEventListener("click",event=>{if(event.target.closest("[data-show-similar]"))loadSimilarWorldRecipes()});
$("modalClose").addEventListener("click",closeModal);$("recipeModal").addEventListener("click",event=>{if(event.target===$("recipeModal"))closeModal()});document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});

$("worldManualButton").addEventListener("click",()=>{
  const value=$("worldManualInput").value.trim();
  if(!value)return;
  selectedCuisine="";
  selectedType="";
  $("worldQuery").value=value;
  renderFilters();
  discoverRecipes();
});
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
function renderDetectedWorldIngredients(){
  const box=$("worldDetectedItems");
  box.innerHTML=detectedWorldIngredients.map((item,index)=>`
    <span class="wc-detected-chip">
      <span>${esc(item)}</span>
      <button type="button" data-detected-index="${index}" aria-label="Remove ${esc(item)}">×</button>
    </span>
  `).join("");
  box.querySelectorAll("[data-detected-index]").forEach(button=>{
    button.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      const index=Number(button.dataset.detectedIndex);
      if(Number.isInteger(index)&&index>=0&&index<detectedWorldIngredients.length){
        detectedWorldIngredients.splice(index,1);
        renderDetectedWorldIngredients();
        $("worldDetectedConfirm").disabled=!detectedWorldIngredients.length;
      }
    });
  });
}
function openDetectedIngredients(items){detectedWorldIngredients=[...new Set(items.map(item=>String(item).trim()).filter(Boolean))];renderDetectedWorldIngredients();$("worldDetectedConfirm").disabled=!detectedWorldIngredients.length;$("worldDetectedModal").classList.add("open");$("worldDetectedModal").setAttribute("aria-hidden","false");document.body.style.overflow="hidden"}
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
      document.querySelector(".world-sidebar .upload-card"),
      document.querySelector(".world-country-panel"),
      document.querySelector(".world-sidebar .ad-media-box"),
      document.querySelector(".world-sidebar .join-area"),
      document.querySelector(".world-sidebar .site-footer-note"),
      document.querySelector(".wc-mosaic-main"),
      ...mosaicCards.slice(0,1),
      $("mobileFeaturedButton"),
      ...mosaicCards.slice(1,2),
      document.querySelector(".wc-results")
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
openLinkedRecipe().then(opened=>{
  if(!opened && selectedCuisine) discoverRecipes();
});
