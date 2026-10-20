/* Melody extraction from parsed MIDI + plain-text note parser */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function trackScore(tr) {
    var n = tr.notes.length;
    if (!n) return -1;
    var perc = 0, chCount = {};
    tr.notes.forEach(function (x) { chCount[x.ch] = 1; if (x.ch === 9) perc++; });
    if (perc === n) return -1;
    /* monophony ratio */
    var mono = 0, i = 0;
    var evs = [];
    tr.notes.forEach(function (x) { evs.push([x.start, 1], [x.start + x.dur, -1]); });
    evs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var depth = 0, soloTicks = 0, last = 0;
    evs.forEach(function (e) {
      if (depth === 1) soloTicks += e[0] - last;
      depth += e[1]; last = e[0];
    });
    var total = tr.notes.reduce(function (s, x) { return s + x.dur; }, 0) || 1;
    mono = Math.min(1, soloTicks / total);
    var avg = tr.notes.reduce(function (s, x) { return s + x.midi; }, 0) / n;
    var nameBonus = /melod|lead|voice|solo|sing|chant|main|آواز|ملودی/i.test(tr.name || '') ? 0.35 : 0;
    return mono * 0.55 + Math.min(1, Math.max(0, (avg - 55) / 25)) * 0.2 + nameBonus + Math.log2(n + 1) / 22;
  }

  function pickTrack(parsed) {
    var best = null, bs = -1;
    parsed.tracks.forEach(function (tr, idx) {
      var s = trackScore(tr);
      if (s > bs) { bs = s; best = idx; }
    });
    return best == null ? 0 : best;
  }

  /* collapse polyphony: at every boundary keep the highest sounding note */
  function monophonize(notes) {
    if (!notes.length) return [];
    var bounds = {};
    notes.forEach(function (n) { bounds[n.start] = 1; bounds[n.start + n.dur] = 1; });
    var bs = Object.keys(bounds).map(Number).sort(function (a, b) { return a - b; });
    var segs = [];
    for (var i = 0; i < bs.length - 1; i++) {
      var a = bs[i], b = bs[i + 1];
      if (b <= a) continue;
      var top = null;
      for (var j = 0; j < notes.length; j++) {
        var n = notes[j];
        if (n.start <= a && n.start + n.dur > a) { if (!top || n.midi > top.midi) top = n; }
      }
      if (top) segs.push({ start: a, dur: b - a, midi: top.midi, src: top });
    }
    var merged = [];
    segs.forEach(function (s) {
      var l = merged[merged.length - 1];
      /* merge only fragments of the SAME source note (polyphony splits),
         never two separate re-articulated notes of equal pitch */
      if (l && l.src === s.src && l.midi === s.midi) l.dur = s.start + s.dur - l.start;
      else merged.push({ start: s.start, dur: s.dur, midi: s.midi, src: s.src });
    });
    return merged;
  }

  function quantize(segs, tpq) {
    var grid = tpq / 4; /* 16th */
    var out = [];
    segs.forEach(function (s) {
      var st = Math.round(s.start / grid) * grid;
      var du = Math.max(grid, Math.round(s.dur / grid) * grid);
      var l = out[out.length - 1];
      if (l && l.src === s.src && l.midi === s.midi) l.durQ = st + du - l.startQ;
      else out.push({ startQ: st, durQ: du, midi: s.midi, src: s.src });
    });
    return out;
  }

  /* parsed MIDI -> Song {events:[{type,beats,midi?,lyric?}], tempo, ts, title, source...} */
  function songFromMidi(parsed, meta) {
    meta = meta || {};
    var ti = pickTrack(parsed);
    var tr = parsed.tracks[ti];
    var mono = monophonize(tr.notes);
    var q = quantize(mono, parsed.tpq);
    var first = q.length ? q[0].startQ : 0;
    var events = [];
    var prevEnd = first;
    var grid = parsed.tpq / 4;
    q.forEach(function (s) {
      var gap = s.startQ - prevEnd;
      if (gap >= grid * 2) events.push({ type: 'rest', beats: gap / parsed.tpq });
      events.push({ type: 'note', midi: s.midi, beats: s.durQ / parsed.tpq, startQ: s.startQ });
      prevEnd = s.startQ + s.durQ;
    });
    var tempo = 120;
    var allTempos = [];
    parsed.tracks.forEach(function (t) { t.tempos.forEach(function (x) { allTempos.push(x); }); });
    allTempos.sort(function (a, b) { return a.tick - b.tick; });
    if (allTempos.length) tempo = Math.round(60e6 / allTempos[0].usq);
    var ts = [4, 4];
    var allTs = [];
    parsed.tracks.forEach(function (t) { t.timesigs.forEach(function (x) { allTs.push(x); }); });
    allTs.sort(function (a, b) { return a.tick - b.tick; });
    if (allTs.length) ts = [allTs[0].num, allTs[0].den];
    /* timed lyrics from the midi itself */
    var lyr = [];
    parsed.tracks.forEach(function (t) { t.lyrics.forEach(function (x) { lyr.push(x); }); });
    lyr.sort(function (a, b) { return a.tick - b.tick; });
    if (lyr.length) {
      var li = 0;
      events.forEach(function (ev) {
        if (ev.type !== 'note') return;
        var st = ev.startQ != null ? ev.startQ : 0;
        while (li < lyr.length && lyr[li].tick <= st + parsed.tpq / 4) {
          var txt = lyr[li].text.replace(/\s+$/, '');
          if (txt) ev.lyric = (ev.lyric ? ev.lyric + ' ' : '') + txt;
          li++;
        }
      });
    }
    return {
      title: meta.title || tr.name || 'Song',
      source: meta.source || 'midi',
      sourceDetail: meta.sourceDetail || '',
      tempo: tempo, ts: ts, events: events,
      lyricsText: meta.lyricsText || '',
      trackName: tr.name || ''
    };
  }

  /* paste parser: tokens like  C4  D#4:q  Eb3/e  R  0  |  with optional  T:=120  M:=4/4  lines */
  function parsePaste(text) {
    var tempo = 120, ts = [4, 4], events = [];
    var lines = String(text).split(/\n+/);
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var mt = /(?:^|[\s,;])[Tt]\s*[:=]{1,2}\s*(\d{2,3})/.exec(line);
      var mm = /(?:^|[\s,;])[Mm]\s*[:=]{1,2}\s*(\d)\s*\/\s*(\d+)/.exec(line);
      if (mt) tempo = +mt[1];
      if (mm) ts = [+mm[1], +mm[2]];
      if (mt || mm) line = line.replace(/[TtMm]\s*[:=]{1,2}\s*[\d.\/]+/g, ' ');
      if (!line.trim()) return;
      line.split(/[\s,;]+/).forEach(function (tok) {
        if (!tok || tok === '|') return;
        var parts = tok.split(/[:\/]/);
        var head = parts[0], durTok = parts[1];
        var beats = 1;
        if (durTok) {
          if (K.music.DUR_LETTERS[durTok.toLowerCase()]) beats = K.music.DUR_LETTERS[durTok.toLowerCase()];
          else if (!isNaN(parseFloat(durTok))) beats = parseFloat(durTok);
        }
        if (/^(R|r|0|-|—)$/.test(head)) { events.push({ type: 'rest', beats: beats }); return; }
        var m = K.music.nameToMidi(head);
        if (m != null) events.push({ type: 'note', midi: m, beats: beats });
      });
    });
    return { title: 'Pasted melody', source: 'paste', tempo: tempo, ts: ts, events: events, lyricsText: '' };
  }

  K.melody = { pickTrack: pickTrack, monophonize: monophonize, quantize: quantize, songFromMidi: songFromMidi, parsePaste: parsePaste, trackScore: trackScore };
})(typeof window !== 'undefined' ? window : globalThis);
