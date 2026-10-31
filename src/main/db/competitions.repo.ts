import type { Competition } from '@shared/types';
import type { competitionSchema } from '@shared/schemas';
import type { z } from 'zod';
import { db, unwrap } from './client';
import { compStatus, text, type Row } from './rows';

const COLS = 'id, name, date, location, status, notes';
export type CompetitionInput = z.output<typeof competitionSchema>;

const toCompetition = (r: Row): Competition => ({
  id: Number(r.id),
  name: text(r.name),
  date: text(r.date),
  location: text(r.location),
  status: compStatus(r.status),
  notes: text(r.notes),
});

export async function listCompetitions(): Promise<Competition[]> {
  const rows = unwrap(
    await db.rest.from('competitions').select(COLS).order('date', { ascending: false }).order('id'),
  );
  return (rows as Row[]).map(toCompetition);
}

export async function getCompetition(id: number): Promise<Competition> {
  return toCompetition(unwrap(await db.rest.from('competitions').select(COLS).eq('id', id).single()));
}

export async function createCompetition(input: CompetitionInput): Promise<Competition> {
  return toCompetition(unwrap(await db.rest.from('competitions').insert(input).select(COLS).single()));
}

export async function updateCompetition(id: number, input: CompetitionInput): Promise<Competition> {
  return toCompetition(unwrap(await db.rest.from('competitions').update(input).eq('id', id).select(COLS).single()));
}

/** Assignments go with the competition; existing payments block the delete (IN_USE). */
export async function deleteCompetition(id: number): Promise<void> {
  unwrap(await db.rest.from('competitions').delete().eq('id', id));
}
