"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en-GB"><body><main className="page-shell narrow-page"><h1>Period Place is temporarily unavailable.</h1><p>Please try loading the service again.</p><button type="button" onClick={reset}>Try again</button></main></body></html>;
}
