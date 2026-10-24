import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { neueAufgabe, statusSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import { aufgabeAendern, aufgabenSchreiben, aufgabenWerte } from './aufgabenSchreiben';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** To-Dos in „Mitarbeit“ schreiben (S4-2) gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 65;
const ORT = { modul: MODUL, kategorie: KAT };
const AM = '2026-10-24T18:00:00Z';
const todo = (id: string, text = id): Aufgabe =>
  neueAufgabe({ id, gruppe: 194, sitzung: 's1', text, von: 1, am: AM });
const ablegen = (...a: Aufgabe[]) => {
  for (const x of a) werteVon(ct, KAT).push({ id: ct.naechste++, value: JSON.stringify(x) });
};
const schreibAufrufe = () => ct.aufrufe.filter((x) => !x.startsWith('GET'));

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'mitarbeit-g194', name: 'Mitarbeit · Technik' });
});
afterEach(nachbauEnde);

describe('aufgabenWerte', () => {
  it('liest alle To-Dos (auch gelöschte), Fremdes übergangen, bei doppelter ID der kleinste Wert', () => {
    werteVon(ct, KAT).push(
      { id: 9, value: JSON.stringify({ ...todo('t1'), text: 'zweiter' }) },
      { id: 3, value: JSON.stringify(todo('t1')) },
      { id: 4, value: 'kaputt' },
      { id: 5, value: JSON.stringify({ ...todo('t2'), geloescht: true }) },
    );
    return aufgabenWerte(ORT).then((w) =>
      expect(w.map((x) => [x.wert, x.aufgabe.id, x.aufgabe.text])).toEqual([
        [3, 't1', 't1'],
        [5, 't2', 't2'],
      ]),
    );
  });
});

describe('aufgabenSchreiben', () => {
  it('legt an, ändert, liest nach und liefert den frischen Stand', async () => {
    ablegen(todo('t1'));
    const r = await aufgabenSchreiben(ORT, () => ({
      anlegen: [todo('t2')],
      aendern: [{ ...todo('t1'), text: 'neu' }],
    }));
    expect(r.map((a) => [a.id, a.text])).toEqual([
      ['t1', 'neu'],
      ['t2', 't2'],
    ]);
  });

  it('plant auf dem frisch gelesenen Stand – ein inzwischen gesetzter Status bleibt', async () => {
    ablegen(statusSetzen(todo('t1'), 'erledigt', 19, AM));
    const r = await aufgabenSchreiben(ORT, (vorhanden) => ({
      anlegen: [],
      aendern: vorhanden.map((a) => ({ ...a, text: 'neu' })),
    }));
    expect(r[0]).toMatchObject({ text: 'neu', status: 'erledigt' });
  });

  it('nichts zu tun → nur lesen, nichts schreiben', async () => {
    ablegen(todo('t1'));
    await aufgabenSchreiben(ORT, () => ({ anlegen: [], aendern: [] }));
    expect(schreibAufrufe()).toEqual([]);
  });

  it('legt ein To-Do nicht doppelt an, das schon da ist (abgebrochenes Speichern davor)', async () => {
    ablegen(todo('t1'));
    await aufgabenSchreiben(ORT, () => ({ anlegen: [todo('t1')], aendern: [] }));
    expect(schreibAufrufe()).toEqual([]);
  });

  it('ChurchTools sagt 201, legt aber nichts an → Fehler', async () => {
    ct.schluckeWert = () => true;
    await expect(
      aufgabenSchreiben(ORT, () => ({ anlegen: [todo('t1')], aendern: [] })),
    ).rejects.toThrow(/nicht übernommen/);
  });

  it('ChurchTools sagt 200, ändert aber nichts → Fehler', async () => {
    ablegen(todo('t1'));
    ct.schlucken.add('PUT WERT');
    await expect(
      aufgabenSchreiben(ORT, () => ({ anlegen: [], aendern: [{ ...todo('t1'), text: 'x' }] })),
    ).rejects.toThrow(/nicht übernommen/);
  });

  it('ein zu änderndes To-Do ist verschwunden → Fehler statt still neu anlegen', async () => {
    await expect(
      aufgabenSchreiben(ORT, () => ({ anlegen: [], aendern: [todo('t1')] })),
    ).rejects.toThrow(/verschwunden/);
  });
});

describe('aufgabeAendern', () => {
  it('ändert auf dem frisch gelesenen Stand (Status von jemand anderem bleibt erhalten)', async () => {
    ablegen(statusSetzen(todo('t1'), 'arbeit', 19, AM));
    const r = await aufgabeAendern(
      ORT,
      't1',
      (a) => ({ ...a, bis: '2026-11-01' }),
      () => todo('x'),
    );
    expect(r.status).toBe('arbeit');
    expect(r.bis).toBe('2026-11-01');
    expect((await aufgabenWerte(ORT))[0].aufgabe).toEqual(r);
  });

  it('gibt es das To-Do noch nicht, entsteht es', async () => {
    const r = await aufgabeAendern(
      ORT,
      't1',
      (a) => ({ ...a, wer: [7] }),
      () => todo('t1', 'neu'),
    );
    expect(r).toMatchObject({ id: 't1', text: 'neu', wer: [7] });
    expect((await aufgabenWerte(ORT)).map((x) => x.aufgabe.id)).toEqual(['t1']);
  });

  it('nicht übernommen → Fehler', async () => {
    ablegen(todo('t1'));
    ct.schlucken.add('PUT WERT');
    await expect(
      aufgabeAendern(
        ORT,
        't1',
        (a) => ({ ...a, wer: [7] }),
        () => todo('x'),
      ),
    ).rejects.toThrow();
  });
});
