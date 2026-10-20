/* Standard MIDI File (type 0/1) parser - notes, tempo, time-sig, lyrics, texts */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function parseMidi(buf) {
    var dv = new DataView(buf.buffer ? buf.buffer : buf);
    var u8 = new Uint8Array(buf.buffer ? buf.buffer : buf);
    var p = 0;
    function str(n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u8[p++]); return s; }
    function u16() { var v = dv.getUint16(p); p += 2; return v; }
    function u32() { var v = dv.getUint32(p); p += 4; return v; }
    function vlq() {
      var v = 0, b;
      do { b = u8[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80);
      return v >>> 0;
    }
    if (str(4) !== 'MThd') throw new Error('NOT_MIDI');
    var hlen = u32(), format = u16(), ntrk = u16(), div = u16();
    p = 8 + hlen;
    var tpq = (div & 0x8000) ? 480 : div;
    var tracks = [];
    for (var t = 0; t < ntrk; t++) {
      if (p + 8 > u8.length) break;
      var cid = str(4);
      var len = u32();
      var end = p + len;
      var tr = { name: '', notes: [], lyrics: [], texts: [], tempos: [], timesigs: [], keysigs: [], channels: {} };
      if (cid === 'MTrk') {
        var tick = 0, run = 0;
        var open = {};
        while (p < end) {
          var d = vlq(); tick += d;
          var b = u8[p];
          var type;
          if (b & 0x80) { type = b; p++; run = type; } else { type = run; }
          var hi = type & 0xf0, ch = type & 0x0f;
          if (type === 0xff) {
            var mt = u8[p++]; var ml = vlq(); var mdata = u8.subarray(p, p + ml); p += ml;
            if (mt === 0x03) tr.name = decode(mdata);
            else if (mt === 0x01) tr.texts.push({ tick: tick, text: decode(mdata) });
            else if (mt === 0x05) tr.lyrics.push({ tick: tick, text: decode(mdata) });
            else if (mt === 0x51 && ml === 3) tr.tempos.push({ tick: tick, usq: (mdata[0] << 16) | (mdata[1] << 8) | mdata[2] });
            else if (mt === 0x58 && ml >= 2) tr.timesigs.push({ tick: tick, num: mdata[0], den: Math.pow(2, mdata[1]) });
            else if (mt === 0x59 && ml >= 2) tr.keysigs.push({ tick: tick, sf: mdata[0] | (mdata[1] ? -128 : 0), mi: mdata[1] });
          } else if (type === 0xf0 || type === 0xf7) {
            var sl = vlq(); p += sl;
          } else if (hi === 0x90 || hi === 0x80) {
            var n1 = u8[p++], v1 = u8[p++];
            tr.channels[ch] = 1;
            var key = ch + ':' + n1;
            if (hi === 0x90 && v1 > 0) {
              if (open[key]) { var pr = open[key]; tr.notes.push({ start: pr.tick, dur: Math.max(1, tick - pr.tick), midi: pr.midi, vel: pr.vel, ch: ch }); }
              open[key] = { tick: tick, midi: n1, vel: v1, ch: ch };
            } else {
              var on = open[key];
              if (on) { tr.notes.push({ start: on.tick, dur: Math.max(1, tick - on.tick), midi: on.midi, vel: on.vel, ch: ch }); delete open[key]; }
            }
          } else if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) { p += 2; }
          else if (hi === 0xc0 || hi === 0xd0) { p += 1; }
          else { p += 0; }
        }
        for (var k in open) { var o = open[k]; tr.notes.push({ start: o.tick, dur: tpq / 2, midi: o.midi, vel: o.vel, ch: o.ch }); }
      }
      p = end;
      tr.notes.sort(function (a, b) { return a.start - b.start || b.midi - a.midi; });
      tracks.push(tr);
    }
    return { format: format, tpq: tpq, tracks: tracks };
  }

  function decode(bytes) {
    try {
      if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    } catch (e) { }
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  /* tempo map -> seconds */
  function tempoMap(parsed) {
    var evs = [];
    parsed.tracks.forEach(function (tr) { tr.tempos.forEach(function (t) { evs.push(t); }); });
    evs.sort(function (a, b) { return a.tick - b.tick; });
    if (!evs.length) evs = [{ tick: 0, usq: 500000 }];
    return evs;
  }
  function tickToSec(map, tpq, tick) {
    var sec = 0, lastTick = 0, usq = map[0].usq;
    for (var i = 0; i < map.length; i++) {
      var e = map[i];
      if (e.tick >= tick) break;
      sec += (e.tick - lastTick) / tpq * (usq / 1e6);
      lastTick = e.tick; usq = e.usq;
    }
    sec += (tick - lastTick) / tpq * (usq / 1e6);
    return sec;
  }

  K.midiparse = { parseMidi: parseMidi, tempoMap: tempoMap, tickToSec: tickToSec };
})(typeof window !== 'undefined' ? window : globalThis);
