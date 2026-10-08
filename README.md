# Distinto SCZ: catálogo y plataforma de vendedores

*Tu fragancia, tu sello.*

Sitio web en negro con líneas blancas para la perfumería **Distinto SCZ**, adaptado al celular como una app (barra de navegación inferior, catálogo en 2 columnas, carruseles y ventanas que suben desde abajo), con el logo de la marca y animaciones (intro con el logo, aparición de elementos al hacer scroll, contadores animados, marquesina y transiciones entre páginas; se desactivan si el sistema pide reducir el movimiento). Incluye:

- **Tienda para clientes**:
  - Catálogo con precios, búsqueda y filtro por categoría.
  - Carrito y pedido sin crear cuenta (nombre y celular).
  - Al realizar el pedido se muestra el **QR de pago** (Yape) con el monto exacto. El cliente puede descargar el QR, subir la captura del comprobante y enviarlo por WhatsApp.
  - Página de seguimiento del pedido con su estado e historial, y sección "Mis pedidos" en el mismo dispositivo.
- **Registro de vendedores**: las personas envían su solicitud y el administrador la **acepta o rechaza**.
- **Panel del vendedor** (solo cuando está aprobado):
  - **Precios y comisiones**: precio sugerido de venta y comisión por cada perfume, que define el administrador.
  - **Carrito**: arma un pedido con el nombre del cliente, su teléfono, la dirección y notas.
  - **Mis pedidos**: estado de cada pedido con barra de progreso e historial.
  - **Ranking** mensual de vendedores, con podio para los 3 primeros.
- **Panel del administrador**:
  - Resumen con indicadores y el **estado de la tienda**: modo "Próximamente" (los visitantes ven una pantalla de lanzamiento y no se reciben pedidos ni registros, mientras el administrador sigue trabajando) o abierta al público, con un solo botón.
  - Solicitudes de vendedores: aceptar, rechazar, suspender o eliminar.
  - Catálogo: agregar, editar, ocultar o eliminar perfumes, con imagen por URL o archivo subido.
  - Pedidos de clientes directos y de vendedores, con filtros: confirmar el pago, ver el comprobante, escribir al cliente por WhatsApp y cambiar el estado (Pendiente, Confirmado, En preparación, Enviado, Entregado o Cancelado) con una nota, y eliminar pedidos (uno por uno o varios a la vez, por ejemplo los de prueba).
  - Pagos y cuenta: cambiar el QR de pago, el WhatsApp de la tienda y la contraseña.
  - **Avisos por correo**: si el cliente deja su correo, recibe un aviso al hacer el pedido, al confirmarse el pago y cada vez que cambia el estado (se envía desde el Gmail de la tienda con **Google Apps Script**, sin contraseña de aplicación, siguiendo los pasos del panel; también se puede usar SMTP con contraseña de aplicación).
  - Ranking por mes, con la comisión de cada vendedor.
  - Cambio de contraseña.

## Cómo abrirla (la forma fácil)

1. Instala **Node.js** desde <https://nodejs.org> (botón verde **LTS**). Solo se hace una vez.
2. Dale **doble clic** a:
   - **`INICIAR.bat`** en Windows.
   - **`iniciar.command`** en Mac (la primera vez: clic derecho → **Abrir**).
3. Se abre una ventana negra y la página aparece sola en el navegador, en <http://localhost:3000>.
4. **No cierres la ventana negra** mientras uses la página; al cerrarla, la página se apaga.

> No abras `public/index.html` con doble clic: así la página se ve, pero no puedes ingresar.

### Verla desde el celular

Con el celular conectado al **mismo Wi-Fi** que la computadora, abre la dirección que aparece en la ventana negra bajo *"Desde tu celular"* (por ejemplo `http://192.168.1.45:3000`). La primera vez, Windows pregunta si permite a Node.js usar la red: marca **Redes privadas** y presiona **Permitir**. Si el celular no carga, dale doble clic a **`PERMITIR-CELULAR.bat`** (abre el puerto 3000 en el Firewall de Windows; pide permiso de administrador).

### Enlace público para cualquier celular (gratis)

Cierra la ventana negra y abre la página con **`COMPARTIR.bat`** (Windows) o **`compartir.command`** (Mac) en lugar de INICIAR. La primera vez descarga el programa de Cloudflare (gratis, sin cuenta) y crea un enlace del tipo `https://algo.trycloudflare.com` que funciona en cualquier celular, con Wi-Fi o datos móviles. El enlace aparece en la ventana negra y en **Administración → Pagos y cuenta**, con botones para copiarlo o enviarlo por WhatsApp.

- Solo funciona mientras la computadora y la ventana negra estén encendidas.
- El enlace cambia cada vez que abres COMPARTIR.
- Cualquiera con el enlace puede ver la página: **cambia la contraseña `admin123`** antes de compartirlo.

### Dónde quedan tus datos

Perfumes, vendedores, pedidos, fotos y comprobantes se guardan en la carpeta **`DistintoSCZ-datos`** dentro de tu usuario (en Windows: `C:\Users\TuNombre\DistintoSCZ-datos`). Si Windows o el antivirus no dejan escribir ahí, se usa `%LOCALAPPDATA%\DistintoSCZ-datos`, y como último recurso las carpetas `data` y `uploads` de la propia página. La ventana negra muestra siempre dónde se están guardando. Está fuera de la carpeta de la página, así que puedes descargar versiones nuevas sin perder nada. Haz copias de esa carpeta de vez en cuando.

Si una versión anterior guardó los datos dentro de la carpeta de la página (`data` y `uploads`), se trasladan solos a `DistintoSCZ-datos` la primera vez que se enciende.

### Actualizar a la última versión

Cierra la ventana negra y dale doble clic a **`ACTUALIZAR.bat`** (Windows) o **`actualizar.command`** (Mac). Descarga la última versión, la instala en la misma carpeta sin tocar tus datos y vuelve a abrir la página. El número de versión aparece al pie de la página.

### ¿Olvidaste la contraseña del administrador?

Dale doble clic a **`RESTABLECER-CLAVE.bat`** (Windows) o **`restablecer-clave.command`** (Mac). La contraseña vuelve a ser `admin123`; cámbiala al ingresar.

## Requisitos

- **Node.js 22.13 o superior**. No hace falta instalar dependencias: el proyecto usa solo módulos integrados de Node, entre ellos la base de datos SQLite (`node:sqlite`).

## Cómo ejecutarlo

```bash
npm start
```

Abre <http://localhost:3000>.

La primera vez se crea la cuenta de administrador:

- Correo: `admin@perfumeria.com`
- Contraseña: `admin123`

**Cámbiala** apenas ingreses (Administración → Cuenta), o defínela antes del primer arranque con variables de entorno.

### Variables de entorno (opcionales)

| Variable         | Uso                                                    | Por defecto              |
|------------------|--------------------------------------------------------|--------------------------|
| `PORT`           | Puerto del servidor                                    | `3000`                   |
| `ADMIN_EMAIL`    | Correo del administrador (solo en el primer arranque)  | `admin@perfumeria.com`   |
| `ADMIN_PASSWORD` | Contraseña del administrador (solo en el primer arranque) | `admin123`            |
| `STORE_DIR`      | Carpeta de datos (base de datos e imágenes)            | `~/DistintoSCZ-datos`    |
| `DATA_DIR`       | Carpeta de la base de datos                            | `STORE_DIR/data`         |
| `UPLOAD_DIR`     | Carpeta de imágenes subidas                            | `STORE_DIR/uploads`      |
| `TZ`             | Zona horaria para calcular el mes del ranking         | la del servidor          |

Ejemplo: `TZ=America/Lima ADMIN_PASSWORD=miClaveSegura npm start`

## Cómo funciona

1. Un vendedor se registra en **Sé vendedor**. Hasta que lo aprueben, no puede ingresar.
2. El administrador lo acepta en **Administración → Vendedores**.
3. El vendedor ingresa, ve precios y comisiones, agrega perfumes al carrito y envía el pedido con el nombre del cliente.
4. El administrador actualiza el estado del pedido en **Administración → Pedidos**, y el vendedor lo ve en **Mis pedidos**.
5. **Ranking**: solo cuentan los pedidos de vendedores **entregados**. Se ordena por monto vendido en el mes en que se creó el pedido. Los vendedores no ven la comisión de los demás.

El precio y la comisión se guardan en cada pedido al momento de crearlo, así que cambiar los precios del catálogo no altera pedidos anteriores.

## Estructura

```
server.js          Servidor HTTP y API
src/db.js          Esquema de la base de datos SQLite y cuenta inicial del administrador
src/security.js    Hash de contraseñas (scrypt) y tokens de sesión
public/            Frontend (HTML, CSS y JavaScript sin frameworks)
public/img/        Logo (emblema con fondo transparente) y favicon
src/paths.js       Ubicación de los datos (~/DistintoSCZ-datos) y traslado desde versiones anteriores
src/tunnel.js      Enlace público con Cloudflare: descarga cloudflared y crea el enlace (COMPARTIR.bat)
src/mail.js        Envío de correos por SMTP (Gmail) sin librerías externas
src/order-email.js Diseño del correo que recibe el cliente
reset-admin.js     Restablece la contraseña del administrador (RESTABLECER-CLAVE.bat)
```

## Seguridad

- Contraseñas guardadas con *scrypt* (nunca en texto plano) y sesiones con tokens aleatorios en cookies `HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS.
- Límite de intentos: 10 contraseñas fallidas por conexión y 30 por cuenta cada 15 minutos; 15 pedidos por hora, 5 registros por hora y 20 comprobantes por hora desde una misma conexión.
- Encabezados `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Strict-Transport-Security`.
- Todas las acciones de administración se validan en el servidor; los vendedores solo ven sus propios pedidos.
- Recomendado: verificación en 2 pasos en GitHub, Railway, GoDaddy y Gmail, repositorio privado y copias de seguridad del disco en Railway.

## Para publicarlo en internet (Railway)

La página necesita un servicio que ejecute Node.js y un **disco permanente** para la base de datos y las fotos. Con Railway (plan Hobby, unos US$5 al mes):

1. Crea una cuenta en <https://railway.com> con tu GitHub.
2. **New Project → Deploy from GitHub repo →** elige `gerard251100/Gerard`.
3. En el servicio: **Settings → Source → Branch**: `claude/perfumery-vendor-platform-fruygb` (la rama con la página).
4. **Variables** (pestaña Variables):
   - `STORE_DIR` = `/data`
   - `ADMIN_PASSWORD` = una contraseña segura (solo se usa al crear la tienda por primera vez)
   - `TZ` = `America/La_Paz`
5. **Disco**: clic derecho en el servicio → **Attach Volume**, con *Mount path* `/data`.
6. **Settings → Networking → Generate Domain**: te da una dirección `https://algo.up.railway.app`. Luego puedes conectar tu propio dominio (por ejemplo `distintoscz.com`) en **Custom Domain**.
7. Cada vez que se suba una versión nueva a la rama, Railway la publica sola.

Los enlaces "Ver mi pedido" de los correos usan automáticamente la dirección de Railway (o `PUBLIC_URL` si la defines). Respalda de vez en cuando `data/perfumeria.db` del disco.
