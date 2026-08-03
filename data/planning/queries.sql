-- Building On — what London actually applies for, and what happens to it.
--
-- Source: planning applications collected at the House London Data Hackathon
-- (1 August 2026). One SQLite table, `applications`, one row per application,
-- with the interesting fields inside a JSON `payload` column.
--
-- Run with: npm run planning-data -- <path to housing_planning.sqlite>
--
-- Each block below is named with `-- @name:`. The script runs each one and
-- writes `<name>.csv` beside this file. Every figure quoted in
-- PLANNING-DATA.md comes from one of those rows — if you change a query here,
-- regenerate rather than editing a CSV by hand.
--
-- Two conventions throughout:
--
--   * "Decided" means app_state IN ('Permitted','Conditions','Rejected').
--     Withdrawn and Undecided are excluded from every rate, because an
--     application nobody ruled on is not evidence of how rulings go.
--   * `Conditions` is an *approval*. It means permission granted with things
--     you must do. That distinction is the whole reason this analysis exists:
--     the game's `sensitive` flag is about conditions, not about refusal.

-- @name: coverage
-- What the export actually covers.
SELECT
  COUNT(*)                                             AS applications,
  COUNT(DISTINCT area_name)                            AS councils,
  MIN(CASE WHEN start_date > '2000' THEN start_date END) AS earliest,
  MAX(CASE WHEN start_date > '2000' THEN start_date END) AS latest,
  SUM(json_extract(payload,'$.app_size') = 'Small')    AS small,
  ROUND(100.0 * SUM(json_extract(payload,'$.app_size') = 'Small') / COUNT(*), 1) AS small_pct,
  SUM(json_extract(payload,'$.app_size') = 'Medium')   AS medium,
  SUM(json_extract(payload,'$.app_size') = 'Large')    AS large,
  -- The export's own housing-relevance classifier. Recorded so the decision to
  -- ignore it is checkable: it fires on too few rows, and on the wrong ones.
  SUM(relates_to_hi = 1)                               AS relates_to_hi
FROM applications;

-- @name: outcomes
-- The headline split. Note `approved` = permitted + conditions. `withdrawn`
-- and `undecided` are counted here but excluded from every rate, so that the
-- size of what was set aside is on the record rather than merely asserted.
WITH a AS (SELECT json_extract(payload,'$.app_state') AS s FROM applications),
     d AS (SELECT s FROM a WHERE s IN ('Permitted','Conditions','Rejected'))
SELECT
  (SELECT COUNT(*) FROM d)                                            AS decided,
  (SELECT SUM(s IN ('Permitted','Conditions')) FROM d)                AS approved,
  (SELECT SUM(s = 'Permitted') FROM d)                                AS clean,
  (SELECT SUM(s = 'Conditions') FROM d)                               AS with_conditions,
  (SELECT SUM(s = 'Rejected') FROM d)                                 AS refused,
  (SELECT ROUND(100.0*SUM(s IN ('Permitted','Conditions'))/COUNT(*),1) FROM d) AS approved_pct,
  (SELECT ROUND(100.0*SUM(s = 'Permitted')/COUNT(*),1) FROM d)        AS clean_pct,
  (SELECT ROUND(100.0*SUM(s = 'Conditions')/COUNT(*),1) FROM d)       AS conditions_pct,
  (SELECT ROUND(100.0*SUM(s = 'Rejected')/COUNT(*),1) FROM d)         AS refused_pct,
  (SELECT SUM(s = 'Withdrawn') FROM a)                                AS excluded_withdrawn,
  (SELECT SUM(s = 'Undecided') FROM a)                                AS excluded_undecided;

-- @name: sample_check
-- Does a sample agree with the full table? A deterministic ~6.5% of rows,
-- picked by multiplicative hashing of the rowid rather than RANDOM(), so this
-- file regenerates identically. If these rates diverge from `outcomes`, the
-- full-table figures are the ones to distrust first.
SELECT
  COUNT(*) AS sampled,
  6.5      AS sampled_pct_of_table,
  ROUND(100.0 * SUM(s = 'Conditions') / COUNT(*), 1) AS conditions_pct,
  ROUND(100.0 * SUM(s = 'Rejected')   / COUNT(*), 1) AS refused_pct
FROM (
  SELECT json_extract(payload,'$.app_state') AS s
  FROM applications
  WHERE ((rowid * 2654435761) % 100000) < 6500
)
WHERE s IN ('Permitted','Conditions','Rejected');

-- @name: categories
-- What people apply for, by keyword. Deliberately NON-EXCLUSIVE: one
-- description routinely says "demolition of garage and erection of a single
-- storey rear extension with rear dormer", and forcing that into one bucket
-- would be a judgement rather than a measurement. So the counts overlap and do
-- not sum to the total, and each row answers only "of the applications that
-- mention this, how did they go".
WITH d AS (
  SELECT lower(json_extract(payload,'$.description')) AS t,
         json_extract(payload,'$.app_state')          AS s
  FROM applications
  WHERE json_extract(payload,'$.description') IS NOT NULL
    AND json_extract(payload,'$.app_state') IN ('Permitted','Conditions','Rejected')
),
k(kind, pat) AS (VALUES
  ('rear extension',        '%rear extension%'),
  ('loft / dormer',         '%dormer%'),
  ('involves demolition',   '%demoli%'),
  ('roof extension',        '%roof extension%'),
  ('rooflights',            '%rooflight%'),
  ('windows',               '%window%'),
  ('side extension',        '%side extension%'),
  ('loft conversion',       '%loft conversion%'),
  ('hip to gable',          '%hip to gable%'),
  ('change of use',         '%change of use%'),
  ('garage',                '%garage%'),
  ('basement',              '%basement%'),
  ('balcony',               '%balcon%'),
  ('porch',                 '%porch%'),
  ('outbuilding',           '%outbuilding%'),
  ('conservatory',          '%conservatory%'),
  ('boundary wall / fence', '%boundary%'),
  ('bin store',             '%bin store%'),
  ('solar',                 '%solar%'),
  ('insulation',            '%insulat%'),
  ('heat pump',             '%heat pump%'),
  ('garden room',           '%garden room%')
)
SELECT k.kind                                                    AS kind,
       COUNT(*)                                                  AS decided,
       SUM(s = 'Permitted')                                      AS clean,
       SUM(s = 'Conditions')                                     AS with_conditions,
       SUM(s = 'Rejected')                                       AS refused,
       ROUND(100.0 * SUM(s = 'Conditions') / COUNT(*), 1)        AS conditions_pct,
       ROUND(100.0 * SUM(s = 'Rejected')   / COUNT(*), 1)        AS refused_pct
FROM d JOIN k ON d.t LIKE k.pat
GROUP BY k.kind
ORDER BY decided DESC;

-- @name: cards
-- The same measurement, but with the patterns tightened until each one maps
-- onto a card in the deck. This is the table the consent flags answer to.
--
-- `card` names the plan id in src/content.ts. Where a card has two real-world
-- forms that behave differently — a terrace is a patio or a roof terrace, wall
-- insulation is internal or external — both are measured, because the
-- difference between them is usually the finding.
WITH d AS (
  SELECT lower(json_extract(payload,'$.description')) AS t,
         json_extract(payload,'$.app_state')          AS s
  FROM applications
  WHERE json_extract(payload,'$.description') IS NOT NULL
    AND json_extract(payload,'$.app_state') IN ('Permitted','Conditions','Rejected')
),
k(card, form, pat) AS (VALUES
  ('householder rooms', 'rear extension',          '%rear extension%'),
  ('study / gym',       'loft conversion',         '%loft conversion%'),
  ('porch',             'porch',                   '%porch%'),
  ('shed',              'outbuilding',             '%outbuilding%'),
  ('glass-extension',   'conservatory',            '%conservatory%'),
  ('terrace',           'patio',                   '%patio%'),
  ('terrace',           'roof terrace',            '%roof terrace%'),
  ('bin-store',         'bin store',               '%bin store%'),
  ('solar-array',       'solar panels',            '%solar panel%'),
  ('heat-pump',         'air source heat pump',    '%air source heat pump%'),
  ('air-conditioning',  'air conditioning',        '%air condition%'),
  ('shed',              'garden room',             '%garden room%'),
  ('glass-extension',   'glazed extension',        '%glazed extension%'),
  ('wall-insulation',   'external wall insulation','%external wall insulation%'),
  ('wall-insulation',   'internal wall insulation','%internal wall insulation%')
)
SELECT k.card                                             AS card,
       k.form                                             AS form,
       COUNT(*)                                           AS decided,
       SUM(s = 'Conditions')                              AS with_conditions,
       SUM(s = 'Rejected')                                AS refused,
       ROUND(100.0 * SUM(s = 'Conditions') / COUNT(*), 1) AS conditions_pct,
       ROUND(100.0 * SUM(s = 'Rejected')   / COUNT(*), 1) AS refused_pct
FROM d JOIN k ON d.t LIKE k.pat
GROUP BY k.card, k.form
ORDER BY conditions_pct DESC;

-- @name: routes
-- Which door people go through, grouped into families. The council-by-council
-- wording varies enormously ("Cert. Lawfulness Proposed", "Section 192
-- Certificate - proposed", "Certificate of Lawful Development - Proposed"), so
-- these are matched loosely and on purpose.
--
-- The interesting row is the certificate family: people paying to establish
-- that they do NOT need permission. That is the closest this data comes to
-- measuring the game's `permitted` flag, and 15% of them are told otherwise.
WITH d AS (
  SELECT lower(COALESCE(json_extract(payload,'$.other_fields.application_type'), '')) AS r,
         json_extract(payload,'$.app_state') AS s
  FROM applications
  WHERE json_extract(payload,'$.app_state') IN ('Permitted','Conditions','Rejected')
)
SELECT CASE
         WHEN r LIKE '%lawful%' OR r LIKE '%certificate%' OR r LIKE '%cert%'
              OR r LIKE '%section 19%'                       THEN 'Lawful development certificate'
         WHEN r LIKE '%prior%'                               THEN 'Prior approval / notification'
         WHEN r LIKE '%householder%'                         THEN 'Householder application'
         WHEN r LIKE '%listed%' OR r LIKE '%conservation%'   THEN 'Listed building / conservation consent'
         WHEN r LIKE '%full%' OR r LIKE '%detailed%'
              OR r LIKE '%outline%'                          THEN 'Full planning permission'
         WHEN r = ''                                         THEN '(not stated)'
         ELSE 'Other'
       END                                                   AS route,
       COUNT(*)                                              AS decided,
       SUM(s = 'Conditions')                                 AS with_conditions,
       SUM(s = 'Rejected')                                   AS refused,
       ROUND(100.0 * SUM(s = 'Conditions') / COUNT(*), 1)    AS conditions_pct,
       ROUND(100.0 * SUM(s = 'Rejected')   / COUNT(*), 1)    AS refused_pct
FROM d
GROUP BY route
ORDER BY decided DESC;

-- @name: conditions
-- What a condition is actually about.
--
-- Councils publish condition discharges as "Details required by Condition 4
-- (Materials) of planning permission 21/1234", so the subject sits in the
-- first bracket. Crude, and good enough: the shape of the answer is stable and
-- it is the only route to what an obligation concretely *is* rather than how
-- often one arrives.
WITH c AS (
  SELECT lower(json_extract(payload,'$.description')) AS t
  FROM applications
  WHERE lower(json_extract(payload,'$.description')) LIKE '%condition%(%)%'
),
subj AS (
  SELECT trim(substr(t, instr(t,'(') + 1,
                     instr(substr(t, instr(t,'(') + 1), ')') - 1)) AS subject
  FROM c
)
SELECT subject, COUNT(*) AS occurrences
FROM subj
WHERE length(subject) BETWEEN 4 AND 40
GROUP BY subject
ORDER BY occurrences DESC
LIMIT 30;

-- @name: condition_families
-- The same subjects, grouped. Councils write the same obligation half a dozen
-- ways — "approved plans", "approved drawings", "plan numbers", "compliance
-- with approved drawings" — and it is one obligation. Grouping them is what
-- turns a long tail into the two facts a card can be written from.
WITH c AS (
  SELECT lower(json_extract(payload,'$.description')) AS t
  FROM applications
  WHERE lower(json_extract(payload,'$.description')) LIKE '%condition%(%)%'
),
subj AS (
  SELECT trim(substr(t, instr(t,'(') + 1,
                     instr(substr(t, instr(t,'(') + 1), ')') - 1)) AS subject
  FROM c
  WHERE length(trim(substr(t, instr(t,'(') + 1,
                    instr(substr(t, instr(t,'(') + 1), ')') - 1))) BETWEEN 4 AND 40
)
SELECT CASE
         WHEN subject LIKE '%plan%' AND subject LIKE '%approved%' THEN 'approved plans and drawings'
         WHEN subject LIKE '%drawing%'                            THEN 'approved plans and drawings'
         WHEN subject IN ('plans','plan numbers')                 THEN 'approved plans and drawings'
         WHEN subject LIKE '%material%' OR subject LIKE '%finishes%' THEN 'materials and finishes'
         WHEN subject LIKE '%landscap%'                           THEN 'landscaping'
         WHEN subject LIKE '%cycle%'                              THEN 'cycle parking and storage'
         WHEN subject LIKE '%construction%' OR subject LIKE '%piling%'
              OR subject LIKE '%logistics%'                       THEN 'construction management'
         WHEN subject LIKE '%lighting%'                           THEN 'external lighting'
         WHEN subject LIKE '%drainage%' OR subject LIKE '%contamination%'
              OR subject LIKE '%water%'                           THEN 'drainage and contamination'
         ELSE 'everything else'
       END AS family,
       COUNT(*) AS occurrences
FROM subj
GROUP BY family
ORDER BY occurrences DESC;
