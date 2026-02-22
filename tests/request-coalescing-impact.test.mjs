/**
 * Integration test demonstrating Request Coalescing impact
 * 
 * Compares API call counts with and without coalescing
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { SmartCache } from "../lib/smart-cache.js";

describe("Request Coalescing - Real World Impact", () => {
  it("demonstrates API call reduction with 100 concurrent requests", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    let apiCallCount = 0;

    const slowApiCall = async () => {
      apiCallCount++;
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        data: `API Response #${apiCallCount}`,
        timestamp: Date.now(),
      };
    };

    console.log("\n=== Request Coalescing Impact Test ===\n");

    // Simulate 100 concurrent requests arriving simultaneously
    const concurrentRequests = 100;
    const promises = Array(concurrentRequests)
      .fill(null)
      .map(() => cache.getOrFetch("api-endpoint", slowApiCall));

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`Concurrent Requests: ${concurrentRequests}`);
    console.log(`Actual API Calls: ${apiCallCount}`);
    console.log(`Reduction: ${((1 - apiCallCount / concurrentRequests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${duration}ms`);
    console.log(
      `Without Coalescing: ~${concurrentRequests * 100}ms (100ms × ${concurrentRequests})`
    );
    console.log(`Speedup: ${(concurrentRequests * 100 / duration).toFixed(1)}x\n`);

    // Assertions
    assert.equal(apiCallCount, 1, "Should make exactly 1 API call");
    assert.equal(
      results.length,
      concurrentRequests,
      "All requests should resolve successfully"
    );
    assert.ok(
      results.every((r) => r.data === results[0].data),
      "All results should be identical"
    );
    // CI/dev environments can add scheduling overhead; keep a pragmatic upper bound.
    assert.ok(duration < 600, "Duration should stay close to one API call");
  });

  it("shows cache stampede prevention with stale revalidation", async () => {
    const cache = new SmartCache({
      ttl: 100,
      staleTtl: 200,
    });
    let apiCallCount = 0;

    const fetchData = async () => {
      apiCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { version: apiCallCount, timestamp: Date.now() };
    };

    console.log("\n=== Cache Stampede Prevention ===\n");

    // Initial load
    await cache.getOrFetch("key", fetchData);
    assert.equal(apiCallCount, 1);
    console.log("✓ Initial load: 1 API call");

    // Wait for fresh to expire
    await new Promise((resolve) => setTimeout(resolve, 120));

    // 50 concurrent requests arrive
    const promises = Array(50)
      .fill(null)
      .map(() => cache.getOrFetch("key", fetchData, { allowStale: false }));

    const results = await Promise.all(promises);

    console.log(`✓ After cache expiry: 50 concurrent requests`);
    console.log(`✓ Additional API calls: ${apiCallCount - 1}`);
    console.log(`✓ All requests received consistent data: ${results.every((r) => r.version === 2)}`);

    // Only 1 additional API call should have been made
    assert.equal(apiCallCount, 2, "Should make only 2 API calls total");
    assert.ok(
      results.every((r) => r.version === 2),
      "All should have fresh data from 2nd API call"
    );
  });

  it("validates coalescing doesn't interfere with different keys", async () => {
    const cache = new SmartCache({ ttl: 5000 });
    const callCounts = {};

    const fetcher = async (key) => {
      callCounts[key] = (callCounts[key] || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `result-${key}`;
    };

    console.log("\n=== Key Isolation Test ===\n");

    // 100 requests for each of 5 different keys
    const promises = [];
    for (let key = 1; key <= 5; key++) {
      for (let i = 0; i < 100; i++) {
        promises.push(cache.getOrFetch(`key-${key}`, () => fetcher(`key-${key}`)));
      }
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    console.log(`Total requests: ${promises.length}`);
    console.log(`Unique keys: 5`);
    console.log(`API calls made: ${Object.values(callCounts).reduce((a, b) => a + b, 0)}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Results valid: ${results.length === promises.length}\n`);

    // Each key should have exactly 1 API call
    Object.values(callCounts).forEach((count) => {
      assert.equal(count, 1, "Each key should be fetched exactly once");
    });
  });

  it("stress test: large concurrent load", async () => {
    const cache = new SmartCache({ ttl: 10000 });
    let apiCallCount = 0;
    const callDetails = [];

    const heavyFetch = async () => {
      apiCallCount++;
      const startTime = Date.now();
      callDetails.push({ callNumber: apiCallCount, startTime });
      
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      return {
        callNumber: apiCallCount,
        duration: Date.now() - startTime,
      };
    };

    console.log("\n=== Stress Test: 1000 Concurrent Requests ===\n");

    const concurrentRequests = 1000;
    const promises = Array(concurrentRequests)
      .fill(null)
      .map(() => cache.getOrFetch("stress-test", heavyFetch));

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    console.log(`Concurrent requests: ${concurrentRequests}`);
    console.log(`Actual API calls: ${apiCallCount}`);
    console.log(`Call reduction: ${((1 - apiCallCount / concurrentRequests) * 100).toFixed(2)}%`);
    console.log(`Total time: ${totalDuration}ms`);
    console.log(`Average per request: ${(totalDuration / concurrentRequests).toFixed(2)}ms`);
    console.log(
      `Memory efficiency: Each request shares the same ${
        JSON.stringify(results[0]).length
      } byte response\n`
    );

    assert.equal(apiCallCount, 1, "Should make exactly 1 API call for 1000 requests");
    assert.ok(
      totalDuration < 300,
      "Should complete in ~200ms (one API call + overhead)"
    );
    assert.ok(
      results.every((r) => r.callNumber === 1),
      "All results should be from first API call"
    );
  });
});
