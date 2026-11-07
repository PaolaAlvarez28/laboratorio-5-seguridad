// Inicio de sesion con Auth0 (Regular Web Application, Authorization Code + PKCE).
// El Client Secret se lee desde Supabase Vault al arrancar (server/vault.js) y se
// envia a Auth0 con el metodo Client Secret (Post) al canjear el codigo.
// Si AUTH0_DOMAIN o AUTH0_CLIENT_ID estan vacios, el chat queda abierto (pruebas).

var crypto = require('crypto');
var express = require('express');
var vault = require('./vault');

var SESSION_COOKIE = 'una_session';
var TX_COOKIE = 'una_auth_tx';
var SESSION_HORAS = 8;

function limpiarDominio(valor) {
  return String(valor || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(bytes) {
  return base64url(crypto.randomBytes(bytes));
}

function leerCookies(header) {
  var cookies = {};
  String(header || '').split(';').forEach(function (parte) {
    var i = parte.indexOf('=');
    if (i > 0) {
      var nombre = parte.slice(0, i).trim();
      try { cookies[nombre] = decodeURIComponent(parte.slice(i + 1).trim()); } catch (e) {}
    }
  });
  return cookies;
}

function crearAuth(env) {
  env = env || {};
  var dominio = limpiarDominio(env.AUTH0_DOMAIN);
  var clientId = String(env.AUTH0_CLIENT_ID || '').trim();
  var baseUrl = String(env.APP_BASE_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
  var callbackUrl = baseUrl + '/auth/callback';
  var habilitado = dominio !== '' && clientId !== '';
  var cookieSegura = /^https:/i.test(baseUrl);

  var clientSecret = null;
  var claveSesion = null;

  // --- cookies firmadas con HMAC (la clave se deriva del Client Secret) ---
  function firmar(datos) {
    var cuerpo = base64url(JSON.stringify(datos));
    var firma = base64url(crypto.createHmac('sha256', claveSesion).update(cuerpo).digest());
    return cuerpo + '.' + firma;
  }

  function verificar(valor) {
    if (!valor || !claveSesion) return null;
    var partes = String(valor).split('.');
    if (partes.length !== 2) return null;
    var esperada = base64url(crypto.createHmac('sha256', claveSesion).update(partes[0]).digest());
    var a = Buffer.from(partes[1]);
    var b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      var datos = JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8'));
      if (!datos.exp || datos.exp < Date.now()) return null;
      return datos;
    } catch (e) {
      return null;
    }
  }

  function cookie(nombre, valor, maxAgeSeg) {
    var partes = [nombre + '=' + encodeURIComponent(valor), 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAgeSeg];
    if (cookieSegura) partes.push('Secure');
    return partes.join('; ');
  }

  function sesionDe(headerCookie) {
    return verificar(leerCookies(headerCookie)[SESSION_COOKIE]);
  }

  // --- arranque: secreto desde Vault y prueba contra Auth0 ---
  function usarSecreto(valor) {
    clientSecret = valor;
    claveSesion = crypto.createHmac('sha256', valor).update('una-chat-session-v1').digest();
  }

  async function canjearCodigo(codigo, verificador) {
    var cuerpo = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: codigo,
      redirect_uri: callbackUrl,
      code_verifier: verificador,
    });
    var res = await fetch('https://' + dominio + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
    });
    var json = await res.json().catch(function () { return {}; });
    return { status: res.status, json: json };
  }

  // con un codigo falso, Auth0 responde invalid_grant si acepta el secreto
  // e invalid_client si el secreto no corresponde a la aplicacion
  async function pruebaDeArranque() {
    try {
      var r = await canjearCodigo('vault-startup-probe', aleatorio(48));
      var error = r.json.error || '(sin error)';
      if (error === 'invalid_grant') {
        console.log('[auth] Prueba de arranque: HTTP ' + r.status + ' ' + error + ' (esperado: Auth0 acepto el Client Secret)');
      } else if (error === 'invalid_client' || r.status === 401) {
        // segun el tenant, Auth0 rechaza el secreto con invalid_client o con 401 access_denied
        console.error('[auth] Prueba de arranque: HTTP ' + r.status + ' ' + error + '. Auth0 rechazo el Client Secret: revise que Vault tenga el secreto de esta aplicacion.');
        return 'invalid_client';
      } else {
        console.warn('[auth] Prueba de arranque: HTTP ' + r.status + ' ' + error);
      }
      return error;
    } catch (e) {
      console.warn('[auth] No se pudo hacer la prueba de arranque contra Auth0: ' + e.message);
    }
  }

  async function iniciar() {
    if (!habilitado) {
      console.log('[auth] Auth0 desactivado (AUTH0_DOMAIN o AUTH0_CLIENT_ID vacios): el chat queda abierto');
      return;
    }
    if (env.AUTH0_CLIENT_SECRET) {
      // se avisa por el nombre, nunca por el valor
      console.warn('[auth] AUTH0_CLIENT_SECRET esta definida y se ignora: el secreto se lee desde Supabase Vault');
    }
    if (!env.VAULT_DATABASE_URL) {
      throw new Error('Falta VAULT_DATABASE_URL para leer el Client Secret desde Vault');
    }
    usarSecreto(await vault.leerClientSecret(env.VAULT_DATABASE_URL));
    console.log('[auth] Client Secret leido desde Supabase Vault');
    if (await pruebaDeArranque() === 'invalid_client') {
      throw new Error('Auth0 rechazo el Client Secret de Vault (invalid_client)');
    }
  }

  // --- middleware ---
  function requiereSesion(req, res, next) {
    if (!habilitado) return next();
    var sesion = sesionDe(req.headers.cookie);
    if (sesion) {
      req.usuario = sesion;
      return next();
    }
    res.status(401);
    if (req.accepts(['html', 'json']) === 'html') {
      return res.type('html').send(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Iniciar sesion</title></head>' +
        '<body style="font:16px Arial;padding:40px"><h1>UNA Chat</h1>' +
        '<p>Debes iniciar sesion para entrar a la sala.</p><p><a href="/auth/login">Iniciar sesion</a></p></body></html>');
    }
    return res.json({ error: 'Debes iniciar sesion', login: '/auth/login' });
  }

  function socketMiddleware(socket, next) {
    if (!habilitado) return next();
    var sesion = sesionDe(socket.request.headers.cookie);
    if (!sesion) return next(new Error('No autorizado'));
    socket.data.usuario = sesion;
    next();
  }

  // --- rutas /auth ---
  var router = express.Router();

  router.get('/config', function (req, res) {
    res.json({ enabled: habilitado, domain: habilitado ? dominio : null, clientId: habilitado ? clientId : null });
  });

  router.get('/login', function (req, res) {
    if (!habilitado) return res.redirect(302, '/');
    var state = aleatorio(24);
    var nonce = aleatorio(24);
    var verificador = aleatorio(48);
    var reto = base64url(crypto.createHash('sha256').update(verificador).digest());
    res.setHeader('Set-Cookie', cookie(TX_COOKIE, firmar({ state: state, nonce: nonce, v: verificador, exp: Date.now() + 10 * 60 * 1000 }), 600));
    var params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'openid profile email',
      state: state,
      nonce: nonce,
      code_challenge: reto,
      code_challenge_method: 'S256',
    });
    res.redirect(302, 'https://' + dominio + '/authorize?' + params.toString());
  });

  router.get('/callback', async function (req, res) {
    if (!habilitado) return res.redirect(302, '/');
    var tx = verificar(leerCookies(req.headers.cookie)[TX_COOKIE]);
    var limpiarTx = cookie(TX_COOKIE, '', 0);

    if (req.query.error) {
      res.setHeader('Set-Cookie', limpiarTx);
      return res.status(400).send('Auth0 rechazo el inicio de sesion. <a href="/auth/login">Intentar de nuevo</a>');
    }
    if (!tx || typeof req.query.code !== 'string' || req.query.state !== tx.state) {
      res.setHeader('Set-Cookie', limpiarTx);
      return res.status(400).send('Sesion de inicio invalida o vencida. <a href="/auth/login">Intentar de nuevo</a>');
    }

    try {
      var r = await canjearCodigo(req.query.code, tx.v);
      if (r.status !== 200 || !r.json.id_token) {
        console.error('[auth] Canje del codigo fallo: HTTP ' + r.status + ' ' + (r.json.error || ''));
        res.setHeader('Set-Cookie', limpiarTx);
        return res.status(502).send('No se pudo completar el inicio de sesion. <a href="/auth/login">Intentar de nuevo</a>');
      }

      // el id_token llega directo de Auth0 por TLS; se validan emisor, audiencia, vigencia y nonce
      var claims = JSON.parse(Buffer.from(r.json.id_token.split('.')[1], 'base64url').toString('utf8'));
      var aud = [].concat(claims.aud);
      var valido = claims.iss === 'https://' + dominio + '/' &&
        aud.indexOf(clientId) !== -1 &&
        claims.exp * 1000 > Date.now() &&
        claims.nonce === tx.nonce;
      if (!valido) {
        res.setHeader('Set-Cookie', limpiarTx);
        return res.status(401).send('Token de identidad invalido. <a href="/auth/login">Intentar de nuevo</a>');
      }

      var sesion = {
        sub: claims.sub,
        name: claims.name || claims.nickname || claims.email || 'Usuario',
        email: claims.email || '',
        exp: Date.now() + SESSION_HORAS * 3600 * 1000,
      };
      res.setHeader('Set-Cookie', [limpiarTx, cookie(SESSION_COOKIE, firmar(sesion), SESSION_HORAS * 3600)]);
      console.log('[auth] Inicio de sesion correcto');
      res.redirect(302, '/sala');
    } catch (e) {
      console.error('[auth] Error en el callback: ' + e.message);
      res.setHeader('Set-Cookie', limpiarTx);
      res.status(500).send('Error al iniciar sesion. <a href="/auth/login">Intentar de nuevo</a>');
    }
  });

  router.get('/me', function (req, res) {
    if (!habilitado) return res.json({ enabled: false });
    var sesion = sesionDe(req.headers.cookie);
    if (!sesion) return res.status(401).json({ error: 'Sin sesion' });
    res.json({ enabled: true, name: sesion.name, email: sesion.email });
  });

  router.get('/logout', function (req, res) {
    res.setHeader('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
    if (!habilitado) return res.redirect(302, '/');
    var params = new URLSearchParams({ client_id: clientId, returnTo: baseUrl });
    res.redirect(302, 'https://' + dominio + '/v2/logout?' + params.toString());
  });

  return {
    habilitado: habilitado,
    iniciar: iniciar,
    router: router,
    requiereSesion: requiereSesion,
    socketMiddleware: socketMiddleware,
    // solo para pruebas
    _usarSecreto: usarSecreto,
    _firmar: firmar,
  };
}

module.exports = { crearAuth: crearAuth, leerCookies: leerCookies, limpiarDominio: limpiarDominio };
