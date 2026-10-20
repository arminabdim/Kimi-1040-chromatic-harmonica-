/* Standard MIDI File writer (type 1):
   track 0 = conductor (title, tempo, time-sig, markers)
   track 1 = harmonica part (GM program 22 "Harmonica") with per-note
             LYRIC meta (synced syllable) + TEXT meta (tab number)          */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var TPQ = 480;

  function vlq(v) {
    v = Math.max(0, Math.round(v));
    var bytes = [v & 0x7f];
    v >>= 7;
    while (v > 0) { bytes.unshift((v & 0x7f) | 0x80); v >>= 7; }
    return bytes;
  }
  function strBytes(s, utf8) {
    if (utf8 && typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s));
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128 || !utf8) out.push(c & 0xff);
      else if (c < 2048) { out.push(192 | (c >> 6), 128 | (c & 63)); }
      else { out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    return out;
  }
  function meta(type, data) { return [0xff, type].concat(vlq(data.length), data); }

  function writeMidi(song, tabSeq, opts) {
    opts = opts || {};
    var title = opts.title || song.title || 'Song';
    var usq = Math.round(60e6 / (song.tempo || 120));
    var t0 = [0x00].concat(meta(0x03, strBytes(String(title), true)),
      [0x00], meta(0x01, strBytes('Kimi-1040 Chromatic Harmonica Tab Converter - QI MEI 1040 (10-hole chromatic, key of C)', true)),
      [0x00], meta(0x51, [usq >> 16 & 255, usq >> 8 & 255, usq & 255]),
      [0x00], meta(0x58, [song.ts[0], Math.log2(song.ts[1]), 24, 8]),
      [0x00], meta(0x06, strBytes('tab legend: 4=blow  -4=draw  *=slide pressed', true)),
      [0x00, 0xff, 0x2f, 0x00]);

    /* note events */
    var evs = [];
    var tick = 0;
    tabSeq.forEach(function (ev, i) {
      var dur = Math.max(1, Math.round(ev.beats * TPQ));
      if (ev.type === 'note' && ev.midi != null) {
        var m = Math.min(127, Math.max(0, ev.midi));
        evs.push({ tick: tick + dur, ord: 0, b: [0x80, m, 64] });
        evs.push({ tick: tick, ord: 1, b: meta(0x01, strBytes(ev.tab || '', true)) });
        if (ev.lyric && ev.lyric !== '–') evs.push({ tick: tick, ord: 1, b: meta(0x05, strBytes(ev.lyric, true)) });
        evs.push({ tick: tick, ord: 2, b: [0x90, m, 100] });
      }
      tick += dur;
    });
    evs.push({ tick: tick, ord: 3, b: meta(0x2f, []) });
    evs.sort(function (a, b) { return a.tick - b.tick || a.ord - b.ord; });
    var t1 = [0x00].concat(meta(0x03, strBytes('Harmonica (QI MEI 1040) - tab in TEXT events, lyrics in LYRIC events', true)),
      [0x00, 0xc0, 21]);
    var last = 0;
    evs.forEach(function (e) { t1 = t1.concat(vlq(e.tick - last), e.b); last = e.tick; });

    function track(bytes) {
      var len = bytes.length;
      return strBytes('MTrk', false).concat([len >> 24 & 255, len >> 16 & 255, len >> 8 & 255, len & 255], bytes);
    }
    var head = strBytes('MThd', false).concat([0, 0, 0, 6, 0, 1, 0, 2, TPQ >> 8 & 255, TPQ & 255]);
    var all = head.concat(track(t0), track(t1));
    return new Uint8Array(all);
  }

  K.midiwrite = { writeMidi: writeMidi, TPQ: TPQ };
})(typeof window !== 'undefined' ? window : globalThis);
