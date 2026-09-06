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

  if (
    !customer ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      ok: false,
      message: "customer e items son obligatorios."
    });
  }

  const now = new Date().toISOString();

  const order = {
    id: crypto.randomUUID(),

    businessId: req.business.id,

    customer: String(customer).trim(),

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

    status: "new",

    createdAt: now,

    updatedAt: now
  };

  orders.set(order.id, order);

  console.log("Nuevo pedido:", order.id);

  return res.status(201).json({
    ok: true,
    order
  });
});


/* =========================
   LISTAR PEDIDOS
========================= */

app.get(
  "/api/orders",
  requireActiveBusiness,
  (req, res) => {

    const list = [...orders.values()]
      .filter(
        (order) =>
          order.businessId === req.business.id
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt)
      );

    return res.json({
      ok: true,
      orders: list
    });
  }
);


/* =========================
   CAMBIAR ESTADO DEL PEDIDO
========================= */

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

    const newStatus =
      req.body?.status;

    if (
      !allowedStatuses.includes(newStatus)
    ) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido."
      });
    }

    order.status = newStatus;

    order.updatedAt =
      new Date().toISOString();

    orders.set(order.id, order);

    return res.json({
      ok: true,
      order
    });
  }
);


/* =========================
   ADMINISTRACIÓN
========================= */

app.get(
  "/api/admin/businesses",
  (_req, res) => {

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
  }
);


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

    return res.json({
      ok: true,
      business
    });
  }
);





