// Prueba un Client Secret contra Auth0 sin mostrarlo (paso 8 del laboratorio de Vault).
// Hace un POST a https://AUTH0_DOMAIN/oauth/token con el codigo falso "vault-startup-probe".
//   - invalid_client: Auth0 rechaza el secreto (el anterior, ya rotado)
//   - invalid_grant:  Auth0 acepta el secreto y solo rechaza el codigo de prueba (el nuevo)
//
// Uso:  node scripts/probar-secreto.js <archivo-con-el-secreto> [etiqueta]
// El archivo debe estar FUERA del repositorio. Solo se imprime la hora, el estado HTTP y el error.

var fs = require('fs');
var crypto = require('crypto');

try { process.loadEnvFile(); } catch (e) {}

var archivo = process.argv[2];
var etiqueta = process.argv[3] || 'secreto';
var dominio = String(process.env.AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
var clientId = process.env.AUTH0_CLIENT_ID;
var baseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

if (!archivo || !dominio || !clientId) {
  console.error('Uso: node scripts/probar-secreto.js <archivo-con-el-secreto> [etiqueta]');
  console.error('Requiere AUTH0_DOMAIN y AUTH0_CLIENT_ID en el .env');
  process.exit(1);
}

var secreto = fs.readFileSync(archivo, 'utf8').trim();
var verificador = crypto.randomBytes(48).toString('base64url'); // 64 caracteres permitidos

var cuerpo = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: clientId,
  client_secret: secreto,
  code: 'vault-startup-probe',
  redirect_uri: baseUrl + '/auth/callback',
  code_verifier: verificador,
});

fetch('https://' + dominio + '/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: cuerpo,
}).then(function (res) {
  return res.json().catch(function () { return {}; }).then(function (json) {
    console.log('Prueba: ' + etiqueta);
    console.log('  Hora:        ' + new Date().toLocaleString('es-CR'));
    console.log('  POST         https://' + dominio + '/oauth/token');
    console.log('  Estado HTTP: ' + res.status);
    console.log('  error:       ' + (json.error || '(ninguno)'));
  });
}).catch(function (e) {
  console.error('No se pudo contactar a Auth0: ' + e.message);
  process.exit(1);
});
