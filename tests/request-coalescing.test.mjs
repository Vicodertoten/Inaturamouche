import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { SmartCache } from "../lib/smart-cache.js";

describe("SmartCache - Request Coalescing", () => {
  it("should coalesce multiple concurrent requests for the same key", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    let callCount = 0;

    const fetcher = async () => {
      callCount++;
      // Simulate a slow API call
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { data: "result", id: callCount };
    };

    // Fire 5 concurrent requests for the same key
    const promises = Array(5)
      .fill(null)
      .map(() => cache.getOrFetch("test-key", fetcher));

    const results = await Promise.all(promises);

    // All requests should return the same result
    assert.equal(callCount, 1, "fetcher should be called only once");
    assert.equal(results.length, 5, "should return 5 results");
    assert.deepEqual(results[0], results[1], "all results should be identical");
    assert.deepEqual(results[0], results[4], "first and last results should be identical");
    assert.deepEqual(results[0].id, 1, "all should have id 1 from first fetcher call");
  });

  it("should handle errors correctly during coalescing", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    let callCount = 0;

    const fetcher = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      throw new Error("API error");
    };

    const promises = Array(3)
      .fill(null)
      .map(() => cache.getOrFetch("error-key", fetcher).catch((err) => err));

    const results = await Promise.all(promises);

    // All requests should receive the same error
    assert.equal(callCount, 1, "fetcher should be called only once");
    assert.equal(results.length, 3, "should return 3 results");
    assert.ok(results[0] instanceof Error, "result should be an error");
    assert.equal(results[0].message, "API error");
    assert.deepEqual(results[0], results[1], "all errors should be identical");
  });

  it("should not coalesce requests for different keys", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    const callCounts = {};

    const fetcher = async (key) => {
      callCounts[key] = (callCounts[key] || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return `result-${key}`;
    };

    const promises = [
      cache.getOrFetch("unique-key-a", () => fetcher("a")),
      cache.getOrFetch("unique-key-b", () => fetcher("b")),
      cache.getOrFetch("unique-key-c", () => fetcher("c")),
    ];

    const results = await Promise.all(promises);

    // Each request should call fetcher
    assert.equal(callCounts.a, 1, "fetcher should be called once for key a");
    assert.equal(callCounts.b, 1, "fetcher should be called once for key b");
    assert.equal(callCounts.c, 1, "fetcher should be called once for key c");
    assert.equal(results[0], "result-a");
    assert.equal(results[1], "result-b");
    assert.equal(results[2], "result-c");
  });

  it("should allow new requests after first request completes", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    let callCount = 0;

    const fetcher = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return `result-${callCount}`;
    };

    // First batch of concurrent requests
    const result1 = await cache.getOrFetch("sequential-key", fetcher);
    assert.equal(result1, "result-1");
    assert.equal(callCount, 1);

    // Second batch after first completes
    const result2 = await cache.getOrFetch("sequential-key", fetcher);
    assert.equal(result2, "result-1", "second request should come from cache");
    assert.equal(callCount, 1, "fetcher should still be called only once");
  });

  it("should clean up in-flight requests on delete", async () => {
    const cache = new SmartCache({ ttl: 5000 });

    const fetcher = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "result";
    };

    // Start a request but delete before it completes
    const promise = cache.getOrFetch("cleanup-key", fetcher);
    cache.delete("cleanup-key");

    // The promise should still resolve, but inFlightRequests should be cleaned up after
    await promise;
    assert.equal(cache.inFlightRequests.has("cleanup-key"), false, "in-flight request should be cleaned up");
  });

  it("should clean up all in-flight requests on clear", async () => {
    const cache = new SmartCache({ ttl: 5000 });

    const fetcher = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "result";
    };

    // Start multiple requests
    const promises = [
      cache.getOrFetch("key-1", fetcher),
      cache.getOrFetch("key-2", fetcher),
    ];

    cache.clear();
    assert.equal(cache.inFlightRequests.size, 0, "all in-flight requests should be cleared");

    // Requests should still complete
    const results = await Promise.all(promises);
    assert.equal(results.length, 2);
  });

  it("should prevent cache stampede with concurrent stale revalidations", async () => {
    const cache = new SmartCache({ ttl: 100, staleTtl: 1000 });
    let callCount = 0;

    const fetcher = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { data: "result", version: callCount };
    };

    // Initial request
    const result1 = await cache.getOrFetch("stampede-key", fetcher);
    assert.equal(callCount, 1);
    assert.equal(result1.version, 1);

    // Wait for cache to become stale
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Multiple concurrent requests should coalesce the revalidation
    const promises = Array(5)
      .fill(null)
      .map(() => cache.getOrFetch("stampede-key", fetcher, { allowStale: false }));

    const results = await Promise.all(promises);

    // Only one additional fetcher call should be made
    assert.equal(callCount, 2, "should revalidate only once");
    assert.ok(results.every((r) => r.version === 2), "all should get version 2");
  });
});
