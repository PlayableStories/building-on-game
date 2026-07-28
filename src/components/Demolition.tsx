/**
 * The confirmation — GDD §7.2, §13.
 *
 * The only confirmation in the game, and it is here because this is the only
 * move that cannot be taken back. Everything else in Building On is additive and
 * forgiving; demolition is not, because in real building it is not.
 *
 * It asks once. It does not warn, and it does not argue — the design note in §7
 * is explicit that the weight arrives on its own, because it is a house someone
 * left the player. So the copy states what happens and then gets out of the way.
 *
 * Escape backs out, which is the only place in the game that key does anything.
 * The player keeps their selected plan and can put it somewhere else.
 */
import { useEffect } from 'react';

interface DemolitionProps {
  /** The plan about to go there. */
  planName: string;
  cell: string;
  /** True when this is B2 — the front door goes with it (§7). */
  isFrontDoor: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Demolition({
  planName,
  cell,
  isFrontDoor,
  onConfirm,
  onCancel,
}: DemolitionProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <section className="demolition" role="alertdialog" aria-label="Demolition">
      <p className="demolition__line">
        {cell} is part of the house you were left. Putting the {planName.toLowerCase()}{' '}
        there takes it down.
      </p>

      {isFrontDoor && (
        <p className="demolition__door">
          That cell is the front door. The house will need a new way in, and every
          placement after this one is read against that.
        </p>
      )}

      <p className="demolition__note">This cannot be undone.</p>

      <div className="demolition__choices">
        <button type="button" className="button" onClick={onConfirm} autoFocus>
          Take it down
        </button>
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Put it somewhere else
        </button>
      </div>
    </section>
  );
}
