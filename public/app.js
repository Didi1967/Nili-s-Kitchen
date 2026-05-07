/* ELEMENTS */

const screen =
document.getElementById("screen");

const photo =
document.getElementById("photo");

const statusText =
document.getElementById("statusText");

const bar =
document.getElementById("bar");

const category =
document.getElementById("category");

const checklist =
document.getElementById("checklist");

const manualInput =
document.getElementById("manualInput");

const recipeBtn =
document.getElementById("recipeBtn");

const confirmCheck =
document.getElementById("confirmCheck");

const modal =
document.getElementById("modal");

const modalBody =
document.getElementById("modalBody");

/* DATA */

let selected = [];

/* MOSAIC */

const DISHES = [

  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",

  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",

  "https://images.unsplash.com/photo-1525755662778-989d0524087e",

  "https://images.unsplash.com/photo-1498837167922-ddd27525d352"

];

/* CATEGORY */

const CATEGORIES = {

  Protein:[
    "chicken",
    "beef",
    "egg",
    "fish",
    "salmon",
    "shrimp"
  ],

  Carbs:[
    "rice",
    "pasta",
    "bread",
    "potato"
  ],

  Vegetables:[
    "tomato",
    "onion",
    "garlic",
    "pepper",
    "carrot",
    "broccoli"
  ],

  Fruits:[
    "apple",
    "banana",
    "orange",
    "lemon"
  ],

  Dairy:[
    "milk",
    "cheese",
    "butter",
    "yogurt"
  ]

};

/* HOME */

function renderHome(){

  screen.innerHTML = `

    <div class="mosaic">

      <div class="left-mosaic">

        <img src="${DISHES[0]}">

      </div>

      <div class="right-mosaic">

        <img src="${DISHES[1]}">

        <img src="${DISHES[2]}">

        <img src="${DISHES[3]}">

      </div>

    </div>

  `;

}

/* CATEGORY */

function renderCategories(){

  let html = "";

  for(let k in CATEGORIES){

    html += `

      <details open>

        <summary>${k}</summary>

    `;

    CATEGORIES[k].forEach(x=>{

      html += `

        <label>

          <input
            type="checkbox"
            onchange="
              toggleIngredient(
                '${x}',
                this
              )
            "
          >

          ${x}

        </label>

      `;

    });

    html += `</details>`;

  }

  category.innerHTML = html;

}

/* TOGGLE */

function toggleIngredient(v,e){

  if(e.checked){

    selected.push(v);

  }else{

    selected =
    selected.filter(x=>x!==v);

  }

  selected = [...new Set(selected)];

  renderChecklist();

}

/* CHECKLIST */

function renderChecklist(){

  checklist.innerHTML = `

    <h3>
      Selected Ingredients
    </h3>

    ${selected.map(x=>`

      <label>

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

    `).join("")}

  `;

}

/* REMOVE */

function removeIngredient(v){

  selected =
  selected.filter(x=>x!==v);

  renderChecklist();

}

/* MANUAL */

function addManual(){

  const v =
  manualInput.value.trim();

  if(!v) return;

  selected.push(v.toLowerCase());

  selected = [...new Set(selected)];

  manualInput.value = "";

  renderChecklist();

}

/* UPLOAD */

photo.addEventListener(
  "change",
  async ()=>{

    const file =
    photo.files[0];

    if(!file) return;

    statusText.innerText =
    "Uploading...";

    bar.style.width = "30%";

    await sleep(600);

    statusText.innerText =
    "Analyzing...";

    bar.style.width = "70%";

    const fd =
    new FormData();

    fd.append("image",file);

    try{

      const r =
      await fetch("/analyze",{

        method:"POST",

        body:fd

      });

      const d =
      await r.json();

      if(d.ingredients){

        selected = [

          ...new Set([

            ...selected,

            ...d.ingredients

          ])

        ];

        renderChecklist();

      }

    }catch(e){

      console.log(e);

    }

    statusText.innerText =
    "Completed";

    bar.style.width = "100%";

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

    screen.innerHTML = `

      <div style="
        font-size:34px;
        text-align:center;
        padding-top:80px;
      ">

        🍳 Loading recipes...

      </div>

    `;

    try{

      const r =
      await fetch("/recipes",{

        method:"POST",

        headers:{
          "Content-Type":
          "application/json"
        },

        body:JSON.stringify({
          ingredients:selected
        })

      });

      const d =
      await r.json();

      let html = "";

      d.recipes.forEach(x=>{

        const ingredients = [

          "tomato",
          "cheese",
          "garlic",
          "onion"

        ];

        html += `

          <div
            class="card"
            data-id="${x.id}"
            data-source="${x.source}"
          >

            <img
              src="${
                x.image.replace(
                  '312x231',
                  '636x393'
                )
              }"
            >

            <div class="card-body">

              <h3>
                ${x.title}
              </h3>

              <p class="time">

                ⏱ 25 min

              </p>

              <div class="ingredients">

                ${ingredients.map(i=>`

                  <span>${i}</span>

                `).join("")}

              </div>

            </div>

          </div>

        `;

      });

      screen.innerHTML = `

        <div class="grid">

          ${html}

        </div>

      `;

      document
      .querySelectorAll(".card")
      .forEach(card=>{

        card.addEventListener(
          "click",
          ()=>{

            const id =
            card.dataset.id;

            openRecipe(id);

        });

      });

    }catch(e){

      console.log(e);

      alert(
        "Recipe crashed"
      );

    }

});

/* DETAIL */

async function openRecipe(id){

  try{

    const r =
    await fetch(
      "/spoon-recipe/" + id
    );

    const recipe =
    await r.json();

    modalBody.innerHTML = `

      <img
        src="${recipe.image}"
        style="
          width:100%;
          border-radius:20px;
          margin-bottom:20px;
        "
      >

      <h1>
        ${recipe.title}
      </h1>

      <h2>
        Ingredients
      </h2>

      <ul>

        ${(
          recipe.ingredients || []
        ).map(i=>`

          <li>${i}</li>

        `).join("")}

      </ul>

      <h2>
        Instructions
      </h2>

      <p style="
        white-space:pre-line
      ">

        ${
          recipe.instructions ||
          "No instructions"
        }

      </p>

    `;

    modal.style.display =
    "block";

  }catch(e){

    console.log(e);

  }

}

/* CLOSE */

function closeModal(){

  modal.style.display =
  "none";

}

/* UTIL */

function sleep(ms){

  return new Promise(
    r=>setTimeout(r,ms)
  );

}

/* INIT */

renderHome();

renderCategories();

renderChecklist();