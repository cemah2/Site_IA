"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { cx } from "@/components/ui";
import {
  SEARCH_INDEX,
  SEARCH_SUGGESTIONS,
  search,
  type SearchEntry,
  type SearchHit,
} from "@/lib/search";

/**
 * Ctrl-K search over every page and every glossary entry.
 *
 * The sidebar lists thirty-six pages in seven sections, which works when you
 * know where you are going and fails completely when you know a word instead:
 * "kernel" is on the SVM page, "gini" on the decision tree, "leakage" nowhere
 * a title would suggest. This is the answer to "I know the term, where is it".
 *
 * Opened by Ctrl-K or ⌘K, by "/" outside a text field, or by the visible
 * buttons in the rail and the mobile header — the shortcut alone would be
 * invisible to exactly the readers who need it most.
 */

const OPEN_EVENT = "mllab:search";

const PAGE_COUNT = SEARCH_INDEX.filter((e) => e.kind === "page").length;
const TERM_COUNT = SEARCH_INDEX.length - PAGE_COUNT;

/** Open the palette from anywhere, without threading state through the shell. */
export function openSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const returnTo = React.useRef<HTMLElement | null>(null);

  const hits = React.useMemo(() => search(query), [query]);
  const rows: (SearchEntry | SearchHit)[] = query.trim() ? hits : SEARCH_SUGGESTIONS;

  // The cursor is clamped during render rather than reset in an effect: an
  // effect would paint one frame with a selection pointing past the list.
  const active = Math.min(cursor, Math.max(0, rows.length - 1));

  const show = React.useCallback(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, []);

  const hide = React.useCallback(() => {
    setOpen(false);
    returnTo.current?.focus?.();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) show();
        return;
      }
      // "/" is the other convention, but only when the reader is not typing —
      // otherwise it eats the slash in "et/ou" on any page with a text field.
      if (!open && e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [open, show]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view when arrowing through a long list.
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (rows.length ? (Math.min(c, rows.length - 1) + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (rows.length ? (Math.min(c, rows.length - 1) + rows.length - 1) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row.href);
    } else if (e.key === "Tab") {
      // The dialog holds exactly one focusable control. Letting Tab out of it
      // would leave a modal open with focus somewhere behind the backdrop.
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <button
        aria-label="Fermer la recherche"
        tabIndex={-1}
        className="absolute inset-0 bg-plane/80 backdrop-blur-sm"
        onClick={hide}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher dans le site"
        className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-1 shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-muted">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Une page, un terme… « gini », « kernel », « ROC »"
            aria-label="Rechercher"
            role="combobox"
            aria-expanded
            aria-controls="recherche-resultats"
            aria-activedescendant={rows.length ? `recherche-option-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-muted"
          />
          <kbd className="shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">
            Échap
          </kbd>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-muted">
            Rien pour « {query.trim()} ». Essayez un mot seul, ou le terme anglais.
          </p>
        ) : (
          <>
            {!query.trim() && (
              <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
                Pour commencer
              </p>
            )}
            <ul
              ref={listRef}
              id="recherche-resultats"
              role="listbox"
              aria-label="Résultats"
              className="max-h-[52vh] overflow-y-auto p-2"
            >
              {rows.map((row, i) => (
                <li
                  key={row.href + row.title}
                  id={`recherche-option-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => go(row.href)}
                  onMouseMove={() => setCursor(i)}
                  className={cx(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2",
                    i === active ? "bg-surface-3" : "hover:bg-surface-2/60",
                  )}
                >
                  <span
                    className={cx(
                      "mt-[3px] shrink-0 rounded px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.08em]",
                      row.kind === "page"
                        ? "bg-accent/15 text-accent"
                        : "bg-surface-2 text-ink-muted",
                    )}
                  >
                    {row.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      <Highlight text={row.title} range={"range" in row ? row.range : null} />
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                      {row.sub}
                    </span>
                  </span>
                  <span className="mt-[3px] shrink-0 text-[10px] text-ink-muted">{row.section}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-[10.5px] text-ink-muted">
          <span>↑ ↓ pour parcourir</span>
          <span>↵ pour ouvrir</span>
          <span className="ml-auto">
            {PAGE_COUNT} pages · {TERM_COUNT} définitions
          </span>
        </div>
      </div>
    </div>
  );
}

/** The matched letters in bold, so the reader sees *why* a row is there. */
function Highlight({ text, range }: { text: string; range: [number, number] | null }) {
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="bg-transparent font-semibold text-accent">
        {text.slice(range[0], range[1])}
      </mark>
      {text.slice(range[1])}
    </>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** The visible way in. Without it the shortcut may as well not exist. */
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      onClick={openSearch}
      className={cx(
        "flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1 text-ink-muted transition-colors hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-left text-[12px]">Rechercher</span>
      <kbd className="hidden shrink-0 rounded border border-line bg-surface-1 px-1 py-px text-[9.5px] lg:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
