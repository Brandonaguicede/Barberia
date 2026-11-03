# Auditoría de migración — 2026-10-31

## Alcance y línea base

Repositorio existente: React 18, TypeScript estricto, Vite 5, React Router 6, CSS Modules, lucide-react y react-hot-toast. No contiene backend, SQL, pruebas, lint ni documentación de despliegue. No hay AGENTS.md. `npm` en PowerShell está bloqueado por ExecutionPolicy; se usa `npm.cmd` sin cambiar políticas del equipo. La instalación/build y sus resultados posteriores se documentan en migration-status.md.

## Inventario

- Auth: AuthContext, LoginPage, ProtectedRoute. Tokens manuales en localStorage y refresh propio.
- Cliente: BookingPage (cuatro pasos) y ConfirmationPage (solo location.state).
- Administración: AdminDashboard, AdminAppointments, AdminBarbers, AdminServices, AdminUsers; AdminLayout compartido con barberos.
- Componentes reutilizables: Modal, FormField/Input/Select/TextArea, StatusBadge y layouts.
- No existen módulos independientes de clientes, configuración, disponibilidad, notificaciones, PWA o agenda calendario. Las citas se presentan como tabla filtrable.
- Dependencias: axios instalado pero sin uso en src; fetch centralizado en services/api.ts. No se conserva axios en la migración.

## Todos los contratos HTTP anteriores

Único consumidor de VITE_API_URL: src/services/api.ts; fallback http://localhost:3000. .env.example contiene la variable. Todos los módulos dependen de esta capa.

| Operación | Endpoint anterior | Sustitución |
|---|---|---|
| Iniciar/refrescar/cerrar sesión | POST /login, /refresh, /logout | Supabase Auth SDK |
| Perfil/lista usuarios | GET /users/me, /users | profiles + user_roles con RLS |
| Crear usuario | POST /register, /admin/register | Edge admin-users, rol validado en servidor |
| Actividad y vencimiento | PATCH /users/:id/status, /users/:id/subscription-expiration | Edge admin-users |
| Barberos públicos/admin | GET /barbers, /barbers/all, /barbers/:id | catálogo público restringido y tablas con RLS |
| Crear/editar/desactivar barbero | POST /barbers, PUT/DELETE /barbers/:id | Supabase + RLS; baja lógica |
| Servicios públicos/admin | GET /services, /services/all, /services/:id | catálogo público restringido y tablas con RLS |
| Crear/editar/desactivar servicio | POST /services, PUT/DELETE /services/:id | Supabase + RLS; baja lógica |
| Citas/lista/detalle | GET /appointments, /appointments/:id | appointments con RLS + adaptación al contrato actual |
| Disponibilidad | GET /appointments/available-slots | Edge booking → RPC |
| Reservar/editar | POST /appointments, PUT /appointments/:id | RPC transaccional vía Edge / RPC autenticado |
| Estado/cancelar | PATCH /appointments/:id/status, DELETE /appointments/:id | RPC con validación de permisos/transiciones |
| Indicadores | GET /appointments/stats | RPC autenticado |

## Contratos de datos actuales

IDs string; active numérico 0/1. Barber: name, specialty, phone, email. Service: name, description, duration en minutos, price numérico CRC, category. Appointment: client_name/phone/email, barber_id/service_id, appointment_date YYYY-MM-DD, appointment_time HH:mm, status pending/confirmed/completed/cancelled, notes, nombres y precio/duración derivados. User: username/email, role Admin/Subscription_L1, barber_id, active, subscriptionExpirationDate. La API anterior convertía camelCase a snake_case. Se preserva la interfaz de servicios del frontend con adaptadores; PostgreSQL utiliza timestamptz UTC y snapshots históricos. Subscription_L1 se reemplaza por Barber y se conserva vencimiento opcional de acceso.

## Riesgos encontrados

1. No se puede verificar seguridad del backend ausente; filtros de interfaz no autorizan acceso.
2. Reserva pública anuncia envío de correo sin implementación visible. Se retira esa promesa: el nuevo alcance pide Web Push/WhatsApp manual, sin Resend.
3. Confirmación depende de memoria de navegación y mezcla título confirmado con etiqueta pendiente.
4. No hay exclusión de solapamientos, auditoría, límites ni validación transaccional en este repositorio.
5. Fecha mínima calculada en UTC puede diferir del día de Costa Rica.
6. Solicitudes de slots sin protección contra respuestas fuera de orden.
7. Usuario barbero no tiene asignación editable a su perfil de barbero; roles de suscripción mezclan autorización y facturación.
8. Componentes administrativos no presentan todos los errores; dashboard tiene rechazo no manejado.
9. Fuentes externas deben evitarse en enlace privado y el service worker no debe cachear tokens, API, datos privados ni navegación privada.

## Estrategia

Conservar componentes y CSS. Cambiar la capa api, integrar Auth SDK y eventos de sesión. Introducir SQL versionado con RLS, motor transaccional, tokens hash y cola push. Catálogo y disponibilidad públicos solo por Edge/RPC; no tablas privadas anónimas. Implementar comprobante recuperable mediante token, acciones cliente, WhatsApp/ICS, PWA y centro de notificaciones. Validar frontend, funciones y PostgreSQL local cuando estén disponibles; no ejecutar migraciones remotas. Sin credenciales no afirmar validación de producción ni entrega push real.
