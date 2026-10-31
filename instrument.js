// Sentry: se carga antes que cualquier otro modulo (ver server.js)
const Sentry = require('@sentry/node');

// en local se leen las variables del archivo .env (en Render se configuran en el panel)
try { process.loadEnvFile(); } catch (e) { /* sin .env: se usan las variables del entorno */ }

// sin SENTRY_DSN el SDK queda desactivado (pruebas y CI no envian nada)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || (process.env.RENDER ? 'render' : 'local'),
  sendDefaultPii: false,
});

module.exports = Sentry;
