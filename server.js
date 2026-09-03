import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Almacenamiento temporal en memoria (se pierde si el servidor reinicia)
let orders = [];
let products = [
  { id: randomUUID(), name: "Tostada", price: 50 },
  { id: randomUUID(), name: "Jugo natural", price: 40 },
  { id: randomUUID(), name: "Batida", price: 80 },
  { id: randomUUID(), name: "Queque", price: 10 }
];

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    service: "ConectaRD AI",
    version: "7.5",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY)
  })
);

app.get("/", (req, res) => res.sendFile(process.cwd() + "/index.html"));

// ---------- Productos ----------
app.get("/api/products", (req, res) => {
  res.json({ ok: true, products });
});

app.post("/api/products", (req, res) => {
  const { name, price } = req.body || {};
  const cleanName = String(name || "").trim();
  const cleanPrice = Number(price);

  if (!cleanName) return res.status(400).json({ message: "El nombre es obligatorio." });
  if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
    return res.status(400).json({ message: "El precio no es válido." });
  }

  const product = { id: randomUUID(), name: cleanName, price: cleanPrice };
  products.push(product);
  res.json({ ok: true, product });
});

app.put("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body || {};
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ message: "Producto no encontrado." });

  if (name !== undefined) {
    const cleanName = String(name).trim();
    if (!cleanName) return res.status(400).json({ message: "El nombre es obligatorio." });
    product.name = cleanName;
  }
  if (price !== undefined) {
    const cleanPrice = Number(price);
    if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
      return res.status(400).json({ message: "El precio no es válido." });
    }
    product.price = cleanPrice;
  }

  res.json({ ok: true, product });
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const before = products.length;
  products = products.filter(p => p.id !== id);
  if (products.length === before) {
    return res.status(404).json({ message: "Producto no encontrado." });
  }
  res.json({ ok: true });
});

// ---------- IA ----------
app.post("/api/ai", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const reqProducts = Array.isArray(req.body?.products) ? req.body.products : products;

    if (!message) {
      return res.status(400).json({ message: "Falta el mensaje." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "GEMINI_API_KEY no configurada en Render." });
    }

    const catalogText = reqProducts.length
      ? reqProducts.map(p => - ${p.name}: RD$${p.price}).join("\n")
      : "(catálogo no disponible)";

    const systemPrompt =
      "Eres el asistente de ConectaRD AI, una plataforma dominicana de delivery.\n" +
      "Este es el catálogo REAL y ÚNICO de productos disponibles, con sus precios exactos:\n" +
      catalogText +
      "\n\nReglas:\n" +
      "- Solo puedes recomendar o mencionar productos de esta lista.\n" +
      "- Usa siempre los precios exactos indicados arriba.\n" +
      "- Si el cliente pide algo que no está en la lista, dile amablemente que no está disponible y sugiere algo de la lista.\n" +
      "- Sé breve, amable y claro.";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: message }] }]
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(500).json({ message: "Error al conectar con Gemini." });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude generar una respuesta.";
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al conectar con la IA." });
  }
});

// ---------- Pedidos ----------
app.get("/api/orders", (req, res) => {
  res.json({ ok: true, orders });
});

app.post("/api/orders", (req, res) => {
  try {
    const { customer, phone, deliveryType, address, location, items, notes, total } = req.body || {};

    if (!customer || !phone) {
      return res.status(400).json({ message: "Faltan datos del cliente." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "El pedido no tiene productos." });
    }

    const order = {
      id: randomUUID(),
      customer,
      phone,
      deliveryType: deliveryType || "delivery",
      address: address || "",
      location: location || null,
      items,
      notes: notes || "",
      total: Number(total) || 0,
      status: "new",
      createdAt: new Date().toISOString()
    };

    orders.unshift(order);
    res.json({ ok: true, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el pedido." });
  }
});

app.patch("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const valid = ["new", "preparing", "on_the_way", "delivered", "cancelled"];

  if (!valid.includes(status)) {
    return res.status(400).json({ message: "Estado no válido." });
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ message: "Pedido no encontrado." });
  }

  order.status = status;
  res.json({ ok: true, order });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(ConectaRD AI 7.5 running on port ${PORT});
});
