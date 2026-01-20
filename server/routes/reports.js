// server/routes/reports.js
// Route pour recevoir les rapports de bugs

import { Router } from 'express';

const router = Router();

// Stockage temporaire en mémoire (pour les tests)
let reports = [];

// Endpoint pour recevoir un rapport
router.post('/api/reports', (req, res) => {
  try {
    const { description, url, userAgent } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description requise' });
    }

    const report = {
      id: Date.now().toString(),
      description: description.trim(),
      url: url || 'Non spécifié',
      userAgent: userAgent || 'Non spécifié',
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress
    };

    // Ajouter le nouveau rapport
    reports.push(report);

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