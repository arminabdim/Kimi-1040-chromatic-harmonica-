/* Harmonica-like additive synthesizer (breath attack, vibrato, reed harmonics,
   slide-note bend scoop). Used for in-browser preview AND the MP3 export. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function renderPCM(tabSeq, tempo, sampleRate) {
    sampleRate = sampleRate || 44100;
    var spb = 60 / (tempo || 120);
    /* timeline */
    var total = 0.35;
    var evs = [];
    tabSeq.forEach(function (ev) {
      var dur = ev.beats * spb;
      if (ev.type === 'note' && ev.midi != null) evs.push({ t: total, dur: dur, midi: ev.midi, slide: !!(ev.fing && ev.fing.slide), breath: ev.fing ? ev.fing.breath : 'blow' });
      total += dur;
    });
    total += 1.2;
    var N = Math.ceil(total * sampleRate);
    var out = new Float32Array(N);
    var HARM = [1, 0.52, 0.30, 0.17, 0.095, 0.055, 0.03];
    for (var e = 0; e < evs.length; e++) {
      var ev = evs[e];
      var f0 = K.music.freq(ev.midi);
      var n0 = Math.floor(ev.t * sampleRate);
      var nd = Math.floor((ev.dur) * sampleRate);
      var rel = Math.min(0.14, ev.dur * 0.35);
      var nEnd = Math.min(N, n0 + nd + Math.ceil(rel * sampleRate));
      var atk = Math.min(0.045, ev.dur * 0.3);
      var phase = [0, 0, 0, 0, 0, 0, 0];
      var noisePrev = 0;
      for (var n = n0; n < nEnd; n++) {
        var tt = (n - n0) / sampleRate;
        /* envelope: breath attack, soft sustain, release */
        var env = tt < atk ? Math.pow(tt / atk, 1.6) : (tt < ev.dur ? 1 - 0.12 * (tt - atk) / Math.max(0.001, ev.dur - atk) : Math.max(0, 1 - (tt - ev.dur) / rel));
        if (env <= 0) continue;
        /* vibrato (hand tremolo) ramps in */
        var vibAmt = tt < 0.12 ? 0 : Math.min(1, (tt - 0.12) / 0.25);
        var vib = 1 + 0.0045 * vibAmt * Math.sin(2 * Math.PI * 5.3 * tt);
        /* slide notes scoop up from below */
        var scoop = ev.slide ? (0.975 + 0.025 * Math.min(1, tt / 0.07)) : (0.988 + 0.012 * Math.min(1, tt / 0.05));
        var f = f0 * vib * (tt < 0.09 ? scoop : 1);
        var s = 0;
        for (var h = 0; h < HARM.length; h++) {
          phase[h] += 2 * Math.PI * f * (h + 1) / sampleRate;
          if (phase[h] > 2 * Math.PI) phase[h] -= 2 * Math.PI;
          s += HARM[h] * Math.sin(phase[h]);
        }
        /* breath noise: sharp at attack, faint afterwards */
        var w = Math.random() * 2 - 1;
        var hp = w - noisePrev; noisePrev = w;
        s += hp * (0.10 * Math.exp(-tt / 0.045) + 0.006);
        out[n] += s * env * 0.24;
      }
    }
    /* normalize */
    var peak = 0;
    for (var i = 0; i < N; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0) { var g = 0.88 / peak; for (var j = 0; j < N; j++) out[j] *= g; }
    return { pcm: out, sampleRate: sampleRate, seconds: total };
  }

  /* event times in seconds (for SYLT / lrc sync) */
  function eventTimes(tabSeq, tempo) {
    var spb = 60 / (tempo || 120);
    var t = 0, out = [];
    tabSeq.forEach(function (ev) {
      out.push({ t: t, dur: ev.beats * spb, ev: ev });
      t += ev.beats * spb;
    });
    return out;
  }

  K.synth = { renderPCM: renderPCM, eventTimes: eventTimes };
})(typeof window !== 'undefined' ? window : globalThis);
