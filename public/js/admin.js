(() => {
  const { $, esc, money, safeUrl, STATUS, makeApi, actions } = CRD;
  let token = sessionStorage.getItem('admin_token') || '', businesses = [];
  const api = makeApi(() => token, () => { if (token) logout(); });
  const TABS = ['business', 'drivers', 'products', 'orders', 'payments', 'system', 'visual'];

  function logout() { sessionStorage.removeItem('admin_token'); token = ''; location.reload(); }
  $('logout').onclick = logout;
  actions.tab = d => TABS.forEach(id => $(id).classList.toggle('hidden', id !== d.t));
  function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('err').textContent = '';
    $('go').disabled = true;
    $('go').textContent = 'Validando…';
    try {
      const d = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ key: $('key').value.trim() }) });
      token = d.token; sessionStorage.setItem('admin_token', token); $('key').value = '';
      showApp(); await loadAll(); await loadBrandSettings(); await loadPaymentSettings();
    } catch (error) { $('err').textContent = '❌ ' + error.message; }
    finally { $('go').disabled = false; $('go').textContent = 'Entrar'; }
  });
  const loadAll = async () => { await loadBusinesses(); await Promise.all([loadDrivers(), loadProducts(), loadOrders()]); };
  async function loadBrandSettings() {
    const d = await api('/api/brand');
    $('brandLogoUrl').value = d.brand.logoUrl || '/assets/conectek-logo.png';
    $('brandWidth').value = d.brand.maxWidth || 210;
    $('brandPreview').src = d.brand.logoUrl || '/assets/conectek-logo.png';
    $('brandPreview').style.maxWidth = `${d.brand.maxWidth || 210}px`;
    const h = await api('/api/admin/brand/history');
    $('brandHistory').innerHTML = h.versions.map(x => `<div class="item"><img src="${esc(x.logoUrl)}" alt="Versión del logotipo" style="max-width:150px;width:100%;height:45px;object-fit:contain"><br>${new Date(x.changedAt).toLocaleString()} · ${x.maxWidth}px <button class="soft" type="button" data-act="restoreBrand" data-id="${x.id}">Restaurar</button></div>`).join('') || '<p class="muted">Aún no hay versiones guardadas.</p>';
  }
  $('brandLogoUrl').oninput = () => { $('brandPreview').src = safeUrl($('brandLogoUrl').value) || '/assets/conectek-logo.png'; };
  $('brandWidth').oninput = () => { $('brandPreview').style.maxWidth = `${Math.max(100, Math.min(420, Number($('brandWidth').value) || 210))}px`; };
  $('saveBrand').onclick = run(async () => {
    const d = await api('/api/admin/brand', { method: 'PUT', body: JSON.stringify({ logoUrl: $('brandLogoUrl').value.trim(), maxWidth: Number($('brandWidth').value) }) });
    $('brandMsg').textContent = 'Identidad visual guardada.';
    $('brandLogoUrl').value = d.brand.logoUrl; $('brandPreview').src = d.brand.logoUrl;
    await loadBrandSettings();
  });
  actions.restoreBrand = run(async d => { await api(`/api/admin/brand/history/${encodeURIComponent(d.id)}/restore`, { method: 'POST' }); await loadBrandSettings(); $('brandMsg').textContent = 'Versión restaurada.'; });
  const run = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

  async function loadPaymentSettings() {
    await CRD.configReady;
    const [d, operation] = await Promise.all([api('/api/config'), api('/api/admin/operation-settings')]);
    const s = operation.settings;
    const productPriceLabel = document.querySelector('label[for="newProductPrice"]');
    if (productPriceLabel) productPriceLabel.textContent = `Precio del producto (${CRD.currency})`;
    $('currency').value = d.currency || 'DOP';
    $('allowCard').checked = !!s.allowCard; $('allowAch').checked = !!s.allowAch; $('allowCashPickup').checked = !!s.allowCashPickup; $('allowZelle').checked = !!s.allowZelle; $('zelleContact').value = s.zelleContact || ''; $('zelleInstructions').value = s.zelleInstructions || '';
    $('commissionPercent').value = s.commissionPercent; $('driverPercent').value = s.driverPercent;
    $('deliveryEnabled').checked = !!s.deliveryEnabled; $('deliveryBaseFee').value = s.deliveryBaseFee; $('deliveryPerKm').value = s.deliveryPerKm; $('deliveryPerMinute').value = s.deliveryPerMinute; $('deliveryMinimum').value = s.deliveryMinimum; $('deliveryMaxKm').value = s.deliveryMaxKm || 0;
    $('stripeStatus').textContent = operation.stripeConfigured ? 'Stripe está configurado. Cada negocio debe completar su incorporación segura; ACH requiere aprobación bancaria y solo se ofrece cuando la moneda es USD.' : 'Stripe no está configurado: agrega STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET al entorno del servidor. No se procesarán tarjetas ni ACH hasta conectarlo.';
    $('mapsStatus').textContent = operation.mapsConfigured ? 'Google Routes API está conectada. La tarifa usa kilómetros y tiempo de ruta real.' : 'Google Routes API no está conectada. El delivery queda deshabilitado para evitar cobrar una distancia estimada o inventada.';
  }
  $('saveCurrency').onclick = run(async () => {
    const d = await api('/api/admin/payment-settings', { method: 'PUT', body: JSON.stringify({ currency: $('currency').value }) });
    $('currencyMsg').textContent = `Moneda guardada: ${d.currency}. Los clientes y negocios la verán al recargar la página.`;
  });
  $('saveOperations').onclick = run(async () => {
    const settings = { allowCard: $('allowCard').checked, allowAch: $('allowAch').checked, allowCashPickup: $('allowCashPickup').checked, allowZelle: $('allowZelle').checked, zelleContact: $('zelleContact').value.trim(), zelleInstructions: $('zelleInstructions').value.trim(), commissionPercent: Number($('commissionPercent').value), driverPercent: Number($('driverPercent').value), deliveryEnabled: $('deliveryEnabled').checked, deliveryBaseFee: Number($('deliveryBaseFee').value), deliveryPerKm: Number($('deliveryPerKm').value), deliveryPerMinute: Number($('deliveryPerMinute').value), deliveryMinimum: Number($('deliveryMinimum').value), deliveryMaxKm: Number($('deliveryMaxKm').value) };
    await api('/api/admin/operation-settings', { method: 'PUT', body: JSON.stringify(settings) });
    $('operationsMsg').textContent = 'Configuración de pago y tarifas guardada.';
    await loadPaymentSettings();
  });

  async function loadBusinesses() {
    businesses = (await api('/api/admin/businesses')).businesses;
    const opts = businesses.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    const previousProductBusiness = $('pb').value;
    $('db').innerHTML = opts || '<option value="">Sin negocios</option>';
    $('pb').innerHTML = `<option value="">${businesses.length ? 'Selecciona un negocio' : 'No hay negocios disponibles'}</option>${opts}`;
    if (businesses.some(b => b.id === previousProductBusiness)) $('pb').value = previousProductBusiness;
    else if (businesses.length) $('pb').value = businesses[0].id;
    $('businesses').innerHTML = businesses.map(b => `<div class="item"><b>${esc(b.name)}</b><br>ID: ${esc(b.id)} · ${esc(b.category)}<br>📍 ${esc(b.address)} · ✉️ ${esc(b.email)}<br>
      Estado: <span class="pill ${b.active ? 'on' : 'off'}">${b.active ? 'ACTIVO' : 'SUSPENDIDO'}</span><br>Suscripción: ${b.subscriptionExpiresAt ? new Date(b.subscriptionExpiresAt).toLocaleDateString('es-DO') : 'Sin fecha'}
      <br>Comisión: ${b.commissionRate == null ? 'global' : b.commissionRate + '%'} · Stripe: ${b.paymentOnboarding?.chargesEnabled ? 'listo' : b.paymentOnboarding?.connected ? 'pendiente' : 'sin conectar'}
      <div class="row"><button class="${b.active ? 'danger' : 'green'}" type="button" data-act="toggleB" data-id="${esc(b.id)}" data-active="${b.active}">${b.active ? 'Suspender' : 'Activar'}</button>
      <button class="soft" type="button" data-act="commissionB" data-id="${esc(b.id)}" data-rate="${b.commissionRate ?? ''}">Comisión</button><button class="soft" type="button" data-act="extend" data-id="${esc(b.id)}">Vencimiento</button><button class="soft" type="button" data-act="pwB" data-id="${esc(b.id)}">Contraseña</button>
      <button class="danger" type="button" data-act="delB" data-id="${esc(b.id)}">Eliminar</button></div></div>`).join('') || '<p>Sin negocios.</p>';
  }
  actions.commissionB = run(async d => {
    const value = prompt('Comisión del negocio en %. Deja vacío para usar la comisión global.', d.rate);
    if (value === null) return;
    await api('/api/admin/businesses/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ commissionRate: value.trim() === '' ? null : Number(value) }) });
    await loadBusinesses();
  });
  actions.toggleB = run(async d => { await api('/api/admin/businesses/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ active: d.active !== 'true' }) }); await loadAll(); });
  actions.extend = run(async d => {
    const v = prompt('Nueva fecha de vencimiento (YYYY-MM-DD)'); if (!v) return;
    await api('/api/admin/businesses/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ subscriptionExpiresAt: new Date(v + 'T23:59:59').toISOString(), active: true }) }); await loadAll();
  });
  actions.pwB = run(async d => {
    const p = prompt('Nueva contraseña del dueño (mín. 8 caracteres)'); if (!p) return;
    await api('/api/admin/businesses/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ password: p }) }); alert('Contraseña actualizada. El dueño deberá iniciar sesión de nuevo.');
  });
  actions.delB = run(async d => {
    if (!confirm('ATENCIÓN: se eliminarán negocio, productos, repartidores y pedidos. ¿Continuar?')) return;
    await api('/api/admin/businesses/' + encodeURIComponent(d.id), { method: 'DELETE' }); await loadAll();
  });
  $('create').onclick = run(async () => {
    await api('/api/admin/businesses', { method: 'POST', body: JSON.stringify({ id: $('id').value.trim(), name: $('name').value, category: $('cat').value, whatsapp: $('wa').value, phone: $('phone').value, email: $('email').value, address: $('addr').value, logo: $('logo').value, coverImage: $('cover').value, password: $('pw').value, subscriptionExpiresAt: $('exp').value ? new Date($('exp').value + 'T23:59:59').toISOString() : undefined }) });
    alert('Negocio creado.'); $('pw').value = ''; await loadAll();
  });

  async function loadDrivers() {
    const d = await api('/api/admin/drivers');
    $('driversList').innerHTML = d.drivers.map(x => `<div class="item">🚴 <b>${esc(x.name)}</b><br>Negocio: ${esc(x.businessId)}<br>🆔 <b>${esc(x.id)}</b><br>💬 ${esc(x.whatsapp)} · 📞 ${esc(x.phone)}<br>
      <span class="pill ${x.active ? 'on' : 'off'}">${x.active ? 'Activo' : 'Suspendido'}</span> <span class="pill ${x.available ? 'on' : 'off'}">${x.available ? 'Disponible' : 'No disponible'}</span>
      <div class="row"><button class="${x.active ? 'danger' : 'green'}" type="button" data-act="toggleD" data-id="${esc(x.id)}" data-active="${x.active}">${x.active ? 'Suspender' : 'Activar'}</button>
      <button class="soft" type="button" data-act="resetD" data-id="${esc(x.id)}">🔑 Nuevo código</button><button class="danger" type="button" data-act="delD" data-id="${esc(x.id)}">Eliminar</button></div></div>`).join('') || '<p>Sin repartidores.</p>';
  }
  actions.toggleD = run(async d => { const a = d.active !== 'true'; await api('/api/admin/drivers/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ active: a, available: a }) }); await loadDrivers(); });
  actions.resetD = run(async d => {
    if (!confirm('¿Generar un nuevo código de acceso?')) return;
    const r = await api(`/api/admin/drivers/${encodeURIComponent(d.id)}/reset-access`, { method: 'POST' });
    alert(`Nuevo acceso (anótalo, no se vuelve a mostrar):\nID: ${r.driver.id}\nCódigo: ${r.driver.accessCode}`); await loadDrivers();
  });
  actions.delD = run(async d => { if (confirm('¿Eliminar repartidor?')) { await api('/api/admin/drivers/' + encodeURIComponent(d.id), { method: 'DELETE' }); await loadDrivers(); } });
  $('created').onclick = run(async () => {
    const r = await api('/api/admin/drivers', { method: 'POST', body: JSON.stringify({ businessId: $('db').value, name: $('dn').value, whatsapp: $('dw').value, phone: $('dp').value }) });
    alert(`Acceso del repartidor (anótalo, el código no se vuelve a mostrar):\nNegocio: ${r.driver.businessId}\nID: ${r.driver.id}\nCódigo: ${r.driver.accessCode}`); $('dn').value = ''; await loadDrivers();
  });

  async function loadProducts() {
    const id = $('pb').value;
    $('addProduct').disabled = !id;
    if (!id) {
      $('productsList').innerHTML = '<p class="muted">Selecciona un negocio para ver su catálogo.</p>';
      return;
    }
    const d = await api('/api/admin/products');
    $('productsList').innerHTML = d.products.filter(p => p.businessId === id).map(p => `<div class="item"><div class="row">${safeUrl(p.image) ? `<img class="productimg" alt="" src="${esc(p.image)}">` : ''}<b>${esc(p.name)}</b> · ${money(p.price)}</div>
      <p>${p.available ? 'Visible' : 'Oculto'}${p.description ? ' · '+esc(p.description) : ''}</p><button class="soft" type="button" data-act="tp" data-id="${esc(p.id)}" data-av="${p.available}">${p.available ? 'Ocultar' : 'Mostrar'}</button>
      <button class="soft" type="button" data-act="ep" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-image="${esc(p.image)}" data-desc="${esc(p.description)}">Editar</button>
      <button class="danger" type="button" data-act="dp" data-id="${esc(p.id)}">Eliminar</button></div>`).join('') || '<p>Sin productos para este negocio.</p>';
  }
  actions.tp = run(async d => { await api('/api/admin/products/' + encodeURIComponent(d.id), { method: 'PATCH', body: JSON.stringify({ available: d.av !== 'true' }) }); await loadProducts(); });
actions.ep = run(async d => { const name=prompt('Nombre del producto', d.name); if(name===null)return; const price=prompt('Precio RD$', d.price); if(price===null)return; const image=prompt('URL de imagen', d.image || ''); if(image===null)return; const description=prompt('Descripción', d.desc || ''); if(description===null)return; await api('/api/admin/products/'+encodeURIComponent(d.id), {method:'PATCH', body:JSON.stringify({name,price,image,description})}); await loadProducts(); });
  actions.dp = run(async d => { if (confirm('¿Eliminar producto?')) { await api('/api/admin/products/' + encodeURIComponent(d.id), { method: 'DELETE' }); await loadProducts(); } });
  function productMessage(message, type = '') {
    const feedback = $('productFeedback');
    feedback.textContent = message;
    feedback.className = `product-feedback${type ? ' ' + type : ''}`;
  }
  $('pb').onchange = () => {
    productMessage('');
    loadProducts().catch(e => productMessage('No se pudo cargar el catálogo: ' + e.message, 'error'));
  };
  $('refreshProducts').onclick = async () => {
    productMessage('Actualizando catálogo…');
    try {
      await loadProducts();
      productMessage('Catálogo actualizado.', 'success');
    } catch (e) {
      productMessage('No se pudo actualizar: ' + e.message, 'error');
    }
  };
  $('productForm').addEventListener('submit', async e => {
    e.preventDefault();
    const businessId = $('pb').value;
    const name = $('newProductName').value.trim();
    const price = Number($('newProductPrice').value);
    if (!businessId) { productMessage('Selecciona primero un negocio.', 'error'); return; }
    if (!name || !Number.isFinite(price) || price < 0) { productMessage('Escribe el nombre y un precio válido.', 'error'); return; }
    const button = $('addProduct');
    button.disabled = true;
    button.textContent = 'Agregando…';
    productMessage('Guardando producto…');
    try {
      await api(`/api/admin/businesses/${encodeURIComponent(businessId)}/products`, {
        method: 'POST',
        body: JSON.stringify({ name, price })
      });
      $('productForm').reset();
      productMessage('Producto agregado al catálogo.', 'success');
      await loadProducts();
    } catch (error) {
      productMessage('No se pudo agregar el producto: ' + error.message, 'error');
    } finally {
      button.textContent = '➕ Agregar producto';
      button.disabled = !$('pb').value;
    }
  });

  async function loadOrders() {
    const d = await api('/api/admin/orders');
    $('ordersList').innerHTML = d.orders.map(o => `<div class="item"><b>#${esc(o.id.slice(0, 8))}</b> · ${esc(o.businessId)}<br>👤 ${esc(o.customer)} · 📞 ${esc(o.phone)}<br>Productos: ${money(o.subtotal,o.currency)} · Envío: ${money(o.deliveryFee,o.currency)} · Total: <b>${money(o.total,o.currency)}</b><br>Comisión Conectek: ${money(o.platformCommission,o.currency)} · Neto negocio: ${money(o.businessNet,o.currency)} · Repartidor: ${money(o.driverEarnings,o.currency)}<br>Pago: ${esc(o.paymentMethod)} / ${esc(o.paymentStatus)} · ${esc(o.deliveryType)}${o.routeDistanceKm != null ? ` · Ruta ${o.routeDistanceKm} km` : ''}<br>📍 ${esc(o.address || 'Recogida en tienda')}<br>
      Estado: ${esc(STATUS[o.status] || o.status)} · Repartidor: ${esc(o.driverId || 'Pendiente')} · 🔐 Código: ${esc(o.deliveryCode || '—')}${o.paymentMethod === 'zelle' && o.paymentStatus !== 'paid' ? `<br><button class="green" type="button" data-act="confirmZelle" data-id="${esc(o.id)}">Confirmar abono Zelle</button>` : ''}</div>`).join('') || '<p>Sin pedidos.</p>';
  }
  actions.confirmZelle = run(async d => { if (!confirm('Verifica el abono en la cuenta comercial antes de confirmar. ¿El dinero ya aparece recibido?')) return; await api(`/api/admin/orders/${encodeURIComponent(d.id)}/confirm-zelle`, { method: 'PATCH', body: '{}' }); await loadAll(); });

  if (token) { showApp(); Promise.all([loadAll(), loadBrandSettings(), loadPaymentSettings()]).catch(() => logout()); }
})();
