#!/usr/bin/env node

// Script pour consulter les rapports de bugs
// Usage: node scripts/view-reports.js

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3001';

async function viewReports() {
  try {
    console.log('📋 Récupération des rapports...\n');

    const response = await fetch(`${SERVER_URL}/api/reports`);

    if (!response.ok) {
      console.error('❌ Erreur lors de la récupération des rapports:', response.status);
      return;
    }

    const data = await response.json();
    const reports = data.reports;

    if (!reports || reports.length === 0) {
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
      console.log(`IP: ${report.ip}`);
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