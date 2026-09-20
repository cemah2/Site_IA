/**
 * Join class names, skipping falsy entries.
 *
 * Lives in `lib` rather than in the component kit because it is a plain
 * function with no React in it: leaving it inside a `"use client"` module made
 * it a client reference, and any server component that imported it failed the
 * build with "attempted to call cx() from the server".
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
