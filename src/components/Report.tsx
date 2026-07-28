/**
 * What the house reports back — GDD §10, §14.
 *
 * Shown all at once when the eighth plan lands, in the order §10.2 fixes: what
 * you'll have, what it cost, what you'll look after. The third column is the
 * longest, deliberately — cost and benefit are what an estate agent tells you,
 * and responsibility is the thing nobody mentions.
 *
 * §10.1 — none of this has appeared before now. There is no score here, and the
 * cost is a phrase rather than a number.
 */
import type { Report as ReportData } from '../types.ts';

interface ReportProps {
  report: ReportData;
}

export default function Report({ report }: ReportProps) {
  return (
    <section className="report">
      <div className="report__columns">
        <section className="report__column">
          <h2 className="report__heading">What you&rsquo;ll have</h2>
          <ul className="report__list">
            {report.have.map((line, index) => (
              // Placement order, and two plans may share a line — the index is
              // the only stable key, and this list is never reordered.
              <li className="report__item" key={index}>
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="report__column">
          <h2 className="report__heading">What it cost</h2>
          <p className="report__cost">{report.cost}</p>
        </section>

        <section className="report__column report__column--care">
          <h2 className="report__heading">What you&rsquo;ll look after</h2>
          <ul className="report__list">
            {report.care.map((line, index) => (
              <li className="report__item" key={index}>
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* §10.3 — what kind of house it turned out to be. Not a verdict. */}
      <p className="report__closing">{report.closing}</p>

      {/* §10.4 — each person from §2 says one line about the finished house. */}
      <dl className="household">
        {report.household.map((person) => (
          <div className="household__person" key={person.name}>
            <dt className="household__name">{person.name}</dt>
            <dd className="household__line">{person.reaction}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
