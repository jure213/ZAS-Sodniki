-- parse_payment_remarks / parse_money_text / m002_to_date fixtures
DO $t$
DECLARE
  r record;
  n integer;
BEGIN
  -- dates
  ASSERT private.m002_to_date('2025-03-05') = DATE '2025-03-05', 'iso date';
  ASSERT private.m002_to_date('2025-03-05T10:00:00Z') = DATE '2025-03-05', 'iso timestamp';
  ASSERT private.m002_to_date('5. 3. 2025') = DATE '2025-03-05', 'slovenian date';
  ASSERT private.m002_to_date(E'5.\u00a03.\u00a02025') = DATE '2025-03-05', 'slovenian date with NBSP';
  ASSERT private.m002_to_date('5/3/2025') = DATE '2025-03-05', 'slash date';
  ASSERT private.m002_to_date('') IS NULL AND private.m002_to_date(NULL) IS NULL, 'blank date';
  ASSERT private.m002_to_date('2025-02-30') IS NULL, 'impossible date';
  ASSERT private.m002_to_date('not a date') IS NULL, 'garbage date';

  -- money
  ASSERT private.parse_money_text('1.234,56 €') = 1234.56, 'eu thousands';
  ASSERT private.parse_money_text('99,99 €') = 99.99, 'eu simple';
  ASSERT private.parse_money_text('€99.99') = 99.99, 'us simple';
  ASSERT private.parse_money_text('€1,234.56') = 1234.56, 'us thousands';
  ASSERT private.parse_money_text('1.234') = 1234, 'dot thousands only';
  ASSERT private.parse_money_text('12') = 12, 'integer';
  ASSERT private.parse_money_text('0,5') = 0.5, 'one decimal';
  ASSERT private.parse_money_text(E'1.234,56\u00a0€') = 1234.56, 'nbsp';
  ASSERT private.parse_money_text('abc') IS NULL AND private.parse_money_text('') IS NULL, 'garbage money';

  -- the formats the v1 app wrote
  SELECT * INTO r FROM private.parse_payment_remarks('Plačano v celoti: 1.234,56 € (datum: 5. 3. 2025)');
  ASSERT r.kind = 'full' AND r.amount = 1234.56 AND r.paid_on = DATE '2025-03-05' AND r.parsed AND r.note IS NULL, 'eu full';

  SELECT * INTO r FROM private.parse_payment_remarks('Plačano v celoti: €99.99 (datum: 12. 12. 2025)');
  ASSERT r.amount = 99.99 AND r.paid_on = DATE '2025-12-12', 'legacy euro-prefix format';

  SELECT * INTO r FROM private.parse_payment_remarks(E'Delno plačilo: €37.58 (datum: 5. 9. 2025)\nFlik I.N.');
  ASSERT r.kind = 'partial' AND r.amount = 37.58 AND r.note = 'Flik I.N.', 'partial with following note';

  SELECT * INTO r FROM private.parse_payment_remarks(E'Plačano v celoti:\u00a099,99\u00a0€ (datum:\u00a05.\u00a03.\u00a02025)');
  ASSERT r.amount = 99.99 AND r.paid_on = DATE '2025-03-05' AND r.parsed, 'NBSP variants';

  SELECT * INTO r FROM private.parse_payment_remarks('plačano v celoti: 10,00 € (DATUM: 1.1.2025)');
  ASSERT r.amount = 10 AND r.paid_on = DATE '2025-01-01', 'case and spacing tolerant';

  SELECT * INTO r FROM private.parse_payment_remarks('Placano v celoti: 10,00 € (datum: 1. 1. 2025)');
  ASSERT r.amount = 10, 'without diacritic';

  -- several lines, CRLF; a note attaches to the preceding installment only
  SELECT count(*) INTO n FROM private.parse_payment_remarks(
    E'Denar iz računa\r\nDelno plačilo: 10,00 € (datum: 1. 1. 2025)\r\nPreko PN\r\nPlačano v celoti: 5,00 € (datum: 2. 1. 2025)');
  ASSERT n = 2, 'two installments';
  SELECT * INTO r FROM private.parse_payment_remarks(
    E'Denar iz računa\r\nDelno plačilo: 10,00 € (datum: 1. 1. 2025)\r\nPreko PN\r\nPlačano v celoti: 5,00 € (datum: 2. 1. 2025)')
    ORDER BY line_no LIMIT 1;
  ASSERT r.note = 'Preko PN', 'note of the first installment';
  ASSERT (SELECT note FROM private.parse_payment_remarks(
    E'Delno plačilo: 10,00 € (datum: 1. 1. 2025)\nPlačano v celoti: 5,00 € (datum: 2. 1. 2025)') ORDER BY line_no DESC LIMIT 1) IS NULL,
    'no note when none follows';

  -- free text only, empty, NULL: no installments
  ASSERT NOT EXISTS (SELECT 1 FROM private.parse_payment_remarks(E'Flik I.N.\nRačun 12-3')), 'free text is not an installment';
  ASSERT NOT EXISTS (SELECT 1 FROM private.parse_payment_remarks('')), 'empty';
  ASSERT NOT EXISTS (SELECT 1 FROM private.parse_payment_remarks(NULL)), 'null';

  -- unreadable installment lines come back with parsed = false (the preflight aborts on them)
  ASSERT (SELECT NOT parsed FROM private.parse_payment_remarks('Plačano v celoti: abc (datum: 1. 1. 2025)')), 'bad amount';
  ASSERT (SELECT NOT parsed FROM private.parse_payment_remarks('Plačano v celoti: 5,00 € (datum: 31. 2. 2025)')), 'bad date';
  ASSERT (SELECT NOT parsed FROM private.parse_payment_remarks('Plačano v celoti: 5,00 €')), 'missing date';
END
$t$;
ROLLBACK;
