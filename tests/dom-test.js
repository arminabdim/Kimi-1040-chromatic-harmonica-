/* jsdom integration test: loads index.html with all scripts, exercises the UI
   pipeline (convert, preview, language switch, sheet builder, exporters). */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = p => path.join(__dirname, '..', p);
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Could not parse CSS/.test(String(e))) console.log('JSDOM ERR:', e.message); });
vc.on('error', m => console.log('console.error:', m));

const html = fs.readFileSync(root('index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'file://' + root('index.html'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const { window } = dom;
let fails = 0;
const ok = (c, n) => { if (c) console.log('  ✓ ' + n); else { fails++; console.log('  ✗ FAIL: ' + n); } };

setTimeout(() => {
  const K = window.K1040;
  ok(!!K, 'K1040 namespace loaded');
  ok(!!window.lamejs && !!window.lamejs.Mp3Encoder, 'lamejs global available in page');
  ok(!!window.jspdf && !!window.html2canvas, 'pdf libs loaded');
  const doc = window.document;
  ok(doc.documentElement.dir === 'rtl' && doc.documentElement.lang === 'fa', 'default Persian RTL');
  ok(doc.getElementById('preview').children.length > 0, 'demo song preview rendered (' + doc.getElementById('preview').children.length + ' bars)');
  ok(/انجام|Done/.test(doc.getElementById('status').textContent), 'status shows done: ' + doc.getElementById('status').textContent);
  ok(doc.getElementById('info').textContent.includes('BPM'), 'info card filled');

  /* switch song + language */
  K.app.setSong(K.library.get('twinkle'));
  ok(doc.getElementById('preview').textContent.includes('-3'), 'preview has draw-tab numbers');
  ok(doc.getElementById('lyrics').value === '', 'built-in synced lyrics kept (textarea left for overrides)');
  doc.getElementById('langBtn').click();
  ok(doc.documentElement.dir === 'ltr' && doc.documentElement.lang === 'en', 'language switch to EN LTR');
  ok(doc.getElementById('optAuto').textContent.includes('Auto'), 'transpose auto label translated');
  doc.getElementById('langBtn').click();
  ok(doc.documentElement.dir === 'rtl', 'back to FA');

  /* transpose manual */
  const sel = doc.getElementById('transpose');
  sel.value = '5'; sel.dispatchEvent(new window.Event('change'));
  ok(K.app.state.transpose === 5, 'manual transpose applied');
  sel.value = 'auto'; sel.dispatchEvent(new window.Event('change'));
  ok(K.app.state.transpose === 0, 'auto transpose for twinkle = 0');

  /* paste input via UI */
  doc.getElementById('pasteArea').value = 'T:=100 M:=4/4\nC4 D4 E4:h R F4';
  doc.getElementById('pasteLoad').click();
  ok(K.app.state.song.events.length === 5, 'paste loaded 5 events');

  /* sheet builder structure */
  K.app.setSong(K.library.get('jingle'));
  const L = K.i18n.sheet();
  const wrap = K.exportpdf.buildSheet(K.app.state.song, K.app.state.tab, L, { transposeApplied: 0 });
  const cells = wrap.querySelectorAll('.sh-cell').length;
  ok(wrap.children.length >= 1, 'sheet pages: ' + wrap.children.length);
  ok(cells >= K.app.state.tab.length, 'sheet cells ' + cells + ' >= events ' + K.app.state.tab.length);
  ok(wrap.querySelectorAll('.sh-lyric').length > 0, 'lyric row present in sheet');
  ok(wrap.querySelector('.sh-legend') !== null, 'legend present in sheet');
  ok(wrap.querySelectorAll('.sh-barline').length >= 7, 'bar lines drawn: ' + wrap.querySelectorAll('.sh-barline').length);

  /* exporters that don't need canvas */
  const bytes = K.midiwrite.writeMidi(K.app.state.song, K.app.state.tab, { title: 'x' });
  ok(bytes.length > 200 && bytes[0] === 0x4d, 'midi bytes from page context');
  const pcm = K.synth.renderPCM(K.app.state.tab.slice(0, 6), 120, 22050);
  const mp3 = K.exportmp3.buildMP3(pcm.pcm, pcm.sampleRate, { title: 't', synced: [{ t: 0, text: 'جینگل' }] });
  ok(mp3[0] === 0x49 && mp3[1] === 0x44, 'mp3 id3 from page context');

  /* tab correctness spot-check on twinkle: first note C4 = blow 1 */
  K.app.setSong(K.library.get('twinkle'));
  const t0 = K.app.state.tab[0], t4 = K.app.state.tab[4];
  ok(t0.tab === '1', 'twinkle C4 -> blow 1 (got ' + t0.tab + ')');
  ok(t4.tab === '-3', 'twinkle A4 -> draw 3 (got ' + t4.tab + ')');
  ok(t4.lyric === 'lit', 'lyric synced to note in tab');

  console.log(fails ? '\n' + fails + ' DOM FAILURES' : '\nALL DOM TESTS PASSED');
  process.exit(fails ? 1 : 0);
}, 2500);
