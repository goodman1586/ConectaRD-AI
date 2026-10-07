(() => {
  const { $, esc, money, safeUrl, STATUS, makeApi, actions } = CRD;
  let token = sessionStorage.getItem('admin_token') || '', businesses = [];
  const api = makeApi(() => token, () => { if (token) logout(); });
  const TABS = ['business', 'drivers', 'products', 'orders', 'system'];

  function logout() { sessionStorage.removeItem('admin_token'); token = ''; location.reload(); }
  $('logout').onclick = logout;
  actions.tab = d => TABS.forEach(id => $(id).classList.toggle('hidden', id !== d.t));
  function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

  $('go').onclick = async () => {
    try {
      const d = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ key: $('key').value.trim() }) });
      token = d.token; sessionStorage.setItem('admin_token', token); $('key').value = '';
      showApp(); await loadAll();
    } catch (e) { $('err').textContent = '❌ ' + e.message; }
  };
  $('key').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });
  const loadAll = async () => { await loadBusinesses(); await Promise.all([loadDrivers(), loadProducts(), loadOrders()]); };
  const run = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

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
      <div class="row"><button class="${b.active ? 'danger' : 'green'}" type="button" data-act="toggleB" data-id="${esc(b.id)}" data-active="${b.active}">${b.active ? 'Suspender' : 'Activar'}</button>
      <button class="soft" type="button" data-act="extend" data-id="${esc(b.id)}">Vencimiento</button><button class="soft" type="button" data-act="pwB" data-id="${esc(b.id)}">Contraseña</button>
      <button class="danger" type="button" data-act="delB" data-id="${esc(b.id)}">Eliminar</button></div></div>`).join('') || '<p>Sin negocios.</p>';
  }
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
    $('ordersList').innerHTML = d.orders.map(o => `<div class="item"><b>#${esc(o.id.slice(0, 8))}</b> · ${esc(o.businessId)}<br>👤 ${esc(o.customer)} · 📞 ${esc(o.phone)} · ${money(o.total)}<br>📍 ${esc(o.address || 'GPS')}<br>
      Estado: ${esc(STATUS[o.status] || o.status)} · Repartidor: ${esc(o.driverId || 'Pendiente')}<br>🔐 Código: ${esc(o.deliveryCode || '—')}</div>`).join('') || '<p>Sin pedidos.</p>';
  }

  if (token) { showApp(); loadAll().catch(() => logout()); }
})();
