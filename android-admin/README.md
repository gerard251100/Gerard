# Distinto Admin (Android)

App de administración de Distinto SCZ. Es una app WebView propia (`MainActivity.java`)
que abre `https://www.distintoscz.shop/admin-app`, así que todo lo que se hace en la app
(precios, stock, ventas, compras, pedidos, combos…) se guarda en la misma base de datos
que la página web. No depende de Chrome.

- Paquete: `shop.distintoscz.admin`
- La página detecta la app con `window.DistintoApp` para guardar el Excel en Descargas.
- Los enlaces que no son del panel (la tienda, WhatsApp, comprobantes) se abren afuera.

## Compilar

La llave de firma **no** está en este repositorio (es público). Crea un archivo
`keystore.properties` fuera del repo:

```
storeFile=/ruta/a/distinto-admin.keystore
storePassword=...
keyAlias=distintoadmin
keyPassword=...
```

y compila con Gradle 8.13+ y JDK 17+:

```
export ANDROID_HOME=/ruta/al/android-sdk
DISTINTO_KEYSTORE_PROPS=/ruta/a/keystore.properties gradle -p android-admin assembleRelease
```

El APK queda en `app/build/outputs/apk/release/app-release.apk`.
Para publicar una versión nueva de la app sube `versionCode` en `app/build.gradle`
y fírmala con la **misma** llave (si no, Android no la deja actualizar).
