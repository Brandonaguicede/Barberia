# Angel Barber Shop

Aplicacion de reservas y administracion de barberia con React, TypeScript, Vite y Supabase. Incluye citas por enlace privado, gestion de personal, servicios y horarios, y un tema oscuro con acentos rojos y cristal ahumado.

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
3. Crear VITE_SUPABASE_URL con el valor https://chcqmsccybrmgvzopxmw.supabase.co y VITE_SUPABASE_ANON_KEY con la clave publica anon de ese mismo proyecto. La instalacion local ya contiene ambos valores en .env.local. No usar la contrasena PostgreSQL ni service_role en variables VITE_.
4. Desplegar y copiar el origen HTTPS definitivo, sin barra final. En Supabase configurar APP_ORIGIN para booking y admin-users con ese origen y actualizar Auth > URL Configuration > Site URL. Hasta entonces las funciones aceptan solamente http://localhost:5173.
5. Comprobar el catalogo publico y el acceso en /login. Cargar servicios, barberos y horarios reales antes de recibir reservas.

Las variables VITE_ se incorporan durante la compilacion: despues de cambiarlas se necesita un nuevo despliegue. VITE_VAPID_PUBLIC_KEY es opcional mientras Web Push permanezca desactivado. Push y recordatorios requieren configuracion adicional descrita en docs/setup.md.

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) y [variables de Vite](https://vite.dev/guide/env-and-mode).

## Verificacion

```sh
npm run build
npm run lint
npm test
npm run test:db
```

Las pruebas de navegador existentes usan API simulada; consultar docs/setup.md para ejecutarlas.
