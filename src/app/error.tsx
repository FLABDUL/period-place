"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-shell narrow-page"><p className="eyebrow">Something went wrong</p><h1>That page could not be loaded.</h1><p>The map data may be temporarily unavailable. No form was submitted from this error screen.</p><button className="primary-button" type="button" onClick={reset}>Try again</button></div>;
}
