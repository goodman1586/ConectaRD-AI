import express from "express";
import cors from "cors";
import crypto from "crypto";
import OpenAI from "openai";
import pg from "pg";

const { Pool } = pg;

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 10000;

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

/* =========================================================
   POSTGRESQL
========================================================= */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL NO CONFIGURADA");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================================================
   BASE DE DATOS
========================================================= */

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      whatsapp TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      subscription_expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      category TEXT DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      whatsapp TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer TEXT NOT NULL,
      phone TEXT DEFAULT '',
      delivery_type TEXT DEFAULT 'delivery',
      address TEXT DEFAULT '',
      location JSONB,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT DEFAULT '',
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      driver_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
        ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_code TEXT;

    CREATE INDEX IF NOT EXISTS idx_products_business
      ON products(business_id);

    CREATE INDEX IF NOT EXISTS idx_orders_business
      ON orders(business_id);

    CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status);

    CREATE INDEX IF NOT EXISTS idx_drivers_business
      ON drivers(business_id);
  `);

  /* =======================================================
     NEGOCIO DEMO INICIAL
  ======================================================= */

  await pool.query(
    `
    INSERT INTO businesses
      (id, name, active, whatsapp, phone, subscription_expires_at)
    VALUES
      ($1, $2, TRUE, '', '', $3)
    ON CONFLICT (id) DO NOTHING
    `,
    [
      "anamuya-demo",
      "Negocio Demo Anamuya",
      "2099-12-31T23:59:59.000Z"
    ]
  );

  /* =======================================================
     PRODUCTOS DEMO INICIALES
  ======================================================= */

  const demoProducts = [
    ["p1", "Tostada", 50],
    ["p2", "Jugo natural", 40],
    ["p3", "Batida", 80],
    ["p4", "Queque", 10]
  ];

  for (const [id, name, price] of demoProducts) {
    await pool.query(
      `
      INSERT INTO products
        (id, business_id, name, price, available)
      VALUES
        ($1, 'anamuya-demo', $2, $3, TRUE)
      ON CONFLICT (id) DO NOTHING
      `,
      [id, name, price]
    );
  }

  console.log("PostgreSQL inicializado correctamente.");
}

/* =========================================================
   UTILIDADES
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function moneyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function businessIsActive(business) {
  if (!business) return false;

  return (
    business.active === true &&
    new Date(business.subscriptionExpiresAt) > new Date()
  );
}

/* =========================================================
   OBTENER NEGOCIO
========================================================= */

async function getBusiness(id) {
  if (!id) return null;

  const result = await pool.query(
    `
    SELECT
      id,
      name,
      active,
      whatsapp,
      phone,
      subscription_expires_at
    FROM businesses
    WHERE id = $1
    `,
    [id]
  );

  if (!result.rows.length) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    name: row.name,
    active: row.active,
    whatsapp: row.whatsapp || "",
    phone: row.phone || "",
    subscriptionExpiresAt:
      new Date(row.subscription_expires_at).toISOString()
  };
}

/* =========================================================
   NEGOCIO ACTIVO
========================================================= */

async function requireActiveBusiness(req, res, next) {
  try {
    const id =
      req.header("x-business-id") ||
      req.query.businessId ||
      req.body?.businessId;

    if (!id) {
      return res.status(400).json({
        ok: false,
        code: "BUSINESS_ID_REQUIRED",
        message: "Falta el ID del negocio."
      });
    }

    const business = await getBusiness(id);

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

  } catch (error) {
    console.error("Error negocio:", error);

    return res.status(500).json({
      ok: false,
      message: "Error comprobando el negocio."
    });
  }
}

/* =========================================================
   ADMINISTRADOR
========================================================= */

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

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", async (_req, res) => {
  let database = false;

  try {
    await pool.query("SELECT 1");
    database = true;
  } catch (error) {
    database = false;
  }

  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "7.2",
    aiConfigured: Boolean(OPENAI_API_KEY),
    adminConfigured: Boolean(ADMIN_KEY),
    databaseConnected: database,
    time: new Date().toISOString()
  });
});

/* =========================================================
   INICIO
========================================================= */

app.get("/", (_req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

/* =========================================================
   NEGOCIO PÚBLICO
========================================================= */

app.get(
  "/api/business/:businessId",
  async (req, res) => {
    try {
      const business =
        await getBusiness(req.params.businessId);

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

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "Error obteniendo negocio."
      });
    }
  }
);

/* =========================================================
   PRODUCTOS PÚBLICOS
========================================================= */

/api/businesses
  "/api/products",
  requireActiveBusiness,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          description,
          price,
          image,
          category,
          available
        FROM products
        WHERE business_id = $1
          AND available = TRUE
        ORDER BY created_at ASC
        `,
        [req.business.id]
      );

      const products = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || "",
        price: Number(row.price),
        image: row.image || "",
        category: row.category || "",
        available: row.available
      }));

      res.json({
        ok: true,
        products
      });

    } catch (error) {
      console.error("Error productos:", error);

      res.status(500).json({
        ok: false,
        message: "Error obteniendo productos."
      });
    }
  }
);
/* =========================
   GESTIÓN DE PRODUCTOS
   EDITAR / ELIMINAR / MOSTRAR-OCULTAR
========================= */

// EDITAR PRODUCTO
app.patch("/api/products/:id", requireActiveBusiness, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      image,
      category,
      available
    } = req.body || {};

    if (!name || String(name).trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "El nombre del producto es obligatorio."
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        ok: false,
        message: "El precio del producto no es válido."
      });
    }

    const result = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        price = $3,
        image = $4,
        category = $5,
        available = $6
      WHERE id = $7
        AND business_id = $8
      RETURNING
        id,
        name,
        description,
        price,
        image,
        category,
        available
      `,
      [
        String(name).trim(),
        String(description || "").trim(),
        numericPrice,
        String(image || "").trim(),
        String(category || "").trim(),
        available !== false,
        id,
        req.business.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado."
      });
    }

    return res.json({
      ok: true,
      product: result.rows[0]
    });

  } catch (error) {
    console.error("Error al editar producto:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo editar el producto."
    });
  }
});


// ELIMINAR PRODUCTO
app.delete("/api/products/:id", requireActiveBusiness, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM products
      WHERE id = $1
        AND business_id = $2
      RETURNING id
      `,
      [id, req.business.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado."
      });
    }

    return res.json({
      ok: true,
      message: "Producto eliminado correctamente."
    });

  } catch (error) {
    console.error("Error al eliminar producto:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo eliminar el producto."
    });
  }
});


// MOSTRAR / OCULTAR PRODUCTO
app.patch("/api/products/:id/availability", requireActiveBusiness, async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body || {};

    if (typeof available !== "boolean") {
      return res.status(400).json({
        ok: false,
        message: "El valor de disponibilidad debe ser true o false."
      });
    }

    const result = await pool.query(
      `
      UPDATE products
      SET available = $1
      WHERE id = $2
        AND business_id = $3
      RETURNING
        id,
        name,
        available
      `,
      [
        available,
        id,
        req.business.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Producto no encontrado."
      });
    }

    return res.json({
      ok: true,
      product: result.rows[0]
    });

  } catch (error) {
    console.error("Error al cambiar disponibilidad:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo cambiar la visibilidad del producto."
    });
  }
});
/* =========================
   AGREGAR PRODUCTO
========================= */

app.post("/api/products", requireActiveBusiness, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      image,
      available
    } = req.body || {};

    if (!name || String(name).trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "El nombre del producto es obligatorio."
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        ok: false,
        message: "El precio del producto no es válido."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO products (
        id,
        business_id,
        name,
        description,
        price,
        category,
        image,
        available,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        business_id,
        name,
        description,
        price,
        category,
        image,
        available,
        created_at,
        updated_at
      `,
      [
        crypto.randomUUID(),
        req.business.id,
        String(name).trim(),
        String(description || "").trim(),
        numericPrice,
        String(category || "").trim(),
        String(image || "").trim(),
        available !== false
      ]
    );

    return res.status(201).json({
      ok: true,
      product: result.rows[0]
    });

  } catch (error) {
    console.error("Error al crear producto:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo crear el producto."
    });
  }
});

/* =========================================================
   IA
========================================================= */

app.post(
  "/api/ai",
  requireActiveBusiness,
  async (req, res) => {
    try {
      const message =
        clean(req.body?.message);

      if (!message) {
        return res.status(400).json({
          ok: false,
          message: "Falta el mensaje."
        });
      }

      if (!openai) {
        return res.status(503).json({
          ok: false,
          message:
            "OPENAI_API_KEY no está configurada."
        });
      }

      const result = await pool.query(
        `
        SELECT name, description, price, category
        FROM products
        WHERE business_id = $1
          AND available = TRUE
        ORDER BY created_at ASC
        `,
        [req.business.id]
      );

      const catalogText =
        result.rows
          .map(product =>
            `${product.name}: RD$${Number(product.price)}${
              product.description
                ? ` — ${product.description}`
                : ""
            }`
          )
          .join("\n");

      const response =
        await openai.responses.create({
          model: OPENAI_MODEL,

          instructions:
            `Eres el asistente de ConectaRD AI.

Estás atendiendo al cliente de:
${req.business.name}

Ayuda con productos, precios, recomendaciones y pedidos.

Sé amable, claro y breve.

IMPORTANTE:
Nunca inventes productos.
Nunca inventes precios.
Solo recomienda productos disponibles en este catálogo:

${catalogText || "No hay productos disponibles."}`,

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
      console.error("ERROR IA:", error);

      res.status(500).json({
        ok: false,
        message:
          "Error al conectar con la IA."
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
  async (req, res) => {
    try {
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
        !clean(customer) ||
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "customer e items son obligatorios."
        });
      }

      const id = crypto.randomUUID();
    
      const deliveryCode = String(
  crypto.randomInt(1000, 10000)
);

      const cleanItems =
        items.map(item => ({
          name: clean(item.name),
          quantity:
            Math.max(
              1,
              Number(item.quantity || 1)
            ),
          unitPrice:
            moneyNumber(item.unitPrice)
        }));

      const now =
        new Date().toISOString();

      const result = await pool.query(
        `
        INSERT INTO orders
(
  id,
  business_id,
  customer,
  phone,
  delivery_type,
  address,
  location,
  items,
  notes,
  total,
  status,
  delivery_code,
  created_at,
  updated_at
)
      VALUES
(
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
  'new',$11,$12,$12
)
        RETURNING *
        `,
       [
  id,
  req.business.id,
  clean(customer),
  clean(phone),
  deliveryType || "delivery",
  clean(address),
  location || null,
  JSON.stringify(cleanItems),
  clean(notes),
  moneyNumber(total),
  deliveryCode,
  now
]
      );

      const row = result.rows[0];

      const order = {
        id: row.id,
        businessId: row.business_id,
        customer: row.customer,
        phone: row.phone || "",
        deliveryType: row.delivery_type,
        address: row.address || "",
        location: row.location,
        items: row.items,
        notes: row.notes || "",
        total: Number(row.total),
        status: row.status,
        driverId: row.driver_id,
        deliveryCode: row.delivery_code,
        createdAt:
          new Date(row.created_at).toISOString(),
        updatedAt:
          new Date(row.updated_at).toISOString()
      };

      console.log(
        "Nuevo pedido:",
        order.id
      );

      res.status(201).json({
        ok: true,
        order
      });

    } catch (error) {
      console.error("Error pedido:", error);

      res.status(500).json({
        ok: false,
        message:
          "No se pudo crear el pedido."
      });
    }
  }
);

/* =========================================================
   LISTAR PEDIDOS DEL NEGOCIO
========================================================= */

app.get(
  "/api/orders",
  requireActiveBusiness,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM orders
        WHERE business_id = $1
        ORDER BY created_at DESC
        `,
        [req.business.id]
      );

      const orders =
        result.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          customer: row.customer,
          phone: row.phone || "",
          deliveryType: row.delivery_type,
          address: row.address || "",
          location: row.location,
          items: row.items || [],
          notes: row.notes || "",
          total: Number(row.total),
          status: row.status,
          driverId: row.driver_id,
          createdAt:
            new Date(row.created_at).toISOString(),
          updatedAt:
            new Date(row.updated_at).toISOString()
        }));

      res.json({
        ok: true,
        orders
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error obteniendo pedidos."
      });
    }
  }
);

/* =========================================================
   CAMBIAR ESTADO PEDIDO
========================================================= */

app.patch(
  "/api/orders/:id/status",
  requireActiveBusiness,
  async (req, res) => {
    try {
      const allowedStatuses = [
        "new",
        "preparing",
        "on_the_way",
        "delivered",
        "cancelled"
      ];

      const newStatus = req.body?.status;
      const deliveryCode = String(
        req.body?.deliveryCode || ""
      ).trim();

      if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({
          ok: false,
          message: "Estado no válido."
        });
      }

      /*
       * VERIFICAR CÓDIGO DE ENTREGA
       * Solo se exige cuando el repartidor
       * intenta marcar el pedido como entregado.
       */

      if (newStatus === "delivered") {

        if (!/^\d{4}$/.test(deliveryCode)) {
          return res.status(400).json({
            ok: false,
            message:
              "Debes introducir un código de entrega válido de 4 dígitos."
          });
        }

        const codeResult = await pool.query(
          `
          SELECT id
          FROM orders
          WHERE id = $1
            AND business_id = $2
            AND delivery_code = $3
          `,
          [
            req.params.id,
            req.business.id,
            deliveryCode
          ]
        );

        if (codeResult.rowCount === 0) {
          return res.status(400).json({
            ok: false,
            message:
              "Código de entrega incorrecto."
          });
        }
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
          AND business_id = $3
        RETURNING *
        `,
        [
          newStatus,
          req.params.id,
          req.business.id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "Pedido no encontrado."
        });
      }

      const row = result.rows[0];

      return res.json({
        ok: true,
        order: {
          id: row.id,
          businessId: row.business_id,
          customer: row.customer,
          phone: row.phone || "",
          deliveryType: row.delivery_type,
          address: row.address || "",
          location: row.location,
          items: row.items || [],
          notes: row.notes || "",
          total: Number(row.total),
          status: row.status,
          driverId: row.driver_id,
          deliveryCode: row.delivery_code,
          createdAt:
            new Date(row.created_at).toISOString(),
          updatedAt:
            new Date(row.updated_at).toISOString()
        }
      });

    } catch (error) {
      console.error(
        "Error cambiando estado:",
        error
      );

      return res.status(500).json({
        ok: false,
        message:
          "Error cambiando estado."
      });
    }
  }
);
// ============================================================
// ADMIN – LISTAR NEGOCIOS
// ============================================================

app.get(
  "/api/admin/businesses",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          name,
          active,
          whatsapp,
          phone,
          subscription_expires_at,
          created_at,
          updated_at
        FROM businesses
        ORDER BY created_at DESC
      `);

      const businesses = result.rows.map(row => ({
  id: row.id,
  name: row.name,
  active: row.active,
  whatsapp: row.whatsapp || "",
  phone: row.phone || "",

  subscriptionExpiresAt:
    row.subscription_expires_at
      ? new Date(row.subscription_expires_at).toISOString()
      : null,

  createdAt:
    row.created_at
      ? new Date(row.created_at).toISOString()
      : null,

  updatedAt:
    row.updated_at
      ? new Date(row.updated_at).toISOString()
      : null
}));

return res.status(200).json({
  ok: true,
  businesses
});

    } catch (error) {
      console.error("Error listando negocios:", error);

      return res.status(500).json({
        ok: false,
        message: "Error obteniendo negocios."
      });
    }
  }
);

// ===============================================
// ADMIN — ELIMINAR NEGOCIO
// ===============================================

app.delete(
  "/api/admin/businesses/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const businessId = String(req.params.id || "").trim();

      if (!businessId) {
        return res.status(400).json({
          ok: false,
          message: "ID del negocio es obligatorio."
        });
      }

      // Verificar que el negocio existe
      const exists = await pool.query(
        "SELECT id FROM businesses WHERE id = $1",
        [businessId]
      );

      if (exists.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "Negocio no encontrado."
        });
      }

      // Eliminar productos asociados al negocio
      await pool.query(
        "DELETE FROM products WHERE business_id = $1",
        [businessId]
      );

      // Eliminar el negocio
      await pool.query(
        "DELETE FROM businesses WHERE id = $1",
        [businessId]
      );

      return res.status(200).json({
        ok: true,
        message: "Negocio eliminado correctamente."
      });

    } catch (error) {
      console.error("Error eliminando negocio:", error);

      return res.status(500).json({
        ok: false,
        message: "Error eliminando negocio."
      });
    }
  }
);

// ============================================================
/* =========================================================
   ADMIN — CREAR NEGOCIO
========================================================= */

app.post(
  "/api/admin/businesses",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        name,
        id,
        whatsapp,
        phone,
        subscriptionExpiresAt
      } = req.body || {};

      if (!clean(name) || !clean(id)) {
        return res.status(400).json({
          ok: false,
          message:
            "Nombre e ID del negocio son obligatorios."
        });
      }

      const businessId =
        clean(id);

      const exists =
        await pool.query(
          `SELECT id FROM businesses WHERE id = $1`,
          [businessId]
        );

      if (exists.rows.length) {
        return res.status(409).json({
          ok: false,
          message:
            "Ya existe un negocio con ese ID."
        });
      }

      const expires =
  subscriptionExpiresAt ||
  req.body.subscription_expires_at ||
  "2099-12-31T23:59:59.000Z";

      const result =
        await pool.query(
          `
          INSERT INTO businesses
          (
            id,
            name,
            active,
            whatsapp,
            phone,
            subscription_expires_at
          )
          VALUES
          ($1,$2,TRUE,$3,$4,$5)
          RETURNING *
          `,
          [
            businessId,
            clean(name),
            clean(whatsapp),
            clean(phone),
            expires
          ]
        );

      const row =
        result.rows[0];

      res.status(201).json({
        ok: true,
        business: {
          id: row.id,
          name: row.name,
          active: row.active,
          whatsapp: row.whatsapp || "",
          phone: row.phone || "",
          subscriptionExpiresAt:
            new Date(
              row.subscription_expires_at
            ).toISOString()
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error creando negocio."
      });
    }
  }
);

/* =========================================================
   ADMIN — EDITAR NEGOCIO
========================================================= */

app.patch(
  "/api/admin/businesses/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const current =
        await getBusiness(req.params.id);

      if (!current) {
        return res.status(404).json({
          ok: false,
          message:
            "Negocio no encontrado."
        });
      }

      const name =
        typeof req.body?.name === "string"
          ? clean(req.body.name)
          : current.name;

      const active =
        typeof req.body?.active === "boolean"
          ? req.body.active
          : current.active;

      const whatsapp =
        typeof req.body?.whatsapp === "string"
          ? clean(req.body.whatsapp)
          : current.whatsapp;

      const phone =
        typeof req.body?.phone === "string"
          ? clean(req.body.phone)
          : current.phone;

      const expires =
        req.body?.subscriptionExpiresAt ||
        current.subscriptionExpiresAt;

      const result =
        await pool.query(
          `
          UPDATE businesses
          SET
            name = $1,
            active = $2,
            whatsapp = $3,
            phone = $4,
            subscription_expires_at = $5,
            updated_at = NOW()
          WHERE id = $6
          RETURNING *
          `,
          [
            name,
            active,
            whatsapp,
            phone,
            expires,
            req.params.id
          ]
        );

      const row =
        result.rows[0];

      const business = {
        id: row.id,
        name: row.name,
        active: row.active,
        whatsapp: row.whatsapp || "",
        phone: row.phone || "",
        subscriptionExpiresAt:
          new Date(
            row.subscription_expires_at
          ).toISOString()
      };

      res.json({
        ok: true,
        business: {
          ...business,
          active:
            businessIsActive(business)
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error modificando negocio."
      });
    }
  }
);

/* =========================================================
   ADMIN — SUSCRIPCIÓN
========================================================= */

app.post(
  "/api/admin/businesses/:id/subscription",
  requireAdmin,
  async (req, res) => {
    try {
      const business =
        await getBusiness(req.params.id);

      if (!business) {
        return res.status(404).json({
          ok: false,
          message:
            "Negocio no encontrado."
        });
      }

      const active =
        typeof req.body?.active === "boolean"
          ? req.body.active
          : business.active;

      const expires =
        req.body?.subscriptionExpiresAt ||
        business.subscriptionExpiresAt;

      const result =
        await pool.query(
          `
          UPDATE businesses
          SET
            active = $1,
            subscription_expires_at = $2,
            updated_at = NOW()
          WHERE id = $3
          RETURNING *
          `,
          [
            active,
            expires,
            req.params.id
          ]
        );

      const row =
        result.rows[0];

      const updated = {
        id: row.id,
        name: row.name,
        active: row.active,
        whatsapp: row.whatsapp || "",
        phone: row.phone || "",
        subscriptionExpiresAt:
          new Date(
            row.subscription_expires_at
          ).toISOString()
      };

      res.json({
        ok: true,
        business: {
          ...updated,
          active:
            businessIsActive(updated)
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error actualizando suscripción."
      });
    }
  }
);

/* =========================================================
   ADMIN — PRODUCTOS
========================================================= */

/* LISTAR TODOS LOS PRODUCTOS DE UN NEGOCIO */

app.get(
  "/api/admin/businesses/:businessId/products",
  requireAdmin,
  async (req, res) => {
    try {
      const business =
        await getBusiness(
          req.params.businessId
        );

      if (!business) {
        return res.status(404).json({
          ok: false,
          message:
            "Negocio no encontrado."
        });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM products
          WHERE business_id = $1
          ORDER BY created_at ASC
          `,
          [req.params.businessId]
        );

      const products =
        result.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          description: row.description || "",
          price: Number(row.price),
          image: row.image || "",
          category: row.category || "",
          available: row.available
        }));

      res.json({
        ok: true,
        products
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error obteniendo productos."
      });
    }
  }
);

/* CREAR PRODUCTO */

app.post(
  "/api/admin/businesses/:businessId/products",
  requireAdmin,
  async (req, res) => {
    try {
      const business =
        await getBusiness(
          req.params.businessId
        );

      if (!business) {
        return res.status(404).json({
          ok: false,
          message:
            "Negocio no encontrado."
        });
      }

      const {
        name,
        description,
        price,
        image,
        category,
        available
      } = req.body || {};

      if (!clean(name)) {
        return res.status(400).json({
          ok: false,
          message:
            "El nombre del producto es obligatorio."
        });
      }

      const id =
        clean(req.body?.id) ||
        crypto.randomUUID();

      const result =
        await pool.query(
          `
          INSERT INTO products
          (
            id,
            business_id,
            name,
            description,
            price,
            image,
            category,
            available
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING *
          `,
          [
            id,
            req.params.businessId,
            clean(name),
            clean(description),
            moneyNumber(price),
            clean(image),
            clean(category),
            typeof available === "boolean"
              ? available
              : true
          ]
        );

      const row =
        result.rows[0];

      res.status(201).json({
        ok: true,
        product: {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          description: row.description || "",
          price: Number(row.price),
          image: row.image || "",
          category: row.category || "",
          available: row.available
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error creando producto."
      });
    }
  }
);

/* EDITAR PRODUCTO */

app.patch(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const existing =
        await pool.query(
          `
          SELECT *
          FROM products
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (!existing.rows.length) {
        return res.status(404).json({
          ok: false,
          message:
            "Producto no encontrado."
        });
      }

      const old =
        existing.rows[0];

      const name =
        typeof req.body?.name === "string"
          ? clean(req.body.name)
          : old.name;

      const description =
        typeof req.body?.description === "string"
          ? clean(req.body.description)
          : old.description || "";

      const price =
        req.body?.price !== undefined
          ? moneyNumber(req.body.price)
          : Number(old.price);

      const image =
        typeof req.body?.image === "string"
          ? clean(req.body.image)
          : old.image || "";

      const category =
        typeof req.body?.category === "string"
          ? clean(req.body.category)
          : old.category || "";

      const available =
        typeof req.body?.available === "boolean"
          ? req.body.available
          : old.available;

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            name = $1,
            description = $2,
            price = $3,
            image = $4,
            category = $5,
            available = $6,
            updated_at = NOW()
          WHERE id = $7
          RETURNING *
          `,
          [
            name,
            description,
            price,
            image,
            category,
            available,
            req.params.id
          ]
        );

      const row =
        result.rows[0];

      res.json({
        ok: true,
        product: {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          description: row.description || "",
          price: Number(row.price),
          image: row.image || "",
          category: row.category || "",
          available: row.available
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error modificando producto."
      });
    }
  }
);

/* ELIMINAR PRODUCTO */

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          DELETE FROM products
          WHERE id = $1
          RETURNING id
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          message:
            "Producto no encontrado."
        });
      }

      res.json({
        ok: true,
        message:
          "Producto eliminado."
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error eliminando producto."
      });
    }
  }
);

/* ACTIVAR / DESACTIVAR PRODUCTO */

app.patch(
  "/api/admin/products/:id/availability",
  requireAdmin,
  async (req, res) => {
    try {
      if (
        typeof req.body?.available !==
        "boolean"
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "available debe ser true o false."
        });
      }

      const result =
        await pool.query(
          `
          UPDATE products
          SET
            available = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [
            req.body.available,
            req.params.id
          ]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          message:
            "Producto no encontrado."
        });
      }

      const row =
        result.rows[0];

      res.json({
        ok: true,
        product: {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          description: row.description || "",
          price: Number(row.price),
          image: row.image || "",
          category: row.category || "",
          available: row.available
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error cambiando disponibilidad."
      });
    }
  }
);

/* =========================================================
   ADMIN — REPARTIDORES
========================================================= */

/* LISTAR */

app.get(
  "/api/admin/drivers",
  requireAdmin,
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM drivers
          ORDER BY created_at DESC
          `
        );

      const drivers =
        result.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          whatsapp: row.whatsapp || "",
          phone: row.phone || "",
          active: row.active,
          createdAt:
            new Date(row.created_at).toISOString()
        }));

      res.json({
        ok: true,
        drivers
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error obteniendo repartidores."
      });
    }
  }
);

/* CREAR */

app.post(
  "/api/admin/drivers",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        businessId,
        name,
        whatsapp,
        phone
      } = req.body || {};

      if (
        !clean(businessId) ||
        !clean(name)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Negocio y nombre del repartidor son obligatorios."
        });
      }

      const business =
        await getBusiness(businessId);

      if (!business) {
        return res.status(404).json({
          ok: false,
          message:
            "El negocio no existe."
        });
      }

      const id =
        crypto.randomUUID();

      const result =
        await pool.query(
          `
          INSERT INTO drivers
          (
            id,
            business_id,
            name,
            whatsapp,
            phone,
            active
          )
          VALUES
          ($1,$2,$3,$4,$5,TRUE)
          RETURNING *
          `,
          [
            id,
            businessId,
            clean(name),
            clean(whatsapp),
            clean(phone)
          ]
        );

      const row =
        result.rows[0];

      res.status(201).json({
        ok: true,
        driver: {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          whatsapp: row.whatsapp || "",
          phone: row.phone || "",
          active: row.active
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error creando repartidor."
      });
    }
  }
);

/* EDITAR REPARTIDOR */

app.patch(
  "/api/admin/drivers/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const existing =
        await pool.query(
          `
          SELECT *
          FROM drivers
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (!existing.rows.length) {
        return res.status(404).json({
          ok: false,
          message:
            "Repartidor no encontrado."
        });
      }

      const old =
        existing.rows[0];

      const name =
        typeof req.body?.name === "string"
          ? clean(req.body.name)
          : old.name;

      const whatsapp =
        typeof req.body?.whatsapp === "string"
          ? clean(req.body.whatsapp)
          : old.whatsapp || "";

      const phone =
        typeof req.body?.phone === "string"
          ? clean(req.body.phone)
          : old.phone || "";

      const active =
        typeof req.body?.active === "boolean"
          ? req.body.active
          : old.active;

      const result =
        await pool.query(
          `
          UPDATE drivers
          SET
            name = $1,
            whatsapp = $2,
            phone = $3,
            active = $4,
            updated_at = NOW()
          WHERE id = $5
          RETURNING *
          `,
          [
            name,
            whatsapp,
            phone,
            active,
            req.params.id
          ]
        );

      const row =
        result.rows[0];

      res.json({
        ok: true,
        driver: {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          whatsapp: row.whatsapp || "",
          phone: row.phone || "",
          active: row.active
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error modificando repartidor."
      });
    }
  }
);

/* =========================================================
   ASIGNAR REPARTIDOR A PEDIDO
========================================================= */

app.patch(
  "/api/admin/orders/:id/driver",
  requireAdmin,
  async (req, res) => {
    try {
      const driverId =
        req.body?.driverId || null;

      if (driverId) {
        const driver =
          await pool.query(
            `
            SELECT id
            FROM drivers
            WHERE id = $1
            `,
            [driverId]
          );

        if (!driver.rows.length) {
          return res.status(404).json({
            ok: false,
            message:
              "Repartidor no encontrado."
          });
        }
      }

      const result =
        await pool.query(
          `
          UPDATE orders
          SET
            driver_id = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [
            driverId,
            req.params.id
          ]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          message:
            "Pedido no encontrado."
        });
      }

      const row =
        result.rows[0];

      res.json({
        ok: true,
        order: {
          id: row.id,
          businessId: row.business_id,
          customer: row.customer,
          phone: row.phone || "",
          deliveryType: row.delivery_type,
          address: row.address || "",
          location: row.location,
          items: row.items || [],
          notes: row.notes || "",
          total: Number(row.total),
          status: row.status,
          driverId: row.driver_id,
          createdAt:
            new Date(row.created_at).toISOString(),
          updatedAt:
            new Date(row.updated_at).toISOString()
        }
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "Error asignando repartidor."
      });
    }
  }
);

/* =========================================================
   ERROR GENERAL
========================================================= */

app.use((err, _req, res, _next) => {
  console.error("ERROR GENERAL:", err);

  res.status(500).json({
    ok: false,
    message:
      "Error interno del servidor."
  });
});

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

async function startServer() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `ConectaRD AI 7.2 ejecutándose en puerto ${PORT}`
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
          "DATABASE_URL:",
          process.env.DATABASE_URL
            ? "CONFIGURADA"
            : "NO CONFIGURADA"
        );
      }
    );

  } catch (error) {
    console.error(
      "NO SE PUDO INICIAR EL SERVIDOR:"
    );

    console.error(error);

    process.exit(1);
  }
}

startServer();
