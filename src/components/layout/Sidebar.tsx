"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cx } from "@/components/ui";
import { NAV } from "@/lib/nav";
import { CourseProgressBar } from "@/components/lab/CourseProgress";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;

  return (
    <nav aria-label="Sections" className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-b border-line px-5 py-4"
      >
        <LabMark />
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight text-ink">
            Machine Learning Lab
          </span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Comprendre en manipulant
          </span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <CourseProgressBar className="mb-4" />
        {NAV.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <h3 className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-muted">
              {section.title}
            </h3>
            <ul>
              {section.items.map((item) => {
                const active = current === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative block rounded-md px-2 py-[5px] text-[13px] transition-colors",
                        active
                          ? "bg-surface-2 font-medium text-ink"
                          : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                        />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** A small mark: three layers of nodes, the site's subject in one glyph. */
export function LabMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="25" height="25" rx="7" fill="#10141b" stroke="#232b37" />
      <g stroke="#33404f" strokeWidth="0.75">
        <path d="M7 7.5 L13 13 M7 13 L13 13 M7 18.5 L13 13" />
        <path d="M13 13 L19 9 M13 13 L19 17" />
      </g>
      <circle cx="7" cy="7.5" r="1.7" fill="#2584f5" />
      <circle cx="7" cy="13" r="1.7" fill="#2584f5" />
      <circle cx="7" cy="18.5" r="1.7" fill="#2584f5" />
      <circle cx="13" cy="13" r="2" fill="#7aa2ff" />
      <circle cx="19" cy="9" r="1.7" fill="#e45a20" />
      <circle cx="19" cy="17" r="1.7" fill="#27a37e" />
    </svg>
  );
}
