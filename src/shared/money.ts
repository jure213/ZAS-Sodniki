// Money is handled as integer cents. Products (km x rate, hours x rate) are
// computed with exact decimal arithmetic and rounded half away from zero, which
// matches Postgres round(numeric, 2).

type Dec = { n: bigint; scale: number };

// Exact decimal representation of a finite number or numeric string.
function toDec(value: number | string): Dec {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Neveljavno število');
  const s = typeof value === 'number' ? String(value) : value.trim();
  // Also expands exponent notation (e.g. 1e-7, 1.5e21).
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new RangeError(`Neveljavno število: ${s}`);
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] || '0';
  const frac = m[3] ?? '';
  const exp = m[4] ? parseInt(m[4], 10) : 0;
  let digits = intPart + frac;
  let scale = frac.length - exp;
  if (scale < 0) {
    digits += '0'.repeat(-scale);
    scale = 0;
  }
  return { n: sign * BigInt(digits), scale };
}

// Rounds a decimal to 2 places, half away from zero, and returns cents.
function decToCents(d: Dec): number {
  const neg = d.n < 0n;
  const abs = neg ? -d.n : d.n;
  let cents: bigint;
  if (d.scale <= 2) {
    cents = abs * 10n ** BigInt(2 - d.scale);
  } else {
    const div = 10n ** BigInt(d.scale - 2);
    cents = abs / div;
    if ((abs % div) * 2n >= div) cents += 1n;
  }
  const out = Number(neg ? -cents : cents);
  return out === 0 ? 0 : out; // never -0
}

/** Euros (number or decimal string) to integer cents, rounded half-up. */
export function eurosToCents(euros: number | string): number {
  return decToCents(toDec(euros));
}

/** a x b (e.g. kilometres x EUR/km) in cents, rounded half-up. */
export function mulToCents(a: number | string, b: number | string): number {
  const x = toDec(a);
  const y = toDec(b);
  return decToCents({ n: x.n * y.n, scale: x.scale + y.scale });
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** 123456 -> "1.234,56 €" */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = String(abs % 100).padStart(2, '0');
  return `${neg && abs > 0 ? '-' : ''}${whole},${frac} €`;
}

/**
 * Parses user input such as "12,50", "1.234,56", "1234.5" or "12,50 €" into
 * cents. Returns null when the text is not a valid amount.
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/€/g, '').replace(/\s/g, '');
  if (s === '') return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s.includes(',')) {
    // Comma is the decimal separator, dots are thousands separators.
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d+$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const cents = sign * eurosToCents(s);
  return cents === 0 ? 0 : cents;
}
