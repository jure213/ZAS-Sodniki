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

// --- IPC inputs --------------------------------------------------------------
// Everything below validates what the renderer sends over IPC. Forms reuse the
// entity schemas above; these add ids, filters and options.

export const idSchema = z.number({ error: 'Neveljaven ID' }).int('Neveljaven ID').positive('Neveljaven ID');
export const idInput = z.object({ id: idSchema });

const cents = (msg: string) => z.number({ error: msg }).int(msg).min(0, msg).max(100_000_000, msg);

export const officialUpdateInput = z.object({ id: idSchema, data: officialSchema });
export const officialActiveInput = z.object({ id: idSchema, active: z.boolean() });
export const officialImportInput = z.object({
  rows: z
    .array(
      z.object({
        name: req('Vnesite ime in priimek'),
        email: officialSchema.shape.email,
        phone: optText,
        rank: optText,
        additional_exams: optText,
      }),
    )
    .max(2000, 'Preveč vrstic za uvoz'),
});

export const competitionUpdateInput = z.object({ id: idSchema, data: competitionSchema });

/** Save one assignment (create or update; one per official per competition). */
export const assignmentSaveInput = assignmentSchema.extend({
  /** Given when editing; without it an existing (competition, official) row is updated. */
  id: idSchema.optional(),
  /** Manual override of the base amount (EUR cents); null/undefined = from the tariff. */
  base_sodnik_cents: cents('Neveljaven znesek').nullable().optional(),
  base_racun_cents: cents('Neveljaven znesek').nullable().optional(),
  /** Recompute base amounts and travel rate from the current tariff. */
  recalculate: z.boolean().default(false),
});

/** Draft for a live preview: nothing is stored. */
export const assignmentPreviewInput = z.object({
  competition_id: idSchema,
  role_id: idSchema,
  hours: assignmentSchema.shape.hours,
  kilometers: assignmentSchema.shape.kilometers,
});

export const assignmentBulkItem = assignmentSchema.omit({ competition_id: true });
export const assignmentBulkInput = z.object({
  competition_id: idSchema,
  items: z.array(assignmentBulkItem).min(1, 'Izberite vsaj enega sodnika').max(500, 'Preveč sodnikov naenkrat'),
});

export const competitionIdInput = z.object({ competition_id: idSchema });

export const disciplineNameInput = z.object({ name: req('Vnesite ime discipline') });
export const disciplineUpdateInput = z.object({
  id: idSchema,
  name: req('Vnesite ime discipline').optional(),
  archived: z.boolean().optional(),
});
export const disciplineReorderInput = z.object({ ids: z.array(idSchema).max(1000) });

export const roleSaveInput = roleSchema.extend({
  id: idSchema.optional(),
  archived: z.boolean().default(false),
});

export const appConfigSchema = z.object({
  travel_cost_per_km: z
    .number({ error: 'Vnesite znesek na kilometer' })
    .min(0, 'Znesek ne sme biti negativen')
    .max(100, 'Prevelik znesek')
    .refine((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 1e-6, 'Največ štiri decimalke'),
  default_payment_method: paymentMethodSchema,
});

export const clearAllDataInput = z.object({ confirm: z.literal(true, { error: 'Potrdite brisanje' }) });

export const paymentStatusFilter = z.enum(['owed', 'partial', 'paid', 'open']);
/** open = owed + partial (everything with a remaining balance). */
export const paymentFilterSchema = z.object({
  official_id: idSchema.optional(),
  competition_id: idSchema.optional(),
  status: paymentStatusFilter.optional(),
  /** Competition date range, inclusive. */
  date_from: isoDateSchema.optional(),
  date_to: isoDateSchema.optional(),
  hide_zero: z.boolean().default(false),
});
export type PaymentFilter = z.input<typeof paymentFilterSchema>;

export const generatePaymentsInput = z.object({ competition_id: idSchema, tariff: tariffSchema });
export const paymentUpdateInput = z.object({
  id: idSchema,
  notes: z.string().optional(),
  amount_due_cents: cents('Neveljaven znesek').optional(),
});

export const dashboardInput = z.object({ year: z.number().int().min(1900).max(2200).optional() });

export const userCreateSchema = z.object({
  username: req('Vnesite uporabniško ime'),
  name: req('Vnesite ime'),
  role: z.enum(['admin', 'user'], { error: 'Izberite vlogo' }),
  password: z.string({ error: 'Vnesite geslo' }).min(6, 'Geslo mora imeti vsaj 6 znakov'),
});
export const userUpdateInput = z.object({ id: idSchema, data: userSchema });

export const prefsInput = z.object({ rememberMe: z.boolean() });

export const excelCompetitionInput = z.object({ competition_id: idSchema, tariff: tariffSchema });
export const excelSummaryInput = z.object({
  competition_ids: z.array(idSchema).min(1, 'Nobena tekma ni bila izbrana').max(1000),
  tariff: tariffSchema,
});
