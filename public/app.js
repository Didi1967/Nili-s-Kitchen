let currentRecipes = [];


/* ELEMENTS */

const photo =
document.getElementById("photo");

const statusText =
document.getElementById("statusText");

const bar =
document.getElementById("bar");

const checklist =
document.getElementById("checklist");

const recipeBtn =
document.getElementById("recipeBtn");

const confirmCheck =
document.getElementById("confirmCheck");

const result =
document.getElementById("result");

const modal =
document.getElementById("modal");

const modalBody =
document.getElementById("modalBody");

const manualInput =
document.getElementById("manualInput");

const langSelect =
document.getElementById("langSelect");

const subcategories =
document.getElementById("subcategories");

/* DATA */

let selected = [];

let currentLang =
localStorage.getItem("lang")
|| "en";

/* CATEGORY DATA */

const CATEGORY_DATA = {

  vegetables:[
    "tomato",
    "onion",
    "potato",
    "pepper"
  ],

  meat:[
    "chicken",
    "beef",
    "lamb",
    "turkey"
  ],

  seafood:[
    "salmon",
    "shrimp",
    "tuna",
    "mussels"
  ],

  vegan:[
    "tofu",
    "lentils",
    "beans",
    "mushroom"
  ],

  pasta:[
    "spaghetti",
    "penne",
    "fusilli",
    "lasagna"
  ],

  dessert:[
    "chocolate",
    "vanilla",
    "strawberry",
    "cream"
  ]

};

/* LANG */

const LANG = {

  en:{

    subtitle:
    "AI Recipe Assistant",

    upload:
    "Upload ingredients photo",

    add:
    "Add ingredient",

    confirm:
    "Confirm ingredients",

    recipes:
    "Get Recipes",

    uploadTitle:
    "📸 Upload Ingredients",

    manualTitle:
    "✍ Manual Ingredient",

    categories:
    "🥦 Categories",

    vegetables:
    "Vegetables",

    meat:
    "Meat",

    seafood:
    "Seafood",

    vegan:
    "Vegan",

    pasta:
    "Pasta",

    dessert:
    "Dessert",

    selectedTitle:
    "✅ Selected Ingredients"

  },

  tr:{

    subtitle:
    "AI Tarif Asistanı",

    upload:
    "Malzeme fotoğrafı yükle",

    add:
    "Malzeme ekle",

    confirm:
    "Malzemeleri onayla",

    recipes:
    "Tarifleri Getir",

    uploadTitle:
    "📸 Malzeme Yükle",

    manualTitle:
    "✍ Manuel Malzeme",

    categories:
    "🥦 Kategoriler",

    vegetables:
    "Sebzeler",

    meat:
    "Et",

    seafood:
    "Deniz Ürünleri",

    vegan:
    "Vegan",

    pasta:
    "Makarna",

    dessert:
    "Tatlı",

    selectedTitle:
    "✅ Seçilen Malzemeler"

  }

};

/* APPLY LANGUAGE */

function applyLanguage(){


const t =
LANG[currentLang]
|| LANG.en;


  document.documentElement.lang =
  currentLang;

  document.getElementById(
    "appSubtitle"
  ).innerText =
  t.subtitle;

  statusText.innerText =
  t.upload;

  manualInput.placeholder =
  t.add;

  document.getElementById(
    "confirmText"
  ).innerText =
  t.confirm;

  recipeBtn.innerText =
  t.recipes;

  document.getElementById(
    "uploadTitle"
  ).innerText =
  t.uploadTitle;

  document.getElementById(
    "manualTitle"
  ).innerText =
  t.manualTitle;

  document.getElementById(
    "categoriesTitle"
  ).innerText =
  t.categories;

  document.getElementById(
    "selectedTitle"
  ).innerText =
  t.selectedTitle;

  document.getElementById(
    "catVegetables"
  ).innerText =
  t.vegetables;

  document.getElementById(
    "catMeat"
  ).innerText =
  t.meat;

  document.getElementById(
    "catSeafood"
  ).innerText =
  t.seafood;

  document.getElementById(
    "catVegan"
  ).innerText =
  t.vegan;

  document.getElementById(
    "catPasta"
  ).innerText =
  t.pasta;

  document.getElementById(
    "catDessert"
  ).innerText =
  t.dessert;

}

/* LANGUAGE SWITCH */

langSelect.value =
currentLang;

langSelect.addEventListener(
  "change",
  ()=>{

    currentLang =
    langSelect.value;

    localStorage.setItem(
      "lang",
      currentLang
    );

    applyLanguage();

});

/* CHECKLIST */

function renderChecklist(){

  checklist.innerHTML =

  selected.map(x=>`

    <label class="check-item">

      <input
        type="checkbox"
        checked
        onchange="
          removeIngredient(
            '${x}'
          )
        "
      >

      ${x}

    </label>

  `).join("");

}

/* REMOVE */

function removeIngredient(v){

  selected =
  selected.filter(
    x=>x!==v
  );

  renderChecklist();

}

/* MANUAL */

function addManual(){

  const v =
  manualInput.value.trim();

  if(!v) return;

  if(!selected.includes(v)){

    selected.push(v);

  }

  manualInput.value =
  "";

  renderChecklist();

}

/* CATEGORY */

document
.querySelectorAll(
  ".category-grid button"
)
.forEach(btn=>{

  btn.addEventListener(
    "click",
    ()=>{

      const key =
      btn.dataset.category;

      const items =
      CATEGORY_DATA[key];

      subcategories.innerHTML =
      items.map(x=>`

        <button
          class="sub-btn"
          onclick="
            addCategory(
              '${x}'
            )
          "
        >

          ${x}

        </button>

      `).join("");

    }

  );

});

/* ADD CATEGORY */

function addCategory(v){

  if(!selected.includes(v)){

    selected.push(v);

  }

  renderChecklist();

}

 /* UPLOAD + ANALYZE */

photo.addEventListener(
  "change",
  async ()=>{

    const file =
    photo.files[0];

    if(!file) return;

    statusText.innerText =
    "Analyzing...";

    bar.style.width =
    "30%";

    const formData =
    new FormData();

    formData.append(
      "photo",
      file
    );

    try{

      const res =
      await fetch(
        "/analyze",
        {
          method:"POST",
          body:formData
        }
      );

      const data =
      await res.json();

      bar.style.width =
      "100%";

      if(
        data.ingredients
      ){

        data.ingredients.forEach(
          item=>{

            if(
              !selected.includes(item)
            ){

              selected.push(item);

            }

          }
        );

        renderChecklist();

        statusText.innerText =
        "Ingredients detected";

      }else{

        statusText.innerText =
        "No ingredients found";

      }

    }catch(err){

      console.error(err);

      statusText.innerText =
      "Analyze failed";

    }

});

/* RECIPES */

recipeBtn.addEventListener(
  "click",
  async ()=>{

    if(!confirmCheck.checked){

      alert(
        "Confirm ingredients first"
      );

      return;

    }

    result.innerHTML =
    "<p>Loading recipes...</p>";

    try{

      const res =
      await fetch(
        "/recipes",
        {
          method:"POST",

          headers:{
            "Content-Type":
            "application/json"
          },

          body:JSON.stringify({

            ingredients:selected,

            lang:currentLang

          })

        }
      );

      const data =
      await res.json();

      console.log(data);

      currentRecipes =
      data;

      if(
        !Array.isArray(data)
        ||
        !data.length
      ){

        result.innerHTML =
        "<p>No recipes found</p>";

        return;

      }

      let html = "";

      data.forEach(recipe=>{

        html += `

          <div
            class="card"
            onclick="openRecipe('${recipe.id}')"
          >

            <img
              src="${
                recipe.image
                ||
                'https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg'
              }"

              alt="${recipe.title}"
            >

            <div class="card-body">

              <h3>
                ${recipe.title || "Recipe"}
              </h3>

              <p class="time">

                ⏱ ${
                  recipe.readyInMinutes
                  || 30
                } min

              </p>

              <div class="ingredients">

                ${
                  recipe.usedIngredients
                  ? recipe.usedIngredients
                      .slice(0,4)
                      .map(item=>`

                        <span>
                          ${
                            item.name
                            || item.original
                            || "ingredient"
                          }
                        </span>

                      `).join("")
                  : ""
                }

              </div>

            </div>

          </div>

        `;

      });

      result.innerHTML =
      html;

      document
      .getElementById("mosaic")
      .style.display =
      "none";

      result.scrollIntoView({
        behavior:"smooth"
      });

    }catch(err){

      console.log(err);

      result.innerHTML =
      "<p>Recipes failed</p>";

    }

});

/* RECIPES */

app.post(
  "/recipes",
  async (req, res) => {

    try {

      const ingredients =
      req.body.ingredients || [];

      const lang =
      req.body.lang || "en";

      if (!ingredients.length) {

        return res.json([]);

      }

      const query =
      ingredients.join(",");

      /* SPOON */

      const spoonRes =
      await fetch(

`https://api.spoonacular.com/recipes/findByIngredients?ingredients=${query}&number=6&apiKey=${process.env.SPOON_KEY}`

      );

      const spoonData =
      await spoonRes.json();

      console.log(spoonData);

      /* SPOON SUCCESS */

      if(Array.isArray(spoonData)){

        const fullRecipes =
        await Promise.all(

          spoonData.map(async recipe=>{

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
                detail.title,

                image:
                detail.image,

                readyInMinutes:
                detail.readyInMinutes || 30,

                usedIngredients:
                recipe.usedIngredients || [],

                instructions:
                detail.instructions || ""

              };

            }catch{

              return recipe;

            }

          })

        );

        return res.json(fullRecipes);

      }

      /* THEMEALDB */

      const mealRes =
      await fetch(

`https://www.themealdb.com/api/json/v1/1/search.php?s=${ingredients[0]}`

      );

      const mealData =
      await mealRes.json();

      console.log(mealData);

      if(!mealData.meals){

        return res.json([]);

      }

      const recipes =
      mealData.meals
      .slice(0,6)
      .map((meal,index)=>({

        id:index + 1,

        title:
        meal.strMeal,

        image:
        meal.strMealThumb,

        readyInMinutes:30,

        usedIngredients:
        ingredients
        .slice(0,3)
        .map(x=>({
          name:x
        })),

        instructions:
        meal.strInstructions || ""

      }));

      return res.json(recipes);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:"Recipes failed"
      });

    }

});

/* MODAL */
 
function closeModal(){

  modal.style.display =
  "none";

}
 

 
async function openRecipe(id){

  modal.style.display =
  "block";

  const recipe =
  currentRecipes.find(
    r => String(r.id) === String(id)
  );

  if(!recipe){

    modalBody.innerHTML =

 



    "<h2>Recipe not found</h2>";

    return;

  }

  modalBody.innerHTML = `

  <button
  onclick="closeModal()"
  style="
    position:absolute;
    top:20px;
    right:20px;
    border:none;
    background:black;
    color:white;
    width:42px;
    height:42px;
    border-radius:50%;
    cursor:pointer;
    font-size:22px;
  "
>
  ×
</button>

    <img
      src="${
        recipe.image
        ||
        'https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg'
      }"

      style="
        width:100%;
        max-height:340px;
        object-fit:cover;
        border-radius:24px;
        margin-bottom:24px;
      "
    >

    <h1>
      ${recipe.title}
    </h1>

    <br>

    <p class="time">

      ⏱ ${
        recipe.readyInMinutes
        || 30
      } min

    </p>

    <br>

    <h2>
      Ingredients
    </h2>

    <div class="ingredients">

      ${
        recipe.usedIngredients
        ? recipe.usedIngredients
            .map(item=>`

              <span>
                ${
                  item.name
                  || item.original
                  || "ingredient"
                }
              </span>

            `).join("")
        : ""
      }

    </div>

    <br><br>

    <h2>
      Instructions
    </h2>

    <p style="line-height:1.8;">

      ${
        recipe.instructions
        || "No instructions"
      }

    </p>

  `;

}

applyLanguage();

renderChecklist();