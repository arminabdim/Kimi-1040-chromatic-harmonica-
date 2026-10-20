/* MusicXML reader: .xml (plain) and .mxl (zipped) -> Song events.
   Handles: partwise scores, divisions, time, tempo (sound/per-minute),
   notes with pitch/rest, chord (same onset), grace skip, backup/forward,
   first part = melody, <lyric><text> syllables synced to notes. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  async function unzipFirstXml(bytes) {
    var dv = new DataView(bytes.buffer || bytes);
    var u8 = new Uint8Array(bytes.buffer || bytes);
    /* find End Of Central Directory */
    var eocd = -1;
    for (var i = u8.length - 22; i >= 0 && i > u8.length - 70000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('NOT_ZIP');
    var count = dv.getUint16(eocd + 10, true);
    var off = dv.getUint32(eocd + 16, true);
    var entries = [];
    var p = off;
    for (var c = 0; c < count; c++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true);
      var elen = dv.getUint16(p + 30, true);
      var clen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = String.fromCharCode.apply(null, u8.subarray(p + 46, p + 46 + nlen));
      entries.push({ name: name, method: method, csize: csize, lho: lho });
      p += 46 + nlen + elen + clen;
    }
    var pick = entries.filter(function (e) { return /\.xml$/i.test(e.name) && !/META-INF/i.test(e.name); })[0]
      || entries.filter(function (e) { return !/\/$/.test(e.name); })[0];
    if (!pick) throw new Error('ZIP_NO_XML');
    /* local header -> data offset */
    var lh = pick.lho;
    var lnlen = dv.getUint16(lh + 26, true);
    var lelen = dv.getUint16(lh + 28, true);
    var start = lh + 30 + lnlen + lelen;
    var raw = u8.subarray(start, start + pick.csize);
    if (pick.method === 0) return new TextDecoder().decode(raw);
    if (pick.method === 8 && G.DecompressionStream) {
      var ds = new G.DecompressionStream('deflate-raw');
      var stream = new Blob([raw]).stream().pipeThrough(ds);
      var buf = await new Response(stream).arrayBuffer();
      return new TextDecoder().decode(buf);
    }
    throw new Error('ZIP_UNSUPPORTED');
  }

  function parseMusicXML(xmlText, meta) {
    meta = meta || {};
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML_PARSE');
    var parts = doc.getElementsByTagName('part');
    if (!parts.length) throw new Error('XML_NOPART');
    var part = parts[0];
    var divisions = 1, ts = [4, 4], tempo = null;
    var events = [], lyrics = [];
    var pos = 0; /* in divisions */
    var nodes = part.getElementsByTagName('*'); /* document order, includes measures */
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.nodeType !== 1) continue;
      var tag = el.tagName;
      if (tag === 'attributes') {
        var d = el.getElementsByTagName('divisions')[0];
        if (d) divisions = parseFloat(d.textContent) || 1;
        var t = el.getElementsByTagName('time')[0];
        if (t) {
          var b = t.getElementsByTagName('beats')[0], bt = t.getElementsByTagName('beat-type')[0];
          if (b && bt) ts = [parseInt(b.textContent, 10), parseInt(bt.textContent, 10)];
        }
      } else if (tag === 'direction') {
        var pm = el.getElementsByTagName('per-minute')[0];
        if (pm) tempo = Math.round(parseFloat(pm.textContent)) || tempo;
      } else if (tag === 'sound') {
        if (el.getAttribute('tempo')) tempo = Math.round(parseFloat(el.getAttribute('tempo'))) || tempo;
      } else if (tag === 'backup') {
        var bd = el.getElementsByTagName('duration')[0];
        if (bd) pos -= parseFloat(bd.textContent);
      } else if (tag === 'forward') {
        var fd = el.getElementsByTagName('duration')[0];
        if (fd) pos += parseFloat(fd.textContent);
      } else if (tag === 'note') {
        var dur = parseFloat((el.getElementsByTagName('duration')[0] || {}).textContent || '0');
        var isChord = el.getElementsByTagName('chord').length > 0;
        var isGrace = el.getElementsByTagName('grace').length > 0;
        var rest = el.getElementsByTagName('rest').length > 0;
        var lyricEl = el.getElementsByTagName('lyric')[0];
        var ltxt = lyricEl ? (lyricEl.getElementsByTagName('text')[0] || {}).textContent : null;
        if (isGrace) continue;
        var beats = Math.max(0.125, Math.round((dur / divisions) * 8) / 8) || 0.25;
        if (!isChord) {
          if (rest) events.push({ type: 'rest', beats: beats });
          else {
            var pit = el.getElementsByTagName('pitch')[0];
            if (pit) {
              var step = (pit.getElementsByTagName('step')[0] || {}).textContent || 'C';
              var alt = parseInt(((pit.getElementsByTagName('alter')[0] || {}).textContent || '0'), 10);
              var oct = parseInt(((pit.getElementsByTagName('octave')[0] || {}).textContent || '4'), 10);
              events.push({ type: 'note', midi: (oct + 1) * 12 + STEP[step.toUpperCase()] + alt, beats: beats });
            }
          }
          if (ltxt) lyrics.push({ idx: events.length - 1, text: String(ltxt) });
          pos += dur;
        }
      }
    }
    if (!events.length) throw new Error('XML_NONOTES');
    lyrics.forEach(function (l) { if (events[l.idx]) events[l.idx].lyric = l.text; });
    /* default tempo from time sig if unknown */
    if (!tempo) tempo = ts[1] === 8 ? 96 : 110;
    return {
      title: meta.title || ((doc.getElementsByTagName('work-title')[0] || doc.getElementsByTagName('movement-title')[0] || {}).textContent || 'MusicXML'),
      tempo: tempo, ts: ts, events: events,
      source: meta.source || 'musicxml', sourceDetail: meta.sourceDetail || '',
      lyricsText: ''
    };
  }

  async function parseBytes(bytes, meta) {
    var u8 = new Uint8Array(bytes.buffer || bytes);
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      return parseMusicXML(await unzipFirstXml(u8), meta);
    }
    return parseMusicXML(new TextDecoder().decode(u8), meta);
  }

  K.musicxml = { parseBytes: parseBytes, parseMusicXML: parseMusicXML, unzipFirstXml: unzipFirstXml };
})(typeof window !== 'undefined' ? window : globalThis);
