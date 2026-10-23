// @ts-check
const { test, expect } = require('@playwright/test');

const IMAGEN = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
// se usa .webm porque el Chromium de Playwright no trae el codec H.264 de los .mp4
const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm';
const SCRIPT = "<script>alert('Inyección de script');</script>";

// el chat reenvia los mensajes a todos los conectados: las pruebas van una por una
test.describe.configure({ mode: 'serial' });

// escribe el nombre y el mensaje y presiona Send
async function enviar(page, nombre, texto) {
  await page.getByRole('textbox', { name: 'Username' }).fill(nombre);
  await page.getByRole('textbox', { name: 'Escriba un mensaje' }).fill(texto);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.describe('UNA Chat - flujo completo frontend + backend', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('envia una URL de imagen y la imagen se muestra y termina de cargar', async ({ page }) => {
    const nombre = 'Imagen-' + Date.now();
    await enviar(page, nombre, IMAGEN);

    const mensaje = page.locator('#messages li').filter({ hasText: nombre });
    const imagen = mensaje.getByRole('img', { name: 'Imagen enviada al chat' });

    await expect(imagen).toBeVisible();
    await expect(imagen).toHaveAttribute('src', IMAGEN);
    // termino de cargar: complete y con un ancho real mayor a 0
    await expect.poll(
      () => imagen.evaluate(img => img.complete && img.naturalWidth > 0),
      { timeout: 15000 }
    ).toBe(true);
  });

  test('envia una URL de video y el reproductor aparece y carga el contenido', async ({ page }) => {
    const nombre = 'Video-' + Date.now();
    await enviar(page, nombre, VIDEO);

    const mensaje = page.locator('#messages li').filter({ hasText: nombre });
    const video = mensaje.locator('video');

    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', VIDEO);
    await expect(video).toHaveAttribute('controls', '');
    // readyState >= 1: el navegador ya descargo los datos del video (duracion, tamaño)
    await expect.poll(
      () => video.evaluate(v => v.readyState),
      { timeout: 15000 }
    ).toBeGreaterThanOrEqual(1);
    expect(await video.evaluate(v => v.duration)).toBeGreaterThan(0);
  });

  test('envia el script del paso 2 y no se ejecuta ningun alert', async ({ page }) => {
    // se registra ANTES del envio para detectar cualquier alert
    const alertas = [];
    page.on('dialog', async dialog => {
      alertas.push(dialog.message());
      await dialog.dismiss();
    });

    const nombre = 'Script-' + Date.now();
    await enviar(page, nombre, SCRIPT);

    // el mensaje llega al chat pero saneado
    const mensaje = page.locator('#messages li').filter({ hasText: nombre });
    await expect(mensaje).toBeVisible();
    await expect(mensaje).not.toContainText('<script');
    await expect(mensaje).not.toContainText('alert(');
    await expect(page.locator('#messages script')).toHaveCount(0);

    // margen para que un alert tuviera tiempo de aparecer
    await page.waitForTimeout(1000);
    expect(alertas, 'no deberia aparecer ningun alert').toHaveLength(0);
  });

});
