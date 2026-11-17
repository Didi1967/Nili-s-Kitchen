import test from "node:test";
import assert from "node:assert/strict";
import { isManualRecipeCardRequest } from "./recipe-card-policy.mjs";
test("explicit admin production actions remain available", () => {
  for (const reason of ["admin-single", "admin-recipe-languages", "admin-bulk", "admin-selected", "ingredient-repair:tomato"]) {
    assert.equal(isManualRecipeCardRequest(reason), true, reason);
  }
});
test("automatic, legacy and unrecognized jobs cannot produce cards", () => {
  for (const reason of ["automatic", "recipe-approved", "approved-excel-import", "ingredient-repair:", "admin-unrecognized", undefined, null]) {
    assert.equal(isManualRecipeCardRequest(reason), false, String(reason));
  }
});
