/* Kimi-1040 (QI MEI 1040) 10-hole / 40-reed chromatic harmonica, key of C.
   Standard SOLO tuning (= first 10 holes of the 12-hole chromatic layout):
     hole:   1   2   3   4   5   6   7   8   9   10
     blow:   C4  E4  G4  C5  C5  E5  G5  C6  C6  E6
     draw:   D4  F4  A4  B4  D5  F5  A5  B5  D6  F6
     slide:  every note +1 semitone
   Range: C4 (midi 60) .. F6 (89), F#6 (90) with slide.                       */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var BLOW = [60, 64, 67, 72, 72, 76, 79, 84, 84, 88];
  var DRAW = [62, 65, 69, 71, 74, 77, 81, 83, 86, 89];
  var HOLES = 10;
  var MIN = 60, MAX = 90;

  /* midi -> list of fingerings */
  var FING = {};
  function add(midi, hole, breath, slide) {
    (FING[midi] = FING[midi] || []).push({ hole: hole, breath: breath, slide: slide });
  }
  for (var h = 0; h < HOLES; h++) {
    add(BLOW[h], h + 1, 'blow', false);
    add(BLOW[h] + 1, h + 1, 'blow', true);
    add(DRAW[h], h + 1, 'draw', false);
    add(DRAW[h] + 1, h + 1, 'draw', true);
  }

  function fingerings(midi) { return FING[midi] || []; }
  function inRange(midi) { return midi >= MIN && midi <= MAX; }

  /* tab text: blow = "4", draw = "-4", slide pressed = trailing "*"  */
  function tabText(f) {
    if (!f) return '?!';
    return (f.breath === 'draw' ? '-' : '') + f.hole + (f.slide ? '*' : '');
  }

  /* greedy ergonomic chooser: prefers no-slide, small hole jumps, few slide-state changes */
  function tabulate(events, opts) {
    opts = opts || {};
    var minSlide = opts.minSlide !== false;
    var prev = { hole: 4, breath: 'blow', slide: false };
    var out = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.type !== 'note') { out.push({ type: 'rest', beats: ev.beats, lyric: ev.lyric || null, lyricLine: ev.lyricLine }); continue; }
      var cands = fingerings(ev.midi);
      var chosen = null;
      if (cands.length) {
        var best = 1e9;
        for (var c = 0; c < cands.length; c++) {
          var f = cands[c];
          var cost = (f.slide ? (minSlide ? 1.4 : 0.4) : 0)
            + Math.abs(f.hole - prev.hole) * 0.18
            + (f.slide !== prev.slide ? 0.55 : 0)
            + (f.breath !== prev.breath ? 0.12 : 0)
            + (f.hole === prev.hole && f.breath === prev.breath && f.slide === prev.slide ? 0.05 : 0);
          if (cost < best) { best = cost; chosen = f; }
        }
        prev = chosen;
      }
      out.push({
        type: 'note', midi: ev.midi, beats: ev.beats, fing: chosen,
        tab: tabText(chosen), lyric: ev.lyric || null, lyricLine: ev.lyricLine,
        outOfRange: !chosen
      });
    }
    return out;
  }

  /* best transposition (semitones) so the melody fits C4..F#6 */
  function autoTranspose(midis) {
    if (!midis.length) return 0;
    var best = { t: 0, score: 1e9 };
    for (var t = -24; t <= 24; t++) {
      var out = 0, lo = 127, hi = -1;
      for (var i = 0; i < midis.length; i++) {
        var m = midis[i] + t;
        if (m < MIN || m > MAX) out++;
        if (m < lo) lo = m; if (m > hi) hi = m;
      }
      if (out) continue;
      var center = (lo + hi) / 2;
      var score = Math.abs(t) * 2 + Math.abs(center - 74) * 0.5 + (hi - lo < 12 ? 1 : 0);
      if (score < best.score) best = { t: t, score: score };
    }
    if (best.score === 1e9) { /* allow minimal out-of-range */
      for (var t2 = -24; t2 <= 24; t2++) {
        var o = 0;
        for (var j = 0; j < midis.length; j++) { var mm = midis[j] + t2; if (mm < MIN || mm > MAX) o++; }
        var sc = o * 100 + Math.abs(t2);
        if (sc < best.score) best = { t: t2, score: sc };
      }
    }
    return best.t;
  }

  K.harp = {
    BLOW: BLOW, DRAW: DRAW, HOLES: HOLES, MIN: MIN, MAX: MAX,
    fingerings: fingerings, inRange: inRange, tabText: tabText,
    tabulate: tabulate, autoTranspose: autoTranspose,
    rangeName: function () { return 'C4 – F6 (F#6*)'; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
