"use client";
import { useEffect, useRef, useState } from "react";
import data from "./cities.json";

type City = { name: string; h: number; w: number; rings: number[][][] };
type Mode = "daily" | "free";
const CITIES = data as City[];
const W = 720, H = 440, GROUND = 350, X0 = 28, GAP = 56, REF_PX = 120, ROUNDS = 5;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const fmt = (km: number) => km.toLocaleString("he-IL", { maximumFractionDigits: km < 10 ? 1 : 0 });
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jerusalem" }).format(new Date()); // yyyy-mm-dd
const yesterday = (d: string) => new Date(Date.parse(d + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
// daily streak = consecutive days with a finished daily; shows 0 once a day is missed
const readStreak = () => {
  try {
    const s = JSON.parse(localStorage.getItem("siu-streak") || "null");
    if (s && (s.last === today() || s.last === yesterday(today()))) return s.n as number;
  } catch {}
  return 0;
};
const bumpStreak = () => {
  try {
    const d = today(), s = JSON.parse(localStorage.getItem("siu-streak") || "null");
    const n = s?.last === d ? s.n : s?.last === yesterday(d) ? s.n + 1 : 1;
    localStorage.setItem("siu-streak", JSON.stringify({ last: d, n }));
    return n as number;
  } catch { return 0; }
};
const seed = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const mulberry32 = (a: number) => () => { // small seeded PRNG: same date -> same puzzle for everyone
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function pickPairs(rand: () => number) {
  const used = new Set<string>();
  const out: { ref: City; target: City }[] = [];
  for (let i = 0; out.length < ROUNDS && i < 1000; i++) {
    const target = CITIES[Math.floor(rand() * CITIES.length)], ref = CITIES[Math.floor(rand() * CITIES.length)], q = target.h / ref.h;
    if (target === ref || used.has(target.name) || q < 0.25 || q > 4) continue;
    used.add(target.name);
    out.push({ ref, target });
  }
  return out;
}

// draw city hKm tall (km→px scale k), bottom on the ground line, left edge at ox
function path(ctx: CanvasRenderingContext2D, c: City, k: number, ox: number, hKm: number) {
  const s = (k * hKm) / c.h, top = GROUND - hKm * k;
  ctx.beginPath();
  for (const r of c.rings) {
    r.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * s, top + y * s) : ctx.moveTo(ox + x * s, top + y * s)));
    ctx.closePath();
  }
}

// center of the ⤢ resize handle (top-right corner of the target silhouette)
const handlePos = (c: { ref: City; target: City }, k: number, guess: number) => ({
  x: X0 + c.ref.w * k + GAP + c.target.w * k * (guess / c.target.h) + 14,
  y: GROUND - guess * k - 9,
});
const HIT = 26; // grab radius in canvas px

export default function Game() {
  const [mode, setMode] = useState<Mode>("daily");
  const [pairs, setPairs] = useState<ReturnType<typeof pickPairs>>([]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"guess" | "reveal" | "done">("guess");
  const [guess, setGuess] = useState(0); // km, the player's target height
  const [zoom, setZoom] = useState(1);
  const [scores, setScores] = useState<number[]>([]);
  const [t, setT] = useState(1); // animation progress 0..1 (intro while guessing, reveal after lock)
  const [grabbing, setGrabbing] = useState(false);
  const [hover, setHover] = useState(false);
  const [streak, setStreak] = useState(0);
  const grabDy = useRef(0); // pointer-to-handle offset at grab time, so the handle doesn't jump
  const canvas = useRef<HTMLCanvasElement>(null);
  const kLock = useRef(0); // view scale at the moment of locking, so the reveal can glide from it
  const raf = useRef(0);

  const play = (ms: number) => {
    cancelAnimationFrame(raf.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setT(1);
    const t0 = performance.now();
    const step = (now: number) => { const p = Math.min(1, (now - t0) / ms); setT(p); if (p < 1) raf.current = requestAnimationFrame(step); };
    setT(0); raf.current = requestAnimationFrame(step);
  };

  const start = (m: Mode) => {
    let saved: number[] = [];
    if (m === "daily") try {
      const s = JSON.parse(localStorage.getItem("siu-daily") || "null");
      if (s?.day === today() && Array.isArray(s.scores)) saved = s.scores;
    } catch {}
    setMode(m); setZoom(1); setScores(saved); setStreak(readStreak());
    setPairs(pickPairs(m === "daily" ? mulberry32(seed(today())) : Math.random));
    setRound(Math.min(saved.length, ROUNDS - 1));
    setPhase(saved.length >= ROUNDS ? "done" : "guess");
    play(600);
  };
  useEffect(() => start("daily"), []);
  const cur = pairs[round];
  useEffect(() => { if (cur) setGuess(cur.ref.h * 0.5); }, [cur]);

  const e = 1 - (1 - t) ** 3; // ease-out
  let k = 0;
  if (cur) {
    if (phase === "guess") k = (REF_PX / cur.ref.h) * zoom;
    else {
      const maxW = Math.max(cur.target.w, (cur.target.w * guess) / cur.target.h);
      const maxH = Math.max(cur.target.h, guess, cur.ref.h);
      const fit = Math.min((W - 2 * X0 - GAP) / (cur.ref.w + maxW), (GROUND - 110) / maxH);
      k = (kLock.current + (fit - kLock.current) * e) * zoom; // glide from the guessing view to fit-both
    }
  }

  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext("2d");
    if (!el || !ctx || !cur) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = W * dpr; el.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0e1c"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, GROUND, 0, H);
    g.addColorStop(0, "rgba(59,91,170,0.22)"); g.addColorStop(1, "rgba(59,91,170,0)");
    ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = "#2f4a8a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

    const { ref, target } = cur, rw = ref.w * k, ox = X0 + rw + GAP;
    const intro = phase === "guess" ? e : 1; // shapes grow up from the ground at the start of a round
    path(ctx, ref, k, X0, ref.h * intro); ctx.fillStyle = "#60a5fa"; ctx.fill("evenodd");
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(96,165,250,0.6)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0, GROUND - ref.h * k * intro); ctx.lineTo(X0 + rw, GROUND - ref.h * k * intro); ctx.stroke(); ctx.setLineDash([]);

    path(ctx, target, k, ox, guess * intro); ctx.fillStyle = "#e5121f"; ctx.fill("evenodd");
    if (phase === "guess") {
      const { x, y } = handlePos(cur, k, guess * intro);
      ctx.fillStyle = `rgba(255,255,255,${hover || grabbing ? 0.2 : 0.08})`;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e2e8f0"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⤢", x, y + 1);
    } else {
      path(ctx, target, k, ox, guess + (target.h - guess) * e); // true shape morphs from the guess to its real size
      ctx.fillStyle = "rgba(100,116,139,0.6)"; ctx.fill("evenodd");
    }

    // name labels under each silhouette, in the same color; stagger a row if they'd collide
    ctx.font = `700 15px ${getComputedStyle(el).fontFamily}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.direction = "rtl";
    const tw = Math.max(guess * intro, phase === "guess" ? 0 : guess + (target.h - guess) * e) * k * (target.w / target.h);
    const place = (name: string, cx: number) => { const w = ctx.measureText(name).width; return { name, w, x: clamp(cx - w / 2, 8, W - w - 8) }; };
    const a = place(ref.name, X0 + rw / 2), b = place(target.name, ox + tw / 2);
    const clash = b.x < a.x + a.w + 12 && a.x < b.x + b.w + 12;
    ctx.fillStyle = "#60a5fa"; ctx.fillText(a.name, a.x, GROUND + 26);
    ctx.fillStyle = "#f87171"; ctx.fillText(b.name, b.x, GROUND + (clash ? 52 : 26));
    ctx.direction = "ltr";
  }, [cur, k, guess, phase, e, hover, grabbing]);

  const pointer = (ev: React.PointerEvent) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  };
  const onHandle = (ev: React.PointerEvent) => {
    const p = pointer(ev), h = handlePos(cur, k, guess);
    return phase === "guess" && Math.hypot(p.x - h.x, p.y - h.y) < HIT;
  };
  const setFromPointer = (ev: React.PointerEvent) => {
    const y = pointer(ev).y - grabDy.current; // desired handle y
    setGuess(Math.max(cur.target.h * 0.02, (GROUND - 9 - clamp(y, 6, GROUND - 9)) / k));
  };

  const lock = () => {
    const ratio = Math.max(guess, cur.target.h) / Math.min(guess, cur.target.h);
    const next = [...scores, Math.round(100 * Math.max(0, 2 - ratio) ** 0.85)];
    if (mode === "daily") try { localStorage.setItem("siu-daily", JSON.stringify({ day: today(), scores: next })); } catch {}
    if (mode === "daily" && next.length === ROUNDS) setStreak(bumpStreak());
    kLock.current = k;
    setScores(next); setPhase("reveal"); setZoom(1); play(900);
  };
  const nextRound = () => {
    if (round + 1 === ROUNDS) return setPhase("done");
    setRound(round + 1); setPhase("guess"); setZoom(1); play(600);
  };

  if (!cur) return null;
  const last = scores[round] ?? 0, total = scores.reduce((a, b) => a + b, 0);
  const btn = "cursor-pointer rounded-2xl bg-accent px-5 py-2 text-sm font-semibold text-background shadow-[0_10px_22px_rgba(171,52,40,.24)] transition hover:brightness-110 active:scale-95";
  const zbtn = "h-9 w-9 cursor-pointer rounded-lg border border-border bg-background/80 text-lg leading-none transition hover:bg-border active:scale-90";
  const pill = (m: Mode) => `cursor-pointer rounded-full border px-4 py-1 text-xs font-semibold transition ${mode === m ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"}`;

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-3 py-8">
      <header className="border-b border-border/60 pb-4 text-center">
        <h1 dir="ltr" className="text-2xl font-bold tracking-tight">Size It Up: ערי ישראל</h1>
        <div className="mt-3 flex justify-center gap-2">
          <button className={pill("daily")} onClick={() => start("daily")}>אתגר יומי</button>
          <button className={pill("free")} onClick={() => start("free")}>משחק חופשי</button>
        </div>
        <p className="mt-3 text-sm text-muted">התאימו את הצללית לקנה המידה האמיתי שלה.</p>
        <p className="mt-2 font-mono text-xs tracking-wider text-muted">
          סיבוב <b className="text-foreground">{Math.min(round + 1, ROUNDS)}</b> / {ROUNDS} &nbsp; ניקוד <b className="text-foreground">{total}</b>
          {streak > 0 && <span title="ימים רצופים באתגר היומי"> &nbsp; 🔥 <b className="text-foreground">{streak}</b></span>}
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg font-bold">
        <span className="flex items-baseline gap-2 text-ref">
          <i className="size-2.5 self-center rounded-full bg-ref" />{cur.ref.name}
          <small className="text-xs font-normal text-muted">בקנה מידה</small>
        </span>
        <span className="text-sm font-normal text-muted">מול</span>
        <span className="flex items-baseline gap-2 text-accent">
          <i className="size-2.5 self-center rounded-full bg-accent" />{cur.target.name}
          <small className="text-xs font-normal text-muted">אורך צפון–דרום</small>
        </span>
      </div>

      <div className="relative mt-3" dir="ltr">
        <canvas
          ref={canvas} width={W} height={H} tabIndex={0} aria-label="גררו כדי לשנות את גודל העיר"
          className={`block h-auto w-full touch-none rounded-xl border-2 border-slate-800/90 ${grabbing ? "cursor-grabbing" : hover ? "cursor-ns-resize" : "cursor-default"}`}
          onPointerDown={(ev) => {
            if (!onHandle(ev)) return;
            grabDy.current = pointer(ev).y - handlePos(cur, k, guess).y;
            setGrabbing(true); ev.currentTarget.setPointerCapture(ev.pointerId);
          }}
          onPointerMove={(ev) => (grabbing ? setFromPointer(ev) : setHover(onHandle(ev)))}
          onPointerUp={() => setGrabbing(false)}
          onPointerCancel={() => setGrabbing(false)}
          onPointerLeave={() => setHover(false)}
          onKeyDown={(ev) => {
            if (phase !== "guess") return;
            const f = { ArrowUp: 1.04, ArrowRight: 1.04, ArrowDown: 1 / 1.04, ArrowLeft: 1 / 1.04 }[ev.key];
            if (f) { ev.preventDefault(); setGuess((g) => g * f); }
          }}
        />
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button className={zbtn} aria-label="הגדל תצוגה" onClick={() => setZoom((z) => clamp(z * 1.25, 0.2, 4))}>+</button>
          <button className={zbtn} aria-label="הקטן תצוגה" onClick={() => setZoom((z) => clamp(z / 1.25, 0.2, 4))}>−</button>
        </div>
        {phase === "reveal" && (
          <div key={round} className="pop absolute left-3 top-3 rounded-xl bg-background/80 p-3 text-right" dir="rtl">
            <div dir="ltr" className="text-5xl font-extrabold tabular-nums text-yellow-300">{Math.round(last * e)}<span className="text-base font-semibold text-muted"> / 100</span></div>
            <div className="mt-1 text-sm font-bold">התשובה שלך: {fmt(guess)} ק״מ</div>
            <div className="text-sm font-bold">בפועל: {fmt(cur.target.h)} ק״מ</div>
            <div className="text-xs text-muted">סטייה של {Math.round((Math.abs(guess - cur.target.h) / cur.target.h) * 100)}%</div>
          </div>
        )}
        {phase === "done" && (
          <div className="pop absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/85" dir="rtl">
            <div dir="ltr" className="text-6xl font-extrabold tabular-nums text-yellow-300">{total}<span className="text-xl text-muted"> / {ROUNDS * 100}</span></div>
            <div className="font-mono text-sm text-muted">{scores.join(" · ")}</div>
            {mode === "daily" ? (
              <p className="text-xs text-muted">{streak > 0 && <>🔥 רצף של {streak} {streak === 1 ? "יום" : "ימים"} · </>}אתגר חדש מחר · בינתיים אפשר <button className="cursor-pointer underline" onClick={() => start("free")}>לשחק חופשי</button></p>
            ) : (
              <button className={btn} onClick={() => start("free")}>שחקו שוב</button>
            )}
          </div>
        )}
      </div>

      <div className={`mt-4 flex items-center justify-center gap-4 ${phase === "done" ? "" : "border-t border-border/60 pt-4"}`}>
        {phase === "guess" && <button className={btn} onClick={lock}>נעל תשובה</button>}
        {phase === "reveal" && <button className={btn} onClick={nextRound}>{round + 1 === ROUNDS ? "לתוצאות" : "לסיבוב הבא ←"}</button>}
      </div>

      <footer className="mt-auto pt-10 text-center text-xs text-muted">גבולות עיריות: <bdi>© OpenStreetMap contributors (ODbL)</bdi></footer>
    </main>
  );
}
