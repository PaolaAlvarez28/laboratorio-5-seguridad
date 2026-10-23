// modulo de ejemplo.

module.exports = {


    // logica que valida si un telefono esta correcto...
    is_valid_phone: function (phone) {
      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

      // validacion Regex
      try {
        isValid = re.test(phone);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    is_valid_url_image: function (url) {

      // inicializacion lazy
      var isValid = false;
      // URL http(s) completa que termina en extension de imagen (permite query string)
      var re = /^https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|bmp|webp|avif)(?:\?[^\s"'<>]*)?$/i;

      // validacion Regex
      try {
        isValid = re.test(url);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    is_valid_url_video: function (url) {

      // inicializacion lazy
      var isValid = false;
      // URL http(s) completa que termina en extension de video (permite query string)
      var re = /^https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogg|ogv)(?:\?[^\s"'<>]*)?$/i;

      // validacion Regex
      try {
        isValid = re.test(url);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    is_valid_yt_video: function (url) {

      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})?$/i;

      // validacion Regex
      try {
        isValid = re.test(url);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    // devuelve solo el id de 11 caracteres [A-Za-z0-9_-] o null
    getYTVideoId: function(url){
      var match = String(url).match(/(?:youtu\.be\/|[?&]v=|embed\/|\/v\/)([\w-]{11})/);
      return match ? match[1] : null;
    },

    // verifica con el parser de URL que sea http/https y tenga dominio
    is_safe_url: function (url) {
      try {
        var u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0;
      } catch (e) {
        return false;
      }
    },

    // elimina scripts, etiquetas HTML y codigo malicioso del texto
    sanitize_text: function (text) {
      return String(text)
        // bloques <script>...</script> y <style>...</style> completos
        .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        // cualquier otra etiqueta HTML (<img ...>, <iframe ...>, </div>, etc.)
        .replace(/<\/?[a-z!][^>]*>/gi, '')
        // esquemas peligrosos: javascript:, vbscript:, data:
        .replace(/\b(?:javascript|vbscript|data)\s*:/gi, '')
        // manejadores de eventos: onerror=, onclick=, onload=...
        .replace(/\bon[a-z]+\s*=/gi, '')
        // caracteres < > que hayan quedado sueltos
        .replace(/[<>]/g, '')
        .trim();
    },

    // reemplaza las URLs que vengan dentro de un texto:
    // solo se permiten URLs de imagenes o videos enviadas solas
    remove_urls: function (text) {
      return text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[enlace no permitido]');
    },

    // valida el mensaje y lo clasifica (texto, imagen, video, youtube).
    // No genera HTML: el cliente construye los elementos con la API del DOM
    // para evitar XSS.
      validarMensaje: function(msg){

      // Handle invalid input
      if (!msg || typeof msg !== 'string') {
        return JSON.stringify({ nombre: 'Anonimo', mensaje: '', color: '', tipo: 'texto' });
      }

      try {
        var obj = JSON.parse(msg);
        if (!obj || typeof obj !== 'object') {
          throw new Error('formato invalido');
        }

        // se limita el tamaño antes de aplicar las expresiones regulares
        var mensaje = String(obj.mensaje || '').trim().slice(0, 2000);

        var limpio = {
          nombre: this.sanitize_text(String(obj.nombre || '').slice(0, 50)) || 'Anonimo',
          mensaje: '',
          color: /^#[0-9A-Fa-f]{6}$/.test(obj.color) ? obj.color : '',
          tipo: 'texto'
        };

        if(this.is_valid_url_image(mensaje) && this.is_safe_url(mensaje)){
          console.log("Es una imagen!")
          limpio.tipo = 'imagen';
          limpio.mensaje = mensaje;
        }
        else if(this.is_valid_url_video(mensaje) && this.is_safe_url(mensaje)){
          console.log("Es un video!")
          limpio.tipo = 'video';
          limpio.mensaje = mensaje;
        }
        else if(this.is_valid_yt_video(mensaje) && this.getYTVideoId(mensaje)){
          console.log("Es un video de YouTube!")
          limpio.tipo = 'youtube';
          limpio.mensaje = mensaje;
          limpio.videoId = this.getYTVideoId(mensaje);
        }
        else{
          console.log("Es un texto!")
          // se elimina el codigo malicioso y las URLs no permitidas
          limpio.mensaje = this.remove_urls(this.sanitize_text(mensaje));
        }

        return JSON.stringify(limpio);
      } catch (e) {
        console.log('Error processing message:', e.message);
        return JSON.stringify({ nombre: 'Anonimo', mensaje: '', color: '', tipo: 'texto' });
      }
    },
        // alias para compatibilidad con el nombre original
    validateMessage: function(msg){
      return this.validarMensaje(msg);
    }



  // fin del modulo
  };
