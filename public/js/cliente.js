(() => {
  const { $, esc, money, safeUrl, STATUS, makeApi, actions } = CRD;
  const api = makeApi();
  let B = '', products = [], cart = {}, coords = null, trackTimer = null, sending = false, appConfig = {}, activeBusiness = null;
  let availableBusinesses = [];
  let storefront = { catalogCarousel: true, juiceCarousel: true };
  const LAST = 'crd_last_order';
  const PROFILE = 'crd_customer_profile';
  const LANG = 'crd_customer_language';
  const TEXT = {
    es: { clientArea:'🛒 Área de cliente', language:'Idioma', myProfile:'Mi perfil', profileEyebrow:'Tu experiencia',profileTitle:'Mi perfil',profileDescription:'Guarda tus datos en este dispositivo para completar tus pedidos más rápido.',nameLabel:'Nombre',namePlaceholder:'Tu nombre',phoneLabel:'WhatsApp o teléfono',phonePlaceholder:'Tu número de contacto',saveProfile:'Guardar mis datos',profileLocalNote:'Perfil local · no requiere crear una cuenta.',profileSaved:'Datos guardados en este dispositivo.',marketplace:'Conectek Marketplace',chooseBusiness:'Elige un negocio',chooseBusinessHint:'Encuentra productos y realiza tu pedido de forma sencilla.',freshForYou:'Lo que buscas',catalog:'Catálogo',juices:'🥤 Jugos',yourSelection:'Tu selección',yourOrder:'🧾 Tu pedido',total:'Total',almostDone:'Casi listo',deliveryDetails:'📍 Datos de entrega',shareLocation:'📍 Compartir mi ubicación',locationPending:'Ubicación pendiente.',addressLabel:'Dirección o referencia',openMaps:'🗺️ Abrir Google Maps',deliveryNotes:'Instrucciones para el repartidor',confirmOrder:'🚚 Confirmar pedido',needHelp:'¿Necesitas ayuda?',businessAssistant:'🤖 Asistente del negocio',askPlaceholder:'Pregunta sobre productos, precios o dirección...',askButton:'Preguntar',choose:'Elegir negocio',changeBusiness:'Cambiar negocio',noBusinesses:'No hay negocios disponibles.',noProducts:'No hay productos disponibles.',add:'➕ Agregar',more:'Ver más',less:'Ver menos',emptyCart:'Carrito vacío.',gettingLocation:'📍 Obteniendo ubicación...',noGps:'GPS no disponible.',locationOk:'✅ Ubicación compartida. Precisión aproximada: ',meters:' m',locationFailed:'⚠️ No se pudo obtener GPS. Puedes escribir la dirección.',addProducts:'Agrega productos.',completeContact:'Completa nombre y teléfono/WhatsApp.',enterAddress:'Comparte GPS o escribe una dirección.',sending:'Enviando pedido...',orderReceived:'✅ Pedido recibido. Sigue su estado arriba.',close:'Cerrar',askRequired:'Escribe una pregunta.',tracking:'Pedido',received:'Recibido',preparing:'Preparando',ready:'Listo',delivered:'Entregado',cancelled:'Cancelado',driver:'Repartidor',deliveryCode:'Código de entrega',giveCode:'Dáselo al repartidor al recibir tu pedido.',you:'Tú',assistant:'Asistente',business:'Negocio',location:'GPS' },
    ht: { clientArea:'🛒 Zòn kliyan',language:'Lang',myProfile:'Pwofil mwen',profileEyebrow:'Eksperyans ou',profileTitle:'Pwofil mwen',profileDescription:'Sove enfòmasyon ou sou aparèy sa a pou ranpli kòmand ou pi vit.',nameLabel:'Non',namePlaceholder:'Non ou',phoneLabel:'WhatsApp oswa telefòn',phonePlaceholder:'Nimewo kontak ou',saveProfile:'Sove enfòmasyon mwen',profileLocalNote:'Pwofil lokal · ou pa bezwen kreye yon kont.',profileSaved:'Enfòmasyon yo sove sou aparèy sa a.',marketplace:'Mache Conectek',chooseBusiness:'Chwazi yon biznis',chooseBusinessHint:'Jwenn pwodwi epi fè kòmand ou fasilman.',freshForYou:'Sa w ap chèche',catalog:'Katalòg',juices:'🥤 Ji',yourSelection:'Seleksyon ou',yourOrder:'🧾 Kòmand ou',total:'Total',almostDone:'Prèske fini',deliveryDetails:'📍 Enfòmasyon livrezon',shareLocation:'📍 Pataje kote ou ye a',locationPending:'Kote a poko pataje.',addressLabel:'Adrès oswa referans',openMaps:'🗺️ Louvri Google Maps',deliveryNotes:'Enstriksyon pou livre a',confirmOrder:'🚚 Konfime kòmand',needHelp:'Ou bezwen èd?',businessAssistant:'🤖 Asistan biznis la',askPlaceholder:'Poze kesyon sou pwodwi, pri oswa adrès...',askButton:'Mande',choose:'Chwazi biznis',changeBusiness:'Chanje biznis',noBusinesses:'Pa gen biznis ki disponib.',noProducts:'Pa gen pwodwi ki disponib.',add:'➕ Ajoute',more:'Wè plis',less:'Wè mwens',emptyCart:'Panyen an vid.',gettingLocation:'📍 N ap jwenn kote ou ye...',noGps:'GPS pa disponib.',locationOk:'✅ Kote a pataje. Presizyon apwoksimatif: ',meters:' m',locationFailed:'⚠️ Nou pa t ka jwenn GPS. Ou ka ekri adrès la.',addProducts:'Ajoute pwodwi.',completeContact:'Ranpli non ak nimewo telefòn/WhatsApp.',enterAddress:'Pataje GPS oswa ekri yon adrès.',sending:'N ap voye kòmand lan...',orderReceived:'✅ Nou resevwa kòmand lan. Suiv estati a anlè a.',close:'Fèmen',askRequired:'Ekri yon kesyon.',tracking:'Kòmand',received:'Resevwa',preparing:'Ap prepare',ready:'Pare',delivered:'Livre',cancelled:'Anile',driver:'Livre pa',deliveryCode:'Kòd livrezon',giveCode:'Bay livre a kòd sa a lè w resevwa kòmand lan.',you:'Ou',assistant:'Asistan',business:'Biznis',location:'GPS' },
    en: { clientArea:'🛒 Customer area',language:'Language',myProfile:'My profile',profileEyebrow:'Your experience',profileTitle:'My profile',profileDescription:'Save your details on this device to check out faster.',nameLabel:'Name',namePlaceholder:'Your name',phoneLabel:'WhatsApp or phone',phonePlaceholder:'Your contact number',saveProfile:'Save my details',profileLocalNote:'Local profile · no account needed.',profileSaved:'Your details are saved on this device.',marketplace:'Conectek Marketplace',chooseBusiness:'Choose a business',chooseBusinessHint:'Find products and place your order with ease.',freshForYou:'Find what you need',catalog:'Catalog',juices:'🥤 Juices',yourSelection:'Your selection',yourOrder:'🧾 Your order',total:'Total',almostDone:'Almost there',deliveryDetails:'📍 Delivery details',shareLocation:'📍 Share my location',locationPending:'Location not shared yet.',addressLabel:'Address or directions',openMaps:'🗺️ Open Google Maps',deliveryNotes:'Instructions for the courier',confirmOrder:'🚚 Place order',needHelp:'Need help?',businessAssistant:'🤖 Business assistant',askPlaceholder:'Ask about products, prices, or directions...',askButton:'Ask',choose:'Choose business',changeBusiness:'Change business',noBusinesses:'No businesses are available.',noProducts:'No products are available.',add:'➕ Add',more:'See more',less:'See less',emptyCart:'Your cart is empty.',gettingLocation:'📍 Getting your location...',noGps:'GPS is not available.',locationOk:'✅ Location shared. Approximate accuracy: ',meters:' m',locationFailed:'⚠️ Could not get GPS. You can enter your address.',addProducts:'Add products to your order.',completeContact:'Enter your name and phone/WhatsApp.',enterAddress:'Share GPS or enter an address.',sending:'Sending your order...',orderReceived:'✅ Order received. Track its status above.',close:'Close',askRequired:'Enter a question.',tracking:'Order',received:'Received',preparing:'Preparing',ready:'Ready',delivered:'Delivered',cancelled:'Cancelled',driver:'Courier',deliveryCode:'Delivery code',giveCode:'Give this code to the courier when your order arrives.',you:'You',assistant:'Assistant',business:'Business',location:'GPS' }
  };
  Object.assign(TEXT.es, { deliveryMode:'Modalidad', pickup:'Recoger en la tienda', delivery:'Delivery a domicilio', paymentMethod:'Método de pago', cashPickup:'Efectivo al recoger', card:'Tarjeta Visa o débito', ach:'Cuenta bancaria ACH (USD)', zelle:'Zelle (confirmación manual)', subtotal:'Productos', deliveryFee:'Envío', commission:'Comisión de plataforma', businessNet:'Neto del negocio', driverEarnings:'Pago estimado del repartidor', routeDistance:'Distancia de ruta', orderTotal:'Total a pagar', zellePayTo:'Envía el pago Zelle a', zelleWait:'El negocio confirmará el pago antes de preparar el pedido.', paymentUnavailable:'Método de pago no disponible para este negocio.' });
  Object.assign(TEXT.en, { deliveryMode:'Fulfillment', pickup:'Pick up at store', delivery:'Home delivery', paymentMethod:'Payment method', cashPickup:'Cash at pickup', card:'Visa or debit card', ach:'Bank account (ACH · USD)', zelle:'Zelle (manual confirmation)', subtotal:'Items', deliveryFee:'Delivery', commission:'Platform commission', businessNet:'Business net', driverEarnings:'Estimated courier pay', routeDistance:'Route distance', orderTotal:'Total due', zellePayTo:'Send Zelle payment to', zelleWait:'The business must confirm payment before preparing the order.', paymentUnavailable:'Payment method unavailable for this business.' });
  Object.assign(TEXT.ht, { deliveryMode:'Fason resevwa', pickup:'Vin pran nan magazen an', delivery:'Livrezon lakay', paymentMethod:'Metòd peman', cashPickup:'Kach lè w vin pran li', card:'Kat Visa oswa debi', ach:'Kont labank ACH (USD)', zelle:'Zelle (konfimasyon manyèl)', subtotal:'Pwodwi yo', deliveryFee:'Livrezon', commission:'Komisyon platfòm lan', businessNet:'Montan biznis la resevwa', driverEarnings:'Peman livre a estime', routeDistance:'Distans wout la', orderTotal:'Total pou peye', zellePayTo:'Voye peman Zelle bay', zelleWait:'Biznis la dwe konfime peman an anvan li prepare kòmand lan.', paymentUnavailable:'Metòd peman sa a pa disponib pou biznis sa a.' });
  let language = localStorage.getItem(LANG) || 'es';
  const t = key => TEXT[language]?.[key] || TEXT.es[key] || key;
  function applyLanguage() {
    document.documentElement.lang = language === 'ht' ? 'ht' : language;
    document.querySelectorAll('[data-i18n]').forEach(el => { const value = t(el.dataset.i18n); if (value) el.textContent = value; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $('language').value = language;
    document.title = `${t('clientArea').replace(/^🛒\s*/, '')} · Conectek`;
  }
  function loadProfile() {
    let profile = {}; try { profile = JSON.parse(localStorage.getItem(PROFILE) || '{}'); } catch {}
    $('profileCustomer').value = profile.name || '';
    $('profilePhone').value = profile.phone || '';
    $('customer').value = profile.name || '';
    $('phone').value = profile.phone || '';
  }
  $('language').addEventListener('change', () => { language = $('language').value; localStorage.setItem(LANG, language); applyLanguage(); renderBusinessPicker(); renderPaymentChoices(); if (B) load().catch(() => {}); else renderCart(); });
  $('deliveryType').addEventListener('change', () => { updateDeliveryUI(); refreshQuote(); });
  $('paymentMethod').addEventListener('change', refreshQuote);
  $('address').addEventListener('change', refreshQuote);
  $('saveProfile').onclick = () => {
    const profile = { name: $('profileCustomer').value.trim(), phone: $('profilePhone').value.trim() };
    localStorage.setItem(PROFILE, JSON.stringify(profile));
    $('customer').value = profile.name; $('phone').value = profile.phone;
    $('profileMsg').textContent = t('profileSaved');
  };
  $('profileCustomer').addEventListener('input', () => { $('customer').value = $('profileCustomer').value; });
  $('profilePhone').addEventListener('input', () => { $('phone').value = $('profilePhone').value; });
  $('customer').addEventListener('input', () => { $('profileCustomer').value = $('customer').value; });
  $('phone').addEventListener('input', () => { $('profilePhone').value = $('phone').value; });
  applyLanguage(); loadProfile();

  async function boot() {
    await CRD.configReady;
    appConfig = await api('/api/config');
    const d = await api('/api/businesses');
    availableBusinesses = d.businesses;
    renderBusinessPicker();
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

  function renderBusinessPicker() {
    $('business-track').innerHTML = availableBusinesses.length ? availableBusinesses.map(b => `<article class="business-option">${safeUrl(b.logo) ? `<img class="business-option-logo" alt="Logo de ${esc(b.name)}" src="${esc(b.logo)}">` : '<div class="business-option-placeholder">🏪</div>'}<h3>${esc(b.name)}</h3><p class="muted">${esc(b.category)}</p><button class="primary" type="button" data-select-business="${esc(b.id)}">${t('choose')}</button></article>`).join('') : `<p class="muted">${t('noBusinesses')}</p>`;
  }

  async function load() {
    const [b, p] = await Promise.all([api('/api/businesses/' + encodeURIComponent(B)), api('/api/businesses/' + encodeURIComponent(B) + '/products')]);
    const x = b.business;
    activeBusiness = x;
    storefront = { catalogCarousel: x.storefront?.catalogCarousel !== false, juiceCarousel: x.storefront?.juiceCarousel !== false };
    $('business').innerHTML = `<div class="row between"><div class="row">${safeUrl(x.logo) ? `<img class="logo round" alt="Logo de ${esc(x.name)}" src="${esc(x.logo)}">` : ''}<div><h2>${esc(x.name)}</h2><p>${esc(x.category)}</p><p class="muted">📍 ${esc(x.address)} · 📞 ${esc(x.phone)} · 💬 ${esc(x.whatsapp)} · ✉️ ${esc(x.email)}</p></div></div><button id="change-business" class="soft" type="button">${t('changeBusiness')}</button></div>${safeUrl(x.coverImage) ? `<img class="cover" alt="Portada de ${esc(x.name)}" src="${esc(x.coverImage)}">` : ''}`;
    products = p.products;
    renderPaymentChoices(); updateDeliveryUI();
    renderPromo(x); renderProducts(); renderCart();
    await refreshQuote();
  }

  function renderPaymentChoices() {
    const choices = [];
    if (appConfig.cardPaymentsEnabled && activeBusiness?.paymentOnboarding?.chargesEnabled) choices.push(['card', t('card')]);
    if (appConfig.achPaymentsEnabled && activeBusiness?.paymentOnboarding?.achEnabled) choices.push(['ach', t('ach')]);
    if (appConfig.zelleEnabled) choices.push(['zelle', t('zelle')]);
    if (appConfig.cashPickupEnabled) choices.push(['cash', t('cashPickup')]);
    $('paymentMethod').innerHTML = choices.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('') || `<option value="">${esc(t('paymentUnavailable'))}</option>`;
    if (choices.length) $('paymentMethod').value = choices.some(x => x[0] === 'card') ? 'card' : choices[0][0];
  }
  function updateDeliveryUI() {
    const delivery = $('deliveryType').value === 'delivery';
    $('deliveryFields').classList.toggle('hidden', !delivery);
    const deliveryOption = $('deliveryType').querySelector('option[value="delivery"]');
    deliveryOption.disabled = !appConfig.deliveryEnabled;
    if (!appConfig.deliveryEnabled && delivery) $('deliveryType').value = 'pickup';
    if ($('paymentMethod').value === 'cash' && delivery) {
      const other = [...$('paymentMethod').options].find(o => o.value !== 'cash');
      if (other) $('paymentMethod').value = other.value;
    }
    const cash = $('paymentMethod').querySelector('option[value="cash"]');
    if (cash) cash.disabled = delivery;
  }
  async function refreshQuote() {
    if (!B || !activeBusiness) return;
    const deliveryType = $('deliveryType').value || 'pickup';
    if (deliveryType === 'delivery' && !coords && !$('address').value.trim()) {
      $('quote').classList.remove('hidden'); $('quote').textContent = t('enterAddress'); return;
    }
    $('quote').classList.remove('hidden'); $('quote').textContent = language === 'en' ? 'Calculating total…' : language === 'ht' ? 'N ap kalkile total la…' : 'Calculando el total…';
    try {
      const { quote } = await api('/api/orders/quote', { method: 'POST', body: JSON.stringify({ businessId: B, deliveryType, address: $('address').value.trim(), location: coords }) });
      const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => sum + (products.find(p => p.id === id)?.price || 0) * qty, 0);
      const total = subtotal + quote.deliveryFee;
      $('quote').innerHTML = `<b>${esc(t('subtotal'))}:</b> ${money(subtotal)}<br><b>${esc(t('deliveryFee'))}:</b> ${money(quote.deliveryFee)}${quote.routeDistanceKm != null ? `<br><b>${esc(t('routeDistance'))}:</b> ${quote.routeDistanceKm.toFixed(1)} km` : ''}<br><b>${esc(t('orderTotal'))}:</b> ${money(total)}`;
    } catch (e) { $('quote').textContent = '⚠️ ' + e.message; }
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
    if (!list.length) return `<p class="muted">${t('noProducts')}</p>`;
    const cards = list.map(p => {
      const description = String(p.description || '').trim();
      const longDescription = description.length > 90;
      return `<div class="item product-card">${safeUrl(p.image) ? `<img class="store-product-image" alt="${esc(p.name)}" src="${esc(p.image)}">` : ''}<b class="product-name">${esc(p.name)}</b>${description ? `<p class="product-description" id="product-desc-${esc(p.id)}">${esc(description)}</p>${longDescription ? `<button class="description-toggle" type="button" data-act="toggleDescription" data-id="${esc(p.id)}" aria-expanded="false">${t('more')}</button>` : ''}` : ''}<div class="price">${money(p.price)}</div><button class="green" type="button" data-act="add" data-id="${esc(p.id)}">${t('add')}</button></div>`;
    }).join('');
    if (!carousel) return `<div class="products">${cards}</div>`;
    return `<div class="carousel-track" id="${trackId}">${cards}</div><div class="carousel-controls"><button class="soft" type="button" data-scroll="${trackId}" data-direction="-1" aria-label="Deslizar a la izquierda">←</button><button class="soft" type="button" data-scroll="${trackId}" data-direction="1" aria-label="Deslizar a la derecha">→</button></div>`;
  }
  actions.toggleDescription = (d, button) => {
    const description = document.getElementById(`product-desc-${d.id}`);
    if (!description) return;
    const expanded = description.classList.toggle('expanded');
    button.textContent = expanded ? t('less') : t('more');
    button.setAttribute('aria-expanded', String(expanded));
  };
  function renderCart() {
    let total = 0;
    $('cart').innerHTML = Object.entries(cart).map(([id, q]) => {
      const p = products.find(x => x.id === id); if (!p) return '';
      total += q * p.price;
      return `<div class="row between item"><span>${esc(p.name)}</span><span class="row"><button class="soft" type="button" data-act="dec" data-id="${esc(id)}" aria-label="Quitar uno">−</button><span class="qty">${q}</span><button class="soft" type="button" data-act="add" data-id="${esc(id)}" aria-label="Agregar uno">+</button></span><b>${money(q * p.price)}</b></div>`;
    }).join('') || `<p class="muted">${t('emptyCart')}</p>`;
    $('total').textContent = money(total);
    refreshQuote();
  }
  actions.add = d => { cart[d.id] = Math.min(99, (cart[d.id] || 0) + 1); renderCart(); };
  actions.dec = d => { cart[d.id] = (cart[d.id] || 0) - 1; if (cart[d.id] <= 0) delete cart[d.id]; renderCart(); };

  $('gps').onclick = () => {
    if (!navigator.geolocation) return ($('gpsmsg').textContent = t('noGps'));
    $('gpsmsg').textContent = t('gettingLocation');
    navigator.geolocation.getCurrentPosition(
      p => { coords = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) }; $('gpsmsg').textContent = t('locationOk') + coords.accuracy + t('meters'); refreshQuote(); },
      () => ($('gpsmsg').textContent = t('locationFailed')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  $('maps').onclick = () => {
    const q = coords ? `${coords.lat},${coords.lng}` : $('address').value.trim();
    window.open(q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : 'https://www.google.com/maps/', '_blank', 'noopener');
  };

  $('order').onclick = async () => {
    if (sending) return;
    const items = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
    if (!items.length) return alert(t('addProducts'));
    if (!$('customer').value.trim() || !$('phone').value.trim()) return alert(t('completeContact'));
    const deliveryType = $('deliveryType').value, paymentMethod = $('paymentMethod').value;
    if (deliveryType === 'delivery' && !coords && !$('address').value.trim()) return alert(t('enterAddress'));
    if (!paymentMethod) return alert(t('paymentUnavailable'));
    sending = true; $('order').disabled = true; $('msg').textContent = t('sending');
    try {
      const d = await api('/api/orders', { method: 'POST', body: JSON.stringify({ businessId: B, customer: $('customer').value.trim(), phone: $('phone').value.trim(), deliveryType, paymentMethod, address: $('address').value.trim(), location: coords, items, notes: $('notes').value.trim() }) });
      localStorage.setItem(LAST, JSON.stringify({ id: d.order.id, t: d.trackToken, code: d.deliveryCode }));
      if (d.checkoutUrl) { location.assign(d.checkoutUrl); return; }
      if (d.zelle) $('msg').innerHTML = `<p class="success">${esc(t('zellePayTo'))}: <b>${esc(d.zelle.contact)}</b><br>${esc(d.zelle.instructions || '')}<br>${esc(t('zelleWait'))}</p>`;
      else $('msg').innerHTML = `<p class="success">${t('orderReceived')}</p>`;
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
        const statusText = ({ new: t('received'), preparing: t('preparing'), ready: t('ready'), delivered: t('delivered'), cancelled: t('cancelled') })[d.status] || STATUS[d.status] || d.status;
        const paymentLabel = d.paymentStatus === 'paid' ? (language === 'en' ? 'Paid' : language === 'ht' ? 'Peye' : 'Pagado') : (language === 'en' ? 'Payment pending' : language === 'ht' ? 'Peman an an atant' : 'Pago pendiente');
        const fulfillLabel = d.deliveryType === 'pickup' ? t('pickup') : d.deliveryType === 'delivery' ? t('delivery') : '';
        $('tracker').innerHTML = `<h2>📦 ${t('tracking')} #${esc(d.id.slice(0, 8))}</h2><p>${esc(statusText)}${fulfillLabel ? ' · ' + esc(fulfillLabel) : ''}${d.driverName ? ` · ${t('driver')}: ${esc(d.driverName)}` : ''} · ${money(d.total,d.currency)}</p><p>${esc(paymentLabel)} · ${esc(d.paymentMethod || '')}${d.deliveryFee ? ` · ${esc(t('deliveryFee'))}: ${money(d.deliveryFee,d.currency)}` : ''}</p>${closed ? '' : `<div class="codebox">🔐 ${t('deliveryCode')}: <b>${esc(d.deliveryCode)}</b><br><small>${t('giveCode')}</small></div>`}${closed ? `<button class="soft" type="button" data-act="clearTrack">${t('close')}</button>` : ''}`;
        if (closed) clearInterval(trackTimer);
      } catch (e) {
        if (/no encontrado/i.test(e.message)) { localStorage.removeItem(LAST); clearInterval(trackTimer); $('tracker').classList.add('hidden'); }
      }
    };
    tick(); trackTimer = setInterval(tick, 10000);
  }
  actions.clearTrack = () => { localStorage.removeItem(LAST); clearInterval(trackTimer); $('tracker').classList.add('hidden'); };

  async function ask() {
    const q = $('question').value.trim(); if (!q) return alert(t('askRequired'));
    $('ask').disabled = true;
    try {
      const d = await api('/api/ai', { method: 'POST', body: JSON.stringify({ businessId: B, message: q, language }) });
      $('chat').innerHTML += `<p><b>${t('you')}:</b> ${esc(q)}</p><p><b>${t('assistant')}:</b> ${esc(d.reply)}</p>`;
      $('question').value = ''; $('chat').scrollTop = $('chat').scrollHeight;
    } catch (e) { $('chat').innerHTML += `<p class="error">${esc(e.message)}</p>`; }
    finally { $('ask').disabled = false; }
  }
  $('ask').onclick = ask;
  $('question').addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });

  boot().catch(e => ($('msg').textContent = '❌ ' + e.message));
})();
