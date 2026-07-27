/**
 * Building On.
 *
 * M0 is the scaffold only — this shell exists so the toolchain has something to
 * serve. The reducer (intro → play → report) and the plot arrive in M1.
 */
export default function App() {
  return (
    <main
      style={{
        maxWidth: '34rem',
        margin: '0 auto',
        padding: 'var(--space-5) var(--space-3)',
      }}
    >
      <h1 style={{ fontSize: 'var(--size-title)', margin: 0 }}>Building On</h1>
      <p style={{ color: 'var(--colour-ink-soft)' }}>
        A home isn&rsquo;t a list of rooms. It&rsquo;s what ended up next to what.
      </p>
      <p style={{ fontSize: 'var(--size-small)', color: 'var(--colour-ink-soft)' }}>
        Scaffold only. The plot, the hand and the eight rounds arrive in M1.
      </p>
    </main>
  );
}
