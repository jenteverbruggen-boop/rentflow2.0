// Runs synchronously during HTML parsing (before first paint). The type flip
// avoids React's dev-only "script tag while rendering" warning: it executes on
// the server-parsed HTML but is inert (text/plain) once React hydrates.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
