/**
 * Building On.
 *
 * The shell: it wires the content to the engine and renders whichever phase the
 * game is in. All game logic lives in `src/engine/`, which never imports
 * content — the deck and the config are handed to `createGame` here.
 */
import { useCallback, useMemo, useReducer, useState } from 'react';
import {
  closingLines,
  config,
  costPhrases,
  deck,
  demolitionCare,
  household,
  pairLines,
  premise,
  qualityLines,
  qualitySeverity,
  whyNow,
} from './content.ts';
import { createGame } from './engine/game.ts';
import { buildReport } from './engine/report.ts';
import Hand from './components/Hand.tsx';
import Intro from './components/Intro.tsx';
import Observation from './components/Observation.tsx';
import Plot from './components/Plot.tsx';
import Report from './components/Report.tsx';

function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export default function App() {
  const game = useMemo(
    () => createGame(deck, config, { pairLines, qualityLines, qualitySeverity }),
    [],
  );
  const [seed] = useState(freshSeed);
  const [state, dispatch] = useReducer(game.reducer, seed, game.initialState);

  const placing = state.selectedPlanId !== null;
  const reading = state.observation !== null;

  // §10.1 — assembled once, on the last placement. Nothing here is computed for
  // display while the game is being played.
  const report = useMemo(
    () =>
      state.phase === 'report'
        ? buildReport(
            state,
            deck,
            { household, costPhrases, closingLines, demolitionCare },
            qualitySeverity,
          )
        : null,
    [state],
  );

  // Stable, so Observation's key handler is not torn down and rebuilt each render.
  const dismiss = useCallback(() => dispatch({ type: 'DISMISS' }), []);

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

      {state.phase === 'intro' ? (
        <Intro
          premise={premise}
          whyNow={whyNow}
          household={household}
          onBegin={() => dispatch({ type: 'BEGIN' })}
        />
      ) : state.phase === 'play' ? (
        <>
          <Plot
            state={state}
            deck={deck}
            onPlace={(cell) => dispatch({ type: 'PLACE', cell })}
          />

          {/* While there is a line to read, it has the floor — the hand for the
              next round arrives once it is dismissed (§8.6, §13). */}
          {reading ? (
            <Observation line={state.observation as string} onDismiss={dismiss} />
          ) : (
            <>
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
          )}
        </>
      ) : (
        <section className="finished">
          <Plot state={state} deck={deck} onPlace={() => {}} />
          <p className="finished__line">The house is finished.</p>

          {report && <Report report={report} />}

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
