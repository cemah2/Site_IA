"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cx } from "@/components/ui";
import { findNav, neighbours } from "@/lib/nav";
import { Sidebar } from "./Sidebar";

/**
 * The frame every page sits in: a persistent left rail on desktop, a drawer on
 * mobile, and a reading-order footer so the site can be walked front to back
 * like a course as well as browsed like a reference.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const found = findNav(current);
  const { prev, next } = neighbours(current);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-surface-1/50 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-plane/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[270px] border-r border-line bg-surface-1">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-plane/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-md border border-line bg-surface-2 p-1.5 text-ink-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <span className="truncate text-sm font-medium text-ink">
            {found?.item.label ?? "Machine Learning Lab"}
          </span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>

        {(prev || next) && (
          <footer className="border-t border-line px-5 py-6 lg:px-10">
            <div className="mx-auto flex max-w-[1400px] flex-wrap gap-3">
              {prev && <NavCard item={prev} direction="prev" />}
              {next && <NavCard item={next} direction="next" />}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function NavCard({
  item,
  direction,
}: {
  item: { href: string; label: string; blurb?: string };
  direction: "prev" | "next";
}) {
  return (
    <Link
      href={item.href}
      className={cx(
        "group min-w-0 flex-1 rounded-xl border border-line bg-surface-1/60 px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-2/60",
        direction === "next" && "text-right",
      )}
    >
      <span className="block text-[10px] uppercase tracking-[0.13em] text-ink-muted">
        {direction === "prev" ? "← Précédent" : "Suivant →"}
      </span>
      <span className="mt-0.5 block truncate text-sm font-medium text-ink">{item.label}</span>
      {item.blurb && (
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{item.blurb}</span>
      )}
    </Link>
  );
}
