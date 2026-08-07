import { useState } from 'react'
import { Code2, X } from 'lucide-react'
import { SWIFT_SNIPPETS } from '../swiftSnippets'

export function SwiftSourceViewer({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(0)
  const snippet = SWIFT_SNIPPETS[active]

  // remove Swift comments (line // and block /* */) for a cleaner in-app view
  const stripComments = (code: string) => {
    // remove block comments first
    let out = code.replace(/\/\*[\s\S]*?\*\//g, '')
    // remove line comments
    out = out.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1')
    return out.trim()
  }
  const displayCode = stripComments(snippet.code)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Native Swift Source</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-zinc-800">
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 shrink-0 overflow-y-auto border-r border-zinc-800 p-2">
            {SWIFT_SNIPPETS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setActive(i)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                  active === i ? 'bg-blue-600/20 text-blue-300' : 'text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                {s.title}
              </button>
            ))}
            <div className="mt-3 rounded-lg bg-zinc-900/70 p-3 text-[10px] leading-relaxed text-zinc-500">
              Full compilable project files are in the{' '}
              <span className="text-zinc-300">/ios-app</span> directory of this repo — ready to drop
              into Xcode.
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <p className="border-b border-zinc-900 bg-zinc-900/40 px-4 py-2 font-mono text-[11px] text-zinc-500">
              {snippet.file}
            </p>
            <pre className="p-4 text-[12px] leading-relaxed text-zinc-200">
              <code>{displayCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
