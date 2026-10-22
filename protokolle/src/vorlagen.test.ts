import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { alsFormular, STANDARD_VORLAGEN, type VorlagenFormular } from '@shared/protokolle/vorlagen';
import { gruppeEinrichten } from './einrichten';
import { LEITER, MODUL, nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { ladeVorlagen, vorlageLoeschen, vorlageSpeichern } from './vorlagen';

/** Vorlagen (S2-3) gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`). */
let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

const NEU: VorlagenFormular = {
  name: 'Jahresplanung',
  punkte: [
    { titel: 'Rückblick', text: 'Was hat getragen?', verweis: null },
    { titel: 'Offene To-Dos', text: '', verweis: 'offene-aufgaben' },
  ],
  aufgaben: ['Saal buchen'],
};
const namen = async (): Promise<string[]> =>
  (await ladeVorlagen(MODUL)).vorlagen.map((g) => g.vorlage.name);

describe('Vorlagen speichern, ändern, löschen', () => {
  it('noch keine Kategorie: keine Vorlagen (kein Fehler)', async () => {
    expect(await ladeVorlagen(MODUL)).toEqual({ kategorie: null, vorlagen: [] });
  });

  it('erste neue Vorlage legt die Kategorie samt Standard-Vorlagen an; Liste nach Namen', async () => {
    await vorlageSpeichern(MODUL, NEU, null);
    expect(await namen()).toEqual(['Jahresplanung', 'Klausur', 'Leitungssitzung', 'Teamtreffen']);
  });

  it('ändern: gleiche ID, kein zweiter Wert; Inhalt wie im Formular', async () => {
    await vorlageSpeichern(MODUL, NEU, null);
    const g = (await ladeVorlagen(MODUL)).vorlagen.find((x) => x.vorlage.name === 'Jahresplanung')!;
    await vorlageSpeichern(MODUL, { ...alsFormular(g.vorlage), name: 'Jahresplanung 2027' }, g);
    const nachher = (await ladeVorlagen(MODUL)).vorlagen;
    expect(nachher).toHaveLength(4);
    const v = nachher.find((x) => x.wert === g.wert)!.vorlage;
    expect(v.id).toBe(g.vorlage.id);
    expect(alsFormular(v)).toEqual({ ...NEU, name: 'Jahresplanung 2027' });
  });

  it('löschen: weg – und beim nächsten Einrichten kommen gelöschte Standard-Vorlagen NICHT wieder', async () => {
    await gruppeEinrichten(
      MODUL,
      { id: 194, name: 'Technik', versteckt: false },
      {
        rollen: [{ rolle: LEITER, stufe: 'leitung' }],
        punkte: 'vorschlagen',
        kalender: null,
      },
    );
    for (const g of (await ladeVorlagen(MODUL)).vorlagen) await vorlageLoeschen(MODUL, g);
    expect(await namen()).toEqual([]);
    await gruppeEinrichten(
      MODUL,
      { id: 11, name: 'Gemeindeleitung', versteckt: true },
      {
        rollen: [],
        punkte: 'vorschlagen',
        kalender: null,
      },
    );
    expect(await namen()).toEqual([]);
  });

  it('Formular unvollständig: 422 mit dem Grund, nichts geschrieben', async () => {
    await expect(vorlageSpeichern(MODUL, { ...NEU, name: ' ' }, null)).rejects.toMatchObject({
      status: 422,
      message: 'Die Vorlage braucht einen Namen.',
    });
    expect(ct.aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });

  it('zu lang für einen Wert: 413, nichts geschrieben', async () => {
    const lang = { ...NEU, punkte: [{ titel: 'Viel', text: 'x'.repeat(10_500), verweis: null }] };
    await expect(vorlageSpeichern(MODUL, lang, null)).rejects.toMatchObject({ status: 413 });
    expect(ct.aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });

  it('ChurchTools sagt 201, speichert aber nicht: NichtUebernommen statt „gespeichert“', async () => {
    await vorlageSpeichern(MODUL, NEU, null); // Kategorie + Standard-Vorlagen sind da
    ct.schluckeWert = (v) => v.includes('Andere');
    await expect(vorlageSpeichern(MODUL, { ...NEU, name: 'Andere' }, null)).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
  });

  it('Löschen nicht übernommen: NichtUebernommen', async () => {
    await vorlageSpeichern(MODUL, NEU, null);
    const g = (await ladeVorlagen(MODUL)).vorlagen[0];
    ct.schlucken.add('DELETE WERT');
    await expect(vorlageLoeschen(MODUL, g)).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('vorübergehender Fehler beim Speichern: wirft ApiError, Standard-Vorlagen bleiben unberührt', async () => {
    await vorlageSpeichern(MODUL, NEU, null);
    ct.fehlerBei = { methode: 'POST', status: 503 };
    await expect(vorlageSpeichern(MODUL, { ...NEU, name: 'Zwei' }, null)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(await namen()).toHaveLength(1 + STANDARD_VORLAGEN.length);
  });
});
