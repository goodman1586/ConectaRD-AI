/* Utilidades compartidas. Sin onclick inline: se usa delegación con data-act / data-chg. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const money = n => 'RD$' + Number(n || 0).toLocaleString('es-DO');
  const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
  const waNumber = raw => {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 10 && /^(809|829|849)/.test(d)) d = '1' + d; // prefijo de RD
    return d;
  };
  const STATUS = { new: 'Recibido', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };

  function makeApi(getToken, onAuthFail) {
    return async (url, opts = {}) => {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      const t = getToken && getToken();
      if (t) headers.Authorization = 'Bearer ' + t;
      const r = await fetch(url, { ...opts, headers });
      const d = await r.json().catch(() => ({ message: 'Respuesta inválida del servidor' }));
      if (r.status === 401 && t && onAuthFail) onAuthFail();
      if (!r.ok) throw new Error(d.message || 'Error');
      return d;
    };
  }

  function beep() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.35);
    } catch {}
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  async function askNotifyPermission(btn) {
    if (!('Notification' in window)) { if (btn) btn.textContent = '🔕 No compatible'; return; }
    const p = await Notification.requestPermission();
    if (btn) btn.textContent = p === 'granted' ? '🔔 Notificaciones activas' : '🔕 Notificaciones bloqueadas';
  }
  async function notify(title, body) {
    beep();
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body });
      else new Notification(title, { body });
    } catch { try { new Notification(title, { body }); } catch {} }
  }

  /* Re-dibuja solo si cambió el contenido (evita borrar lo que el usuario escribe). */
  function renderIfChanged(el, html) {
    if (el.dataset.sig === html) return false;
    const typed = {};
    el.querySelectorAll('input[id],textarea[id],select[id]').forEach(i => { typed[i.id] = i.value; });
    const focusId = document.activeElement?.id;
    el.innerHTML = html; el.dataset.sig = html;
    for (const [id, v] of Object.entries(typed)) { const i = $(id); if (i && v !== '' && !i.dataset.keep) i.value = v; }
    if (focusId && $(focusId)) $(focusId).focus();
    return true;
  }

  const actions = {}, changes = {};
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act](b.dataset, b);
  });
  document.addEventListener('change', e => {
    const b = e.target.closest('[data-chg]');
    if (b && changes[b.dataset.chg]) changes[b.dataset.chg](b.dataset, b);
  });

  window.CRD = { $, esc, money, safeUrl, waNumber, STATUS, makeApi, beep, notify, askNotifyPermission, renderIfChanged, actions, changes };
})();
