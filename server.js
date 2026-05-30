dotenv.config();

const __filename =
fileURLToPath(import.meta.url);

const __dirname =
path.dirname(__filename);

const openai =
new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

 

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import crypto from "crypto";
 


const app =
express();

app.use(express.json());

app.use(
  express.static("public")
);

const upload =
multer({
  dest:"uploads/"
});

console.log(
  process.env.SPOON_KEY
);
 
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
            .slice(0, 6)
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
            .slice(0, 6)
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
            .slice(0, 6)
            .map(async meal => {

              const detailRes =
              await fetch(
`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
              );

              const detailData =
              await detailRes.json();

              const detail =
              detailData.meals[0];

              return {
                id: detail.idMeal,
                source: "themealdb",
                title: detail.strMeal,
                image: detail.strMealThumb,
                readyInMinutes: 30,
                usedIngredients: [],
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

      return res.json(
        allRecipes.slice(0, 18)
      );

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

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});

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

      const recipe =
      {
        id: Date.now().toString(),
        creatorUsername: creatorUsername || "Guest creator",
        creatorEmail: creatorEmail || "",
        title,
        prepTime: prepTime || "",
        servings: servings || "",
        ingredients,
        instructions,
        mediaFile: req.file.filename,
        mediaType: req.file.mimetype,
        status:"pending_review",
        views:0,
        clicks:0,
        createdAt:new Date().toISOString()
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
await sendMailSafe({
  to: process.env.ADMIN_EMAIL,
  subject: "New recipe submitted for review",
  text: `New recipe submitted: ${title}`,
  html: `
    <h2>New recipe submitted</h2>
    <p><strong>Recipe:</strong> ${title}</p>
    <p><strong>Creator:</strong> ${creatorUsername}</p>
    <p><strong>Email:</strong> ${creatorEmail}</p>
    <p>Status: pending review</p>
  `
});

return res.json({
  success:true,
  message:"Recipe submitted for review"
});

    }catch(err){

      console.log("SUBMIT RECIPE ERROR:", err);

      return res.status(500).json({
        error:"Submit failed"
      });

    }

  }
);

const mailer =
nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendMailSafe({ to, subject, html, text }){

  try{

    if(
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !to
    ){
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

  }catch(err){

    console.log("MAIL ERROR:", err.message);

  }

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

  try{

    const {
      mode,
      username,
      emailOrUser,
      password
    } = req.body;

    if(!mode || !emailOrUser || !password){
      return res.status(400).json({
        error:"Missing required fields"
      });
    }

    let users =
    JSON.parse(
      fs.readFileSync(creatorsFile, "utf8")
    );

    if(mode === "signup"){

      if(!username){
        return res.status(400).json({
          error:"Username is required"
        });
      }

      const exists =
      users.find(user =>
        user.email === emailOrUser ||
        user.username === username
      );

      if(exists){
        return res.status(409).json({
          error:"User already exists"
        });
      }

      const newUser =
      {
        id: Date.now().toString(),
        username,
        email: emailOrUser,
        passwordHash: hashPassword(password),
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
        username,
        email:emailOrUser
      });

    }

    if(mode === "login"){

      const user =
      users.find(user =>
        user.email === emailOrUser ||
        user.username === emailOrUser
      );

      if(!user){
        return res.status(401).json({
          error:"User not found"
        });
      }

      const valid =
      verifyPassword(password, user.passwordHash);

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