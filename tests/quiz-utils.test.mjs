import test from "node:test";
import assert from "node:assert/strict";
import { buildCacheKey, effectiveCooldownN, HistoryBuffer, lcaDepth, shuffleFisherYates } from "../lib/quiz-utils.js";
import { SmartCache } from "../lib/smart-cache.js";

test("buildCacheKey sorts keys and flattens arrays", () => {
  const key = buildCacheKey({ b: 2, a: ["x", "y"], c: 3 });
  assert.equal(key, "a=x,y|b=2|c=3");
});

test("effectiveCooldownN respects quiz choices and bounds", () => {
  assert.equal(effectiveCooldownN(10, 5, 4), 1);
  assert.equal(effectiveCooldownN(10, 2, 4), 0);
  assert.equal(effectiveCooldownN(3, 100, 4), 3);
});

test("lcaDepth returns common ancestor depth", () => {
  const depth = lcaDepth([1, 2, 3, 4], [1, 2, 9]);
  assert.equal(depth, 2);
  assert.equal(lcaDepth([], [1, 2]), 0);
});

test("shuffleFisherYates keeps all items", () => {
  const arr = [1, 2, 3, 4];
  const shuffled = shuffleFisherYates(arr);
  assert.deepEqual(arr.sort(), shuffled.slice().sort());
});

test("SmartCache evicts oldest entries", () => {
  const cache = new SmartCache({ max: 2, ttl: 0 });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
});
