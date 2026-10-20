/* PDF sheet builder: lays out the numeric tab (with synced lyrics, rhythm,
   bar lines, legend, metadata) as fixed-size HTML pages, then rasterizes with
   html2canvas (perfect Persian shaping via the browser) into a multi-page PDF. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var PAGE_W = 1122, PAGE_H = 794, M = 44;
  var SYS_H = 104;

  function isFa(s) { return /[\u0600-\u06FF]/.test(s || ''); }

  function cellWidth(ev, lang) {
    var base = 34 + Math.min(4, ev.beats) * 22;
    var w = base;
    if (ev.lyric && ev.lyric !== '–') w = Math.max(w, ev.lyric.length * (isFa(ev.lyric) ? 10 : 8) + 12);
    if (ev.type === 'note') w = Math.max(w, 40);
    return Math.min(150, w);
  }

  function el(tag, cls, txt, dir) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt != null) d.textContent = txt;
    if (dir) d.dir = dir;
    return d;
  }

  /* returns a container element with one .sheet-page child per PDF page */
  function buildSheet(song, tabSeq, L, opts) {
    opts = opts || {};
    var wrap = el('div', 'sheet-wrap');
    wrap.style.cssText = 'position:absolute;left:-10000px;top:0;width:' + PAGE_W + 'px;';
    document.body.appendChild(wrap); /* must be attached so offsetHeight measures work */
    var page = null, pages = 0, y = 0, x = M, sysY = 0, barNo = 1, barBeats = 0;
    var bpb = K.music.beatsPerBar(song.ts);

    function newPage() {
      pages++;
      page = el('div', 'sheet-page');
      page.style.cssText = 'position:relative;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;background:#fff;overflow:hidden;margin:0 0 12px 0;';
      wrap.appendChild(page);
      /* small running header */
      var rh = el('div', 'sh-runhead');
      rh.innerHTML = '<span>' + esc(songTitle(song)) + '</span><span>' + L.page + ' ' + pages + '</span>';
      page.appendChild(rh);
      y = 58; x = M; sysY = y;
      if (pages === 1) {
        /* big header on page 1 */
        var hd = el('div', 'sh-head');
        var t1 = el('div', 'sh-title', null);
        var fa = el('span', 'sh-title-fa', songTitle(song, 'fa'), 'rtl');
        var en = el('span', 'sh-title-en', songTitle(song, 'en'));
        t1.appendChild(fa); t1.appendChild(en);
        hd.appendChild(t1);
        var meta = el('div', 'sh-meta');
        meta.appendChild(el('span', null, L.tempo + ': ' + song.tempo + ' BPM'));
        meta.appendChild(el('span', null, L.timesig + ': ' + song.ts[0] + '/' + song.ts[1]));
        meta.appendChild(el('span', null, L.transpose + ': ' + (opts.transposeApplied > 0 ? '+' : '') + (opts.transposeApplied || 0)));
        meta.appendChild(el('span', null, L.range + ': ' + K.harp.rangeName()));
        meta.appendChild(el('span', 'sh-src', L.source + ': ' + (song.sourceDetail || song.source)));
        hd.appendChild(meta);
        var leg = el('div', 'sh-legend');
        leg.appendChild(el('div', 'sh-leg-title', L.legend));
        var items = [
          ['4', L.legBlow], ['-4', L.legDraw], ['4*', L.legSlide], ['0', L.legRest],
          ['-', L.legTie], ['4.', L.legDot], ['4̲', L.leg8], ['4̳', L.leg16]
        ];
        items.forEach(function (it) {
          var c = el('span', 'sh-leg-item');
          c.appendChild(el('b', 'sh-leg-sym', it[0]));
          c.appendChild(el('span', null, it[1], isFa(it[1]) ? 'rtl' : 'ltr'));
          leg.appendChild(c);
        });
        hd.appendChild(leg);
        page.appendChild(hd);
        y = 58 + hd.offsetHeight + 18; sysY = y;
      }
    }

    function newSystem() {
      sysY += SYS_H;
      x = M;
      if (sysY + SYS_H > PAGE_H - 40) newPage();
    }

    if (!tabSeq.length) return wrap;
    newPage();

    tabSeq.forEach(function (ev, idx) {
      var w = cellWidth(ev, L.lang);
      if (x + w > PAGE_W - M) newSystem();
      var cell = el('div', 'sh-cell' + (ev.type === 'rest' ? ' rest' : ''));
      cell.style.cssText = 'position:absolute;left:' + x + 'px;top:' + sysY + 'px;width:' + w + 'px;height:' + SYS_H + 'px;';
      /* pitch name */
      if (ev.type === 'note' && opts.showPitch !== false) {
        cell.appendChild(el('div', 'sh-pitch', K.music.midiToName(ev.midi)));
      } else cell.appendChild(el('div', 'sh-pitch', ''));
      /* lyric */
      var ly = el('div', 'sh-lyric', ev.lyric || '', ev.lyric && isFa(ev.lyric) ? 'rtl' : 'ltr');
      cell.appendChild(ly);
      /* tab token */
      var tk = el('div', 'sh-tab');
      var num = el('span', 'sh-tab-num', ev.type === 'rest' ? '0' : ev.tab);
      tk.appendChild(num);
      var r = K.music.rhythmOf(ev.beats);
      if (r.underlines) {
        for (var u = 0; u < r.underlines; u++) {
          var beam = el('i', 'sh-beam');
          beam.style.bottom = (-6 - u * 5) + 'px';
          num.appendChild(beam);
        }
        num.style.position = 'relative';
      }
      if (r.dot) tk.appendChild(el('span', 'sh-dot', '.'));
      cell.appendChild(tk);
      /* dashes (tie quarters) as extra mini cells */
      page.appendChild(cell);
      x += w + 6;
      for (var d = 0; d < r.dashes; d++) {
        if (x + 24 > PAGE_W - M) newSystem();
        var dc = el('div', 'sh-cell dash');
        dc.style.cssText = 'position:absolute;left:' + x + 'px;top:' + sysY + 'px;width:24px;height:' + SYS_H + 'px;';
        dc.appendChild(el('div', 'sh-pitch', ''));
        dc.appendChild(el('div', 'sh-lyric', ''));
        var dt = el('div', 'sh-tab'); dt.appendChild(el('span', 'sh-tab-num dash', '-'));
        dc.appendChild(dt);
        page.appendChild(dc);
        x += 26;
      }
      barBeats += ev.beats;
      if (barBeats >= bpb - 0.011) {
        barBeats = 0; barNo++;
        if (x + 14 > PAGE_W - M) newSystem();
        var bl = el('div', 'sh-barline');
        bl.style.cssText = 'position:absolute;left:' + (x + 2) + 'px;top:' + (sysY + 26) + 'px;height:52px;';
        page.appendChild(bl);
        var bn = el('div', 'sh-barno', String(barNo));
        bn.style.cssText = 'position:absolute;left:' + (x - 2) + 'px;top:' + (sysY + 8) + 'px;';
        page.appendChild(bn);
        x += 16;
      }
    });
    /* footer on every page */
    Array.prototype.forEach.call(wrap.children, function (pg, i) {
      var ft = el('div', 'sh-footer', L.footer + '  •  ' + (i + 1) + '/' + pages);
      pg.appendChild(ft);
    });
    return wrap;

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    function songTitle(s, which) {
      var fa = s.title || '', en = s.titleEn || s.title || '';
      if (which === 'fa') return fa;
      if (which === 'en') return en;
      return (isFa(fa) ? fa : en) + (fa && en && fa !== en ? '  |  ' + (isFa(fa) ? en : fa) : '');
    }
  }

  async function exportPDF(song, tabSeq, L, opts) {
    if (!G.html2canvas || !G.jspdf) throw new Error('PDF_LIBS_MISSING');
    var wrap = buildSheet(song, tabSeq, L, opts);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(function (r) { setTimeout(r, 60); });
      var pdf = new G.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [PAGE_W, PAGE_H] });
      var pagesEl = wrap.children;
      for (var i = 0; i < pagesEl.length; i++) {
        var canvas = await G.html2canvas(pagesEl[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
        var img = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage([PAGE_W, PAGE_H], 'landscape');
        pdf.addImage(img, 'PNG', 0, 0, PAGE_W, PAGE_H);
      }
      return pdf;
    } finally {
      document.body.removeChild(wrap);
    }
  }

  K.exportpdf = { buildSheet: buildSheet, exportPDF: exportPDF, PAGE_W: PAGE_W, PAGE_H: PAGE_H };
})(typeof window !== 'undefined' ? window : globalThis);
