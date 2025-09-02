import React from "react";

type TabKey = "talk" | "translator";

export interface FolderTabsProps {
  value: TabKey;
  onChange: (next: TabKey) => void;
  rightActions?: React.ReactNode;
  /**
   * Background class for the active tab and the panel body (e.g., 'bg-white' or theme card bg).
   * Keep borders separate to avoid double outlines between tab and panel.
   */
  panelBgClass?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Folder-style two-tab control (“Talk Pad” | “Free Translator”) with ARIA tabs
 * semantics, full keyboard support, and responsive segmented fallback on small screens.
 * - Active tab is raised ~6–8px, rounded top corners, no bottom border, overlaps panel by 1px.
 * - Inactive tab sits on a lighter track; both tabs are equal width.
 * - Optional rightActions aligned to far right of the track.
 * - Panel background matches active tab; no top border (seamless join).
 */
export default function FolderTabs({ value, onChange, rightActions, panelBgClass = "bg-white", className = "", children }: FolderTabsProps){
  const tabs: { key: TabKey; label: string }[] = [
    { key: "talk", label: "Talk Pad" },
    { key: "translator", label: "Free Translator" },
  ];

  const [focusIndex, setFocusIndex] = React.useState<number>(() => Math.max(0, tabs.findIndex(t => t.key === value)));
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setFocusIndex(Math.max(0, tabs.findIndex(t => t.key === value)));
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = tabs.length - 1;
    if (e.key === "ArrowRight") { e.preventDefault(); setFocusIndex(i => Math.min(last, i + 1)); return; }
    if (e.key === "ArrowLeft")  { e.preventDefault(); setFocusIndex(i => Math.max(0, i - 1)); return; }
    if (e.key === "Home")       { e.preventDefault(); setFocusIndex(0); return; }
    if (e.key === "End")        { e.preventDefault(); setFocusIndex(last); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(tabs[focusIndex].key); return; }
  }

  return (
    <div className={className}>
      {/* Segmented control on small screens */}
      <div className="sm:hidden" role="tablist" aria-label="Composer (segmented)">
        <div className="inline-grid grid-cols-2 rounded-lg border border-neutral-200 overflow-hidden w-full">
          {tabs.map((t) => {
            const active = t.key === value;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                className={`px-3 py-2 text-sm font-medium ${active ? "bg-white" : "bg-neutral-50 hover:bg-neutral-100"} border-neutral-200 ${t.key === "translator" ? "border-l" : ""}`}
                onClick={()=>onChange(t.key)}
              >{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* Folder tabs on >= sm */}
      <div className="hidden sm:block">
        <div
          className="grid grid-cols-[1fr_1fr_auto] items-end gap-0"
          aria-label="Composer"
          role="tablist"
          ref={listRef}
          onKeyDown={onKeyDown}
        >
          {/* Track (left two columns) */}
          <div className="col-span-2 rounded-t-xl border border-neutral-200 bg-neutral-50 overflow-visible">
            <div className="grid grid-cols-2 gap-0">
              {tabs.map((t, idx) => {
                const active = t.key === value;
                const isLeft = idx === 0;
                const isRight = idx === 1;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${t.key}`}
                    id={`tab-${t.key}`}
                    tabIndex={focusIndex === idx ? 0 : -1}
                    className={
                      `h-10 flex items-center justify-center text-center font-medium ` +
                      (active
                        ? `relative z-10 -mb-px px-3 ${panelBgClass} border border-neutral-200 border-b-0 ` +
                          (isLeft ? "rounded-tl-xl" : "") + " " + (isRight ? "rounded-tr-xl" : "")
                        : `text-neutral-700 border border-transparent hover:bg-neutral-100 ` +
                          (isLeft ? "rounded-tl-xl" : "") + " " + (isRight ? "rounded-tr-xl" : ""))
                    }
                    onClick={()=>onChange(t.key)}
                    onFocus={()=>setFocusIndex(idx)}
                  >{t.label}</button>
                );
              })}
            </div>
            {/* Track bottom divider */}
            <div className="h-px bg-neutral-200" />
          </div>
          {/* Right actions in auto column */}
          <div className="justify-self-end ml-2">{rightActions}</div>
        </div>
      </div>

      {/* Panel */}
      <div
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`tab-${value}`}
        className={`-mt-px rounded-b-xl border border-neutral-200 border-t-0 p-4 ${panelBgClass}`}
      >
        {children}
      </div>
    </div>
  );
}
