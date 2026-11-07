// Pruebas del inicio de sesion con Auth0 (sin red y sin Vault).
var assert = require('assert');
var express = require('express');
var request = require('supertest');
var { crearAuth, leerCookies, limpiarDominio } = require('../server/auth');

var ENV = {
  AUTH0_DOMAIN: 'https://una-chat.example.auth0.com/',
  AUTH0_CLIENT_ID: 'client-id-publico',
  APP_BASE_URL: 'https://una-chat.example.com/',
};

function crearApp(auth) {
  var app = express();
  app.use('/auth', auth.router);
  app.get('/sala', auth.requiereSesion, function (req, res) { res.send('sala'); });
  return app;
}

describe('auth (Auth0 + Vault)', function () {

  it('limpia el dominio y lee cookies', function () {
    assert.equal(limpiarDominio('https://dev-1.us.auth0.com/'), 'dev-1.us.auth0.com');
    assert.deepEqual(leerCookies('a=1; b=hola%20mundo'), { a: '1', b: 'hola mundo' });
  });

  describe('desactivado (sin AUTH0_DOMAIN ni AUTH0_CLIENT_ID)', function () {
    var app = crearApp(crearAuth({}));

    it('GET /auth/config responde enabled false', function () {
      return request(app).get('/auth/config').expect(200).then(function (res) {
        assert.equal(res.body.enabled, false);
      });
    });

    it('GET /sala queda abierta', function () {
      return request(app).get('/sala').expect(200);
    });
  });

  describe('activado', function () {
    var auth = crearAuth(ENV);
    auth._usarSecreto('secreto-de-prueba-que-no-es-real-0123456789');
    var app = crearApp(auth);

    it('GET /auth/config devuelve dominio y Client ID, nunca el secreto', function () {
      return request(app).get('/auth/config').expect(200).then(function (res) {
        assert.deepEqual(res.body, { enabled: true, domain: 'una-chat.example.auth0.com', clientId: 'client-id-publico' });
        assert.equal(JSON.stringify(res.body).indexOf('secreto'), -1);
      });
    });

    it('GET /sala sin sesion responde 401', function () {
      return request(app).get('/sala').set('Accept', 'application/json').expect(401).then(function (res) {
        assert.equal(res.body.login, '/auth/login');
      });
    });

    it('GET /auth/login redirige a Auth0 (302) con PKCE y el callback', function () {
      return request(app).get('/auth/login').expect(302).then(function (res) {
        var destino = new URL(res.headers.location);
        assert.equal(destino.host, 'una-chat.example.auth0.com');
        assert.equal(destino.pathname, '/authorize');
        assert.equal(destino.searchParams.get('client_id'), 'client-id-publico');
        assert.equal(destino.searchParams.get('redirect_uri'), 'https://una-chat.example.com/auth/callback');
        assert.equal(destino.searchParams.get('code_challenge_method'), 'S256');
        assert.equal(destino.searchParams.get('client_secret'), null);
        assert.match(String(res.headers['set-cookie']), /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
      });
    });

    it('GET /sala con sesion firmada responde 200', function () {
      var cookie = 'una_session=' + encodeURIComponent(auth._firmar({ name: 'Paola', exp: Date.now() + 60000 }));
      return request(app).get('/sala').set('Cookie', cookie).expect(200);
    });

    it('rechaza una sesion alterada o vencida', function () {
      var alterada = auth._firmar({ name: 'Paola', exp: Date.now() + 60000 }).replace(/.$/, 'x');
      var vencida = auth._firmar({ name: 'Paola', exp: Date.now() - 1000 });
      return request(app).get('/sala').set('Cookie', 'una_session=' + alterada).expect(401).then(function () {
        return request(app).get('/sala').set('Cookie', 'una_session=' + encodeURIComponent(vencida)).expect(401);
      });
    });

    it('GET /auth/callback sin la cookie de inicio responde 400', function () {
      return request(app).get('/auth/callback?code=abc&state=xyz').expect(400);
    });
  });
});
