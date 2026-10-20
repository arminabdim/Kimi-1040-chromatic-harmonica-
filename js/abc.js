/* ABC notation parser (subset, multi-voice aware) -> Song events.
   Supports: X T C M L Q K V headers, key signatures, accidentals, octave marks,
   note lengths (n, n/m), ties -, rests z/Z/x, chords [abc] (highest note),
   grace notes {}, chord symbols "Am", barlines, fermata H, voice switching. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  var FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  function keyAccidentsals(kstr) {
    var acc = {};
    var m = /^\s*([A-G])([#b]?)([^ ]*)/i.exec(kstr || '');
    if (!m) return acc;
    var tonic = m[1].toUpperCase();
    var minor = /m(in|inor)?\b/i.test(m[3] || '');
    var rel = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: 6 }[tonic];
    if (tonic === 'F') rel = m[2] === '#' ? 6 : -1;
    else if (m[2] === 'b') rel = { B: -4, E: -3, A: -2, D: -1, G: 0, C: 1, F: -1 }[tonic];
    if (minor) rel -= 3;
    var n = rel;
    if (n > 0) for (var i = 0; i < Math.min(n, 7); i++) acc[SHARP_ORDER[i]] = 1;
    if (n < 0) for (var j = 0; j < Math.min(-n, 7); j++) acc[FLAT_ORDER[j]] = -1;
    return acc;
  }

  function parseABC(text, meta) {
    meta = meta || {};
    var lines = String(text).replace(/\r/g, '').split('\n');
    var songs = [];
    var cur = null;
    lines.forEach(function (line) {
      if (/^X\s*:/.test(line)) { if (cur) songs.push(cur); cur = fresh(); return; }
      if (!cur) { if (/^[A-Za-z]:/.test(line)) { cur = fresh(); } else return; }
      ingest(cur, line);
    });
    if (cur) songs.push(cur);
    var s = songs[0];
    if (!s) throw new Error('ABC_EMPTY');
    return toSong(s, meta);

    function fresh() {
      return {
        title: '', composer: '', ts: [4, 4], unit: 1 / 8, qpm: 120, key: 'C',
        voices: {}, voiceOrder: [], curVoice: '', lyricsW: []
      };
    }
    function ingest(s, line) {
      var hm = /^([A-Za-z])\s*:\s*(.*)$/.exec(line);
      if (hm && !/^[A-Ga-g][,']*\d/.test(line)) {
        var f = hm[1], v = hm[2].trim();
        if (f === 'T' && !s.title) s.title = v;
        else if (f === 'C') s.composer = v;
        else if (f === 'M') s.ts = parseMeter(v);
        else if (f === 'L') { var fr = /(\d+)\s*\/\s*(\d+)/.exec(v); if (fr) s.unit = +fr[1] / +fr[2]; }
        else if (f === 'Q') { var q = /(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/.exec(v); if (q) s.qpm = Math.round(+q[3] * (+q[1] / +q[2]) * 4); else { var q2 = /=\s*(\d+)/.exec(v); if (q2) s.qpm = +q2[1]; } }
        else if (f === 'K') s.key = v;
        else if (f === 'W') s.lyricsW.push(v);
        else if (f === 'V') { setVoice(s, v.split(/\s/)[0]); return; }
        if (f !== 'V') return;
      }
      if (/^\s*V\s*:/.test(line)) { setVoice(s, line.replace(/^\s*V\s*:\s*/, '').split(/\s/)[0]); return; }
      if (/^\s*%/.test(line) || /^\s*W\s*:/.test(line)) return;
      /* body */
      parseBody(s, line);
    }
    function setVoice(s, id) {
      if (!id) return;
      if (!s.voices[id]) { s.voices[id] = []; s.voiceOrder.push(id); }
      s.curVoice = id;
    }
    function parseMeter(v) {
      if (/^C\|/i.test(v)) return [2, 2];
      if (/^C/i.test(v)) return [4, 4];
      var m = /(\d+)\s*\/\s*(\d+)/.exec(v);
      return m ? [+m[1], +m[2]] : [4, 4];
    }
    function parseBody(s, line) {
      /* inline voice switch [V:2] */
      line = line.replace(/\[V:\s*([^\]]+)\]/g, function (mm, id) { setVoice(s, id.split(/\s/)[0]); return ' '; });
      if (!s.curVoice) setVoice(s, '1');
      var acc = keyAccidentsals(s.key);
      var barAcc = {};
      var evs = s.voices[s.curVoice];
      var i = 0;
      var pendingTie = false;
      while (i < line.length) {
        var c = line[i];
        if (c === '"') { var e2 = line.indexOf('"', i + 1); i = e2 < 0 ? i + 1 : e2 + 1; continue; }
        if (c === '%' ) break;
        if (c === '[' && /[A-Ga-g,_^=]/.test(line[i + 1] || '') && !/^\[V:/.test(line.slice(i))) {
          /* chord: parse until ] and take highest */
          var ce = line.indexOf(']', i);
          if (ce < 0) { i++; continue; }
          var inner = line.slice(i + 1, ce);
          var best = null, bestLen = null;
          var re = /([_=^]*)([A-Ga-g])([,']*)(\d*\/?\d*|\d*\/\d*)?/g, m2;
          while ((m2 = re.exec(inner))) {
            var nn = noteOf(s, acc, barAcc, m2[1], m2[2], m2[3], m2[4]);
            if (nn && (!best || nn.midi > best.midi)) { best = nn; bestLen = nn.beats; }
          }
          if (best) pushNote(evs, best.midi, bestLen, pendingTieCheck(line, ce));
          pendingTie = line[ce + 1] === '-';
          i = ce + 2;
          continue;
        }
        if (c === '{') { var ge = line.indexOf('}', i); i = ge < 0 ? i + 1 : ge + 1; continue; }
        if (c === '(' || c === ')' || c === 'H' || c === 'h' || c === 'y' || c === 'J' || c === 'u' || c === 'v' || c === 'T' || c === 'P' || c === 'L' || c === 'M' || c === '>' || c === '<') { i++; continue; }
        if (c === '|' || c === ':' || c === ']' && line[i + 1] !== '|') { if (c === '|') barAcc = {}; i++; continue; }
        if (c === 'z' || c === 'Z' || c === 'x') {
          var m3 = /^([zZx])(\d*\/?\d*|\d*\/\d*)?/.exec(line.slice(i));
          var bl = lenBeats(s, m3[2]);
          evs.push({ type: 'rest', beats: bl });
          i += m3[0].length;
          continue;
        }
        var m4 = /^([_=^]*)([A-Ga-g])([,']*)(\d*\/?\d*|\d*\/\d*)?/.exec(line.slice(i));
        if (m4 && m4[2]) {
          var n = noteOf(s, acc, barAcc, m4[1], m4[2], m4[3], m4[4]);
          var tie = line[i + m4[0].length] === '-';
          if (n) pushNote(evs, n.midi, n.beats, tie);
          pendingTie = tie;
          i += m4[0].length + (tie ? 1 : 0);
          continue;
        }
        i++;
      }
      function pushNote(evs, midi, beats, tie) {
        var l = evs[evs.length - 1];
        if (pendingTie && l && l.type === 'note' && l.midi === midi) { l.beats += beats; }
        else evs.push({ type: 'note', midi: midi, beats: beats });
        pendingTie = tie;
      }
      function pendingTieCheck(line, ce) { return line[ce + 1] === '-'; }
    }
    function noteOf(s, acc, barAcc, accs, letter, octs, lenStr) {
      var li = letter.toUpperCase();
      var a = 0;
      if (accs) { for (var i = 0; i < accs.length; i++) a += accs[i] === '^' ? 1 : accs[i] === '_' ? -1 : 0; if (accs[0] === '=') a = 0; }
      var pc;
      if (accs && accs[0] === '=') { pc = STEP[li]; barAcc[li] = 0; }
      else if (accs) { pc = STEP[li] + a; barAcc[li] = a; }
      else if (barAcc[li] != null) pc = STEP[li] + barAcc[li];
      else pc = STEP[li] + (acc[li] || 0);
      var oct = letter === letter.toLowerCase() ? 4 : 3;
      for (var j = 0; j < octs.length; j++) oct += octs[j] === ',' ? -1 : 1;
      return { midi: (oct + 1) * 12 + pc, beats: lenBeats(s, lenStr) };
    }
    function lenBeats(s, str) {
      var mult = 1;
      if (str) {
        var f = /^(\d*)\/(\d*)$/.exec(str);
        if (f) mult = (+f[1] || 1) / (+f[2] || 2);
        else if (/^\d+$/.test(str)) mult = +str;
        else if (/^\d+\/\d+$/.test(str)) { var g = str.split('/'); mult = +g[0] / +g[1]; }
      }
      var quarters = s.unit * mult * 4;
      return Math.max(0.125, Math.round(quarters * 8) / 8);
    }
  }

  function toSong(s, meta) {
    /* melody = first voice (ABC convention: top voice first) */
    var best = null;
    s.voiceOrder.forEach(function (v) {
      if (best) return;
      var evs = s.voices[v];
      if (evs && evs.some(function (e) { return e.type === 'note'; })) best = { evs: evs };
    });
    var events = (best ? best.evs : []).map(function (e) { return { type: e.type, midi: e.midi, beats: e.beats }; });
    if (!events.length) throw new Error('ABC_EMPTY');
    return {
      title: meta.title || s.title || 'ABC tune',
      titleEn: s.title || undefined,
      composer: s.composer || '',
      tempo: s.qpm || 120, ts: s.ts, events: events,
      source: meta.source || 'abc', sourceDetail: meta.sourceDetail || '',
      lyricsText: s.lyricsW.join('\n') || ''
    };
  }

  function isABC(text) { return /(^|\n)\s*X\s*:/.test(String(text)) && /(^|\n)\s*K\s*:/.test(String(text)); }

  K.abc = { parseABC: parseABC, isABC: isABC, keyAccidentsals: keyAccidentsals };
})(typeof window !== 'undefined' ? window : globalThis);
