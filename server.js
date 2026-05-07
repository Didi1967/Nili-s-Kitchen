import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();

const upload = multer();

app.use(express.json());

app.use(express.static("public"));

/* OPENAI */

const openai = new OpenAI({
  apiKey:
  process.env.OPENAI_API_KEY
});

/* ANALYZE */

app.post(
  "/analyze",
  upload.single("image"),
  async (req,res)=>{

    try{

      const base64 =
      req.file.buffer.toString(
        "base64"
      );

      const gpt =
      await openai.chat.completions.create({

        model:"gpt-4o-mini",

        response_format:{
          type:"json_object"
        },

        messages:[{

          role:"user",

          content:[

            {
              type:"text",

              text:`

Return ONLY valid JSON.

Format:

{
  "ingredients":[]
}

Detect visible cooking ingredients.

Use:
- lowercase English
- simple ingredient names
- max 12 ingredients

`

            },

            {
              type:"image_url",

              image_url:{
                url:
                `data:image/jpeg;base64,${base64}`
              }

            }

          ]

        }]

      });

      const data =
      JSON.parse(
        gpt.choices[0]
        .message.content
      );

      res.json(data);

    }catch(e){

      console.log(e);

      res.json({
        ingredients:[
          "chicken",
          "rice",
          "tomato"
        ]
      });

    }

});

/* RECIPES */

app.post(
  "/recipes",
  async (req,res)=>{

    try{

      let {
        ingredients=[]
      } = req.body;

      if(
        ingredients.length < 2
      ){

        ingredients.push(
          "chicken"
        );

        ingredients.push(
          "rice"
        );

      }

      const spoonKey =
      process.env.SPOON_KEY;

      const url =

`https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredients.join(",")}&number=6&ranking=1&ignorePantry=true&apiKey=${spoonKey}`;

      const spoonRes =
      await fetch(url);

      const spoonData =
      await spoonRes.json();

      const recipes =
      spoonData.map(x=>({

        id:String(x.id),

        title:x.title,

        image:x.image,

        source:"spoon"

      }));

      res.json({
        recipes
      });

    }catch(e){

      console.log(e);

      res.json({
        recipes:[]
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

      const spoonKey =
      process.env.SPOON_KEY;

      const url =

`https://api.spoonacular.com/recipes/${id}/information?apiKey=${spoonKey}`;

      const r =
      await fetch(url);

      const d =
      await r.json();

      res.json({

        title:d.title,

        image:d.image,

        ingredients:
        d.extendedIngredients?.map(
          x=>x.original
        ) || [],

        instructions:
        d.instructions ||
        "No instructions"

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