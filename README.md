# laboratorio-5-seguridad
Laboratorio 5 de Seguridad Informática: UNA Chat

Chat con Node.js, Express y Socket.IO que muestra imágenes y videos a partir de URLs
y valida los mensajes en `libs/unalib.js` (`validarMensaje`) para prevenir inyección de scripts.

## Instalación

```
npm install
npx playwright install chromium
```

## Ejecutar el chat

```
npm start
```

Abrir http://localhost:3000

## Pruebas

| Suite | Herramientas | Ubicación | Comando |
|---|---|---|---|
| Unitarias | Mocha | `test/test.js` | `npm test` |
| Integración | Jest, Supertest, socket.io-client | `tests/integration/chat.test.js` | `npx jest tests/integration --runInBand --env=node` |
| End-to-end | Playwright (Chromium) | `tests/e2e/chat.spec.js` | `npx playwright test --project=chromium --headed` |

Las pruebas end-to-end necesitan el chat corriendo (`npm start`) en otra terminal.
El reporte se abre con `npx playwright show-report`.

## OpenSpec

Las reglas de seguridad de la validación están documentadas en
`openspec/specs/validacion-mensajes/spec.md`.

```
npm install -g @fission-ai/openspec@latest
openspec validate --specs
```
