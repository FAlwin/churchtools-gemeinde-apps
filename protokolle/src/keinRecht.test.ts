import { describe, expect, it } from 'vitest';
import {
  ctAntwortet,
  ERSATZTEXT,
  json,
  verbindungMitErsatztext,
  verboten,
} from '@ui/ct/verbot.testutil';
import { TREFFEN_VERWEIGERT, treffenAendern } from './anwesenheitSchreiben';
import { treffenLoeschen } from './bearbeiten';
import { terminDaten } from './termin';

/**
 * **Welcher Text bei fehlendem Recht** (#1147): Der Ersatztext aus `main.tsx` gilt für jedes Verbot ohne eigenen Text –
 * er darf deshalb nicht „Protokolle sehen die Rollen …“ sagen. Gruppentreffen löschen und verschieben hatten keinen
 * eigenen Text und zeigten genau diesen Satz.
 */
verbindungMitErsatztext();

const TREFFEN = { startDate: '2026-12-01T18:00:00Z', isCompleted: false, isCanceled: false };

describe('kein Recht (Protokolle)', () => {
  it('Termin lesen ohne Recht (z. B. über einen geteilten Link) → der Ersatztext', async () => {
    ctAntwortet(() => verboten());
    const e = (await terminDaten({ kalender: 2, id: 9 }).catch((x: unknown) => x)) as Error & {
      status: number;
    };
    expect(e.status).toBe(403);
    expect(e.message).toBe(ERSATZTEXT);
  });

  it('Gruppentreffen löschen ohne Recht → die Regel für Gruppentreffen', async () => {
    ctAntwortet(() => verboten());
    const e = (await treffenLoeschen(4, 11).catch((x: unknown) => x)) as Error;
    expect(e.message).toBe(TREFFEN_VERWEIGERT);
  });

  it('Gruppentreffen verschieben ohne Recht → die Regel für Gruppentreffen', async () => {
    ctAntwortet((methode) => (methode === 'GET' ? json(200, { data: TREFFEN }) : verboten()));
    const e = (await treffenAendern(4, 11, (r) => ({
      ...r,
      startDate: '2026-12-02T18:00:00Z',
    })).catch((x: unknown) => x)) as Error;
    expect(e.message).toBe(TREFFEN_VERWEIGERT);
  });
});
