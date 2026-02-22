#!/usr/bin/env node

// Script pour consulter les rapports de bugs
// Usage: REPORTS_READ_TOKEN=... node scripts/view-reports.js
// Optional: REPORTS_BASE_URL=https://api.example.com node scripts/view-reports.js

import fetch from 'node-fetch';

const SERVER_URL = (process.env.REPORTS_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const REPORTS_READ_TOKEN = process.env.REPORTS_READ_TOKEN || process.env.REPORTS_TOKEN;

async function viewReports() {
  try {
    console.log('📋 Récupération des rapports...\n');

    if (!REPORTS_READ_TOKEN) {
      console.error('❌ REPORTS_READ_TOKEN manquant.');
      console.log('💡 Exemple: REPORTS_READ_TOKEN=... node scripts/view-reports.js');
      return;
    }

    const response = await fetch(`${SERVER_URL}/api/reports`, {
      headers: {
        Authorization: `Bearer ${REPORTS_READ_TOKEN}`,
      },
    });

    if (!response.ok) {
      let errorCode = '';
      let errorMessage = '';
      let requestId = '';
      try {
        const payload = await response.json();
        errorCode = payload?.error?.code || '';
        errorMessage = payload?.error?.message || '';
        requestId = payload?.error?.requestId || '';
      } catch (_) {
        // ignore parse error, fallback below
      }
      console.error('❌ Erreur lors de la récupération des rapports:', response.status);
      if (errorCode || errorMessage) {
        console.error(`   code=${errorCode || 'unknown'} message=${errorMessage || 'n/a'}`);
      }
      if (requestId) {
        console.error(`   requestId=${requestId}`);
      }
      return;
    }

    const data = await response.json();
    const reports = Array.isArray(data?.reports) ? data.reports : null;

    if (!reports) {
      console.error('❌ Réponse invalide: champ "reports" manquant ou invalide.');
      return;
    }

    if (reports.length === 0) {
      console.log('📋 Aucun rapport reçu pour le moment.');
      return;
    }

    console.log(`📋 ${reports.length} rapport(s) reçu(s) :\n`);

    reports.forEach((report, index) => {
      console.log(`--- Rapport #${index + 1} ---`);
      console.log(`ID: ${report.id}`);
      console.log(`Date: ${new Date(report.timestamp).toLocaleString('fr-FR')}`);
      console.log(`Description: ${report.description}`);
      console.log(`URL: ${report.url}`);
      console.log(`Navigateur: ${report.userAgent}`);
      console.log(`IP hash: ${report.sourceIpHash || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rapports:', error.message);
    console.log('💡 Assurez-vous que le serveur est démarré (npm start)');
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  viewReports();
}

export { viewReports };
