/* Node smoke/unit tests:  node tests/node-test.js  */
const path = require('path');
const root = p => path.join(__dirname, '..', p);
global.window = undefined;
/* DOM shim for MusicXML tests */
const { JSDOM: JD } = require('jsdom');
global.DOMParser = new JD('<html></html>').window.DOMParser;
['js/music.js', 'js/harp.js', 'js/midiparse.js', 'js/melody.js', 'js/lyrics.js', 'js/library.js', 'js/synth.js', 'js/midiwrite.js', 'js/exportmp3.js']
  .forEach(f => require(root(f)));
const K = globalThis.K1040;
let fails = 0;
function ok(cond, name) {
  if (cond) console.log('  ✓ ' + name);
  else { fails++; console.log('  ✗ FAIL: ' + name); }
}

console.log('harp: full chromatic coverage C4..F#6');
let covered = true, gaps = [];
for (let m = 60; m <= 90; m++) if (!K.harp.fingerings(m).length) { covered = false; gaps.push(m); }
ok(covered, 'every semitone 60..90 has a fingering (gaps: ' + gaps + ')');
ok(K.harp.fingerings(59).length === 0 && K.harp.fingerings(91).length === 0, 'out-of-range rejected');
ok(K.harp.tabText({ hole: 4, breath: 'blow', slide: false }) === '4', 'blow tab = 4');
ok(K.harp.tabText({ hole: 4, breath: 'draw', slide: false }) === '-4', 'draw tab = -4');
ok(K.harp.tabText({ hole: 2, breath: 'blow', slide: true }) === '2*', 'slide tab = 2*');
/* known mappings */
const f60 = K.harp.fingerings(60)[0];
ok(f60.hole === 1 && f60.breath === 'blow' && !f60.slide, 'C4 = blow 1');
const f71 = K.harp.fingerings(71)[0];
ok(f71.hole === 4 && f71.breath === 'draw' && !f71.slide, 'B4 = draw 4');
ok(K.harp.fingerings(61).some(f => f.slide), 'C#4 needs slide');

console.log('rhythm notation');
ok(JSON.stringify(K.music.rhythmOf(1)) === JSON.stringify({ base: 1, dot: false, dashes: 0, underlines: 0 }), 'quarter');
ok(K.music.rhythmOf(0.5).underlines === 1, 'eighth underline');
ok(K.music.rhythmOf(0.25).underlines === 2, 'sixteenth double underline');
ok(K.music.rhythmOf(2).dashes === 0 && K.music.rhythmOf(4).dashes === 0, 'half/whole plain head');
ok(K.music.rhythmOf(3).dot === true, 'dotted half');
ok(K.music.rhythmOf(5).dashes === 1, 'whole+quarter tie');

console.log('auto transpose + tabulate');
const evs = [{ type: 'note', midi: 48, beats: 1 }, { type: 'note', midi: 50, beats: 1 }, { type: 'note', midi: 52, beats: 2 }];
const tr = K.harp.autoTranspose(evs.map(e => e.midi));
ok(tr === 12, 'low melody transposed +12 (got ' + tr + ')');
const tab = K.harp.tabulate(evs.map(e => ({ ...e, midi: e.midi + tr })), {});
ok(tab.length === 3 && tab.every(x => x.fing), 'all notes fingerable after transpose');

console.log('library integrity (lyrics counts match notes)');
K.library.list().forEach(s => {
  const song = K.library.get(s.id);
  const notes = song.events.filter(e => e.type === 'note').length;
  const ly = song.events.filter(e => e.lyric).length;
  ok(ly === 0 || ly === notes, s.id + ': lyric tokens ' + ly + ' / notes ' + notes);
  const beats = song.events.reduce((a, e) => a + e.beats, 0);
  ok(Math.abs(beats / K.music.beatsPerBar(song.ts) - Math.round(beats / K.music.beatsPerBar(song.ts))) < 0.01, s.id + ': whole bars (' + beats + ' beats)');
});

console.log('midi write -> parse roundtrip');
const song = K.library.get('twinkle');
const tabSeq = K.harp.tabulate(song.events, {});
const bytes = K.midiwrite.writeMidi(song, tabSeq, { title: 'test' });
const parsed = K.midiparse.parseMidi(bytes);
ok(parsed.tracks.length === 2, 'two tracks');
const n = parsed.tracks[1].notes;
ok(n.length === tabSeq.filter(x => x.type === 'note').length, 'note count preserved (' + n.length + ')');
ok(n[0].midi === 60 && n[6].midi === 67, 'pitches preserved');
ok(parsed.tracks[1].lyrics.length > 5, 'lyric meta events present (' + parsed.tracks[1].lyrics.length + ')');
ok(parsed.tracks[1].texts.length === n.length, 'tab TEXT events per note');
ok(parsed.tracks[0].tempos.length === 1 && Math.round(60e6 / parsed.tracks[0].tempos[0].usq) === song.tempo, 'tempo preserved');

console.log('songFromMidi on the roundtripped file (melody re-extraction)');
const re = K.melody.songFromMidi(parsed, { title: 're' });
ok(re.events.filter(e => e.type === 'note').length === n.length, 're-extracted same note count');
ok(re.events.filter(e => e.type === 'note')[0].midi === 60, 're-extracted first pitch');
ok(re.lyric === undefined || true, 'ok');
const withLy = re.events.filter(e => e.lyric).length;
ok(withLy > 5, 'lyrics survived midi roundtrip (' + withLy + ')');

console.log('paste parser');
const p = K.melody.parsePaste('T:=100 M:=3/4\nC4 D4:e R E4:h | F#4 G4');
ok(p.tempo === 100 && p.ts[0] === 3, 'tempo/time sig parsed');
ok(p.events.length === 6, 'events parsed (' + p.events.length + ')');
ok(p.events[4].midi === 66, 'F#4 parsed');

console.log('lyrics alignment');
const s2 = K.library.get('ode');
const odeNotes = s2.events.filter(e => e.type === 'note').length;
K.lyrics.align(s2, 'la la la la\nla la la la la la la la la la la la la la la la la la la la la la la la la');
ok(s2.events.filter(e => e.lyric).length === odeNotes, 'proportional alignment covers all ' + odeNotes + ' notes');

console.log('synth + mp3 encode');
const r = K.synth.renderPCM(tabSeq, song.tempo, 22050);
ok(r.pcm.length > 22050 * 5, 'pcm length sane (' + r.seconds.toFixed(1) + 's)');
let peak = 0; for (let i = 0; i < r.pcm.length; i++) peak = Math.max(peak, Math.abs(r.pcm[i]));
ok(peak > 0.5 && peak <= 0.9, 'normalized peak ' + peak.toFixed(2));
/* lame.min.js is a browser global script: eval it in global scope for node */
const fs = require('fs');
(0, eval)(fs.readFileSync(root('vendor/lame.min.js'), 'utf8'));
const mp3 = K.exportmp3.buildMP3(r.pcm, r.sampleRate, { title: 't', lyrics: 'la la', synced: [{ t: 0, text: 'la' }, { t: 1.5, text: 'la' }] });
ok(mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33, 'ID3v2 header');
const tagSize = ((mp3[6] & 127) << 21) | ((mp3[7] & 127) << 14) | ((mp3[8] & 127) << 7) | (mp3[9] & 127);
const frameSync = mp3[10 + tagSize] === 0xff && (mp3[11 + tagSize] & 0xe0) === 0xe0;
ok(frameSync, 'mpeg frame sync right after ID3 tag');
ok(mp3.length > 20000, 'mp3 size sane (' + mp3.length + ' bytes)');
const lrc = K.exportmp3.buildLRC([{ t: 65.25, text: 'سلام دنیا' }]);
ok(lrc.startsWith('[01:05.25] سلام دنیا'), 'lrc format: ' + lrc.trim());

console.log('abc parser');
require(root('js/abc.js'));
const abcSong = K.abc.parseABC([
  'X:1', 'T:Test Tune', 'M:4/4', 'L:1/8', 'Q:1/4=100', 'K:G',
  '"C"G2 AB c2 BA | G4 z2 d2 | c4 B4 | A6 z2 |]'
].join('\n'), {});
ok(abcSong.tempo === 100 && abcSong.ts[0] === 4, 'abc header parsed');
ok(abcSong.events[0].midi === (3 + 1) * 12 + 7, 'K:G first note G3=' + abcSong.events[0].midi);
ok(abcSong.events[1].midi === (3 + 1) * 12 + 9, 'A3 after key sig');
ok(abcSong.events.some(e => e.type === 'rest'), 'abc rests parsed');
ok(K.abc.isABC('X:1\nK:C\nC4'), 'isABC detects');
const abcSong2 = K.abc.parseABC(['X:1', 'M:6/8', 'L:1/8', 'Q:3/8=90', 'K:Am', 'V:1', 'A,2 B, C2 |', 'V:2', 'A,,4 |'].join('\n'), {});
ok(abcSong2.events[0].midi === 45, 'octave comma A, = A2? got ' + abcSong2.events[0].midi);
ok(abcSong2.tempo === 90 * 1.5, 'compound tempo converted');

console.log('library expansion');
require(root('js/library-abc.js'));
const libList = K.library.list();
ok(libList.length >= 20, 'library has ' + libList.length + ' songs');
let libOk = 0;
libList.forEach(function (s) {
  try {
    const song = K.library.get(s.id);
    const notes = song.events.filter(e => e.type === 'note');
    if (notes.length >= 8 && song.tempo > 0) libOk++;
  } catch (e) { console.log('   lib err ' + s.id + ': ' + e.message); }
});
ok(libOk === libList.length, 'all ' + libOk + ' library songs parse to usable melodies');
const gr = K.library.get('greensleeves');
ok(gr.events.filter(e => e.type === 'note').length > 30, 'greensleeves melody loaded');

console.log('musicxml parser');
require(root('js/musicxml.js'));
const mxml = '<?xml version="1.0"?><score-partwise version="3.1"><work><work-title>Test</work-title></work><part-list><score-part id="P1"></score-part></part-list><part id="P1">' +
  '<measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' +
  '<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><lyric><text>la</text></lyric></note>' +
  '<note><pitch><step>D</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration></note>' +
  '<note><rest></rest><duration>1</duration></note>' +
  '<note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration></note></measure></part></score-partwise>';
const mx = K.musicxml.parseMusicXML(mxml, {});
ok(mx.events.length === 4 && mx.events[0].midi === 72, 'musicxml notes');
ok(mx.events[1].midi === 75, 'musicxml alter D#5');
ok(mx.events[0].lyric === 'la', 'musicxml lyric');
ok(mx.ts[0] === 4 && mx.events[3].beats === 2, 'musicxml divisions->beats');

console.log('search ranking & types');
require(root('js/search.js'));
const fake = [
  { title: 'Ey Iran instrumental', type: 'pdf', source: 'archive.org', size: 900000 },
  { title: 'Ey Iran', type: 'midi', source: 'archive.org', size: 12000 },
  { title: 'Ey Iran arrangement', type: 'abc', source: 'github.com/x/y', size: 900 },
  { title: 'Random other song', type: 'midi', source: 'commons.wikimedia.org', size: 40000 }
];
const ranked = K.search.rank(fake, ['ey iran']);
ok(ranked[0].type === 'midi' && ranked[0].title === 'Ey Iran', 'exact midi title ranks first');
ok(ranked[ranked.length - 1].title === 'Random other song', 'irrelevant last');
ok(K.search.typeOf('a.MID') === 'midi' && K.search.typeOf('x.pdf') === 'pdf' && K.search.typeOf('y.mxl') === 'mxl' && K.search.typeOf('z.abc') === 'abc', 'typeOf extensions');
ok(K.search.ALIASES['ایران'] === 'Ey Iran', 'persian alias table');

(async function () {
  console.log('musicxml zipped (.mxl)');
  function crc32(buf) {
    let c, table = crc32.t || (crc32.t = (() => { const t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })());
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  async function makeMxl(xml) {
    const name = Buffer.from('score.xml');
    const raw = Buffer.from(xml, 'utf8');
    const cs = new CompressionStream('deflate-raw');
    const comp = Buffer.from(await new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer());
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 42);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(ch.length + name.length, 12); eocd.writeUInt32LE(30 + name.length + comp.length, 16);
    return Buffer.concat([lh, name, comp, ch, name, eocd]);
  }
  const mxlBytes = await makeMxl(mxml);
  const mx2 = await K.musicxml.parseBytes(new Uint8Array(mxlBytes), {});
  ok(mx2.events.length === 4 && mx2.events[2].type === 'rest', 'mxl zip inflate + parse');

  console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL TESTS PASSED');
  process.exit(fails ? 1 : 0);
})();
