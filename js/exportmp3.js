/* MP3 export: PCM (harmonica synth) -> lamejs encoder -> ID3v2.3 tag with
   TIT2/TPE1/TALB + USLT (full lyrics) + SYLT (time-synced lyrics, ms stamps).
   Also builds the companion .lrc (synced lyrics) file. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function utf16be(str) {
    var out = [0xfe, 0xff];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      out.push(c >> 8 & 255, c & 255);
    }
    return out;
  }
  function frame(id, payload) {
    var b = [id.charCodeAt(0), id.charCodeAt(1), id.charCodeAt(2), id.charCodeAt(3),
    payload.length >> 24 & 255, payload.length >> 16 & 255, payload.length >> 8 & 255, payload.length & 255, 0, 0];
    return b.concat(payload);
  }
  function textFrame(id, str) { return frame(id, [0x01].concat(utf16be(str))); }

  function id3tag(info) {
    var frames = [];
    frames.push(textFrame('TIT2', info.title));
    frames.push(textFrame('TPE1', info.artist || 'QI MEI 1040 Chromatic Harmonica'));
    frames.push(textFrame('TALB', info.album || 'Kimi-1040 Harmonica Tab Converter'));
    frames.push(textFrame('TENC', 'Kimi-1040 Tab Converter'));
    frames.push(textFrame('TYER', String(new Date().getFullYear())));
    if (info.lyrics) {
      /* USLT: encoding, lang(3), descriptor\0, text */
      var u = [0x01, 0x70, 0x65, 0x72].concat(utf16be(''), [0, 0]).concat(utf16be(info.lyrics));
      frames.push(frame('USLT', u));
    }
    if (info.synced && info.synced.length) {
      /* SYLT: encoding, lang(3), format=2(ms), content=1(lyrics), descriptor\0,
         then per syllable: text\0\0 + 4-byte ms timestamp */
      var s = [0x01, 0x70, 0x65, 0x72, 0x02, 0x01, 0x00, 0x00];
      info.synced.forEach(function (sy) {
        var t = utf16be(sy.text); t.push(0, 0);
        s = s.concat(t);
        var ms = Math.round(sy.t * 1000);
        s.push(ms >> 24 & 255, ms >> 16 & 255, ms >> 8 & 255, ms & 255);
      });
      frames.push(frame('SYLT', s));
    }
    var body = frames.reduce(function (a, f) { return a.concat(f); }, []);
    var size = body.length;
    var head = [0x49, 0x44, 0x33, 3, 0, 0,
      (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f];
    return new Uint8Array(head.concat(body));
  }

  function encodeMP3(pcm, sampleRate, kbps) {
    var lame = (G.lamejs || (G.module && G.module.exports));
    if (!lame) throw new Error('LAMEJS_MISSING');
    var samples = new Int16Array(pcm.length);
    for (var i = 0; i < pcm.length; i++) {
      var s = Math.max(-1, Math.min(1, pcm[i]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    var enc = new lame.Mp3Encoder(1, sampleRate, kbps || 160);
    var chunks = [], chunk = 1152;
    for (var o = 0; o < samples.length; o += chunk) {
      var buf = samples.subarray(o, Math.min(samples.length, o + chunk));
      var mp3buf = enc.encodeBuffer(buf);
      if (mp3buf.length) chunks.push(new Uint8Array(mp3buf));
    }
    var end = enc.flush();
    if (end.length) chunks.push(new Uint8Array(end));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0);
    var out = new Uint8Array(total);
    var p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  /* full mp3 file bytes (ID3 + audio) */
  function buildMP3(pcm, sampleRate, info) {
    var audio = encodeMP3(pcm, sampleRate);
    var tag = id3tag(info);
    var out = new Uint8Array(tag.length + audio.length);
    out.set(tag, 0); out.set(audio, tag.length);
    return out;
  }

  function buildLRC(lines) {
    return lines.map(function (l) {
      var m = Math.floor(l.t / 60), s = Math.floor(l.t % 60), c = Math.floor((l.t % 1) * 100);
      return '[' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c + '] ' + l.text;
    }).join('\n') + '\n';
  }

  K.exportmp3 = { buildMP3: buildMP3, buildLRC: buildLRC, id3tag: id3tag, encodeMP3: encodeMP3 };
})(typeof window !== 'undefined' ? window : globalThis);
