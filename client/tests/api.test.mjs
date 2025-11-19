import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchParams } from "../src/services/api.js";

test("buildSearchParams ignores empty values and serializes arrays", () => {
  const params = buildSearchParams({
    include_taxa: ["1", "2", ""],
    q: "fox",
    empty: "",
    nullable: null,
  });

  assert.equal(params.get("include_taxa"), "1,2");
  assert.equal(params.get("q"), "fox");
  assert.equal(params.has("empty"), false);
  assert.equal(params.has("nullable"), false);
});
