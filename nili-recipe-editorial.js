(function () {
  "use strict";

  const state = { data: null };
  const palette = {
    paper: "#fff7e8",
    cream: "#f6e6ca",
    forest: "#124c37",
    deep: "#073c2b",
    orange: "#ef6d3f",
    red: "#c62f2f",
    gold: "#e4ac3f",
    ink: "#31271e",
    muted: "#6a6258"
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function labels(lang) {
    const copy = {
      en:{ingredients:"Ingredients",instructions:"How to make it",prep:"Total time",servings:"Servings",items:"ingredients",download:"Download full recipe",instagram:"Instagram image",share:"Share",tip:"Nili's tip",tipText:"Read every step first, prepare the measured ingredients, and serve the dish while its texture is at its best."},
      tr:{ingredients:"Malzemeler",instructions:"Nasıl yapılır?",prep:"Toplam süre",servings:"Porsiyon",items:"malzeme",download:"Tam tarifi indir",instagram:"Instagram görseli",share:"Paylaş",tip:"Nili'nin püf noktası",tipText:"Önce tüm adımları okuyun, ölçülü malzemeleri hazırlayın ve yemeği dokusu en güzel halindeyken servis edin."},
      de:{ingredients:"Zutaten",instructions:"Zubereitung",prep:"Gesamtzeit",servings:"Portionen",items:"Zutaten",download:"Ganzes Rezept laden",instagram:"Instagram-Bild",share:"Teilen",tip:"Nili's Tipp",tipText:"Lesen Sie zuerst alle Schritte und bereiten Sie die abgemessenen Zutaten vor."},
      fr:{ingredients:"Ingrédients",instructions:"Préparation",prep:"Temps total",servings:"Portions",items:"ingrédients",download:"Télécharger la recette",instagram:"Image Instagram",share:"Partager",tip:"L'astuce de Nili",tipText:"Lisez toutes les étapes et préparez les ingrédients mesurés avant de commencer."},
      es:{ingredients:"Ingredientes",instructions:"Preparación",prep:"Tiempo total",servings:"Porciones",items:"ingredientes",download:"Descargar receta",instagram:"Imagen de Instagram",share:"Compartir",tip:"Consejo de Nili",tipText:"Lee todos los pasos y prepara los ingredientes medidos antes de empezar."},
      pt:{ingredients:"Ingredientes",instructions:"Modo de preparo",prep:"Tempo total",servings:"Porções",items:"ingredientes",download:"Baixar receita",instagram:"Imagem Instagram",share:"Compartilhar",tip:"Dica da Nili",tipText:"Leia todas as etapas e prepare os ingredientes medidos antes de começar."},
      ru:{ingredients:"Ингредиенты",instructions:"Приготовление",prep:"Общее время",servings:"Порции",items:"ингредиентов",download:"Скачать рецепт",instagram:"Для Instagram",share:"Поделиться",tip:"Совет Нили",tipText:"Сначала прочитайте все шаги и подготовьте отмеренные ингредиенты."},
      ar:{ingredients:"المكونات",instructions:"طريقة التحضير",prep:"الوقت الإجمالي",servings:"الحصص",items:"مكونات",download:"تنزيل الوصفة",instagram:"صورة إنستغرام",share:"مشاركة",tip:"نصيحة نيلي",tipText:"اقرأ جميع الخطوات أولاً وجهز المكونات بالمقادير قبل البدء."},
      ja:{ingredients:"材料",instructions:"作り方",prep:"合計時間",servings:"人分",items:"材料",download:"レシピを保存",instagram:"Instagram画像",share:"共有",tip:"Niliのコツ",tipText:"最初に全手順を読み、計量した材料を準備してください。"},
      zh:{ingredients:"食材",instructions:"制作方法",prep:"总时间",servings:"份量",items:"种食材",download:"下载完整食谱",instagram:"Instagram 图片",share:"分享",tip:"Nili 小贴士",tipText:"先阅读全部步骤，并准备好称量过的食材。"}
    };
    return copy[lang] || copy.en;
  }

  function normalizeData(input) {
    const lang = String(input.lang || "en").toLowerCase();
    return {
      ...input,
      lang,
      labels: { ...labels(lang), ...(input.labels || {}) },
      title: String(input.title || "Recipe"),
      cuisine: String(input.cuisine || "World cuisine"),
      imageUrl: String(input.imageUrl || ""),
      flagUrl: String(input.flagUrl || ""),
      ingredients: (input.ingredients || []).map(String).filter(Boolean),
      steps: (input.steps || []).map(String).filter(Boolean),
      time: String(input.time || "-"),
      servings: String(input.servings || "-"),
      backLabel: String(input.backLabel || "Back"),
      homeLabel: String(input.homeLabel || "Home")
    };
  }

  function ingredientIcon(value) {
    const text = String(value || "").toLocaleLowerCase("en");
    const groups = [
      [/beef|veal|lamb|mutton|meat|steak|kıyma|et\b|dana|kuzu/, "🥩"],
      [/chicken|turkey|duck|tavuk|hindi|ördek/, "🍗"],
      [/fish|salmon|tuna|shrimp|prawn|seafood|balık|somon|karides/, "🐟"],
      [/egg|yumurta/, "🥚"], [/milk|cream|yogurt|yoghurt|süt|krema|yoğurt/, "🥛"],
      [/cheese|parmesan|mozzarella|peynir/, "🧀"], [/apple|elma/, "🍎"],
      [/lemon|lime|limon/, "🍋"], [/tomato|domates/, "🍅"], [/potato|patates/, "🥔"],
      [/onion|garlic|soğan|sarımsak/, "🧅"], [/carrot|havuç/, "🥕"],
      [/pepper|chili|biber/, "🌶️"],
      [/broccoli|spinach|cabbage|lettuce|vegetable|ıspanak|lahana|sebze/, "🥦"],
      [/herb|parsley|basil|mint|dill|maydanoz|fesleğen|nane|dereotu/, "🌿"],
      [/rice|pirinç/, "🍚"], [/pasta|noodle|makarna|erişte/, "🍝"],
      [/bread|flour|dough|un|ekmek|hamur/, "🍞"],
      [/sugar|honey|syrup|şeker|bal|şurup/, "🍯"], [/oil|butter|yağ|tereyağı/, "🫒"],
      [/salt|spice|cinnamon|cumin|tuz|baharat|tarçın|kimyon/, "🧂"]
    ];
    return groups.find(([pattern]) => pattern.test(text))?.[1] || "🥄";
  }

  async function refreshAdminTools() {
    const tools = document.querySelector(".editorial-toolbar-export");
    if (!tools) return;
    const token = sessionStorage.getItem("niliAdminSession") || "";
    if (!token) return;
    try {
      const response = await fetch("/admin/session", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (response.ok) tools.hidden = false;
    } catch (_) {
      tools.hidden = true;
    }
  }

  function render(input) {
    const data = normalizeData(input);
    state.data = data;
    const ingredientHtml = data.ingredients.map(item => `
      <li><span class="editorial-ingredient-mark" aria-hidden="true">${ingredientIcon(item)}</span><span>${esc(item)}</span></li>`).join("");
    const stepsHtml = data.steps.map((step, index) => `
      <li><span class="editorial-step-number">${index + 1}</span><span>${esc(step)}</span></li>`).join("");
    const direction = data.lang === "ar" ? "rtl" : "ltr";

    const html = `
      <article class="editorial-recipe-page" dir="${direction}">
        <nav class="editorial-recipe-toolbar" aria-label="Recipe actions">
          <div class="editorial-toolbar-nav">
            <button type="button" onclick="${input.backAction || "closeModal()"}">← ${esc(data.backLabel)}</button>
            <button type="button" onclick="${input.homeAction || "closeRecipeToHome()"}">${esc(data.homeLabel)} ⌂</button>
          </div>
          <div class="editorial-toolbar-export" hidden>
            <button type="button" onclick="NiliRecipeEditorial.download('full')">⇩ ${esc(data.labels.download)}</button>
            <button type="button" onclick="NiliRecipeEditorial.download('instagram')">▣ ${esc(data.labels.instagram)}</button>
            <button type="button" class="is-accent" onclick="NiliRecipeEditorial.share()">↗ ${esc(data.labels.share)}</button>
          </div>
        </nav>

        <div class="editorial-recipe-sheet editorial-poster-v2 editorial-reference-poster">
          <img class="editorial-poster-logo" src="/logo.jpeg" alt="Nili's Kitchen">
          <section class="editorial-recipe-grid">
            <div class="editorial-poster-left">
              <header class="editorial-recipe-title">
                <p>${esc(input.brand || "NILI'S KITCHEN")}</p>
                <h1>${esc(data.title)}</h1>
                <div class="editorial-origin-badge">
                  ${data.flagUrl ? `<img src="${esc(data.flagUrl)}" alt="">` : ""}
                  <span>${esc(data.cuisine)}</span>
                </div>
              </header>

              <aside class="editorial-ingredients-card">
              <div class="editorial-section-heading">
                <span>INGREDIENTS</span>
                <h2>${esc(data.labels.ingredients)}</h2>
                <small>${data.ingredients.length} ${esc(data.labels.items)}</small>
              </div>
              <ol>${ingredientHtml}</ol>
              </aside>
            </div>

            <div class="editorial-recipe-feature">
              <figure class="editorial-food-photo">
                <img src="${esc(data.imageUrl)}" alt="${esc(data.title)}" crossorigin="anonymous">
                <figcaption>${esc(data.title)}</figcaption>
              </figure>

              <div class="editorial-recipe-lower">
                <section class="editorial-instructions-card">
                  <div class="editorial-section-heading editorial-how-heading">
                    <span>STEP BY STEP</span>
                    <h2>${esc(data.labels.instructions)}</h2>
                  </div>
                  <ol>${stepsHtml}</ol>
                </section>

                <aside class="editorial-recipe-facts">
                  <div class="editorial-fact-strip">
                    <div><span class="editorial-fact-icon">⏱️</span><small>${esc(data.labels.prep)}</small><strong>${esc(data.time)}</strong></div>
                    <div><span class="editorial-fact-icon">👩‍🍳</span><small>${esc(data.labels.servings)}</small><strong>${esc(data.servings)}</strong></div>
                  </div>
                  <div class="editorial-nili-portrait"><img src="/nili-chef-mascot-v2.png?v=1" alt="Nili"></div>
                </aside>
              </div>
            </div>
          </section>

          <div class="editorial-poster-bottom">
            <div class="editorial-tip"><small>💡 ${esc(data.labels.tip)}</small><p>${esc(data.labels.tipText)}</p></div>
            <div class="editorial-poster-more"><span>More delicious recipes</span><strong>Nili’s Kitchen ♡</strong></div>
          </div>

          <footer class="editorial-recipe-brand">
            <span>Nili's Kitchen</span>
            <strong>Cook beautifully. Share deliciously.</strong>
          </footer>
        </div>
      </article>`;
    setTimeout(refreshAdminTools, 0);
    return html;
  }

  function slug(value) {
    return String(value || "recipe").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "recipe";
  }

  function wrap(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function rounded(ctx, x, y, width, height, radius, fill, stroke) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  async function loadImage(url) {
    if (!url) return null;
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = () => resolve(null);
        retry.src = url;
      };
      image.src = url;
    });
  }

  function drawCover(ctx, image, x, y, width, height) {
    if (!image) {
      ctx.fillStyle = palette.cream;
      ctx.fillRect(x, y, width, height);
      return;
    }
    const scale = Math.max(width / image.width, height / image.height);
    const sw = width / scale;
    const sh = height / scale;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  async function makeCanvas(mode) {
    const data = state.data;
    if (!data) throw new Error("Recipe is not open");
    const width = 1080;
    const instagram = mode === "instagram";
    const ingredientRows = data.ingredients.map(item => ({ text:item, lines:Math.max(1, Math.ceil(item.length / 34)) }));
    const stepRows = data.steps.map(item => ({ text:item, lines:Math.max(1, Math.ceil(item.length / 68)) }));
    const fullHeight = 400 + Math.max(600, ingredientRows.reduce((sum,row)=>sum + 30 + row.lines * 23, 0)) +
      Math.max(470, stepRows.reduce((sum,row)=>sum + 38 + row.lines * 24, 0));
    const height = instagram ? 1350 : Math.min(6000, Math.max(1650, fullHeight));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(228,172,63,.12)";
    for (let i = 0; i < 150; i += 1) ctx.fillRect((i * 97) % width, (i * 181) % height, 2, 2);

    const image = await loadImage(data.imageUrl);
    const margin = 46;
    const left = instagram ? 46 : 48;
    const leftWidth = instagram ? 300 : 330;
    const rightX = left + leftWidth + 30;
    const rightWidth = width - rightX - margin;

    ctx.fillStyle = palette.red;
    ctx.font = "italic 700 31px Georgia";
    ctx.fillText(data.cuisine, margin, 58);
    ctx.fillStyle = palette.ink;
    ctx.font = `700 ${instagram ? 58 : 68}px Georgia`;
    const titleLines = wrap(ctx, data.title, width - margin * 2);
    titleLines.slice(0, instagram ? 2 : 3).forEach((line,index)=>ctx.fillText(line, margin, 126 + index * (instagram ? 58 : 68)));
    const titleBottom = 145 + Math.min(titleLines.length, instagram ? 2 : 3) * (instagram ? 58 : 68);

    const photoY = instagram ? titleBottom + 5 : titleBottom + 10;
    const photoHeight = instagram ? 430 : 500;
    rounded(ctx, rightX, photoY, rightWidth, photoHeight, 24, palette.cream, palette.gold);
    ctx.save(); ctx.beginPath(); ctx.roundRect(rightX, photoY, rightWidth, photoHeight, 24); ctx.clip();
    drawCover(ctx, image, rightX, photoY, rightWidth, photoHeight); ctx.restore();

    rounded(ctx, left, photoY, leftWidth, instagram ? 630 : Math.max(700, height - photoY - 105), 24, "#fffaf0", palette.orange);
    ctx.fillStyle = palette.red; ctx.font = "700 30px Georgia";
    ctx.fillText(data.labels.ingredients, left + 24, photoY + 46);
    ctx.font = "500 17px Arial"; ctx.fillStyle = palette.muted;
    let iy = photoY + 78;
    const ingredientLimit = instagram ? photoY + 610 : height - 140;
    for (let index = 0; index < data.ingredients.length && iy < ingredientLimit; index += 1) {
      const lines = wrap(ctx, data.ingredients[index], leftWidth - 66);
      ctx.fillStyle = palette.orange; ctx.beginPath(); ctx.arc(left + 28, iy - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = palette.ink;
      lines.forEach((line,lineIndex)=>ctx.fillText(line, left + 46, iy + lineIndex * 21));
      iy += 24 + (lines.length - 1) * 21;
      ctx.strokeStyle = "rgba(228,172,63,.32)"; ctx.beginPath(); ctx.moveTo(left + 45, iy - 9); ctx.lineTo(left + leftWidth - 20, iy - 9); ctx.stroke();
    }

    const lowerY = photoY + photoHeight + 35;
    ctx.fillStyle = palette.red; ctx.font = "italic 700 34px Georgia";
    ctx.fillText(data.labels.instructions, rightX, lowerY);
    ctx.font = "500 17px Arial";
    let sy = lowerY + 42;
    const stepLimit = instagram ? height - 170 : height - 150;
    for (let index = 0; index < data.steps.length && sy < stepLimit; index += 1) {
      const lines = wrap(ctx, data.steps[index], rightWidth - 60);
      ctx.fillStyle = palette.red; ctx.beginPath(); ctx.arc(rightX + 12, sy - 5, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 13px Arial"; ctx.textAlign = "center"; ctx.fillText(String(index + 1), rightX + 12, sy); ctx.textAlign = "left";
      ctx.fillStyle = palette.ink; ctx.font = "500 17px Arial";
      lines.forEach((line,lineIndex)=>ctx.fillText(line, rightX + 35, sy + lineIndex * 22));
      sy += 30 + (lines.length - 1) * 22;
    }

    rounded(ctx, rightX, Math.min(height - 128, sy + 18), rightWidth, 76, 18, palette.forest, palette.gold);
    ctx.fillStyle = "#fff"; ctx.font = "700 17px Arial";
    ctx.fillText(`◷ ${data.labels.prep}: ${data.time}`, rightX + 22, Math.min(height - 82, sy + 62));
    ctx.fillText(`♙ ${data.labels.servings}: ${data.servings}`, rightX + rightWidth / 2, Math.min(height - 82, sy + 62));

    ctx.fillStyle = palette.forest; ctx.font = "700 23px Georgia";
    ctx.fillText("Nili's Kitchen", margin, height - 42);
    ctx.fillStyle = palette.orange; ctx.font = "600 14px Arial";
    ctx.fillText("Cook beautifully. Share deliciously.", width - 300, height - 42);
    return canvas;
  }

  async function blobFor(mode) {
    const canvas = await makeCanvas(mode);
    return new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
  }

  async function download(mode = "full") {
    const blob = await blobFor(mode);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(state.data?.title)}-${mode === "instagram" ? "instagram" : "full-recipe"}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function share() {
    const blob = await blobFor("instagram");
    if (!blob) return;
    const file = new File([blob], `${slug(state.data?.title)}-nilis-kitchen.png`, { type:"image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
      try {
        await navigator.share({ title:state.data?.title || "Nili's Kitchen", text:state.data?.title || "Recipe", files:[file] });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await download("instagram");
  }

  window.NiliRecipeEditorial = { render, download, share, makeCanvas };
})();
