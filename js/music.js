/* Kimi-1040 Chromatic Harmonica Tab Converter - core music utilities */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  function midiToName(m, flat) {
    var pc = ((m % 12) + 12) % 12;
    return (flat ? FLATS[pc] : NAMES[pc]) + (Math.floor(m / 12) - 1);
  }
  function nameToMidi(s) {
    var mm = /^\s*([A-Ga-g])\s*([#b♯♭]?)\s*(-?\d)\s*$/.exec(String(s));
    if (!mm) return null;
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[mm[1].toUpperCase()];
    var acc = mm[2] === '#' || mm[2] === '♯' ? 1 : mm[2] === 'b' || mm[2] === '♭' ? -1 : 0;
    return (parseInt(mm[3], 10) + 1) * 12 + base + acc;
  }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var DUR_LETTERS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

  /* beats -> rhythm display info: {base, dot, dashes, underlines}
     base in beats; underlines: 1 = eighth, 2 = sixteenth; dot = dotted; dashes = tie quarters */
  function rhythmOf(beats) {
    beats = Math.round(beats * 100) / 100;
    var bases = [4, 2, 1, 0.5, 0.25];
    for (var i = 0; i < bases.length; i++) {
      var b = bases[i];
      var plain = Math.abs(beats - b) < 0.011;
      var dotted = Math.abs(beats - b * 1.5) < 0.011;
      if (plain || dotted) return mk(b, dotted, 0);
    }
    /* ties: base(+dot) + whole-quarter dashes */
    for (var j = 0; j < bases.length; j++) {
      var bb = bases[j];
      for (var d = 0; d <= 1; d++) {
        var head = d ? bb * 1.5 : bb;
        if (beats > head + 0.01) {
          var rem = beats - head;
          if (Math.abs(rem - Math.round(rem)) < 0.011 && Math.round(rem) >= 1) {
            return mk(bb, !!d, Math.round(rem));
          }
        }
      }
    }
    return mk(1, false, 0);
    function mk(base, dot, dashes) {
      return {
        base: base, dot: dot, dashes: dashes,
        underlines: base <= 0.25 ? 2 : base <= 0.5 ? 1 : 0
      };
    }
  }

  function beatsPerBar(ts) { return ts[0] * (4 / ts[1]); }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec % 1) * 100);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
  }

  K.music = {
    NAMES: NAMES, FLATS: FLATS,
    midiToName: midiToName, nameToMidi: nameToMidi, freq: freq,
    DUR_LETTERS: DUR_LETTERS, rhythmOf: rhythmOf, beatsPerBar: beatsPerBar, fmtTime: fmtTime
  };
})(typeof window !== 'undefined' ? window : globalThis);
