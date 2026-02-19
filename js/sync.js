/**
 * sync.js — Firebase real-time sync for LivePoll
 */
const Sync = {
  db: null,
  sessionId: null,

  async init() {
    if (!SYNC_ENABLED) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      this.db = firebase.database();
      this.sessionId = this.sessionId || ('u' + Math.random().toString(36).slice(2, 9));
      return true;
    } catch (e) {
      console.error('[Sync] init failed:', e);
      return false;
    }
  },

  ref(path) { return this.db ? this.db.ref(path) : null; },

  async get(path) {
    const snap = await this.ref(path).once('value');
    return snap.exists() ? snap.val() : null;
  },

  async set(path, data) { await this.ref(path).set(data); },

  async update(path, data) { await this.ref(path).update(data); },

  on(path, cb) {
    const r = this.ref(path);
    if (r) r.on('value', snap => cb(snap.exists() ? snap.val() : null));
    return () => r && r.off();
  },

  offAll(path) { const r = this.ref(path); if (r) r.off(); },

  serverTime() { return firebase.database.ServerValue.TIMESTAMP; }
};
