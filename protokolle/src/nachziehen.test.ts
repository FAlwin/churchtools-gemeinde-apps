import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { istAufgabe, neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { textAus, type Block } from '@shared/protokolle/dokument';
import {
  sperreVon,
  teileBauen,
  type ProtokollKopf,
  type Schreiber,
} from '@shared/protokolle/speicher';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { imEntwurfNachziehen } from './nachziehen';
import { protokollLesen, type ProtokollOrt } from './schreiben';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** S7-2b: Text, Löschen, Gruppe aus dem Fenster im Protokoll-Entwurf nachziehen – gegen den ChurchTools-Nachbau. */
let ct: Nachbau;
const PROT = 62;
const MIT = 65;
const ORT: ProtokollOrt = { modul: MODUL, kategorie: PROT, sitzung: 's1' };
const MORT = { modul: MODUL, kategorie: MIT };
const JETZT = new Date('2026-10-30T18:00:00Z');
const ICH: Schreiber = { person: 1, name: 'Alwin', fenster: 'todo-f1' };
const JOHANN: Schreiber = { person: 7, name: 'Johann', fenster: 'j1' };

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const DOK: Block[] = [
  { id: 'h', type: 'heading', props: { level: 1 }, content: t('Technik'), children: [] },
  {
    id: 'a1',
    type: 'aufgabe',
    props: { aufgabe: 't1', vorab: '' },
    content: t('Beamer kaufen'),
    children: [],
  },
  {
    id: 'a2',
    type: 'aufgabe',
    props: { aufgabe: 't2', vorab: '' },
    content: t('Raum buchen'),
    children: [],
  },
];
const todo = (id: string, text: string): Aufgabe =>
  neueAufgabe({
    id,
    gruppe: 194,
    sitzung: 's1',
    text,
    wer: [1],
    von: 1,
    am: '2026-10-29T18:00:00Z',
  });

function ablegen(kopf: Partial<ProtokollKopf> = {}) {
  const { stand, werte } = teileBauen(DOK, 's1');
  const k: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung: 's1',
    titel: 'Leitungssitzung',
    status: 'entwurf',
    beginn: '2026-10-29T17:00:00Z',
    termin: null,
    treffen: null,
    freigabe: null,
    sperre: null,
    stand,
    ...kopf,
  };
  const p = werteVon(ct, PROT);
  p.push({ id: ct.naechste++, value: JSON.stringify(k) });
  for (const w of werte) p.push({ id: ct.naechste++, value: w });
  for (const a of [todo('t1', 'Beamer kaufen'), todo('t2', 'Raum buchen')])
    werteVon(ct, MIT).push({ id: ct.naechste++, value: JSON.stringify(a) });
}
const kopf = (): ProtokollKopf =>
  JSON.parse(werteVon(ct, PROT).find((w) => w.value.includes('"art":"protokoll"'))!.value);
const todos = (): Aufgabe[] =>
  werteVon(ct, MIT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istAufgabe);
const dokument = async () => (await protokollLesen(ORT)).dokument!;
const schreibAufrufe = () => ct.aufrufe.filter((a) => !a.startsWith('GET'));
const nachziehen = (n: Parameters<typeof imEntwurfNachziehen>[0]['n'], extra = {}) =>
  imEntwurfNachziehen({
    ort: ORT,
    mitarbeit: MORT,
    gruppe: 194,
    aufgabe: 't1',
    n,
    ich: ICH,
    jetzt: JETZT,
    ...extra,
  });

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push(
    { id: PROT, shorty: 'protokolle-g194', name: 'Protokolle' },
    { id: MIT, shorty: 'mitarbeit-g194', name: 'Mitarbeit' },
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('imEntwurfNachziehen', () => {
  it('Text: im Entwurf und im To-Do (über den normalen Abgleich), Sperre danach wieder frei', async () => {
    ablegen();
    expect(await nachziehen({ art: 'text', text: 'Beamer leihen' })).toEqual({
      art: 'ok',
      hinweis: null,
    });
    expect(textAus((await dokument())[1].content)).toBe('Beamer leihen');
    expect(todos().find((a) => a.id === 't1')).toMatchObject({
      text: 'Beamer leihen',
      geloescht: false,
    });
    expect(todos().find((a) => a.id === 't2')!.text).toBe('Raum buchen');
    expect(kopf().sperre).toBeNull();
  });

  it('raus: Aufgabe weg aus dem Entwurf, To-Do als gelöscht vermerkt', async () => {
    ablegen();
    await nachziehen({ art: 'raus' });
    expect((await dokument()).map((b) => b.id)).toEqual(['h', 'a2']);
    expect(todos().find((a) => a.id === 't1')!.geloescht).toBe(true);
  });

  it('abgegeben: `zuvor` läuft unter meiner Sperre und vor dem Protokoll; danach Absatz mit Hinweis', async () => {
    ablegen();
    const reihenfolge: string[] = [];
    const zuvor = vi.fn(() => {
      reihenfolge.push(`zuvor, Sperre: ${kopf().sperre?.fenster}`);
      return Promise.resolve('Hinweis von zuvor');
    });
    const r = await nachziehen(
      { art: 'abgegeben', text: 'Beamer kaufen', gruppe: 'Jugend' },
      { zuvor },
    );
    expect(r).toEqual({ art: 'ok', hinweis: 'Hinweis von zuvor' });
    expect(reihenfolge).toEqual(['zuvor, Sperre: todo-f1']);
    expect(textAus((await dokument())[1].content)).toBe('Beamer kaufen – an „Jugend“ abgegeben');
    expect(todos().find((a) => a.id === 't1')!.geloescht).toBe(true);
  });

  it('jemand schreibt gerade: nichts gespeichert, die Sperre mit Namen zurück', async () => {
    ablegen({ sperre: sperreVon(JOHANN, new Date(JETZT.getTime() - 60_000)) });
    const zuvor = vi.fn(() => Promise.resolve(null));
    const r = await nachziehen({ art: 'raus' }, { zuvor });
    expect(r).toMatchObject({ art: 'gesperrt', sperre: { name: 'Johann' } });
    expect(schreibAufrufe()).toEqual([]);
    expect(zuvor).not.toHaveBeenCalled();
    expect(todos().find((a) => a.id === 't1')!.geloescht).toBe(false);
  });

  it('verlassene Sperre (älter als 10 Minuten) zählt nicht', async () => {
    ablegen({ sperre: sperreVon(JOHANN, new Date(JETZT.getTime() - 11 * 60_000)) });
    expect((await nachziehen({ art: 'raus' })).art).toBe('ok');
    expect(kopf().sperre).toBeNull();
  });

  it('inzwischen freigegeben oder die Aufgabe steht nicht mehr drin: kein-entwurf, nichts geschrieben', async () => {
    ablegen({ status: 'frei', freigabe: { von: 1, am: '2026-10-30T10:00:00Z' } });
    expect(await nachziehen({ art: 'raus' })).toEqual({ art: 'kein-entwurf' });
    expect(schreibAufrufe()).toEqual([]);
    ct = nachbauStarten();
    ct.kategorien.push(
      { id: PROT, shorty: 'protokolle-g194', name: 'Protokolle' },
      { id: MIT, shorty: 'mitarbeit-g194', name: 'Mitarbeit' },
    );
    ablegen();
    expect(
      await imEntwurfNachziehen({
        ort: ORT,
        mitarbeit: MORT,
        gruppe: 194,
        aufgabe: 'weg',
        n: { art: 'raus' },
        ich: ICH,
        jetzt: JETZT,
      }),
    ).toEqual({ art: 'kein-entwurf' });
    expect(schreibAufrufe()).toEqual([]);
  });

  it('Fehler mitten drin: geworfen, die Sperre ist trotzdem wieder frei – ein zweiter Versuch geht', async () => {
    ablegen();
    ct.fehlerBei = { methode: 'POST', status: 503 }; // die neuen Teile kommen nicht an
    await expect(nachziehen({ art: 'raus' })).rejects.toThrow();
    ct.fehlerBei = null;
    expect(kopf().sperre).toBeNull();
    expect((await dokument()).map((b) => b.id)).toEqual(['h', 'a1', 'a2']);
    expect((await nachziehen({ art: 'raus' })).art).toBe('ok');
    expect((await dokument()).map((b) => b.id)).toEqual(['h', 'a2']);
  });

  it('nach `zuvor` abgewiesen (jemand nimmt die Sperre dazwischen): Meldung „noch einmal speichern“ statt „nichts gespeichert“', async () => {
    ablegen();
    const zuvor = vi.fn(async () => {
      // Johann übernimmt genau jetzt (wie „Schreiben übernehmen“ im Editor).
      const w = werteVon(ct, PROT).find((x) => x.value.includes('"art":"protokoll"'))!;
      w.value = JSON.stringify({ ...kopf(), sperre: sperreVon(JOHANN, JETZT) });
      return Promise.resolve(null);
    });
    const e: unknown = await nachziehen(
      { art: 'abgegeben', text: 'Beamer kaufen', gruppe: 'Jugend' },
      { zuvor },
    ).catch((x: unknown) => x);
    expect(fehlerMeldung(e).text).toMatch(/schon in der anderen Gruppe.*noch einmal speichern/);
    expect(kopf().sperre?.name).toBe('Johann'); // Johanns Sperre bleibt – freigegeben wird nur die eigene
  });
});
