/**
 * The line — GDD §8.6, §13.
 *
 * One short observation about what has just been put next to what. It is not a
 * score and not a warning; it is the game noticing something out loud. The
 * round waits here until it is dismissed by clicking, Space or Enter (§13).
 *
 * Rendered as an inline caption rather than a modal, so the plot stays visible.
 * Seeing the block you just placed while reading the line about it is the whole
 * transaction — and after playtesting, seeing it is no longer left to chance:
 * the cause is named above the line, and the cells it is about are lit on the
 * plot at the same time. A player said "I do not aware the line is directly
 * related to my placement and/or the neighbour", which is the mechanic the
 * prototype exists to test failing to arrive.
 *
 * The cause is set small and quiet on purpose. It is the label; the line is
 * still the thing being read.
 */
import { useEffect } from 'react';
import type { Observation as ObservationData } from '../types.ts';

interface ObservationProps {
  observation: ObservationData;
  onDismiss: () => void;
}

export default function Observation({ observation, onDismiss }: ObservationProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      onDismiss();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <button
      type="button"
      className="observation"
      data-kind={observation.kind}
      onClick={onDismiss}
      autoFocus
    >
      <span className="observation__cause">{observation.cause}</span>
      <span className="observation__line" role="status">
        {observation.line}
      </span>
      <span className="observation__dismiss">Click, space or enter</span>
    </button>
  );
}
