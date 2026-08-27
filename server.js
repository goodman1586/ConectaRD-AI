
import express from "express";
import cors from "cors";
import crypto from "crypto";
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 10000;
// Temporary MVP storage.
// For production, replace this with PostgreSQL.
const businesses = new Map([
 ["anamuya-demo", {
 id: "anamuya-demo",
 name: "Negocio Demo Anamuya",
 active: true,
 subscriptionExpiresAt: "2099-12-31T23:59:59.000Z"
 }]
]);
const products = new Map([
 ["anamuya-demo", [
 { id: "p1", name: "Producto Demo 1", price: 100, available: true },
 { id: "p2", name: "Producto Demo 2", price: 150, available: true }
 ]]
]);
const orders = new Map();
function businessIsActive(business) {
 return !!business &&
 business.active === true &&
 new Date(business.subscriptionExpiresAt) > new Date();
}
function requireActiveBusiness(req, res, next) {
 const id = req.header("x-business-id") || req.query.businessId || req.body?.businessId;
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
}app.get("/", (_req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});
app.get("/health", (_req, res) => {
 res.json({ ok: true, service: "ConectaRD AI 7.0", time: new Date().toISOString() });
});
app.get("/api/business/:businessId", (req, res) => {
 const business = businesses.get(req.params.businessId);
 if (!business) return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
 res.json({ ok: true, business: { ...business, active: businessIsActive(business) } });
});
app.get("/api/products", requireActiveBusiness, (req, res) => {
 res.json({ ok: true, products: products.get(req.business.id) || [] });
});
app.post("/api/orders", requireActiveBusiness, (req, res) => {
 const { customer, phone, deliveryType, address, location, items, notes } = req.body || {};
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
 res.status(201).json({ ok: true, order });
});
app.get("/api/orders", requireActiveBusiness, (req, res) => {
 const list = [...orders.values()]
 .filter(o => o.businessId === req.business.id)
 .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
 res.json({ ok: true, orders: list });
});
app.patch("/api/orders/:id/status", requireActiveBusiness, (req, res) => {
 const order = orders.get(req.params.id);
 if (!order || order.businessId !== req.business.id) {
 return res.status(404).json({ ok: false, message: "Pedido no encontrado." });
 }
 const allowed = ["new", "preparing", "on_the_way", "delivered", "cancelled"];
 if (!allowed.includes(req.body?.status)) {
 return res.status(400).json({ ok: false, message: "Estado no válido." });
 }
 order.status = req.body.status;
 order.updatedAt = new Date().toISOString();
 orders.set(order.id, order);
 res.json({ ok: true, order });
});
app.get("/api/admin/businesses", (_req, res) => {
 // Protect this endpoint with real admin authentication before production.
 res.json({
 ok: true,
 businesses: [...businesses.values()].map(b => ({
 ...b,
 active: businessIsActive(b)
 }))
 });y
});
app.post("/api/admin/businesses/:id/subscription", (req, res) => {
 // Protect this endpoint with real admin authentication before production.
 const business = businesses.get(req.params.id);
 if (!business) return res.status(404).json({ ok: false, message: "Negocio no encontrado." });
 business.active = Boolean(req.body?.active);
 if (req.body?.subscriptionExpiresAt) {
 business.subscriptionExpiresAt = req.body.subscriptionExpiresAt;
 }
 businesses.set(business.id, business);
 res.json({ ok: true, business });
});
app.listen(PORT, "0.0.0.0", () => {
 console.log(`ConectaRD AI backend running on port ${PORT}`);
})
