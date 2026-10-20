/* Internet song search: Internet Archive MIDI collection + Wikimedia Commons (both CORS-open).
   Ranks candidates and picks the most complete / cleanest melody. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[‌‏]/g, ' ')
      .replace(/[٠-٩۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10 >= 0 ? String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)) : String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[^\p{L}\p{N} ]+/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function tokens(s) { var n = norm(s); return n ? n.split(' ') : []; }
  function sim(a, b) {
    var ta = tokens(a), tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    var set = {}, common = 0;
    ta.forEach(function (t) { set[t] = 1; });
    tb.forEach(function (t) { if (set[t]) common++; });
    return 2 * common / (ta.length + tb.length);
  }

  function timeoutFetch(url, ms) {
    var ctrl = ('AbortController' in G) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 15000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).finally(function () { if (to) clearTimeout(to); });
  }

  async function searchArchive(q) {
    var out = [];
    var queries = [
      '(' + q + ') AND format:(MIDI)',
      '(' + q + ') AND mediatype:(audio) AND format:(MIDI)'
    ];
    for (var i = 0; i < queries.length; i++) {
      try {
        var u = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(queries[i]) +
          '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&rows=12&page=1&output=json';
        var r = await timeoutFetch(u);
        if (!r.ok) continue;
        var j = await r.json();
        (j.response && j.response.docs || []).forEach(function (d) {
          out.push({ source: 'archive.org', id: d.identifier, title: Array.isArray(d.title) ? d.title[0] : (d.title || d.identifier), creator: d.creator || '', year: d.year || '' });
        });
        if (out.length) break;
      } catch (e) { /* offline / blocked */ }
    }
    return out;
  }

  async function searchCommons(q) {
    var out = [];
    try {
      var u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=12&srsearch=' +
        encodeURIComponent(q + ' midi');
      var r = await timeoutFetch(u);
      if (!r.ok) return out;
      var j = await r.json();
      var hits = (j.query && j.query.search || []).map(function (s) { return s.title; })
        .filter(function (t) { return /\.midi?$/i.test(t); });
      if (!hits.length) return out;
      var u2 = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|size&titles=' +
        encodeURIComponent(hits.join('|'));
      var r2 = await timeoutFetch(u2);
      if (!r2.ok) return out;
      var j2 = await r2.json();
      Object.values(j2.query.pages || {}).forEach(function (pg) {
        var ii = pg.imageinfo && pg.imageinfo[0];
        if (ii) out.push({ source: 'commons.wikimedia.org', id: pg.title, title: pg.title.replace(/^File:/, ''), url: ii.url, size: ii.size });
      });
    } catch (e) { }
    return out;
  }

  async function searchAll(q) {
    var res = await Promise.all([searchArchive(q), searchCommons(q)]);
    var all = res[0].concat(res[1]);
    all.forEach(function (r) { r.sim = sim(q, r.title); });
    all.sort(function (a, b) { return b.sim - a.sim; });
    /* de-dupe by title */
    var seen = {}, out = [];
    all.forEach(function (r) { var k = norm(r.title); if (!seen[k]) { seen[k] = 1; out.push(r); } });
    return out.slice(0, 14);
  }

  async function midiFilesFor(res) {
    if (res.url) return [{ name: res.title, url: res.url, size: res.size || 0 }];
    try {
      var r = await timeoutFetch('https://archive.org/metadata/' + encodeURIComponent(res.id));
      if (!r.ok) return [];
      var j = await r.json();
      return (j.files || []).filter(function (f) { return /\.midi?$/i.test(f.name); })
        .map(function (f) {
          return { name: f.name, url: 'https://archive.org/download/' + encodeURIComponent(res.id) + '/' + encodeURIComponent(f.name), size: +f.size || 0 };
        });
    } catch (e) { return []; }
  }

  /* load + evaluate one candidate -> {song, score, parsed} */
  async function loadCandidate(res) {
    var files = await midiFilesFor(res);
    if (!files.length) return null;
    files.sort(function (a, b) { return b.size - a.size; });
    var lastErr = null;
    for (var i = 0; i < Math.min(files.length, 3); i++) {
      try {
        var r = await timeoutFetch(files[i].url, 25000);
        if (!r.ok) continue;
        var buf = await r.arrayBuffer();
        var parsed = K.midiparse.parseMidi(buf);
        var song = K.melody.songFromMidi(parsed, { title: res.title, source: res.source, sourceDetail: files[i].name });
        var n = song.events.filter(function (e) { return e.type === 'note'; });
        if (n.length < 6) continue;
        var midis = n.map(function (e) { return e.midi; });
        var t = K.harp.autoTranspose(midis);
        var out = midis.filter(function (m) { return !K.harp.inRange(m + t); }).length;
        var rangeFit = 1 - out / midis.length;
        var score = n.length * 0.6 + rangeFit * 60 + res.sim * 40;
        song.autoTranspose = t;
        return { song: song, score: score, result: res };
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    return null;
  }

  /* "best & most complete version": parse top candidates, keep highest score */
  async function findBest(q, onProgress, maxTry) {
    var results = await searchAll(q);
    if (onProgress) onProgress('found', results.length);
    var tried = 0, best = null, alts = [];
    for (var i = 0; i < results.length && tried < (maxTry || 5); i++) {
      if (results[i].sim < 0.18 && best) continue;
      tried++;
      if (onProgress) onProgress('trying', results[i].title);
      try {
        var cand = await loadCandidate(results[i]);
        if (cand) {
          alts.push(cand);
          if (!best || cand.score > best.score) best = cand;
        }
      } catch (e) { }
    }
    alts.sort(function (a, b) { return b.score - a.score; });
    return { best: best, alternatives: alts, results: results };
  }

  K.search = { searchAll: searchAll, midiFilesFor: midiFilesFor, loadCandidate: loadCandidate, findBest: findBest, sim: sim };
})(typeof window !== 'undefined' ? window : globalThis);
