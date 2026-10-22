import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

// One line the reader typed, or a note such as "You edit soup.txt", with the output under it.
// An entry with an empty cmd shows only its output.
export type Entry = { cmd: string; output: string[]; ok: boolean; note?: boolean }

/**
 * A dark terminal with a log and one input line. Up and Down go through the commands typed before.
 * `onEnter` gets the input when the reader presses Enter. With `allowEmpty`, Enter also works on an
 * empty input. `hint` shows above the input line.
 */
export function Terminal({
  log,
  input,
  setInput,
  onEnter,
  inputRef,
  hint,
  placeholder = 'type a command, then press Enter',
  allowEmpty = false,
  className = 'h-[380px]',
}: {
  log: Entry[]
  input: string
  setInput: (s: string) => void
  onEnter: (input: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  hint?: ReactNode
  placeholder?: string
  allowEmpty?: boolean
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const past = log.filter((e) => !e.note).map((e) => e.cmd)
  // Scroll the log itself, not the page, so the page does not jump.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log, hint])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (input.trim() || allowEmpty)) {
      e.preventDefault()
      onEnter(input)
      setCursor(null)
    } else if (e.key === 'ArrowUp' && past.length) {
      e.preventDefault()
      const c = cursor === null ? past.length - 1 : Math.max(0, cursor - 1)
      setCursor(c)
      setInput(past[c]!)
    } else if (e.key === 'ArrowDown' && cursor !== null) {
      e.preventDefault()
      const c = cursor + 1
      setCursor(c < past.length ? c : null)
      setInput(c < past.length ? past[c]! : '')
    }
  }

  return (
    <div
      className={`flex flex-col rounded-xl bg-[#141413] p-3 font-mono text-[13px] leading-6 text-[#f0efec] ${className}`}
      onClick={() => inputRef.current?.focus({ preventScroll: true })}
    >
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {log.map((e, i) => (
          <div key={i} className="mb-1">
            {e.note ? (
              <div className="text-[#c3c2b7]"># {e.cmd}</div>
            ) : (
              e.cmd && (
                <div>
                  <span className="text-[#5598e7]">cookbook $ </span>
                  {e.cmd}
                </div>
              )
            )}
            <OutputLines lines={e.output} ok={e.ok} />
          </div>
        ))}
        {hint}
      </div>
      <label className="flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="text-[#5598e7]">cookbook $</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={placeholder}
          aria-label="Command"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#898781]"
        />
      </label>
    </div>
  )
}

/** Terminal output with colors for diff lines and errors. */
export function OutputLines({ lines, ok }: { lines: string[]; ok: boolean }) {
  return (
    <>
      {lines.map((l, k) => (
        <div
          key={k}
          className={`whitespace-pre-wrap ${
            !ok && k === lines.length - 1
              ? 'text-[#e66767]'
              : l.startsWith('+ ')
                ? 'text-[#0ca30c]'
                : l.startsWith('- ') || l.startsWith('CONFLICT') || l.startsWith('!')
                  ? 'text-[#e66767]'
                  : 'text-[#c3c2b7]'
          }`}
        >
          {l}
        </div>
      ))}
    </>
  )
}
