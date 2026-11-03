# Estado de implementación — 2026-10-31

## Implementado localmente

1. Auditoría de arquitectura, módulos, endpoints, contratos y riesgos: migration-audit.md.
2. Cinco migraciones PostgreSQL versionadas: entidades solicitadas, RLS, constraints, auditoría, roles, cola de entrega, administración transaccional de perfiles y validación de snapshots. Se añaden push_jobs, rate_limits y configuration_events como soporte operativo.
3. Supabase Auth y nueva capa api conservando las pantallas y contratos del frontend. Se elimina VITE_API_URL y el proxy anterior. Roles Admin/Barber; clientes gestionados por enlace, sin cuenta.
4. Reservas confirmadas automáticamente; selección de servicio/barbero/cualquier disponible; horarios por profesional, descansos, bloqueos, buffer e intervalo configurables. Restricción GiST independiente de validaciones de aplicación. Snapshots históricos de duración y precio.
5. Enlace de 256 bits, hash SHA-256, expiración, rotación al reprogramar, acceso exclusivamente por Edge y límites persistentes. Cancelación y reprogramación validadas en servidor.
6. Comprobante privado recuperable al recargar, WhatsApp manual, copiar enlace, archivo de texto y calendario ICS sin token privado. Referrer-Policy y no-store; sin analítica ni fuentes externas.
7. PWA con manifest/iconos, Service Worker sin cachear datos privados, suscripción voluntaria, desactivación, avisos persistentes, Realtime y recuperación periódica. Worker Web Push VAPID con cola, lease, reintentos, depuración de endpoints caducados y recordatorios. Script manual de Cron con secretos en Vault, no ejecutado.
8. Configuración local de reglas, servicios por barbero y disponibilidad con permisos. Vinculación de usuarios a barberos y vencimiento opcional de acceso.

## Validación realizada

- TypeScript estricto: aprobado.
- Build de producción Vite: aprobado, sin credenciales reales.
- Oxlint: sin diagnósticos en 29 archivos.
- Pruebas unitarias: zona horaria, WhatsApp, ICS; además pruebas de Service Worker para navegación segura y payload inválido.
- PostgreSQL embebido PGlite: migraciones completas y 10 escenarios dentro de una prueba principal. Incluye confirmación automática, rollback, exclusión de solapamientos, descansos, horarios, RLS, no elevación de roles, tokens, snapshots, cancelación, cola, límites, buffers, plazos y gestión de usuarios atómica.
- Navegador Chromium: flujo reserva → enlace → reprogramación → enlace rotado → cancelación con confirmación → recarga; escritorios 1366×900 y móvil 390×844, API simulada. Sin errores JavaScript ni desbordamiento horizontal. Capturas locales en .npm-cache/screenshots.
- Deno 2.5.7: check aprobado para booking y admin-users. Worker push parseado/formateado; su check completo bloqueado por dependencia npm web-push ausente en la caché y red restringida.
- Detector Impeccable: sin hallazgos en los nuevos controles revisados.

## Limitaciones que requieren entorno externo

- No se ejecutaron migraciones, despliegues ni cambios de credenciales remotos. No hay credenciales Supabase en el repositorio.
- Falta aplicar y verificar en Supabase de desarrollo, establecer el administrador inicial, configurar APP_ORIGIN, RATE_LIMIT_SECRET y VAPID, desplegar las funciones con autorización y activar Cron/Vault.
- Falta prueba de concurrencia con varias conexiones PostgreSQL reales; PGlite prueba las restricciones SQL pero serializa las consultas. Falta prueba integral con Auth/PostgREST/Realtime reales.
- Falta comprobar entrega push, instalación y permisos en Android/iPhone físicos. No se afirma entrega real de ningún aviso.
- No se han importado datos del backend anterior: no está en este repositorio ni existe una exportación de sus datos.
- No se implementó correo automático: el flujo nuevo usa enlace privado, WhatsApp manual y push al personal; no se utiliza Resend ni se promete envío de correo.

## Entorno y decisiones de mantenimiento

La línea base no podía compilar sin instalar dependencias. PowerShell bloqueaba npm.ps1; se usó npm.cmd. La red devolvía EACCES al registro npm y Docker no permitía leer sus archivos de contexto. Se recuperaron paquetes oficiales con integridad desde la caché local y se regeneró package-lock.json sin modificar otros proyectos. Las dependencias se fijaron a versiones compatibles disponibles, manteniendo React 18, Router 6 y Vite 5. No se considera el resultado offline de npm audit una auditoría de vulnerabilidades actualizada.

El lock incluye los paquetes opcionales Rollup para Linux x64 requeridos por Vercel, con versiones tomadas del manifest upstream. Sus tarballs y checksums no estaban disponibles en la caché de Windows; esas dos entradas usan URLs HTTPS oficiales sin inventar hashes. Falta validar npm ci y build en Linux conectado antes de desplegar.

Se retiró axios sin uso. El paquete de toasts original no estaba disponible localmente: se conservó su interfaz de llamadas mediante services/toast.tsx, con avisos accesibles, estilos existentes y cierre manual. Se retiró la carga remota de fuentes para evitar conexiones de terceros en la página privada; las familias CSS conservan sus fallbacks locales.

El script scripts/vite.mjs carga la configuración con Node 24 para evitar que el empaquetado de configuración de esbuild intente leer directorios superiores bloqueados por el sandbox. El build funciona. El prebundling de desarrollo aún puede encontrar esa restricción en este entorno; para la revisión en navegador se usó build + preview. En una máquina de desarrollo normal se puede usar npm run dev.

No se ofrece un DOWN destructivo de tablas con datos personales. setup.md documenta una reversión conservando datos y la preparación de una migración compensatoria cuando exista un entorno autorizado.
