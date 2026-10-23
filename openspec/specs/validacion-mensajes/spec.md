# validacion-mensajes Specification

## Purpose
Definir como UNA Chat valida y sanea cada mensaje en una-lib (`validarMensaje`) antes de
reenviarlo por Socket.IO, para prevenir inyeccion de scripts (XSS) y permitir solo URLs
seguras de imagenes y videos.

## Requirements

### Requirement: Saneamiento de texto
El sistema SHALL eliminar de los mensajes de texto los bloques `<script>`/`<style>`, cualquier
etiqueta HTML, los esquemas `javascript:`, `vbscript:` y `data:`, y los manejadores de eventos `on*=`.

#### Scenario: Script del paso 2
- **WHEN** un usuario envia `<script>alert('Inyección de script');</script>`
- **THEN** el backend devuelve el mensaje con `tipo` "texto" y `mensaje` vacio
- **AND** el navegador no muestra ningun alert

#### Scenario: Etiqueta con evento malicioso
- **WHEN** un usuario envia `hola <img src=x onerror=alert(1)>`
- **THEN** el backend devuelve `mensaje` igual a "hola"

### Requirement: URLs de imagen permitidas
El sistema SHALL aceptar como imagen solo una URL `http`/`https` enviada sola cuya ruta termine en
jpg, jpeg, png, gif, bmp, webp o avif, y MUST devolverla intacta con `tipo` "imagen".

#### Scenario: Imagen valida
- **WHEN** un usuario envia `https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png`
- **THEN** el backend devuelve `tipo` "imagen" y la misma URL
- **AND** el frontend muestra un elemento `img` con esa URL

#### Scenario: URL de imagen con atributos inyectados
- **WHEN** un usuario envia `http://a.com/x.jpg" onerror="alert(1)`
- **THEN** el backend la trata como texto y elimina `onerror`

### Requirement: URLs de video permitidas
El sistema SHALL aceptar como video una URL `http`/`https` enviada sola que termine en mp4, webm, ogg
u ogv (`tipo` "video"), o un enlace de YouTube (`tipo` "youtube") del que MUST extraer solo un
`videoId` de 11 caracteres `[A-Za-z0-9_-]`.

#### Scenario: Video directo
- **WHEN** un usuario envia `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm`
- **THEN** el backend devuelve `tipo` "video"
- **AND** el frontend inserta un reproductor `video` con controles

#### Scenario: Video de YouTube
- **WHEN** un usuario envia `https://www.youtube.com/watch?v=qYwlqx-JLok`
- **THEN** el backend devuelve `tipo` "youtube" y `videoId` "qYwlqx-JLok"

### Requirement: Bloqueo de URLs no permitidas
El sistema SHALL reemplazar por `[enlace no permitido]` cualquier URL incluida en un texto que no sea
una imagen o video valido enviado solo.

#### Scenario: Enlace a un sitio externo
- **WHEN** un usuario envia `mira https://sitio-malo.com/robar`
- **THEN** el backend devuelve `mensaje` igual a "mira [enlace no permitido]"

### Requirement: Integridad de los demas campos
El sistema SHALL sanear el `nombre`, MUST descartar un `color` que no sea hexadecimal `#RRGGBB`
y MUST responder con un mensaje vacio, sin fallar, cuando la entrada no es JSON valido.

#### Scenario: Nombre con HTML
- **WHEN** un usuario usa el nombre `<b onclick=x>Ana</b>`
- **THEN** el backend devuelve `nombre` igual a "Ana"

#### Scenario: JSON invalido
- **WHEN** llega una entrada que no es JSON
- **THEN** el backend devuelve `mensaje` vacio y sigue funcionando

### Requirement: Renderizado seguro en el frontend
El frontend SHALL construir los mensajes con `createElement` y `textContent`, MUST NOT usar `innerHTML`
con datos del usuario, y MUST construir el iframe de YouTube solo a partir de un `videoId` validado.

#### Scenario: Texto con apariencia de HTML
- **WHEN** llega un mensaje de texto que contiene `<` o `>`
- **THEN** se muestra como texto plano y no se interpreta como HTML
