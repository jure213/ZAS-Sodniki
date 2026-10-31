export const STATUS_LABELS = {
  planned: 'Načrtovano',
  completed: 'Izvedeno',
  cancelled: 'Preklicano',
  free: 'Zastonj',
  other_zas: 'Plača drug ZAS',
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;

export const PAYMENT_METHOD_LABELS = {
  gotovina: 'Gotovina',
  nakazilo: 'Nakazilo',
  drugo: 'Drugo',
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHOD_LABELS;

export const TARIFF_LABELS = {
  sodnik: 'Sodnik',
  racun: 'Račun',
} as const;

export const USER_ROLE_LABELS = {
  admin: 'Administrator',
  user: 'Uporabnik',
} as const;
