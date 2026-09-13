import express from "express";
import cors from "cors";
import crypto from "crypto";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

/* ==================================================
   NEGOCIOS
================================================== */

const businesses = new Map([
  [
    "anamuya-demo",
    {
      id: "anamuya-demo",
      name: "Negocio Demo Anamuya",
      active: true,
      whatsapp: "",
      phone: "",
      subscriptionExpiresAt: "2099-12-31T23:59:59.000Z",
      createdAt: new Date().toISOString()
    }
  ]
]);

/* ==================================================
   PRODUCTOS
================================================== */

const products = new Map();

/*
  Catálogo inicial de demostración.
*/
function createInitialProducts() {
  const initial = [
    ["Tostada", 50],
    ["Jugo natural", 40],
    ["Batida", 80],
    ["Queque", 10]
  ];

  for (const [name, price] of initial) {
    const product = {
      id: crypto.randomUUID(),
      businessId: "anamuya-demo",
      name,
      price,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    products.set(product.id, product);
  }
}

createInitialProducts();

/* ==================================================
   REPARTIDORES
================================================== */

const drivers = new Map();

/* ==================================================
   PEDIDOS
================================================== */

const orders = new Map();

/* ==================================================
   FUNCIONES
================================================== */

function businessIsActive(business) {
  if (!business) return false;

  if (business.active !== true) {
    return false;
  }

  return (
    new Date(business.subscriptionExpiresAt) >
    new Date()
  );
}

function getBusinessId(req) {
  return (
    req.header("x-business-id") ||
    req.query.businessId ||
    req.body?.businessId ||
    ""
  ).trim();
}

function getBusinessProducts(businessId, includeInactive = false) {
  return [...products.values()]
    .filter(product => {
      if (product.businessId !== businessId) {
        return false;
      }

      if (!includeInactive && product.active !== true) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
}

/* ==================================================
   NEGOCIO ACTIVO
================================================== */

function requireActiveBusiness(req, res, next) {
  const id = getBusinessId(req);

  const business = businesses.get(id);

  if (!businessIsActive(business)) {
    return res.status(402).json({
      ok: false,
      code: "BUSINESS_SUSPENDED",
      message:
        "El negocio no tiene una suscripción activa."
    });
  }

  req.business = business;

  next();
}

/* ==================================================
   ADMINISTRADOR
================================================== */

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(500).json({
      ok: false,
      code: "ADMIN_KEY_NOT_CONFIGURED",
      message:
        "ADMIN_KEY no está configurada en Render."
    });
  }

  const key = req.header("x-admin-key");

  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      ok: false,
      code: "INVALID_ADMIN_KEY",
      message:
        "Clave de administrador incorrecta."
    });
  }

  next();
}

/* ==================================================
   HEALTH
================================================== */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "8.0.0",
    aiConfigured: !!OPENAI_API_KEY,
    adminConfigured: !!ADMIN_KEY,
    businesses: businesses.size,
    products: products.size,
    drivers: drivers.size,
    orders: orders.size
  });
});

/* ==================================================
   INFORMACIÓN DEL NEGOCIO
================================================== */

app.get(
  "/api/business",
  requireActiveBusiness,
  (req, res) => {
    return res.json({
      ok: true,
      business: req.business,
      products: getBusinessProducts(
        req.business.id,
        false
      )
    });
  }
);

/* ==================================================
   PRODUCTOS PARA CLIENTES
================================================== */

app.get(
  "/api/products",
  requireActiveBusiness,
  (req, res) => {
    return res.json({
      ok: true,
      products: getBusinessProducts(
        req.business.id,
        false
      )
    });
  }
);

/* ==================================================
   IA
================================================== */

app.post(
  "/api/ai",
  requireActiveBusiness,
  async (req, res) => {
    try {
      const message = String(
        req.body?.message || ""
      ).trim();

      if (!message) {
        return res.status(400).json({
          ok: false,
          message:
            "El mensaje es obligatorio."
        });
      }

      if (!openai) {
        return res.status(503).json({
          ok: false,
          message:
            "La IA no está configurada."
        });
      }

      const catalog =
        getBusinessProducts(
          req.business.id,
          false
        );

      const catalogText =
        catalog.length
          ? catalog
              .map(
                p =>
                  `${p.name}: RD$${p.price}`
              )
              .join("\n")
          : "No hay productos disponibles.";

      const response =
        await openai.chat.completions.create({
          model: OPENAI_MODEL,

          messages: [
            {
              role: "system",
              content: `
Eres el asistente de ConectaRD AI.

Negocio:
${req.business.name}

Ayuda al cliente con:
- productos
- precios
- recomendaciones
- pedidos
- delivery

Catálogo actual:
${catalogText}

Responde en español, de forma clara,
amable y breve.

Nunca inventes productos ni precios
que no estén en el catálogo.
              `.trim()
            },
            {
              role: "user",
              content: message
            }
          ]
        });

      const reply =
        response.choices?.[0]?.message?.content ||
        "No pude generar una respuesta.";

      return res.json({
        ok: true,
        reply
      });

    } catch (error) {
      console.error(
        "Error IA:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Error al consultar la IA."
      });
    }
  }
);

/* ==================================================
   CREAR PEDIDO
================================================== */

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
          "customer e items son obligatorios."
      });
    }

    const now =
      new Date().toISOString();

    const order = {
      id: crypto.randomUUID(),

      businessId:
        req.business.id,

      customer:
        String(customer).trim(),

      phone:
        String(phone || "").trim(),

      deliveryType:
        deliveryType || "delivery",

      address:
        String(address || "").trim(),

      location:
        location || null,

      items,

      notes:
        String(notes || "").trim(),

      total:
        Number(total || 0),

      status: "new",

      createdAt: now,

      updatedAt: now
    };

    orders.set(
      order.id,
      order
    );

    console.log(
      "Nuevo pedido:",
      order.id,
      "Negocio:",
      req.business.name
    );

    return res.status(201).json({
      ok: true,
      order
    });
  }
);

/* ==================================================
   LISTAR PEDIDOS
================================================== */

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

    return res.json({
      ok: true,
      orders: list
    });
  }
);

/* ==================================================
   CAMBIAR ESTADO DEL PEDIDO
================================================== */

app.patch(
  "/api/orders/:id/status",
  requireActiveBusiness,
  (req, res) => {

    const order =
      orders.get(req.params.id);

    if (
      !order ||
      order.businessId !==
        req.business.id
    ) {
      return res.status(404).json({
        ok: false,
        message:
          "Pedido no encontrado."
      });
    }

    const allowedStatuses = [
      "new",
      "preparing",
      "on_the_way",
      "delivered",
      "cancelled"
    ];

    const newStatus =
      req.body?.status;

    if (
      !allowedStatuses.includes(
        newStatus
      )
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Estado no válido."
      });
    }

    order.status =
      newStatus;

    order.updatedAt =
      new Date().toISOString();

    orders.set(
      order.id,
      order
    );

    return res.json({
      ok: true,
      order
    });
  }
);

/* ==================================================
   PANEL MAESTRO
================================================== */

/* ------------------------------
   LISTAR NEGOCIOS
------------------------------ */

app.get(
  "/api/admin/businesses",
  requireAdmin,
  (_req, res) => {

    const list =
      [...businesses.values()]
        .map(business => ({
          ...business,

          subscriptionActive:
            businessIsActive(
              business
            ),

          productCount:
            getBusinessProducts(
              business.id,
              true
            ).length
        }));

    return res.json({
      ok: true,
      businesses: list
    });
  }
);

/* ------------------------------
   CREAR NEGOCIO
------------------------------ */

app.post(
  "/api/admin/businesses",
  requireAdmin,
  (req, res) => {

    const {
      name,
      id,
      whatsapp,
      phone,
      subscriptionExpiresAt
    } = req.body || {};

    if (!name || !id) {
      return res.status(400).json({
        ok: false,
        message:
          "Nombre e ID del negocio son obligatorios."
      });
    }

    const businessId =
      String(id)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

    if (
      businesses.has(
        businessId
      )
    ) {
      return res.status(409).json({
        ok: false,
        message:
          "Ya existe un negocio con ese ID."
      });
    }

    const business = {
      id: businessId,

      name:
        String(name).trim(),

      active: true,

      whatsapp:
        String(
          whatsapp || ""
        ).trim(),

      phone:
        String(
          phone || ""
        ).trim(),

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

    return res.status(201).json({
      ok: true,
      business
    });
  }
);

/* ------------------------------
   MODIFICAR NEGOCIO
------------------------------ */

app.patch(
  "/api/admin/businesses/:id",
  requireAdmin,
  (req, res) => {

    const business =
      businesses.get(
        req.params.id
      );

    if (!business) {
      return res.status(404).json({
        ok: false,
        message:
          "Negocio no encontrado."
      });
    }

    if (
      typeof req.body?.name ===
        "string" &&
      req.body.name.trim()
    ) {
      business.name =
        req.body.name.trim();
    }

    if (
      typeof req.body?.active ===
        "boolean"
    ) {
      business.active =
        req.body.active;
    }

    if (
      typeof req.body?.whatsapp ===
        "string"
    ) {
      business.whatsapp =
        req.body.whatsapp.trim();
    }

    if (
      typeof req.body?.phone ===
        "string"
    ) {
      business.phone =
        req.body.phone.trim();
    }

    if (
      req.body
        ?.subscriptionExpiresAt
    ) {
      business.subscriptionExpiresAt =
        req.body
          .subscriptionExpiresAt;
    }

    business.updatedAt =
      new Date().toISOString();

    businesses.set(
      business.id,
      business
    );

    return res.json({
      ok: true,
      business
    });
  }
);

/* ==================================================
   SUSCRIPCIÓN
================================================== */

app.post(
  "/api/admin/businesses/:id/subscription",
  requireAdmin,
  (req, res) => {

    const business =
      businesses.get(
        req.params.id
      );

    if (!business) {
      return res.status(404).json({
        ok: false,
        message:
          "Negocio no encontrado."
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
      req.body
        ?.subscriptionExpiresAt
    ) {
      business.subscriptionExpiresAt =
        req.body
          .subscriptionExpiresAt;
    }

    business.updatedAt =
      new Date().toISOString();

    businesses.set(
      business.id,
      business
    );

    return res.json({
      ok: true,
      business
    });
  }
);

/* ==================================================
   PRODUCTOS — PANEL MAESTRO
================================================== */

/* ------------------------------
   LISTAR TODOS LOS PRODUCTOS
------------------------------ */

app.get(
  "/api/admin/products",
  requireAdmin,
  (req, res) => {

    const businessId =
      String(
        req.query.businessId || ""
      ).trim();

    let list =
      [...products.values()];

    if (businessId) {
      list =
        list.filter(
          p =>
            p.businessId ===
            businessId
        );
    }

    list.sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "es"
      )
    );

    return res.json({
      ok: true,
      products: list
    });
  }
);

/* ------------------------------
   CREAR PRODUCTO
------------------------------ */

app.post(
  "/api/admin/products",
  requireAdmin,
  (req, res) => {

    const {
      businessId,
      name,
      price,
      active
    } = req.body || {};

    if (
      !businessId ||
      !name
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "businessId y name son obligatorios."
      });
    }

    const business =
      businesses.get(
        String(businessId).trim()
      );

    if (!business) {
      return res.status(404).json({
        ok: false,
        message:
          "El negocio no existe."
      });
    }

    const numericPrice =
      Number(price);

    if (
      !Number.isFinite(
        numericPrice
      ) ||
      numericPrice < 0
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "El precio no es válido."
      });
    }

    const product = {
      id: crypto.randomUUID(),

      businessId:
        business.id,

      name:
        String(name).trim(),

      price:
        numericPrice,

      active:
        typeof active ===
        "boolean"
          ? active
          : true,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    products.set(
      product.id,
      product
    );

    return res.status(201).json({
      ok: true,
      product
    });
  }
);

/* ------------------------------
   MODIFICAR PRODUCTO
------------------------------ */

app.patch(
  "/api/admin/products/:id",
  requireAdmin,
  (req, res) => {

    const product =
      products.get(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        ok: false,
        message:
          "Producto no encontrado."
      });
    }

    if (
      typeof req.body?.name ===
        "string" &&
      req.body.name.trim()
    ) {
      product.name =
        req.body.name.trim();
    }

    if (
      req.body?.price !==
        undefined
    ) {
      const numericPrice =
        Number(
          req.body.price
        );

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "El precio no es válido."
        });
      }

      product.price =
        numericPrice;
    }

    if (
      typeof req.body?.active ===
        "boolean"
    ) {
      product.active =
        req.body.active;
    }

    product.updatedAt =
      new Date().toISOString();

    products.set(
      product.id,
      product
    );

    return res.json({
      ok: true,
      product
    });
  }
);

/* ------------------------------
   ACTIVAR / DESACTIVAR PRODUCTO
------------------------------ */

app.patch(
  "/api/admin/products/:id/status",
  requireAdmin,
  (req, res) => {

    const product =
      products.get(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        ok: false,
        message:
          "Producto no encontrado."
      });
    }

    if (
      typeof req.body?.active !==
      "boolean"
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "active debe ser true o false."
      });
    }

    product.active =
      req.body.active;

    product.updatedAt =
      new Date().toISOString();

    products.set(
      product.id,
      product
    );

    return res.json({
      ok: true,
      product
    });
  }
);

/* ------------------------------
   ELIMINAR PRODUCTO
------------------------------ */

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  (req, res) => {

    const product =
      products.get(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        ok: false,
        message:
          "Producto no encontrado."
      });
    }

    products.delete(
      product.id
    );

    return res.json({
      ok: true,
      message:
        "Producto eliminado.",
      productId:
        product.id
    });
  }
);

/* ==================================================
   REPARTIDORES
================================================== */

/* LISTAR */

app.get(
  "/api/admin/drivers",
  requireAdmin,
  (_req, res) => {

    return res.json({
      ok: true,
      drivers:
        [...drivers.values()]
    });
  }
);

/* CREAR */

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

    if (
      !businessId ||
      !name
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "Negocio y nombre del repartidor son obligatorios."
      });
    }

    const business =
      businesses.get(
        String(
          businessId
        ).trim()
      );

    if (!business) {
      return res.status(404).json({
        ok: false,
        message:
          "El negocio no existe."
      });
    }

    const driver = {
      id: crypto.randomUUID(),

      businessId:
        business.id,

      name:
        String(name).trim(),

      whatsapp:
        String(
          whatsapp || ""
        ).trim(),

      phone:
        String(
          phone || ""
        ).trim(),

      active: true,

      createdAt:
        new Date().toISOString()
    };

    drivers.set(
      driver.id,
      driver
    );

    return res.status(201).json({
      ok: true,
      driver
    });
  }
);

/* MODIFICAR REPARTIDOR */

app.patch(
  "/api/admin/drivers/:id",
  requireAdmin,
  (req, res) => {

    const driver =
      drivers.get(
        req.params.id
      );

    if (!driver) {
      return res.status(404).json({
        ok: false,
        message:
          "Repartidor no encontrado."
      });
    }

    if (
      typeof req.body?.name ===
        "string" &&
      req.body.name.trim()
    ) {
      driver.name =
        req.body.name.trim();
    }

    if (
      typeof req.body?.whatsapp ===
        "string"
    ) {
      driver.whatsapp =
        req.body.whatsapp.trim();
    }

    if (
      typeof req.body?.phone ===
        "string"
    ) {
      driver.phone =
        req.body.phone.trim();
    }

    if (
      typeof req.body?.active ===
        "boolean"
    ) {
      driver.active =
        req.body.active;
    }

    drivers.set(
      driver.id,
      driver
    );

    return res.json({
      ok: true,
      driver
    });
  }
);

/* ELIMINAR REPARTIDOR */

app.delete(
  "/api/admin/drivers/:id",
  requireAdmin,
  (req, res) => {

    const driver =
      drivers.get(
        req.params.id
      );

    if (!driver) {
      return res.status(404).json({
        ok: false,
        message:
          "Repartidor no encontrado."
      });
    }

    drivers.delete(
      driver.id
    );

    return res.json({
      ok: true,
      message:
        "Repartidor eliminado."
    });
  }
);

/* ==================================================
   SERVIDOR
================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `ConectaRD AI 8.0 running on port ${PORT}`
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
      "MODEL:",
      OPENAI_MODEL
    );
  }
);
