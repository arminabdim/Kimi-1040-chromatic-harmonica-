/* App controller: wires UI, conversion pipeline and all exporters */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var $ = function (id) { return document.getElementById(id); };
  var state = { song: null, tab: [], transpose: 0, audioCtx: null, src: null, busy: false, results: [] };

  function t(k) { return K.i18n.t(k); }
  function status(msg, cls) {
    var s = $('status');
    s.textContent = msg;
    s.className = 'status' + (cls ? ' ' + cls : '');
  }
  function slug(s) {
    return String(s || 'song').replace(/[‌‏]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'song';
  }
  function download(bytes, name, mime) {
    var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* ---------- language ---------- */
  function applyLang() {
    var lang = K.i18n.lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) { n.placeholder = t(n.getAttribute('data-i18n-ph')); });
    $('langBtn').textContent = t('langBtn');
    renderLibOptions();
    G.dispatchEvent(new Event('k1040-lang'));
    if (state.song) { renderInfo(); renderPreview(); }
  }

  /* ---------- song loading ---------- */
  function setSong(song) {
    state.song = song;
    /* if the song already carries synced per-note lyrics, keep them;
       the textarea is only for adding/overriding lyrics */
    var hasLy = song.events.some(function (e) { return e.lyric; });
    $('lyrics').value = hasLy ? '' : (song.lyricsText || '');
    $('tempo').value = song.tempo;
    convert();
  }

  function currentEvents() {
    var song = state.song;
    var events = JSON.parse(JSON.stringify(song.events));
    var txt = $('lyrics').value.trim();
    if (txt) K.lyrics.align({ events: events }, txt);
    return events;
  }

  function convert() {
    if (!state.song) return;
    var song = state.song;
    song.tempo = Math.max(20, Math.min(300, +$('tempo').value || song.tempo || 120));
    var events = currentEvents();
    var midis = events.filter(function (e) { return e.type === 'note'; }).map(function (e) { return e.midi; });
    var sel = $('transpose').value;
    var tr = sel === 'auto'
      ? (song.autoTranspose != null ? song.autoTranspose : K.harp.autoTranspose(midis))
      : parseInt(sel, 10);
    events.forEach(function (e) { if (e.type === 'note') e.midi += tr; });
    state.transpose = tr;
    state.tab = K.harp.tabulate(events, { minSlide: $('minSlide').checked });
    renderInfo();
    renderPreview();
    status(t('done') + ' — ' + state.tab.filter(function (x) { return x.type === 'note'; }).length + ' ' + t('notes'), 'ok');
  }

  function renderInfo() {
    var s = state.song;
    if (!s) return;
    var notes = state.tab.filter(function (x) { return x.type === 'note'; });
    var beats = state.tab.reduce(function (a, e) { return a + e.beats; }, 0);
    var bars = Math.ceil(beats / K.music.beatsPerBar(s.ts));
    var lo = Math.min.apply(null, notes.map(function (n) { return n.midi; }).concat([999]));
    var hi = Math.max.apply(null, notes.map(function (n) { return n.midi; }).concat([-1]));
    var oorr = notes.filter(function (n) { return n.outOfRange; }).length;
    $('info').innerHTML =
      '<div class="i-row"><b>' + t('songHdr') + ':</b> ' + esc(s.title) + (s.titleEn && s.titleEn !== s.title ? ' — ' + esc(s.titleEn) : '') + '</div>' +
      '<div class="i-row"><b>' + t('source') + ':</b> ' + esc(s.source + (s.sourceDetail ? ' / ' + s.sourceDetail : '')) + '</div>' +
      '<div class="i-row"><b>' + t('tempo') + ':</b> ' + s.tempo + ' BPM &nbsp; <b>' + t('timesig') + ':</b> ' + s.ts[0] + '/' + s.ts[1] + '</div>' +
      '<div class="i-row"><b>' + t('notes') + ':</b> ' + notes.length + ' &nbsp; <b>' + t('bars') + ':</b> ' + bars + ' &nbsp; <b>' + t('transposeLbl') + ':</b> ' + (state.transpose > 0 ? '+' : '') + state.transpose + '</div>' +
      '<div class="i-row"><b>' + t('range') + ':</b> ' + (notes.length ? K.music.midiToName(lo) + ' – ' + K.music.midiToName(hi) : '-') + ' (' + K.harp.rangeName() + ')' +
      (oorr ? ' <span class="warn">⚠ ' + t('warnRange') + ' (' + oorr + ')</span>' : '') + '</div>';
  }

  function renderPreview() {
    var box = $('preview');
    box.innerHTML = '';
    if (!state.song) return;
    var bpb = K.music.beatsPerBar(state.song.ts);
    var bar = null, acc = 0, barNo = 1;
    function newBar() {
      bar = document.createElement('div');
      bar.className = 'pv-bar';
      var bn = document.createElement('span');
      bn.className = 'pv-barno'; bn.textContent = barNo++;
      bar.appendChild(bn);
      box.appendChild(bar);
    }
    newBar();
    state.tab.forEach(function (ev) {
      var c = document.createElement('div');
      c.className = 'pv-cell' + (ev.type === 'rest' ? ' rest' : '');
      var r = K.music.rhythmOf(ev.beats);
      c.innerHTML =
        '<span class="pv-lyric"' + (ev.lyric && /[\u0600-\u06FF]/.test(ev.lyric) ? ' dir="rtl"' : '') + '>' + esc(ev.lyric || '') + '</span>' +
        '<span class="pv-tab' + (r.underlines ? ' u' + r.underlines : '') + (ev.outOfRange ? ' oorr' : '') + '">' + (ev.type === 'rest' ? '0' : esc(ev.tab)) + (r.dot ? '<i>.</i>' : '') + '</span>' +
        '<span class="pv-dash">' + (r.dashes ? new Array(r.dashes + 1).join('- ') : '') + '</span>' +
        '<span class="pv-pitch">' + (ev.type === 'note' ? K.music.midiToName(ev.midi) : '') + '</span>';
      bar.appendChild(c);
      acc += ev.beats;
      if (acc >= bpb - 0.011) { acc = 0; newBar(); }
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- playback ---------- */
  function play() {
    stop();
    if (!state.tab.length) return;
    var AC = G.AudioContext || G.webkitAudioContext;
    state.audioCtx = state.audioCtx || new AC();
    var r = K.synth.renderPCM(state.tab, state.song.tempo, state.audioCtx.sampleRate);
    var buf = state.audioCtx.createBuffer(1, r.pcm.length, r.sampleRate);
    buf.copyToChannel(r.pcm, 0);
    state.src = state.audioCtx.createBufferSource();
    state.src.buffer = buf;
    state.src.connect(state.audioCtx.destination);
    state.src.start();
  }
  function stop() { if (state.src) { try { state.src.stop(); } catch (e) { } state.src = null; } }

  /* ---------- exporters ---------- */
  function syncedLyrics() {
    var times = K.synth.eventTimes(state.tab, state.song.tempo);
    var out = [];
    times.forEach(function (x) {
      if (x.ev.lyric && x.ev.lyric !== '–') out.push({ t: x.t, text: x.ev.lyric });
    });
    return out;
  }
  function fullLyrics() {
    var v = $('lyrics').value.trim();
    if (v) return v;
    var lines = {}, order = [];
    state.tab.forEach(function (ev) {
      if (ev.lyric && ev.lyricLine != null) {
        if (lines[ev.lyricLine] == null) { lines[ev.lyricLine] = []; order.push(ev.lyricLine); }
        if (ev.lyric !== '–') lines[ev.lyricLine].push(ev.lyric);
      }
    });
    return order.map(function (k) { return lines[k].join(' '); }).join('\n');
  }

  async function doPDF() {
    status(t('building') + ' PDF…');
    await new Promise(function (r) { setTimeout(r, 30); });
    var L = K.i18n.sheet();
    var pdf = await K.exportpdf.exportPDF(state.song, state.tab, L, { transposeApplied: state.transpose, showPitch: $('showPitch').checked });
    pdf.save(slug(state.song.titleEn || state.song.title) + '-tab-kimi1040.pdf');
    status(t('done') + ' — PDF', 'ok');
  }
  function doMIDI() {
    var bytes = K.midiwrite.writeMidi(state.song, state.tab, { title: (state.song.titleEn || state.song.title) + ' — Kimi 1040 tab' });
    download(bytes, slug(state.song.titleEn || state.song.title) + '-kimi1040.mid', 'audio/midi');
    status(t('done') + ' — MIDI', 'ok');
  }
  async function doMP3() {
    status(t('building') + ' MP3…');
    await new Promise(function (r) { setTimeout(r, 30); });
    var r = K.synth.renderPCM(state.tab, state.song.tempo, 44100);
    var info = {
      title: (state.song.titleEn || state.song.title) + ' (chromatic harmonica tab)',
      artist: 'QI MEI 1040 Chromatic Harmonica',
      album: 'Kimi-1040 Tab Converter',
      lyrics: fullLyrics() || undefined,
      synced: syncedLyrics()
    };
    var bytes = K.exportmp3.buildMP3(r.pcm, r.sampleRate, info);
    download(bytes, slug(state.song.titleEn || state.song.title) + '-kimi1040.mp3', 'audio/mpeg');
    status(t('done') + ' — MP3', 'ok');
  }
  function doLRC() {
    var times = K.synth.eventTimes(state.tab, state.song.tempo);
    var lines = K.lyrics.lrcLines({ events: state.tab }, times.map(function (x) { return x.t; }));
    if (!lines.length) { status(t('errNoMelody'), 'err'); return; }
    download(new Blob([K.exportmp3.buildLRC(lines)], { type: 'text/plain' }), slug(state.song.titleEn || state.song.title) + '-kimi1040.lrc', 'text/plain');
    status(t('done') + ' — LRC', 'ok');
  }
  function doJSON() {
    download(new Blob([JSON.stringify({ song: state.song, tab: state.tab, transpose: state.transpose }, null, 1)], { type: 'application/json' }), slug(state.song.titleEn || state.song.title) + '-kimi1040.json', 'application/json');
    status(t('done') + ' — JSON', 'ok');
  }

  /* ---------- search UI ---------- */
  function renderLibOptions() {
    var sel = $('libSel');
    sel.innerHTML = '';
    K.library.list().forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = K.i18n.lang === 'fa' ? s.title : (s.titleEn || s.title);
      sel.appendChild(o);
    });
  }

  function fmtSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function renderResults(res) {
    state.results = res.results;
    var box = $('results');
    box.innerHTML = '';
    $('resQueries').textContent = res.queries && res.queries.length > 1 ? t('searchedAs') + ' ' + res.queries.join(' | ') : '';
    res.results.forEach(function (r, idx) {
      var d = document.createElement('div');
      d.className = 'res-item';
      var isBest = res.best && res.best.result === r;
      d.innerHTML =
        '<span class="res-type t-' + r.type + '">' + String(r.type).toUpperCase() + '</span> ' +
        '<span class="res-src">' + esc(r.source) + '</span> ' +
        '<b class="res-title">' + esc(r.title) + '</b> ' +
        '<span class="res-meta">' + fmtSize(r.size) + (r.sim != null ? ' · ' + Math.round(r.sim * 100) + '%' : '') + '</span>' +
        (isBest ? ' <span class="res-best">★ ' + t('bestPick') + '</span>' : '') +
        '<div class="res-actions">' +
        (r.type !== 'pdf' ? '<button class="mini" data-act="load" data-i="' + idx + '">' + t('dbLoad') + '</button>' : '') +
        '<button class="mini" data-act="save" data-i="' + idx + '">' + t('saveVault') + '</button>' +
        (r.type === 'pdf' ? '<button class="mini" data-act="view" data-i="' + idx + '">' + t('viewBtn') + '</button>' : '') +
        '</div>';
      box.appendChild(d);
    });
    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.onclick = async function () {
        var r = state.results[+b.getAttribute('data-i')];
        var act = b.getAttribute('data-act');
        if (act === 'load') {
          status(t('trying') + ' ' + r.title, 'busy');
          try {
            var c = await K.search.loadCandidate(r);
            if (c.pdfOnly) { status(t('pdfOnly'), 'err'); return; }
            setSong(c.song);
            status(t('loaded') + ': ' + c.song.title + ' (' + t('savedVault') + ')', 'ok');
            renderDB();
          } catch (e) { status(t('errNet') + ' (' + e.message + ')', 'err'); }
        } else if (act === 'save') {
          try {
            if (r.type === 'pdf' || true) {
              var rr = await fetch(r.url);
              var buf = await rr.arrayBuffer();
              await K.db.put({ key: r.url, title: r.title, source: r.source, type: r.type, name: r.fileName || r.title, size: buf.byteLength, bytes: buf });
              status(t('savedVault') + ': ' + r.title, 'ok');
              renderDB();
            }
          } catch (e) { status(t('errNet') + ' (' + e.message + ')', 'err'); }
        } else if (act === 'view') {
          try {
            var rec = await K.db.get(r.url);
            var blob;
            if (rec && rec.bytes) blob = new Blob([rec.bytes], { type: 'application/pdf' });
            else blob = new Blob([await (await fetch(r.url)).arrayBuffer()], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');
          } catch (e) { status(t('errNet'), 'err'); }
        }
      };
    });
  }

  async function doSearch() {
    var q = $('query').value.trim();
    if (!q || state.busy) return;
    state.busy = true;
    status(t('searching'), 'busy');
    $('results').innerHTML = '';
    $('resQueries').textContent = '';
    try {
      var res = await K.search.findBest(q, function (kind, payload) {
        if (kind === 'found') status(t('foundN') + ' ' + payload, 'busy');
        else if (kind === 'searching') status(t('searching') + ' «' + payload + '»', 'busy');
        else status(t('trying') + ' ' + payload, 'busy');
      });
      renderResults(res);
      if (res.best) {
        setSong(res.best.song);
        status(t('loaded') + ': ' + res.best.song.title, 'ok');
      } else if (res.results.length) {
        status(t('noParseable'), 'err');
      } else {
        status(t('errNoResults'), 'err');
      }
    } catch (e) {
      status(t('errNet') + ' (' + e.message + ')', 'err');
    }
    state.busy = false;
  }

  /* ---------- offline vault (internal database) ---------- */
  async function renderDB() {
    var box = $('dbList');
    if (!box) return;
    var rows = await K.db.all();
    box.innerHTML = '';
    if (!rows.length) { box.innerHTML = '<div class="db-empty">' + t('dbEmpty') + '</div>'; return; }
    rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'res-item';
      d.innerHTML = '<span class="res-type t-' + r.type + '">' + String(r.type).toUpperCase() + '</span> ' +
        '<b class="res-title">' + esc(r.title) + '</b> ' +
        '<span class="res-meta">' + fmtSize(r.size || (r.bytes && r.bytes.byteLength)) + ' · ' + new Date(r.added || Date.now()).toLocaleDateString(K.i18n.lang === 'fa' ? 'fa-IR' : 'en-GB') + '</span>' +
        '<div class="res-actions">' +
        (r.type !== 'pdf' ? '<button class="mini" data-act="load">' + t('dbLoad') + '</button>' : '<button class="mini" data-act="view">' + t('viewBtn') + '</button>') +
        '<button class="mini" data-act="file">' + t('dbFile') + '</button>' +
        '<button class="mini" data-act="del">' + t('dbDel') + '</button>' +
        '</div>';
      d.querySelector('[data-act=load]') && (d.querySelector('[data-act=load]').onclick = async function () {
        try {
          var song;
          if (r.type === 'midi') song = K.melody.songFromMidi(K.midiparse.parseMidi(r.bytes), { title: r.title, source: 'vault', sourceDetail: r.name });
          else if (r.type === 'abc') song = K.abc.parseABC(new TextDecoder().decode(r.bytes), { title: r.title, source: 'vault', sourceDetail: r.name });
          else song = await K.musicxml.parseBytes(r.bytes, { title: r.title, source: 'vault', sourceDetail: r.name });
          setSong(song);
          status(t('loaded') + ': ' + song.title, 'ok');
        } catch (e) { status(t('errNoMelody') + ' (' + e.message + ')', 'err'); }
      });
      var vb = d.querySelector('[data-act=view]');
      if (vb) vb.onclick = function () { window.open(URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' })), '_blank'); };
      d.querySelector('[data-act=file]').onclick = function () {
        download(r.bytes, (r.name || r.title || 'file').replace(/[\\/:*?"<>|]/g, '_'), r.type === 'pdf' ? 'application/pdf' : 'application/octet-stream');
        status(t('done'), 'ok');
      };
      d.querySelector('[data-act=del]').onclick = async function () {
        await K.db.del(r.key);
        renderDB();
        status(t('done'), 'ok');
      };
      box.appendChild(d);
    });
  }

  /* ---------- init ---------- */
  function init() {
    applyLang();
    $('langBtn').onclick = function () { K.i18n.lang = K.i18n.lang === 'fa' ? 'en' : 'fa'; applyLang(); };
    document.querySelectorAll('.tabbtn').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.tabbtn').forEach(function (x) { x.classList.remove('on'); });
        document.querySelectorAll('.tabpane').forEach(function (x) { x.hidden = true; });
        b.classList.add('on');
        $(b.getAttribute('data-pane')).hidden = false;
        if (b.getAttribute('data-pane') === 'paneDB') renderDB();
      };
    });
    $('searchBtn').onclick = doSearch;
    $('query').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    $('libLoad').onclick = function () {
      var s = K.library.get($('libSel').value);
      if (s) { setSong(s); status(t('loaded') + ': ' + s.title, 'ok'); }
    };
    $('midiFile').onchange = async function (e) {
      var f = e.target.files[0];
      if (!f) return;
      try {
        var buf = await f.arrayBuffer();
        var base = f.name.replace(/\.(midi?|abc|xml|mxl|musicxml)$/i, '');
        var song;
        if (/\.abc$/i.test(f.name)) song = K.abc.parseABC(new TextDecoder().decode(buf), { title: base, source: 'file', sourceDetail: f.name });
        else if (/\.(xml|mxl|musicxml)$/i.test(f.name)) song = await K.musicxml.parseBytes(buf, { title: base, source: 'file', sourceDetail: f.name });
        else song = K.melody.songFromMidi(K.midiparse.parseMidi(buf), { title: base, source: 'file', sourceDetail: f.name });
        if (!song.events.some(function (x) { return x.type === 'note'; })) { status(t('errNoMelody'), 'err'); return; }
        setSong(song);
        status(t('loaded') + ': ' + song.title, 'ok');
      } catch (err) { status(t('errNoMelody') + ' (' + err.message + ')', 'err'); }
    };
    $('pasteLoad').onclick = function () {
      var txt = $('pasteArea').value;
      var song;
      try {
        if (K.abc.isABC(txt)) song = K.abc.parseABC(txt, { source: 'paste', sourceDetail: 'abc' });
        else if (/<score-partwise/.test(txt)) song = K.musicxml.parseMusicXML(txt, { source: 'paste', sourceDetail: 'musicxml' });
        else song = K.melody.parsePaste(txt);
      } catch (e) { status(t('errNoMelody') + ' (' + e.message + ')', 'err'); return; }
      if (!song.events.length) { status(t('errNoMelody'), 'err'); return; }
      setSong(song);
      status(t('loaded'), 'ok');
    };
    $('dbRefresh').onclick = renderDB;
    $('convert').onclick = convert;
    $('transpose').onchange = convert;
    $('minSlide').onchange = convert;
    $('tempo').onchange = convert;
    $('play').onclick = play;
    $('stop').onclick = stop;
    $('expPDF').onclick = function () { doPDF().catch(function (e) { status('PDF: ' + e.message, 'err'); }); };
    $('expMIDI').onclick = doMIDI;
    $('expMP3').onclick = function () { doMP3().catch(function (e) { status('MP3: ' + e.message, 'err'); }); };
    $('expLRC').onclick = doLRC;
    $('expJSON').onclick = doJSON;
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
    /* start with a demo song so the UI is never empty */
    setSong(K.library.get('ode'));
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  K.app = { state: state, convert: convert, setSong: setSong, renderDB: renderDB, doSearch: doSearch };
})(typeof window !== 'undefined' ? window : globalThis);
