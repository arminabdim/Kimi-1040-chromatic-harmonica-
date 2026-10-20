/* Built-in offline song library (public-domain melodies) with aligned lyrics.
   events: [noteName|'R', beats] ; lyrics: per-note tokens (null = no syllable) */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});

  function build(def) {
    var events = def.notes.map(function (n, i) {
      if (n[0] === 'R') return { type: 'rest', beats: n[1] };
      return { type: 'note', midi: K.music.nameToMidi(n[0]), beats: n[1], lyric: def.lyrics ? (def.lyrics[i] || null) : null, lyricLine: def.lines && def.lyrics ? def.lines[i] : null };
    });
    return {
      id: def.id, title: def.title, titleEn: def.titleEn, tempo: def.tempo, ts: def.ts,
      events: events, source: 'library', sourceDetail: def.note || '',
      lyricsText: def.lyricsText || ''
    };
  }

  var SONGS = [];

  SONGS.push(build({
    id: 'ode', title: 'سرود شادی (سمفونی نهم)', titleEn: 'Ode to Joy (Beethoven, Sym. 9)',
    tempo: 116, ts: [4, 4],
    notes: [['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1.5], ['D4', 0.5], ['D4', 2],
    ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['D4', 1.5], ['C4', 0.5], ['C4', 2]]
  }));

  SONGS.push(build({
    id: 'twinkle', title: 'ستاره کوچولو', titleEn: 'Twinkle Twinkle Little Star',
    tempo: 108, ts: [4, 4],
    notes: [['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
    ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
    ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2]],
    lyrics: ['Twin', 'kle', 'twin', 'kle', 'lit', 'tle', 'star,', 'how', 'I', 'won', 'der', 'what', 'you', 'are.',
      'Up', 'a', 'bove', 'the', 'world', 'so', 'high,', 'like', 'a', 'dia', 'mond', 'in', 'the', 'sky.',
      'Twin', 'kle', 'twin', 'kle', 'lit', 'tle', 'star,', 'how', 'I', 'won', 'der', 'what', 'you', 'are.'],
    lines: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    lyricsText: 'Twinkle twinkle little star, how I wonder what you are.\nUp above the world so high, like a diamond in the sky.\nTwinkle twinkle little star, how I wonder what you are.'
  }));

  SONGS.push(build({
    id: 'jingle', title: 'زنگوله‌ها (Jingle Bells)', titleEn: 'Jingle Bells',
    tempo: 124, ts: [4, 4],
    notes: [['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
    ['E4', 1], ['G4', 1], ['C4', 1], ['D4', 1], ['E4', 4],
    ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
    ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 4]],
    lyrics: ['Jin', 'gle', 'bells,', 'jin', 'gle', 'bells,', 'jin', 'gle', 'all', 'the', 'way!',
      'Oh', 'what', 'fun', 'it', 'is', 'to', 'ride', 'in', 'a', 'one-horse', 'o', 'pen', 'sleigh!'],
    lines: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    lyricsText: 'Jingle bells, jingle bells, jingle all the way!\nOh what fun it is to ride in a one-horse open sleigh!'
  }));

  SONGS.push(build({
    id: 'hb', title: 'تولد مبارک', titleEn: 'Happy Birthday',
    tempo: 100, ts: [3, 4],
    notes: [['R', 2], ['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 3],
    ['R', 2], ['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 3],
    ['R', 2], ['G4', 0.5], ['G4', 0.5], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 2], ['A4', 1],
    ['R', 2], ['F5', 0.5], ['F5', 0.5], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]],
    lyrics: [null, 'Hap', 'py', 'birth', 'day', 'to', 'you,', null, 'Hap', 'py', 'birth', 'day', 'to', 'you,',
      null, 'Hap', 'py', 'birth', 'day', 'dear', 'friend,', '–', null, 'Hap', 'py', 'birth', 'day', 'to', 'you!'],
    lines: [null, 0, 0, 0, 0, 0, 0, null, 1, 1, 1, 1, 1, 1, null, 2, 2, 2, 2, 2, 2, 2, null, 3, 3, 3, 3, 3, 3],
    lyricsText: 'Happy birthday to you,\nHappy birthday to you,\nHappy birthday dear friend,\nHappy birthday to you!'
  }));

  SONGS.push(build({
    id: 'mary', title: 'مری یک بره کوچولو داشت', titleEn: 'Mary Had a Little Lamb',
    tempo: 112, ts: [4, 4],
    notes: [['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 2],
    ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['G4', 1], ['G4', 2],
    ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
    ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 4]],
    lyrics: ['Ma', 'ry', 'had', 'a', 'lit', 'tle', 'lamb,', 'lit', 'tle', 'lamb,', 'lit', 'tle', 'lamb,',
      'Ma', 'ry', 'had', 'a', 'lit', 'tle', 'lamb,', 'its', 'fleece', 'was', 'white', 'as', 'snow.'],
    lines: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    lyricsText: 'Mary had a little lamb, little lamb, little lamb,\nMary had a little lamb, its fleece was white as snow.'
  }));

  K.library = {
    list: function () { return SONGS.map(function (s) { return { id: s.id, title: s.title, titleEn: s.titleEn }; }); },
    get: function (id) {
      var s = SONGS.filter(function (x) { return x.id === id; })[0];
      return s ? JSON.parse(JSON.stringify(s)) : null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
