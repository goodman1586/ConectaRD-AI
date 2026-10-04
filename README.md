# ConectaRD AI 8.6.1 (versión definitiva reforzada)

Paneles: `/cliente`, `/negocio`, `/repartidor`, `/admin`. Todo se sirve desde un solo servicio (API + HTML), así no hay problemas de CORS.

## Despliegue (GitHub + Render)
1. Sube el proyecto a GitHub (`.gitignore` ya excluye `node_modules` y `.env`).
2. En Render: **New → Blueprint** (usa `render.yaml`) o crea un Web Service manual: build `npm install`, start `npm start`, health check `/health`.
3. Variables de entorno obligatorias: `DATABASE_URL`, `ADMIN_KEY` (12+ caracteres), `SESSION_SECRET` (el blueprint la genera), `NODE_ENV=production`. Opcional: `OPENAI_API_KEY`.
4. El servidor se niega a arrancar en producción sin `SESSION_SECRET`.

## Migración desde 8.5.0
- La base de datos se migra sola al arrancar (columnas e índices nuevos).
- **Los códigos de acceso de repartidores existentes dejan de verse** (ya no se guardan en texto plano). Los repartidores con código viejo de 5 dígitos siguen entrando, pero genera uno nuevo con "🔑 Nuevo código" cuando puedas.
- El negocio demo ya no se crea solo: usa `SEED_DEMO=true` y `DEMO_PASSWORD`.
- Los dueños que usaban una contraseña anterior deben cambiar su contraseña (panel del negocio → Cambiar contraseña).

## Seguridad aplicada
- Solo se sirve la carpeta `public/` (antes se exponía `server.js`).
- Sin contraseñas ni secretos por defecto; `SESSION_SECRET` y `ADMIN_KEY` obligatorios.
- Sesiones revocables: cada petición revisa en la base de datos que el negocio/repartidor siga activo y que la clave no haya cambiado.
- Limitación de intentos en logins, pedidos, IA y confirmación de entrega; bloqueo del repartidor tras 5 códigos fallidos y del pedido tras 5 códigos de entrega fallidos.
- El repartidor ya no recibe el código de entrega del cliente.
- Códigos de repartidor guardados con hash (se muestran una sola vez).
- Panel maestro con token temporal de 8 h (la ADMIN_KEY ya no se guarda en el navegador).
- Validación de todos los campos, IDs de producto generados por el servidor, URLs solo http/https.
- Helmet + Content-Security-Policy estricta (sin scripts inline), CORS cerrado por defecto.
- Errores internos genéricos (no se filtra `e.message`).

## Mejoras funcionales
- Asignación de repartidores transaccional (sin dobles asignaciones) y reasignación automática de pedidos pendientes.
- Estados de pedido (Recibido → Preparando → Listo → Entregado / Cancelado), cancelar, reasignar y regenerar código desde el panel del negocio.
- El cliente conserva y sigue su pedido (y su código) aunque recargue la página.
- Editar nombre, precio e imagen de productos; mostrar/ocultar; eliminar.
- WhatsApp con prefijo `1` para números de RD; notificaciones compatibles con Android (service worker).
- El panel del repartidor ya no borra lo que se escribe; el estado de disponibilidad es el real.
- Índices, `LIMIT` en listados, pool de Postgres con manejo de errores, cierre ordenado, SSL condicional.

## Nota
- Las notificaciones del panel funcionan mientras el panel está abierto y con permiso del navegador; para notificación push con el panel cerrado se requiere configurar Web Push/VAPID.
- Las imágenes usan URLs HTTPS/HTTP para mantener el despliegue simple; se puede conectar almacenamiento externo después.
