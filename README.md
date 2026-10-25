# Conectek 9.1.0

Aplicación marketplace derivada de `ConectaRD-AI-gloria-a-Diod`. Conserva los perfiles y las rutas existentes: `/cliente`, `/negocio`, `/repartidor` y `/admin`.

## Funciones

- Marca Conectek y logotipo configurable desde Administración, con historial y restauración.
- Catálogo de productos, tiendas, promociones, perfiles de negocio y pedidos.
- Interfaz del cliente en español, inglés y kreyòl ayisyen; preferencia guardada localmente.
- Administración de moneda de catálogo/cobro: USD, DOP o HTG. Cambiar la moneda no convierte los precios existentes; el administrador debe revisar esos precios antes de publicar.
- Entrega o recogida en tienda. El delivery usa distancia y duración de ruta de Google Routes; se mantiene desactivado si no hay clave configurada.
- Configuración maestra de comisión de plataforma, comisión individual por negocio, tarifa de delivery y porcentaje del delivery asignado al repartidor.
- Checkout alojado por Stripe para tarjetas Visa/débito y ACH en USD, con pagos a cuentas conectadas del negocio. Stripe recopila la información bancaria; Conectek no guarda esos datos.
- Zelle opcional con confirmación manual del administrador y efectivo únicamente al recoger, si están habilitados.
- Registro de comisión, tarifa, pago estimado del repartidor y neto del negocio por pedido.

## Configuración para cobros reales

1. Configura en Render `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` desde **Environment**. No los publiques ni los guardes en el repositorio.
2. En Stripe registra el webhook `https://TU-DOMINIO/api/stripe/webhook` para `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`.
3. Cada negocio debe entrar a su panel y completar el onboarding de Stripe Connect. La opción de cobro aparece al cliente solo cuando Stripe habilite esa cuenta.
4. Para ACH, usa USD, activa ACH en el panel maestro y espera que Stripe apruebe la capacidad de pagos bancarios del negocio. ACH puede quedar pendiente mientras el banco procesa la transferencia; la aplicación espera el evento de éxito antes de poner el pedido en preparación.
5. Para Zelle, el negocio debe estar inscrito en su banco. La administración confirma el abono después de verificarlo en la banca; Conectek no confirma Zelle automáticamente.
6. Configura `GOOGLE_MAPS_ROUTES_API_KEY` y habilita Google Routes API antes de activar el delivery.

Stripe admite USD, DOP y HTG como monedas de presentación para tarjeta, pero la moneda de cobro, la moneda de liquidación, el país de las cuentas Connect y la conversión deben configurarse en Stripe para la operación real. ACH está limitado a USD en esta aplicación. Confirma con Stripe los métodos y liquidaciones que aplican a cada cuenta y país.

## Reparto y comisión

La comisión de Conectek se calcula como porcentaje del subtotal de productos. Un negocio puede tener una tasa individual; si no, aplica la tasa global administrada. El pago estimado del repartidor es el porcentaje configurado de la tarifa de delivery. El neto del negocio se calcula con el total del pedido menos comisión y parte del repartidor. Las tarifas de procesamiento de Stripe, reembolsos, contracargos, impuestos y reglas locales requieren configuración contable/comercial adicional y no se consideran una ganancia neta final.

Los valores iniciales son conservadores: comisión 0%, delivery apagado, ACH apagado y el efectivo al recoger habilitado. El administrador debe definir tarifas y revisar la operación con las cuentas Stripe antes de abrir pagos a clientes.

## Desarrollo y despliegue

- Requisitos: Node.js 18+ y PostgreSQL.
- Instalar: `npm install`
- Iniciar: `npm start`
- Comprobación de sintaxis del servidor: `npm run check`
- Health check: `/health`
- El Blueprint `render.yaml` incluye las variables opcionales de Stripe y Google Routes. `DATABASE_URL` y `ADMIN_KEY` se completan en Render.
- No subas `.env` ni claves privadas a GitHub.

El perfil de cliente guarda nombre y teléfono localmente en el navegador; no es una cuenta autenticada ni se sincroniza entre dispositivos. La aplicación tampoco hace conversiones automáticas de precios ni simula pagos o liquidaciones.
