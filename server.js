import express from "express";
import cors from "cors";
import crypto from "crypto";
import OpenAI from "openai";

console.log("INICIANDO CONECTARD AI...");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-business-id", "x-admin-key"]
}));

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;


/* =========================================================
   NEGOCIOS
========================================================= */

const businesses = new Map([
  [
    "anamuya-demo",
    {
      id: "anamuya-demo",
      name: "Negocio Demo Anamuya",
      active: true,
      whatsapp: "",
      phone: "",
      address: "Higüey, República Dominicana",
      subscriptionExpiresAt: "2099-12-31T23:59:59.000Z",
      createdAt: new Date().toISOString()
    }
  ]
]);


/* =========================================================
   PRODUCTOS
========================================================= */

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


/* =========================================================
   PEDIDOS
========================================================= */

const orders = new Map();


/* =========================================================
   REPARTIDORES
========================================================= */

const drivers = new Map();


/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function businessIsActive(business) {
  if (!business) return false;

  return (
    business.active === true &&
    new Date(business.subscriptionExpiresAt).getTime() > Date.now()
  );
}


function getBusinessFromRequest(req) {
  const id =
    req.header("x-business-id") ||
    req.query.businessId ||
    req.body?.businessId;

  return businesses.get(id);
}


/* =========================================================
   NEGOCIO ACTIVO
========================================================= */

function requireActiveBusiness(req, res, next) {
  const business = getBusinessFromRequest(req);

  if (!business) {
    return res.status(404).json({
      ok: false,
      code: "BUSINESS_NOT_FOUND",
      message: "Negocio no encontrado."
    });
  }

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


/* =========================================================
   ADMINISTRADOR
========================================================= */

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_KEY_NOT_CONFIGURED",
      message: "ADMIN_KEY no está configurada en Render."
    });
  }

  const key = req.header("x-admin-key");

  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      ok: false,
      code: "INVALID_ADMIN_KEY",
      message: "Clave de administrador incorrecta."
    });
  }

  next();
}


/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "7.2",
    aiConfigured: Boolean(OPENAI_API_KEY),
    adminConfigured: Boolean(ADMIN_KEY),
    businesses: businesses.size,
    time: new Date().toISOString()
  });
});


/* =========================================================
   RUTA PRINCIPAL
========================================================= */

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "ConectaRD AI",
    message: "Backend funcionando correctamente."
  });
});


/* =========================================================
   NEGOCIO PÚBLICO
========================================================= */

app.get("/api/business/:businessId", (req, res) => {
  const business = businesses.get(req.params.businessId);

  if (!business) {
    return res.status(404).json({
      ok: false,
      code: "BUSINESS_NOT_FOUND",
      message: "Negocio no encontrado."
    });
  }

  res.json({
    ok: true,
    business: {
      id: business.id,
      name: business.name,
      active: businessIsActive(business),
      whatsapp: business.whatsapp,
      phone: business.phone,
      address: business.address
    }
  });
});


/* =========================================================
   PRODUCTOS PÚBLICOS
========================================================= */

app.get(
  "/api/products",
  requireActiveBusiness,
  (req, res) => {

    res.json({
      ok: true,
      business: req.business,
      products: products.get(req.business.id) || []
    });
  }
);


/* =========================================================
   IA
========================================================= */

app.post(
  "/api/ai",
  requireActiveBusiness,
  async (req, res) => {

    try {

      const message =
        String(req.body?.message || "").trim();

      if (!message) {
        return res.status(400).json({
          ok: false,
          message: "El mensaje es obligatorio."
        });
      }

      if (!openai) {
        return res.status(503).json({
          ok: false,
          message:
            "OPENAI_API_KEY no está configurada en Render."
        });
      }

      const catalog =
        products.get(req.business.id) || [];

      const catalogText =
        catalog
          .filter(product => product.available)
          .map(
            product =>
              `${product.name}: RD$${product.price}`
          )
          .join(", ");

      const response =
        await openai.responses.create({

          model: OPENAI_MODEL,

          instructions:
            `Eres ConectaRD AI, el asistente virtual del negocio "${req.business.name}".

Ayuda al cliente con:
- productos
- precios
- recomendaciones
- pedidos
- delivery
- recogida en el negocio

Sé amable, claro y breve.

Nunca inventes productos ni precios.

Catálogo disponible:
${catalogText}`,

          input: message
        });

      const reply =
        response.output_text ||
        "No pude generar una respuesta.";

      res.json({
        ok: true,
        reply
      });

    } catch (error) {

      console.error("ERROR OPENAI:", error);

      res.status(500).json({
        ok: false,
        message:
          "Error al conectar con la inteligencia artificial."
      });
    }
  }
);


/* =========================================================
   CREAR PEDIDO
========================================================= */

app.post(
  "/api/orders",
  requireActiveBusiness,
  (req, res) => {

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

    if (
      !customer ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "El nombre del cliente y los productos son obligatorios."
      });
    }

    const now =
      new Date().toISOString();

    const order = {

      id: crypto.randomUUID(),

      businessId:
        req.business.id,

      businessName:
        req.business.name,

      customer:
        String(customer).trim(),

      phone:
        String(phone || "").trim(),

      deliveryType:
        deliveryType === "pickup"
          ? "pickup"
          : "delivery",

      address:
        String(address || "").trim(),

      location:
        location || null,

      items:
        items.map(item => ({
          name: String(item.name || ""),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0)
        })),

      notes:
        String(notes || "").trim(),

      total:
        Number(total || 0),

      status:
        "new",

      driverId:
        null,

      createdAt:
        now,

      updatedAt:
        now
    };

    orders.set(order.id, order);

    console.log(
      "NUEVO PEDIDO:",
      order.id,
      "NEGOCIO:",
      order.businessId
    );

    res.status(201).json({
      ok: true,
      order
    });
  }
);


/* =========================================================
   LISTAR PEDIDOS DEL NEGOCIO
========================================================= */

app.get(
  "/api/orders",
  requireActiveBusiness,
  (req, res) => {

    const list =
      [...orders.values()]
        .filter(
          order =>
            order.businessId ===
            req.business.id
        )
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(
              a.createdAt
            )
        );

    res.json({
      ok: true,
      orders: list
    });
  }
);


/* =========================================================
   CAMBIAR ESTADO DEL PEDIDO
========================================================= */

app.patch(
  "/api/orders/:id/status",
  requireActiveBusiness,
  (req, res) => {

    const order =
      orders.get(req.params.id);

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

    const status =
      req.body?.status;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido."
      });
    }

    order.status =
      status;

    order.updatedAt =
      new Date().toISOString();

    orders.set(
      order.id,
      order
    );

    res.json({
      ok: true,
      order
    });
  }
);


/* =========================================================
   ADMIN — NEGOCIOS
========================================================= */

app.get(
  "/api/admin/businesses",
  requireAdmin,
  (_req, res) => {

    const list =
      [...businesses.values()]
        .map(business => ({
          ...business,
          active:
            businessIsActive(business)
        }));

    res.json({
      ok: true,
      businesses: list
    });
  }
);


/* =========================================================
   ADMIN — CREAR NEGOCIO
========================================================= */

app.post(
  "/api/admin/businesses",
  requireAdmin,
  (req, res) => {

    const {
      id,
      name,
      whatsapp,
      phone,
      address,
      subscriptionExpiresAt
    } = req.body || {};

    if (!id || !name) {
      return res.status(400).json({
        ok: false,
        message:
          "ID y nombre del negocio son obligatorios."
      });
    }

    const businessId =
      String(id)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-");

    if (businesses.has(businessId)) {
      return res.status(409).json({
        ok: false,
        message:
          "Ya existe un negocio con ese ID."
      });
    }

    const business = {

      id:
        businessId,

      name:
        String(name).trim(),

      active:
        true,

      whatsapp:
        String(whatsapp || "").trim(),

      phone:
        String(phone || "").trim(),

      address:
        String(address || "").trim(),

      subscriptionExpiresAt:
        subscriptionExpiresAt ||
        "2099-12-31T23:59:59.000Z",

      createdAt:
        new Date().toISOString()
    };

    businesses.set(
      business.id,
      business
    );

    products.set(
      business.id,
      []
    );

    res.status(201).json({
      ok: true,
      business
    });
  }
);


/* =========================================================
   ADMIN — MODIFICAR NEGOCIO
========================================================= */

app.patch(
  "/api/admin/businesses/:id",
  requireAdmin,
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
      typeof req.body?.name === "string" &&
      req.body.name.trim()
    ) {
      business.name =
        req.body.name.trim();
    }

    if (
      typeof req.body?.whatsapp === "string"
    ) {
      business.whatsapp =
        req.body.whatsapp.trim();
    }

    if (
      typeof req.body?.phone === "string"
    ) {
      business.phone =
        req.body.phone.trim();
    }

    if (
      typeof req.body?.address === "string"
    ) {
      business.address =
        req.body.address.trim();
    }

    if (
      typeof req.body?.active === "boolean"
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


/* =========================================================
   ADMIN — SUSCRIPCIÓN
========================================================= */

app.post(
  "/api/admin/businesses/:id/subscription",
  requireAdmin,
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
      typeof req.body?.active === "boolean"
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


/* =========================================================
   ADMIN — PRODUCTOS
========================================================= */

app.get(
  "/api/admin/products/:businessId",
  requireAdmin,
  (req, res) => {

    if (!businesses.has(req.params.businessId)) {
      return res.status(404).json({
        ok: false,
        message: "Negocio no encontrado."
      });
    }

    res.json({
      ok: true,
      products:
        products.get(req.params.businessId) || []
    });
  }
);


app.post(
  "/api/admin/products/:businessId",
  requireAdmin,
  (req, res) => {

    const businessId =
      req.params.businessId;

    if (!businesses.has(businessId)) {
      return res.status(404).json({
        ok: false,
        message: "Negocio no encontrado."
      });
    }

    const {
      name,
      price,
      available
    } = req.body || {};

    if (
      !name ||
      Number.isNaN(Number(price))
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Nombre y precio son obligatorios."
      });
    }

    const list =
      products.get(businessId) || [];

    const product = {

      id:
        crypto.randomUUID(),

      name:
        String(name).trim(),

      price:
        Number(price),

      available:
        available !== false
    };

    list.push(product);

    products.set(
      businessId,
      list
    );

    res.status(201).json({
      ok: true,
      product
    });
  }
);


app.patch(
  "/api/admin/products/:businessId/:productId",
  requireAdmin,
  (req, res) => {

    const list =
      products.get(req.params.businessId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "Negocio no encontrado."
      });
    }

    const product =
      list.find(
        p =>
          p.id ===
          req.params.productId
      );

    if (!product) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado."
      });
    }

    if (
      typeof req.body?.name === "string"
    ) {
      product.name =
        req.body.name.trim();
    }

    if (
      req.body?.price !== undefined
    ) {
      product.price =
        Number(req.body.price);
    }

    if (
      typeof req.body?.available === "boolean"
    ) {
      product.available =
        req.body.available;
    }

    products.set(
      req.params.businessId,
      list
    );

    res.json({
      ok: true,
      product
    });
  }
);


/* =========================================================
   ADMIN — TODOS LOS PEDIDOS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (_req, res) => {

    const list =
      [...orders.values()]
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(
              a.createdAt
            )
        );

    res.json({
      ok: true,
      orders: list
    });
  }
);


/* =========================================================
   ADMIN — CAMBIAR ESTADO
========================================================= */

app.patch(
  "/api/admin/orders/:id/status",
  requireAdmin,
  (req, res) => {

    const order =
      orders.get(req.params.id);

    if (!order) {
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

    if (
      !allowedStatuses.includes(
        req.body?.status
      )
    ) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido."
      });
    }

    order.status =
      req.body.status;

    order.updatedAt =
      new Date().toISOString();

    orders.set(
      order.id,
      order
    );

    res.json({
      ok: true,
      order
    });
  }
);


/* =========================================================
   ADMIN — REPARTIDORES
========================================================= */

app.get(
  "/api/admin/drivers",
  requireAdmin,
  (_req, res) => {

    res.json({
      ok: true,
      drivers:
        [...drivers.values()]
    });
  }
);


app.post(
  "/api/admin/drivers",
  requireAdmin,
  (req, res) => {

    const {
      businessId,
      name,
      whatsapp,
      phone
    } = req.body || {};

    if (!businessId || !name) {
      return res.status(400).json({
        ok: false,
        message:
          "Negocio y nombre son obligatorios."
      });
    }

    if (!businesses.has(businessId)) {
      return res.status(404).json({
        ok: false,
        message:
          "El negocio no existe."
      });
    }

    const driver = {

      id:
        crypto.randomUUID(),

      businessId,

      name:
        String(name).trim(),

      whatsapp:
        String(whatsapp || "").trim(),

      phone:
        String(phone || "").trim(),

      active:
        true,

      createdAt:
        new Date().toISOString()
    };

    drivers.set(
      driver.id,
      driver
    );

    res.status(201).json({
      ok: true,
      driver
    });
  }
);


/* =========================================================
   ADMIN — ASIGNAR REPARTIDOR
========================================================= */

app.patch(
  "/api/admin/orders/:id/driver",
  requireAdmin,
  (req, res) => {

    const order =
      orders.get(req.params.id);

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Pedido no encontrado."
      });
    }

    const driverId =
      req.body?.driverId || null;

    if (driverId) {

      const driver =
        drivers.get(driverId);

      if (!driver) {
        return res.status(404).json({
          ok: false,
          message:
            "Repartidor no encontrado."
        });
      }

      if (
        driver.businessId !==
        order.businessId
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "El repartidor pertenece a otro negocio."
        });
      }
    }

    order.driverId =
      driverId;

    order.updatedAt =
      new Date().toISOString();

    orders.set(
      order.id,
      order
    );

    res.json({
      ok: true,
      order
    });
  }
);


/* =========================================================
   SERVIDOR
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `ConectaRD AI 7.2 funcionando en puerto ${PORT}`
    );

    console.log(
      "ADMIN_KEY:",
      ADMIN_KEY
        ? "CONFIGURADA"
        : "NO CONFIGURADA"
    );

    console.log(
      "OPENAI:",
      OPENAI_API_KEY
        ? "CONFIGURADA"
        : "NO CONFIGURADA"
    );

    console.log(
      "MODELO:",
      OPENAI_MODEL
    );
  }
);
   
