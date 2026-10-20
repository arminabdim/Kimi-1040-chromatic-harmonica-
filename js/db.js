/* Internal offline database (IndexedDB) for downloaded scores/files.
   Once a result is downloaded it is stored here and usable fully offline.
   Falls back to an in-memory store when IndexedDB is unavailable. */
(function (G) {
  var K = (G.K1040 = G.K1040 || {});
  var DB = 'k1040-db', STORE = 'files';
  var mem = {};
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    if (!G.indexedDB) { dbp = Promise.resolve(null); return dbp; }
    dbp = new Promise(function (res) {
      var rq = G.indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { res(null); };
    });
    return dbp;
  }

  function req2p(rq) {
    return new Promise(function (res, rej) { rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { rej(rq.error); }; });
  }

  var api = {
    put: async function (rec) {
      rec.added = rec.added || Date.now();
      var db = await open();
      if (!db) { mem[rec.key] = rec; return; }
      await req2p(db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec));
    },
    all: async function () {
      var db = await open();
      if (!db) return Object.keys(mem).map(function (k) { return mem[k]; });
      var r = await req2p(db.transaction(STORE).objectStore(STORE).getAll());
      return (r || []).sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
    },
    get: async function (key) {
      var db = await open();
      if (!db) return mem[key] || null;
      return (await req2p(db.transaction(STORE).objectStore(STORE).get(key))) || null;
    },
    del: async function (key) {
      var db = await open();
      if (!db) { delete mem[key]; return; }
      await req2p(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key));
    }
  };
  K.db = api;
})(typeof window !== 'undefined' ? window : globalThis);
