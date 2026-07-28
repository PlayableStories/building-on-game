/**
 * How this works — GDD §13, §14.
 *
 * Playtesting found two things a first-time player did not know, and both were
 * the game's fault. They did not know what they were being asked to *do* — a
 * no-fail game has no failure to teach through, so it has to say — and they did
 * not know the old rooms could be taken down at all, which is the most
 * interesting decision in the design going unnoticed.
 *
 * So it says, once before round 1 and again whenever it is asked. A rule you
 * can only read at the start is a rule you have to remember; a rule you can
 * check is one you can play with. Reopening it never touches the game state:
 * the round underneath is exactly where it was left.
 */
import { useEffect } from 'react';
import type { Rules as RulesContent } from '../types.ts';

interface RulesProps {
  rules: RulesContent;
  /**
   * Standing open over a game in progress, rather than sitting inside the
   * intro. Only then is there anything to close it and go back to.
   */
  onClose?: () => void;
}

export default function Rules({ rules, onClose }: RulesProps) {
  useEffect(() => {
    if (!onClose) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section
      className={`rules${onClose ? ' rules--open' : ''}`}
      aria-label="How this works"
    >
      <h2 className="rules__heading">How this works</h2>
      <p className="rules__objective">{rules.objective}</p>

      <ul className="rules__list">
        {rules.points.map((point) => (
          <li className="rules__point" key={point}>
            {point}
          </li>
        ))}
      </ul>

      {onClose && (
        <button type="button" className="button button--quiet" onClick={onClose} autoFocus>
          Back to the house
        </button>
      )}
    </section>
  );
}
