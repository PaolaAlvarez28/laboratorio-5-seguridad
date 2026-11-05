// trazas, metricas y logs propios de UNA Chat.
// Si OpenTelemetry no esta activo (Render, pruebas) estas funciones no envian nada.

var { trace, metrics, logs, SpanStatusCode, SeverityNumber } = require('@opentelemetry/api');

var tracer = trace.getTracer('una-chat');
var meter = metrics.getMeter('una-chat');
var otelLogger = logs.getLogger('una-chat');

var mensajesTotal = meter.createCounter('chat_mensajes_total', {
  description: 'Mensajes procesados por UNA Chat, por tipo y resultado',
});
var erroresTotal = meter.createCounter('chat_errores_total', {
  description: 'Errores de UNA Chat, por operacion',
});
var duracionMensaje = meter.createHistogram('chat_mensaje_duracion', {
  description: 'Tiempo de procesamiento de un mensaje',
  unit: 'ms',
});

var severidades = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

// escribe en consola y envia el log a Grafana (Loki) con el trace_id activo
function log(nivel, mensaje, atributos) {
  var linea = '[' + nivel + '] ' + mensaje;
  if (atributos) linea += ' ' + JSON.stringify(atributos);
  (nivel === 'error' ? console.error : console.log)(linea);

  otelLogger.emit({
    severityNumber: severidades[nivel] || SeverityNumber.INFO,
    severityText: nivel.toUpperCase(),
    body: mensaje,
    attributes: atributos || {},
  });
}

function registrarError(operacion, error) {
  erroresTotal.add(1, { operacion: operacion });
  log('error', error.message, { operacion: operacion });
}

// valida un mensaje con una-lib dentro de un span "procesar-mensaje"
function procesarMensaje(validacion, msg, origen) {
  return tracer.startActiveSpan('procesar-mensaje', function (span) {
    var inicio = Date.now();
    span.setAttribute('chat.origen', origen);
    try {
      var resultado = validacion.validarMensaje(msg);
      var datos = JSON.parse(resultado);
      var tipo = datos.tipo || 'texto';
      // validarMensaje deja el mensaje vacio cuando lo rechaza o lo sanea por completo
      var estado = datos.mensaje ? 'aceptado' : 'rechazado';

      span.setAttributes({ 'chat.tipo': tipo, 'chat.resultado': estado });
      mensajesTotal.add(1, { tipo: tipo, resultado: estado, origen: origen });
      duracionMensaje.record(Date.now() - inicio, { tipo: tipo, origen: origen });
      log(estado === 'aceptado' ? 'info' : 'warn', 'Mensaje ' + estado, {
        'chat.tipo': tipo, 'chat.origen': origen, 'chat.usuario': datos.nombre,
      });
      return resultado;
    } catch (e) {
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      mensajesTotal.add(1, { tipo: 'desconocido', resultado: 'error', origen: origen });
      registrarError('procesar-mensaje', e);
      throw e;
    } finally {
      span.end();
    }
  });
}

module.exports = { log: log, registrarError: registrarError, procesarMensaje: procesarMensaje };
