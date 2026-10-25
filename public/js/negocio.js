(() => {
  const { $, esc, money, safeUrl, STATUS, makeApi, notify, askNotifyPermission, renderIfChanged, actions, changes } = CRD;
  let token = sessionStorage.getItem('owner_token') || '', me = null, lastIds = null, drivers = [], appStripeConfigured = false, language = localStorage.getItem('conectek_owner_language') || 'es';
  const api = makeApi(() => token, () => { if (token) logout(); });
  const OWNER_TEXT = {
    es: { businessPanel:'🏪 Panel del negocio', ownerLogin:'🏪 Acceso del dueño', cardPayments:'💳 Pagos con tarjeta y liquidaciones', connectStripe:'Conectar cuenta segura de pagos', stripeHosted:'Stripe recopila la información bancaria y de verificación. Conectek solo recibe el estado de la cuenta.', orders:'🔔 Pedidos', notifications:'🔔 Activar notificaciones', logout:'Salir', customer:'Cliente', pickup:'Recogida en tienda', delivery:'Delivery', payment:'Pago', products:'Productos', platform:'Comisión Conectek', businessNet:'Neto para el negocio', courier:'Pago estimado del repartidor', cashDue:'Efectivo pendiente de cobro', cashReceived:'Registrar efectivo recibido', reports:'📊 Reportes', drivers:'🚴 Repartidores', addDriver:'Agregar repartidor', storeProducts:'🛒 Productos', publicInfo:'🏪 Información pública del negocio', save:'Guardar cambios', cardReady:'Pagos con tarjeta listos.', stripePending:'Completa la verificación de Stripe para activar tarjetas.', stripeOff:'Pagos con tarjeta no configurados por administración.', cashPaid:'Efectivo registrado como recibido.' },
    en: { businessPanel:'🏪 Business panel', ownerLogin:'🏪 Owner sign in', cardPayments:'💳 Card payments and payouts', connectStripe:'Connect secure payment account', stripeHosted:'Stripe collects banking and verification details. Conectek only receives account status.', orders:'🔔 Orders', notifications:'🔔 Enable notifications', logout:'Log out', customer:'Customer', pickup:'Store pickup', delivery:'Delivery', payment:'Payment', products:'Products', platform:'Conectek commission', businessNet:'Business net', courier:'Estimated courier pay', cashDue:'Cash due at pickup', cashReceived:'Record cash received', reports:'📊 Reports', drivers:'🚴 Couriers', addDriver:'Add courier', storeProducts:'🛒 Products', publicInfo:'🏪 Public business information', save:'Save changes', cardReady:'Card payments are ready.', stripePending:'Complete Stripe verification to enable cards.', stripeOff:'Card payments are not configured by administration.', cashPaid:'Cash recorded as received.' },
    ht: { businessPanel:'🏪 Panèl biznis', ownerLogin:'🏪 Koneksyon pwopriyetè', cardPayments:'💳 Peman kat ak transfè', connectStripe:'Konekte kont peman an sekirite', stripeHosted:'Stripe kolekte enfòmasyon bankè ak verifikasyon. Conectek sèlman resevwa estati kont lan.', orders:'🔔 Kòmand', notifications:'🔔 Aktive notifikasyon', logout:'Dekonekte', customer:'Kliyan', pickup:'Vin pran nan magazen an', delivery:'Livrezon', payment:'Peman', products:'Pwodwi', platform:'Komisyon Conectek', businessNet:'Montan biznis la resevwa', courier:'Peman livre a estime', cashDue:'Kach pou resevwa lè kliyan an vini', cashReceived:'Make kach la resevwa', reports:'📊 Rapò', drivers:'🚴 Livre', addDriver:'Ajoute yon livre', storeProducts:'🛒 Pwodwi', publicInfo:'🏪 Enfòmasyon piblik biznis la', save:'Sove chanjman', cardReady:'Peman kat yo pare.', stripePending:'Fini verifikasyon Stripe pou aktive kat yo.', stripeOff:'Administrasyon poko konfigire peman kat.', cashPaid:'Kach la make kòm resevwa.' }
  };
  Object.assign(OWNER_TEXT.es, { enter:'Entrar', businessId:'ID del negocio', password:'Contraseña', name:'Nombre', phone:'Teléfono', newProduct:'Nuevo producto', productPrice:'Precio', imageUrl:'URL de imagen', category:'Categoría', description:'Descripción', add:'Agregar', changePassword:'Cambiar contraseña', currentPassword:'Contraseña actual', newPassword:'Nueva contraseña (mín. 8)', preparing:'Preparando', ready:'Listo', cancel:'Cancelar', newCode:'Nuevo código', noCourier:'Sin repartidor (automático)', active:'Activo', suspended:'Suspendido', occupied:'ocupado', noData:'Sin datos.', noProducts:'Sin productos.', orderReceived:'Recibido', delivered:'Entregado', cancelled:'Cancelado', paid:'Pagado', unpaid:'Pendiente' });
  Object.assign(OWNER_TEXT.en, { enter:'Sign in', businessId:'Business ID', password:'Password', name:'Name', phone:'Phone', newProduct:'New product', productPrice:'Price', imageUrl:'Image URL', category:'Category', description:'Description', add:'Add', changePassword:'Change password', currentPassword:'Current password', newPassword:'New password (min. 8)', preparing:'Preparing', ready:'Ready', cancel:'Cancel', newCode:'New code', noCourier:'No courier (automatic)', active:'Active', suspended:'Suspended', occupied:'busy', noData:'No data.', noProducts:'No products.', orderReceived:'Received', delivered:'Delivered', cancelled:'Cancelled', paid:'Paid', unpaid:'Pending' });
  Object.assign(OWNER_TEXT.ht, { enter:'Konekte', businessId:'ID biznis la', password:'Modpas', name:'Non', phone:'Telefòn', newProduct:'Nouvo pwodwi', productPrice:'Pri', imageUrl:'Adrès imaj', category:'Kategori', description:'Deskripsyon', add:'Ajoute', changePassword:'Chanje modpas', currentPassword:'Modpas aktyèl', newPassword:'Nouvo modpas (omwen 8)', preparing:'Ap prepare', ready:'Pare', cancel:'Anile', newCode:'Nouvo kòd', noCourier:'Pa gen livre (otomatik)', active:'Aktif', suspended:'Sispann', occupied:'okipe', noData:'Pa gen done.', noProducts:'Pa gen pwodwi.', orderReceived:'Resevwa', delivered:'Livre', cancelled:'Anile', paid:'Peye', unpaid:'An atant' });
  const tr = key => OWNER_TEXT[language]?.[key] || OWNER_TEXT.es[key] || key;
  function applyOwnerLanguage() { document.documentElement.lang = language === 'ht' ? 'ht' : language; $('ownerLanguage').value = language; document.querySelectorAll('[data-owner-i18n]').forEach(el => { el.textContent = tr(el.dataset.ownerI18n); }); for (const [id,key] of Object.entries({bid:'businessId',pw:'password',dn:'name',dw:'phone',dp:'phone',pn:'newProduct',pp:'productPrice',pi:'imageUrl',pcat:'category',pd:'description',cpw:'currentPassword',npw:'newPassword'})) if ($(id)) $(id).placeholder = tr(key); }
  $('ownerLanguage').addEventListener('change', () => { language = $('ownerLanguage').value; localStorage.setItem('conectek_owner_language', language); applyOwnerLanguage(); if (token) { loadOrders().catch(() => {}); loadReports().catch(() => {}); } });
  applyOwnerLanguage();

  function logout() { sessionStorage.removeItem('owner_token'); token = ''; location.reload(); }
  $('logout').onclick = logout;
  $('notify').onclick = () => askNotifyPermission($('notify'));
  $('connectStripe').onclick = async () => { try { const r = await api('/api/owner/stripe/onboard', { method: 'POST', body: '{}' }); location.assign(r.url); } catch (e) { $('stripeState').textContent = '❌ ' + e.message; } };

  $('enter').onclick = async () => {
    try {
      const d = await api('/api/owner/login', { method: 'POST', body: JSON.stringify({ businessId: $('bid').value.trim(), password: $('pw').value }) });
      token = d.token; sessionStorage.setItem('owner_token', token); $('pw').value = '';
      $('login').classList.add('hidden'); $('app').classList.remove('hidden'); await load();
    } catch (e) { $('err').textContent = '❌ ' + e.message; }
  };
  $('pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('enter').click(); });

  async function load() {
    await CRD.configReady;
    $('pp').placeholder = `Precio (${CRD.currency})`;
    appStripeConfigured = (await api('/api/config')).cardPaymentsEnabled;
    me = (await api('/api/owner/me')).business; const b = me;
    let stripe = { connected: false, chargesEnabled: false, achEnabled: false };
    try { stripe = await api('/api/owner/stripe/status'); }
    catch (error) { $('stripeState').textContent = error.message; }
    if (stripe.connected || appStripeConfigured) $('stripeState').textContent = stripe.achEnabled ? `${tr('cardReady')} · ACH` : stripe.chargesEnabled ? tr('cardReady') : stripe.connected ? tr('stripePending') : tr('stripeOff');
    $('connectStripe').disabled = !stripe.connected && !appStripeConfigured;
    $('head').innerHTML = `<div class="row">${safeUrl(b.logo) ? `<img class="logo round" alt="" src="${esc(b.logo)}">` : ''}<div><h1>${esc(b.name)}</h1><p>${esc(b.category)} · ${b.active ? '🟢 ' + tr('active') : '🔴 ' + tr('suspended')}${b.subscriptionExpiresAt ? ' · ' + (language === 'en' ? 'Subscription through ' : language === 'ht' ? 'Abònman jiska ' : 'Suscripción hasta ') + new Date(b.subscriptionExpiresAt).toLocaleDateString(language === 'en' ? 'en-US' : 'es-DO') : ''}</p><p class="muted">📍 ${esc(b.address)} · 📞 ${esc(b.phone)} · 💬 ${esc(b.whatsapp)} · ✉️ ${esc(b.email)}</p></div></div>${safeUrl(b.coverImage) ? `<img class="cover" alt="" src="${esc(b.coverImage)}">` : ''}`;
    const f = { name: b.name, email: b.email, wa: b.whatsapp, phone: b.phone, address: b.address, logo: b.logo, cover: b.coverImage };
    for (const id in f) $(id).value = f[id] || '';
    $('pt').value = b.promo?.title || ''; $('px').value = b.promo?.text || ''; $('pimg').value = b.promo?.image || '';
    $('pa').checked = !!b.promo?.active; $('pex').value = b.promo?.expiresAt ? b.promo.expiresAt.slice(0, 10) : '';
    $('catalogCarousel').checked = b.storefront?.catalogCarousel !== false;
    $('juiceCarousel').checked = b.storefront?.juiceCarousel !== false;
    await Promise.all([loadDrivers(), loadProducts(), loadReports()]);
    await loadOrders();
  }

  /* ----- Pedidos ----- */
  async function loadOrders() {
    const d = await api('/api/owner/orders');
    const ids = new Set(d.orders.map(o => o.id));
    if (lastIds) for (const o of d.orders) if (!lastIds.has(o.id)) notify('🔔 Nuevo pedido en ' + (me?.name || 'tu negocio'), `${o.customer} · ${money(o.total)}`);
    lastIds = ids;
    const opts = sel => `<option value="">${esc(tr('noCourier'))}</option>` + drivers.filter(x => x.active).map(x => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)} (${esc(x.id)})${x.available ? '' : ' · ' + esc(tr('occupied'))}</option>`).join('');
    const html = d.orders.map(o => {
      const open = !['delivered', 'cancelled', 'awaiting_payment'].includes(o.status);
      const statusText = ({new:tr('orderReceived'),awaiting_payment:tr('unpaid'),preparing:tr('preparing'),ready:tr('ready'),delivered:tr('delivered'),cancelled:tr('cancelled')})[o.status] || STATUS[o.status] || o.status;
      return `<div class="item"><div class="row between"><b>#${esc(o.id.slice(0, 8))}</b><span class="pill">${esc(statusText)}</span></div>
        <b>${esc(tr('customer'))}:</b> ${esc(o.customer)} · <b>${money(o.total,o.currency)}</b><br><b>📞</b> ${esc(o.phone)} · <b>📍</b> ${esc(o.deliveryType === 'pickup' ? tr('pickup') : o.address || 'GPS')}<br>${o.location?.lat != null ? `<a class="button primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.location.lat+','+o.location.lng)}">🗺️ Ver ubicación</a>` : ''}
        <b>🛒</b> ${esc((o.items || []).map(x => x.quantity + '× ' + x.name).join(', '))}<br>${esc(tr('payment'))}: ${esc(o.paymentMethod)} · ${esc(o.paymentStatus)}<br>${esc(tr('platform'))}: ${money(o.platformCommission,o.currency)} · ${esc(tr('businessNet'))}: <b>${money(o.businessNet,o.currency)}</b> · ${esc(tr('courier'))}: ${money(o.driverEarnings,o.currency)}${o.routeDistanceKm != null ? ` · ${o.routeDistanceKm} km` : ''}<br>
        ${o.deliveryCodeVerified ? '✅ Entregado' : (open ? '🔐 Código: <b>' + esc(o.deliveryCode) + '</b>' : '')}${o.deliveryAttempts >= 5 && open ? ' · <span class="error">🔒 bloqueado por intentos</span>' : ''}
        ${open ? `<div class="row">${o.paymentMethod === 'cash' && o.paymentStatus !== 'paid' ? `<button class="green" type="button" data-act="collectCash" data-id="${esc(o.id)}">${esc(tr('cashReceived'))}</button>` : ''}<select data-chg="assign" data-id="${esc(o.id)}" aria-label="Repartidor" style="max-width:260px" ${o.deliveryType === 'pickup' ? 'disabled' : ''}>${opts(o.driverId)}</select>
          <button class="soft" type="button" data-act="status" data-id="${esc(o.id)}" data-s="preparing">${esc(tr('preparing'))}</button>
          <button class="soft" type="button" data-act="status" data-id="${esc(o.id)}" data-s="ready">${esc(tr('ready'))}</button>
          <button class="soft" type="button" data-act="newcode" data-id="${esc(o.id)}">${esc(tr('newCode'))}</button>
          <button class="danger" type="button" data-act="status" data-id="${esc(o.id)}" data-s="cancelled">${esc(tr('cancel'))}</button></div>` : ''}</div>`;
    }).join('') || '<p class="muted">Sin pedidos.</p>';
    renderIfChanged($('orders'), html);
  }
  actions.status = async d => {
    if (d.s === 'cancelled' && !confirm('¿Cancelar este pedido?')) return;
    try { await api(`/api/owner/orders/${encodeURIComponent(d.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: d.s }) }); await Promise.all([loadOrders(), loadDrivers()]); } catch (e) { alert(e.message); }
  };
  actions.collectCash = async d => { if (!confirm(tr('cashDue') + '. ' + tr('cashReceived') + '?')) return; try { await api(`/api/owner/orders/${encodeURIComponent(d.id)}/collect`, { method: 'PATCH', body: '{}' }); await loadOrders(); } catch (e) { alert(e.message); } };
  actions.newcode = async d => {
    try { await api(`/api/owner/orders/${encodeURIComponent(d.id)}/reset-code`, { method: 'POST' }); await loadOrders(); } catch (e) { alert(e.message); }
  };
  changes.assign = async (d, el) => {
    try { await api(`/api/owner/orders/${encodeURIComponent(d.id)}/driver`, { method: 'PATCH', body: JSON.stringify({ driverId: el.value }) }); await Promise.all([loadOrders(), loadDrivers()]); } catch (e) { alert(e.message); }
  };

  /* ----- Repartidores ----- */
  async function loadDrivers() {
    drivers = (await api('/api/owner/drivers')).drivers;
    $('drivers').innerHTML = drivers.map(x => `<div class="item">🚴 <b>${esc(x.name)}</b><br>🆔 ${esc(x.id)}<br>💬 ${esc(x.whatsapp)} · 📞 ${esc(x.phone)}<br>
      <span class="pill ${x.active ? 'on' : 'off'}">${x.active ? 'Activo' : 'Suspendido'}</span> <span class="pill ${x.available ? 'on' : 'off'}">${x.available ? 'Disponible' : 'No disponible'}</span>
      <div class="row"><button class="${x.active ? 'danger' : 'green'}" type="button" data-act="toggleD" data-id="${esc(x.id)}" data-active="${x.active}">${x.active ? 'Suspender' : 'Activar'}</button>
      <button class="soft" type="button" data-act="resetD" data-id="${esc(x.id)}">🔑 Nuevo código</button>
      <button class="danger" type="button" data-act="delD" data-id="${esc(x.id)}">Eliminar</button></div></div>`).join('') || '<p class="muted">Sin repartidores.</p>';
  }
  actions.toggleD = async d => {
    const active = d.active !== 'true';
    try { await api('/api/owner/drivers/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ active, available: active }) }); await loadDrivers(); } catch (e) { alert(e.message); }
  };
  actions.resetD = async d => {
    if (!confirm('¿Generar un código de acceso nuevo? El anterior dejará de funcionar.')) return;
    try { const r = await api(`/api/owner/drivers/${encodeURIComponent(d.id)}/reset-access`, { method: 'POST' }); alert(`Nuevo acceso (anótalo, no se vuelve a mostrar):\nID: ${r.driver.id}\nCódigo: ${r.driver.accessCode}`); } catch (e) { alert(e.message); }
  };
  actions.delD = async d => {
    if (!confirm('¿Eliminar repartidor?')) return;
    try { await api('/api/owner/drivers/' + encodeURIComponent(d.id), { method: 'DELETE' }); await loadDrivers(); } catch (e) { alert(e.message); }
  };
  $('addd').onclick = async () => {
    try {
      const r = await api('/api/owner/drivers', { method: 'POST', body: JSON.stringify({ name: $('dn').value, whatsapp: $('dw').value, phone: $('dp').value }) });
      alert(`Datos del repartidor (anótalos, el código no se vuelve a mostrar):\nNegocio: ${me.id}\nID: ${r.driver.id}\nCódigo de acceso: ${r.driver.accessCode}`);
      ['dn', 'dw', 'dp'].forEach(i => ($(i).value = '')); await loadDrivers();
    } catch (e) { alert(e.message); }
  };

  /* ----- Productos ----- */
  async function loadProducts() {
    const d = await api('/api/owner/products');
    $('products').innerHTML = d.products.map(p => `<div class="item" data-pid="${esc(p.id)}"><div class="row">${safeUrl(p.image) ? `<img class="productimg" alt="" src="${esc(p.image)}">` : ''}<span class="pill ${p.available ? 'on' : 'off'}">${p.available ? 'Visible' : 'Oculto'}</span></div>
      <input data-f="name" value="${esc(p.name)}" aria-label="Nombre" maxlength="120"><input data-f="price" type="number" min="0" step="0.01" value="${esc(p.price)}" aria-label="Precio"><input data-f="image" value="${esc(p.image)}" placeholder="URL imagen" aria-label="Imagen"><input data-f="category" value="${esc(p.category)}" placeholder="Categoría (ej. Jugos)" aria-label="Categoría" maxlength="60">
      <button class="soft" type="button" data-act="saveP" data-id="${esc(p.id)}">Guardar</button>
      <button class="soft" type="button" data-act="showP" data-id="${esc(p.id)}" data-av="${p.available}">${p.available ? 'Ocultar' : 'Mostrar'}</button>
      <button class="danger" type="button" data-act="delP" data-id="${esc(p.id)}">Eliminar</button></div>`).join('') || '<p class="muted">Sin productos.</p>';
  }
  const fld = (id, f) => document.querySelector(`[data-pid="${CSS.escape(id)}"] [data-f="${f}"]`).value;
  actions.saveP = async d => {
    try { await api('/api/owner/products/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ name: fld(d.id, 'name'), price: fld(d.id, 'price'), image: fld(d.id, 'image'), category: fld(d.id, 'category') }) }); await loadProducts(); } catch (e) { alert(e.message); }
  };
  actions.showP = async d => {
    try { await api('/api/owner/products/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ available: d.av !== 'true' }) }); await loadProducts(); } catch (e) { alert(e.message); }
  };
  actions.delP = async d => {
    if (!confirm('¿Eliminar producto definitivamente? (Usa Ocultar si solo quieres pausarlo.)')) return;
    try { await api('/api/owner/products/' + encodeURIComponent(d.id), { method: 'DELETE' }); await loadProducts(); } catch (e) { alert(e.message); }
  };
  $('addp').onclick = async () => {
    try {
      await api('/api/owner/products', { method: 'POST', body: JSON.stringify({ name: $('pn').value, price: $('pp').value, image: $('pi').value, category: $('pcat').value, description: $('pd').value }) });
      ['pn', 'pp', 'pi', 'pcat', 'pd'].forEach(x => ($(x).value = '')); await loadProducts();
    } catch (e) { alert(e.message); }
  };

  /* ----- Perfil ----- */
  $('save').onclick = async () => {
    try {
      await api('/api/owner/profile', { method: 'PATCH', body: JSON.stringify({ name: $('name').value, email: $('email').value, whatsapp: $('wa').value, phone: $('phone').value, address: $('address').value, logo: $('logo').value, coverImage: $('cover').value, promoTitle: $('pt').value, promoText: $('px').value, promoImage: $('pimg').value, promoActive: $('pa').checked, promoExpiresAt: $('pex').value ? new Date($('pex').value + 'T23:59:59').toISOString() : null, catalogCarousel: $('catalogCarousel').checked, juiceCarousel: $('juiceCarousel').checked }) });
      $('saved').textContent = '✅ Guardado correctamente.'; await load();
    } catch (e) { $('saved').textContent = '❌ ' + e.message; }
  };
  $('chpw').onclick = async () => {
    try { const r = await api('/api/owner/password', { method: 'POST', body: JSON.stringify({ current: $('cpw').value, next: $('npw').value }) }); alert(r.message); logout(); } catch (e) { alert(e.message); }
  };
  async function loadReports() {
    const d = await api('/api/owner/reports');
    $('reports').innerHTML = d.reports.map(x => `<div class="item">${esc(x.name)} · ${x.totalOrders} ${language === 'es' ? 'pedidos' : language === 'ht' ? 'kòmand' : 'orders'} · ${x.deliveredOrders} ${language === 'es' ? 'entregados' : language === 'ht' ? 'livre' : 'delivered'} · ${tr('businessNet')}: ${money(x.deliveredAmount,x.currency)} · ${tr('courier')}: ${money(x.driverAmount,x.currency)}</div>`).join('') || `<p class="muted">${tr('noData')}</p>`;
  }

  setInterval(() => { if (token && !document.hidden) loadOrders().catch(() => {}); }, 6000);
  if (token) { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); load().catch(() => logout()); }
})();
