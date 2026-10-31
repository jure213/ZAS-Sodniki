import { z } from 'zod';

// One set of schemas for forms (renderer) and IPC validation (main), with
// Slovenian messages.

const req = (msg: string) => z.string({ error: msg }).trim().min(1, msg);
const optText = z.string().trim().default('');
const num = (msg: string) => z.number({ error: msg });

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDateSchema = z
  .string({ error: 'Vnesite datum' })
  .regex(ISO_DATE, 'Neveljaven datum')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Neveljaven datum');

export const statusSchema = z.enum(['planned', 'completed', 'cancelled', 'free', 'other_zas'], {
  error: 'Izberite status',
});

export const paymentMethodSchema = z.enum(['gotovina', 'nakazilo', 'drugo'], {
  error: 'Izberite način plačila',
});

export const tariffSchema = z.enum(['sodnik', 'racun'], { error: 'Izberite tarifo' });

// --- Auth --------------------------------------------------------------

export const loginSchema = z.object({
  username: req('Vnesite uporabniško ime'),
  password: z.string({ error: 'Vnesite geslo' }).min(1, 'Vnesite geslo'),
  remember: z.boolean().default(false),
});
export type LoginInput = z.input<typeof loginSchema>;

export const userSchema = z.object({
  username: req('Vnesite uporabniško ime'),
  name: req('Vnesite ime'),
  role: z.enum(['admin', 'user'], { error: 'Izberite vlogo' }),
  password: z.string().min(6, 'Geslo mora imeti vsaj 6 znakov').optional(),
});

// --- Officials / competitions ---------------------------------------------

export const officialSchema = z.object({
  name: req('Vnesite ime in priimek'),
  email: z.union([z.literal(''), z.email('Neveljaven e-poštni naslov')]).default(''),
  phone: optText,
  rank: optText,
  additional_exams: optText,
  notes: optText,
  active: z.boolean().default(true),
});

export const competitionSchema = z.object({
  name: req('Vnesite ime tekmovanja'),
  date: isoDateSchema,
  location: optText,
  status: statusSchema,
  notes: optText,
});

export const assignmentSchema = z.object({
  competition_id: z.number().int().positive(),
  official_id: z.number({ error: 'Izberite sodnika' }).int().positive('Izberite sodnika'),
  role_id: z.number({ error: 'Izberite vlogo' }).int().positive('Izberite vlogo'),
  discipline_id: z.number().int().positive().nullable().default(null),
  hours: num('Vnesite ure').min(0, 'Ure ne smejo biti negativne').max(100, 'Preveč ur'),
  kilometers: num('Vnesite kilometre').min(0, 'Kilometri ne smejo biti negativni').max(10000, 'Preveč kilometrov'),
  notes: optText,
});

// --- Roles & tariffs --------------------------------------------------------

export const tierSchema = z
  .object({
    from: num('Vnesite začetek').min(0, 'Začetek ne sme biti negativen'),
    to: z.number().nullable(),
    rate: num('Vnesite znesek').min(0, 'Znesek ne sme biti negativen'),
  })
  .refine((t) => t.to == null || t.to > t.from, {
    message: 'Zgornja meja mora biti večja od začetka',
    path: ['to'],
  });

export const roleSchema = z.object({
  name: req('Vnesite ime vloge'),
  rates: z.array(tierSchema),
  invoiceRates: z.array(tierSchema),
});

// --- Payments --------------------------------------------------------------

export const recordPaymentSchema = z.object({
  payment_id: z.number().int().positive(),
  amount_cents: z
    .number({ error: 'Vnesite znesek' })
    .int('Neveljaven znesek')
    .positive('Znesek mora biti večji od 0'),
  paid_on: isoDateSchema,
  method: paymentMethodSchema,
  note: optText,
});
