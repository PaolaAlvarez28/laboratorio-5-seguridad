// Lee el Client Secret de Auth0 desde Supabase Vault.
// Se conecta con el rol una_chat_backend (VAULT_DATABASE_URL), que solo puede
// ejecutar una_chat_private.get_auth0_client_secret(). El valor nunca se imprime.

var fs = require('fs');
var tls = require('tls');
var path = require('path');

var CA_PATH = path.join(__dirname, 'supabase-root-2021-ca.pem');

// arma la configuracion de pg con TLS verificado contra el certificado de Supabase.
// Se quita sslmode de la URI porque pg le daria prioridad sobre el certificado.
function configuracionConexion(databaseUrl) {
  var url;
  try {
    url = new URL(databaseUrl);
  } catch (e) {
    throw new Error('VAULT_DATABASE_URL no es una URI valida de Postgres');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('VAULT_DATABASE_URL debe empezar con postgresql://');
  }
  var sslmode = url.searchParams.get('sslmode');
  if (sslmode !== 'verify-full') {
    throw new Error('VAULT_DATABASE_URL debe usar sslmode=verify-full');
  }
  url.searchParams.delete('sslmode');

  if (!fs.existsSync(CA_PATH)) {
    throw new Error('Falta server/supabase-root-2021-ca.pem (certificado raiz de Supabase)');
  }

  return {
    connectionString: url.toString(),
    // confia en las raices publicas del sistema y en la raiz de Supabase (la usa el pooler)
    ssl: {
      ca: tls.rootCertificates.concat(fs.readFileSync(CA_PATH, 'utf8')),
      rejectUnauthorized: true,
      servername: url.hostname,
    },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    application_name: 'una-chat-vault',
  };
}

async function leerClientSecret(databaseUrl) {
  var { Client } = require('pg');
  var client = new Client(configuracionConexion(databaseUrl));
  await client.connect();
  try {
    var res = await client.query('select una_chat_private.get_auth0_client_secret() as valor');
    var valor = res.rows[0] && res.rows[0].valor;
    if (!valor) throw new Error('Vault no devolvio el secreto una_chat_auth0_client_secret');
    return valor;
  } finally {
    await client.end().catch(function () {});
  }
}

module.exports = { leerClientSecret: leerClientSecret, configuracionConexion: configuracionConexion };
