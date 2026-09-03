import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================
   NEGOCIOS
========================= */

const businesses = new Map([
  [
    "anamuya-demo",
    {
      id: "anamuya-demo",
      name: "Negocio Demo Anamuya",
      active: true,
      subscriptionExpiresAt: "2099-12-31T23:59:59.000Z"
    }
  ]
]);

/* =========================
   PRODUCTOS
========================= */

const products = new Map([
  [
    "anamuya-demo",
    [
      {
        id: "p1",
        name: "Producto Demo 1",
        price: 100,
        available: true
      },
      {
        id: "p2",
        name: "Producto Demo 2",
        price: 150,
        available: true
      }
    ]
  ]
]);

/* =========================
   PEDIDOS
========================= */

const orders = new Map();

/* =========================
   FUNCIONES
========================= */

function businessIsActive(business) {
  return (
    !!business &&
    business.active === true &&
    new Date(business.subscriptionExpiresAt) > new Date()
  );
}

function requireActiveBusiness(req, res, next) {
  const id =
    req.header("x-business-id") ||
    req.query.businessId ||
    req.body?.businessId;

  const business = businesses.get(id);

  if (!businessIsActive(business)) {
    return res.status(402).json({
      ok: false,
      code: "BUSINESS_SUSPENDED",
      message: "El negocio no tiene una suscripción activa."
    });
  }

  req.business = business;
  next();
}

/* =========================
   HEALTH
========================= */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "7.3",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

/* =========================
   NEGOCIO
========================= */

app.get("/api/business/:businessId", (req, res) => {
  const business = businesses.get(req.params.businessId);

  if (!business) {
    return res.status(404).json({
      ok: false,
      message: "Negocio no encontrado."
    });
  }

  res.json({
    ok: true,
    business: {
      ...business,
      active: businessIsActive(business)
    }
  });
});

/* =========================
   PRODUCTOS
========================= */

app.get("/api/products", requireActiveBusiness, (req, res) => {
  res.json({
    ok: true,
    products: products.get(req.business.id) || []
  });
});

/* =========================
   CREAR PEDIDO
========================= */

app.post("/api/orders", requireActiveBusiness, (req, res) => {
  const {
    customer,
    phone,
    deliveryType,
    address,
    location,
    items,
    notes
  } = req.body || {};

  if (!customer || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "customer e items son obligatorios."
    });
  }

  const order = {
    id: crypto.randomUUID(),
    businessId: req.business.id,
    customer,
    phone: phone || "",
    deliveryType: deliveryType || "delivery",
    address: address || "",
    location: location || null,
    items,
    notes: notes || "",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.set(order.id, order);

  console.log("Pedido creado:", order.id);

  res.status(201).json({
    ok: true,
    order
  });
});

/* =========================
   CONSULTAR PEDIDOS
========================= */

app.get("/api/orders", requireActiveBusiness, (req, res) => {
  const list = [...orders.values()]
    .filter((o) => o.businessId === req.business.id)
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

  res.json({
    ok: true,
    orders: list
  });
});

/* =========================
   CAMBIAR ESTADO DEL PEDIDO
========================= */

app.patch(
  "/api/orders/:id/status",
  requireActiveBusiness,
  (req, res) => {
    const order = orders.get(req.params.id);

    if (!order || order.businessId !== req.business.id) {
      return res.status(404).json({
        ok: false,
        message: "Pedido no encontrado."
      });
    }

    const allowed = [
      "new",
      "preparing",
      "on_the_way",
      "delivered",
      "cancelled"
    ];

    if (!allowed.includes(req.body?.status)) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido."
      });
    }

    order.status = req.body.status;
    order.updatedAt = new Date().toISOString();

    orders.set(order.id, order);

    res.json({
      ok: true,
      order
    });
  }
);

/* =========================
   GEMINI AI
========================= */

app.post("/api/ai", async (req, res) => {
  try {
    console.log("Solicitud recibida en /api/ai");

    const message = String(
      req.body?.message || ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        message: "Falta el mensaje."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY no está configurada."
      );

      return res.status(500).json({
        ok: false,
        message:
          "GEMINI_API_KEY no está configurada en Render."
      });
    }

    const catalog =
      products.get("anamuya-demo") || [];

    const catalogText = catalog
  .filter((p) => p.available)
  .map((p) => p.name + ": RD$" + p.price)
  .join("\n");

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" +
      encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `
Eres el asistente de ConectaRD AI.

Ayuda a los clientes con productos,
precios y recomendaciones.

CATÁLOGO DISPONIBLE:
${catalogText}

Reglas:
- Responde en español.
- Sé breve, amable y claro.
- Usa pesos dominicanos (RD$).
- No inventes productos.
- No inventes precios.
- Si el cliente tiene un presupuesto,
  recomienda solamente productos cuyo
  precio esté dentro de ese presupuesto.
- Si no hay suficiente información,
  pregunta al cliente.
              `.trim()
            }
          ]
        },

        contents: [
          {
            role: "user",
            parts: [
              {
                text: message
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "ERROR REAL DE GEMINI:",
        JSON.stringify(data, null, 2)
      );

      return res.status(500).json({
        ok: false,
        message:
          data?.error?.message ||
          "Gemini rechazó la solicitud."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      console.error(
        "Gemini no devolvió una respuesta:",
        JSON.stringify(data, null, 2)
      );

      return res.status(500).json({
        ok: false,
        message:
          "Gemini no devolvió una respuesta."
      });
    }

    console.log(
      "Gemini respondió correctamente."
    );

    return res.json({
      ok: true,
      reply
    });

  } catch (error) {
    console.error(
      "ERROR INTERNO GEMINI:",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "Error interno al conectar con Gemini."
    });
  }
});

/* =========================
   ADMINISTRACIÓN
========================= */

app.get(
  "/api/admin/businesses",
  (_req, res) => {
    res.json({
      ok: true,
      businesses: [
        ...businesses.values()
      ].map((b) => ({
        ...b,
        active: businessIsActive(b)
      }))
    });
  }
);

app.post(
  "/api/admin/businesses/:id/subscription",
  (req, res) => {
    const business =
      businesses.get(req.params.id);

    if (!business) {
      return res.status(404).json({
        ok: false,
        message: "Negocio no encontrado."
      });
    }

    business.active =
      Boolean(req.body?.active);

    if (
      req.body?.subscriptionExpiresAt
    ) {
      business.subscriptionExpiresAt =
        req.body.subscriptionExpiresAt;
    }

    businesses.set(
      business.id,
      business
    );

    res.json({
      ok: true,
      business
    });
  }
);

/* =========================
   INICIO DEL SERVIDOR
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      ConectaRD AI 7.3 running on port ${PORT}
    );
  }
);
