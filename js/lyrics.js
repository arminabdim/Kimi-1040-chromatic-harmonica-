/* Lyrics -> note alignment (syllable/word level, phrase aware) for synced
   display in PDF, MIDI lyric meta events and MP3 SYLT tags / .lrc */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function tokenize(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var toks = [];
    lines.forEach(function (line, li) {
      line.trim().split(/\s+/).forEach(function (w) {
        if (w) toks.push({ text: w, line: li });
      });
      if (line.trim()) toks.push({ text: '\n', line: li, br: true });
    });
    return toks.filter(function (t) { return !t.br || true; });
  }

  /* assign lyric tokens to note events (rests skipped).
     equal counts -> 1:1, otherwise proportional melisma mapping. */
  function align(song, text) {
    var toks = tokenize(text).filter(function (t) { return !t.br; });
    var noteIdx = [];
    song.events.forEach(function (ev, i) { if (ev.type === 'note') noteIdx.push(i); });
    song.events.forEach(function (ev) { ev.lyric = null; ev.lyricLine = null; });
    if (!toks.length || !noteIdx.length) return song;
    if (toks.length === noteIdx.length) {
      toks.forEach(function (t, i) {
        song.events[noteIdx[i]].lyric = t.text;
        song.events[noteIdx[i]].lyricLine = t.line;
      });
      return song;
    }
    /* proportional: token i owns notes [floor(i*n/m), floor((i+1)*n/m)) */
    var n = noteIdx.length, m = toks.length;
    for (var i = 0; i < m; i++) {
      var a = Math.floor(i * n / m), b = Math.floor((i + 1) * n / m);
      if (b <= a) b = a + 1;
      for (var j = a; j < Math.min(b, n); j++) {
        var ev = song.events[noteIdx[j]];
        if (j === a) { ev.lyric = toks[i].text; ev.lyricLine = toks[i].line; }
        else if (!ev.lyric) { ev.lyric = '–'; ev.lyricLine = toks[i].line; } /* melisma tie */
      }
    }
    return song;
  }

  /* line start times (seconds) for .lrc */
  function lrcLines(song, times) {
    var lines = {};
    song.events.forEach(function (ev, i) {
      if (ev.type === 'note' && ev.lyric && ev.lyricLine != null && !ev.lyric.startsWith('–')) {
        if (lines[ev.lyricLine] == null) lines[ev.lyricLine] = { t: times[i], text: '' };
      }
      if (ev.lyric && ev.lyricLine != null && lines[ev.lyricLine]) {
        if (ev.lyric !== '–') lines[ev.lyricLine].text += (lines[ev.lyricLine].text ? ' ' : '') + ev.lyric;
      }
    });
    return Object.keys(lines).map(Number).sort(function (a, b) { return a - b; })
      .map(function (k) { return { t: lines[k].t, text: lines[k].text }; });
  }

  K.lyrics = { align: align, tokenize: tokenize, lrcLines: lrcLines };
})(typeof window !== 'undefined' ? window : globalThis);
