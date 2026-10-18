// Stockage local (sur l'appareil). Tout est préfixé « caissa: ».
const P = 'caissa:';
export const store = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem(P + key);
      return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(P + key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('stockage plein ou indisponible', e); return false; }
  },
  del(key) { try { localStorage.removeItem(P + key); } catch { /* rien */ } },
  exportAll() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(P)) out[k.slice(P.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch { /* rien */ }
    return out;
  },
  importAll(obj) {
    for (const [k, v] of Object.entries(obj || {})) this.set(k, v);
  },
};

export const settings = {
  defaults: {
    playerName: 'Moi',
    apiKey: '',
    model: 'claude-sonnet-5-5',
    lichessUser: '',
    chesscomUser: '',
    sound: true,
    coords: true,
    analysisDepth: 13,
    puzzleSource: 'mixte',
  },
  get() { return { ...this.defaults, ...store.get('settings', {}) }; },
  set(patch) { store.set('settings', { ...this.get(), ...patch }); },
};

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
