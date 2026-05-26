import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import OpenAI from "openai";
import fs from "fs";
 


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

app.post(
  "/recipes",
  async (req, res) => {

    try {

      const ingredients =
      req.body.ingredients || [];

      if (!ingredients.length) {

        return res.json([]);

      }

      const query =
      ingredients.join(",");

      const response =
      await fetch(

`https://api.spoonacular.com/recipes/findByIngredients?ingredients=${query}&number=6&apiKey=${process.env.SPOON_KEY}`

      );

      const basicRecipes =
      await response.json();

      console.log(basicRecipes);

      /* THEMALDB */

 
if(
  !Array.isArray(basicRecipes)
  ||
  basicRecipes.status === "failure"
)

{
   
const validIngredients = ingredients.filter(x=> !x.includes("apple") && !x.includes("banana") && !x.includes("orange") && !x.includes("bell pepper") ); const randomIngredient = validIngredients[0] || ingredients[0];

const mealRes =
await fetch(

`https://www.themealdb.com/api/json/v1/1/filter.php?i=${randomIngredient}`

);

 
console.log(
  "THEMEAL INGREDIENT:",
  randomIngredient
);
 


  const mealData =
  await mealRes.json();

  if(!mealData.meals){

    return res.json([]);

  }

 
 
const recipes =
await Promise.all(

  mealData.meals
  .slice(0,6)
  .map(async meal=>{

    const detailRes =
    await fetch(

`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`

    );

    const detailData =
    await detailRes.json();

    const detail =
    detailData.meals[0];

    return {

      id:
      detail.idMeal,

      title:
      detail.strMeal,

      image:
      detail.strMealThumb,

      readyInMinutes:
      30,

  
usedIngredients:[],
 


instructions:

detail.strInstructions
?.trim()

|| 

"Recipe instructions unavailable."

    };

  })

);




  return res.json(recipes);

}



      /* SPOON SUCCESS */

      const fullRecipes =
      await Promise.all(

        basicRecipes.map(async recipe=>{

          try{

            const detailRes =
            await fetch(

`https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${process.env.SPOON_KEY}`

            );

            const detail =
            await detailRes.json();

 
return {

  id:
  recipe.id,

  title:
  recipe.title || "Recipe",

  image:
  recipe.image ||

  "https://img.spoonacular.com/recipes/716429-556x370.jpg",

  readyInMinutes:

  detail.readyInMinutes
  || 30,

  usedIngredients:

  recipe.usedIngredients
  || [],

  instructions:

  detail.instructions
  || detail.summary
  || "No instructions"

};


          }catch{

            return recipe;

          }

        })

      );

console.log(fullRecipes);

      res.json(fullRecipes);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:"Recipes failed"
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

app.listen(PORT,()=>{

  console.log(
    `http://localhost:${PORT}`
  );

});