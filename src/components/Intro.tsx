/**
 * The framing — GDD §2, §14.
 *
 * Shown once, before round 1, and never returned to. It does two jobs in about
 * forty words: it says why the work is happening at all, which is what justifies
 * eight rounds and a front door the player did not choose; and it says who the
 * house is for, which is the only motivation a no-fail game can afford.
 *
 * Nothing here is scored, and none of it is mentioned again during play. The
 * household comes back once, in the report (§10.4).
 */
import type { HouseholdIntro } from '../types.ts';

interface IntroProps {
  premise: string;
  whyNow: string;
  household: readonly HouseholdIntro[];
  onBegin: () => void;
}

export default function Intro({ premise, whyNow, household, onBegin }: IntroProps) {
  return (
    <section className="intro">
      <p className="intro__premise">{premise}</p>
      <p className="intro__why">{whyNow}</p>

      <dl className="household">
        {household.map((person) => (
          <div className="household__person" key={person.id}>
            <dt className="household__name">{person.name}</dt>
            <dd className="household__line">{person.line}</dd>
          </div>
        ))}
      </dl>

      <button type="button" className="button" onClick={onBegin} autoFocus>
        Begin
      </button>
    </section>
  );
}
