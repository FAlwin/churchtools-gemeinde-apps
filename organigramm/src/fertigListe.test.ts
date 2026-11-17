import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { schreibeEinrichtung } from './einrichtenSchreiben';
import { fertigKopf, fertigListe, nichtMehrGebrauchtText } from './fertigListe';
import { anschluss, einrichtenEingabe, FakeCt, FakeSpeicher } from './einrichtenSchreiben.testutil';

const lauf = async (f = new FakeCt()) => {
  const e = einrichtenEingabe();
  const l = await schreibeEinrichtung(e, anschluss(f, new FakeSpeicher(), e));
  if (l.art !== 'gelaufen') throw new Error('gestoppt');
  return l;
};

describe('fertigListe', () => {
  it('alles gut: eine Zeile je Baustein, gleiche Schritte zusammengezählt, jede „nachgelesen“', async () => {
    const l = await lauf();
    const z = fertigListe(l.ergebnisse);
    expect(z.map((x) => [x.zeichen, x.titel])).toEqual([
      ['ok', 'Gruppentyp „Gruppenwechsel“ angelegt'],
      ['ok', 'Rechte der Leitung gesetzt'],
      ['ok', '2 Wechsel-Gruppen angelegt'],
      ['ok', '2 Routinen eingerichtet'],
      ['ok', 'Regeln in 2 Wechsel-Gruppen geschrieben'],
      ['ok', '2 Wechsel-Gruppen eingeschaltet'],
      ['ok', 'Regeln in 3 Kindergruppen geschrieben'],
      ['ok', '3 Kindergruppen eingeschaltet'],
      ['ok', 'Neu berechnet'],
      ['ok', 'Einrichtung gespeichert'],
    ]);
    expect(z[0].text).toContain('nachgelesen');
    expect(z[8].text).toBe('niemand aufgenommen, verschoben oder ausgetragen');
    expect(fertigKopf(l)).toMatchObject({ art: 'ok', titel: 'Fertig.' });
  });

  it('Neuberechnen nennt die Zahlen, die ChurchTools gemeldet hat', async () => {
    const f = new FakeCt();
    f.refresh = (id) => [{ groupId: id, created: 3, updated: 0, deleted: 1 }];
    const z = fertigListe((await lauf(f)).ergebnisse);
    expect(z.find((x) => x.titel === 'Neu berechnet')?.text).toBe(
      '6 Personen aufgenommen, 2 ausgetragen',
    );
  });

  it('Fehler: der gelungene Teil, der Fehler allein mit Namen und Grund, der Rest „offen“ – und der Kasten sagt „Nicht ganz fertig“', async () => {
    const f = new FakeCt();
    f.ausfall = (a) => (a.pfad === '/dynamicgroups/2/ruleset' ? new ApiError(504, 'x') : undefined);
    const l = await lauf(f);
    const z = fertigListe(l.ergebnisse);
    const i = z.findIndex((x) => x.zeichen === 'fehler');
    expect(z[i]).toMatchObject({ titel: 'Regeln in „Fische“' });
    expect(z[i].text).toContain('Nichts ist kaputt');
    expect(z[i - 1]).toMatchObject({
      zeichen: 'ok',
      titel: 'Regeln in 1 Kindergruppe geschrieben',
    });
    expect(z.slice(i + 1).map((x) => x.zeichen)).toContain('offen');
    expect(z.slice(i + 1).find((x) => x.zeichen === 'offen')).toMatchObject({
      titel: 'Regeln in 1 Kindergruppe',
      text: 'noch nicht geschrieben',
    });
    expect(fertigKopf(l)).toMatchObject({ art: 'fehler', titel: 'Nicht ganz fertig.' });
    expect(fertigKopf(l).text).toContain('schreibt nur, was noch fehlt');
  });

  it('abgelehnt: der Kasten sagt, dass ein Recht fehlt – nicht „einfach nochmal“', async () => {
    const f = new FakeCt();
    f.ausfall = (a) => (a.pfad === '/group/grouptypes' ? new ApiError(401, 'x') : undefined);
    const l = await lauf(f);
    expect(fertigKopf(l).text).toContain('Recht');
    expect(fertigListe(l.ergebnisse)[0]).toMatchObject({
      zeichen: 'fehler',
      titel: 'Gruppentyp „Gruppenwechsel“',
    });
  });

  it('nichts zu schreiben: „Fertig“ ohne Liste', () => {
    expect(
      fertigKopf({
        art: 'gelaufen',
        ok: true,
        ergebnisse: [],
        gespeichert: null,
        nichtMehrGebraucht: [],
      }),
    ).toMatchObject({ art: 'ok', text: expect.stringContaining('nichts zu schreiben') });
  });
});

describe('nichtMehrGebrauchtText', () => {
  it('nennt die Gruppen und sagt, dass sie bleiben', () => {
    expect(nichtMehrGebrauchtText([])).toBeNull();
    expect(nichtMehrGebrauchtText([{ gruppeId: 5, name: 'Fische → Jungschar' }])).toContain(
      '„Fische → Jungschar“. Die Gruppe bleibt',
    );
    expect(
      nichtMehrGebrauchtText([
        { gruppeId: 5, name: 'A → B' },
        { gruppeId: 6, name: 'B → C' },
      ]),
    ).toContain('Die Gruppen bleiben');
  });
});
