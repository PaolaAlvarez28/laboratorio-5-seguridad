const request = require('supertest');
const { io: Client } = require('socket.io-client');

const unalib = require('../../libs/unalib');
const { app, http, io } = require('../../server');

const EVENTO = 'Evento-Mensaje-Server';

// envia un mensaje por el socket y espera la respuesta que emite el backend
function enviarMensaje(cliente, mensaje) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('el backend no respondio')), 3000);
    cliente.once(EVENTO, (respuesta) => {
      clearTimeout(timer);
      resolve(JSON.parse(respuesta));
    });
    cliente.emit(EVENTO, JSON.stringify({ nombre: 'Tester', mensaje: mensaje, color: '#123ABC' }));
  });
}

describe('Integracion backend Node.js + una-lib', () => {
  let cliente;
  let spyValidar;

  beforeAll((done) => {
    // puerto 0: el sistema asigna uno libre, no choca con "npm start"
    http.listen(0, () => {
      const { port } = http.address();
      cliente = Client(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
      cliente.on('connect', done);
    });
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    spyValidar = jest.spyOn(unalib, 'validarMensaje');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll((done) => {
    // se cierran el cliente, Socket.IO y el servidor HTTP
    cliente.disconnect();
    io.close(() => done());
  });

  describe('Ruta HTTP GET / (Supertest)', () => {
    test('responde 200 y entrega la pagina del chat', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Chat Socket.IO UNA');
      expect(res.text).toContain('id="m"');
    });
  });

  describe('Evento Socket.IO "Evento-Mensaje-Server"', () => {
    test('URL de imagen valida: el backend acepta el mensaje', async () => {
      const url = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
      const res = await enviarMensaje(cliente, url);

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.tipo).toBe('imagen');
      expect(res.mensaje).toBe(url);
      expect(res.nombre).toBe('Tester');
    });

    test('URL de video valida: el backend acepta el mensaje', async () => {
      const url = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
      const res = await enviarMensaje(cliente, url);

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.tipo).toBe('video');
      expect(res.mensaje).toBe(url);
    });

    test('URL de YouTube valida: el backend acepta el mensaje y extrae el id', async () => {
      const res = await enviarMensaje(cliente, 'https://www.youtube.com/watch?v=qYwlqx-JLok');

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.tipo).toBe('youtube');
      expect(res.videoId).toBe('qYwlqx-JLok');
    });

    test('URL no permitida: el backend devuelve el contenido saneado', async () => {
      const res = await enviarMensaje(cliente, 'visita https://sitio-malo.com/robar');

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.tipo).toBe('texto');
      expect(res.mensaje).toBe('visita [enlace no permitido]');
    });

    test('script del paso 2: el backend elimina el codigo malicioso', async () => {
      const res = await enviarMensaje(cliente, "<script>alert('Inyección de script');</script>");

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.tipo).toBe('texto');
      expect(res.mensaje).toBe('');
      expect(res.mensaje).not.toMatch(/<script/i);
    });

    test('etiqueta con evento malicioso: el backend la elimina y conserva el texto', async () => {
      const res = await enviarMensaje(cliente, 'hola <img src=x onerror=alert(1)>');

      expect(spyValidar).toHaveBeenCalledTimes(1);
      expect(res.mensaje).toBe('hola');
      expect(res.mensaje).not.toMatch(/onerror/i);
    });
  });
});
