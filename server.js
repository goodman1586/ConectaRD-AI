import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import pg from 'pg';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const PORT = process.env.PORT || 10000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DATABASE_URL = process.env.DATABASE_URL || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

if (!SESSION_SECRET) {
  console.error('FALTA SESSION_SECRET. Configúrala en las variables de entorno.');
  process.exit(1);
}

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

const clean = v => String(v ?? '').trim();
const money = v => Number(v || 0);
const b64 = b => Buffer.from(b).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url');
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const p = JSON.parse(unb64(body).toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
function tokenFrom(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
function auth(req, role) {
  const p = verifyToken(tokenFrom(req));
  if (!p || p.role !== role) return null;
  return p;
}
function adminOk(req) { return clean(req.headers['x-admin-key']) === ADMIN_KEY && !!ADMIN_KEY; }
function admin(req, res, next) { if (!adminOk(req)) return res.status(401).json({ ok:false, message:'Clave de administrador incorrecta.' }); next(); }

async function q(sql, params=[]) { if (!pool) throw new Error('DATABASE_URL no está configurada.'); return pool.query(sql, params); }

async function initDatabase() {
  await q(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      whatsapp TEXT DEFAULT '', phone TEXT DEFAULT '',
      owner_password_hash TEXT DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
      subscription_expires_at TIMESTAMPTZ DEFAULT '2099-12-31T23:59:59Z',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT DEFAULT '', price NUMERIC(12,2) NOT NULL DEFAULT 0,
      image TEXT DEFAULT '', category TEXT DEFAULT '', available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL, whatsapp TEXT DEFAULT '', phone TEXT DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
      access_token_hash TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer TEXT NOT NULL, phone TEXT DEFAULT '', delivery_type TEXT DEFAULT 'delivery', address TEXT DEFAULT '',
      location JSONB, items JSONB NOT NULL DEFAULT '[]', notes TEXT DEFAULT '', total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new', driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
      delivery_code TEXT, delivery_code_verified BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Otros';
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_password_hash TEXT DEFAULT '';
    ALTER TABLE businesses ALTER COLUMN subscription_expires_at SET DEFAULT '2099-12-31T23:59:59Z';
    UPDATE businesses SET subscription_expires_at = '2099-12-31T23:59:59Z' WHERE subscription_expires_at IS NULL;
    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS access_token_hash TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_code_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
  `);
  const hash = hashPassword('08656');
  await q(`INSERT INTO businesses (id,name,category,whatsapp,phone,owner_password_hash,active,subscription_expires_at) VALUES ($1,$2,$3,'','',$4,TRUE,'2099-12-31T23:59:59Z') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category='Comida', active=TRUE, owner_password_hash=CASE WHEN COALESCE(businesses.owner_password_hash,'')='' THEN EXCLUDED.owner_password_hash ELSE businesses.owner_password_hash END, subscription_expires_at='2099-12-31T23:59:59Z', updated_at=NOW()`, ['anamuya-demo','Negocio Demo Anamuya','Comida',hash]);
  const demo = [
    ['p1','anamuya-demo','Tostada','Tostada preparada',50,'','Comida'],
    ['p2','anamuya-demo','Jugo natural','Jugo natural del día',40,'','Bebidas'],
    ['p3','anamuya-demo','Batida','Batida de frutas',80,'','Bebidas'],
    ['p4','anamuya-demo','Queque','Porción de queque',10,'','Postres']
  ];
  for (const [id,bid,name,desc,price,img,cat] of demo) await q(`INSERT INTO products(id,business_id,name,description,price,image,category,available) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE) ON CONFLICT(id) DO UPDATE SET available=TRUE, business_id=EXCLUDED.business_id, name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price, image=EXCLUDED.image, category=EXCLUDED.category, updated_at=NOW()`, [id,bid,name,desc,price,img,cat]);
}
function hashPassword(password) { const salt=crypto.randomBytes(16); const key=crypto.scryptSync(String(password), salt, 64); return `${salt.toString('hex')}:${key.toString('hex')}`; }
function checkPassword(password, stored) { try { const [s,k]=String(stored||'').split(':'); if(!s||!k)return false; const key=crypto.scryptSync(String(password),Buffer.from(s,'hex'),64); return crypto.timingSafeEqual(key,Buffer.from(k,'hex')); } catch{return false;} }
function activeBusiness(row) { return !!row && row.active && (!row.subscription_expires_at || new Date(row.subscription_expires_at) > new Date()); }
async function getBusiness(id) { const r=await q('SELECT * FROM businesses WHERE id=$1',[id]); return r.rows[0] || null; }
function publicBusiness(r) { return { id:r.id,name:r.name,category:r.category||'Otros',active:activeBusiness(r),whatsapp:r.whatsapp||'',phone:r.phone||'',subscriptionExpiresAt:r.subscription_expires_at ? new Date(r.subscription_expires_at).toISOString():null }; }
function orderOut(r) { return { id:r.id,businessId:r.business_id,customer:r.customer,phone:r.phone||'',deliveryType:r.delivery_type,address:r.address||'',location:r.location,items:r.items||[],notes:r.notes||'',total:Number(r.total),status:r.status,driverId:r.driver_id||null,deliveryCode:r.delivery_code||null,deliveryCodeVerified:!!r.delivery_code_verified,assignedAt:r.assigned_at?new Date(r.assigned_at).toISOString():null,deliveredAt:r.delivered_at?new Date(r.delivered_at).toISOString():null,verifiedAt:r.verified_at?new Date(r.verified_at).toISOString():null,createdAt:new Date(r.created_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()}; }

app.get('/health', async (_req,res)=>{ let db=false; try{await q('SELECT 1');db=true;}catch{} res.json({ok:true,version:'8.2.1',aiConfigured:!!openai,adminConfigured:!!ADMIN_KEY,databaseConnected:db}); });
app.get('/api/businesses', async (req,res)=>{ try { const cat=clean(req.query.category); const r=await q(`SELECT * FROM businesses WHERE active=TRUE AND (subscription_expires_at IS NULL OR subscription_expires_at>NOW()) ${cat?'AND category=$1':''} ORDER BY name`,cat?[cat]:[]); res.json({ok:true,businesses:r.rows.map(publicBusiness)}); } catch(e){res.status(500).json({ok:false,message:e.message});} });
app.get('/api/businesses/:id', async(req,res)=>{const b=await getBusiness(req.params.id); if(!b||!activeBusiness(b))return res.status(404).json({ok:false,message:'Negocio no disponible.'}); res.json({ok:true,business:publicBusiness(b)});});
app.get('/api/businesses/:id/products', async(req,res)=>{const b=await getBusiness(req.params.id);if(!b||!activeBusiness(b))return res.status(404).json({ok:false,message:'Negocio no disponible.'});const r=await q('SELECT id,business_id,name,description,price,image,category,available FROM products WHERE business_id=$1 AND available=TRUE ORDER BY created_at',[req.params.id]);res.json({ok:true,products:r.rows.map(x=>({...x,businessId:x.business_id,price:Number(x.price)}))});});

app.post('/api/owner/login', async(req,res)=>{ try{const id=clean(req.body?.businessId),pw=String(req.body?.password||'');const b=await getBusiness(id);if(!b||!activeBusiness(b)||!checkPassword(pw,b.owner_password_hash))return res.status(401).json({ok:false,message:'Negocio o contraseña incorrectos.'});const token=sign({role:'owner',businessId:id,exp:Date.now()+1000*60*60*12});res.json({ok:true,token,business:publicBusiness(b)});}catch(e){res.status(500).json({ok:false,message:e.message});} });
app.get('/api/owner/me', async(req,res)=>{const p=auth(req,'owner');if(!p)return res.status(401).json({ok:false,message:'Sesión inválida.'});const b=await getBusiness(p.businessId);res.json({ok:true,business:publicBusiness(b)});});
function owner(req,res,next){const p=auth(req,'owner');if(!p)return res.status(401).json({ok:false,message:'Sesión del negocio inválida.'});req.owner=p;next();}
app.get('/api/owner/products',owner,async(req,res)=>{const r=await q('SELECT id,business_id,name,description,price,image,category,available FROM products WHERE business_id=$1 ORDER BY created_at',[req.owner.businessId]);res.json({ok:true,products:r.rows.map(x=>({...x,businessId:x.business_id,price:Number(x.price)}))});});
app.post('/api/owner/products',owner,async(req,res)=>{const {name,description,price,image,category,available}=req.body||{};if(!clean(name))return res.status(400).json({ok:false,message:'Nombre obligatorio.'});const id=clean(req.body.id)||crypto.randomUUID();const r=await q(`INSERT INTO products(id,business_id,name,description,price,image,category,available) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,req.owner.businessId,clean(name),clean(description),money(price),clean(image),clean(category),available!==false]);res.status(201).json({ok:true,product:{...r.rows[0],businessId:r.rows[0].business_id,price:Number(r.rows[0].price)}});});
app.patch('/api/owner/products/:id',owner,async(req,res)=>{const r=await q(`UPDATE products SET name=COALESCE($1,name),description=COALESCE($2,description),price=COALESCE($3,price),category=COALESCE($4,category),available=COALESCE($5,available),updated_at=NOW() WHERE id=$6 AND business_id=$7 RETURNING *`,[req.body?.name,req.body?.description,req.body?.price==null?null:money(req.body.price),req.body?.category,typeof req.body?.available==='boolean'?req.body.available:null,req.params.id,req.owner.businessId]);if(!r.rows.length)return res.status(404).json({ok:false,message:'Producto no encontrado.'});res.json({ok:true,product:r.rows[0]});});
app.get('/api/owner/drivers',owner,async(req,res)=>{const r=await q('SELECT id,business_id,name,whatsapp,phone,active FROM drivers WHERE business_id=$1 ORDER BY name',[req.owner.businessId]);res.json({ok:true,drivers:r.rows.map(x=>({...x,businessId:x.business_id}))});});
app.post('/api/owner/drivers',owner,async(req,res)=>{const name=clean(req.body?.name);if(!name)return res.status(400).json({ok:false,message:'Nombre obligatorio.'});const id=crypto.randomUUID();const rawToken=crypto.randomBytes(18).toString('hex');const hash=crypto.createHash('sha256').update(rawToken).digest('hex');const r=await q('INSERT INTO drivers(id,business_id,name,whatsapp,phone,active,access_token_hash) VALUES($1,$2,$3,$4,$5,TRUE,$6) RETURNING id,name,whatsapp,phone,active',[id,req.owner.businessId,name,clean(req.body?.whatsapp),clean(req.body?.phone),hash]);res.status(201).json({ok:true,driver:{...r.rows[0],accessToken:rawToken,businessId:req.owner.businessId}});});
app.patch('/api/owner/drivers/:id',owner,async(req,res)=>{const r=await q(`UPDATE drivers SET name=COALESCE($1,name),whatsapp=COALESCE($2,whatsapp),phone=COALESCE($3,phone),active=COALESCE($4,active),updated_at=NOW() WHERE id=$5 AND business_id=$6 RETURNING id,business_id,name,whatsapp,phone,active`,[req.body?.name,req.body?.whatsapp,req.body?.phone,typeof req.body?.active==='boolean'?req.body.active:null,req.params.id,req.owner.businessId]);if(!r.rows.length)return res.status(404).json({ok:false,message:'Repartidor no encontrado.'});res.json({ok:true,driver:{...r.rows[0],businessId:r.rows[0].business_id}});});
app.get('/api/owner/orders',owner,async(req,res)=>{const r=await q('SELECT * FROM orders WHERE business_id=$1 ORDER BY created_at DESC',[req.owner.businessId]);res.json({ok:true,orders:r.rows});});
app.patch('/api/owner/orders/:id/driver',owner,async(req,res)=>{const driverId=clean(req.body?.driverId)||null;if(driverId){const d=await q('SELECT id FROM drivers WHERE id=$1 AND business_id=$2',[driverId,req.owner.businessId]);if(!d.rows.length)return res.status(404).json({ok:false,message:'Repartidor no encontrado.'});}const r=await q(`UPDATE orders SET driver_id=$1,assigned_at=CASE WHEN $1 IS NULL THEN NULL ELSE COALESCE(assigned_at,NOW()) END,updated_at=NOW() WHERE id=$2 AND business_id=$3 RETURNING *`,[driverId,req.params.id,req.owner.businessId]);if(!r.rows.length)return res.status(404).json({ok:false,message:'Pedido no encontrado.'});res.json({ok:true,order:orderOut(r.rows[0])});});
app.get('/api/owner/reports',owner,async(req,res)=>{const r=await q(`SELECT d.id,d.name,COUNT(o.id)::int total_orders,COUNT(o.id) FILTER(WHERE o.status='delivered')::int delivered_orders,COALESCE(SUM(o.total) FILTER(WHERE o.status='delivered'),0)::numeric delivered_amount FROM drivers d LEFT JOIN orders o ON o.driver_id=d.id AND o.business_id=$1 WHERE d.business_id=$1 GROUP BY d.id,d.name ORDER BY d.name`,[req.owner.businessId]);res.json({ok:true,reports:r.rows.map(x=>({...x,totalOrders:x.total_orders,deliveredOrders:x.delivered_orders,deliveredAmount:Number(x.delivered_amount)}))});});

app.post('/api/driver/login',async(req,res)=>{const businessId=clean(req.body?.businessId),driverId=clean(req.body?.driverId),token=clean(req.body?.accessToken);if(!businessId||!driverId||!token)return res.status(400).json({ok:false,message:'Faltan datos del repartidor.'});const hash=crypto.createHash('sha256').update(token).digest('hex');const r=await q('SELECT d.*,b.name business_name FROM drivers d JOIN businesses b ON b.id=d.business_id WHERE d.id=$1 AND d.business_id=$2 AND d.active=TRUE',[driverId,businessId]);if(!r.rows.length||r.rows[0].access_token_hash!==hash)return res.status(401).json({ok:false,message:'Identificador de repartidor inválido.'});const session=sign({role:'driver',businessId,driverId,exp:Date.now()+1000*60*60*24*30});res.json({ok:true,token:session,driver:{id:driverId,businessId,name:r.rows[0].name}});});
function driver(req,res,next){const p=auth(req,'driver');if(!p)return res.status(401).json({ok:false,message:'Sesión del repartidor inválida.'});req.driver=p;next();}
app.get('/api/driver/orders',driver,async(req,res)=>{const r=await q('SELECT * FROM orders WHERE business_id=$1 AND driver_id=$2 ORDER BY created_at DESC',[req.driver.businessId,req.driver.driverId]);res.json({ok:true,orders:r.rows.map(orderOut)});});
app.post('/api/driver/orders/:id/deliver',driver,async(req,res)=>{const code=clean(req.body?.code);if(!/^\d{4}$/.test(code))return res.status(400).json({ok:false,message:'El código debe tener 4 dígitos.'});const r=await q(`UPDATE orders SET status='delivered',delivery_code_verified=TRUE,delivered_at=COALESCE(delivered_at,NOW()),verified_at=NOW(),updated_at=NOW() WHERE id=$1 AND business_id=$2 AND driver_id=$3 AND delivery_code=$4 RETURNING *`,[req.params.id,req.driver.businessId,req.driver.driverId,code]);if(!r.rows.length)return res.status(400).json({ok:false,message:'Código incorrecto o pedido no asignado a este repartidor.'});res.json({ok:true,order:orderOut(r.rows[0])});});

app.post('/api/orders',async(req,res)=>{try{const {businessId,customer,phone,deliveryType,address,location,items,notes,total}=req.body||{};const b=await getBusiness(clean(businessId));if(!b||!activeBusiness(b))return res.status(404).json({ok:false,message:'Negocio no disponible.'});if(!clean(customer)||!Array.isArray(items)||!items.length)return res.status(400).json({ok:false,message:'Cliente y productos son obligatorios.'});const ids=items.map(x=>clean(x.id)).filter(Boolean);const r=await q('SELECT id,name,price FROM products WHERE business_id=$1 AND available=TRUE AND id=ANY($2::text[])',[b.id,ids]);const by=new Map(r.rows.map(x=>[x.id,x]));const safeItems=items.map(x=>{const p=by.get(clean(x.id));return p?{id:p.id,name:p.name,price:Number(p.price),quantity:Math.max(1,Number(x.quantity)||1)}:null;}).filter(Boolean);if(!safeItems.length)return res.status(400).json({ok:false,message:'No hay productos válidos.'});const computed=safeItems.reduce((s,x)=>s+x.price*x.quantity,0);const id=crypto.randomUUID(),code=String(crypto.randomInt(1000,10000));const ins=await q(`INSERT INTO orders(id,business_id,customer,phone,delivery_type,address,location,items,notes,total,status,delivery_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new',$11) RETURNING *`,[id,b.id,clean(customer),clean(phone),clean(deliveryType)||'delivery',clean(address),location||null,JSON.stringify(safeItems),clean(notes),computed,code]);res.status(201).json({ok:true,order:orderOut(ins.rows[0]),deliveryCode:code});}catch(e){console.error(e);res.status(500).json({ok:false,message:e.message});}});

app.post('/api/ai',async(req,res)=>{try{const businessId=clean(req.body?.businessId),message=clean(req.body?.message);const b=await getBusiness(businessId);if(!b||!activeBusiness(b))return res.status(404).json({ok:false,message:'Negocio no disponible.'});if(!message)return res.status(400).json({ok:false,message:'Falta el mensaje.'});const r=await q('SELECT name,description,price,category FROM products WHERE business_id=$1 AND available=TRUE ORDER BY created_at',[businessId]);const catalog=r.rows.map(p=>`${p.name}: RD$${Number(p.price)}${p.description?` — ${p.description}`:''}`).join('\n');if(!openai)return res.json({ok:true,reply:`La IA no está configurada todavía. Catálogo de ${b.name}:\n${catalog||'Sin productos.'}`});const response=await openai.responses.create({model:OPENAI_MODEL,instructions:`Eres la IA de ConectaRD para ${b.name}. Solo puedes hablar de este catálogo y nunca inventar productos o precios:\n${catalog||'No hay productos disponibles.'}`,input:message});res.json({ok:true,reply:response.output_text||'No pude responder.'});}catch(e){console.error(e);res.status(500).json({ok:false,message:e.message});}});

app.post('/api/admin/login', (req,res)=>{if(!adminOk(req))return res.status(401).json({ok:false,message:'ADMIN_KEY incorrecta.'});res.json({ok:true});});
app.get('/api/admin/businesses',admin,async(_req,res)=>{const r=await q('SELECT * FROM businesses ORDER BY name');res.json({ok:true,businesses:r.rows.map(publicBusiness)});});
app.post('/api/admin/businesses',admin,async(req,res)=>{const id=clean(req.body?.id),name=clean(req.body?.name);if(!id||!name)return res.status(400).json({ok:false,message:'ID y nombre son obligatorios.'});if(!/^[A-Za-z0-9_-]+$/.test(id))return res.status(400).json({ok:false,message:'ID inválido.'});const password=String(req.body?.password||'08656');const r=await q(`INSERT INTO businesses(id,name,category,whatsapp,phone,owner_password_hash,subscription_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,name,clean(req.body?.category)||'Otros',clean(req.body?.whatsapp),clean(req.body?.phone),hashPassword(password),req.body?.subscriptionExpiresAt||'2099-12-31T23:59:59Z']);res.status(201).json({ok:true,business:publicBusiness(r.rows[0])});});
app.patch('/api/admin/businesses/:id',admin,async(req,res)=>{const current=await getBusiness(req.params.id);if(!current)return res.status(404).json({ok:false,message:'Negocio no encontrado.'});const password=req.body?.password;const r=await q(`UPDATE businesses SET name=COALESCE($1,name),category=COALESCE($2,category),whatsapp=COALESCE($3,whatsapp),phone=COALESCE($4,phone),active=COALESCE($5,active),subscription_expires_at=COALESCE($6,subscription_expires_at),owner_password_hash=CASE WHEN $7='' THEN owner_password_hash ELSE $7 END,updated_at=NOW() WHERE id=$8 RETURNING *`,[req.body?.name,req.body?.category,req.body?.whatsapp,req.body?.phone,typeof req.body?.active==='boolean'?req.body.active:null,req.body?.subscriptionExpiresAt,password?hashPassword(password):'',req.params.id]);res.json({ok:true,business:publicBusiness(r.rows[0])});});
app.get('/api/admin/orders',admin,async(_req,res)=>{const r=await q('SELECT * FROM orders ORDER BY created_at DESC');res.json({ok:true,orders:r.rows.map(orderOut)});});
app.get('/api/admin/drivers',admin,async(_req,res)=>{const r=await q('SELECT id,business_id,name,whatsapp,phone,active FROM drivers ORDER BY name');res.json({ok:true,drivers:r.rows.map(x=>({...x,businessId:x.business_id}))});});
app.post('/api/admin/drivers',admin,async(req,res)=>{const businessId=clean(req.body?.businessId),name=clean(req.body?.name);if(!businessId||!name)return res.status(400).json({ok:false,message:'Negocio y nombre son obligatorios.'});const rawToken=crypto.randomBytes(18).toString('hex'),id=crypto.randomUUID();const r=await q('INSERT INTO drivers(id,business_id,name,whatsapp,phone,active,access_token_hash) VALUES($1,$2,$3,$4,$5,TRUE,$6) RETURNING id,business_id,name,whatsapp,phone,active',[id,businessId,name,clean(req.body?.whatsapp),clean(req.body?.phone),crypto.createHash('sha256').update(rawToken).digest('hex')]);res.status(201).json({ok:true,driver:{...r.rows[0],businessId:businessId,accessToken:rawToken}});});
app.patch('/api/admin/orders/:id/driver',admin,async(req,res)=>{const driverId=clean(req.body?.driverId)||null;const r=await q(`UPDATE orders SET driver_id=$1,assigned_at=CASE WHEN $1 IS NULL THEN NULL ELSE NOW() END,updated_at=NOW() WHERE id=$2 RETURNING *`,[driverId,req.params.id]);if(!r.rows.length)return res.status(404).json({ok:false,message:'Pedido no encontrado.'});res.json({ok:true,order:orderOut(r.rows[0])});});

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/cliente', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'cliente.html')));
app.get('/negocio', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'negocio.html')));
app.get('/repartidor', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'repartidor.html')));
app.get('/ia', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'ia.html')));

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({ok:false,message:'Error interno del servidor.'});});

async function start(){try{if(pool)await initDatabase();app.listen(PORT,'0.0.0.0',()=>console.log(`ConectaRD AI 8.2.1 ejecutándose en puerto ${PORT}`));}catch(e){console.error('STARTUP ERROR',e);process.exit(1);}}
start();
