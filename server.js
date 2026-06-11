import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BONUS_PER_CLICK = Number(process.env.BONUS_PER_CLICK || 0.01);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://niliskitchen.com",
    "https://www.niliskitchen.com"
  ],
  credentials: true
}));

app.use(express.static(__dirname));

app.use(
  "/flags",
  express.static(path.join(__dirname, "flags"))
);

app.use(
  "/creator-uploads",
  express.static(path.join(__dirname, "creator-uploads"))
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const upload = multer({
  dest: "uploads/"
});

console.log(process.env.SPOON_KEY);

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendMailSafe({ to, subject, html, text }) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
      console.log("MAIL SKIPPED:", subject);
      return;
    }

    await mailer.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });

    console.log("MAIL SENT:", subject, to);
  } catch (err) {
    console.log("MAIL ERROR:", err.message);
  }
}
 
/* TRANSLATE */

async function translateText(
  text,
  lang
){

  if(
    !text ||
    lang === "en"
  ){

    return text;

  }

  try{

    const gpt =
    await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",

          content:`

Translate recipe content.

Keep food names natural.

Return ONLY translated text.

`

        },

        {
          role:"user",

          content:`

Language:
${lang}

Text:
${text}

`

        }

      ]

    });

    return gpt
    .choices[0]
    .message.content;

  }catch(e){

    console.log(e);

    return text;

  }

}

app.post("/translate-ingredients", async (req, res) => {

  try{

    const { items, lang } = req.body;

    if(!Array.isArray(items) || !lang){
      return res.status(400).json({
        error:"Missing items or lang"
      });
    }

    if(lang === "en"){
      return res.json({ items });
    }

    const translatedItems = [];

    for(const item of items){
      const translated =
      await translateText(item, lang);

      translatedItems.push(
        String(translated).trim()
      );
    }

    return res.json({
      items: translatedItems
    });

  }catch(err){

    console.log("TRANSLATE INGREDIENTS ERROR:", err.message);

    return res.status(500).json({
      error:"Ingredient translation failed"
    });

  }

});



/* ANALYZE */

app.post(
  "/analyze",
  upload.single("photo"),
  async (req, res) => {

    let uploadedPath = null;

    try {

      console.log("1 - ANALYZE START");

      if (!req.file) {

        return res.status(400).json({
          error: "No photo"
        });

      }

      uploadedPath = req.file.path;

      console.log("2 - FILE RECEIVED:", req.file.originalname);
      console.log("3 - MIME:", req.file.mimetype);

      const imageBase64 =
      fs.readFileSync(
        req.file.path,
        {
          encoding: "base64"
        }
      );

      console.log("4 - IMAGE CONVERTED BASE64");

      const openai =
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      console.log("5 - OPENAI REQUEST START");

      const response =
      await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content:
              "Return ONLY a valid JSON array of ingredient names. Example: [\"tomato\",\"onion\",\"cheese\"]"
            },

            {
              role: "user",

              content: [

                {
                  type: "text",
                  text: "Detect visible food ingredients in this image."
                },

                {
                  type: "image_url",
                  image_url: {
                    url:
                    `data:${req.file.mimetype};base64,${imageBase64}`
                  }
                }

              ]

            }

          ]

        },
        {
          timeout: 20000
        }
      );

      console.log("6 - OPENAI ANSWER RECEIVED");

      const text =
      response
      .choices[0]
      .message
      .content;

      console.log("AI RAW:", text);

      let ingredients =
      [];

      try {

        ingredients =
        JSON.parse(text);

      } catch {

        ingredients =
        text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/\[/g, "")
        .replace(/\]/g, "")
        .replace(/"/g, "")
        .replace(/'/g, "")
        .replace(/[“”]/g, "")
        .replace(/[‘’]/g, "")
        .replace(/\n/g, "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);

      }

      ingredients =
      ingredients
      .map(x =>
        String(x)
        .replace(/[^\w\s-]/g, "")
        .trim()
      )
      .filter(Boolean);

      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }

      console.log("7 - ANALYZE DONE:", ingredients);

      return res.json({
        ingredients
      });

    } catch (err) {

      console.log("ANALYZE ERROR:", err.message);

      if (uploadedPath && fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }

      return res.status(500).json({
        error: "Analyze failed",
        details: err.message
      });

    }

  }
);

/* NORMALIZE INGREDIENT */

app.post(
  "/normalize-ingredient",
  async (req, res) => {

    try {

      const input =
      req.body.ingredient;

      if(!input){
        return res.json({
          ingredient: ""
        });
      }

      const openai =
      new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content:
            `
You normalize food ingredient names.

Rules:
- Return only ONE ingredient name.
- Return in English.
- Fix typos.
- Translate if needed.
- Remove quantity words.
- Remove unnecessary adjectives unless important.
- Do not return sentences.
- Do not add explanations.

Examples:
domates -> tomato
tavuk gogsu -> chicken breast
kaşar peyniri -> cheese
kirmizi biber -> red pepper
zeytin yag -> olive oil
2 adet yumurta -> egg
biraz tuz -> salt
`
          },
          {
            role: "user",
            content: String(input)
          }
        ]
      });

      const ingredient =
      response
      .choices[0]
      .message
      .content
      .trim()
      .toLowerCase();

      return res.json({
        ingredient
      });

    } catch (err) {

      console.log("NORMALIZE ERROR:", err.message);

      return res.status(500).json({
        error: "Normalize failed",
        details: err.message
      });

    }

  }
);

 /* RECIPES */

 const useSpoonacular =
process.env.USE_SPOONACULAR === "true";

const useEdamam =
process.env.USE_EDAMAM === "true";

const useTheMealDB =
process.env.USE_THEMEALDB === "true";

app.post(
  
  "/recipes",
  async (req, res) => {

    try {

      const ingredients =
      req.body.ingredients || [];

      const offset =
Number(req.body.offset || 0);

const limit =
8;

const targetCount =
offset + limit + 1;

      if (!ingredients.length) {
        return res.json([]);
      }

      const query =
      ingredients.join(",");

      let allRecipes =
      [];

      /*
        1. SPOONACULAR
      */

      if (
  useSpoonacular &&
  allRecipes.length < targetCount
) {  

      try {

        const spoonRes =
        await fetch(
`https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(query)}&number=6&apiKey=${process.env.SPOON_KEY}`
        );

console.log("SPOON STATUS:", spoonRes.status);

        const basicRecipes =
        await spoonRes.json();

        console.log("SPOON RAW:", basicRecipes);

        if (
          Array.isArray(basicRecipes) &&
          basicRecipes.length > 0 &&
          basicRecipes.status !== "failure"
        ) {

          console.log("SOURCE: SPOONACULAR");

          const spoonRecipes =
          await Promise.all(

            basicRecipes
            .slice(0, 12)
            .map(async recipe => {

              try {

                const detailRes =
                await fetch(
`https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${process.env.SPOON_KEY}`
                );

                const detail =
                await detailRes.json();

                return {
                  id: recipe.id,
                  source: "spoonacular",
                  title: recipe.title || "Recipe",
                  image: recipe.image || "",
                  readyInMinutes: detail.readyInMinutes || 30,
                  usedIngredients: recipe.usedIngredients || [],
                  instructions:
                    detail.instructions ||
                    detail.summary ||
                    "No instructions"
                };

              } catch {

                return {
                  id: recipe.id,
                  source: "spoonacular",
                  title: recipe.title || "Recipe",
                  image: recipe.image || "",
                  readyInMinutes: 30,
                  usedIngredients: recipe.usedIngredients || [],
                  instructions: "No instructions"
                };

              }

            })

          );

          allRecipes.push(...spoonRecipes);

        }

      } catch (e) {

        console.log("SPOONACULAR FAILED:", e.message);

      }

      } else {
  console.log("SPOONACULAR DISABLED");
}


      /*
        2. EDAMAM
      */

       if (
  useEdamam &&
  allRecipes.length < targetCount
) { 

      try {

        if (
          process.env.EDAMAM_APP_ID &&
          process.env.EDAMAM_APP_KEY
        ) {

const edamamQueries = [
  ingredients.slice(0, 3).join(" "),
  ingredients[0],
  ingredients[1],
  ingredients[2],
  "chicken",
  "pasta",
  "salad"
].filter(Boolean);

let edamamData = null;

for (const edamamQuery of edamamQueries) {

  console.log("EDAMAM QUERY:", edamamQuery);

  const edamamUrl =
`https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(edamamQuery)}&app_id=${process.env.EDAMAM_APP_ID}&app_key=${process.env.EDAMAM_APP_KEY}`;

const edamamRes =
await fetch(
  edamamUrl,
  {
    method: "GET"
  }
);

console.log("EDAMAM STATUS:", edamamRes.status);

const testData =
await edamamRes.json();
console.log("EDAMAM COUNT:", testData.count);

  if (
    testData.hits &&
    Array.isArray(testData.hits) &&
    testData.hits.length > 0
  ) {
    edamamData = testData;
    break;
  }

}

          if (
  edamamData &&
  edamamData.hits &&
  Array.isArray(edamamData.hits) &&
  edamamData.hits.length > 0
) {

            console.log("SOURCE: EDAMAM");

            const edamamRecipes =
            edamamData.hits
            slice(0, 12)
            .map(item => {

              const recipe =
              item.recipe;

              return {
                id: encodeURIComponent(recipe.uri),
                source: "edamam",
                title: recipe.label || "Recipe",
                image: recipe.image || "",
                readyInMinutes:
                  recipe.totalTime && recipe.totalTime > 0
                    ? recipe.totalTime
                    : 30,
                usedIngredients:
                  recipe.ingredients || [],
                instructions:
                  recipe.url ||
                  "Open recipe source for instructions."
              };

            });

            allRecipes.push(...edamamRecipes);

          } else {
  console.log("EDAMAM FOUND 0 RECIPES");
}

        } else {

          console.log("EDAMAM KEYS MISSING");

        }

      } catch (e) {

        console.log("EDAMAM FAILED:", e.message);

      }

      } else {
  console.log("EDAMAM DISABLED");
}


      /*
        3. THEMEALDB
      */

        if (
  useTheMealDB &&
  allRecipes.length < targetCount
) {

      try {

        const validIngredients =
        ingredients.filter(x =>
          !x.toLowerCase().includes("apple") &&
          !x.toLowerCase().includes("banana") &&
          !x.toLowerCase().includes("orange") &&
          !x.toLowerCase().includes("bell pepper")
        );

        const mealIngredient =
        validIngredients[0] || ingredients[0];

        console.log("THEMEAL INGREDIENT:", mealIngredient);

        const mealRes =
        await fetch(
`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(mealIngredient)}`
        );

        const mealData =
        await mealRes.json();

        if (
          mealData.meals &&
          Array.isArray(mealData.meals) &&
          mealData.meals.length > 0
        ) {

          console.log("SOURCE: THEMEALDB");

          const mealRecipes =
          await Promise.all(

            mealData.meals
            .slice(0, 12)
            .map(async meal => {

  const detailRes =
  await fetch(
`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
  );

  const detailData =
  await detailRes.json();

  const detail =
  detailData.meals[0];

  let estimatedTime = null;

const instructionText =
  detail.strInstructions || "";

const stepCount =
  instructionText
    .split(".")
    .filter(x => x.trim().length > 20)
    .length;

if(stepCount <= 4){
  estimatedTime = 20;
}else if(stepCount <= 7){
  estimatedTime = 30;
}else if(stepCount <= 10){
  estimatedTime = 45;
}else{
  estimatedTime = 60;
}

  const usedIngredients = [];

  for(let i = 1; i <= 20; i++){

    const ing = detail[`strIngredient${i}`];
    const measure = detail[`strMeasure${i}`];

    if(ing && ing.trim()){
      usedIngredients.push({
        name: ing.trim(),
        original: `${measure || ""} ${ing}`.trim()
      });
    }

  }

return {
  id: detail.idMeal,
  source: "themealdb",
  title: detail.strMeal,
  image: detail.strMealThumb,
  readyInMinutes: estimatedTime,
timeEstimated: true,
timeLabel: `~${estimatedTime} min`,
  usedIngredients: usedIngredients,
  instructions:
    detail.strInstructions?.trim() ||
    "Recipe instructions unavailable."
};

})

          );

          allRecipes.push(...mealRecipes);

        } else {

          console.log("THEMEALDB FOUND 0 RECIPES");

        }

      } catch (e) {

        console.log("THEMEALDB FAILED:", e.message);

      }

      } else {
  console.log("THEMEALDB DISABLED");
}


      console.log("TOTAL RECIPES:", allRecipes.length);

/* NILI APPROVED CREATOR RECIPES */

const approvedCreatorRecipes =
findApprovedRecipesByIngredients(ingredients);

const approvedCreatorCards =
approvedCreatorRecipes.map(recipe => ({
  id: recipe.id,
  source: "nili_creator",

  title:
    recipe.adminTitleTr ||
    recipe.title ||
    "Creator Recipe",

  image:
    recipe.mediaUrl ||
    (
      recipe.mediaFile
        ? "/creator-uploads/" + recipe.mediaFile
        : ""
    ),

  readyInMinutes:
    recipe.prepTime || 30,

  servings:
    recipe.servings || "",

  usedIngredients:
    recipe.matchedIngredients || [],

  instructions:
    recipe.adminInstructionsTr ||
    recipe.instructions ||
    "Recipe instructions unavailable.",

  ingredientsText:
    recipe.adminIngredientsTr ||
    recipe.ingredients ||
    "",

  creatorUsername:
    recipe.creatorUsername || "",

  clicks:
    recipe.clicks || 0,

  totalBonus:
    recipe.totalBonus || 0
}));

console.log("NILI APPROVED RECIPES:", approvedCreatorCards.length);

const finalRecipes =
[
  ...approvedCreatorCards,
  ...allRecipes
].slice(offset, offset + limit);

const lang =
req.body.lang || "en";

console.log("RECIPE TRANSLATE LANG:", lang);

if(lang !== "en"){

  for(const recipe of finalRecipes){

    recipe.title =
    await translateText(recipe.title, lang);

    recipe.instructions =
    await translateText(recipe.instructions, lang);

    if(Array.isArray(recipe.usedIngredients)){

      for(const ing of recipe.usedIngredients){

        if(ing.name){
          ing.name =
          await translateText(ing.name, lang);
        }

        if(ing.original){
          ing.original =
          await translateText(ing.original, lang);
        }

      }

    }

  }

}

return res.json(finalRecipes);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error: "Recipes failed"
      });

    }

});

/* DETAIL */

app.get(
  "/spoon-recipe/:id",
  async (req,res)=>{

    try{

      const id =
      req.params.id;

      const lang =
      req.query.lang || "en";

      const spoonKey =
      process.env.SPOON_KEY;

      const url =

`https://api.spoonacular.com/recipes/${id}/information?apiKey=${spoonKey}`;

      const r =
      await fetch(url);

      const d =
      await r.json();

      const translatedTitle =
      await translateText(
        d.title,
        lang
      );

      const translatedInstructions =
      await translateText(
        d.instructions ||
        "No instructions",
        lang
      );

      let translatedIngredients =
      [];

      for(
        const i of
        d.extendedIngredients || []
      ){

        const t =
        await translateText(
          i.original,
          lang
        );

        translatedIngredients
        .push(t);

      }

      res.json({

        title:
        translatedTitle,

        image:
        d.image,

        instructions:
        translatedInstructions,

        ingredients:
        translatedIngredients

      });

    }catch(e){

      console.log(e);

      res.json({
        error:true
      });

    }

});

/* START */

const PORT =
process.env.PORT || 3000;

const creatorUploadDir =
path.join(__dirname, "creator-uploads");

const pendingRecipesDir =
path.join(__dirname, "pending-recipes");

if(!fs.existsSync(creatorUploadDir)){
  fs.mkdirSync(creatorUploadDir);
}

if(!fs.existsSync(pendingRecipesDir)){
  fs.mkdirSync(pendingRecipesDir);
}

const creatorStorage =
multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, creatorUploadDir);
  },

  filename: (req, file, cb) => {
    const safeName =
    Date.now() + "-" + file.originalname.replace(/\s+/g, "-");

    cb(null, safeName);
  }
});

const creatorUpload =
multer({
  storage: creatorStorage,
  limits:{
    fileSize: 80 * 1024 * 1024
  }
});

async function translateRecipeToTurkish({ title, ingredients, instructions }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        titleTr: title,
        ingredientsTr: ingredients,
        instructionsTr: instructions
      };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You translate recipe content to Turkish for admin review. Return only valid JSON. Do not add extra text."
        },
        {
          role: "user",
          content: JSON.stringify({
            title,
            ingredients,
            instructions,
            task:
              "Translate this recipe to clear Turkish. Keep recipe meaning. Return JSON with titleTr, ingredientsTr, instructionsTr."
          })
        }
      ],
      temperature: 0.2
    });

    let content =
      response.choices[0].message.content || "";

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(content);

    return {
      titleTr: parsed.titleTr || title,
      ingredientsTr: parsed.ingredientsTr || ingredients,
      instructionsTr: parsed.instructionsTr || instructions
    };
  } catch (err) {
    console.log("TRANSLATE RECIPE ERROR:", err.message);

    return {
      titleTr: title,
      ingredientsTr: ingredients,
      instructionsTr: instructions
    };
  }
}

app.post(
  "/submit-recipe",
  creatorUpload.single("media"),
  async (req, res) => {

    try{

      const {
        creatorUsername,
        creatorEmail,
        title,
        prepTime,
        servings,
        ingredients,
        instructions
      } = req.body;

      if(
        !title ||
        !ingredients ||
        !instructions ||
        !req.file
      ){
        return res.status(400).json({
          error:"Missing required fields"
        });
      }

      const translated =
await translateRecipeToTurkish({
  title,
  ingredients,
  instructions
});

const recipe =
{
  id: Date.now().toString(),

  creatorUsername: creatorUsername || "Guest creator",
  creatorEmail: creatorEmail || "",

  title,
  ingredients,
  instructions,

  adminTitleTr: translated.titleTr,
  adminIngredientsTr: translated.ingredientsTr,
  adminInstructionsTr: translated.instructionsTr,

  prepTime: prepTime || "",
  servings: servings || "",

  mediaFile: req.file.filename,
  mediaUrl: "/creator-uploads/" + req.file.filename,
  mediaType: req.file.mimetype,

  status: "pending_review",

  views: 0,
  clicks: 0,

  createdAt: new Date().toISOString()
};

      const pendingFile =
      path.join(
        pendingRecipesDir,
        "pending_recipes.json"
      );

      let recipes =
      [];

      if(fs.existsSync(pendingFile)){
        recipes =
        JSON.parse(
          fs.readFileSync(pendingFile, "utf8")
        );
      }

      recipes.push(recipe);

      fs.writeFileSync(
  pendingFile,
  JSON.stringify(recipes, null, 2)
);

console.log("NEW CREATOR RECIPE:", recipe.title);

/* USER EMAIL: recipe received */
await sendMailSafe({
  to: creatorEmail,
  subject: "Your recipe has been received",
  text: `Your recipe "${title}" has been received and is now under review.`,
  html: `
    <h2>Your recipe has been received</h2>
    <p>Thank you for submitting your recipe.</p>
    <p><strong>${title}</strong></p>
    <p>Your recipe is now under review. If approved, it may be published on Nili's Kitchen with your creator name.</p>
  `
});

/* ADMIN EMAIL: new recipe submitted */
const adminUrl = `${process.env.SITE_URL || "https://niliskitchen.com"}/admin.html`;

await sendMailSafe({
  to: process.env.ADMIN_EMAIL,
  subject: "New recipe submitted for review",
  text: `New recipe submitted: ${title}\nOpen admin panel: ${adminUrl}`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:620px">
      <h2>New recipe submitted</h2>

      <div style="border:1px solid #e5e5e5;border-radius:16px;padding:16px;margin:16px 0">
        <h3 style="margin-top:0">${title}</h3>
        <p><strong>Creator:</strong> ${creatorUsername}</p>
        <p><strong>Email:</strong> ${creatorEmail}</p>
        <p><strong>Status:</strong> pending review</p>
      </div>

      <a href="${adminUrl}"
         style="display:inline-block;background:#1f7a4d;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">
        Open in Admin Panel
      </a>
    </div>
  `
});
      
return res.json({
  success: true,
  message: "Recipe submitted for review"
});

  } catch (err) {
    console.log("SUBMIT RECIPE ERROR:", err);

    return res.status(500).json({
      error: "Submit failed"
    });
  }

});

function getRecipeStatusMail(type, lang, recipeTitle) {

  const messages = {
    approved: {
      en: {
        subject: "Your recipe has been published",
        text: `Thank you for sharing your recipe with Nili’s Kitchen. Your recipe "${recipeTitle}" has been reviewed and published. It can now appear in recipe search results.`
      },
      tr: {
        subject: "Tarifiniz yayınlandı",
        text: `Nili’s Kitchen ile tarifinizi paylaştığınız için teşekkür ederiz. "${recipeTitle}" adlı tarifiniz incelendi ve yayınlandı. Artık uygun malzeme aramalarında görünebilir.`
      },
      ru: {
        subject: "Ваш рецепт опубликован",
        text: `Спасибо, что поделились рецептом с Nili’s Kitchen. Ваш рецепт "${recipeTitle}" был проверен и опубликован. Теперь он может появляться в результатах поиска.`
      },
      fr: {
        subject: "Votre recette a été publiée",
        text: `Merci d’avoir partagé votre recette avec Nili’s Kitchen. Votre recette "${recipeTitle}" a été vérifiée et publiée. Elle peut maintenant apparaître dans les résultats de recherche.`
      },
      es: {
        subject: "Tu receta ha sido publicada",
        text: `Gracias por compartir tu receta con Nili’s Kitchen. Tu receta "${recipeTitle}" fue revisada y publicada. Ahora puede aparecer en los resultados de búsqueda.`
      },
      pt: {
        subject: "Sua receita foi publicada",
        text: `Obrigado por compartilhar sua receita com o Nili’s Kitchen. Sua receita "${recipeTitle}" foi revisada e publicada. Agora ela pode aparecer nos resultados de busca.`
      },
      ar: {
        subject: "تم نشر وصفتك",
        text: `شكرًا لمشاركة وصفتك مع Nili’s Kitchen. تمت مراجعة وصفتك "${recipeTitle}" ونشرها. يمكن أن تظهر الآن في نتائج البحث.`
      }
    },

    rejected: {
      en: {
        subject: "Update about your recipe submission",
        text: `Thank you for sharing your recipe with Nili’s Kitchen. After review, we are not able to publish "${recipeTitle}" at this time. You are welcome to improve it and submit it again.`
      },
      tr: {
        subject: "Tarif başvurunuz hakkında",
        text: `Nili’s Kitchen ile tarifinizi paylaştığınız için teşekkür ederiz. Yapılan inceleme sonucunda "${recipeTitle}" adlı tarifinizi şu anda yayınlayamıyoruz. Dilerseniz tarifi geliştirip tekrar gönderebilirsiniz.`
      },
      ru: {
        subject: "Информация о вашей заявке на рецепт",
        text: `Спасибо, что поделились рецептом с Nili’s Kitchen. После проверки мы пока не можем опубликовать рецепт "${recipeTitle}". Вы можете улучшить его и отправить снова.`
      },
      fr: {
        subject: "Mise à jour concernant votre recette",
        text: `Merci d’avoir partagé votre recette avec Nili’s Kitchen. Après vérification, nous ne pouvons pas publier "${recipeTitle}" pour le moment. Vous pouvez l’améliorer et la soumettre à nouveau.`
      },
      es: {
        subject: "Actualización sobre tu receta",
        text: `Gracias por compartir tu receta con Nili’s Kitchen. Después de revisarla, no podemos publicar "${recipeTitle}" en este momento. Puedes mejorarla y enviarla nuevamente.`
      },
      pt: {
        subject: "Atualização sobre sua receita",
        text: `Obrigado por compartilhar sua receita com o Nili’s Kitchen. Após a análise, não podemos publicar "${recipeTitle}" neste momento. Você pode melhorá-la e enviar novamente.`
      },
      ar: {
        subject: "تحديث بخصوص وصفتك",
        text: `شكرًا لمشاركة وصفتك مع Nili’s Kitchen. بعد المراجعة، لا يمكننا نشر وصفتك "${recipeTitle}" في الوقت الحالي. يمكنك تعديلها وإرسالها مرة أخرى.`
      }
    }
  };

  return messages[type]?.[lang] || messages[type]?.en;
}


function hashPassword(password){

  const salt =
  crypto.randomBytes(16).toString("hex");

  const hash =
  crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return `${salt}:${hash}`;

}

function verifyPassword(password, saved){

  const [salt, originalHash] =
  saved.split(":");

  const hash =
  crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return hash === originalHash;

}

const creatorsDir =
"creator-users";

const creatorsFile =
`${creatorsDir}/creators.json`;

if(!fs.existsSync(creatorsDir)){
  fs.mkdirSync(creatorsDir);
}

if(!fs.existsSync(creatorsFile)){
  fs.writeFileSync(creatorsFile, "[]");
}

app.post("/creator-auth", async (req, res) => {

  console.log("CREATOR AUTH CALLED");
  console.log("BODY:", req.body);

  try {

    const {
      mode,
      username,
      emailOrUser,
      password
    } = req.body;

    const cleanUsername =
username ? username.trim().toLowerCase() : "";

const cleanEmailOrUser =
emailOrUser ? emailOrUser.trim().toLowerCase() : "";

const cleanPassword =
password ? password.trim() : "";

    if(!mode || !cleanEmailOrUser || !cleanPassword){
      return res.status(400).json({
        error:"Missing required fields"
      });
    }

    let users =
    JSON.parse(
      fs.readFileSync(creatorsFile, "utf8")
    );

    if(mode === "signup"){

      if(!cleanUsername){
        return res.status(400).json({
          error:"Username is required"
        });
      }

     const exists =
users.find(user =>
  String(user.email || "").toLowerCase() === cleanEmailOrUser ||
  String(user.username || "").toLowerCase() === cleanUsername
);

      if(exists){
        return res.status(409).json({
          error:"User already exists"
        });
      }

     const newUser =
{
  id: Date.now().toString(),
  username: cleanUsername,
  email: cleanEmailOrUser,
  passwordHash: hashPassword(cleanPassword),
  role:"creator",
  createdAt:new Date().toISOString()
};

      users.push(newUser);

      fs.writeFileSync(
        creatorsFile,
        JSON.stringify(users, null, 2)
      );

      await sendMailSafe({
        to: emailOrUser,
        subject:"Welcome to Nili's Kitchen Creator Program",
        text:`Hi ${username}, your creator account was created successfully.`,
        html:`
          <h2>Welcome to Nili's Kitchen!</h2>
          <p>Hi ${username},</p>
          <p>Your creator account was created successfully.</p>
          <p>You can now submit your recipes for review.</p>
        `
      });

      return res.json({
  success:true,
  username: cleanUsername,
  email: cleanEmailOrUser
});

    }

    if(mode === "login"){

     const user =
users.find(user =>
  String(user.email || "").toLowerCase() === cleanEmailOrUser ||
  String(user.username || "").toLowerCase() === cleanEmailOrUser
);

      if(!user){
        return res.status(401).json({
          error:"User not found"
        });
      }

      const valid =
verifyPassword(cleanPassword, user.passwordHash);

      if(!valid){
        return res.status(401).json({
          error:"Wrong password"
        });
      }

      return res.json({
        success:true,
        username:user.username,
        email:user.email
      });

    }

    return res.status(400).json({
      error:"Invalid mode"
    });

  }catch(err){

    console.log("CREATOR AUTH ERROR:", err);

    return res.status(500).json({
      error:"Creator auth failed"
    });

  }

});

function getPendingRecipesFile() {
  return path.join(
    __dirname,
    "pending-recipes",
    "pending_recipes.json"
  );
}

 

function readPendingRecipes() {
  const file = getPendingRecipesFile();

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]");
  }

  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function writePendingRecipes(recipes) {
  const file = getPendingRecipesFile();

  fs.writeFileSync(
    file,
    JSON.stringify(recipes, null, 2)
  );
}

app.post(
  "/admin/update-recipe/:id",
  creatorUpload.single("media"),
  async (req, res) => {
    try {
      const recipes = readPendingRecipes();

      const recipe =
      recipes.find(item =>
        item.id === req.params.id
      );

      if (!recipe) {
        return res.status(404).json({
          error: "Recipe not found"
        });
      }

      const {
        title,
        adminTitleTr,
        ingredients,
        adminIngredientsTr,
        instructions,
        adminInstructionsTr,
        prepTime,
        servings
      } = req.body;

      if (title !== undefined) {
        recipe.title = title;
      }

      if (adminTitleTr !== undefined) {
        recipe.adminTitleTr = adminTitleTr;
      }

      if (ingredients !== undefined) {
        recipe.ingredients = ingredients;
      }

      if (adminIngredientsTr !== undefined) {
        recipe.adminIngredientsTr = adminIngredientsTr;
      }

      if (instructions !== undefined) {
        recipe.instructions = instructions;
      }

      if (adminInstructionsTr !== undefined) {
        recipe.adminInstructionsTr = adminInstructionsTr;
      }

      if (prepTime !== undefined) {
        recipe.prepTime = prepTime;
      }

      if (servings !== undefined) {
        recipe.servings = servings;
      }

      if (req.file) {
        recipe.mediaFile = req.file.filename;
        recipe.mediaUrl = "/creator-uploads/" + req.file.filename;
        recipe.mediaType = req.file.mimetype;
        recipe.mediaUpdatedAt = new Date().toISOString();
      }

      recipe.updatedAt = new Date().toISOString();
      recipe.updatedBy = "admin";

      writePendingRecipes(recipes);

      return res.json({
        success: true,
        recipe
      });

    } catch (err) {
      console.log("ADMIN UPDATE RECIPE ERROR:", err);

      return res.status(500).json({
        error: "Recipe update failed"
      });
    }
  }
);

app.get("/admin/pending-recipes", (req, res) => {
  try {
    const recipes = readPendingRecipes();

    const pending = recipes.filter(recipe =>
      recipe.status === "pending_review"
    );

    res.json({
      success: true,
      recipes: pending
    });
  } catch (err) {
    console.log("ADMIN PENDING RECIPES ERROR:", err);

    res.status(500).json({
      error: "Could not load pending recipes"
    });
  }
});


app.post("/admin/reject-recipe/:id", async(req, res) => {
  try {
    const recipes = readPendingRecipes();

    const recipe = recipes.find(item =>
      item.id === req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        error: "Recipe not found"
      });
    }

    recipe.status = "rejected";
    recipe.rejectedAt = new Date().toISOString();

    writePendingRecipes(recipes);

    res.json({
      success: true,
      recipe
    });

    const mail =
getRecipeStatusMail(
  "rejected",
  recipe.creatorLang || recipe.lang || "en",
  recipe.adminTitleTr || recipe.title || "Recipe"
);

await sendMailSafe({
  to: recipe.creatorEmail,
  subject: mail.subject,
  text: mail.text,
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>${mail.subject}</h2>
      <p>${mail.text}</p>
      <p><strong>Nili’s Kitchen Team</strong></p>
    </div>
  `
});
  } catch (err) {
    console.log("REJECT RECIPE ERROR:", err);

    res.status(500).json({
      error: "Reject failed"
    });
  }
});

app.post("/admin/delete-recipe/:id", (req, res) => {
  try {
    let recipes = readPendingRecipes();

    recipes = recipes.filter(item =>
      item.id !== req.params.id
    );

    writePendingRecipes(recipes);

    res.json({
      success: true
    });
  } catch (err) {
    console.log("DELETE RECIPE ERROR:", err);

    res.status(500).json({
      error: "Delete failed"
    });
  }
});

app.post("/user/favorites", (req, res) => {
  try{
    const { email, recipe } = req.body;

    if(!email || !recipe || !recipe.id){
      return res.status(400).json({
        success:false,
        error:"email and recipe required"
      });
    }

    const data = readFavorites();

    if(!data[email]){
      data[email] = [];
    }

    const exists =
      data[email].some(item => String(item.id) === String(recipe.id));

    if(exists){
      data[email] =
        data[email].filter(item => String(item.id) !== String(recipe.id));
    }else{
      data[email].push(recipe);
    }

    writeFavorites(data);

    res.json({
      success:true,
      favorites:data[email]
    });

  }catch(err){
    console.log("FAVORITES ERROR:", err);
    res.status(500).json({
      success:false,
      error:"Favorites failed"
    });
  }
});

app.get("/user/favorites/:email", (req, res) => {
  try{
    const data = readFavorites();
    const email = req.params.email;

    res.json({
      success:true,
      favorites:data[email] || []
    });

  }catch(err){
    res.status(500).json({
      success:false,
      error:"Favorites load failed"
    });
  }
});


function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function findApprovedRecipesByIngredients(ingredientsInput) {
  const approvedRecipes =
  readApprovedRecipes();

  let ingredients = [];

  if (Array.isArray(ingredientsInput)) {
    ingredients = ingredientsInput;
  } else {
    ingredients =
    String(ingredientsInput || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }

  const normalizedIngredients =
  ingredients.map(item => normalizeText(item));

  return approvedRecipes
    .filter(recipe => recipe.status === "approved")
    .map(recipe => {
      const searchText =
      normalizeText(`
        ${recipe.title}
        ${recipe.adminTitleTr}
        ${recipe.ingredients}
        ${recipe.adminIngredientsTr}
      `);

      const matchedIngredients =
      normalizedIngredients.filter(ingredient =>
        searchText.includes(ingredient)
      );

      return {
        ...recipe,
        matchedIngredients,
        matchCount: matchedIngredients.length
      };
    })
    .filter(recipe => recipe.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);
}

app.post("/community-recipes/search", (req, res) => {
  try {
    const { ingredients } = req.body;

    const recipes =
    findApprovedRecipesByIngredients(ingredients);

    res.json({
      success: true,
      source: "nili_creator",
      recipes
    });

  } catch (err) {
    console.log("COMMUNITY RECIPE SEARCH ERROR:", err);

    res.status(500).json({
      error: "Community recipe search failed"
    });
  }
});

function getApprovedRecipesFile() {
  return path.join(
    __dirname,
    "approved-recipes",
    "approved_recipes.json"
  );
}

function readApprovedRecipes() {
  const dir =
  path.join(__dirname, "approved-recipes");

  const file =
  getApprovedRecipesFile();

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]");
  }

  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function writeApprovedRecipes(recipes) {
  const file =
  getApprovedRecipesFile();

  fs.writeFileSync(
    file,
    JSON.stringify(recipes, null, 2)
  );
}

app.post("/admin/approve-recipe/:id", async (req, res) => {

  console.log("APPROVE ENDPOINT CALLED:", req.params.id);
  try {
    let pendingRecipes =
    readPendingRecipes();

    let approvedRecipes =
    readApprovedRecipes();

    const recipeIndex =
    pendingRecipes.findIndex(item =>
      item.id === req.params.id
    );

    if (recipeIndex === -1) {
      return res.status(404).json({
        error: "Recipe not found"
      });
    }

    const recipe =
    pendingRecipes[recipeIndex];

    const approvedRecipe = {
      ...recipe,
      status: "approved",
      approvedAt: new Date().toISOString(),
      source: "nili_creator",
      clicks: Number(recipe.clicks || 0),
      bonusPerClick: Number(process.env.BONUS_PER_CLICK || 0.01),
      totalBonus: Number(recipe.totalBonus || 0)
    };

    approvedRecipes.push(approvedRecipe);

    pendingRecipes.splice(recipeIndex, 1);

    writeApprovedRecipes(approvedRecipes);
    writePendingRecipes(pendingRecipes);

    console.log("APPROVED FILE:", getApprovedRecipesFile());
console.log("APPROVED COUNT:", approvedRecipes.length);
console.log("MOVED RECIPE:", approvedRecipe.title);

    console.log("RECIPE MOVED TO APPROVED:", approvedRecipe.title);

   

    const mail =
getRecipeStatusMail(
  "approved",
  recipe.creatorLang || recipe.lang || "en",
  recipe.adminTitleTr || recipe.title || "Recipe"
);

await sendMailSafe({
  to: recipe.creatorEmail,
  subject: mail.subject,
  text: mail.text,
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.5;">
      <h2>${mail.subject}</h2>
      <p>${mail.text}</p>
      <p><strong>Nili’s Kitchen Team</strong></p>
    </div>
  `
});

return res.json({
      success: true,
      recipe: approvedRecipe
    });

  } catch (err) {
    console.log("APPROVE RECIPE ERROR:", err);

    return res.status(500).json({
      error: "Approve failed"
    });
  }
});

app.post("/normalize-ingredients", async (req, res) => {
  try {
    const ingredients =
    req.body.ingredients || [];

    const lang =
    req.body.lang || "en";

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.json({
        success: true,
        ingredients: []
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        ingredients: ingredients.map(item => ({
          original: item,
          canonicalEn: String(item || "").trim().toLowerCase(),
          display: String(item || "").trim()
        }))
      });
    }

    const response =
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You normalize food ingredients. Fix spelling mistakes, translate every ingredient to canonical English for recipe API search, and also provide display name in the requested language. Return only valid JSON array. No extra text."
        },
        {
          role: "user",
          content: JSON.stringify({
            ingredients,
            displayLanguage: lang,
            requiredFormat: [
              {
                original: "original user input",
                canonicalEn: "clean English ingredient name",
                display: "ingredient name in displayLanguage"
              }
            ]
          })
        }
      ],
      temperature: 0.1
    });

    let content =
    response.choices[0].message.content || "";

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let normalized =
    JSON.parse(content);

    if (!Array.isArray(normalized)) {
      normalized = [];
    }

    normalized =
    normalized
      .filter(item => item && item.canonicalEn)
      .map(item => ({
        original: item.original || "",
        canonicalEn: String(item.canonicalEn || "").trim().toLowerCase(),
        display: item.display || item.canonicalEn
      }));

    return res.json({
      success: true,
      ingredients: normalized
    });

  } catch (err) {
    console.log("NORMALIZE INGREDIENTS ERROR:", err.message);

    return res.status(500).json({
      error: "Ingredient normalization failed"
    });
  }
});

app.post("/send-error-alert", async (req, res) => {
  try {
    const { source, error, page, time } = req.body;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ALERT_EMAIL || process.env.EMAIL_USER,
      subject: "Nili's Kitchen AI - Critical Error Alert",
      text: `
Source: ${source || "unknown"}
Time: ${time || new Date().toISOString()}
Page: ${page || "-"}

Error:
${error || "No error message"}
`
    });

    res.json({ success: true });

  } catch (e) {
    console.error("ERROR ALERT MAIL FAILED:", e.message);
    res.status(500).json({ success: false });
  }
});

app.get("/creator-dashboard/:email", (req, res) => {
  try {
    const email =
    decodeURIComponent(req.params.email || "").trim().toLowerCase();

    const pendingRecipes =
    readPendingRecipes();

    const approvedRecipes =
    readApprovedRecipes();

    const creatorPending =
    pendingRecipes.filter(recipe =>
      String(recipe.creatorEmail || "").trim().toLowerCase() === email
    );

    const creatorApproved =
    approvedRecipes.filter(recipe =>
      String(recipe.creatorEmail || "").trim().toLowerCase() === email
    );

    const totalViews =
    creatorApproved.reduce((sum, recipe) =>
      sum + Number(recipe.views || 0), 0
    );

    const totalEarnings =
    creatorApproved.reduce((sum, recipe) =>
      sum + Number(recipe.totalBonus || 0), 0
    );

    return res.json({
      success: true,
      creatorEmail: email,
      stats: {
        totalRecipes: creatorPending.length + creatorApproved.length,
        pending: creatorPending.length,
        published: creatorApproved.length,
        views: totalViews,
        earnings: totalEarnings
      },
      pendingRecipes: creatorPending,
      publishedRecipes: creatorApproved
    });

  } catch (err) {
    console.log("CREATOR DASHBOARD ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Dashboard failed"
    });
  }
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
