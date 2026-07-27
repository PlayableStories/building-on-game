/**
 * The line — GDD §8.6, §13.
 *
 * One short observation about what has just been put next to what. It is not a
 * score and not a warning; it is the game noticing something out loud. The
 * round waits here until it is dismissed by clicking, Space or Enter (§13).
 *
 * Rendered as an inline caption rather than a modal, so the plot stays visible.
 * Seeing the block you just placed while reading the line about it is the whole
 * transaction.
 */
import { useEffect } from 'react';

interface ObservationProps {
  line: string;
  onDismiss: () => void;
}

export default function Observation({ line, onDismiss }: ObservationProps) {
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
    <button type="button" className="observation" onClick={onDismiss} autoFocus>
      <span className="observation__line" role="status">
        {line}
      </span>
      <span className="observation__dismiss">Click, space or enter</span>
    </button>
  );
}
