/* bilingual UI strings (Persian default + English) */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var D = {
    fa: {
      appTitle: 'تبدیل نت به تبلچر هارمونیکای کروماتیک',
      appSub: 'مخصوص QI MEI 1040 — کوک C، ۱۰ خانه، ۴۰ زبانه، با اسلایدر',
      tagline: 'نت آهنگ را از اینترنت پیدا کن، به تبلچر عددی تبدیل کن و خروجی PDF / MIDI / MP3 بگیر',
      tabSearch: 'جستجو در اینترنت', tabLibrary: 'کتابخانهٔ داخلی', tabFile: 'فایل MIDI', tabPaste: 'تایپ نت‌ها',
      songName: 'نام آهنگ (هر زبانی):', searchBtn: 'جستجوی بهترین نسخه', searching: 'در حال جستجو…',
      foundN: 'نتیجه پیدا شد:', trying: 'در حال ارزیابی:',
      results: 'نتیجه‌ها (بهترین نسخه خودکار انتخاب می‌شود):',
      pick: 'انتخاب', loaded: 'بارگذاری شد',
      libSelect: 'انتخاب آهنگ:', libLoad: 'بارگذاری',
      fileHint: 'یک فایل MIDI (.mid/.midi) از دستگاه خود انتخاب کنید:',
      pasteHint: 'نت‌ها را بنویسید (مثال: C4 D4:q E4/e R | T:=120 M:=4/4)',
      pasteLoad: 'تبدیل کن',
      options: 'تنظیمات', transpose: 'ترانسپوز (نیم‌پرده)', auto: 'خودکار', tempo: 'ضرباهنگ (BPM)',
      minSlide: 'کمینه‌کردن استفاده از اسلایدر', showPitch: 'نمایش نام نت‌ها',
      lyricsBox: 'متن آهنگ (اختیاری — سینک می‌شود):', lyricsPh: 'هر خط یک مصراع…',
      convert: 'ساخت تبلچر', play: 'پیش‌نوا', stop: 'توقف',
      exportHdr: 'خروجی‌ها', pdf: 'PDF', midi: 'MIDI', mp3: 'MP3', lrc: 'LRC', json: 'JSON',
      songHdr: 'آهنگ', notes: 'نت', bars: 'میزان', range: 'گسترهٔ ساز', source: 'منبع',
      legend: 'راهنمای تبلچر', legBlow: 'دمش (فوت کردن)', legDraw: 'مکش (دم گرفتن)', legSlide: 'اسلایدر فشرده',
      legRest: 'سکوت', legTie: 'ادامهٔ نت', legDot: 'نت نقطه‌دار', leg8: 'چنگ (۱/۸)', leg16: 'دولاچنگ (۱/۱۶)',
      page: 'صفحه', tempo: 'ضرباهنگ', timesig: 'کسر میزان', transposeLbl: 'ترانسپوز',
      footer: 'Kimi-1040 Chromatic Harmonica Tab Converter — QI MEI 1040 (10-hole chromatic, key of C)',
      status: 'آماده', errNoResults: 'نتیجه‌ای پیدا نشد. کتابخانهٔ داخلی یا فایل MIDI را امتحان کنید.',
      errNoMelody: 'ملودی قابل استفاده‌ای در این فایل پیدا نشد.', errNet: 'خطای شبکه/اینترنت.',
      done: 'انجام شد', building: 'در حال ساخت…', warnRange: 'هشدار: برخی نت‌ها خارج از گسترهٔ ساز هستند',
      langBtn: 'English', preview: 'پیش‌نمایش تبلچر', hole: 'خانه', breath: 'دم/مکش', slide: 'اسلایدر',
      note: 'نت', dur: 'کشش', lyric: 'خوانش', bar: 'میزان',
      offline: 'این برنامه کاملاً آفلاین هم کار می‌کند (به‌جز جستجوی اینترنتی).',
      searchedAs: 'جستجو با عبارت‌های:', bestPick: 'بهترین انتخاب', saveVault: 'ذخیره در گنجینه',
      savedVault: 'در گنجینهٔ آفلاین ذخیره شد', viewBtn: 'نمایش', noParseable: 'نتیجه‌هایی پیدا شد ولی هیچ‌کدوم نت قابل‌تبدیل نداشت؛ دکمهٔ «بارگذاری» یا «ذخیره» را برای نتایج دیگر امتحان کنید.',
      pdfOnly: 'این مورد PDF است و نت قابل استخراج ندارد؛ می‌توانید ذخیره یا تماشا کنید.',
      dbTab: 'گنجینهٔ آفلاین من', dbEmpty: 'هنوز چیزی ذخیره نکرده‌اید. از بخش جستجو، فایلی را «ذخیره در گنجینه» کنید تا همیشه آفلاین در دسترس باشد.',
      dbLoad: 'بارگذاری', dbFile: 'دریافت فایل', dbDel: 'حذف', dbRefresh: 'به‌روزرسانی',
      deviceNote: 'اجرا روی همهٔ دستگاه‌ها: موبایل، تبلت، رایانه — فقط یک مرورگر کافی است.'
    },
    en: {
      appTitle: 'Note → Tab converter for chromatic harmonica',
      appSub: 'For the QI MEI 1040 — key of C, 10 holes / 40 reeds, with slide',
      tagline: 'Find the song notes on the internet, convert to numeric tab, export PDF / MIDI / MP3',
      tabSearch: 'Internet search', tabLibrary: 'Built-in library', tabFile: 'MIDI file', tabPaste: 'Type notes',
      songName: 'Song name (any language):', searchBtn: 'Find best version', searching: 'Searching…',
      foundN: 'Results found:', trying: 'Evaluating:',
      results: 'Results (best version auto-selected):',
      pick: 'Pick', loaded: 'Loaded',
      libSelect: 'Choose song:', libLoad: 'Load',
      fileHint: 'Pick a MIDI file (.mid/.midi) from your device:',
      pasteHint: 'Type notes (e.g. C4 D4:q E4/e R | T:=120 M:=4/4)',
      pasteLoad: 'Convert',
      options: 'Options', transpose: 'Transpose (semitones)', auto: 'Auto', tempo: 'Tempo (BPM)',
      minSlide: 'Minimize slide usage', showPitch: 'Show pitch names',
      lyricsBox: 'Lyrics (optional — will be synced):', lyricsPh: 'One line per verse…',
      convert: 'Build tab', play: 'Preview', stop: 'Stop',
      exportHdr: 'Exports', pdf: 'PDF', midi: 'MIDI', mp3: 'MP3', lrc: 'LRC', json: 'JSON',
      songHdr: 'Song', notes: 'Notes', bars: 'Bars', range: 'Harp range', source: 'Source',
      legend: 'Tab legend', legBlow: 'Blow', legDraw: 'Draw', legSlide: 'Slide pressed',
      legRest: 'Rest', legTie: 'Tie / hold', legDot: 'Dotted', leg8: 'Eighth (1/8)', leg16: 'Sixteenth (1/16)',
      page: 'Page', tempo: 'Tempo', timesig: 'Time sig.', transposeLbl: 'Transpose',
      footer: 'Kimi-1040 Chromatic Harmonica Tab Converter — QI MEI 1040 (10-hole chromatic, key of C)',
      status: 'Ready', errNoResults: 'No results. Try the built-in library or a MIDI file.',
      errNoMelody: 'No usable melody found in this file.', errNet: 'Network/internet error.',
      done: 'Done', building: 'Building…', warnRange: 'Warning: some notes are out of the harp range',
      langBtn: 'فارسی', preview: 'Tab preview', hole: 'Hole', breath: 'Breath', slide: 'Slide',
      note: 'Note', dur: 'Dur.', lyric: 'Lyric', bar: 'Bar',
      offline: 'The app also works fully offline (except internet search).',
      searchedAs: 'Searched as:', bestPick: 'best pick', saveVault: 'Save to vault',
      savedVault: 'Saved to offline vault', viewBtn: 'View', noParseable: 'Results found but none had convertible notes; try Load/Save on other results.',
      pdfOnly: 'This item is a PDF (no extractable notes); you can save or view it.',
      dbTab: 'My offline vault', dbEmpty: 'Nothing saved yet. Use "Save to vault" on any search result to keep it offline forever.',
      dbLoad: 'Load', dbFile: 'Get file', dbDel: 'Delete', dbRefresh: 'Refresh',
      deviceNote: 'Runs on every device: phone, tablet, computer — just a browser.'
    }
  };
  var lang = 'fa';
  K.i18n = {
    get lang() { return lang; },
    set lang(v) { lang = D[v] ? v : 'fa'; },
    t: function (k) { return (D[lang] && D[lang][k]) || D.fa[k] || k; },
    sheet: function (extra) {
      var L = {};
      ['page', 'tempo', 'timesig', 'legend', 'legBlow', 'legDraw', 'legSlide', 'legRest', 'legTie', 'legDot', 'leg8', 'leg16', 'footer', 'source', 'range'].forEach(function (k) { L[k] = K.i18n.t(k); });
      L.transpose = K.i18n.t('transposeLbl');
      L.lang = lang;
      return Object.assign(L, extra || {});
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
