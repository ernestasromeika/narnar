// Shared by terrain, water, navigation and both maps. Angles run clockwise from east.
export const COAST_RADII = [
  1.03, 1.08, 1.01, 0.97, 0.98, 0.95, 0.94, 0.97, 1.06, 1.08, 0.97, 0.94, 0.96,
  1.1, 1.04, 1.01, 1.08, 1.04, 1.02, 1.08, 1.15, 1.1, 0.96, 0.93,
];
export const WATER_LEVEL = 0;
export const MAX_WADING_DEPTH = 0.52;
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function coastRadius(angle) {
  const p = ((angle / (Math.PI * 2) + 1) % 1) * 24,
    i = Math.floor(p),
    t = smooth(0, 1, p - i);
  return COAST_RADII[i % 24] * (1 - t) + COAST_RADII[(i + 1) % 24] * t;
}
export function shoreDistance(x, z) {
  const r = Math.hypot(x / 113, z / 103);
  return (coastRadius(Math.atan2(z / 103, x / 113)) - r) * 108;
}
export function ground(x, z) {
  const d = shoreDistance(x, z);
  if (d < 0) return Math.max(-9, d * 0.15);
  const inland =
    1.5 +
    Math.sin(x * 0.045) * 0.5 +
    Math.cos(z * 0.047) * 0.5 +
    Math.max(0, -z - 28) * 0.035;
  return inland * smooth(0, 12, d);
}
export const land = (x, z) => shoreDistance(x, z) > 0;
export const walkable = (x, z) =>
  ground(x, z) >= WATER_LEVEL - MAX_WADING_DEPTH;
export const waterDepth = (x, z) => Math.max(0, WATER_LEVEL - ground(x, z));
export function coastOutline(inset = 0, count = 192) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2,
      r = coastRadius(a) - inset / 108;
    return { x: Math.cos(a) * 113 * r, z: Math.sin(a) * 103 * r };
  });
}

export const MORNING_END = 60;
export const DAY_END = 240;
export const NIGHT_START = 360;
export const DAY_LENGTH = 450;
export function dayCycle(seconds) {
  const time = ((seconds % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH,
    day = Math.floor(seconds / DAY_LENGTH) + 1;
  const anchors = [
    [0, 0.65],
    [MORNING_END, 1],
    [DAY_END, 0.85],
    [NIGHT_START - 30, 0.12],
    [NIGHT_START + 10, 0],
    [DAY_LENGTH - 22.5, 0],
    [DAY_LENGTH, 0.65],
  ];
  const i = anchors.findIndex(
    (a, j) =>
      j < anchors.length - 1 && time >= a[0] && time < anchors[j + 1][0],
  );
  const [a, b] = [anchors[i], anchors[i + 1]],
    light = a[1] + (b[1] - a[1]) * smooth(a[0], b[0], time);
  const night = time >= NIGHT_START,
    goingHome = time >= NIGHT_START - 40 && time < NIGHT_START,
    waking = day > 1 && time < 20;
  const commute = night
    ? 1
    : goingHome
      ? smooth(NIGHT_START - 40, NIGHT_START, time)
      : waking
        ? 1 - smooth(0, 20, time)
        : 0;
  const hour =
    time < MORNING_END
      ? 7 + (time * 3) / MORNING_END
      : time < DAY_END
        ? 10 + ((time - MORNING_END) * 8) / (DAY_END - MORNING_END)
        : time < NIGHT_START
          ? 18 + ((time - DAY_END) * 3) / (NIGHT_START - DAY_END)
          : 21 + ((time - NIGHT_START) * 10) / (DAY_LENGTH - NIGHT_START);
  const minutes = Math.floor(hour * 60 + 0.000001),
    h = Math.floor(minutes / 60) % 24,
    m = minutes % 60;
  return {
    time,
    day,
    hour,
    light,
    night,
    goingHome,
    waking,
    commute,
    available: !night && !goingHome && !waking,
    label: night
      ? 'Moonlit night'
      : time < MORNING_END
        ? 'Morning light'
        : time < DAY_END
          ? 'Daylight'
          : 'Evening glow',
    clock: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}
