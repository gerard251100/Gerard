# Distinto SCZ: catálogo y plataforma de vendedores

*Tu fragancia, tu sello.*

Sitio web en negro con líneas blancas para la perfumería **Distinto SCZ**, con el logo de la marca y animaciones (intro con el logo, aparición de elementos al hacer scroll, contadores animados, marquesina y transiciones entre páginas; se desactivan si el sistema pide reducir el movimiento). Incluye:

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
  - Resumen con indicadores.
  - Solicitudes de vendedores: aceptar, rechazar, suspender o eliminar.
  - Catálogo: agregar, editar, ocultar o eliminar perfumes, con imagen por URL o archivo subido.
  - Pedidos de clientes directos y de vendedores, con filtros: confirmar el pago, ver el comprobante, escribir al cliente por WhatsApp y cambiar el estado (Pendiente, Confirmado, En preparación, Enviado, Entregado o Cancelado) con una nota.
  - Pagos y cuenta: cambiar el QR de pago, el WhatsApp de la tienda y la contraseña.
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

### Dónde quedan tus datos

Perfumes, vendedores, pedidos, fotos y comprobantes se guardan en la carpeta **`DistintoSCZ-datos`** dentro de tu usuario (en Windows: `C:\Users\TuNombre\DistintoSCZ-datos`). Está fuera de la carpeta de la página, así que puedes descargar versiones nuevas sin perder nada. Haz copias de esa carpeta de vez en cuando.

Si una versión anterior guardó los datos dentro de la carpeta de la página (`data` y `uploads`), se trasladan solos a `DistintoSCZ-datos` la primera vez que se enciende.

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
reset-admin.js     Restablece la contraseña del administrador (RESTABLECER-CLAVE.bat)
```

## Para publicarlo

Necesitas un servidor o un servicio que ejecute Node.js (Render, Railway, Fly.io o un VPS) con **disco persistente**. Define `STORE_DIR` apuntando a ese disco y respalda periódicamente `data/perfumeria.db`.
