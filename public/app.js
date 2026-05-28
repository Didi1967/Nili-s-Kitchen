 let currentRecipes = [];
let selected = [];

const photo = document.getElementById("photo");
const statusText = document.getElementById("statusText");
const bar = document.getElementById("bar");
const checklist = document.getElementById("checklist");
const recipeBtn = document.getElementById("recipeBtn");
const confirmCheck = document.getElementById("confirmCheck");
const result = document.getElementById("result");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const manualInput = document.getElementById("manualInput");
const langSelect = document.getElementById("langSelect");

const ingredientModal = document.getElementById("ingredientModal");
const ingredientModalTitle = document.getElementById("ingredientModalTitle");
const ingredientModalItems = document.getElementById("ingredientModalItems");

let currentLang =
localStorage.getItem("lang") || "en";

const CATEGORY_DATA = {

  vegetables:[
    "tomato","onion","potato","pepper","red pepper","green pepper",
    "garlic","broccoli","zucchini","eggplant","cucumber","mushroom",
    "spinach","lettuce","cabbage","carrot"
  ],

  fruits:[
    "apple","banana","orange","lemon","lime","avocado",
    "strawberry","blueberry","pineapple","mango"
  ],

  meat:[
    "chicken","chicken breast","beef","ground beef",
    "steak","lamb","turkey","sausage"
  ],

  seafood:[
    "salmon","tuna","shrimp","fish","cod","sardine"
  ],

  vegan:[
    "tofu","lentils","mushroom","chickpeas","beans","peas"
  ],

  pasta:[
    "pasta","spaghetti","noodles","parmesan","basil","tomato sauce"
  ],

  dairy:[
    "milk","cheese","yogurt","butter","cream","mozzarella","parmesan"
  ],

  grains:[
    "rice","pasta","spaghetti","bread","flour","oats","bulgur","noodles"
  ],

  legumes:[
    "lentils","beans","peas","chickpeas","kidney beans","black beans"
  ],

  spices:[
    "salt","black pepper","paprika","oregano","thyme",
    "basil","cumin","cinnamon","chili flakes"
  ],

  oils:[
    "olive oil","vegetable oil","sunflower oil","sesame oil"
  ],

  sauces:[
    "soy sauce","tomato sauce","ketchup","mustard",
    "mayonnaise","vinegar","honey"
  ],

  dessert:[
    "chocolate","banana","cream","vanilla","cocoa","cookie"
  ]

};

const LANG = {

  en:{
    subtitle:"AI Recipe Assistant",
    upload:"Upload ingredients photo",
    add:"Add ingredient",
    confirm:"Confirm ingredients",
    recipes:"Get Recipes",
    uploadTitle:"📸 Upload Ingredients",
    manualTitle:"✍ Manual Ingredient"
  },

  tr:{
    subtitle:"AI Tarif Asistanı",
    upload:"Malzeme fotoğrafı yükle",
    add:"Malzeme ekle",
    confirm:"Malzemeleri onayla",
    recipes:"Tarifleri Getir",
    uploadTitle:"📸 Malzeme Yükle",
    manualTitle:"✍ Manuel Malzeme"
  }

};

function applyLanguage(){

  const t = LANG[currentLang] || LANG.en;

  document.documentElement.lang = currentLang;

  const appSubtitle = document.getElementById("appSubtitle");
  const uploadTitle = document.getElementById("uploadTitle");
  const manualTitle = document.getElementById("manualTitle");
  const confirmText = document.getElementById("confirmText");

  if(appSubtitle) appSubtitle.innerText = t.subtitle;
  if(statusText) statusText.innerText = t.upload;
  if(manualInput) manualInput.placeholder = t.add;
  if(confirmText) confirmText.innerText = t.confirm;
  if(recipeBtn) recipeBtn.innerText = t.recipes;
  if(uploadTitle) uploadTitle.innerText = t.uploadTitle;
  if(manualTitle) manualTitle.innerText = t.manualTitle;

}

if(langSelect){

  langSelect.value = currentLang;

  langSelect.addEventListener("change", () => {

    currentLang = langSelect.value;

    localStorage.setItem("lang", currentLang);

    applyLanguage();

  });

}

function saveState(){

  localStorage.setItem(
    "selectedIngredients",
    JSON.stringify(selected)
  );

}

function loadState(){

  const saved =
  localStorage.getItem("selectedIngredients");

  if(saved){

    try{
      selected = JSON.parse(saved) || [];
    }catch{
      selected = [];
    }

  }

  renderChecklist();

}

function renderChecklist(){

  if(!checklist) return;

  if(!selected.length){

    checklist.innerHTML = "";

    return;

  }

  checklist.innerHTML =
  `
    <div class="selected-header">

      <div class="selected-box-title">
        ✅ Selected Ingredients
      </div>

      <button
        class="clear-btn"
        type="button"
        onclick="clearIngredients()"
      >
        Clear
      </button>

    </div>
  `
  +
  selected.map(item => `

    <label class="check-item">

      <input
        type="checkbox"
        checked
        onchange="removeIngredient('${item}')"
      >

      <span>${item}</span>

    </label>

  `).join("");

}

function addIngredient(value){

  const clean =
  String(value)
  .trim()
  .toLowerCase();

  if(!clean) return;

  if(!selected.includes(clean)){
    selected.push(clean);
  }

  saveState();
  renderChecklist();

}

window.removeIngredient = function(value){

  selected =
  selected.filter(item => item !== value);

  saveState();
  renderChecklist();

};

window.clearIngredients = function(){

  selected = [];

  saveState();
  renderChecklist();

};

window.addManual = function(){

  const value =
  manualInput.value
  .trim()
  .toLowerCase();

  if(!value) return;

  addIngredient(value);

  manualInput.value = "";

  if(statusText){
    statusText.innerText = "Ingredient added";
  }

};

if(manualInput){

  manualInput.addEventListener("keydown", e => {

    if(e.key === "Enter"){

      e.preventDefault();

      window.addManual();

    }

  });

}

function resetUploadStatus(){

  if(statusText){
    statusText.innerText = "Upload ingredients photo";
  }

  if(bar){
    bar.style.width = "0%";
  }

  if(photo){
    photo.value = "";
  }

}

if(photo){

  photo.addEventListener("change", async () => {

    const file = photo.files[0];

    if(!file) return;

    if(statusText){
      statusText.innerText = "Analyzing photo...";
    }

    if(bar){
      bar.style.width = "35%";
    }

    const formData = new FormData();

    formData.append("photo", file);

    try{

      if(bar){
        bar.style.width = "65%";
      }

      const res =
      await fetch("/analyze", {
        method:"POST",
        body:formData
      });

      const data =
      await res.json();

      if(!res.ok){

        if(statusText){
          statusText.innerText =
          data.details || "Analyze failed";
        }

        if(bar){
          bar.style.width = "0%";
        }

        return;

      }

      if(data.ingredients && data.ingredients.length){

        data.ingredients.forEach(item => {
          addIngredient(item);
        });

        if(statusText){
          statusText.innerText = "Ingredients detected";
        }

        if(bar){
          bar.style.width = "100%";
        }

        setTimeout(() => {
          resetUploadStatus();
        }, 1200);

      } else {

        if(statusText){
          statusText.innerText = "No ingredients found";
        }

        setTimeout(() => {
          resetUploadStatus();
        }, 1200);

      }

    }catch(err){

      console.error("FRONT ANALYZE ERROR:", err);

      if(statusText){
        statusText.innerText = "Analyze failed";
      }

      if(bar){
        bar.style.width = "0%";
      }

      setTimeout(() => {
        resetUploadStatus();
      }, 1200);

    }

  });

}

window.toggleCategories = function(){

  const grid =
  document.getElementById("categoryGrid");

  const arrow =
  document.getElementById("categoryArrow");

  if(!grid) return;

  grid.classList.toggle("collapsed");

  if(arrow){
    arrow.innerText =
    grid.classList.contains("collapsed")
    ? "▼"
    : "▲";
  }

};

function openIngredientModal(title, items){

  if(!ingredientModal || !ingredientModalItems) return;

  ingredientModal.style.display = "flex";

  if(ingredientModalTitle){
    ingredientModalTitle.innerText = title;
  }

  ingredientModalItems.innerHTML =
  items.map(item => `

    <button
      class="modal-ingredient-btn ${selected.includes(item) ? "active" : ""}"
      type="button"
      data-value="${item}"
    >
      ${item}
    </button>

  `).join("");

}

window.closeIngredientModal = function(){

  if(ingredientModal){
    ingredientModal.style.display = "none";
  }

};

document
.querySelectorAll(".category-btn")
.forEach(btn => {

  btn.addEventListener("click", () => {

    const key =
    btn.dataset.category;

    const items =
    CATEGORY_DATA[key] || [];

    document
    .querySelectorAll(".category-btn")
    .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    openIngredientModal(
      btn.innerText.trim(),
      items
    );

  });

});

if(ingredientModalItems){

  ingredientModalItems.addEventListener("click", e => {

    const btn =
    e.target.closest(".modal-ingredient-btn");

    if(!btn) return;

    const value =
    btn.dataset.value;

    if(selected.includes(value)){

      selected =
      selected.filter(item => item !== value);

      btn.classList.remove("active");

    } else {

      selected.push(value);

      btn.classList.add("active");

    }

    saveState();
    renderChecklist();

  });

}

if(recipeBtn){

  recipeBtn.addEventListener("click", async () => {

    console.log("GET RECIPES CLICKED", selected);

    console.log("FETCH START");

    result.innerHTML =
    "<p>Loading recipes...</p>";

    try{

      const res =
      await fetch("/recipes", {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          ingredients:selected,
          lang:currentLang
        })
      });

      const data =
      await res.json();

      console.log("FETCH STATUS:", res.status);
      console.log("FETCH DATA:", data);

      if(!res.ok){

        console.error(data);

        result.innerHTML =
        "<p>Recipes failed</p>";

        return;

      }

      currentRecipes = data;

      if(!Array.isArray(data) || !data.length){

        result.innerHTML =
        "<p>No recipes found</p>";

        return;

      }

      renderRecipes(data);

      const hero =
      document.querySelector(".hero");

      if(hero){
        hero.style.display = "none";
      }

      result.scrollIntoView({
        behavior:"smooth"
      });

    }catch(err){

      console.error("FRONT RECIPES ERROR:", err);

      console.error(err);

      result.innerHTML =
      "<p>Recipes failed</p>";

    }

  });

}

function renderRecipes(data){

  result.innerHTML =
  data.map(recipe => {

    const usedCount =
    recipe.usedIngredients && recipe.usedIngredients.length
    ? recipe.usedIngredients.length
    : selected.length;

    const usedList =
    recipe.usedIngredients && recipe.usedIngredients.length
    ? recipe.usedIngredients
        .slice(0,4)
        .map(item => `<span>${item.name || item.original || item}</span>`)
        .join("")
    : selected
        .slice(0,4)
        .map(item => `<span>${item}</span>`)
        .join("");

    return `

      <div
        class="card"
        data-recipe-id="${recipe.id}"
      >

        <img
          src="${
            recipe.image ||
            "https://img.spoonacular.com/recipes/716429-556x370.jpg"
          }"
          alt="${recipe.title || "Recipe"}"
        >

        <div class="card-body">

          <h3>
            ${recipe.title || "Recipe"}
          </h3>

          <p class="time">
            ⏱ ${recipe.readyInMinutes || 30} min
          </p>

          <div class="ingredients-count">
            🥗 Uses ${usedCount} ingredients
          </div>

          <div class="ingredients">
            ${usedList}
          </div>

        </div>

      </div>

    `;

  }).join("");

}

if(result){

  result.addEventListener("click", e => {

    const card =
    e.target.closest(".card");

    if(!card) return;

    const id =
    card.dataset.recipeId;

    openRecipe(id);

  });

}

function openRecipe(id){

  const recipe =
  currentRecipes.find(
    item => String(item.id) === String(id)
  );

  if(!recipe){

    modalBody.innerHTML =
    "<h2>Recipe not found</h2>";

    modal.style.display = "flex";

    return;

  }

  const ingredientHtml =
  recipe.usedIngredients && recipe.usedIngredients.length
  ? recipe.usedIngredients
      .map(item => `
        <span>
          ${item.name || item.original || item}
        </span>
      `).join("")
  : selected
      .map(item => `
        <span>
          ${item}
        </span>
      `).join("");

  modalBody.innerHTML = `

    <img
      src="${
        recipe.image ||
        "https://img.spoonacular.com/recipes/716429-556x370.jpg"
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
      ${recipe.title || "Recipe"}
    </h1>

    <p class="time">
      ⏱ ${recipe.readyInMinutes || 30} min
    </p>

    <h2>
      Ingredients
    </h2>

    <div class="ingredients">
      ${ingredientHtml}
    </div>

    <br>

    <h2>
      Instructions
    </h2>

    <p style="line-height:1.8;">
      ${
        recipe.instructions ||
        "Recipe instructions unavailable."
      }
    </p>

  `;

  modal.style.display = "flex";

}

window.closeModal = function(){

  if(modal){
    modal.style.display = "none";
  }

};

applyLanguage();
loadState();
resetUploadStatus();

console.log("APP JS LOADED");
console.log("RECIPE BUTTON:", recipeBtn);