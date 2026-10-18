# Conectek 9.1.0 — base Gloria a Dios

Paquete derivado de `ConectaRD-AI-gloria-a-Diod`. Conserva las rutas y pantallas existentes (`/cliente`, `/negocio`, `/repartidor`, `/admin`) y sus funciones originales.

## Estructura

- `server.js`, `package.json`, `render.yaml`: servidor y despliegue.
- `public/`: páginas y JavaScript de los cuatro perfiles.
- `public/assets/conectek-logo.png`: logo oficial generado para Conectek.
- `ESPECIFICACIONES/`: textos originales de los módulos 18, 19 y 20 incluidos como referencia.

## Cambios funcionales incluidos

- Marca Conectek y logo integrado en los encabezados de cliente, negocio, repartidor y administración.
- Sección administrativa **Identidad visual** para cambiar el logo mediante URL HTTPS, previsualizarlo, ajustar el ancho máximo entre 100 y 420 px y restaurar versiones anteriores.
- Preferencia del logo guardada en PostgreSQL; las migraciones se ejecutan al iniciar.
- `render.yaml` conserva la generación automática de `SESSION_SECRET` para despliegues mediante Blueprint.

## Despliegue

Sube el contenido de esta carpeta a la raíz de la rama `gloria-a-Diod` y confirma los archivos. En Render utiliza esa rama y el Blueprint `render.yaml`; el servicio requiere `DATABASE_URL` y `ADMIN_KEY`. El Blueprint genera `SESSION_SECRET`. En un servicio manual, crea esa variable de entorno con un valor aleatorio y privado. No subas `.env` ni secretos a GitHub.

Build: `npm install`  
Start: `npm start`  
Health check: `/health`

## Alcance de este ZIP

Los documentos de los módulos 19 y 20 están incluidos como especificaciones. El registro comercial con cobro recurrente, conciliación y renovación de membresías, integración con rutas por carretera, liquidaciones a repartidores, pagos, notificaciones push y el resto del panel financiero aún requieren implementación e integración con proveedores externos. Este paquete no simula esas operaciones ni activa cobros.

La identidad visual implementada admite una URL de imagen HTTPS y una restauración del historial; no ofrece carga directa de archivos ni variantes automáticas para modo claro/oscuro.
