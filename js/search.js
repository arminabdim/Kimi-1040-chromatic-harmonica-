/* Internet song search — multi-engine, multi-language, multi-format.
   Engines (all browser-safe: CORS or JSONP):
     • Internet Archive (advancedsearch + metadata; fetch→JSONP fallback) — MIDI/PDF/ABC/XML
     • Wikimedia Commons (CORS origin=*) — MIDI/PDF/XML/MXL
   Cross-language: Persian query ⇄ English title via Wikipedia langlinks + alias table,
   so «ایران» finds both Persian and English results.
   Results ranked by relevance + accuracy + file type; downloadable & stored offline (K.db). */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  var ALIASES = {
    'ایران': 'Ey Iran', 'ای ایران': 'Ey Iran', 'ایران ای سرای امید': 'Ey Iran',
    'مرغ سحر': 'Morghe Sahar', 'مرغه سحر': 'Morghe Sahar',
    'ستاره کوچولو': 'Twinkle Twinkle Little Star', 'تولد': 'Happy Birthday',
    'سرود شادی': 'Ode to Joy', 'مارش ترکی': 'Turkish March', 'کانون': 'Canon in D',
    'آستین سبز': 'Greensleeves', 'آستین‌های سبز': 'Greensleeves',
    'بلا چاو': 'Bella Ciao', 'ملوان مست': 'Drunken Sailor',
    'خانه خورشید': 'House of the Rising Sun', 'ویسکی': 'Whiskey in the Jar'
  };
  var TYPE_W = { midi: 30, mxl: 24, xml: 24, abc: 22, pdf: 12, item: 4 };
  var SRC_W = { 'archive.org': 6, 'commons.wikimedia.org': 5 };

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
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
  function isFa(s) { return /[\u0600-\u06FF]/.test(s || ''); }
  function typeOf(name) {
    var n = String(name || '').toLowerCase();
    if (/\.midi?$/.test(n)) return 'midi';
    if (/\.abc$/.test(n)) return 'abc';
    if (/\.mxl$/.test(n)) return 'mxl';
    if (/\.(xml|musicxml)$/.test(n)) return 'xml';
    if (/\.pdf$/.test(n)) return 'pdf';
    return null;
  }

  function timeoutFetch(url, ms) {
    var ctrl = ('AbortController' in G) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 15000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).finally(function () { if (to) clearTimeout(to); });
  }
  var jpCtr = 0;
  function jsonp(url, param, ms) {
    return new Promise(function (res, rej) {
      var name = 'k1040jp' + (jpCtr++);
      var sc = document.createElement('script');
      var to = setTimeout(function () { cleanup(); rej(new Error('JSONP_TIMEOUT')); }, ms || 14000);
      function cleanup() { clearTimeout(to); delete G[name]; if (sc.parentNode) sc.parentNode.removeChild(sc); }
      G[name] = function (d) { cleanup(); res(d); };
      sc.onerror = function () { cleanup(); rej(new Error('JSONP_ERR')); };
      sc.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + param + '=' + name;
      document.head.appendChild(sc);
    });
  }

  /* ---------- cross-language query expansion ---------- */
  async function wikiExpand(q) {
    var out = [];
    var fa = isFa(q);
    var host = fa ? 'https://fa.wikipedia.org/w/api.php' : 'https://en.wikipedia.org/w/api.php';
    try {
      var r = await timeoutFetch(host + '?action=query&format=json&origin=*&list=search&srlimit=3&srsearch=' + encodeURIComponent(q));
      var j = await r.json();
      var titles = (j.query && j.query.search || []).map(function (x) { return x.title; }).slice(0, 2);
      for (var i = 0; i < titles.length; i++) {
        out.push(titles[i]);
        try {
          var r2 = await timeoutFetch(host + '?action=query&format=json&origin=*&prop=langlinks&lllang=' + (fa ? 'en' : 'fa') + '&titles=' + encodeURIComponent(titles[i]));
          var j2 = await r2.json();
          var pg = Object.values(j2.query.pages || {})[0];
          var ll = pg && pg.langlinks && pg.langlinks[0];
          if (ll) out.push(ll['*']);
        } catch (e) { }
      }
    } catch (e) { }
    return out.slice(0, 4);
  }
  function aliasExpand(q) {
    var n = norm(q), out = [];
    Object.keys(ALIASES).forEach(function (k) {
      if (norm(k) === n || norm(k).indexOf(n) === 0 || n.indexOf(norm(k)) === 0) out.push(ALIASES[k]);
      if (sim(norm(k), n) > 0.6) out.push(ALIASES[k]);
    });
    return out;
  }
  async function expandQueries(q) {
    var variants = [q];
    try { variants = variants.concat(await wikiExpand(q)); } catch (e) { }
    variants = variants.concat(aliasExpand(q));
    var seen = {}, out = [];
    variants.forEach(function (v) { var k = norm(v); if (v && !seen[k]) { seen[k] = 1; out.push(v); } });
    return out.slice(0, 4);
  }

  /* ---------- Internet Archive ---------- */
  async function iaSearch(q) {
    var u = 'https://archive.org/advancedsearch.php?q=' +
      encodeURIComponent('(' + q + ') AND format:(MIDI OR Midi OR pdf OR Pdf)') +
      '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&rows=14&page=1&output=json';
    var j = null;
    try {
      var r = await timeoutFetch(u);
      if (r.ok) j = await r.json();
    } catch (e) { }
    if (!j) { try { j = await jsonp(u, 'callback'); } catch (e) { } }
    if (!j) return [];
    return (j.response && j.response.docs || []).map(function (d) {
      return { source: 'archive.org', id: d.identifier, title: Array.isArray(d.title) ? d.title[0] : (d.title || d.identifier), creator: d.creator || '', year: d.year || '' };
    });
  }
  async function iaFiles(item) {
    var u = 'https://archive.org/metadata/' + encodeURIComponent(item.id);
    var j = null;
    try {
      var r = await timeoutFetch(u);
      if (r.ok) j = await r.json();
    } catch (e) { }
    if (!j) { try { j = await jsonp(u, 'callback'); } catch (e) { } }
    if (!j || !j.files) return [];
    return j.files.map(function (f) { return { name: f.name, size: +f.size || 0 }; })
      .filter(function (f) { return typeOf(f.name); })
      .map(function (f) {
        return {
          source: 'archive.org', itemTitle: item.title, fileName: f.name, size: f.size,
          type: typeOf(f.name),
          url: 'https://archive.org/download/' + encodeURIComponent(item.id) + '/' + encodeURIComponent(f.name),
          title: item.title + (f.name ? ' — ' + f.name.replace(/\.[^.]+$/, '') : '')
        };
      });
  }

  /* ---------- Wikimedia Commons ---------- */
  async function commonsSearch(q) {
    var out = [];
    try {
      var u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=14&srsearch=' +
        encodeURIComponent(q + ' (filetype:midi OR filetype:pdf OR filetype:xml OR filetype:mxl OR filetype:abc)');
      var r = await timeoutFetch(u);
      if (!r.ok) return out;
      var j = await r.json();
      var hits = (j.query && j.query.search || []).map(function (s) { return s.title; });
      if (!hits.length) return out;
      var u2 = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|size|mime&titles=' +
        encodeURIComponent(hits.join('|'));
      var r2 = await timeoutFetch(u2);
      if (!r2.ok) return out;
      var j2 = await r2.json();
      Object.values(j2.query.pages || {}).forEach(function (pg) {
        var ii = pg.imageinfo && pg.imageinfo[0];
        var ty = ii ? typeOf(ii.url || pg.title) : null;
        if (ii && ty) out.push({
          source: 'commons.wikimedia.org', id: pg.title, title: pg.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          fileName: pg.title.replace(/^File:/, ''), size: ii.size || 0, type: ty, url: ii.url
        });
      });
    } catch (e) { }
    return out;
  }

  /* ---------- GitHub open sheet-music repos (CORS-open, no auth) ---------- */
  var GH_REPOS = ['SBurrell23/Sheets'];
  var ghCache = {};
  async function githubCatalog(q) {
    var out = [];
    var toks = tokens(q).filter(function (t) { return t.length > 2; });
    if (!toks.length) return out;
    for (var ri = 0; ri < GH_REPOS.length; ri++) {
      var repo = GH_REPOS[ri];
      try {
        if (!ghCache[repo]) {
          var r = await timeoutFetch('https://api.github.com/repos/' + repo + '/git/trees/HEAD?recursive=1', 20000);
          if (!r.ok) continue;
          var j = await r.json();
          ghCache[repo] = (j.tree || []).map(function (t) { return t.path; }).filter(function (p) { return typeOf(p); });
        }
        ghCache[repo].forEach(function (p) {
          var np = norm(p.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
          var hit = toks.filter(function (tk) { return np.indexOf(tk) >= 0; }).length;
          if (hit >= Math.min(2, toks.length)) {
            var name = p.split('/').pop();
            out.push({
              source: 'github.com/' + repo, id: p, title: name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
              fileName: name, type: typeOf(p),
              url: 'https://raw.githubusercontent.com/' + repo + '/HEAD/' + p.split('/').map(encodeURIComponent).join('/')
            });
          }
        });
      } catch (e) { }
    }
    return out;
  }

  /* ---------- ranking ---------- */
  function rank(results, queries) {
    results.forEach(function (r) {
      var s = 0;
      queries.forEach(function (q) { s = Math.max(s, sim(q, r.title)); });
      r.sim = s;
      var sizeW = r.type === 'midi' ? Math.min(10, Math.log10(Math.max(1000, r.size || 1000)) - 2) * 4
        : r.type === 'pdf' ? Math.min(8, Math.log10(Math.max(10000, r.size || 10000)) - 3) * 2 : 3;
      r.score = s * 60 + (TYPE_W[r.type] || 0) + (SRC_W[r.source] || (String(r.source).indexOf('github') === 0 ? 5 : 0)) + Math.max(0, sizeW);
    });
    results.sort(function (a, b) { return b.score - a.score; });
    var seen = {}, out = [];
    results.forEach(function (r) { var k = norm(r.title) + r.type; if (!seen[k]) { seen[k] = 1; out.push(r); } });
    return out;
  }

  async function searchAll(q) {
    var queries = await expandQueries(q);
    var per = [];
    queries.slice(0, 3).forEach(function (qq) {
      per.push(iaSearch(qq).catch(function () { return []; }));
      per.push(commonsSearch(qq).catch(function () { return []; }));
      per.push(githubCatalog(qq).catch(function () { return []; }));
    });
    var flat = [];
    (await Promise.all(per)).forEach(function (list) { flat = flat.concat(list); });
    /* expand top IA items into concrete files */
    var iaItems = {};
    flat.forEach(function (r) { if (r.source === 'archive.org' && !r.type) iaItems[r.id] = r; });
    var expanded = [];
    var ids = Object.keys(iaItems).slice(0, 7);
    await Promise.all(ids.map(async function (id) {
      var fs = await iaFiles(iaItems[id]).catch(function () { return []; });
      expanded = expanded.concat(fs);
    }));
    var merged = flat.filter(function (r) { return r.type; }).concat(expanded);
    return { results: rank(merged, queries).slice(0, 30), queries: queries };
  }

  /* ---------- load one result ---------- */
  async function loadCandidate(res) {
    if (res.type === 'pdf') return { pdfOnly: true, result: res, song: null, score: res.score };
    var r = await timeoutFetch(res.url, 30000);
    if (!r.ok) throw new Error('HTTP_' + r.status);
    var buf = await r.arrayBuffer();
    var song = null;
    if (res.type === 'midi') {
      song = K.melody.songFromMidi(K.midiparse.parseMidi(buf), { title: res.itemTitle || res.title, source: res.source, sourceDetail: res.fileName });
    } else if (res.type === 'abc') {
      song = K.abc.parseABC(new TextDecoder().decode(buf), { title: res.itemTitle || res.title, source: res.source, sourceDetail: res.fileName });
    } else {
      song = await K.musicxml.parseBytes(buf, { title: res.itemTitle || res.title, source: res.source, sourceDetail: res.fileName });
    }
    var notes = song.events.filter(function (e) { return e.type === 'note'; });
    if (notes.length < 6) throw new Error('TOO_FEW_NOTES');
    var midis = notes.map(function (e) { return e.midi; });
    var t = K.harp.autoTranspose(midis);
    var out = midis.filter(function (m) { return !K.harp.inRange(m + t); }).length;
    song.autoTranspose = t;
    var score = res.score + notes.length * 0.5 + (1 - out / midis.length) * 40;
    /* store offline copy in the internal database */
    try {
      K.db.put({ key: res.url, title: res.title, source: res.source, type: res.type, name: res.fileName || res.title, size: res.size || buf.byteLength, bytes: buf });
    } catch (e) { }
    return { song: song, score: score, result: res };
  }

  async function findBest(q, onProgress, maxTry) {
    if (onProgress) onProgress('searching', q);
    var sa = await searchAll(q);
    var results = sa.results;
    if (onProgress) onProgress('found', results.length);
    var tried = 0, best = null, alts = [];
    for (var i = 0; i < results.length && tried < (maxTry || 5); i++) {
      var r = results[i];
      if (!TYPE_W[r.type] || r.type === 'pdf') continue;
      if (r.sim < 0.15 && best) continue;
      tried++;
      if (onProgress) onProgress('trying', r.title);
      try {
        var cand = await loadCandidate(r);
        if (cand && cand.song) {
          alts.push(cand);
          if (!best || cand.score > best.score) best = cand;
        }
      } catch (e) { }
    }
    alts.sort(function (a, b) { return b.score - a.score; });
    return { best: best, alternatives: alts, results: results, queries: sa.queries };
  }

  K.search = {
    searchAll: searchAll, findBest: findBest, loadCandidate: loadCandidate,
    rank: rank, sim: sim, typeOf: typeOf, expandQueries: expandQueries, githubCatalog: githubCatalog,
    iaSearch: iaSearch, iaFiles: iaFiles, commonsSearch: commonsSearch, ALIASES: ALIASES
  };
})(typeof window !== 'undefined' ? window : globalThis);
