import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { geplanterKopf } from '@shared/protokolle/planen';
import { teileBauen, type ProtokollKopf, type Schreiber } from '@shared/protokolle/speicher';
import { gruppeEinrichten } from './einrichten';
import { ladeSitzungen } from './lesen';
import { protokollLoeschen } from './loeschen';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';

/**
 * Nach dem Löschen (W6) steht die Sitzung – wenn Termin und Gruppentreffen bleiben – wieder als „ohne Protokoll“ in der
 * Liste. Das ergibt sich aus der Lade-Logik (`ladeSitzungen`), nicht aus einem eigenen Vermerk; hier belegt gegen den
 * Nachbau, mit dem echten Lesen.
 */
let ct: Nachbau;
const ZONE = 'Europe/Berlin';
const JETZT = new Date('2027-03-01T10:00:00Z');
const BEGINN = '2027-03-17T17:00:00Z';
const ICH: Schreiber = { person: 1, name: 'Alwin Friesen', fenster: 'f1' };

beforeEach(async () => {
  ct = nachbauStarten();
  await gruppeEinrichten(
    MODUL,
    { id: 194, name: 'Technik', versteckt: false },
    {
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'mitglied' },
      ],
      punkte: 'vorschlagen',
      kalender: 4,
    },
  );
  ct.termine = [
    {
      kalender: 4,
      id: 114,
      titel: 'Leitungssitzung',
      beginn: BEGINN,
      anfragen: [
        { person: 1, state: 'accepted' },
        { person: 19, state: 'accepted' },
      ],
    },
  ];
  ct.treffen.set(194, [{ id: 15, startDate: BEGINN }]);
});
afterEach(nachbauEnde);

const gruppe = () => ({
  id: 194,
  protokolle: kategorieVon(ct, 'protokolle-g194'),
  mitarbeit: kategorieVon(ct, 'mitarbeit-g194'),
});

function protokollAblegen(status: ProtokollKopf['status']) {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 'okt');
  const kopf: ProtokollKopf = {
    ...geplanterKopf(
      { titel: 'Leitungssitzung', beginn: BEGINN, termin: { kalender: 4, id: 114 }, treffen: 15 },
      'okt',
    ),
    status,
    stand,
  };
  for (const v of [JSON.stringify(kopf), ...werte])
    werteVon(ct, gruppe().protokolle).push({ id: ct.naechste++, value: v });
}

const loeschen = (teil: Partial<Parameters<typeof protokollLoeschen>[0]> = {}) =>
  protokollLoeschen({
    ort: { modul: MODUL, kategorie: gruppe().protokolle, sitzung: 'okt' },
    ich: ICH,
    gruppe: 194,
    mitarbeit: { modul: MODUL, kategorie: gruppe().mitarbeit },
    todos: false,
    termin: null,
    treffen: null,
    jetzt: JETZT,
    ...teil,
  });

describe('Liste nach „Protokoll löschen“', () => {
  it('Entwurf gelöscht, Termin und Treffen bleiben: die Sitzung steht in „Kommend“ ohne Protokoll', async () => {
    protokollAblegen('entwurf');
    const vorher = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(vorher.kommend.map((s) => s.kopf?.status)).toEqual(['entwurf']);

    await loeschen();

    const nachher = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(nachher.kommend.map((s) => [s.termin?.id, s.treffen, s.kopf])).toEqual([
      [114, 15, null],
    ]);
    expect(nachher.protokolle).toEqual([]);
    expect(nachher.teile).toEqual([]);
  });

  it('freigegeben gelöscht: weg aus „Protokolle“, die Sitzung steht wieder in „Kommend“ ohne Protokoll', async () => {
    protokollAblegen('frei');
    expect((await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT)).protokolle).toHaveLength(1);

    await loeschen();

    const nachher = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(nachher.protokolle).toEqual([]);
    expect(nachher.kommend.map((s) => [s.termin?.id, s.kopf])).toEqual([[114, null]]);
  });

  it('mit Termin und Treffen gelöscht: die Sitzung ist ganz weg', async () => {
    protokollAblegen('entwurf');
    await loeschen({
      termin: { termin: { kalender: 4, id: 114 }, beginn: BEGINN, zeitzone: ZONE },
      treffen: 15,
    });
    const nachher = await ladeSitzungen(MODUL, gruppe(), ZONE, JETZT);
    expect(nachher.kommend).toEqual([]);
    expect(nachher.protokolle).toEqual([]);
  });
});
