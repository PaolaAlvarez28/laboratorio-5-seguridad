
// npm install para descargar los paquetes...

// Sentry debe inicializarse antes que cualquier otro modulo
var Sentry = require('./instrument');

// libreriuas
var validation = require('./libs/unalib');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// root: presentar html
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// ruta TEMPORAL para generar un error controlado y verificar Sentry.
// Solo existe si SENTRY_DEBUG_ROUTE=true; al terminar la prueba se elimina esa variable.
if (process.env.SENTRY_DEBUG_ROUTE === 'true') {
  app.get('/debug-sentry', function mainHandler(req, res){
    throw new Error('My first Sentry error!');
  });
}

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){
    try {
      msg =  validation.validarMensaje(msg);
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

// solo se levanta el puerto al ejecutar "npm start";
// las pruebas de integracion importan el servidor y lo inician ellas mismas
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io };
