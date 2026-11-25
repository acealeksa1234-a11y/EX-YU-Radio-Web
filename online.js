/* EX-YU Radio: visible online users (rolling two-minute activity window).
 * CounterAPI anonymizes client identifiers; it counts recent unique visitors,
 * not exact listeners. The request itself also acts as a heartbeat.
 * No personal names, login, or private tokens are collected by this script.
 */
(() => {
  'use strict';
  const BASE = 'https://counterapi.com/api/exyu-radio-aleksovski-2026/online/active';
  const PERIOD = 45000;
  const count = document.getElementById('onlineUsersCount');
  const status = document.getElementById('onlineStatus');
  const stamp = document.getElementById('onlineUpdatedAt');
  const refreshButton = document.getElementById('refreshOnlineBtn');
  let pending = false;
  let lastRefresh = 0;

  function show(value, message, good) {
    if (count) count.textContent = value;
    if (status) status.textContent = message;
    if (stamp) stamp.textContent = good ? 'Ažurirano ' + new Date().toLocaleTimeString('sr-RS',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : 'Podatak trenutno nije dostupan';
    const badge = document.querySelector('.online-counter-link');
    if (badge) badge.title = good ? 'Približan broj korisnika aktivnih u poslednja 2 minuta' : 'Servis za statistiku trenutno ne odgovara';
  }

  async function checkLive() {
    if (pending) return;
    if (navigator.onLine === false) {
      show('—', 'Nema internet veze', false);
      return;
    }
    pending = true;
    lastRefresh = Date.now();
    if (refreshButton) refreshButton.disabled = true;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    try {
      // CounterAPI writes events immediately but updates unique/timeline
      // aggregations with a short delay. A single write response is NOT
      // the real-time unique user count; always read the aggregation separately.
      const trackResponse = await fetch(BASE, {method:'GET',mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl.signal});
      if (!trackResponse.ok) throw new Error('Counter heartbeat HTTP ' + trackResponse.status);
      await new Promise(resolve => setTimeout(resolve, 5500));
      const url = BASE + '?readOnly=true&timeline=2m&unique=true';
      const response = await fetch(url, {method:'GET',mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl.signal});
      if (!response.ok) throw new Error('Counter read HTTP ' + response.status);
      const body = await response.json();
      const value = Number(body?.value);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid counter value');
      show(value.toLocaleString('sr-RS'), 'Korisnici aktivni u poslednja 2 minuta', true);
    } catch (_) {
      show('—', 'Brojač trenutno nije dostupan', false);
    } finally {
      clearTimeout(timeout);
      pending = false;
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function shouldPing() {
    const audio = document.getElementById('audio');
    return !document.hidden || !!(audio && !audio.paused);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastRefresh > 7000) void checkLive();
  });
  window.addEventListener('online', () => void checkLive());
  window.addEventListener('offline', () => show('—', 'Nema internet veze', false));
  if (refreshButton) refreshButton.addEventListener('click', () => void checkLive());
  void checkLive();
  setInterval(() => { if (shouldPing()) void checkLive(); }, PERIOD);
})();
