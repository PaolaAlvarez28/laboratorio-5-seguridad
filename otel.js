// OpenTelemetry: envia trazas, metricas y logs de UNA Chat a Grafana Cloud (OTLP).
// Se carga antes que cualquier otro modulo (ver server.js).
// Solo exporta si existe OTEL_EXPORTER_OTLP_ENDPOINT, que se define unicamente
// en el .env local: en Render no existe y la telemetria queda apagada.

// en local se leen las variables del archivo .env
try { process.loadEnvFile(); } catch (e) { /* sin .env: se usan las variables del entorno */ }

var endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim();
var activo = endpoint !== '' && process.env.NODE_ENV !== 'test';

if (activo) {
  var { NodeSDK } = require('@opentelemetry/sdk-node');
  var { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  var { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
  var { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
  var { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
  var { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
  var { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
  var { resourceFromAttributes } = require('@opentelemetry/resources');

  // hosts que no se deben trazar, para no generar trazas de la propia exportacion
  var hostsIgnorados = [new URL(endpoint).host];
  if (process.env.SENTRY_DSN) {
    try { hostsIgnorados.push(new URL(process.env.SENTRY_DSN).host); } catch (e) {}
  }

  var sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'una-chat-api',
      'deployment.environment': entorno(),
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 10000,
    })],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreOutgoingRequestHook: function (req) {
            return hostsIgnorados.indexOf(req.host || req.hostname) !== -1;
          },
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry activo: servicio=' + (process.env.OTEL_SERVICE_NAME || 'una-chat-api') +
    ' entorno=' + entorno());

  // al cerrar el proceso se envian los datos pendientes
  process.on('SIGTERM', function () { sdk.shutdown().finally(function () { process.exit(0); }); });
  process.on('SIGINT', function () { sdk.shutdown().finally(function () { process.exit(0); }); });
}

// deployment.environment: el de OTEL_RESOURCE_ATTRIBUTES o "local"
function entorno() {
  var attrs = process.env.OTEL_RESOURCE_ATTRIBUTES || '';
  var match = attrs.match(/(?:^|,)\s*deployment\.environment\s*=\s*([^,]+)/);
  return match ? match[1].trim() : 'local';
}

module.exports = { activo: activo };
