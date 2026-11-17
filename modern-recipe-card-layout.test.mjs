import test from "node:test";
import assert from "node:assert/strict";
import {buildModernRecipeCard,labels} from "./modern-recipe-card-layout.mjs";
const recipe={lang:"en",title:"Menemen",ingredients:["3 Eggs","2 Peppers"],steps:["Cook gently."],fonts:{body:"",script:""}};
test("all ten languages retain every ingredient and numbered instruction",()=>{
for(const lang of Object.keys(labels)){
const ingredients=Array.from({length:22},(_,i)=>"Ingredient "+i);
const steps=Array.from({length:13},(_,i)=>"Instruction "+i);
const html=buildModernRecipeCard({...recipe,lang,ingredients,steps});
for(const line of [...ingredients,...steps])assert.ok(html.includes(">"+line+"<"));
assert.ok(html.includes('class="number">13</span>'));
assert.ok(html.includes(lang==="ar"?'dir="rtl"':'dir="ltr"'));
}});
test("recipe text cannot inject markup",()=>{
const html=buildModernRecipeCard({...recipe,title:'<script>alert("x")</script>',ingredients:["<img onerror=bad>"],steps:["A & B"]});
assert.ok(html.includes("&lt;script&gt;"));
assert.ok(html.includes("&lt;img onerror=bad&gt;"));
assert.ok(html.includes("A &amp; B"));
assert.ok(!html.includes('<script>alert'));
});
test("invalid language and empty content fail before rendering",()=>{
assert.throws(()=>buildModernRecipeCard({...recipe,lang:"xx"}));
assert.throws(()=>buildModernRecipeCard({...recipe,ingredients:[]}));
assert.throws(()=>buildModernRecipeCard({...recipe,steps:[]}));
});
test("layout marks overflow for the renderer and has all seven regions",()=>{
const html=buildModernRecipeCard(recipe);
for(const name of ["hero","stats","columns","ingredients","instructions","footer","card-layout"])assert.ok(html.includes(name));
assert.ok(html.includes('content=ok?"ok":"overflow"'));
});
