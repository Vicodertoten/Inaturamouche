// server/routes/reports.js
// Route pour recevoir les rapports de bugs

import { Router } from 'express';

const router = Router();

// Stockage temporaire en mémoire (pour les tests)
let reports = [];
const MAX_REPORTS = 200;
const REPORTS_WRITE_TOKEN = process.env.REPORTS_WRITE_TOKEN;
const REPORTS_READ_TOKEN = process.env.REPORTS_READ_TOKEN;

const getAuthToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header) return '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return header.trim();
};

const isAuthorized = (req, expectedToken) => {
  if (!expectedToken) return true;
  const token = getAuthToken(req);
  return token && token === expectedToken;
};

// Endpoint pour recevoir un rapport
router.post('/api/reports', (req, res) => {
  try {
    if (!isAuthorized(req, REPORTS_WRITE_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { description, url, userAgent } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description requise' });
    }

    const report = {
      id: Date.now().toString(),
      description: description.trim().slice(0, 2000),
      url: String(url || 'Non spécifié').slice(0, 500),
      userAgent: String(userAgent || 'Non spécifié').slice(0, 500),
      timestamp: new Date().toISOString(),
    };

    // Ajouter le nouveau rapport
    reports.unshift(report);
    if (reports.length > MAX_REPORTS) {
      reports = reports.slice(0, MAX_REPORTS);
    }

    console.log('📋 Nouveau rapport reçu:', {
      id: report.id,
      description: report.description.substring(0, 100) + '...',
      timestamp: report.timestamp
    });

    res.json({
      success: true,
      message: 'Rapport reçu avec succès',
      reportId: report.id
    });

  } catch (error) {
    console.error('Erreur lors du traitement du rapport:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour récupérer tous les rapports (pour consultation)
router.get('/api/reports', (req, res) => {
  try {
    if (!isAuthorized(req, REPORTS_READ_TOKEN)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({
      reports: reports,
      total: reports.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
