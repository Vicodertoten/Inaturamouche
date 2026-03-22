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

test("SmartCache applies dynamic TTLs during revalidation without refreshing stale values immediately", async () => {
  const cache = new SmartCache({ ttl: 10, staleTtl: 200 });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let fetchCount = 0;

  cache.set("k", "old");
  await sleep(20);

  const staleValue = await cache.getOrFetch(
    "k",
    async () => {
      fetchCount += 1;
      await sleep(30);
      return fetchCount === 1 ? "fresh" : "fresher";
    },
    {
      resolveEntryOptions: (value) => (value === "fresh" ? { ttl: 50, staleTtl: 100 } : { ttl: 10, staleTtl: 20 }),
    }
  );

  assert.equal(staleValue, "old");
  assert.equal(cache.getEntry("k")?.isStale, true);

  await sleep(40);
  const refreshed = cache.getEntry("k");
  assert.equal(refreshed?.value, "fresh");
  assert.equal(refreshed?.isStale, false);
  assert.equal(fetchCount, 1);
});
