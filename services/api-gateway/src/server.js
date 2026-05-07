require('dotenv').config();
require('./observability');
const fs = require('fs');
const https = require('https');
const selfsigned = require('selfsigned');
const app = require('./app');
const config = require('./config');

app.listen(config.port, () => {
  console.log(`[${config.serviceName}] listening on :${config.port}`);
});

function createSelfSignedCredentials() {
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    keySize: 2048,
    days: 3650,
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  });

  return {
    key: pems.private,
    cert: pems.cert
  };
}

function loadHttpsCredentials() {
  const keyPath = config.https.keyPath;
  const certPath = config.https.certPath;
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8')
    };
  }

  console.warn(
    `[${config.serviceName}] HTTPS cert/key not found (${certPath}, ${keyPath}); using in-memory self-signed certificate`
  );
  return createSelfSignedCredentials();
}

if (config.https.enabled) {
  const credentials = loadHttpsCredentials();
  https.createServer(credentials, app).listen(config.https.port, () => {
    console.log(`[${config.serviceName}] https listening on :${config.https.port}`);
  });
}
