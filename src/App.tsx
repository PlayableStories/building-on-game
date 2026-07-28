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
  conservationOverrides,
  consentCare,
  consentLabels,
  consentOrder,
  costPhrases,
  deck,
  demolitionCare,
  pairLines,
  plot,
  premise,
  qualityLines,
  qualitySeverity,
  rules,
  situations,
  whyNow,
} from './content.ts';
import { flagInHand } from './engine/consent.ts';
import { createGame } from './engine/game.ts';
import { buildReport } from './engine/report.ts';
import Demolition from './components/Demolition.tsx';
import Hand from './components/Hand.tsx';
import Intro from './components/Intro.tsx';
import Observation from './components/Observation.tsx';
import Plot from './components/Plot.tsx';
import Report from './components/Report.tsx';
import Rules from './components/Rules.tsx';

function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export default function App() {
  const game = useMemo(
    () =>
      createGame(
        deck,
        config,
        { pairLines, qualityLines, qualitySeverity },
        plot,
        situations.map((situation) => situation.id),
      ),
    [],
  );
  const [seed] = useState(freshSeed);
  const [state, dispatch] = useReducer(game.reducer, seed, game.initialState);

  /**
   * §13, §14 — the rules, looked up mid-game. Deliberately component state and
   * not game state: reading the rules is not a move, and the round underneath
   * has to be exactly where it was left when the card closes.
   */
  const [readingRules, setReadingRules] = useState(false);
  const closeRules = useCallback(() => setReadingRules(false), []);

  const situation = situations.find((entry) => entry.id === state.situationId);
  const placing = state.selectedPlanId !== null;
  const reading = state.observation !== null;
  // §7.2, §13 — waiting to hear whether part of the old house is coming down.
  const demolishing = state.pendingDemolition !== null;

  // §10.1 — assembled once, on the last placement. Nothing here is computed for
  // display while the game is being played.
  const report = useMemo(
    () =>
      state.phase === 'report'
        ? buildReport(
            state,
            deck,
            {
              situations,
              costPhrases,
              closingLines,
              demolitionCare,
              consentCare,
              consentOrder,
              conservationOverrides,
            },
            qualitySeverity,
            config,
          )
        : null,
    [state],
  );

  // Stable, so the key handlers in Observation and Demolition are not torn down
  // and rebuilt on every render.
  const dismiss = useCallback(() => dispatch({ type: 'DISMISS' }), []);
  const cancelDemolition = useCallback(
    () => dispatch({ type: 'CANCEL_DEMOLITION' }),
    [],
  );

  const selectedPlan = deck.find((plan) => plan.id === state.selectedPlanId);

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Building On</h1>
        {state.phase === 'play' && (
          <div className="app__status">
            {/* §13 — the rules are a lookup, not a tutorial. Available for the
                whole game rather than only at the start of it. */}
            <button
              type="button"
              className="app__rules-button"
              aria-expanded={readingRules}
              onClick={() => setReadingRules((open) => !open)}
            >
              How this works
            </button>
            <p className="app__round">
              {state.round} of {config.rounds}
            </p>
          </div>
        )}
      </header>

      {state.phase === 'intro' ? (
        <Intro
          premise={premise}
          whyNow={whyNow}
          situation={situation}
          rules={rules}
          onBegin={() => dispatch({ type: 'BEGIN' })}
        />
      ) : state.phase === 'play' ? (
        <>
          {readingRules && <Rules rules={rules} onClose={closeRules} />}

          <Plot
            state={state}
            deck={deck}
            plot={plot}
            onPlace={(cell) => dispatch({ type: 'PLACE', cell })}
          />

          {/* §7.2, §13 — the one question the game asks. It takes precedence
              over everything, because nothing else can happen until it is
              answered. Then the line, which has the floor until it is read. */}
          {demolishing && selectedPlan ? (
            <Demolition
              planName={selectedPlan.name}
              cell={state.pendingDemolition as string}
              roomName={
                plot.fabric.find((room) => room.cell === state.pendingDemolition)?.name ??
                'room'
              }
              onConfirm={() => dispatch({ type: 'CONFIRM_DEMOLITION' })}
              onCancel={cancelDemolition}
            />
          ) : reading ? (
            <Observation line={state.observation as string} onDismiss={dismiss} />
          ) : (
            <>
              <p className="app__prompt">
                {placing
                  ? // §5 — the prompt names the zone, because that is the rule a
                    // player is most likely to be surprised by mid-round.
                    selectedPlan?.zone === 'outdoor'
                    ? 'It goes in the garden, touching what is already there. You cannot move it later.'
                    : 'It goes in the house, touching what is already built. You cannot move it later.'
                  : 'Choose one of three. The other two are gone.'}
              </p>

              <Hand
                state={state}
                deck={deck}
                consentOf={(plan) =>
                  flagInHand(plan, config.conservation, conservationOverrides)
                }
                consentLabels={consentLabels}
                onSelect={(planId) => dispatch({ type: 'SELECT_PLAN', planId })}
              />
            </>
          )}
        </>
      ) : (
        <section className="finished">
          <Plot state={state} deck={deck} plot={plot} onPlace={() => {}} />
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
