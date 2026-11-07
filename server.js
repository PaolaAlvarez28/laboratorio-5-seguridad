
// OpenTelemetry (Grafana Cloud) y Sentry deben inicializarse antes que cualquier otro modulo
require('./otel');
var Sentry = require('./instrument');

// libreriuas
var validation = require('./libs/unalib');
var telemetria = require('./libs/telemetria');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// inicio de sesion con Auth0; el Client Secret se lee desde Supabase Vault.
// En las pruebas automaticas (NODE_ENV=test) queda desactivado y el chat abierto.
var auth = require('./server/auth').crearAuth(process.env.NODE_ENV === 'test' ? {} : process.env);

// fallo controlado para las pruebas de monitoreo (solo si CHAT_FALLO_CONTROLADO=true)
var falloActivo = process.env.CHAT_FALLO_CONTROLADO === 'true';

// valida con una-lib; con el fallo activo, el mensaje "/fallo" provoca un error
var validador = {
  validarMensaje: function(msg){
    if (falloActivo && esComandoFallo(msg)) {
      throw new Error('Fallo controlado de UNA Chat');
    }
    return validation.validarMensaje(msg);
  }
};

function esComandoFallo(msg){
  try {
    return String(JSON.parse(msg).mensaje).trim() === '/fallo';
  } catch (e) {
    return false;
  }
}

// rutas de inicio de sesion: /auth/config, /auth/login, /auth/callback, /auth/me, /auth/logout
app.use('/auth', auth.router);

// root: con Auth0 activo lleva a la sala; sin Auth0 presenta el chat
app.get('/', function(req, res){
  if (auth.habilitado) return res.redirect(302, '/sala');
  res.sendFile(__dirname + '/index.html');
});

// sala del chat: requiere sesion cuando Auth0 esta activo (sin sesion responde 401)
app.get('/sala', auth.requiereSesion, function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// procesar un mensaje por HTTP (lo usan las pruebas de carga con Artillery)
app.post('/api/mensajes', auth.requiereSesion, express.json({ limit: '10kb' }), function(req, res, next){
  if (!req.body || typeof req.body.mensaje !== 'string') {
    telemetria.log('warn', 'Solicitud sin mensaje', { 'chat.origen': 'http' });
    return res.status(400).json({ error: 'El campo "mensaje" es obligatorio' });
  }
  try {
    var msg = telemetria.procesarMensaje(validador, JSON.stringify(req.body), 'http');
    io.emit('Evento-Mensaje-Server', msg);
    res.status(200).json(JSON.parse(msg));
  } catch (e) {
    next(e);
  }
});

// fallo controlado por HTTP (solo si CHAT_FALLO_CONTROLADO=true)
if (falloActivo) {
  app.get('/api/fallo', function(req, res){
    throw new Error('Fallo controlado de UNA Chat');
  });
}

// ruta TEMPORAL para generar un error controlado y verificar Sentry.
// Solo existe si SENTRY_DEBUG_ROUTE=true; al terminar la prueba se elimina esa variable.
if (process.env.SENTRY_DEBUG_ROUTE === 'true') {
  app.get('/debug-sentry', function mainHandler(req, res){
    throw new Error('My first Sentry error!');
  });
}

// con Auth0 activo, solo se conectan sockets con sesion valida
io.use(auth.socketMiddleware);

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    try {
      // con sesion, el nombre lo pone el servidor (evita hacerse pasar por otro)
      if (socket.data.usuario) {
        var datos = JSON.parse(msg);
        datos.nombre = socket.data.usuario.name;
        msg = JSON.stringify(datos);
      }
      msg = telemetria.procesarMensaje(validador, msg, 'socket');
      // volvemos a emitir el mismo mensaje
      io.emit('Evento-Mensaje-Server', msg);
    } catch (e) {
      // los errores de Socket.IO no pasan por Express: se reportan a mano
      Sentry.captureException(e);
    }
  });
});

// el manejador de errores de Sentry va despues de todas las rutas
Sentry.setupExpressErrorHandler(app);

// registra el error en los logs y responde 500
app.use(function(err, req, res, next){
  telemetria.registrarError(req.method + ' ' + req.path, err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// solo se levanta el puerto al ejecutar "npm start";
// las pruebas de integracion importan el servidor y lo inician ellas mismas
// antes de escuchar se lee el secreto desde Vault y se prueba contra Auth0
if (require.main === module) {
  auth.iniciar().then(function(){
    http.listen(port, function(){
      console.log('listening on *:' + port);
    });
  }).catch(function(err){
    console.error('[auth] No se pudo iniciar: ' + err.message);
    process.exit(1);
  });
}

module.exports = { app: app, http: http, io: io, auth: auth };
