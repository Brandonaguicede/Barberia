# Desarrollo y activación

Las confirmaciones de reserva se pueden enviar mediante el puente gratuito de Google Apps Script en `integrations/google-apps-script/Code.gs`. Usa la cuenta Gmail del negocio, sin dominio propio ni proveedor de pago. Cada cita confirmada envía un correo al cliente (si indicó correo) y otro al barbero (si su perfil tiene correo). El envío es de mejor esfuerzo: un fallo de Gmail no cancela la cita.

## Requisitos locales

Node 24, npm, Supabase CLI y Docker Desktop para integración completa. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`. En PowerShell usar npm.cmd si ExecutionPolicy bloquea npm.ps1. Las pruebas de base usan PostgreSQL embebido PGlite sin Docker y verifican SQL real; no sustituyen una prueba de concurrencia de varias conexiones en Supabase.

Copiar `.env.example` a `.env.local`. `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (o clave pública legacy anon compatible) vienen del proyecto de desarrollo. `VITE_VAPID_PUBLIC_KEY` es la parte pública de VAPID. Nunca colocar service_role, contraseñas ni VAPID privada en variables VITE_.

## Supabase local

1. `supabase start` y `supabase db reset` en un entorno local descartable. Este último destruye exclusivamente la base local; no ejecutarlo sobre datos a conservar.
2. Crear un usuario de administración en Auth local. El trigger crea profiles. Asignar el primer rol mediante SQL administrativo: `insert into public.user_roles(user_id,role) values ('UUID_DEL_USUARIO','admin');`. No hay administrador o contraseña predeterminados ni autoasignación de roles.
3. Copiar `supabase/.env.example` a `supabase/.env` y completar secretos de desarrollo. `supabase functions serve --env-file supabase/.env`.
4. `npm run dev`. Entrar a administración. Crear barberos, usuarios vinculados con rol Barber y servicios. En Configuración asignar servicios y horarios semanales a cada barbero. Sin usuario de barbero activo, asignaciones y horarios no se aceptan reservas: toda reserva debe tener un destinatario interno. No se inventan horarios reales.
5. Auth signup público debe permanecer deshabilitado. Las cuentas de personal se crean exclusivamente desde admin-users por un administrador validado contra Auth y PostgreSQL.

## Variables de Edge Functions

- SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: inyectadas por Supabase; solamente servidor.
- APP_ORIGIN: origen exacto, por ejemplo `https://tu-proyecto.vercel.app`, sin ruta ni barra final. En local `http://localhost:5173`. CORS limita al origen configurado.
- RATE_LIMIT_SECRET: secreto aleatorio para derivar identificadores de IP sin almacenar IP cruda.
- VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY: par estable generado localmente; `npx web-push generate-vapid-keys` en un entorno con acceso npm. Usar la pública también en VITE_VAPID_PUBLIC_KEY.
- VAPID_SUBJECT: contacto `mailto:correo@ejemplo.com`. No exige un dominio propio.
- PUSH_WORKER_SECRET: secreto independiente que autoriza exclusivamente el proceso de cola.
- GOOGLE_APPS_SCRIPT_URL: URL del web app de Google Apps Script desplegado para el puente de correo.
- GOOGLE_APPS_SCRIPT_SECRET: secreto largo y aleatorio compartido; se guarda también en Apps Script como propiedad `MAILER_SECRET`.


## Correos de citas con Gmail gratuito

1. En la cuenta Google que enviará los correos, crea un proyecto en `https://script.google.com` y pega `integrations/google-apps-script/Code.gs` en `Code.gs`.
2. En **Configuración del proyecto > Propiedades de la secuencia de comandos**, agrega `MAILER_SECRET` con un secreto aleatorio largo. Mantén el valor privado y configúralo también en Supabase como `GOOGLE_APPS_SCRIPT_SECRET`.
3. En el editor, selecciona `authorizeEmailSending` y ejecútala una vez. Inicia sesión en la cuenta Gmail emisora y autoriza el envío de correo.
4. Selecciona **Implementar > Nueva implementación > Aplicación web**, ejecuta como propietario y permite acceso a cualquiera. El código valida el secreto compartido en cada solicitud. Copia la URL `/exec` y configúrala en Supabase como `GOOGLE_APPS_SCRIPT_URL`.
5. Configura ambos secretos en las variables de Edge Functions de Supabase y vuelve a desplegar `booking`. Guarda el correo del barbero en su perfil; el cliente debe escribir su correo al reservar.

Las cuentas personales de Gmail tienen una cuota publicada de 100 destinatarios por día para Apps Script. Una reserva normal consume dos destinatarios. Google puede cambiar los límites y los mensajes pueden retrasarse o llegar a spam; el comprobante de la web y el centro de notificaciones siguen siendo la referencia de la cita.
## Cola y recordatorios

Las transacciones generan notifications y push_jobs por dispositivo. push-worker reclama hasta 50 trabajos con SKIP LOCKED y arrendamiento de 5 minutos, usa cifrado Web Push estándar vía web-push, reintenta con backoff hasta 6 intentos, retira endpoints 404/410 y no incluye datos personales en pantalla bloqueada. Las notificaciones persisten aunque el dispositivo no tenga push activado. Realtime actualiza la interfaz y hay recuperación periódica de avisos.

Para envío automático se debe programar una invocación autenticada de `push-worker` cada minuto. Hacerlo únicamente en el proyecto de desarrollo/autorizado. Guardar URL de función y PUSH_WORKER_SECRET en Supabase Vault; no incrustar secretos en migraciones o SQL versionado. Supabase Cron con pg_net puede leer ambos secretos desde Vault para invocar POST con `Authorization: Bearer ...`. La función llama enqueue_reminders y procesa la cola en cada ejecución. Si Cron no está configurado, habrá avisos internos persistentes, pero no entrega automática push ni recordatorios programados.

## Revisión antes de autorizar producción

Aplicar primero en Supabase de desarrollo. Revisar las cinco migraciones y sus pruebas. Comparar IDs y datos del backend anterior: el repositorio no contiene exportación, esquema ni credenciales de esa API, por lo que no se pueden importar sus datos automáticamente. No sustituir la base existente sin un respaldo y un plan de importación. Ejecutar npm ci y build en Linux conectado antes de autorizar el despliegue de Vercel.

Configurar origen HTTPS actual de Vercel y redirect URLs de Auth. Vercel sirve manifest, iconos y Service Worker; las rutas privadas tienen no-store, no-referrer y noindex. No agregar analítica ni recursos de terceros a /mi-cita. La URL privada es un bearer secret: quien la posee puede gestionar esa cita; no se escribe en logs de aplicación. El proveedor de hosting puede registrar rutas de acceso: revisar retención y exclusiones antes de activar producción. Los enlaces caducan 30 días después de la cita y rotan al reprogramar.

## Prueba de navegador sin servicios reales

`npm run test:browser` usa Playwright con API simulada. Instalar Chromium con `npx playwright install chromium` si es necesario. Preparar un build de prueba definiendo únicamente los valores ficticios `VITE_SUPABASE_URL=http://127.0.0.1:54321` y `VITE_SUPABASE_ANON_KEY=local-test-key`; ejecutar `npm run build` y `npm run preview`. En otra terminal, ejecutar la prueba con `SMOKE_URL=http://localhost:4173`. Opcionalmente `SMOKE_BROWSER` puede apuntar a un Chromium ya instalado. No usar esos valores en producción. La prueba no inicia ni modifica Supabase; intercepta las peticiones de booking. Recompilar luego con las variables del entorno correspondiente.

El envío programado tiene un script revisable en `supabase/manual/enable-push-schedule.sql`. Requiere secretos Vault `push_worker_url` (URL completa de la función) y `push_worker_secret`. Su ejecución remota necesita autorización; no forma parte de las migraciones automáticas.

En iPhone, instalar en Inicio y abrir desde allí; Web Push requiere soporte del sistema/navegador y permiso explícito. Probar en un Android y un iPhone físicos: instalación, permiso rechazado, activación, pantalla bloqueada, apertura del detalle, cierre de sesión, desactivación, 404/410 y reintentos. No hay garantía de entrega inmediata del sistema operativo. El service worker no ofrece reservas sin conexión: las reservas requieren validación del servidor.

## Reversión

No se entrega un DOWN que borre clientes o citas por defecto. Para revertir la aplicación, restaurar el commit anterior y sus variables; conservar la nueva base para auditoría. En desarrollo descartable, reiniciar la base local. En una base con datos, diseñar una migración compensatoria revisada, respaldar y obtener autorización antes de eliminar tablas o datos.

## Referencias oficiales consultadas

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/cron
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
## Proyecto conectado - 3 de noviembre de 2026

Proyecto elegido por el propietario: chcqmsccybrmgvzopxmw.
Panel: https://supabase.com/dashboard/project/chcqmsccybrmgvzopxmw

Las cinco migraciones se aplicaron al proyecto vacio. Funciones desplegadas: booking y admin-users. Frontend configurado mediante .env.local, excluido de Git. La contrasena de base de datos esta en supabase/.env, los secretos de funciones en supabase/.env.remote y las credenciales administrativas en supabase/.env.admin; todos excluidos de Git.

Origen autorizado: http://localhost:5173. Antes de publicar, actualizar APP_ORIGIN, auth.site_url y variables del hosting. Registro publico deshabilitado; acceso por correo del personal habilitado. Administrador: el correo de administracion elegido por el propietario.

El catalogo esta vacio: faltan servicios, personal y horarios reales. Web Push y recordatorios programados siguen pendientes de VAPID, push-worker y programacion.

El proyecto anterior ubiagfhabfjgahxgrrtp no se ha eliminado. Las variables previas se conservan localmente en .env.local.previous y supabase/.env.previous.

Verificacion final en el proyecto elegido: catalogo real HTTP 200 en navegador, inicio de sesion y acceso al Dashboard, registro publico cerrado, administracion anonima rechazada y build correcto.

La conexion del navegador tambien tiene una configuracion publica predeterminada en src/config/supabase.ts (URL y clave anon con RLS). Las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY pueden sobrescribirla. No contiene service_role ni contrasenas. Origen de funciones publicado: https://barberia-d2vs.vercel.app.
