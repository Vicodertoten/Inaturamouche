#!/usr/bin/env node

const baseUrl = String(process.env.METRICS_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const reportsWriteToken = String(process.env.REPORTS_WRITE_TOKEN || '').trim();
const includeReport = process.argv.includes('--with-report');

function buildUrl(path) {
  return new URL(path, baseUrl).toString();
}

async function requestJson(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(buildUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    body,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { res, payload };
}

async function postMetricEvents(events) {
  const { res, payload } = await requestJson('/api/metrics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });

  if (!res.ok) {
    const message = payload?.error?.message || `HTTP ${res.status}`;
    throw new Error(`metrics/events failed: ${message}`);
  }
}

async function run() {
  const sessionId = `beta-smoke-${Date.now().toString(36)}`;
  const packId = process.env.BETA_SMOKE_PACK_ID || 'world_mammals';
  const locale = process.env.BETA_SMOKE_LOCALE || 'fr';

  // 1) Synthetic app/session lifecycle events.
  await postMetricEvents([
    { name: 'app_open', session_id: sessionId, ts: Date.now() },
    {
      name: 'round_start',
      session_id: sessionId,
      ts: Date.now(),
      properties: {
        mode: 'easy',
        pack_id: packId,
        is_challenge: false,
        is_daily_challenge: false,
      },
    },
  ]);

  // 2) Real quiz-question request (feeds endpoint latency KPI).
  const questionPath =
    `/api/quiz-question?locale=${encodeURIComponent(locale)}&media_type=images&game_mode=easy`
    + `&pack_id=${encodeURIComponent(packId)}&client_session_id=${encodeURIComponent(sessionId)}`;
  const { res: questionRes, payload: question } = await requestJson(questionPath);
  if (!questionRes.ok) {
    const message = question?.error?.message || `HTTP ${questionRes.status}`;
    throw new Error(`quiz-question failed: ${message}`);
  }

  const selectedTaxonId = question?.choices?.[0]?.taxon_id;
  if (!selectedTaxonId) {
    throw new Error('quiz-question response missing choices[0].taxon_id');
  }

  // 3) Real submit request (feeds endpoint latency KPI).
  const submitPayload = {
    round_id: question.round_id,
    round_signature: question.round_signature,
    selected_taxon_id: selectedTaxonId,
    submission_id: `${sessionId}-1`,
    client_session_id: sessionId,
  };

  const { res: submitRes, payload: submitBody } = await requestJson('/api/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submitPayload),
  });

  if (!submitRes.ok) {
    const message = submitBody?.error?.message || `HTTP ${submitRes.status}`;
    throw new Error(`quiz-submit failed: ${message}`);
  }

  const isCorrect = Boolean(submitBody?.is_correct);

  // 4) Round completion metric.
  await postMetricEvents([
    {
      name: 'round_complete',
      session_id: sessionId,
      ts: Date.now(),
      properties: {
        mode: 'easy',
        pack_id: packId,
        total_questions: 1,
        correct_answers: isCorrect ? 1 : 0,
        success: isCorrect,
        is_challenge: false,
        is_daily_challenge: false,
      },
    },
  ]);

  // 5) Optional report submission to feed report_success KPI.
  let reportStatus = 'skipped';
  if (includeReport) {
    const reportHeaders = {
      'Content-Type': 'application/json',
      'X-Client-Session-Id': sessionId,
      'X-Current-Route': '/beta-smoke',
    };
    if (reportsWriteToken) {
      reportHeaders.Authorization = `Bearer ${reportsWriteToken}`;
    }
    const { res: reportRes, payload: reportBody } = await requestJson('/api/reports', {
      method: 'POST',
      headers: reportHeaders,
      body: JSON.stringify({
        description: `Synthetic beta smoke report ${new Date().toISOString()}`,
        url: `${baseUrl}/beta-smoke`,
        userAgent: 'beta-smoke-script/1.0',
        website: '',
      }),
    });

    if (!reportRes.ok) {
      const message = reportBody?.error?.message || `HTTP ${reportRes.status}`;
      throw new Error(`report submit failed: ${message}`);
    }
    reportStatus = String(reportRes.status);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        base_url: baseUrl,
        session_id: sessionId,
        question_status: questionRes.status,
        submit_status: submitRes.status,
        report_status: reportStatus,
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error(`beta smoke failed: ${err.message}`);
  process.exitCode = 1;
});
