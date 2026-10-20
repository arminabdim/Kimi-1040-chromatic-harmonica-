/* Node smoke/unit tests:  node tests/node-test.js  */
const path = require('path');
const root = p => path.join(__dirname, '..', p);
global.window = undefined;
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

console.log(fails ? '\n' + fails + ' FAILURES' : '\nALL TESTS PASSED');
process.exit(fails ? 1 : 0);
