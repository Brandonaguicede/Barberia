# Tenorio Barber

Aplicacion de reservas y administracion de barberia con React, TypeScript, Vite y Supabase. Incluye citas por enlace privado, gestion de personal, servicios y horarios, y el estilo Tenorio Barber con logo SVG, iconos, cristal oscuro y acentos rojos.

## Desarrollo local

Requiere Node.js 24.x.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Completar las variables de Supabase en .env.local. Los archivos de credenciales estan excluidos de Git. Consultar [configuracion completa](docs/setup.md) para migraciones y Edge Functions.

## Despliegue en Vercel

1. Importar este repositorio y seleccionar la rama main.
2. Root Directory: raiz del repositorio (./). Framework: Vite. Node.js: 24.x. vercel.json define npm ci, npm run build y salida dist, ademas de las rutas SPA y cabeceras.
3. La aplicacion incluye la configuracion publica del proyecto en src/config/supabase.ts y funciona sin variables adicionales. Para usar otro proyecto, crear VITE_SUPABASE_URL con el valor https://chcqmsccybrmgvzopxmw.supabase.co y VITE_SUPABASE_ANON_KEY con la clave publica anon de ese mismo proyecto. La instalacion local ya contiene ambos valores en .env.local. No usar la contrasena PostgreSQL ni service_role en variables VITE_.
4. Desplegar y copiar el origen HTTPS definitivo, sin barra final. En Supabase configurar APP_ORIGIN para booking y admin-users con ese origen y actualizar Auth > URL Configuration > Site URL. El origen autorizado actual es https://barberia-d2vs.vercel.app.
5. Comprobar el catalogo publico y el acceso en /login. Cargar servicios, barberos y horarios reales antes de recibir reservas.

Las variables VITE_ se incorporan durante la compilacion: despues de cambiarlas se necesita un nuevo despliegue. VITE_VAPID_PUBLIC_KEY es opcional mientras Web Push permanezca desactivado. Push y recordatorios requieren configuracion adicional descrita en docs/setup.md.

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) y [variables de Vite](https://vite.dev/guide/env-and-mode).

## Configurar la agenda desde el sistema

Entrar en el panel y abrir **Agenda y horarios**, o pulsar **Agenda** en la tarjeta de un barbero. Seleccionar el profesional y completar los tres indicadores de la pantalla:

1. **Cuenta de personal:** vincular una cuenta de barbero sin asignar o crearla en esa misma pantalla. Las cuentas inactivas o vencidas se gestionan en Usuarios.
2. **Servicios:** marcar los servicios que ofrece ese profesional. Crear un servicio por si solo no lo asigna ni define horas de trabajo.
3. **Horario semanal:** elegir uno o varios dias, indicar inicio y fin y guardar. Cada regla guardada tiene acciones para editarla o eliminarla. El mismo editor permite guardar descansos y vacaciones o bloqueos con fecha.

Todos los horarios se interpretan en Costa Rica. No se cargan horas de trabajo por defecto. Las citas existentes se conservan al cambiar las reglas. El cliente vera los espacios que cumplan las reglas, la anticipacion minima y la disponibilidad real.

## Pruebas

```sh
npm run build
npm run lint
npm test
npm run test:db
```

Las pruebas de navegador existentes usan API simulada; consultar docs/setup.md para ejecutarlas.
