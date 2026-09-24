import { ITEMS, TRADES, NOTES, RESOURCES, CHIMES } from './content.js';
export const SAVE_KEY = 'narnar-save-v1';
export const initialState = () => ({
  version: 1,
  step: 0,
  inventory: [{ id: 'pomegranate', qty: 1 }],
  storage: [],
  x: -33,
  z: 62,
  playtime: 0,
  notes: [],
  gathered: [],
  chimes: [],
  met: [],
  sidequests: [],
  started: false,
  retired: false,
  scenes: [],
  settings: { sound: true, music: true, reducedMotion: false, volume: 0.45 },
  savedAt: null,
});
export function validSave(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Number.isInteger(s.step) ||
    s.step < 0 ||
    s.step > TRADES.length
  )
    return false;
  if (
    !Number.isFinite(s.x) ||
    !Number.isFinite(s.z) ||
    Math.abs(s.x) > 130 ||
    Math.abs(s.z) > 115 ||
    !Number.isFinite(s.playtime) ||
    s.playtime < 0
  )
    return false;
  for (const k of ['inventory', 'storage'])
    if (
      !Array.isArray(s[k]) ||
      s[k].length > (k === 'inventory' ? 6 : 40) ||
      s[k].some(
        (a) =>
          !a ||
          !ITEMS[a.id] ||
          !Number.isInteger(a.qty) ||
          a.qty < 1 ||
          a.qty > 999,
      ) ||
      new Set(s[k].map((a) => a.id)).size !== s[k].length
    )
      return false;
  const allowed = {
    notes: NOTES.map((a) => a.id),
    gathered: RESOURCES.map((a) => a.id),
    chimes: CHIMES.map((a) => a.id),
    sidequests: ['glass'],
    scenes: ['intro', 'first', 'middle', 'end'],
  };
  for (const [k, ids] of Object.entries(allowed))
    if (!Array.isArray(s[k]) || s[k].some((id) => !ids.includes(id)))
      return false;
  if (
    !Array.isArray(s.met) ||
    s.met.some((a) => typeof a !== 'string') ||
    typeof s.started !== 'boolean' ||
    typeof s.retired !== 'boolean' ||
    s.retired !== (s.step === TRADES.length)
  )
    return false;
  return (
    !!s.settings &&
    ['sound', 'music', 'reducedMotion'].every(
      (k) => typeof s.settings[k] === 'boolean',
    ) &&
    Number.isFinite(s.settings.volume) &&
    s.settings.volume >= 0 &&
    s.settings.volume <= 1
  );
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return validSave(s) ? s : null;
  } catch {
    return null;
  }
}
export function saveState(s) {
  s.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
export function quantity(s, id) {
  return s.inventory.find((a) => a.id === id)?.qty || 0;
}
export function addItem(s, id, qty = 1) {
  const a = s.inventory.find((a) => a.id === id);
  if (a) {
    a.qty += qty;
    return true;
  }
  if (s.inventory.length === 6) return false;
  s.inventory.push({ id, qty });
  return true;
}
export function tradeCheck(s, t) {
  if (!t || s.step !== t.id)
    return { ok: false, reason: 'That trade is not ready yet.' };
  const needs = {};
  t.needs.forEach((id) => (needs[id] = (needs[id] || 0) + 1));
  for (const [id, n] of Object.entries(needs))
    if (quantity(s, id) < n)
      return {
        ok: false,
        reason: `Still needed: ${n - quantity(s, id)} ${ITEMS[id][0]}.`,
      };
  if (t.chime && s.chimes.length < 3)
    return {
      ok: false,
      reason: 'Play the wind chimes in order: Orchard → Pines → Rise.',
    };
  const copy = structuredClone(s);
  for (const [id, n] of Object.entries(needs)) {
    copy.inventory.find((a) => a.id === id).qty -= n;
  }
  copy.inventory = copy.inventory.filter((a) => a.qty > 0);
  for (const id of t.gives)
    if (!addItem(copy, id))
      return {
        ok: false,
        reason:
          'Your six pockets are full. Store an item in your travel trunk.',
      };
  return { ok: true, inventory: copy.inventory };
}
export function completeTrade(s, t) {
  const result = tradeCheck(s, t);
  if (!result.ok) return result;
  s.inventory = result.inventory;
  s.step++;
  if (s.step === TRADES.length) s.retired = true;
  return result;
}
export function storeItem(s, id) {
  const i = s.inventory.findIndex((a) => a.id === id);
  if (i < 0) return false;
  const a = s.inventory.splice(i, 1)[0],
    b = s.storage.find((a) => a.id === id);
  if (b) b.qty += a.qty;
  else s.storage.push(a);
  return true;
}
export function retrieveItem(s, id) {
  const i = s.storage.findIndex((a) => a.id === id);
  if (i < 0) return false;
  const a = s.storage[i];
  if (!addItem(s, id, a.qty)) return false;
  s.storage.splice(i, 1);
  return true;
}
