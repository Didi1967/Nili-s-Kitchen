const PLAN_LANG_KEY="niliKitchenLangV2";
const PLAN_STORAGE_KEY="niliWeeklyMealPlanV1";

window.API_BASE=
  window.location.hostname==="localhost" ||
  window.location.hostname==="127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.")
    ? `http://${window.location.hostname}:3000`
    : "https://api.niliskitchen.com";

const PLAN_COPY={
  en:{
    brandSubtitle:"Weekly meal planner",home:"Home kitchen",language:"Language",
    eyebrow:"YOUR WEEK, BEAUTIFULLY PLANNED",heroTitle:"Let Nili plan dinner.",heroText:"Personal dinners, less waste and one clear shopping list.",
    trustOne:"Nili recipes first",trustTwo:"Your pantry deducted",trustThree:"Ready in seconds",artNote:"A calmer week starts here.",
    formEyebrow:"TELL NILI ABOUT YOUR WEEK",formTitle:"Build your personal plan",days:"How many days?",servings:"How many people?",
    budget:"Weekly budget",budgetLow:"Economical",budgetMedium:"Balanced",budgetFlexible:"Flexible",
    diet:"Eating preference",dietStandard:"No restriction",dietVegetarian:"Vegetarian",dietVegan:"Vegan",dietHalal:"Halal",dietGlutenFree:"Gluten-free",
    time:"Maximum cooking time",disliked:"Ingredients you dislike",dislikedPlaceholder:"e.g. mushrooms, cilantro",
    pantryTitle:"Already in your kitchen",pantryHint:"These items will be removed from the shopping list.",pantryEmpty:"No ingredients selected on the home page yet.",
    submit:"Create my meal plan",submitHint:"Nili will choose from approved recipes",previewEyebrow:"WHAT YOU WILL GET",previewTitle:"One decision. A calmer week.",
    previewOneTitle:"Personal dinners",previewOneText:"A different approved recipe for each day.",previewTwoTitle:"Smart shopping",previewTwoText:"Only what is missing from your kitchen.",
    previewThreeTitle:"Less food waste",previewThreeText:"Use what you have before buying more.",quote:"“The best plan is the one you can actually cook.”",
    resultsEyebrow:"YOUR NILI PLAN",resultsTitle:"Dinner is decided.",regenerate:"Regenerate",print:"Print plan",shoppingEyebrow:"AUTOMATIC LIST",
    shoppingTitle:"Shopping list",copyList:"Copy shopping list",footer:"Plan less. Cook better. Waste less.",loading:"Nili is planning your week...",
    error:"The plan could not be created. Please try again.",day:"Day",minutes:"min",people:"people",ingredients:"ingredients",
    summary:"{days} dinners for {people} people",checked:"{done} of {total} items completed",copied:"Shopping list copied.",
    emptyShopping:"You already have everything needed.",categoryProduce:"Fresh produce",categoryProtein:"Protein",categoryDairy:"Dairy & eggs",categoryPantry:"Pantry"
  },
  tr:{
    brandSubtitle:"Haftalık yemek planlayıcısı",home:"Ana mutfak",language:"Dil",
    eyebrow:"HAFTAN, ZEVKLE PLANLANDI",heroTitle:"Akşam yemeklerini Nili planlasın.",heroText:"Kişisel yemekler, daha az israf ve tek bir net alışveriş listesi.",
    trustOne:"Önce Nili tarifleri",trustTwo:"Evdekiler listeden düşer",trustThree:"Saniyeler içinde hazır",artNote:"Daha sakin bir hafta burada başlar.",
    formEyebrow:"NILI'YE HAFTANI ANLAT",formTitle:"Kişisel planını oluştur",days:"Kaç günlük?",servings:"Kaç kişilik?",
    budget:"Haftalık bütçe",budgetLow:"Ekonomik",budgetMedium:"Dengeli",budgetFlexible:"Esnek",
    diet:"Beslenme tercihi",dietStandard:"Kısıtlama yok",dietVegetarian:"Vejetaryen",dietVegan:"Vegan",dietHalal:"Helal",dietGlutenFree:"Glütensiz",
    time:"En fazla pişirme süresi",disliked:"Sevmediğin malzemeler",dislikedPlaceholder:"ör. mantar, kişniş",
    pantryTitle:"Mutfağında zaten bulunanlar",pantryHint:"Bunlar alışveriş listesinden çıkarılır.",pantryEmpty:"Ana sayfada henüz malzeme seçilmedi.",
    submit:"Yemek planımı oluştur",submitHint:"Nili onaylı tariflerden seçecek",previewEyebrow:"ELİNE NE GEÇECEK",previewTitle:"Tek karar. Daha sakin bir hafta.",
    previewOneTitle:"Kişisel akşam yemekleri",previewOneText:"Her gün için farklı bir onaylı tarif.",previewTwoTitle:"Akıllı alışveriş",previewTwoText:"Yalnızca mutfağında eksik olanlar.",
    previewThreeTitle:"Daha az gıda israfı",previewThreeText:"Yenisini almadan önce elindekini kullan.",quote:"“En iyi plan, gerçekten pişirebildiğin plandır.”",
    resultsEyebrow:"NILI PLANIN",resultsTitle:"Akşam yemekleri belli.",regenerate:"Yeniden oluştur",print:"Planı yazdır",shoppingEyebrow:"OTOMATİK LİSTE",
    shoppingTitle:"Alışveriş listesi",copyList:"Listeyi kopyala",footer:"Daha az planla. Daha iyi pişir. Daha az israf et.",loading:"Nili haftanı planlıyor...",
    error:"Plan oluşturulamadı. Lütfen tekrar dene.",day:"Gün",minutes:"dk",people:"kişilik",ingredients:"malzeme",
    summary:"{people} kişilik {days} akşam yemeği",checked:"{total} üründen {done} tanesi tamamlandı",copied:"Alışveriş listesi kopyalandı.",
    emptyShopping:"Gerekli her şey zaten mutfağında.",categoryProduce:"Sebze ve meyve",categoryProtein:"Protein",categoryDairy:"Süt ürünleri ve yumurta",categoryPantry:"Kiler"
  },
  de:{
    brandSubtitle:"Wöchentlicher Speiseplan",home:"Zur Küche",language:"Sprache",eyebrow:"DEINE WOCHE, SCHÖN GEPLANT",heroTitle:"Nili plant das Abendessen.",heroText:"Persönliche Gerichte, weniger Abfall und eine klare Einkaufsliste.",
    trustOne:"Nili-Rezepte zuerst",trustTwo:"Vorräte werden abgezogen",trustThree:"In Sekunden bereit",artNote:"Eine ruhigere Woche beginnt hier.",
    formEyebrow:"ERZÄHLE NILI VON DEINER WOCHE",formTitle:"Erstelle deinen persönlichen Plan",days:"Wie viele Tage?",servings:"Für wie viele Personen?",
    budget:"Wochenbudget",budgetLow:"Günstig",budgetMedium:"Ausgewogen",budgetFlexible:"Flexibel",diet:"Ernährungsweise",dietStandard:"Keine Einschränkung",dietVegetarian:"Vegetarisch",dietVegan:"Vegan",dietHalal:"Halal",dietGlutenFree:"Glutenfrei",
    time:"Maximale Kochzeit",disliked:"Unerwünschte Zutaten",dislikedPlaceholder:"z. B. Pilze, Koriander",pantryTitle:"Bereits in deiner Küche",pantryHint:"Diese Zutaten werden von der Einkaufsliste entfernt.",pantryEmpty:"Auf der Startseite wurden noch keine Zutaten gewählt.",
    submit:"Speiseplan erstellen",submitHint:"Nili wählt aus geprüften Rezepten",previewEyebrow:"DAS BEKOMMST DU",previewTitle:"Eine Entscheidung. Eine ruhigere Woche.",
    previewOneTitle:"Persönliche Abendessen",previewOneText:"Jeden Tag ein anderes geprüftes Rezept.",previewTwoTitle:"Clever einkaufen",previewTwoText:"Nur das, was in deiner Küche fehlt.",previewThreeTitle:"Weniger Lebensmittelabfall",previewThreeText:"Nutze zuerst, was du schon hast.",quote:"„Der beste Plan ist der, den du wirklich kochen kannst.“",
    resultsEyebrow:"DEIN NILI-PLAN",resultsTitle:"Das Abendessen steht fest.",regenerate:"Neu erstellen",print:"Plan drucken",shoppingEyebrow:"AUTOMATISCHE LISTE",shoppingTitle:"Einkaufsliste",copyList:"Liste kopieren",footer:"Weniger planen. Besser kochen. Weniger verschwenden.",
    loading:"Nili plant deine Woche...",error:"Der Plan konnte nicht erstellt werden.",day:"Tag",minutes:"Min.",people:"Personen",ingredients:"Zutaten",summary:"{days} Abendessen für {people} Personen",checked:"{done} von {total} erledigt",copied:"Einkaufsliste kopiert.",emptyShopping:"Alles Nötige ist bereits vorhanden.",categoryProduce:"Obst und Gemüse",categoryProtein:"Protein",categoryDairy:"Milchprodukte & Eier",categoryPantry:"Vorrat"
  },
  fr:{
    brandSubtitle:"Planificateur de repas",home:"Cuisine d'accueil",language:"Langue",eyebrow:"VOTRE SEMAINE, BIEN PLANIFIÉE",heroTitle:"Laissez Nili planifier le dîner.",heroText:"Des dîners personnalisés, moins de gaspillage et une liste de courses claire.",
    trustOne:"Recettes Nili d'abord",trustTwo:"Votre garde-manger déduit",trustThree:"Prêt en quelques secondes",artNote:"Une semaine plus sereine commence ici.",
    formEyebrow:"PARLEZ DE VOTRE SEMAINE À NILI",formTitle:"Créez votre programme personnel",days:"Combien de jours ?",servings:"Pour combien de personnes ?",
    budget:"Budget hebdomadaire",budgetLow:"Économique",budgetMedium:"Équilibré",budgetFlexible:"Flexible",diet:"Préférence alimentaire",dietStandard:"Aucune restriction",dietVegetarian:"Végétarien",dietVegan:"Végane",dietHalal:"Halal",dietGlutenFree:"Sans gluten",
    time:"Temps de cuisson maximal",disliked:"Ingrédients non appréciés",dislikedPlaceholder:"ex. champignons, coriandre",pantryTitle:"Déjà dans votre cuisine",pantryHint:"Ces produits seront retirés de la liste de courses.",pantryEmpty:"Aucun ingrédient sélectionné sur l'accueil.",
    submit:"Créer mon programme",submitHint:"Nili choisira parmi les recettes approuvées",previewEyebrow:"CE QUE VOUS OBTENEZ",previewTitle:"Une décision. Une semaine plus sereine.",
    previewOneTitle:"Dîners personnalisés",previewOneText:"Une recette approuvée différente chaque jour.",previewTwoTitle:"Courses intelligentes",previewTwoText:"Uniquement ce qui manque dans votre cuisine.",previewThreeTitle:"Moins de gaspillage",previewThreeText:"Utilisez ce que vous avez avant d'acheter.",quote:"« Le meilleur programme est celui que vous pouvez vraiment cuisiner. »",
    resultsEyebrow:"VOTRE PROGRAMME NILI",resultsTitle:"Les dîners sont décidés.",regenerate:"Régénérer",print:"Imprimer",shoppingEyebrow:"LISTE AUTOMATIQUE",shoppingTitle:"Liste de courses",copyList:"Copier la liste",footer:"Planifiez moins. Cuisinez mieux. Gaspillez moins.",
    loading:"Nili planifie votre semaine...",error:"Le programme n'a pas pu être créé.",day:"Jour",minutes:"min",people:"personnes",ingredients:"ingrédients",summary:"{days} dîners pour {people} personnes",checked:"{done} sur {total} terminés",copied:"Liste copiée.",emptyShopping:"Vous avez déjà tout le nécessaire.",categoryProduce:"Fruits et légumes",categoryProtein:"Protéines",categoryDairy:"Produits laitiers et œufs",categoryPantry:"Épicerie"
  },
  es:{
    brandSubtitle:"Planificador semanal",home:"Cocina principal",language:"Idioma",eyebrow:"TU SEMANA, BIEN PLANIFICADA",heroTitle:"Deja que Nili planee la cena.",heroText:"Cenas personales, menos desperdicio y una lista de compras clara.",
    trustOne:"Primero recetas Nili",trustTwo:"Descontamos tu despensa",trustThree:"Listo en segundos",artNote:"Una semana más tranquila empieza aquí.",
    formEyebrow:"CUÉNTALE TU SEMANA A NILI",formTitle:"Crea tu plan personal",days:"¿Cuántos días?",servings:"¿Para cuántas personas?",
    budget:"Presupuesto semanal",budgetLow:"Económico",budgetMedium:"Equilibrado",budgetFlexible:"Flexible",diet:"Preferencia alimentaria",dietStandard:"Sin restricciones",dietVegetarian:"Vegetariano",dietVegan:"Vegano",dietHalal:"Halal",dietGlutenFree:"Sin gluten",
    time:"Tiempo máximo de cocina",disliked:"Ingredientes que no te gustan",dislikedPlaceholder:"p. ej. champiñones, cilantro",pantryTitle:"Ya está en tu cocina",pantryHint:"Se eliminarán de la lista de compras.",pantryEmpty:"Aún no seleccionaste ingredientes en el inicio.",
    submit:"Crear mi plan",submitHint:"Nili elegirá recetas aprobadas",previewEyebrow:"LO QUE OBTENDRÁS",previewTitle:"Una decisión. Una semana más tranquila.",
    previewOneTitle:"Cenas personales",previewOneText:"Una receta aprobada diferente cada día.",previewTwoTitle:"Compra inteligente",previewTwoText:"Solo lo que falta en tu cocina.",previewThreeTitle:"Menos desperdicio",previewThreeText:"Usa lo que tienes antes de comprar.",quote:"«El mejor plan es el que realmente puedes cocinar.»",
    resultsEyebrow:"TU PLAN NILI",resultsTitle:"La cena está decidida.",regenerate:"Regenerar",print:"Imprimir",shoppingEyebrow:"LISTA AUTOMÁTICA",shoppingTitle:"Lista de compras",copyList:"Copiar lista",footer:"Planifica menos. Cocina mejor. Desperdicia menos.",
    loading:"Nili está planificando tu semana...",error:"No se pudo crear el plan.",day:"Día",minutes:"min",people:"personas",ingredients:"ingredientes",summary:"{days} cenas para {people} personas",checked:"{done} de {total} completados",copied:"Lista copiada.",emptyShopping:"Ya tienes todo lo necesario.",categoryProduce:"Frutas y verduras",categoryProtein:"Proteínas",categoryDairy:"Lácteos y huevos",categoryPantry:"Despensa"
  },
  pt:{
    brandSubtitle:"Planejador semanal",home:"Cozinha inicial",language:"Idioma",eyebrow:"SUA SEMANA, BEM PLANEJADA",heroTitle:"Deixe a Nili planejar o jantar.",heroText:"Jantares pessoais, menos desperdício e uma lista de compras clara.",
    trustOne:"Receitas Nili primeiro",trustTwo:"Sua despensa é descontada",trustThree:"Pronto em segundos",artNote:"Uma semana mais tranquila começa aqui.",
    formEyebrow:"CONTE SUA SEMANA À NILI",formTitle:"Crie seu plano pessoal",days:"Quantos dias?",servings:"Para quantas pessoas?",
    budget:"Orçamento semanal",budgetLow:"Econômico",budgetMedium:"Equilibrado",budgetFlexible:"Flexível",diet:"Preferência alimentar",dietStandard:"Sem restrição",dietVegetarian:"Vegetariano",dietVegan:"Vegano",dietHalal:"Halal",dietGlutenFree:"Sem glúten",
    time:"Tempo máximo de preparo",disliked:"Ingredientes que não gosta",dislikedPlaceholder:"ex. cogumelos, coentro",pantryTitle:"Já está na sua cozinha",pantryHint:"Esses itens sairão da lista de compras.",pantryEmpty:"Nenhum ingrediente selecionado na página inicial.",
    submit:"Criar meu plano",submitHint:"Nili escolherá receitas aprovadas",previewEyebrow:"O QUE VOCÊ RECEBE",previewTitle:"Uma decisão. Uma semana mais tranquila.",
    previewOneTitle:"Jantares pessoais",previewOneText:"Uma receita aprovada diferente por dia.",previewTwoTitle:"Compras inteligentes",previewTwoText:"Somente o que falta na sua cozinha.",previewThreeTitle:"Menos desperdício",previewThreeText:"Use o que tem antes de comprar.",quote:"“O melhor plano é aquele que você realmente consegue cozinhar.”",
    resultsEyebrow:"SEU PLANO NILI",resultsTitle:"O jantar está decidido.",regenerate:"Gerar novamente",print:"Imprimir",shoppingEyebrow:"LISTA AUTOMÁTICA",shoppingTitle:"Lista de compras",copyList:"Copiar lista",footer:"Planeje menos. Cozinhe melhor. Desperdice menos.",
    loading:"Nili está planejando sua semana...",error:"Não foi possível criar o plano.",day:"Dia",minutes:"min",people:"pessoas",ingredients:"ingredientes",summary:"{days} jantares para {people} pessoas",checked:"{done} de {total} concluídos",copied:"Lista copiada.",emptyShopping:"Você já tem tudo o que precisa.",categoryProduce:"Hortifruti",categoryProtein:"Proteínas",categoryDairy:"Laticínios e ovos",categoryPantry:"Despensa"
  },
  ru:{
    brandSubtitle:"План питания на неделю",home:"На главную",language:"Язык",eyebrow:"ВАША НЕДЕЛЯ КРАСИВО СПЛАНИРОВАНА",heroTitle:"Пусть Nili спланирует ужины.",heroText:"Персональные блюда, меньше отходов и один понятный список покупок.",
    trustOne:"Сначала рецепты Nili",trustTwo:"Учитываем ваши запасы",trustThree:"Готово за секунды",artNote:"Спокойная неделя начинается здесь.",
    formEyebrow:"РАССКАЖИТЕ NILI О НЕДЕЛЕ",formTitle:"Создайте личный план",days:"Сколько дней?",servings:"На сколько человек?",
    budget:"Недельный бюджет",budgetLow:"Экономный",budgetMedium:"Сбалансированный",budgetFlexible:"Гибкий",diet:"Тип питания",dietStandard:"Без ограничений",dietVegetarian:"Вегетарианское",dietVegan:"Веганское",dietHalal:"Халяль",dietGlutenFree:"Без глютена",
    time:"Максимальное время",disliked:"Нелюбимые ингредиенты",dislikedPlaceholder:"например, грибы, кинза",pantryTitle:"Уже есть на кухне",pantryHint:"Эти продукты будут исключены из списка.",pantryEmpty:"На главной странице ингредиенты не выбраны.",
    submit:"Создать план",submitHint:"Nili выберет проверенные рецепты",previewEyebrow:"ЧТО ВЫ ПОЛУЧИТЕ",previewTitle:"Одно решение. Спокойная неделя.",
    previewOneTitle:"Персональные ужины",previewOneText:"Новый проверенный рецепт на каждый день.",previewTwoTitle:"Умные покупки",previewTwoText:"Только то, чего нет на кухне.",previewThreeTitle:"Меньше отходов",previewThreeText:"Сначала используйте то, что уже есть.",quote:"«Лучший план — тот, который вы действительно приготовите.»",
    resultsEyebrow:"ВАШ ПЛАН NILI",resultsTitle:"Ужины выбраны.",regenerate:"Создать заново",print:"Печать",shoppingEyebrow:"АВТОМАТИЧЕСКИЙ СПИСОК",shoppingTitle:"Список покупок",copyList:"Копировать",footer:"Меньше планов. Лучше блюда. Меньше отходов.",
    loading:"Nili планирует вашу неделю...",error:"Не удалось создать план.",day:"День",minutes:"мин",people:"чел.",ingredients:"ингредиентов",summary:"{days} ужинов для {people} человек",checked:"Выполнено {done} из {total}",copied:"Список скопирован.",emptyShopping:"Всё необходимое уже есть.",categoryProduce:"Овощи и фрукты",categoryProtein:"Белковые продукты",categoryDairy:"Молочное и яйца",categoryPantry:"Бакалея"
  },
  ar:{
    brandSubtitle:"مخطط الوجبات الأسبوعي",home:"المطبخ الرئيسي",language:"اللغة",eyebrow:"أسبوعك مخطط بعناية",heroTitle:"دعي نيلي تخطط للعشاء.",heroText:"وجبات شخصية وهدر أقل وقائمة تسوق واضحة.",
    trustOne:"وصفات نيلي أولاً",trustTwo:"خصم الموجود في مطبخك",trustThree:"جاهز خلال ثوانٍ",artNote:"أسبوع أكثر هدوءاً يبدأ هنا.",
    formEyebrow:"أخبري نيلي عن أسبوعك",formTitle:"أنشئي خطتك الشخصية",days:"كم يوماً؟",servings:"لِكم شخص؟",
    budget:"الميزانية الأسبوعية",budgetLow:"اقتصادية",budgetMedium:"متوازنة",budgetFlexible:"مرنة",diet:"النظام الغذائي",dietStandard:"بلا قيود",dietVegetarian:"نباتي",dietVegan:"نباتي صرف",dietHalal:"حلال",dietGlutenFree:"خالٍ من الغلوتين",
    time:"أقصى وقت للطهي",disliked:"مكونات لا تحبينها",dislikedPlaceholder:"مثل الفطر والكزبرة",pantryTitle:"موجود في مطبخك",pantryHint:"ستُحذف هذه العناصر من قائمة التسوق.",pantryEmpty:"لم يتم اختيار مكونات في الصفحة الرئيسية.",
    submit:"أنشئ خطة وجباتي",submitHint:"ستختار نيلي من الوصفات المعتمدة",previewEyebrow:"ما ستحصلين عليه",previewTitle:"قرار واحد. أسبوع أكثر هدوءاً.",
    previewOneTitle:"وجبات عشاء شخصية",previewOneText:"وصفة معتمدة مختلفة لكل يوم.",previewTwoTitle:"تسوق ذكي",previewTwoText:"فقط ما ينقص مطبخك.",previewThreeTitle:"هدر طعام أقل",previewThreeText:"استخدمي ما لديك قبل شراء المزيد.",quote:"«أفضل خطة هي التي يمكنك تنفيذها فعلاً.»",
    resultsEyebrow:"خطة نيلي الخاصة بك",resultsTitle:"تم تحديد العشاء.",regenerate:"إعادة الإنشاء",print:"طباعة",shoppingEyebrow:"قائمة تلقائية",shoppingTitle:"قائمة التسوق",copyList:"نسخ القائمة",footer:"خططي أقل. اطبخي أفضل. اهدري أقل.",
    loading:"نيلي تخطط لأسبوعك...",error:"تعذر إنشاء الخطة.",day:"اليوم",minutes:"دقيقة",people:"أشخاص",ingredients:"مكونات",summary:"{days} وجبات عشاء لـ {people} أشخاص",checked:"اكتمل {done} من {total}",copied:"تم نسخ القائمة.",emptyShopping:"لديك بالفعل كل ما تحتاجينه.",categoryProduce:"خضار وفواكه",categoryProtein:"بروتين",categoryDairy:"ألبان وبيض",categoryPantry:"المؤن"
  },
  ja:{
    brandSubtitle:"週間ミールプラン",home:"ホームキッチン",language:"言語",eyebrow:"一週間を美しく計画",heroTitle:"夕食の計画はNiliに。",heroText:"あなた向けの夕食、食品ロス削減、分かりやすい買い物リスト。",
    trustOne:"Niliレシピを優先",trustTwo:"家にある食材を除外",trustThree:"数秒で完成",artNote:"穏やかな一週間はここから。",
    formEyebrow:"一週間について教えてください",formTitle:"自分専用プランを作成",days:"何日分？",servings:"何人分？",
    budget:"週間予算",budgetLow:"節約",budgetMedium:"バランス",budgetFlexible:"柔軟",diet:"食事の希望",dietStandard:"制限なし",dietVegetarian:"ベジタリアン",dietVegan:"ヴィーガン",dietHalal:"ハラール",dietGlutenFree:"グルテンフリー",
    time:"最大調理時間",disliked:"苦手な食材",dislikedPlaceholder:"例：きのこ、パクチー",pantryTitle:"すでに家にある食材",pantryHint:"買い物リストから除外されます。",pantryEmpty:"ホームで食材が選択されていません。",
    submit:"献立を作成",submitHint:"承認済みレシピからNiliが選びます",previewEyebrow:"得られるもの",previewTitle:"一つの決定で、穏やかな一週間。",
    previewOneTitle:"自分向けの夕食",previewOneText:"毎日異なる承認済みレシピ。",previewTwoTitle:"賢い買い物",previewTwoText:"家にないものだけ。",previewThreeTitle:"食品ロスを削減",previewThreeText:"買う前に家にあるものを使います。",quote:"「最高の計画は、実際に作れる計画です。」",
    resultsEyebrow:"NILIの献立",resultsTitle:"夕食が決まりました。",regenerate:"再作成",print:"印刷",shoppingEyebrow:"自動リスト",shoppingTitle:"買い物リスト",copyList:"リストをコピー",footer:"計画を減らし、料理を楽しみ、無駄を減らす。",
    loading:"Niliが一週間を計画中...",error:"献立を作成できませんでした。",day:"日目",minutes:"分",people:"人分",ingredients:"食材",summary:"{people}人分の夕食を{days}日分",checked:"{total}個中{done}個完了",copied:"リストをコピーしました。",emptyShopping:"必要なものはすべて揃っています。",categoryProduce:"野菜・果物",categoryProtein:"たんぱく質",categoryDairy:"乳製品・卵",categoryPantry:"常備品"
  },
  zh:{
    brandSubtitle:"每周膳食计划",home:"返回厨房",language:"语言",eyebrow:"精心规划你的一周",heroTitle:"让Nili安排晚餐。",heroText:"个性化晚餐、更少浪费和一份清晰的购物清单。",
    trustOne:"优先Nili食谱",trustTwo:"扣除家中已有食材",trustThree:"几秒钟完成",artNote:"更轻松的一周从这里开始。",
    formEyebrow:"告诉NILI你的一周",formTitle:"创建专属计划",days:"计划几天？",servings:"几人份？",
    budget:"每周预算",budgetLow:"经济",budgetMedium:"均衡",budgetFlexible:"灵活",diet:"饮食偏好",dietStandard:"无限制",dietVegetarian:"素食",dietVegan:"纯素",dietHalal:"清真",dietGlutenFree:"无麸质",
    time:"最长烹饪时间",disliked:"不喜欢的食材",dislikedPlaceholder:"例如蘑菇、香菜",pantryTitle:"厨房里已有",pantryHint:"这些食材会从购物清单中扣除。",pantryEmpty:"尚未在首页选择食材。",
    submit:"创建我的膳食计划",submitHint:"Nili将从已审核食谱中选择",previewEyebrow:"你将获得",previewTitle:"一个决定，更轻松的一周。",
    previewOneTitle:"个性化晚餐",previewOneText:"每天一道不同的已审核食谱。",previewTwoTitle:"智能购物",previewTwoText:"只购买厨房缺少的东西。",previewThreeTitle:"减少食物浪费",previewThreeText:"购买前先使用已有食材。",quote:"“最好的计划，是你真正能做出来的计划。”",
    resultsEyebrow:"你的NILI计划",resultsTitle:"晚餐已决定。",regenerate:"重新生成",print:"打印",shoppingEyebrow:"自动清单",shoppingTitle:"购物清单",copyList:"复制清单",footer:"少计划，做好菜，少浪费。",
    loading:"Nili正在规划你的一周...",error:"无法创建计划，请重试。",day:"第",minutes:"分钟",people:"人",ingredients:"种食材",summary:"为{people}人安排{days}顿晚餐",checked:"已完成{done}/{total}",copied:"购物清单已复制。",emptyShopping:"所需食材家里都有。",categoryProduce:"蔬菜水果",categoryProtein:"蛋白质",categoryDairy:"乳制品和鸡蛋",categoryPantry:"储藏食品"
  }
};

let planLang=getSavedPlanLang();
let planState={days:5,servings:2};
let activePlan=null;
let pantryItems=[];

function getSavedPlanLang(){
  return new URLSearchParams(location.search).get("lang") ||
    localStorage.getItem("niliLang") ||
    localStorage.getItem("lang") ||
    localStorage.getItem(PLAN_LANG_KEY) ||
    "en";
}

function planCopy(key){
  return PLAN_COPY[planLang]?.[key] || PLAN_COPY.en[key] || key;
}

function escapePlanHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[char]));
}

function resolvePlanImage(value){
  const url=String(value || "").trim().replace(/\\/g,"/");
  if(!url || /\/flags\//i.test(url)) return "";
  if(/^(?:https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith("/") ? `${window.API_BASE}${url}` : url;
}

function applyPlanLanguage(){
  document.documentElement.lang=planLang;
  document.documentElement.dir=planLang==="ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-copy]").forEach(element=>{
    element.textContent=planCopy(element.dataset.copy);
  });
  document.querySelectorAll("[data-copy-placeholder]").forEach(element=>{
    element.placeholder=planCopy(element.dataset.copyPlaceholder);
  });
  document.querySelectorAll("[data-copy-option]").forEach(element=>{
    element.textContent=planCopy(element.dataset.copyOption);
  });
  const select=document.getElementById("planLanguageSelect");
  if(select) select.value=planLang;
  const flag=document.getElementById("planLanguageFlag");
  if(flag) flag.src=`/flags/${planLang}.svg`;
  const suffix=`?lang=${encodeURIComponent(planLang)}`;
  ["planHomeLink","planHomeButton","footerHomeLink"].forEach(id=>{
    const link=document.getElementById(id);
    if(link) link.href=`index.html${suffix}`;
  });
  if(activePlan) renderMealPlan(activePlan);
}

function readPantry(){
  try{
    const stored=JSON.parse(localStorage.getItem("selectedIngredients") || "[]");
    pantryItems=Array.isArray(stored) ? stored.map(String).filter(Boolean) : [];
  }catch{
    pantryItems=[];
  }
  const box=document.getElementById("mealPlanPantry");
  const empty=document.getElementById("mealPlanPantryEmpty");
  if(box) box.innerHTML=pantryItems.map(item=>`<span>${escapePlanHtml(item)}</span>`).join("");
  if(empty) empty.hidden=pantryItems.length>0;
}

function planRecipeIngredients(recipe){
  const values=Array.isArray(recipe?.ingredients) ? recipe.ingredients :
    Array.isArray(recipe?.extendedIngredients) ? recipe.extendedIngredients.map(item=>item?.original || item?.name || item) : [];
  return values.map(String).filter(Boolean);
}

function renderMealPlan(payload){
  activePlan=payload;
  localStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify(payload));
  const results=document.getElementById("mealPlanResults");
  const daysBox=document.getElementById("mealPlanDays");
  const summary=document.getElementById("mealPlanSummary");
  if(!results || !daysBox) return;

  const plan=Array.isArray(payload?.plan) ? payload.plan : [];
  if(summary){
    summary.textContent=planCopy("summary")
      .replace("{days}",String(payload.days || plan.length))
      .replace("{people}",String(payload.servings || planState.servings));
  }

  daysBox.innerHTML=plan.map(item=>{
    const recipe=item.recipe || {};
    const ingredients=planRecipeIngredients(recipe);
    const image=resolvePlanImage(recipe.mediaUrl || recipe.image || recipe.fullImage);
    const country=recipe.country || recipe.cuisine || "";
    return `
      <article class="plan-day-card">
        <div class="plan-day-image">
          ${image ? `<img src="${escapePlanHtml(image)}" alt="${escapePlanHtml(recipe.title || "")}" onerror="this.closest('.plan-day-card')?.remove()">` : ""}
          <span class="plan-day-number">${escapePlanHtml(planCopy("day"))} ${item.day}</span>
        </div>
        <div class="plan-day-copy">
          <small>${escapePlanHtml(country)}</small>
          <h3>${escapePlanHtml(recipe.title || "")}</h3>
          <p class="plan-day-ingredients">${escapePlanHtml(ingredients.slice(0,5).join(" · "))}</p>
          <div class="plan-day-meta">
            <span>◷ ${Number(recipe.readyInMinutes || 30)} ${escapePlanHtml(planCopy("minutes"))}</span>
            <span>● ${Number(recipe.servings || payload.servings || 2)} ${escapePlanHtml(planCopy("people"))}</span>
            <span>◉ ${ingredients.length} ${escapePlanHtml(planCopy("ingredients"))}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  renderShoppingList(payload.shoppingList || []);
  results.hidden=false;
  requestAnimationFrame(()=>results.scrollIntoView({behavior:"smooth",block:"start"}));
}

function shoppingCategoryLabel(category){
  return planCopy({
    produce:"categoryProduce",
    protein:"categoryProtein",
    dairy:"categoryDairy",
    pantry:"categoryPantry"
  }[category] || "categoryPantry");
}

function renderShoppingList(items){
  const list=document.getElementById("shoppingList");
  if(!list) return;
  if(!items.length){
    list.innerHTML=`<p>${escapePlanHtml(planCopy("emptyShopping"))}</p>`;
    updateShoppingProgress();
    return;
  }

  const groups=["produce","protein","dairy","pantry"];
  list.innerHTML=groups.map(category=>{
    const groupItems=items.filter(item=>(item.category || "pantry")===category);
    if(!groupItems.length) return "";
    return `
      <div class="shopping-category">${escapePlanHtml(shoppingCategoryLabel(category))}</div>
      ${groupItems.map(item=>`
        <label class="shopping-item">
          <input type="checkbox" data-shopping-id="${escapePlanHtml(item.id)}">
          <span>${escapePlanHtml(item.name)}</span>
        </label>
      `).join("")}
    `;
  }).join("");
  updateShoppingProgress();
}

function updateShoppingProgress(){
  const checks=[...document.querySelectorAll("#shoppingList input[type='checkbox']")];
  const done=checks.filter(item=>item.checked).length;
  const total=checks.length;
  const text=document.getElementById("shoppingProgressText");
  const bar=document.getElementById("shoppingProgressBar");
  if(text) text.textContent=planCopy("checked").replace("{done}",String(done)).replace("{total}",String(total));
  if(bar) bar.style.width=`${total ? (done/total)*100 : 100}%`;
}

async function createMealPlan(){
  const status=document.getElementById("mealPlanStatus");
  const submit=document.getElementById("mealPlanSubmit");
  const disliked=document.getElementById("mealPlanDisliked")?.value
    .split(/[,;\n]/).map(item=>item.trim()).filter(Boolean) || [];
  const payload={
    days:planState.days,
    servings:planState.servings,
    budget:document.getElementById("mealPlanBudget")?.value || "medium",
    diet:document.getElementById("mealPlanDiet")?.value || "standard",
    maxTime:Number(document.getElementById("mealPlanTime")?.value || 45),
    disliked,
    pantry:pantryItems,
    lang:planLang
  };

  if(status) status.textContent=planCopy("loading");
  if(submit) submit.disabled=true;
  try{
    const response=await fetch(`${window.API_BASE}/meal-plan`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await response.json();
    if(!response.ok || !data?.success) throw new Error(data?.error || "Meal plan failed");
    if(status) status.textContent="";
    renderMealPlan(data);
  }catch(error){
    console.error("MEAL PLAN ERROR:",error);
    if(status) status.textContent=planCopy("error");
  }finally{
    if(submit) submit.disabled=false;
  }
}

async function copyShoppingList(){
  const lines=[...document.querySelectorAll(".shopping-item span")].map(item=>`□ ${item.textContent.trim()}`);
  if(!lines.length) return;
  try{
    await navigator.clipboard.writeText(lines.join("\n"));
  }catch{
    const area=document.createElement("textarea");
    area.value=lines.join("\n");
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const button=document.getElementById("shoppingCopy");
  if(button){
    const original=button.textContent;
    button.textContent=planCopy("copied");
    setTimeout(()=>button.textContent=original,1800);
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  applyPlanLanguage();
  readPantry();

  document.querySelectorAll("[data-choice]").forEach(group=>{
    group.addEventListener("click",event=>{
      const button=event.target.closest("button[data-value]");
      if(!button) return;
      group.querySelectorAll("button").forEach(item=>item.classList.toggle("is-active",item===button));
      planState[group.dataset.choice]=Number(button.dataset.value);
    });
  });

  document.getElementById("mealPlanForm")?.addEventListener("submit",event=>{
    event.preventDefault();
    createMealPlan();
  });
  document.getElementById("mealPlanRegenerate")?.addEventListener("click",createMealPlan);
  document.getElementById("mealPlanPrint")?.addEventListener("click",()=>window.print());
  document.getElementById("shoppingCopy")?.addEventListener("click",copyShoppingList);
  document.getElementById("shoppingList")?.addEventListener("change",updateShoppingProgress);
  document.getElementById("planLanguageSelect")?.addEventListener("change",event=>{
    planLang=event.target.value;
    localStorage.setItem("niliLang",planLang);
    localStorage.setItem("lang",planLang);
    localStorage.setItem(PLAN_LANG_KEY,planLang);
    history.replaceState(null,"",`${location.pathname}?lang=${encodeURIComponent(planLang)}`);
    applyPlanLanguage();
  });

  try{
    const saved=JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || "null");
    if(saved?.success && Array.isArray(saved.plan) && saved.plan.length){
      activePlan=saved;
    }
  }catch{
    activePlan=null;
  }
});
