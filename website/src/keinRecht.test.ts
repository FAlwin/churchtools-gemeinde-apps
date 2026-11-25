import { describe, expect, it } from 'vitest';
import {
  ctAntwortet,
  ERSATZTEXT,
  json,
  verbindungMitErsatztext,
  verboten,
} from '@ui/ct/verbot.testutil';
import { EINRICHTEN_VERWEIGERT, einrichten, ladeGruppen } from './einrichten';

/**
 * **Welcher Text bei fehlendem Recht** (#1147): Der Ersatztext aus `main.tsx` gilt für jedes Verbot ohne eigenen Text –
 * er darf deshalb nicht „Die Website einrichten darf nur ein Admin …“ sagen. Das Einrichten hat seinen eigenen Text.
 */
verbindungMitErsatztext();

describe('kein Recht (Website)', () => {
  it('Gruppen lesen ohne Recht → der Ersatztext', async () => {
    ctAntwortet(() => verboten());
    const e = (await ladeGruppen().catch((x: unknown) => x)) as Error & { status: number };
    expect(e.status).toBe(403);
    expect(e.message).toBe(ERSATZTEXT);
  });

  it('Einrichten ohne Recht → die Regel fürs Einrichten', async () => {
    ctAntwortet((methode) => (methode === 'GET' ? json(200, { data: [] }) : verboten()));
    const e = (await einrichten(29, { id: 4, name: 'Website' }).catch((x: unknown) => x)) as Error;
    expect(e.message).toBe(EINRICHTEN_VERWEIGERT);
  });
});
