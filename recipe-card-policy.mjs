// Only explicit admin actions may enqueue or execute recipe cards.
const manualReasons = new Set(["admin-single", "admin-recipe-languages", "admin-bulk", "admin-selected"]);
export function isManualRecipeCardRequest(reason) {
  return manualReasons.has(reason) ||
    (typeof reason === "string" && reason.startsWith("ingredient-repair:") && reason.length > "ingredient-repair:".length);
}
