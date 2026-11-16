(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'exyu-radio-pwa-v1';
  const CATALOG_KEY = 'exyu-radio-catalog-v2';
  const APP_VERSION = 4;
  const THEMES = new Set(['neon', 'midnight', 'gold', 'ocean', 'sunset', 'forest', 'light']);
  const COUNTRIES = [
    {code:'MK',name:'Makedonija',icon:'🇲🇰'},
    {code:'RS',name:'Srbija',icon:'🇷🇸'},
    {code:'BA',name:'Bosna i Hercegovina',icon:'🇧🇦'},
    {code:'HR',name:'Hrvatska',icon:'🇭🇷'},
    {code:'ME',name:'Crna Gora',icon:'🇲🇪'},
    {code:'SI',name:'Slovenija',icon:'🇸🇮'},
    {code:'DE',name:'Nemačka',icon:'🇩🇪'}
  ];
  const COUNTRY_CODES = COUNTRIES.map(c => c.code);
  const COUNTRY_SET = new Set(COUNTRY_CODES);
  const VIEWS = new Set(['all', 'yu', ...COUNTRY_CODES, 'favorites', 'recent', 'custom']);
  const HEADINGS = {all:'Sve radio-stanice',yu:'Sve EX-YU stanice',MK:'Makedonske stanice',RS:'Srpske stanice',BA:'Bosanske i hercegovačke stanice',HR:'Hrvatske stanice',ME:'Crnogorske stanice',SI:'Slovenačke stanice',DE:'Nemačke stanice',favorites:'Omiljene stanice',recent:'Nedavno slušane',custom:'Moje stanice'};
  const SERVERS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
  const PAGE_SIZE = 60;
  const DEFAULT_SETTINGS = {theme:'neon', volume:65, rememberLast:true, lastStationID:null, favorites:[], recent:[], custom:[]};
  const audio = $('audio');
  const state = {view:'all', query:'', page:1, catalog:[], custom:[], favorites:new Set(), recent:[], current:null, playing:false, loading:false, loaded:false, countryErrors:[], fetchedCountries:0, failedStations:new Set(), currentError:'', logoError:new Set(), settings:{...DEFAULT_SETTINGS}, deferredInstall:null, toastTimer:null, streamFallbackTried:false, updateAvailable:false, updateChecking:false, lastUpdateCheck:0};

  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); }
  function safeURL(s) { try { const u = new URL(String(s ?? '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
  function safeLogo(s) { const url = safeURL(s); return url && url.startsWith('https:') ? url : ''; }
  function countryName(code) { return COUNTRIES.find(c => c.code === code)?.name || 'EX-YU'; }
  function stationIcon(code) { return COUNTRIES.find(c => c.code === code)?.icon || '📻'; }
  function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3400); }

  function readSettings() {
    try {
      const data = JSON.parse(safeGet(STORAGE_KEY) || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      state.settings = {
        theme: THEMES.has(data.theme) ? data.theme : 'neon',
        volume: Number.isFinite(Number(data.volume)) ? Math.max(0, Math.min(100, Math.round(Number(data.volume)))) : 65,
        rememberLast: data.rememberLast !== false,
        lastStationID: typeof data.lastStationID === 'string' ? data.lastStationID : null,
        favorites: Array.isArray(data.favorites) ? data.favorites.filter(x => typeof x === 'string').slice(0, 5000) : [],
        recent: Array.isArray(data.recent) ? data.recent.filter(x => typeof x === 'string').slice(0, 80) : [],
        custom: Array.isArray(data.custom) ? data.custom.map(normalizeCustom).filter(Boolean).slice(0, 500) : []
      };
    } catch { state.settings = {...DEFAULT_SETTINGS}; }
    state.favorites = new Set(state.settings.favorites);
    state.recent = state.settings.recent.slice();
    state.custom = state.settings.custom.slice();
  }
  function persist() {
    state.settings.favorites = [...state.favorites].slice(0, 5000);
    state.settings.recent = state.recent.slice(0, 80);
    state.settings.custom = state.custom;
    if (!safeSet(STORAGE_KEY, JSON.stringify(state.settings))) toast('Browser ne dozvoljava čuvanje podešavanja.');
  }
  function normalizeCustom(item) {
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name ?? '').trim().slice(0, 90);
    const url = safeURL(item.url_resolved || item.url);
    if (!name || !url || !COUNTRY_SET.has(item.countrycode)) return null;
    const id = String(item.stationuuid || '').trim().slice(0, 160);
    if (!id || !id.startsWith('user-')) return null;
    return {stationuuid:id, name, countrycode:item.countrycode, url_resolved:url, url, favicon:safeLogo(item.favicon), state:'', tags:'Moja stanica', codec:'', custom:true};
  }
  function normalizeCatalog(item) {
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name ?? '').trim().slice(0, 100);
    const countrycode = String(item.countrycode ?? '').toUpperCase();
    const id = String(item.stationuuid ?? '').trim().slice(0, 160);
    const url = safeURL(item.url_resolved || item.url);
    if (!id || !name || !url || !COUNTRY_SET.has(countrycode)) return null;
    const lastcheckok = item.lastcheckok === 1 || item.lastcheckok === true || item.lastcheckok === '1';
    return {stationuuid:id, name, countrycode, url_resolved:url, url:safeURL(item.url) || url, favicon:safeLogo(item.favicon), state:String(item.state ?? '').slice(0, 80), tags:String(item.tags ?? '').slice(0, 130), codec:String(item.codec ?? '').slice(0, 25), custom:false, votes:Number(item.votes)||0, lastcheckok};
  }
  function allStations() { return [...state.custom, ...state.catalog]; }
  function findStation(id) { return allStations().find(s => s.stationuuid === id) || null; }

  function applyTheme(theme, save=true) {
    if (!THEMES.has(theme)) theme = 'neon';
    state.settings.theme = theme;
    document.body.dataset.theme = theme;
    $('themeGrid').querySelectorAll('[data-theme-choice]').forEach(el => {
      const active = el.dataset.themeChoice === theme;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    });
    const color = theme === 'light' ? '#edf4fa' : ({neon:'#090e20',midnight:'#080b14',gold:'#100d0c',ocean:'#061424',sunset:'#170d1e',forest:'#081913'})[theme];
    document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
    if (save) persist();
  }
  function setVolume(value, save=true) {
    const volume = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    state.settings.volume = volume;
    audio.volume = volume / 100;
    ['volumeInput', 'settingsVolume', 'sheetVolume'].forEach(id => { $(id).value = String(volume); });
    $('volumeLabel').textContent = volume + '%';
    $('settingsVolumeLabel').textContent = volume + '%';
    if (save) persist();
  }

  function setView(view, scrollToList=true) {
    if (!VIEWS.has(view)) view = 'all';
    state.view = view;
    state.page = 1;
    $('countrySelect').value = view;
    document.querySelectorAll('[data-view]').forEach(el => {
      const active = el.dataset.view === view;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    $('viewHeading').firstChild.textContent = HEADINGS[view] + ' ';
    renderStations();
    if (scrollToList && window.innerWidth <= 750) $('viewHeading').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function visibleStations() {
    let items = allStations();
    if (COUNTRY_SET.has(state.view)) items = items.filter(s => s.countrycode === state.view);
    if (state.view === 'yu') items = items.filter(s => s.countrycode !== 'DE');
    if (state.view === 'favorites') items = items.filter(s => state.favorites.has(s.stationuuid));
    if (state.view === 'recent') items = items.filter(s => state.recent.includes(s.stationuuid));
    if (state.view === 'custom') items = items.filter(s => s.custom);
    if (state.view === 'recent') items.sort((a,b) => state.recent.indexOf(a.stationuuid) - state.recent.indexOf(b.stationuuid));
    else items.sort((a,b) => (a.custom === b.custom ? a.name.localeCompare(b.name, 'sr') : a.custom ? -1 : 1));
    const term = state.query.toLocaleLowerCase();
    if (term) items = items.filter(s => [s.name, s.tags, s.state, countryName(s.countrycode)].some(x => x.toLocaleLowerCase().includes(term)));
    return items;
  }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`; }
  function artHTML(s) {
    const logo = s.favicon && !state.logoError.has(s.stationuuid) ? safeLogo(s.favicon) : '';
    return logo ? `<img data-station-image="${esc(s.stationuuid)}" src="${esc(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span aria-hidden="true">${stationIcon(s.countrycode)}</span>`;
  }
  function cardHTML(s) {
    const liked = state.favorites.has(s.stationuuid);
    const current = state.current?.stationuuid === s.stationuuid;
    const unavailable = state.failedStations.has(s.stationuuid);
    const meta = unavailable ? `${countryName(s.countrycode)} · ⚠ pokušaj ponovo` : [countryName(s.countrycode), s.state || (s.codec ? s.codec.toUpperCase() : 'Uživo')].filter(Boolean).join(' · ');
    return `<article class="station-card ${current ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-station="${esc(s.stationuuid)}"><div class="station-art">${artHTML(s)}</div><button class="station-body" data-action="play" title="Pusti ${esc(s.name)}"><span><strong class="station-name">${esc(s.name)}</strong><small class="station-sub">${esc(meta)}</small></span></button><button class="station-fav ${liked ? 'is-favorite' : ''}" data-action="favorite" aria-label="${liked ? 'Ukloni iz omiljenih' : 'Dodaj u omiljene'}" title="Omiljene">${icon('heart')}</button>${s.custom ? `<button class="station-delete" data-action="delete" aria-label="Obriši moju stanicu" title="Obriši">${icon('trash')}</button>` : ''}</article>`;
  }
  function renderStations() {
    const items = visibleStations();
    $('headCount').textContent = String(items.length);
    const list = $('stationList');
    const shown = items.slice(0, PAGE_SIZE * state.page);
    if (!items.length) {
      let heading, detail, button='';
      if (state.loading && !state.loaded) { heading='Učitavamo stanice...'; detail='Povezujemo se sa katalogom radio-stanica.'; }
      else if (state.query) { heading='Nema rezultata'; detail='Probaj neki drugi naziv ili obriši pretragu.'; }
      else if (state.view === 'favorites') { heading='Još nema omiljenih'; detail='Klikni na srce pored bilo koje stanice.'; }
      else if (state.view === 'recent') { heading='Nisi još slušao stanice'; detail='Pusti neku stanicu i pojaviće se ovde.'; }
      else if (state.view === 'custom') { heading='Dodaj svoju prvu stanicu'; detail='Unesi direktan link do internet radio-streama.'; button='<button class="btn primary" data-empty-add="1">+ Dodaj stanicu</button>'; }
      else if (state.loading) { heading='Učitavamo ovu zemlju...'; detail='Stanice pristižu iz radio-kataloga. Sačekaj trenutak.'; }
      else if (!state.loaded || state.countryErrors.length) { heading='Katalog nije dostupan'; detail='Proveri internet i pritisni Osveži. Svoje stanice su i dalje dostupne.'; }
      else { heading='Nema stanica u katalogu'; detail='Pokušaj da osvežiš katalog.'; }
      list.innerHTML = `<div class="empty-state">${state.loading ? '<span class="loader"></span>' : `<span style="font-size:30px">📻</span>`}<strong>${esc(heading)}</strong><p>${esc(detail)}</p>${button}</div>`;
    } else list.innerHTML = shown.map(cardHTML).join('');
    $('loadMoreBtn').hidden = shown.length >= items.length;
    $('loadMoreBtn').textContent = `Prikaži još (${items.length - shown.length} preostalih)`;
    if (state.loading) $('catalogStatus').textContent = `Osvežavamo ${state.fetchedCountries}/${COUNTRY_CODES.length} država · ${items.length} stanica`;
    else if (state.countryErrors.length) $('catalogStatus').textContent = `Prikazujemo ${items.length} stanica · neke stanice nisu učitane`;
    else $('catalogStatus').textContent = `${items.length} radio-stanica · EX-YU + Nemačka · izaberi za slušanje`;
    const note = $('catalogNote');
    note.hidden = !state.countryErrors.length;
    if (state.countryErrors.length) note.textContent = `Trenutno nije uspelo učitavanje: ${state.countryErrors.map(code => countryName(code)).join(', ')}. Prikazane su dostupne i ranije sačuvane stanice. Pritisni Osveži za novi pokušaj.`;
    list.querySelectorAll('img[data-station-image]').forEach(img => img.addEventListener('error', () => {
      const id = img.dataset.stationImage; state.logoError.add(id); const parent = img.parentElement;
      if (parent) parent.innerHTML = `<span aria-hidden="true">${stationIcon(findStation(id)?.countrycode)}</span>`;
    }, {once:true}));
  }

  function setPlayStatus(message, error=false) {
    state.currentError = error ? message : '';
    $('playStatus').textContent = message;
    $('sheetStatus').textContent = message;
    $('miniMeta').textContent = message;
  }
  function playerArtwork(s, fallbackImg) {
    const url = s && !state.logoError.has(s.stationuuid) ? safeLogo(s.favicon) : '';
    return url || fallbackImg;
  }
  function updateMediaSession(s) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:s?.name || 'EX-YU Radio', artist:s ? `${countryName(s.countrycode)} · internet radio` : 'Aleksandar Aleksovski', album:'EX-YU Radio',
        artwork:[{src:playerArtwork(s, new URL('./assets/icon-512.png', location.href).href), sizes:'512x512', type:'image/png'}]
      });
      navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
    } catch { /* Unsupported audio metadata format. */ }
  }
  function updatePlayer() {
    const s = state.current;
    const name = s?.name || 'EX-YU Radio';
    const meta = s ? `${stationIcon(s.countrycode)} ${countryName(s.countrycode)} · uživo` : 'Izaberi stanicu i uživaj';
    $('nowName').textContent = name;
    $('nowMeta').textContent = meta;
    $('miniName').textContent = name;
    $('sheetName').textContent = name;
    $('sheetMeta').textContent = meta;
    const fallback = new URL('./assets/icon-512.png', location.href).href;
    const art = playerArtwork(s, fallback);
    $('bigArtwork').querySelector('img').src = art;
    $('miniArt').src = art;
    $('sheetArt').src = art;
    ['bigArtwork', 'miniArt', 'sheetArt'].forEach(id => $(id).querySelectorAll('img').forEach(img => img.onerror = () => { img.onerror = null; img.src = fallback; }));
    document.querySelectorAll('[data-player="toggle"]').forEach(btn => {
      btn.innerHTML = icon(state.playing ? 'pause' : 'play');
      btn.dataset.isPlaying = String(state.playing);
      btn.setAttribute('aria-label', state.playing ? 'Pauziraj' : 'Pusti');
    });
    $('equalizer').classList.toggle('playing', state.playing);
    updateMediaSession(s);
    document.querySelectorAll('.station-card').forEach(card => card.classList.toggle('selected',card.dataset.station === s?.stationuuid));
  }
  function recordPlay(id) {
    state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 80);
    persist();
  }
  async function startStation(s) {
    if (!s) { toast('Prvo izaberi radio-stanicu.'); return; }
    const stream = safeURL(s.url_resolved || s.url);
    if (!stream) { toast('Neispravan link do streama.'); return; }
    state.current = s;
    state.streamFallbackTried = false;
    state.failedStations.delete(s.stationuuid);
    state.settings.lastStationID = state.settings.rememberLast ? s.stationuuid : null;
    persist();
    audio.pause();
    state.playing = false;
    audio.src = stream;
    audio.load();
    setPlayStatus('Povezivanje sa stanicom...');
    updatePlayer();
    renderStations();
    try {
      await audio.play();
      // The 'playing' event will update status when bytes actually arrive.
      recordPlay(s.stationuuid);
    } catch (error) {
      state.playing = false;
      state.failedStations.add(s.stationuuid);
      setPlayStatus('Nema zvuka · pokušaj drugi stream ili stanicu', true);
      updatePlayer();
      renderStations();
      toast('Ovaj stream trenutno ne može da se pusti.');
    }
  }
  async function togglePlayer() {
    if (!state.current) {
      const s = visibleStations()[0] || allStations()[0];
      if (s) await startStation(s); else toast('Nema učitanih stanica.');
      return;
    }
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); } catch { setPlayStatus('Stream trenutno nije dostupan', true); toast('Pokušaj drugu stanicu.'); }
  }
  function skip(direction) {
    let list = visibleStations();
    if (!list.length || (state.current && !list.some(s => s.stationuuid === state.current.stationuuid))) {
      list = allStations().filter(s => s.countrycode === state.current?.countrycode);
      if (!list.length) list = allStations();
    }
    if (!list.length) return;
    const index = Math.max(0,list.findIndex(s => s.stationuuid === state.current?.stationuuid));
    startStation(list[(index + direction + list.length) % list.length]);
  }
  function randomStation() {
    const list = visibleStations().length ? visibleStations() : allStations();
    if (!list.length) { toast('Učitavamo stanice. Pokušaj za trenutak.'); return; }
    startStation(list[Math.floor(Math.random() * list.length)]);
  }
  function toggleFavorite(id) {
    if (state.favorites.has(id)) { state.favorites.delete(id); toast('Uklonjeno iz omiljenih'); }
    else { state.favorites.add(id); toast('Dodato u omiljene ♡'); }
    persist(); renderStations();
  }
  function deleteCustom(id) {
    const s = state.custom.find(x => x.stationuuid === id);
    if (!s || !confirm(`Obrisati tvoju stanicu „${s.name}“?`)) return;
    state.custom = state.custom.filter(x => x.stationuuid !== id);
    state.favorites.delete(id);
    state.recent = state.recent.filter(x => x !== id);
    if (state.current?.stationuuid === id) { audio.pause(); audio.removeAttribute('src'); audio.load(); state.current = null; state.playing = false; updatePlayer(); }
    persist(); renderStations(); toast('Stanica obrisana.');
  }

  async function fetchCountry(country) {
    let lastError;
    for (const server of SERVERS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const url = `${server}/json/stations/bycountrycodeexact/${country}?hidebroken=true&limit=10000&order=name`;
        const res = await fetch(url, {signal:controller.signal, cache:'no-store'});
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Neispravan odgovor kataloga');
        return data.map(normalizeCatalog).filter(Boolean);
      } catch (error) { lastError = error; }
      finally { clearTimeout(timeout); }
    }
    throw lastError || new Error('Ne mogu da učitam katalog');
  }
  function cachedCatalog() {
    try {
      const saved = JSON.parse(safeGet(CATALOG_KEY) || 'null');
      if (!saved || !Array.isArray(saved.stations)) return [];
      return saved.stations.map(normalizeCatalog).filter(Boolean);
    } catch { return []; }
  }
  async function refreshCatalog() {
    if (state.loading) return;
    state.loading = true; state.countryErrors = []; state.fetchedCountries = 0;
    $('refreshBtn').disabled = true; renderStations();
    const current = new Map(state.catalog.map(s => [s.stationuuid,s]));
    const results = await Promise.allSettled(COUNTRY_CODES.map(async code => {
      try {
        const incoming = await fetchCountry(code);
        // Replace this country's outdated entries; preserve other countries and users' favorites.
        for (const [id, s] of current) if (s.countrycode === code) current.delete(id);
        for (const s of incoming) current.set(s.stationuuid,s);
        state.catalog = [...current.values()];
        state.loaded = true;
        return {country:code,count:incoming.length};
      } finally {
        state.fetchedCountries++;
        renderStations();
      }
    }));
    state.countryErrors = results.flatMap((result,i) => result.status === 'rejected' ? [COUNTRY_CODES[i]] : []);
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    if (successCount) safeSet(CATALOG_KEY, JSON.stringify({time:Date.now(),stations:state.catalog}));
    state.loaded = true; state.loading = false; $('refreshBtn').disabled = false;
    if (!successCount) toast('Katalog trenutno nije dostupan. Proveri internet.');
    else if (state.countryErrors.length) toast('Deo zemalja je učitan. Pokušaj ponovo za ostale.');
    else toast(`Učitano ${state.catalog.length} radio-stanica iz 7 zemalja.`);
    restoreLastStation(); renderStations();
  }
  function restoreLastStation() {
    if (!state.settings.rememberLast || !state.settings.lastStationID || state.current) return;
    const s = findStation(state.settings.lastStationID);
    if (s) { state.current = s; setPlayStatus('Spremno · pritisni ▶ za slušanje'); updatePlayer(); }
  }

  function openDialog(id) {
    const modal = $(id);
    if (!modal || modal.open) return;
    if (id === 'installDialog') updateInstall();
    modal.showModal();
  }
  function closeDialog(id) { const modal = $(id); if (modal?.open) modal.close(); }
  function showSettings() {
    applyTheme(state.settings.theme,false);
    setVolume(state.settings.volume,false);
    $('rememberLast').checked = state.settings.rememberLast;
    openDialog('settingsDialog');
  }
  function addCustomStation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const url = safeURL(data.get('url'));
    if (!url) { toast('Unesi ispravan direktan link do streama.'); return; }
    const id = 'user-' + (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    const s = normalizeCustom({stationuuid:id,name:data.get('name'),countrycode:data.get('countrycode'),url_resolved:url, favicon:data.get('favicon')});
    if (!s) { toast('Proveri naziv, zemlju i link do streama.'); return; }
    if (state.custom.some(x => x.url_resolved === url)) { toast('Ova stanica je već dodata.'); return; }
    if (url.startsWith('http:')) toast('HTTP stream možda neće raditi na HTTPS stranici.');
    state.custom.unshift(s);
    persist();
    closeDialog('addDialog');
    form.reset();
    setView('custom',false);
    toast(`Dodato: ${s.name}`);
  }
  function exportSettings() {
    persist();
    const data = {...state.settings, backupVersion:1, exportedAt:new Date().toISOString(), app:'EX-YU Radio'};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');a.href = url;a.download='EX-YU-Radio-Backup.json';document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Sačuvana rezervna kopija podešavanja.');
  }
  async function importSettings(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Datoteka je prevelika.'); return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || data.app !== 'EX-YU Radio') throw new Error('Nevažeća datoteka');
      const old = {...state.settings};
      state.settings = {
        theme:THEMES.has(data.theme) ? data.theme : old.theme,
        volume:Number.isFinite(Number(data.volume)) ? Math.max(0,Math.min(100,Math.round(Number(data.volume)))) : old.volume,
        rememberLast:data.rememberLast !== false,
        lastStationID:typeof data.lastStationID === 'string' ? data.lastStationID : null,
        favorites:Array.isArray(data.favorites) ? data.favorites.filter(x => typeof x === 'string').slice(0,5000) : old.favorites,
        recent:Array.isArray(data.recent) ? data.recent.filter(x => typeof x === 'string').slice(0,80) : old.recent,
        custom:Array.isArray(data.custom) ? data.custom.map(normalizeCustom).filter(Boolean).slice(0,500) : old.custom
      };
      state.favorites = new Set(state.settings.favorites);
      state.recent = state.settings.recent.slice();
      state.custom = state.settings.custom.slice();
      applyTheme(state.settings.theme,false); setVolume(state.settings.volume,false); persist();
      restoreLastStation(); setView(state.view,false);
      toast('Podešavanja, teme i stanice su vraćeni.');
    } catch { toast('Ova datoteka nije ispravna EX-YU Radio kopija.'); }
  }

  function installURL() { return new URL('./', window.location.href).href; }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isInstalled() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function updateInstall() {
    const url = installURL();
    $('appLink').value = url;
    const qr = $('qrImage');
    $('qrFallback').hidden = true; qr.hidden = false;
    qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(url);
    qr.onerror = () => { qr.hidden = true; $('qrFallback').hidden = false; };
    const btn = $('nativeInstallBtn');
    btn.hidden = !!isInstalled();
    btn.disabled = false;
    btn.textContent = state.deferredInstall ? 'Instaliraj aplikaciju' : isIOS() ? 'Pokaži korake za iPhone' : 'Kako da instaliram?';
  }
  async function copyAppLink() {
    try { await navigator.clipboard.writeText(installURL()); toast('Link kopiran!'); }
    catch { $('appLink').focus(); $('appLink').select(); toast('Označen link — kopiraj ga ručno.'); }
  }
  async function installNative() {
    const prompt = state.deferredInstall;
    if (!prompt) {
      const guide = document.querySelector(isIOS() ? '.install-instructions>div:first-child' : '.install-instructions>div:last-child');
      if (guide) {
        guide.classList.remove('guide-highlight');
        void guide.offsetWidth;
        guide.classList.add('guide-highlight');
        guide.scrollIntoView({behavior:'smooth',block:'center'});
      }
      toast(isIOS() ? 'iPhone: Safari → Deli (Share) → Dodaj na početni ekran. Apple ne podržava direktno Install dugme.' : 'Chrome: meni ⋮ → Instaliraj aplikaciju. Ako nema te opcije, izaberi Dodaj na početni ekran.');
      return;
    }
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* Browser may close the prompt. */ }
    state.deferredInstall = null;
    $('nativeInstallBtn').hidden = true;
  }

  function showUpdateAvailability(available) {
    state.updateAvailable = available;
    $('updateBanner').hidden = !available;
    document.querySelectorAll('[data-update-check]').forEach(btn => {
      btn.classList.toggle('update-ready', available);
      btn.setAttribute('aria-label', available ? 'Instaliraj novu verziju' : 'Proveri ažuriranje');
      btn.title = available ? 'Nova verzija je spremna — ažuriraj' : 'Proveri ažuriranje';
    });
  }
  async function checkForUpdates(manual=false) {
    if (state.updateChecking) return;
    state.updateChecking = true;
    state.lastUpdateCheck = Date.now();
    try {
      const url = new URL('./version.json', window.location.href);
      url.searchParams.set('_check', String(Date.now()));
      const response = await fetch(url.href, {cache:'no-store'});
      if (!response.ok) throw new Error('Verzija nije dostupna');
      const latest = Number((await response.json()).version);
      if (!Number.isInteger(latest) || latest < 1) throw new Error('Nevažeća verzija');
      if (latest > APP_VERSION) {
        showUpdateAvailability(true);
        if (manual) toast('Nova verzija je spremna! Pritisni Ažuriraj sada.');
      } else {
        showUpdateAvailability(false);
        if (manual) toast(`Već imaš najnoviju verziju (v${APP_VERSION}).`);
      }
    } catch {
      if (manual) toast('Nije uspela provera. Proveri internet i pokušaj ponovo.');
    } finally { state.updateChecking = false; }
  }
  async function applyUpdate() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) await registration.update();
      }
    } catch { /* Navigacija svakako proverava najnoviju verziju. */ }
    const fresh = new URL('./', location.href);
    fresh.searchParams.set('update', String(Date.now()));
    location.replace(fresh.href);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const view = event.target.closest('[data-view]');
      if (view) { setView(view.dataset.view); return; }
      const open = event.target.closest('[data-open]');
      if (open) { open.dataset.open === 'settings' ? showSettings() : openDialog('installDialog'); return; }
      const close = event.target.closest('[data-close]');
      if (close) { closeDialog(close.dataset.close); return; }
      const player = event.target.closest('[data-player]');
      if (player) { const action=player.dataset.player; if (action==='toggle') togglePlayer(); if (action==='next') skip(1); if (action==='prev') skip(-1); return; }
      const cardAction = event.target.closest('[data-action]');
      if (cardAction) {
        const card = cardAction.closest('[data-station]');
        const id = card?.dataset.station;
        if (!id) return;
        if (cardAction.dataset.action === 'play') startStation(findStation(id));
        if (cardAction.dataset.action === 'favorite') toggleFavorite(id);
        if (cardAction.dataset.action === 'delete') deleteCustom(id);
      }
      if (event.target.closest('[data-empty-add]')) openDialog('addDialog');
    });
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    });
    $('surpriseBtn').addEventListener('click', randomStation);
    $('addStationBtn').addEventListener('click', () => openDialog('addDialog'));
    $('settingsAddBtn').addEventListener('click', () => { closeDialog('settingsDialog'); openDialog('addDialog'); });
    $('refreshBtn').addEventListener('click', refreshCatalog);
    $('countrySelect').addEventListener('change', event => setView(event.target.value));
    $('searchInput').addEventListener('input', event => { state.query = event.target.value.trim();state.page=1;renderStations(); });
    $('loadMoreBtn').addEventListener('click', () => { state.page++;renderStations(); });
    $('themeGrid').addEventListener('click', event => {
      const choice = event.target.closest('[data-theme-choice]');
      if (choice) { applyTheme(choice.dataset.themeChoice); toast('Tema promenjena.'); }
    });
    ['volumeInput','settingsVolume','sheetVolume'].forEach(id => $(id).addEventListener('input',event => setVolume(event.target.value)));
    $('rememberLast').addEventListener('change',event => { state.settings.rememberLast = event.target.checked; if (!event.target.checked) state.settings.lastStationID=null; persist(); });
    $('addStationForm').addEventListener('submit',addCustomStation);
    $('exportBtn').addEventListener('click',exportSettings);
    $('importBtn').addEventListener('click', () => $('importInput').click());
    $('importInput').addEventListener('change',importSettings);
    $('copyLinkBtn').addEventListener('click',copyAppLink);
    $('nativeInstallBtn').addEventListener('click',installNative);
    $('applyUpdateBtn').addEventListener('click',applyUpdate);
    document.querySelectorAll('[data-update-check]').forEach(btn => btn.addEventListener('click', () => {
      if (state.updateAvailable) applyUpdate(); else checkForUpdates(true);
    }));
    $('miniStationOpen').addEventListener('click',() => openDialog('playingDialog'));
    $('miniArt').addEventListener('click',() => openDialog('playingDialog'));
    $('qrImage').addEventListener('error',() => { $('qrImage').hidden=true; $('qrFallback').hidden=false; });
    window.addEventListener('beforeinstallprompt',event => { event.preventDefault(); state.deferredInstall=event; updateInstall(); });
    window.addEventListener('appinstalled', () => { state.deferredInstall=null; toast('EX-YU Radio je instaliran!'); });
    audio.addEventListener('playing', () => { state.playing=true; if (state.current) state.failedStations.delete(state.current.stationuuid); setPlayStatus('🔊 Slušaš uživo');updatePlayer();renderStations(); });
    audio.addEventListener('pause', () => { state.playing=false; if (state.current) setPlayStatus('Pauzirano · pritisni ▶');updatePlayer(); });
    audio.addEventListener('waiting', () => { if (state.current) setPlayStatus('Učitavanje zvuka...'); });
    audio.addEventListener('stalled', () => { if (state.current) setPlayStatus('Sporo učitavanje streama...'); });
    audio.addEventListener('error', () => {
      if (!state.current) return;
      const fallback = safeURL(state.current.url);
      if (!state.streamFallbackTried && fallback && fallback !== audio.src) {
        state.streamFallbackTried=true;audio.src=fallback;audio.load();audio.play().catch(() => {});return;
      }
      state.playing=false;if (state.current) state.failedStations.add(state.current.stationuuid);setPlayStatus('Stream nije dostupan ili format nije podržan',true);updatePlayer();renderStations();
    });
    audio.addEventListener('ended', () => { state.playing=false;setPlayStatus('Emitovanje je prekinuto. Pokušaj ponovo.',true);updatePlayer(); });
    if ('mediaSession' in navigator) {
      for (const [name,fn] of Object.entries({play:() => togglePlayer(),pause:() => audio.pause(),previoustrack:() => skip(-1),nexttrack:() => skip(1),stop:() => {audio.pause();audio.currentTime=0;}})) {
        try { navigator.mediaSession.setActionHandler(name,fn); } catch { /* Not supported. */ }
      }
    }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
    window.addEventListener('load', () => setTimeout(() => checkForUpdates(), 1200));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - state.lastUpdateCheck > 10 * 60 * 1000) checkForUpdates();
    });
    setInterval(() => { if (!document.hidden) checkForUpdates(); }, 20 * 60 * 1000);
  }

  function init() {
    readSettings();
    applyTheme(state.settings.theme,false);
    setVolume(state.settings.volume,false);
    bindEvents();
    const bars = $('equalizer');
    for (let i=0;i<32;i++) {
      const bar=document.createElement('i');
      bar.style.setProperty('--height', (8+Math.abs(Math.sin(i*1.19)*Math.cos(i*.47))*42).toFixed(1)+'px');
      bar.style.setProperty('--delay', (-.07*(i%11)).toFixed(2)+'s');
      bars.appendChild(bar);
    }
    const cached = cachedCatalog();
    if (cached.length) { state.catalog=cached;state.loaded=true; }
    restoreLastStation();
    updatePlayer();
    setView('all',false);
    refreshCatalog();
  }
  init();
})();
