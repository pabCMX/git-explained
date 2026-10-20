import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

const DAYS = [
  { file: 'soup.docx', msg: 'First draft' },
  { file: 'soup_v2.docx', msg: 'Add leeks' },
  { file: 'soup_final.docx', msg: 'Less salt' },
  { file: 'soup_final_v2.docx', msg: "Grandma's notes" },
  { file: 'soup_FINAL_sam_edits.docx', msg: "Sam's edits" },
  { file: 'soup_FINAL_USE_THIS.docx', msg: 'Fix a typo' },
]

/** Lesson 1: saving copies by hand next to saving versions with Git, day by day. */
export function VersionChaos() {
  const [day, setDay] = useState(1)
  const shown = DAYS.slice(0, day)
  return (
    <section className="my-8 rounded-2xl border border-line bg-page p-3 sm:p-4" aria-label="Copies compared to Git">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Without Git</div>
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {shown.map((d, i) => (
                <motion.div
                  key={d.file}
                  initial={{ opacity: 0, x: -12, rotate: -2 }}
                  animate={{ opacity: 1, x: 0, rotate: i % 2 ? 0.6 : -0.6 }}
                  className="flex items-center gap-2 rounded-md bg-page px-2.5 py-1.5 font-mono text-sm"
                >
                  <FileIcon />
                  {d.file}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {day >= 4 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-ink-2">
              Which file is the newest? What changed in <code className="font-mono">final_v2</code>? Nobody knows.
            </motion.p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">With Git</div>
          <div className="flex items-center gap-2 rounded-md bg-page px-2.5 py-1.5 font-mono text-sm">
            <FileIcon />
            soup.txt
          </div>
          <div className="mt-4 text-xs text-muted">History, saved in a hidden .git folder:</div>
          <div className="relative mt-2 ml-2 border-l-2 border-[var(--lane-0)] pl-4">
            <AnimatePresence initial={false}>
              {shown.map((d) => (
                <motion.div
                  key={d.msg}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative py-1 text-sm"
                >
                  <span className="absolute top-2.5 -left-[23px] size-3 rounded-full border-2 border-surface bg-[var(--lane-0)]" />
                  {d.msg}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-surface p-4">
        <FileCountChart day={day} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={() => setDay(1)} disabled={day === 1} className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-grid disabled:opacity-40">
          Start over
        </button>
        <button
          onClick={() => setDay(day + 1)}
          disabled={day === DAYS.length}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          Next day ({day}/{DAYS.length})
        </button>
      </div>
    </section>
  )
}

// Bars: how many files are in the folder after each day. The data comes straight from the animation above.
function FileCountChart({ day }: { day: number }) {
  const W = 720
  const H = 170
  const left = 28
  const bottom = 24
  const top = 10
  const max = DAYS.length
  const groupW = (W - left - 130) / DAYS.length
  const barW = Math.min(18, groupW / 2 - 2)
  const y = (v: number) => H - bottom - (v / max) * (H - bottom - top)
  const series = [
    { name: 'Without Git', color: 'var(--lane-1)', value: (d: number) => d },
    { name: 'With Git', color: 'var(--lane-0)', value: () => 1 },
  ]
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Files in the folder</div>
        <div className="flex gap-4 text-xs text-ink-2">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[720px]" role="img" aria-label={`After day ${day}: ${day} files without Git, 1 file with Git.`}>
        {[0, 2, 4, 6].map((t) => (
          <g key={t}>
            <line x1={left} x2={W - 120} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {DAYS.map((_, i) => {
          const d = i + 1
          const gx = left + 8 + i * groupW
          return (
            <g key={d}>
              <text x={gx + barW + 1} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                Day {d}
              </text>
              {series.map((s, k) => {
                const v = d <= day ? s.value(d) : 0
                const h = (v / max) * (H - bottom - top)
                return (
                  <motion.path
                    key={s.name}
                    fill={s.color}
                    initial={false}
                    animate={{ d: barPath(gx + k * (barW + 2), H - bottom, barW, h) }}
                    transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                  >
                    <title>{`Day ${d}, ${s.name}: ${v} file${v === 1 ? '' : 's'}`}</title>
                  </motion.path>
                )
              })}
            </g>
          )
        })}
        {series.map((s) => {
          const v = s.value(day)
          return (
            <motion.text key={s.name} x={W - 112} animate={{ y: y(v) + 4 }} initial={false} fontSize={12} fill="var(--ink-2)">
              {s.name}: {v}
            </motion.text>
          )
        })}
      </svg>
    </div>
  )
}

// A bar with 4px rounded top corners and a flat base.
function barPath(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2)
  return `M ${x} ${base} L ${x} ${base - h + r} Q ${x} ${base - h} ${x + r} ${base - h} L ${x + w - r} ${base - h} Q ${x + w} ${base - h} ${x + w} ${base - h + r} L ${x + w} ${base} Z`
}

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5" />
  </svg>
)

const LOOP = [
  { cmd: 'git pull', text: 'Get the newest commits from the remote.' },
  { cmd: 'edit', text: 'Change your files the normal way, in any app.' },
  { cmd: 'git add', text: 'Pick the changes that belong together.' },
  { cmd: 'git commit', text: 'Save them as a snapshot with a short message.' },
  { cmd: 'git push', text: 'Send your new commits to the remote.' },
]

/** The usual daily routine as a loop. A dot moves around it and the active step is explained below. */
export function DailyLoop() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setI((n) => (n + 1) % LOOP.length), 1800)
    return () => clearInterval(t)
  }, [paused])
  const C = 130
  const R = 92
  const at = (k: number) => {
    const a = (k / LOOP.length) * Math.PI * 2 - Math.PI / 2
    return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) }
  }
  return (
    <section className="my-8 flex flex-col items-center gap-4 rounded-2xl border border-line bg-page p-4 sm:flex-row">
      <svg viewBox="0 0 260 260" className="w-60 shrink-0" role="img" aria-label="The daily loop: pull, edit, add, commit, push.">
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--grid)" strokeWidth={2} />
        <motion.circle r={7} fill="var(--accent)" animate={at(i)} initial={false} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
        {LOOP.map((s, k) => {
          const p = at(k)
          return (
            <g key={s.cmd} onMouseEnter={() => {
                setPaused(true)
                setI(k)
              }} onMouseLeave={() => setPaused(false)} className="cursor-default">
              <circle cx={p.x} cy={p.y} r={22} fill={k === i ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth={2} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill={k === i ? '#fff' : 'var(--ink)'}>
                {s.cmd.replace('git ', '')}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex-1">
        <div className="text-xs font-semibold tracking-wide text-muted uppercase">Step {i + 1} of 5</div>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div className="mt-1 font-mono text-lg">{LOOP[i]!.cmd === 'edit' ? 'You edit files' : LOOP[i]!.cmd}</div>
            <p className="mt-1 text-ink-2">{LOOP[i]!.text}</p>
          </motion.div>
        </AnimatePresence>
        <p className="mt-3 text-xs text-muted">Hover a step to stop the loop on it.</p>
      </div>
    </section>
  )
}
