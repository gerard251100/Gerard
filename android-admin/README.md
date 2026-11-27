# Distinto Admin (Android)

App de administración de Distinto SCZ. Es una *Trusted Web Activity*: abre
`https://www.distintoscz.shop/admin-app` a pantalla completa con Chrome, así que
todo lo que se hace en la app (precios, stock, ventas, compras, pedidos, combos…)
se guarda en la misma base de datos que la página web.

- Paquete: `shop.distintoscz.admin`
- La página publica `/.well-known/assetlinks.json` con la huella de la llave de firma;
  con eso Android confirma que la app es de la tienda y oculta la barra de direcciones.

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
