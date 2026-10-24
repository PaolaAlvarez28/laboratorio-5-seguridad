var val = require('../libs/unalib');
var assert = require('assert');

// envia un mensaje por validarMensaje y devuelve el objeto resultante
function validar(mensaje, nombre){
  var entrada = JSON.stringify({ nombre: nombre || 'Ana', mensaje: mensaje, color: '#FF0000' });
  return JSON.parse(val.validarMensaje(entrada));
}


describe('unalib', function(){


  describe('funcion is_valid_phone', function(){

    it('deberia devolver true para 8297-8547', function(){

      assert.equal(val.is_valid_phone('8297-8547'), false);

    });

    it('deberia devolver false para 8297p-8547', function(){

      assert.equal(val.is_valid_phone('8297p-8547'), false);

    });

  });


  describe('Validacion de URLs de Imagenes', function(){

    it('deberia devolver true para http://image.com/image.jpg', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.jpg'), true);

    });

    it('deberia devolver true para http://image.com/image.gif', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.gif'), true);

    });

    it('deberia aceptar extensiones png, jpeg y webp en https', function(){

      assert.equal(val.is_valid_url_image('https://image.com/foto.png'), true);
      assert.equal(val.is_valid_url_image('https://image.com/foto.jpeg'), true);
      assert.equal(val.is_valid_url_image('https://image.com/foto.webp'), true);

    });

    it('deberia aceptar extensiones en mayuscula y con parametros', function(){

      assert.equal(val.is_valid_url_image('https://image.com/FOTO.JPG'), true);
      assert.equal(val.is_valid_url_image('https://image.com/foto.png?size=200'), true);

    });

    it('deberia rechazar URLs que no son imagenes', function(){

      assert.equal(val.is_valid_url_image('https://image.com/pagina.html'), false);
      assert.equal(val.is_valid_url_image('https://image.com/archivo.exe'), false);

    });

    it('deberia rechazar protocolos distintos de http/https', function(){

      assert.equal(val.is_valid_url_image('ftp://image.com/foto.jpg'), false);
      assert.equal(val.is_valid_url_image('javascript:alert(1)//.jpg'), false);

    });

    it('validarMensaje deberia marcar la URL como imagen y devolverla intacta', function(){

      var url = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
      var res = validar(url);
      assert.equal(res.tipo, 'imagen');
      assert.equal(res.mensaje, url);

    });

  });


  describe('Validacion de URLs de Videos', function(){

    it('deberia devolver true para https://video.com/clip.mp4', function(){

      assert.equal(val.is_valid_url_video('https://video.com/clip.mp4'), true);

    });

    it('deberia aceptar extensiones webm, ogg y ogv', function(){

      assert.equal(val.is_valid_url_video('https://video.com/clip.webm'), true);
      assert.equal(val.is_valid_url_video('https://video.com/clip.ogg'), true);
      assert.equal(val.is_valid_url_video('https://video.com/clip.ogv'), true);

    });

    it('deberia rechazar URLs que no son videos', function(){

      assert.equal(val.is_valid_url_video('https://video.com/clip.avi.html'), false);
      assert.equal(val.is_valid_url_video('https://video.com/foto.jpg'), false);

    });

    it('deberia devolver false para javascript:alert(1)//.mp4', function(){

      assert.equal(val.is_valid_url_video('javascript:alert(1)//.mp4'), false);

    });

    it('deberia devolver true para un link de YouTube', function(){

      assert.equal(val.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok'), true);
      assert.equal(val.is_valid_yt_video('https://youtu.be/qYwlqx-JLok'), true);

    });

    it('validarMensaje deberia marcar la URL como video para insertar el reproductor', function(){

      var url = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
      var res = validar(url);
      assert.equal(res.tipo, 'video');
      assert.equal(res.mensaje, url);

    });

    it('validarMensaje deberia extraer solo el id de YouTube para el reproductor', function(){

      var res = validar('https://www.youtube.com/watch?v=qYwlqx-JLok');
      assert.equal(res.tipo, 'youtube');
      assert.equal(res.videoId, 'qYwlqx-JLok');
      // el id solo puede tener 11 caracteres seguros para armar la URL del iframe
      assert.ok(/^[\w-]{11}$/.test(res.videoId));

    });

  });


  describe('Prevencion de Inyeccion de Scripts', function(){

    it('deberia bloquear el script del paso 2', function(){

      var res = validar("<script>alert('Inyección de script');</script>");
      assert.equal(res.tipo, 'texto');
      assert.equal(res.mensaje, '');

    });

    it('deberia eliminar etiquetas <script> y conservar el texto', function(){

      assert.equal(validar('hola <script>alert(1)</script>mundo').mensaje, 'hola mundo');

    });

    it('deberia detectar <script> escrito con mayusculas y minusculas', function(){

      assert.equal(validar('<ScRiPt>alert(1)</sCrIpT>ok').mensaje, 'ok');

    });

    it('deberia eliminar etiquetas con eventos maliciosos', function(){

      assert.equal(validar('<img src=x onerror=alert(1)>').mensaje, '');
      assert.equal(validar('<svg onload=alert(1)>').mensaje, '');

    });

    it('deberia eliminar iframes', function(){

      assert.equal(validar('<iframe src="javascript:alert(1)"></iframe>').mensaje, '');

    });

    it('deberia eliminar el esquema javascript:', function(){

      assert.equal(validar('javascript:alert(1)').mensaje, 'alert(1)');

    });

    it('no deberia aceptar una URL de imagen con atributos inyectados', function(){

      var res = validar('http://a.com/x.jpg" onerror="alert(1)');
      assert.equal(res.tipo, 'texto');
      assert.ok(res.mensaje.indexOf('onerror') === -1);

    });

    it('deberia bloquear URLs que no son imagen ni video', function(){

      var res = validar('mira https://sitio-malo.com/robar');
      assert.equal(res.tipo, 'texto');
      assert.equal(res.mensaje, 'mira [enlace no permitido]');

    });

    it('deberia limpiar el nombre de usuario', function(){

      assert.equal(validar('hola', '<b onclick=x>Ana</b>').nombre, 'Ana');

    });

    it('deberia descartar un color que no sea hexadecimal', function(){

      var entrada = JSON.stringify({ nombre: 'Ana', mensaje: 'hola', color: 'red;background:url(x)' });
      assert.equal(JSON.parse(val.validarMensaje(entrada)).color, '');

    });

    it('no deberia fallar con un JSON invalido', function(){

      var res = JSON.parse(val.validarMensaje('esto no es json <script>'));
      assert.equal(res.mensaje, '');

    });

    it('deberia dejar intacto un texto normal', function(){

      assert.equal(validar('Hola, como estas?').mensaje, 'Hola, como estas?');

    });

  });

});
