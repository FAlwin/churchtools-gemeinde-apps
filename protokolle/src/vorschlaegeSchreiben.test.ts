import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import {
  ablehnen,
  NAECHSTE,
  neuerVorschlag,
  vorschlagAendern,
  zurueckziehen,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import { ApiError } from '@ui/ct/fehler';
import { aufgabenWerte } from './aufgabenSchreiben';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';
import { vorschlagEinreichen, vorschlagSchreiben, vorschlagWerte } from './vorschlaegeSchreiben';

/** Vorschläge in „Mitarbeit“ (S5-4) gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 65;
const ORT = { modul: MODUL, kategorie: KAT };
const AM = '2026-11-06T10:00:00Z';
const ANNA = { person: 19, name: 'Anna Wiens' };
const LEITUNG = { person: 1, name: 'Alwin Friesen' };
const vorschlag = (id: string): Vorschlag =>
  neuerVorschlag({ id, gruppe: 194, titel: 'Beamer', text: '', ziel: NAECHSTE, ich: ANNA, am: AM });
const ablegen = (...x: unknown[]) => {
  for (const v of x) werteVon(ct, KAT).push({ id: ct.naechste++, value: JSON.stringify(v) });
};

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'mitarbeit-g194', name: 'Mitarbeit · Technik' });
});
afterEach(nachbauEnde);

describe('vorschlagWerte', () => {
  it('liest nur Vorschläge – To-Dos und Kaputtes übergangen; To-Dos lesen keine Vorschläge', async () => {
    ablegen(
      vorschlag('v1'),
      neueAufgabe({ id: 't1', gruppe: 194, sitzung: null, text: 'x', von: 1, am: AM }),
    );
    werteVon(ct, KAT).push({ id: ct.naechste++, value: 'kaputt' });
    expect((await vorschlagWerte(ORT)).map((v) => v.id)).toEqual(['v1']);
    expect((await aufgabenWerte(ORT)).map((w) => w.aufgabe.id)).toEqual(['t1']);
  });
});

describe('vorschlagEinreichen', () => {
  it('legt an und liest nach; ein zweiter Versuch mit derselben ID legt keinen zweiten an', async () => {
    const v = vorschlag('v1');
    expect(await vorschlagEinreichen(ORT, v)).toEqual(v);
    await vorschlagEinreichen(ORT, { ...v, titel: 'anders' });
    expect(werteVon(ct, KAT)).toHaveLength(1);
    expect((await vorschlagWerte(ORT))[0].titel).toBe('Beamer');
  });
});

describe('vorschlagSchreiben', () => {
  it('wendet die Regel auf den frisch gelesenen Stand an und liest nach', async () => {
    ablegen(vorschlag('v1'));
    const r = await vorschlagSchreiben(ORT, 'v1', (v) =>
      vorschlagAendern(v, { titel: 'Neu', text: 'x', ziel: NAECHSTE }, ANNA, AM),
    );
    expect(r.titel).toBe('Neu');
    expect((await vorschlagWerte(ORT))[0].titel).toBe('Neu');
  });

  it('inzwischen entschieden → Meldung (409) statt Absturz, nichts geschrieben', async () => {
    ablegen(ablehnen(vorschlag('v1'), 'nein', LEITUNG, AM));
    const vorher = werteVon(ct, KAT)[0].value;
    const e = await vorschlagSchreiben(ORT, 'v1', (v) => zurueckziehen(v, ANNA, AM)).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(409);
    expect((e as ApiError).message).toContain('schon entschieden');
    expect(werteVon(ct, KAT)[0].value).toBe(vorher);
  });

  it('gibt es ihn nicht mehr → Meldung, nichts angelegt', async () => {
    await expect(vorschlagSchreiben(ORT, 'weg', (v) => v)).rejects.toThrow('gibt es nicht mehr');
    expect(werteVon(ct, KAT)).toHaveLength(0);
  });
});
