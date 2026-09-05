import express from "express";
import cors from "cors";
import crypto from "crypto";
import OpenAI from "openai";

console.log("INICIANDO CONECTARD AI...");

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
        name: "Tostada",
        price: 50,
        available: true
      },
      {
        id: "p2",
        name: "Jugo natural",
        price: 40,
        available: true
      },
      {
        id: "p3",
        name: "Batida",
        price: 80,
        available: true
      },
      {
        id: "p4",
        name: "Queque",
        price: 10,
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
    version: "OpenAI",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    time: new Date().toISOString()
  });
});

/* =========================
   INICIO
========================= */

app.get("/", (_req, res) => {
  res.sendFile(process.cwd() + "/index.html");
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
   OPENAI
========================= */

app.post("/api/ai", async (req, res) => {
  try {
    console.log("Solicitud recibida en /api/ai");

    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        message: "Falta el mensaje."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY no configurada.");

      return res.status(500).json({
        ok: false,
        message: "OPENAI_API_KEY no está configurada en Render."
      });
    }

    const client = new OpenAI({
      apiKey: apiKey
    });

    const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

    const catalog = products.get("anamuya-demo") || [];

    const catalogText = catalog
      .filter((product) => product.available)
      .map(
        (product) =>
          `${product.name}: RD$${product.price}`
      )
      .join(", ");

    const response = await client.responses.create({
      model: model,

      instructions:
        "Eres el asistente de ConectaRD AI, una plataforma dominicana de delivery. " +
        "Ayuda al cliente a elegir productos, conocer precios y preparar su pedido. " +
        "Sé amable, breve y claro. " +
        "Nunca inventes productos ni precios. " +
        "Solo puedes recomendar productos que estén en este catálogo: " +
        catalogText,

      input: message
    });

    const reply =
      response.output_text ||
      "No pude generar una respuesta en este momento.";

    console.log("Respuesta de OpenAI recibida.");

    return res.json({
      ok: true,
      reply: reply
    });

  } catch (error) {
    console.error("ERROR OPENAI:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al conectar con OpenAI."
    });
  }
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
    notes,
    total
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

    deliveryType:
      deliveryType || "delivery",

    address:
      address || "",

    location:
      location || null,

    items,

    notes:
      notes || "",

    total:
      Number(total || 0),

    status:
      "new",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()
  };

  orders.set(order.id, order);

  console.log("Nuevo pedido:", order.id);

  res.status(201).json({
    ok: true,
    order
  });
});

/* =========================
   LISTAR PEDIDOS
========================= */

app.get("/api/orders", requireActiveBusiness, (req, res) => {
  const list = [...orders.values()]
    .filter(
      (order) =>
        order.businessId === req.business.id
    )
    .sort(
      (a, b) =>
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

    if (
      !order ||
      order.businessId !== req.business.id
    ) {
      return res.status(404).json({
        ok: false,
        message: "Pedido no encontrado."
      });
    }

    const allowedStatuses = [
      "new",
      "preparing",
      "on_the_way",
      "delivered",
      "cancelled"
    ];

    const newStatus = req.body?.status;

    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido."
      });
    }

    order.status = newStatus;

    order.updatedAt =
      new Date().toISOString();

    orders.set(order.id, order);

    res.json({
      ok: true,
      order
    });
  }
);

/* =========================
   ADMINISTRACIÓN
========================= */

app.get("/api/admin/businesses", (_req, res) => {
  res.json({
    ok: true,

    businesses:
      [...businesses.values()].map(
        (business) => ({
          ...business,
          active:
            businessIsActive(business)
        })
      )
  });
});

/* =========================
   SUSCRIPCIÓN
========================= */

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

    if (
      typeof req.body?.active ===
      "boolean"
    ) {
      business.active =
        req.body.active;
    }

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
   SERVIDOR
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ConectaRD AI running on port ${PORT}`
    );
  }
);

