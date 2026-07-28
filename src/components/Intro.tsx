/**
 * The framing — GDD §2, §13, §14.
 *
 * Shown once, before round 1. It does three jobs and keeps each of them short:
 * why the work is happening at all, which is what justifies eight rounds and a
 * front door nobody chose; who it is happening for, which is the only motivation
 * a no-fail game can afford; and how the game is played, which it turns out it
 * has to say out loud.
 *
 * There used to be three people here, introduced one after another. All three
 * were forgotten by round three, so there is one situation now, drawn from the
 * pool by the game's seed — the framing is quieter, and what is left of it is
 * the part a player actually carries into the first placement.
 */
import type {
  InterfaceCopy,
  Rules as RulesContent,
  SituationIntro,
} from '../types.ts';
import Rules from './Rules.tsx';

interface IntroProps {
  premise: string;
  whyNow: string;
  situation: SituationIntro | undefined;
  rules: RulesContent;
  copy: InterfaceCopy;
  onBegin: () => void;
}

export default function Intro({
  premise,
  whyNow,
  situation,
  rules,
  copy,
  onBegin,
}: IntroProps) {
  return (
    <section className="intro">
      {/* §2 — the background, and deliberately the smallest thing here. */}
      <p className="intro__premise">{premise}</p>
      <p className="intro__why">{whyNow}</p>

      {/* …and the situation, which is the part that has to survive to round 8. */}
      {situation && <p className="intro__situation">{situation.line}</p>}

      <Rules rules={rules} copy={copy.rules} />

      <button type="button" className="button" onClick={onBegin} autoFocus>
        {copy.begin}
      </button>
    </section>
  );
}
