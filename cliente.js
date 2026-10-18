(() => {
  const { $, esc, money, safeUrl, STATUS, makeApi, actions } = CRD;
  const api = makeApi();
  let B = '', products = [], cart = {}, coords = null, trackTimer = null, sending = false;
  let storefront = { catalogCarousel: true, juiceCarousel: true };
  const LAST = 'crd_last_order';

  async function boot() {
    const d = await api('/api/businesses');
    if (!d.businesses.length) { $('business-track').innerHTML = '<p class="muted">No hay negocios disponibles.</p>'; return; }
    $('business-track').innerHTML = d.businesses.map(b => `<article class="business-option">${safeUrl(b.logo) ? `<img class="business-option-logo" alt="Logo de ${esc(b.name)}" src="${esc(b.logo)}">` : '<div class="business-option-placeholder">🏪</div>'}<h3>${esc(b.name)}</h3><p class="muted">${esc(b.category)}</p><button class="primary" type="button" data-select-business="${esc(b.id)}">Elegir negocio</button></article>`).join('');
    document.addEventListener('click', async e => {
      const choose = e.target.closest('[data-select-business]');
      if (choose) {
        B = choose.dataset.selectBusiness; cart = {}; coords = null; $('chat').innerHTML = ''; $('msg').textContent = '';
        $('business-picker').classList.add('hidden'); $('storefront').classList.remove('hidden');
        await load(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      }
      if (e.target.closest('#change-business')) { $('business-picker').classList.remove('hidden'); $('storefront').classList.add('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      const btn = e.target.closest('[data-scroll]');
      const track = btn && document.getElementById(btn.dataset.scroll);
      if (track) track.scrollBy({ left: Number(btn.dataset.direction) * track.clientWidth, behavior: 'smooth' });
    });
    resumeTracking();
  }

  async function load() {
    const [b, p] = await Promise.all([api('/api/businesses/' + encodeURIComponent(B)), api('/api/businesses/' + encodeURIComponent(B) + '/products')]);
    const x = b.business;
    storefront = { catalogCarousel: x.storefront?.catalogCarousel !== false, juiceCarousel: x.storefront?.juiceCarousel !== false };
    $('business').innerHTML = `<div class="row between"><div class="row">${safeUrl(x.logo) ? `<img class="logo round" alt="Logo de ${esc(x.name)}" src="${esc(x.logo)}">` : ''}<div><h2>${esc(x.name)}</h2><p>${esc(x.category)}</p><p class="muted">📍 ${esc(x.address)} · 📞 ${esc(x.phone)} · 💬 ${esc(x.whatsapp)} · ✉️ ${esc(x.email)}</p></div></div><button id="change-business" class="soft" type="button">Cambiar negocio</button></div>${safeUrl(x.coverImage) ? `<img class="cover" alt="Portada de ${esc(x.name)}" src="${esc(x.coverImage)}">` : ''}`;
    products = p.products;
    renderPromo(x); renderProducts(); renderCart();
  }

  function renderPromo(b) {
    const el = $('promo');
    if (b.promo?.active && b.promo.title) {
      el.classList.remove('hidden');
      el.innerHTML = `<div class="promo"><div class="row"><div><h2>🔥 ${esc(b.promo.title)}</h2><p>${esc(b.promo.text)}</p></div>${safeUrl(b.promo.image) ? `<img class="promoimg" alt="" src="${esc(b.promo.image)}">` : ''}</div></div>`;
    } else el.classList.add('hidden');
  }
  function renderProducts() {
    const isJuice = p => /^jugos?$/i.test(String(p.category || '').trim());
    const juices = storefront.juiceCarousel ? products.filter(isJuice) : [];
    const catalog = storefront.juiceCarousel ? products.filter(p => !isJuice(p)) : products;
    $('products').innerHTML = productList(catalog, 'catalog-track', storefront.catalogCarousel);
    $('juice-section').classList.toggle('hidden', !juices.length);
    $('juices').innerHTML = productList(juices, 'juice-track', true);
  }
  function productList(list, trackId, carousel) {
    if (!list.length) return '<p class="muted">No hay productos disponibles.</p>';
    const cards = list.map(p => {
      const description = String(p.description || '').trim();
      const longDescription = description.length > 90;
      return `<div class="item product-card">${safeUrl(p.image) ? `<img class="store-product-image" alt="${esc(p.name)}" src="${esc(p.image)}">` : ''}<b class="product-name">${esc(p.name)}</b>${description ? `<p class="product-description" id="product-desc-${esc(p.id)}">${esc(description)}</p>${longDescription ? `<button class="description-toggle" type="button" data-act="toggleDescription" data-id="${esc(p.id)}" aria-expanded="false">Ver más</button>` : ''}` : ''}<div class="price">${money(p.price)}</div><button class="green" type="button" data-act="add" data-id="${esc(p.id)}">➕ Agregar</button></div>`;
    }).join('');
    if (!carousel) return `<div class="products">${cards}</div>`;
    return `<div class="carousel-track" id="${trackId}">${cards}</div><div class="carousel-controls"><button class="soft" type="button" data-scroll="${trackId}" data-direction="-1" aria-label="Deslizar a la izquierda">←</button><button class="soft" type="button" data-scroll="${trackId}" data-direction="1" aria-label="Deslizar a la derecha">→</button></div>`;
  }
  actions.toggleDescription = (d, button) => {
    const description = document.getElementById(`product-desc-${d.id}`);
    if (!description) return;
    const expanded = description.classList.toggle('expanded');
    button.textContent = expanded ? 'Ver menos' : 'Ver más';
    button.setAttribute('aria-expanded', String(expanded));
  };
  function renderCart() {
    let total = 0;
    $('cart').innerHTML = Object.entries(cart).map(([id, q]) => {
      const p = products.find(x => x.id === id); if (!p) return '';
      total += q * p.price;
      return `<div class="row between item"><span>${esc(p.name)}</span><span class="row"><button class="soft" type="button" data-act="dec" data-id="${esc(id)}" aria-label="Quitar uno">−</button><span class="qty">${q}</span><button class="soft" type="button" data-act="add" data-id="${esc(id)}" aria-label="Agregar uno">+</button></span><b>${money(q * p.price)}</b></div>`;
    }).join('') || '<p class="muted">Carrito vacío.</p>';
    $('total').textContent = money(total);
  }
  actions.add = d => { cart[d.id] = Math.min(99, (cart[d.id] || 0) + 1); renderCart(); };
  actions.dec = d => { cart[d.id] = (cart[d.id] || 0) - 1; if (cart[d.id] <= 0) delete cart[d.id]; renderCart(); };

  $('gps').onclick = () => {
    if (!navigator.geolocation) return ($('gpsmsg').textContent = 'GPS no disponible.');
    $('gpsmsg').textContent = '📍 Obteniendo ubicación...';
    navigator.geolocation.getCurrentPosition(
      p => { coords = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) }; $('gpsmsg').textContent = '✅ Ubicación compartida. Precisión aproximada: ' + coords.accuracy + ' m'; },
      () => ($('gpsmsg').textContent = '⚠️ No se pudo obtener GPS. Puedes escribir la dirección.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  $('maps').onclick = () => {
    const q = coords ? `${coords.lat},${coords.lng}` : $('address').value.trim();
    window.open(q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : 'https://www.google.com/maps/', '_blank', 'noopener');
  };

  $('order').onclick = async () => {
    if (sending) return;
    const items = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
    if (!items.length) return alert('Agrega productos.');
    if (!$('customer').value.trim() || !$('phone').value.trim()) return alert('Completa nombre y teléfono/WhatsApp.');
    if (!coords && !$('address').value.trim()) return alert('Comparte GPS o escribe una dirección.');
    sending = true; $('order').disabled = true; $('msg').textContent = 'Enviando pedido...';
    try {
      const d = await api('/api/orders', { method: 'POST', body: JSON.stringify({ businessId: B, customer: $('customer').value.trim(), phone: $('phone').value.trim(), address: $('address').value.trim(), location: coords, items, notes: $('notes').value.trim() }) });
      localStorage.setItem(LAST, JSON.stringify({ id: d.order.id, t: d.trackToken, code: d.deliveryCode }));
      $('msg').innerHTML = '<p class="success">✅ Pedido recibido. Sigue su estado arriba.</p>';
      cart = {}; renderCart(); resumeTracking(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { $('msg').textContent = '❌ ' + e.message; }
    finally { sending = false; $('order').disabled = false; }
  };

  /* Seguimiento: el pedido y su código sobreviven a recargar la página. */
  function resumeTracking() {
    clearInterval(trackTimer);
    let last; try { last = JSON.parse(localStorage.getItem(LAST) || 'null'); } catch {}
    if (!last) return $('tracker').classList.add('hidden');
    const tick = async () => {
      try {
        const d = (await api(`/api/orders/${encodeURIComponent(last.id)}/track?t=${encodeURIComponent(last.t)}`)).order;
        const closed = d.status === 'delivered' || d.status === 'cancelled';
        $('tracker').classList.remove('hidden');
        $('tracker').innerHTML = `<h2>📦 Tu pedido #${esc(d.id.slice(0, 8))}</h2><p>Estado: <b>${esc(STATUS[d.status] || d.status)}</b>${d.driverName ? ` · Repartidor: ${esc(d.driverName)}` : ''} · ${money(d.total)}</p>${closed ? '' : `<div class="codebox">🔐 Código de entrega: <b>${esc(d.deliveryCode)}</b><br><small>Dáselo al repartidor al recibir tu pedido.</small></div>`}${closed ? '<button class="soft" type="button" data-act="clearTrack">Cerrar</button>' : ''}`;
        if (closed) clearInterval(trackTimer);
      } catch (e) {
        if (/no encontrado/i.test(e.message)) { localStorage.removeItem(LAST); clearInterval(trackTimer); $('tracker').classList.add('hidden'); }
      }
    };
    tick(); trackTimer = setInterval(tick, 10000);
  }
  actions.clearTrack = () => { localStorage.removeItem(LAST); clearInterval(trackTimer); $('tracker').classList.add('hidden'); };

  async function ask() {
    const q = $('question').value.trim(); if (!q) return;
    $('ask').disabled = true;
    try {
      const d = await api('/api/ai', { method: 'POST', body: JSON.stringify({ businessId: B, message: q }) });
      $('chat').innerHTML += `<p><b>Tú:</b> ${esc(q)}</p><p><b>IA:</b> ${esc(d.reply)}</p>`;
      $('question').value = ''; $('chat').scrollTop = $('chat').scrollHeight;
    } catch (e) { $('chat').innerHTML += `<p class="error">${esc(e.message)}</p>`; }
    finally { $('ask').disabled = false; }
  }
  $('ask').onclick = ask;
  $('question').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });

  boot().catch(e => ($('msg').textContent = '❌ ' + e.message));
})();
