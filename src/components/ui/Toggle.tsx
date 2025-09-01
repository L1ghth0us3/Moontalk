export default function Toggle({ label, checked, onChange, info }: { label: string; checked: boolean; onChange: (v: boolean)=>void; info?: string }) {
  return (
    <label className="inline-flex items-center gap-2 select-none cursor-pointer">
      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={e=>onChange(e.target.checked)} />
      <span className="text-sm flex items-center gap-1">
        {label}
        {info && (
          <span className="relative group inline-flex">
            <span aria-label="info" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-600 cursor-help">i</span>
            <span className="pointer-events-none absolute left-0 top-full mt-2 z-50 hidden rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-snug text-neutral-900 shadow-xl whitespace-pre-wrap break-words text-left w-[max-content] max-w-[min(90vw,48rem)] group-hover:block" role="tooltip">{info}</span>
          </span>
        )}
      </span>
    </label>
  );
}

