// server/index.js
// Point d'entrée de l'application

import { createApp } from './app.js';
import { config } from './config/index.js';
import { warmDefaultObservationPool, warmPackPools } from './services/warmup.js';

const { app, logger } = createApp();

// Warn if HMAC secret is not configured
if (!config.roundHmacSecret || config.roundHmacSecret.trim().length === 0) {
  const msg = '⚠️  ROUND_HMAC_SECRET is not set — round signatures use a weak dev default. Set it in .env for production!';
  if (config.nodeEnv === 'production') {
    throw new Error(msg);
  }
  console.warn(msg);
}

// Démarrer le serveur seulement si pas en mode test
if (config.nodeEnv !== 'test') {
  setTimeout(() => {
    warmDefaultObservationPool({ logger }).catch(() => {});
    warmPackPools({ logger }).catch(() => {});
  }, 1000).unref();
  const server = app.listen(config.port, () => {
    logger.info(`Serveur iNaturaQuizz démarré sur le port ${config.port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} est déjà utilisé. Terminez le processus qui l'utilise ou définissez la variable d'environnement PORT pour en choisir un autre.`);
      process.exit(1);
    }
    logger.error('Erreur du serveur non gérée:', err);
    throw err;
  });
}

// Export pour les tests
export default app;
