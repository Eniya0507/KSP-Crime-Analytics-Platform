// Deterministic seeded PRNG (mulberry32) for reproducible synthetic data
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

export function intIn(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function floatIn(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function bool(rng: Rng, p = 0.5): boolean {
  return rng() < p;
}

export function jitter(rng: Rng, base: number, amount: number): number {
  return base + (rng() - 0.5) * amount;
}

// Stable pseudo-random choice from a string key (no global RNG drift)
export function hashPick<T>(key: string, arr: readonly T[]): T {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return arr[Math.abs(h) % arr.length];
}

export function gauss(rng: Rng, mean: number, std: number): number {
  // Box-Muller
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
