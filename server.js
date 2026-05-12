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

    try {

      if (!req.file) {

        return res.status(400).json({
          error: "No photo"
        });

      }

      const imageBase64 =
      fs.readFileSync(
        req.file.path,
        {
          encoding:"base64"
        }
      );

      const openai =
      new OpenAI({

        apiKey:
        process.env.OPENAI_API_KEY

      });

      const response =
      await openai.chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",

            content:
            "Return only ingredient names as JSON array."
          },

          {
            role:"user",

            content:[

              {
                type:"text",

                text:
                "Detect ingredients from this image"
              },

              {
                type:"image_url",

                image_url:{
                  url:
`data:image/jpeg;base64,${imageBase64}`
                }

              }

            ]

          }

        ]

      });

      const text =
      response
      .choices[0]
      .message
      .content;

      console.log(text);

      let ingredients =
      [];

      try{

        ingredients =
        JSON.parse(text);

      }

      catch{

        ingredients =
        text
        .replace(/```json/gi,"")
        .replace(/```/g,"")
        .replace(/\[/g,"")
        .replace(/\]/g,"")
        .replace(/"/g,"")
        .replace(/'/g,"")
        .replace(/[“”]/g,"")
        .replace(/[‘’]/g,"")
        .replace(/\n/g,"")
        .split(",")
        .map(x=>x.trim())
        .map(x=>x.replace(/json/gi,""))
        .filter(Boolean);

      }

      ingredients =
      ingredients.map(x=>

        x
        .replace(/[^\w\s-]/g,"")
        .trim()

      );

      res.json({

        ingredients

      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:"Analyze failed"
      });

    }

});

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