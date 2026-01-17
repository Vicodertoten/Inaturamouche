// server/index.js
// Point d'entrée de l'application

import { createApp } from './app.js';
import { config } from './config/index.js';

const { app, logger } = createApp();

// Démarrer le serveur seulement si pas en mode test
if (config.nodeEnv !== 'test') {
  app.listen(config.port, () => {
    console.log(`Serveur Inaturamouche démarré sur le port ${config.port}`);
  });
}

// Export pour les tests
export default app;
