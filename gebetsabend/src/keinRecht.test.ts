import { describe, expect, it } from 'vitest';
import { STANDARD_EINSTELLUNGEN } from '@shared/gebetsabend/einstellungen';
import {
  ctAntwortet,
  ERSATZTEXT,
  json,
  verbindungMitErsatztext,
  verboten,
} from '@ui/ct/verbot.testutil';
import { EINRICHTEN_VERWEIGERT, einrichten } from './einrichten';
import { ladeTermin } from './lesen';

/**
 * **Welcher Text bei fehlendem Recht** (#1147): Der Ersatztext aus `main.tsx` gilt für jedes Verbot ohne eigenen Text –
 * er darf deshalb keine einzelne Regel nennen. Die Regeln stehen an den Aufrufen, für die sie gelten.
 */
verbindungMitErsatztext();

describe('kein Recht (Gebetsabend)', () => {
  it('Termin lesen ohne Recht → der Ersatztext (kein eigener Text: wer zuhört, richtet nichts ein)', async () => {
    ctAntwortet(() => verboten());
    const e = (await ladeTermin({ ...STANDARD_EINSTELLUNGEN, kalender: 5 }).catch(
      (x: unknown) => x,
    )) as Error & { status: number };
    expect(e.status).toBe(403);
    expect(e.message).toBe(ERSATZTEXT);
  });

  it('Einrichten ohne Recht → die Regel fürs Einrichten', async () => {
    ctAntwortet((methode) => (methode === 'GET' ? json(200, { data: [] }) : verboten()));
    const e = (await einrichten(29).catch((x: unknown) => x)) as Error;
    expect(e.message).toBe(EINRICHTEN_VERWEIGERT);
  });
});
