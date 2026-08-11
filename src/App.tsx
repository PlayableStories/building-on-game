/**
 * Building On.
 *
 * The shell: it wires the content to the engine and renders whichever phase the
 * game is in. All game logic lives in `src/engine/`, which never imports
 * content — the deck and the config are handed to `createGame` here.
 */
import { useCallback, useMemo, useReducer, useState } from 'react';
import {
  causeWords,
  closingLines,
  config,
  consentCare,
  consentLabels,
  consentOrder,
  conservationOverrides,
  costPhrases,
  deck,
  demolitionCare,
  pairLines,
  planning,
  plot,
  premise,
  qualityLines,
  qualitySeverity,
  rules,
  situations,
  ui,
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
        { pairLines, qualityLines, qualitySeverity, causeWords },
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
              planning,
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
        <h1 className="app__title">{ui.title}</h1>
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
              {ui.rules.open}
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
          copy={ui}
          onBegin={() => dispatch({ type: 'BEGIN' })}
        />
      ) : state.phase === 'play' ? (
        <>
          {readingRules && <Rules rules={rules} copy={ui.rules} onClose={closeRules} />}

          <Plot
            state={state}
            deck={deck}
            plot={plot}
            copy={ui.plot}
            onPlace={(cell) => dispatch({ type: 'PLACE', cell })}
          />

          {/* §7.2, §13 — the one question the game asks. It takes precedence
              over everything, because nothing else can happen until it is
              answered. Then the line, which has the floor until it is read. */}
          {state.pendingDemolition !== null && selectedPlan ? (
            <Demolition
              planName={selectedPlan.name}
              cell={state.pendingDemolition}
              roomName={
                plot.fabric.find((room) => room.cell === state.pendingDemolition)?.name ??
                'room'
              }
              copy={ui.demolition}
              onConfirm={() => dispatch({ type: 'CONFIRM_DEMOLITION' })}
              onCancel={cancelDemolition}
            />
          ) : state.observation !== null ? (
            <Observation
              observation={state.observation}
              copy={ui.observation}
              onDismiss={dismiss}
            />
          ) : (
            <>
              <p className="app__prompt">
                {placing && selectedPlan
                  ? ui.prompt.place[selectedPlan.where]
                  : ui.prompt.choose}
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
          <Plot
            state={state}
            deck={deck}
            plot={plot}
            copy={ui.plot}
            onPlace={() => {}}
          />
          <p className="finished__line">{ui.report.finished}</p>

          {report && <Report report={report} copy={ui.report} />}

          <button
            type="button"
            className="button"
            onClick={() => dispatch({ type: 'RESTART', seed: freshSeed() })}
          >
            {ui.report.again}
          </button>
        </section>
      )}
    </main>
  );
}
