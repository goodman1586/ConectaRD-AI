# ConectaRD AI 7.1 — IA real + Delivery

Esta versión conecta el asistente de la aplicación con el backend.

## Render
- Build Command: `npm install`
- Start Command: `npm start`

## Variables de entorno en Render
Solo hay que agregar:
- `OPENAI_API_KEY` = tu clave de OpenAI
- `OPENAI_MODEL` = `gpt-5` (opcional; si no se agrega, usa gpt-5)

La clave NO va dentro de `index.html`.

## Flujo
Cliente → IA real → catálogo → carrito → GPS/dirección → pedido → panel del negocio → repartidor.

El backend sigue usando memoria temporal para los pedidos; PostgreSQL, autenticación, pagos y webhooks quedan para la etapa de producción.
