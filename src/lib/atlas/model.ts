import { affOf, NUKES, weightOf } from "./affinities";

export type Role = "defender" | "attacker" | "neutral" | "undecided";

export const THRESHOLD = 10;
export const COMMIT = 3;
export const CEIL = 18;
const K = 8;
const PASSES = 3;
const CASCADE_GAIN = 0.18;
const AMP = 0.01;
const AMP_CAP = 40;

const signOf = (r: Role | undefined): number =>
  r === "defender" ? 1 : r === "attacker" ? -1 : 0;

export type SolveResult = {
  scores: Record<string, number>;
  poles: number[];
  committed: number;
};

export function solve(
  roles: Record<string, Role>,
  names: string[],
): SolveResult {
  const P = [0, 0, 0, 0, 0, 0];
  const add = (name: string, s: number, gain = 1) => {
    const a = affOf(name);
    const w = weightOf(name) * gain * s;
    for (let i = 0; i < 6; i++) P[i] += a[i] * w;
  };
  for (const [name, role] of Object.entries(roles)) {
    const s = signOf(role);
    if (s) add(name, s);
  }

  let scores = new Map<string, number>();
  let committed = 0;

  for (let pass = 0; pass < PASSES; pass++) {
    const norm = Math.hypot(...P) || 1;
    const unit = P.map((v) => v / norm);
    scores = new Map();
    committed = 0;
    for (const name of names) {
      const role = roles[name];
      if (role === "neutral") {
        scores.set(name, 0);
        continue;
      }
      if (signOf(role)) {
        scores.set(name, signOf(role) * CEIL);
        committed++;
        continue;
      }
      const s =
        affOf(name).reduce((acc, v, i) => acc + v * unit[i], 0) *
        K *
        (1 + AMP * Math.min(committed, AMP_CAP));
      scores.set(name, s);
      if (Math.abs(s) > COMMIT) committed++;
    }
    if (pass === PASSES - 1) break;
    for (const name of names) {
      if (roles[name]) continue;
      const s = scores.get(name) ?? 0;
      if (Math.abs(s) > COMMIT)
        add(
          name,
          Math.sign(s),
          CASCADE_GAIN * Math.min(1, Math.abs(s) / THRESHOLD),
        );
    }
  }

  const dCount = [...scores.values()].filter((s) => s > COMMIT).length;
  const aCount = [...scores.values()].filter((s) => s < -COMMIT).length;
  const boost = (n: number, other: number) =>
    !n || !other
      ? 1
      : Math.max(0.85, Math.min(1.35, 1 + ((other - n) / Math.max(n, other)) * 0.35));
  const bD = boost(dCount, aCount);
  const bA = boost(aCount, dCount);

  const out: Record<string, number> = {};
  for (const [name, s] of scores) {
    if (signOf(roles[name])) {
      out[name] = s;
      continue;
    }
    const v = s * (s > 0 ? bD : bA);
    out[name] = +Math.max(-CEIL, Math.min(CEIL, v)).toFixed(2);
  }
  return { scores: out, poles: P, committed };
}

export const PRESETS: { label: string; defender: string | null; attacker: string | null }[] =
  [
    { label: "—", defender: null, attacker: null },
    { label: "North Korea vs South Korea", defender: "South Korea", attacker: "North Korea" },
    { label: "USA vs Russia", defender: "United States of America", attacker: "Russia" },
    { label: "USA vs China", defender: "United States of America", attacker: "China" },
    { label: "China vs Taiwan", defender: "Taiwan", attacker: "China" },
    { label: "Israel vs Iran", defender: "Israel", attacker: "Iran" },
    { label: "India vs Pakistan", defender: "India", attacker: "Pakistan" },
    { label: "India vs China", defender: "India", attacker: "China" },
    { label: "Russia vs Ukraine", defender: "Ukraine", attacker: "Russia" },
    { label: "Japan vs China", defender: "Japan", attacker: "China" },
    { label: "Saudi Arabia vs Iran", defender: "Saudi Arabia", attacker: "Iran" },
    { label: "Turkey vs Greece", defender: "Greece", attacker: "Turkey" },
    { label: "Egypt vs Ethiopia", defender: "Ethiopia", attacker: "Egypt" },
  ];

export const NUKE_NAMES = Object.keys(NUKES);

export const CYCLE: Role[] = ["undecided", "defender", "attacker", "neutral"];
export const nextRole = (cur: Role | undefined): Role =>
  CYCLE[(CYCLE.indexOf(cur ?? "undecided") + 1) % CYCLE.length];
