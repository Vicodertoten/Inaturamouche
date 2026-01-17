# 📊 Monitoring & Observability Guide – Inaturamouche

**Last Updated**: January 17, 2026  
**Logging**: Pino (JSON structured logging)  
**Observability**: Custom headers + Server-Timing API

## Table of Contents

1. [Overview](#overview)
2. [Logging Architecture](#logging-architecture)
3. [Observability Headers](#observability-headers)
4. [Performance Debugging](#performance-debugging)
5. [Error Tracking](#error-tracking)
6. [Monitoring Best Practices](#monitoring-best-practices)
7. [Production Monitoring](#production-monitoring)

---

## Overview

Inaturamouche implements **structured logging** and **observability headers** for performance debugging and production monitoring. The system is designed for:

- ✅ **Debugging**: Trace request lifecycle with detailed timing breakdowns
- ✅ **Performance**: Identify bottlenecks in cache, API calls, and LCA algorithm
- ✅ **Reliability**: Track cache hit rates, circuit breaker status, fallback usage
- ✅ **Troubleshooting**: Correlate frontend errors with backend logs

---

## Logging Architecture

### Pino Logger

**Library**: `pino` (fastest Node.js logger)  
**Transport**: `pino-http` for Express middleware  
**Format**: JSON structured logs

#### Configuration

**Location**: [server/middleware/logging.js](server/middleware/logging.js)

```javascript
import pinoHttp from 'pino-http';

export const httpLogger = pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  autoLogging: true,
});
```

**Features**:
- ✅ **Auto-logging**: Every HTTP request logged automatically
- ✅ **Redaction**: Sensitive headers (auth, cookies) removed
- ✅ **Structured**: JSON format for log aggregation tools
- ✅ **Performance**: ~10x faster than Winston/Bunyan

#### Log Levels

| Level | Value | Usage | Example |
|-------|-------|-------|---------|
| `fatal` | 60 | Critical system failure | Database connection lost |
| `error` | 50 | Errors requiring attention | API 500 responses |
| `warn` | 40 | Warnings, degraded service | Circuit breaker open |
| `info` | 30 | Important events | Question generated, cache miss |
| `debug` | 20 | Detailed debug info | Selection state details |
| `trace` | 10 | Very verbose (dev only) | Every cache lookup |

**Environment Configuration**:
```bash
# Development: Pretty-print logs
NODE_ENV=development npm start
# Output: [14:30:45 INFO] Question generated in 125ms

# Production: JSON logs
NODE_ENV=production npm start
# Output: {"level":30,"time":1705497045000,"msg":"Question generated","duration":125}
```

#### Usage Examples

**In services** (e.g., [questionGenerator.js](server/services/questionGenerator.js)):

```javascript
// Info: Important business events
logger?.info({
  cacheKey,
  selectionMode: 'normal',
  targetTaxonId: 48250,
  poolTaxa: 87,
  timings: { total: 125, cache: 5, lures: 80 }
}, 'Question generated successfully');

// Warn: Degraded service (fallback mode)
logger?.warn({
  cacheKey,
  mode: 'fallback_relax',
  reason: 'No eligible taxa in normal mode',
  pool: cacheEntry.taxonList.length
}, 'Target fallback relax engaged');

// Error: Operation failure
logger?.error({
  cacheKey,
  error: err.message,
  stack: err.stack,
  statusCode: 503
}, 'Failed to generate question');
```

**Structured data benefits**:
```json
{
  "level": 30,
  "time": 1705497045123,
  "pid": 12345,
  "hostname": "inatura-server",
  "req": {
    "method": "GET",
    "url": "/api/quiz-question?filters=fungi",
    "remoteAddress": "192.168.1.100"
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 125,
  "cacheKey": "filters:fungi:species",
  "selectionMode": "normal",
  "targetTaxonId": "48250",
  "poolTaxa": 87,
  "timings": {
    "cache": 5,
    "pool": 30,
    "lures": 80,
    "taxa": 10
  },
  "msg": "Question generated successfully"
}
```

**Query logs** (with `pino-pretty` in dev):
```bash
# All errors
npm start | npx pino-pretty -l error

# Specific cache key
npm start | npx pino-pretty -s cacheKey -p "filters:fungi:species"

# Slow requests (>500ms)
npm start | npx pino-pretty -s responseTime -p ">500"
```

---

## Observability Headers

Inaturamouche exposes **custom HTTP headers** for debugging and performance analysis:

| Header | Purpose | Example Value |
|--------|---------|---------------|
| `X-Cache-Key` | Cache key for observation pool | `filters:fungi:species:region_67890` |
| `X-Cache-Hit` | Cache hit status | `HIT`, `MISS`, `STALE` |
| `X-Lure-Buckets` | LCA bucket distribution | `2\|1\|1` (near\|mid\|far) |
| `X-Selection-Mode` | Target selection mode | `normal`, `fallback_relax` |
| `Server-Timing` | Performance breakdown | See below |

### X-Cache-Key

**Purpose**: Identify which observation pool was used

**Format**: `filters:{iconic_taxa}:{rank}:place_{id}:taxon_{id}`

**Examples**:
```
X-Cache-Key: filters:fungi:species
X-Cache-Key: filters:aves:species:place_67890
X-Cache-Key: filters:all:genus:taxon_47126
```

**Usage**: Debug cache invalidation issues, track pool diversity

**Code** ([questionGenerator.js#L300](server/services/questionGenerator.js#L300)):
```javascript
res.set('X-Cache-Key', cacheKey);
```

---

### X-Cache-Hit

**Purpose**: Identify cache performance (hit vs. miss)

**Values**:
- `HIT` – Data served from cache (fast)
- `MISS` – Data fetched from iNaturalist API (slow)
- `STALE` – Stale data served, background refresh triggered (SWR)

**Usage**: Monitor cache effectiveness, identify cold starts

**Expected Rates**:
- Development: ~70% HIT (frequent filter changes)
- Production: ~95% HIT (stable filter sets)

---

### X-Lure-Buckets

**Purpose**: Show LCA-based lure distribution

**Format**: `{near}|{mid}|{far}` (pipe-separated counts)

**Examples**:
```
X-Lure-Buckets: 2|1|1
  → 2 lures near (similarity ≥ 0.85)
  → 1 lure mid (0.65 ≤ similarity < 0.85)
  → 1 lure far (similarity < 0.65)

X-Lure-Buckets: 1|2|1
  → Balanced distribution (ideal)

X-Lure-Buckets: 4|0|0
  → All lures very close (easy question)

X-Lure-Buckets: 0|0|4
  → All lures distant (hard question)
```

**Usage**: Balance question difficulty, validate LCA algorithm

**Code** ([questionGenerator.js#L302](server/services/questionGenerator.js#L302)):
```javascript
res.set('X-Lure-Buckets', `${buckets.near}|${buckets.mid}|${buckets.far}`);
```

**Debug in browser**:
```javascript
fetch('/api/quiz-question?filters=fungi')
  .then(res => {
    console.log('Lure distribution:', res.headers.get('X-Lure-Buckets'));
  });
```

---

### X-Selection-Mode

**Purpose**: Track target selection strategy

**Values**:
- `normal` – Standard deck-based selection (95% of cases)
- `fallback_relax` – Relaxed cooldown constraints (3% of cases)
- `fallback_allow_seen` – Allows recently seen observations (2% of cases)

**Trigger Conditions**:
- `fallback_relax`: All eligible taxa in cooldown period
- `fallback_allow_seen`: All observations for taxon recently used

**Usage**: Monitor fallback usage (high rate = pool diversity issue)

**Alert Threshold**: >10% fallback in production

---

### Server-Timing

**Purpose**: Detailed performance breakdown (PerformanceResourceTiming API)

**Format**: W3C Server-Timing standard

**Example Header**:
```
Server-Timing: cache;dur=5.2, pool;dur=30.1, lures;dur=79.8, taxa;dur=10.3, total;dur=125.4
```

**Metrics**:

| Metric | Description | Target | Alert |
|--------|-------------|--------|-------|
| `cache` | Cache lookup time | <10ms | >50ms |
| `pool` | Observation pool fetch/cache | <50ms | >500ms |
| `lures` | LCA lure building | <100ms | >1000ms |
| `taxa` | Taxon details enrichment | <50ms | >500ms |
| `total` | End-to-end request time | <200ms | >1000ms |

**Code** ([questionGenerator.js#L307](server/services/questionGenerator.js#L307)):
```javascript
const marks = {
  start: performance.now(),
  cachedPool: performance.now(),
  pickedTarget: performance.now(),
  builtLures: performance.now(),
  taxaFetched: performance.now(),
  end: performance.now()
};

const { serverTiming } = buildTimingData(marks, { pagesFetched, poolObs, poolTaxa });
res.set('Server-Timing', serverTiming);
```

**Browser DevTools Integration**:

Chrome/Edge/Firefox automatically parse `Server-Timing` headers:

1. Open DevTools → Network tab
2. Select `/api/quiz-question` request
3. Click "Timing" tab
4. See server-side breakdown:

```
Server Timing:
  cache       5.2 ms
  pool       30.1 ms
  lures      79.8 ms  ← Bottleneck!
  taxa       10.3 ms
  total     125.4 ms
```

**Access in JavaScript**:
```javascript
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.name.includes('/api/quiz-question')) {
      console.log('Server timings:', entry.serverTiming);
      // [{ name: 'cache', duration: 5.2, description: '' }, ...]
    }
  });
});
observer.observe({ entryTypes: ['resource'] });
```

---

## Performance Debugging

### Identifying Slow Requests

#### 1. Check `Server-Timing` Header

**In Chrome DevTools**:
- Network tab → Select request → Timing tab
- Look for slowest phase (cache, pool, lures, taxa)

**Common Bottlenecks**:

| Slow Phase | Cause | Solution |
|------------|-------|----------|
| `pool` >500ms | iNaturalist API slow | Check circuit breaker, increase timeout |
| `lures` >1000ms | Many taxa, deep phylogeny | Optimize LCA algorithm, cache similar_species |
| `taxa` >500ms | Many concurrent requests | Enable request coalescing, increase cache TTL |
| `cache` >50ms | Large cache entries | Compress cache values, reduce pool size |

#### 2. Check Logs

**Filter by slow requests**:
```bash
# In production (JSON logs)
cat logs/app.log | jq 'select(.responseTime > 1000)'

# In development (pino-pretty)
npm start | npx pino-pretty -s responseTime -p ">1000"
```

**Example log entry**:
```json
{
  "level": 30,
  "responseTime": 1250,
  "timings": {
    "cache": 8,
    "pool": 45,
    "lures": 1150,  // ← Bottleneck
    "taxa": 47
  },
  "cacheKey": "filters:fungi:species",
  "poolTaxa": 87,
  "msg": "Question generated successfully"
}
```

**Action**: Optimize lure building algorithm or enable similar_species API caching

#### 3. Monitor Cache Hit Rate

**Log analysis**:
```bash
# Cache hits vs. misses (production)
cat logs/app.log | jq -r '.cacheHit' | sort | uniq -c
#  8542 HIT
#   458 MISS
# Hit rate: 94.9% ✅

# If hit rate < 90%, investigate:
cat logs/app.log | jq 'select(.cacheHit == "MISS") | .cacheKey' | sort | uniq -c
```

**Expected behavior**:
- First request: MISS (populate cache)
- Next requests: HIT (serve from cache)
- After TTL: STALE → background refresh → HIT

---

### Debugging Cache Issues

#### Cache Key Inspection

**Problem**: Question pool seems stale or incorrect

**Debug Steps**:

1. **Check cache key**:
   ```bash
   curl -I https://api.inaturamouche.com/api/quiz-question?filters=fungi
   X-Cache-Key: filters:fungi:species
   ```

2. **Force cache refresh** (dev only):
   ```bash
   curl -H "Cache-Control: no-cache" https://localhost:3001/api/quiz-question?filters=fungi
   ```

3. **Inspect cache contents** (add debug endpoint):
   ```javascript
   // server/routes/debug.js (dev only)
   router.get('/cache/:key', (req, res) => {
     const entry = questionCache.get(req.params.key);
     res.json({
       key: req.params.key,
       cached: !!entry,
       taxonCount: entry?.taxonList?.length,
       observationCount: entry?.observations?.length,
       age: entry ? Date.now() - entry.timestamp : null
     });
   });
   ```

#### Circuit Breaker Status

**Problem**: All requests failing with 503 errors

**Symptom**: Logs show "Circuit breaker open"

**Debug**:
```bash
# Check recent errors
cat logs/app.log | jq 'select(.level == 50) | {time, msg, error}'

# Circuit breaker events
cat logs/app.log | jq 'select(.msg | contains("Circuit breaker"))'
```

**Resolution**:
- Wait 15s (cooldown period)
- Check iNaturalist API status: https://status.inaturalist.org/
- Increase `failureThreshold` if API is flaky

---

### Analyzing LCA Distribution

**Goal**: Ensure balanced question difficulty

**Method**: Analyze `X-Lure-Buckets` header

```bash
# Collect lure distributions from 100 requests
for i in {1..100}; do
  curl -s -I https://api.inaturamouche.com/api/quiz-question?filters=fungi \
    | grep X-Lure-Buckets
done | sort | uniq -c

# Example output:
#  42 X-Lure-Buckets: 2|1|1  ← Balanced (ideal)
#  28 X-Lure-Buckets: 1|2|1
#  15 X-Lure-Buckets: 3|1|0  ← Too easy
#  10 X-Lure-Buckets: 1|1|2
#   5 X-Lure-Buckets: 0|1|3  ← Too hard
```

**Ideal Distribution**:
- 60-70%: Balanced (at least 1 lure per bucket)
- 20-30%: Slightly imbalanced (one bucket empty)
- <10%: Highly imbalanced (only 1-2 buckets)

**If >20% highly imbalanced**:
- Check pool diversity: `poolTaxa` in logs
- Increase `config.minPoolTaxa` (currently 30)
- Review `iconic_taxa` filter (some groups have low diversity)

---

## Error Tracking

### Error Logging

**All errors logged with**:
- Error message
- Stack trace
- Request context (cacheKey, filters, clientId)
- Timing data (if available)

**Example error log**:
```json
{
  "level": 50,
  "time": 1705497045123,
  "error": {
    "type": "Error",
    "message": "Pool d'observations indisponible",
    "stack": "Error: Pool d'observations...\n    at generateQuestion..."
  },
  "req": {
    "method": "GET",
    "url": "/api/quiz-question?filters=fungi"
  },
  "cacheKey": "filters:fungi:species",
  "selectionMode": "fallback_relax",
  "msg": "Failed to generate question"
}
```

### Error Categories

| Error | Status | Cause | Action |
|-------|--------|-------|--------|
| "Pool d'observations indisponible" | 503 | No eligible taxa after fallback | Check pool diversity, relax filters |
| "Pas assez d'espèces différentes" | 404 | <4 lures found | Increase pool size, check iconic_taxa |
| "Impossible de récupérer les détails" | 502 | iNaturalist API error | Check API status, retry |
| "Circuit breaker open" | 503 | Too many API failures | Wait for cooldown, check API health |

### Frontend Error Tracking

**Setup** (planned):

```javascript
// client/src/services/errorTracking.js
export function trackError(error, context) {
  // Log to backend
  fetch('/api/log-error', {
    method: 'POST',
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  });
  
  // Also log locally
  console.error('Error:', error, 'Context:', context);
}

// Usage in components
try {
  await fetchQuizQuestion();
} catch (error) {
  trackError(error, { component: 'PlayPage', action: 'fetchQuestion' });
}
```

---

## Monitoring Best Practices

### 1. Log Aggregation (Production)

**Recommended Tools**:
- **Datadog**: Full-featured APM + log aggregation
- **Papertrail**: Simple log aggregation
- **ELK Stack**: Self-hosted (Elasticsearch + Logstash + Kibana)
- **Grafana Loki**: Lightweight, cost-effective

**Setup Example** (Datadog):

```javascript
// server/middleware/logging.js
import pino from 'pino';
import pinoDatadog from 'pino-datadog';

const stream = pinoDatadog({
  apiKey: process.env.DATADOG_API_KEY,
  service: 'inaturamouche',
  env: process.env.NODE_ENV,
  tags: ['version:1.0.0']
});

export const logger = pino(stream);
```

### 2. Alerting Rules

**Critical Alerts** (PagerDuty/Opsgenie):
- Error rate >5% (5min window)
- Response time p95 >2s (5min window)
- Circuit breaker open for >1min
- Cache hit rate <80% (30min window)

**Warning Alerts** (Slack/Email):
- Fallback mode usage >10% (15min window)
- iNaturalist API latency >1s (p50, 10min window)
- Memory usage >80%
- Disk space <20%

### 3. Dashboards

**Key Metrics to Track**:

| Metric | Visualization | Target |
|--------|---------------|--------|
| Request rate | Line graph | 10-100 req/min |
| Response time (p50, p95, p99) | Line graph | p95 <500ms |
| Error rate | Line graph | <1% |
| Cache hit rate | Gauge | >90% |
| Pool diversity (avg taxonList size) | Histogram | >50 taxa |
| Lure distribution | Stacked bar | Balanced |

**Sample Dashboard** (Grafana):

```yaml
# grafana-dashboard.json
panels:
  - title: Request Rate
    query: rate(http_requests_total[5m])
    
  - title: Response Time (p95)
    query: histogram_quantile(0.95, http_request_duration_seconds_bucket)
    
  - title: Cache Hit Rate
    query: sum(cache_hits) / sum(cache_requests) * 100
    
  - title: Error Rate
    query: sum(http_requests_total{status=~"5.."}) / sum(http_requests_total) * 100
```

### 4. Performance Budgets

**Enforce performance targets**:

```javascript
// server/middleware/performanceBudget.js
export function checkPerformanceBudget(req, res, next) {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    const budget = req.path === '/api/quiz-question' ? 500 : 1000; // ms
    
    if (duration > budget) {
      logger.warn({
        path: req.path,
        duration,
        budget,
        overBudget: duration - budget
      }, 'Performance budget exceeded');
    }
  });
  
  next();
}
```

---

## Production Monitoring

### Health Check Endpoint

**Location**: [server/routes/health.js](server/routes/health.js)

```javascript
// GET /healthz
{
  "status": "ok",
  "timestamp": "2026-01-17T14:30:45.123Z",
  "uptime": 86400,
  "version": "1.0.0",
  "cache": {
    "questionCache": { size: 15, maxSize: 50 },
    "taxonCache": { size: 450, maxSize: 2000 }
  },
  "circuitBreaker": {
    "state": "closed",
    "failures": 0,
    "successRate": 0.998
  }
}
```

**Kubernetes Probes**:
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Metrics Endpoint (Future)

**Prometheus-compatible metrics**:

```javascript
// GET /metrics
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/quiz-question",status="200"} 45678

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 12345
http_request_duration_seconds_bucket{le="0.5"} 43210
http_request_duration_seconds_bucket{le="1.0"} 45000
http_request_duration_seconds_sum 5678.9
http_request_duration_seconds_count 45678

# HELP cache_hits_total Cache hits
# TYPE cache_hits_total counter
cache_hits_total{cache="questionCache"} 43210
cache_hits_total{cache="taxonCache"} 87654
```

---

## Debugging Checklist

When investigating issues, follow this checklist:

### Slow Response Time

- [ ] Check `Server-Timing` header for bottleneck
- [ ] Verify cache hit rate (>90% expected)
- [ ] Check iNaturalist API latency
- [ ] Inspect pool size (`poolTaxa` in logs)
- [ ] Review circuit breaker status

### Cache Issues

- [ ] Verify `X-Cache-Key` matches filters
- [ ] Check cache TTL hasn't expired
- [ ] Inspect cache size (not at maxSize)
- [ ] Review request coalescing (concurrent requests)
- [ ] Check for cache key collisions

### Question Quality

- [ ] Analyze `X-Lure-Buckets` distribution
- [ ] Check `X-Selection-Mode` (fallback usage)
- [ ] Verify pool diversity (`poolTaxa` ≥30)
- [ ] Review `iconic_taxa` filter constraints
- [ ] Inspect LCA algorithm logic

### Errors

- [ ] Check error logs for stack traces
- [ ] Verify error category (503, 404, 502)
- [ ] Review request context (filters, clientId)
- [ ] Check external API status (iNaturalist)
- [ ] Verify fallback modes triggered correctly

---

## Tools & Resources

### Logging Tools

- **pino-pretty**: Pretty-print logs in development
- **pino-datadog**: Ship logs to Datadog
- **pino-elasticsearch**: Ship logs to Elasticsearch
- **pino-cloudwatch**: Ship logs to AWS CloudWatch

### Monitoring Tools

- **Datadog APM**: Full-featured application performance monitoring
- **New Relic**: APM + synthetic monitoring
- **Grafana**: Open-source dashboards
- **Prometheus**: Metrics collection and alerting
- **Sentry**: Error tracking and performance monitoring

### Browser Tools

- **Chrome DevTools**: Network tab → Server-Timing
- **Lighthouse**: Performance audits
- **WebPageTest**: Real-world performance testing
- **PerformanceObserver API**: Capture Server-Timing in JS

---

## Questions & Support

**Monitoring Questions?** Open a discussion in GitHub  
**Performance Issues?** Create an issue with `Server-Timing` data  
**Want to contribute?** See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Maintained by**: Inaturamouche Core Team  
**Last Review**: January 17, 2026  
**Next Review**: Quarterly (April 2026)
