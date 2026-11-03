# Tenorio Barber — cristal oscuro

Direccion basada en las referencias de escritorio y movil proporcionadas por el propietario. Skill: modern-frontend / nightside, adaptada a una reserva operativa. Logo SVG del propietario en public/images/tenorio_barber.svg; PNG original preservado. Los originales estaban en dist/images y se copiaron a public para conservarlos entre compilaciones.

## Materiales

Fondo grafito #0e1217, superficies #171c23, tipografia clara #f4f3f6, rojo #d92338 y acento legible #ff7083. Manrope local. Cristal ahumado, bordes finos iluminados, botones rojos y reflejos interiores moderados. Fondo abstracto hecho con CSS: curvas rojas discretas, sin fotografias ni sillas.

Dos columnas en escritorio: titulo e introduccion a la izquierda; flujo de reserva a la derecha. En movil se apilan, con logo centrado, menu desplegable, pasos compactos, tarjetas verticales y CTA de ancho completo. Navegacion enlazada a secciones reales. No se inventan datos de disponibilidad ni fotografias de personal: las iniciales proceden de nombres reales del catalogo.

## Controles

Iconos SVG Lucide, servidos con la aplicacion, sin nuevas dependencias. Selector nativo de servicios con categorias, duracion y precio. Tarjetas de barberos con estado seleccionado visible, iconos de pasos y foco de teclado. Estados de carga, error con reintento y agenda vacia. Los siguientes pasos mantienen los datos introducidos. Menu movil con aria-expanded, Escape y devolucion de foco.

Logo y colores aplicados a reservas, acceso del personal, administracion, comprobantes, calendario, favicon y PWA. Los iconos PNG se rasterizan a partir del simbolo SVG con scripts/generate-icons.mjs. No se usa un logo generado ni una marca sustituta.

## Validacion

Compilacion, TypeScript, lint y pruebas de utilidades. Flujo con API simulada en escritorio y movil: reservar, enlace privado, reprogramar y cancelar; menu movil y ausencia de desbordamiento horizontal. Las capturas de docs/design usan datos simulados, no precios ni personal publicados en Supabase.
