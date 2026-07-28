/**
 * What the house reports back — GDD §10, §14.
 *
 * Shown all at once when the eighth plan lands. It used to be §10.2's three
 * parallel columns, and playtesting found two problems with that: it was too
 * long to read, and the third column never resolved into any felt sense of what
 * it bought you — "I have no feeling of associating responsibility and
 * long-term care into a balanced feeling of long-term benefit."
 *
 * Two lists side by side do not make anyone connect item three of one to item
 * three of the other, and there is no reason they should. So they are rows now.
 * Each thing you gained sits on the same line as the thing it asks, and the
 * page cannot be read one column at a time. Three of them, and they are the
 * three that ask the most of you.
 *
 * §10.1 — none of this has appeared before now. There is no score here, and the
 * cost is a phrase rather than a number.
 */
import type { InterfaceCopy, Report as ReportData } from '../types.ts';

interface ReportProps {
  report: ReportData;
  copy: InterfaceCopy['report'];
}

export default function Report({ report, copy }: ReportProps) {
  return (
    <section className="report">
      <div className="report__pairs">
        <h2 className="report__heading report__heading--have">{copy.have}</h2>
        <h2 className="report__heading report__heading--care">{copy.care}</h2>

        {report.pairs.map((pair) => (
          // The name spans both, so the row reads as one thing rather than as
          // two entries that happen to be level with each other.
          <article className="report__pair" key={pair.name}>
            <h3 className="report__name">{pair.name}</h3>
            <p className="report__have">{pair.have}</p>
            <p className="report__care">{pair.care}</p>
          </article>
        ))}
      </div>

      <dl className="report__notes">
        <div className="report__note">
          <dt className="report__note-label">{copy.cost}</dt>
          <dd className="report__note-line">{report.cost}</dd>
        </div>

        {/* §9.3 — consent belongs to the house rather than to any one plan, so
            it is the one thing here with nothing to be paired against. */}
        {report.obligations.length > 0 && (
          <div className="report__note">
            <dt className="report__note-label">{copy.obligations}</dt>
            <dd className="report__note-line">
              {report.obligations.map((line) => (
                <span className="report__obligation" key={line}>
                  {line}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {/* §10.3 — what kind of house it turned out to be. Not a verdict. */}
      <p className="report__closing">{report.closing}</p>

      {/* §10.4 — the situation the game opened on, answered. The only place the
          framing comes back, and the last thing the player reads. */}
      {report.answer && <p className="report__answer">{report.answer}</p>}
    </section>
  );
}
