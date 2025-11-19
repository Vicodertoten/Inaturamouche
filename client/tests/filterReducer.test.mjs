import test from "node:test";
import assert from "node:assert/strict";
import { customFilterReducer, initialCustomFilters } from "../src/state/filterReducer.js";

test("customFilterReducer adds and removes taxa", () => {
  const taxon = { id: "42", name: "Test taxon" };
  const added = customFilterReducer(initialCustomFilters, { type: "ADD_INCLUDED_TAXON", payload: taxon });
  assert.equal(added.includedTaxa.length, 1);

  const removed = customFilterReducer(added, { type: "REMOVE_INCLUDED_TAXON", payload: "42" });
  assert.equal(removed.includedTaxa.length, 0);
});

test("customFilterReducer toggles flags", () => {
  const toggled = customFilterReducer(initialCustomFilters, { type: "TOGGLE_PLACE" });
  assert.equal(toggled.place_enabled, true);
  const toggledBack = customFilterReducer(toggled, { type: "TOGGLE_PLACE" });
  assert.equal(toggledBack.place_enabled, false);
});
