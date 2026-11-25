import { describe, expect, it } from 'vitest';
import { ctAntwortet, ERSATZTEXT, verbindungMitErsatztext, verboten } from '@ui/ct/verbot.testutil';
import { STRUKTUR_VERWEIGERT, strukturZugriff } from './struktur';

/**
 * **Welcher Text bei fehlendem Recht** (#1147): Der Ersatztext aus `main.tsx` gilt für jedes Verbot ohne eigenen Text –
 * er darf deshalb nicht „Gruppen ändern dürfen …“ sagen. Das Ändern hat seinen eigenen Text.
 */
verbindungMitErsatztext();

describe('kein Recht (Organigramm)', () => {
  it('Obergruppen lesen ohne Recht → der Ersatztext', async () => {
    ctAntwortet(() => verboten());
    const e = (await strukturZugriff.obergruppen(7).catch((x: unknown) => x)) as Error & {
      status: number;
    };
    expect(e.status).toBe(403);
    expect(e.message).toBe(ERSATZTEXT);
  });

  it('Gruppe umhängen ohne Recht → die Regel fürs Ändern', async () => {
    ctAntwortet(() => verboten());
    const e = (await strukturZugriff.loesen(7, 10).catch((x: unknown) => x)) as Error;
    expect(e.message).toBe(STRUKTUR_VERWEIGERT);
  });
});
