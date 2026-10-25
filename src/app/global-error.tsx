'use client';

/** Last-resort boundary (errors in the root layout itself). Must render its own <html>/<body>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: 16 }}>Please reload the page. If this keeps happening, contact support.</p>
          <button onClick={() => reset()} style={{ padding: '10px 18px', borderRadius: 6, border: 0, background: '#0b66d6', color: '#fff' }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
