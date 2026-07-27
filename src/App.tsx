/**
 * Building On.
 *
 * The shell: it wires the content to the engine and renders whichever phase the
 * game is in. All game logic lives in `src/engine/`, which never imports
 * content — the deck and the config are handed to `createGame` here.
 */
import { useMemo, useReducer, useState } from 'react';
import { config, deck } from './content.ts';
import { createGame } from './engine/game.ts';
import Hand from './components/Hand.tsx';
import Plot from './components/Plot.tsx';

function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export default function App() {
  const game = useMemo(() => createGame(deck, config), []);
  const [seed] = useState(freshSeed);
  const [state, dispatch] = useReducer(game.reducer, seed, game.initialState);

  const placing = state.selectedPlanId !== null;

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Building On</h1>
        {state.phase === 'play' && (
          <p className="app__round">
            {state.round} of {config.rounds}
          </p>
        )}
      </header>

      {state.phase === 'play' ? (
        <>
          <Plot
            state={state}
            deck={deck}
            onPlace={(cell) => dispatch({ type: 'PLACE', cell })}
          />

          <p className="app__prompt">
            {placing
              ? 'Place it anywhere touching what is already built. You cannot move it later.'
              : 'Choose one of three. The other two are gone.'}
          </p>

          <Hand
            state={state}
            deck={deck}
            onSelect={(planId) => dispatch({ type: 'SELECT_PLAN', planId })}
          />
        </>
      ) : (
        <section className="finished">
          <Plot state={state} deck={deck} onPlace={() => {}} />
          <p className="finished__line">The house is finished.</p>
          <p className="app__prompt">
            {/* §10 — the three columns, the closing line and the household's
                reactions arrive in M4. */}
            What you&rsquo;ll have, what it cost and what you&rsquo;ll look after are
            still to come.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => dispatch({ type: 'RESTART', seed: freshSeed() })}
          >
            Build again
          </button>
        </section>
      )}
    </main>
  );
}
