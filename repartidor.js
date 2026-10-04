(() => {
  const { $, esc, money, STATUS, makeApi, waNumber, notify, askNotifyPermission, renderIfChanged, actions } = CRD;
  let token = sessionStorage.getItem('driver_token') || '', lastIds = null, available = true;
  const api = makeApi(() => token, () => { if (token) logout(); });

  function logout() { sessionStorage.removeItem('driver_token'); token = ''; location.reload(); }
  $('logout').onclick = logout;
  $('notify').onclick = () => askNotifyPermission($('notify'));

  function setAvail(v) {
    available = v;
    $('availability').textContent = v ? 'Disponible' : 'No disponible';
    $('availability').className = 'pill ' + (v ? 'on' : 'off');
    $('toggleAvail').textContent = v ? '⏸ No disponible' : '▶️ Disponible';
  }

  function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

  $('enter').onclick = async () => {
    try {
      const d = await api('/api/driver/login', { method: 'POST', body: JSON.stringify({ businessId: $('bid').value.trim(), driverId: $('did').value.trim(), accessToken: $('code').value.trim() }) });
      token = d.token; sessionStorage.setItem('driver_token', token); $('code').value = '';
      showApp(); await init();
    } catch (e) { $('err').textContent = '❌ ' + e.message; }
  };
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('enter').click(); });

  async function init() {
    const me = (await api('/api/driver/me')).driver;
    $('who').textContent = me.name + ' · ' + me.id;
    setAvail(me.available);
    await load();
  }

  async function load() {
    const d = await api('/api/driver/orders');
    const ids = new Set(d.orders.map(o => o.id));
    if (lastIds) for (const o of d.orders) if (!lastIds.has(o.id) && o.status !== 'delivered') notify('🔔 Nuevo pedido', `Cliente: ${o.customer} · ${money(o.total)}`);
    lastIds = ids;
    const html = d.orders.map(o => {
      const map = o.location?.lat != null && o.location?.lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.location.lat + ',' + o.location.lng)}`
        : (o.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}` : 'https://www.google.com/maps/');
      const wa = waNumber(o.phone), tel = (o.phone || '').replace(/[^\d+]/g, '');
      const closed = o.status === 'delivered' || o.status === 'cancelled';
      return `<div class="card ${closed ? 'done' : ''}"><div class="row between"><h2>📦 Pedido #${esc(o.id.slice(0, 8))}</h2><span class="pill">${esc(STATUS[o.status] || o.status)}</span></div>
        <p><b>👤 Cliente:</b> ${esc(o.customer)}</p><p><b>📞 Teléfono:</b> ${esc(o.phone || 'No indicado')}</p><p><b>📍 Dirección:</b> ${esc(o.address || 'Ubicación GPS')}</p>
        ${o.location?.lat != null ? `<p class="muted">🛰️ GPS: ${Number(o.location.lat).toFixed(6)}, ${Number(o.location.lng).toFixed(6)}</p>` : ''}
        ${o.notes ? `<p><b>📝 Notas:</b> ${esc(o.notes)}</p>` : ''}
        <p><b>🛒 Productos:</b> ${esc((o.items || []).map(x => x.quantity + ' × ' + x.name).join(', '))}</p><p><b>💰 Total:</b> ${money(o.total)}</p>
        <div class="row"><a class="button primary" href="${esc(map)}" target="_blank" rel="noopener">🗺️ Ir al cliente</a>
        ${tel ? `<a class="button green" href="tel:${esc(tel)}">📞 Llamar</a>` : ''}${wa ? `<a class="button soft" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}">💬 WhatsApp</a>` : ''}</div>
        ${o.deliveryCodeVerified ? '<p class="success"><b>✅ Entrega confirmada</b></p>' : closed ? '' : `<div class="verify"><label for="c_${esc(o.id)}">🔐 Código de entrega (te lo da el cliente, 4 dígitos)</label><input id="c_${esc(o.id)}" inputmode="numeric" maxlength="4" placeholder="0000" autocomplete="off"><button class="green" type="button" data-act="deliver" data-id="${esc(o.id)}">✅ Confirmar entrega</button></div>`}</div>`;
    }).join('') || '<div class="card"><p class="muted">No hay pedidos asignados todavía.</p></div>';
    renderIfChanged($('orders'), html);
  }

  actions.deliver = async (d, btn) => {
    const input = $('c_' + d.id), code = input.value.trim();
    if (!/^\d{4}$/.test(code)) return alert('El código debe tener 4 dígitos.');
    btn.disabled = true;
    try {
      await api(`/api/driver/orders/${encodeURIComponent(d.id)}/deliver`, { method: 'POST', body: JSON.stringify({ code }) });
      alert('✅ Entrega confirmada.');
      const me = (await api('/api/driver/me')).driver; setAvail(me.available);
    } catch (e) { alert('❌ ' + e.message); }
    finally { btn.disabled = false; await load().catch(() => {}); }
  };

  $('toggleAvail').onclick = async () => {
    try { const d = await api('/api/driver/availability', { method: 'PATCH', body: JSON.stringify({ available: !available }) }); setAvail(d.driver.available); await load(); } catch (e) { alert(e.message); }
  };

  setInterval(() => { if (token && !document.hidden) load().catch(() => {}); }, 5000);
  if (token) { showApp(); init().catch(() => logout()); }
})();
