import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  antragBilderLesen,
  antragVorgabe,
  antragPdfHtml,
  pdfBlatt,
  pdfVorgabeFelder,
  type NachweisAntrag,
} from '@shared/anmeldung/nachweisAntrag';
import {
  nachweisEinstellungenLesen,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import {
  NACHWEIS_SCHRITTE,
  antragLaden,
  antragVorlagenName,
  nachweisArtSichern,
  type AntragBilder,
  type NachweisEingabe,
} from './nachweisArten';
import * as Einrichten from './einrichten';
import { FalschesNachweisCt } from './nachweisArten.testutil';

/**
 * Der Antrag mit eigener PDF (N1d) gegen das nachgestellte ChurchTools (`FalschesNachweisCt`): Speichern wie N1c (Vorlage,
 * HTML-Datei, `htmlFileId`, Teilnehmer-Rolle, Nachlesen) – nur mit Seitenbild statt Logo. Soll-Werte aus den Erzeugern.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  gemeindeLogo: vi.fn(),
}));
const ct = vi.mocked(V);
/** Der Datenspeicher (Ablage „Nachweis-Stand“, N3a) läuft über denselben ersetzten Anschluss. */
vi.mock('@ui/ct/modulPort', async () =>
  (await import('./nachweisArten.testutil')).modulPortImTest(),
);
const einrichten = vi.mocked(Einrichten);

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const JPG2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAQEBAQEBAQEBAQEBAQEBAQEB';

let falsch: FalschesNachweisCt;

const SEITE = { breiteMm: 210, hoeheMm: 297, felder: pdfVorgabeFelder('Lohmar') };
const ANTRAG: NachweisAntrag = {
  ...antragVorgabe('ECG Donrath'),
  vorlageId: null,
  art: 'pdf',
  pdf: SEITE,
};
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
  antrag: ANTRAG,
};
const NEU: AntragBilder = {
  logo: { art: 'keins' },
  unterschrift: { art: 'neu', src: PNG },
  hintergrund: { art: 'neu', src: JPG },
};
const UNVERAENDERT: AntragBilder = {
  logo: { art: 'unveraendert' },
  unterschrift: { art: 'unveraendert' },
  hintergrund: { art: 'unveraendert' },
};
const EINGABE: NachweisEingabe = {
  gruppeId: null,
  name: 'Führungszeugnis',
  einstellungen: E,
  vertrauen: [7],
  antragBilder: NEU,
};
const ICH = 7;

beforeEach(() => {
  falsch = new FalschesNachweisCt();
  ct.ctDaten.mockReset().mockImplementation((pfad: string) => falsch.holen(pfad));
  ct.ctAlleSeiten.mockReset().mockImplementation((pfad: string) => falsch.alleSeiten(pfad));
  ct.ctAnfrage.mockReset().mockImplementation(async (pfad: string, opt?: unknown) => {
    const o = opt as { method?: string; body?: string | FormData };
    let json: unknown;
    if (typeof o?.body === 'string') json = JSON.parse(o.body);
    else if (o?.body instanceof FormData) {
      const datei = o.body.get('files[]') as File;
      json = { html: await datei.text(), name: datei.name };
    }
    return await falsch.schicken(pfad, o?.method ?? 'GET', json);
  });
  einrichten.gemeindeLogo.mockReset().mockResolvedValue('https://ecg.church.tools/logo.png');
});

const gruppeDerArt = () => [...falsch.gruppen.values()].find((g) => g.name.startsWith('Nachweis'))!;
const dateiHochgeladen = () => falsch.schreibend('POST /files/html_template');
const vorlagenAngelegt = () =>
  falsch.aufrufe.filter((a) => a.methode === 'POST' && a.pfad === '/htmltemplates');
const teilnehmer = (gruppeId: number) =>
  falsch.rollenVon(gruppeId).find((r) => r.groupTypeRoleId === 53)!;
const vorlage = () => [...falsch.vorlagen.values()][0];
const inhalt = (v = vorlage()) => falsch.dateien.get(v.htmlFileId!)!;
const nochmal = (
  gruppeId: number,
  mehr: Partial<NachweisEingabe> = {},
  antrag: Partial<NachweisAntrag> = {},
) =>
  nachweisArtSichern(
    {
      ...EINGABE,
      gruppeId,
      antragBilder: UNVERAENDERT,
      ...mehr,
      einstellungen: { ...E, ...mehr.einstellungen, antrag: { ...ANTRAG, ...antrag } },
    },
    ICH,
  );
async function angelegt(bilder: AntragBilder = NEU) {
  const erg = await nachweisArtSichern({ ...EINGABE, antragBilder: bilder }, ICH);
  expect(erg.fehler).toBeNull();
  falsch.aufrufe = [];
  return erg;
}

describe('Neue Art mit eigener PDF', () => {
  it('legt Vorlage, HTML und Rolle an und liest alles nach – das HTML ist das des Erzeugers', async () => {
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(erg.erledigt).toEqual([...NACHWEIS_SCHRITTE]);
    const g = gruppeDerArt();
    const v = vorlage();
    expect(v).toMatchObject({
      name: antragVorlagenName('Führungszeugnis'),
      domainType: 'groupmember-document',
    });
    // Genau das HTML des Erzeugers: Seitenformat der PDF, Hintergrund, Felder
    expect(inhalt()).toBe(antragPdfHtml(pdfBlatt(SEITE, { hintergrund: JPG, unterschrift: PNG })));
    expect(inhalt()).toContain('@page { size: 210mm 297mm; margin: 0 }');
    // Hintergrund-Marker beim Nachlesen
    expect(antragBilderLesen(inhalt())).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: JPG,
    });
    // Rolle Teilnehmer, Datenblock mit Seite und Platzhaltern – ohne Bild
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([v.id]);
    const block = nachweisEinstellungenLesen(g.note)!.antrag!;
    expect(block).toMatchObject({ art: 'pdf', vorlageId: v.id });
    expect(block.pdf).toEqual(SEITE);
    expect(g.note).not.toContain('data:image');
    expect(erg.befund?.antrag).toEqual({ vorlageId: v.id, haengt: true });
  });

  it('ohne Seitenbild („keins“): abgewiesen, bevor irgendetwas geschrieben wird', async () => {
    const erg = await nachweisArtSichern(
      { ...EINGABE, antragBilder: { ...NEU, hintergrund: { art: 'keins' } } },
      ICH,
    ).catch((e: unknown) => e);
    expect(erg).toBeInstanceOf(ApiError);
    expect((erg as ApiError).status).toBe(422);
    expect(falsch.aufrufe.filter((a) => a.methode !== 'GET')).toEqual([]);
  });

  it('„unverändert“ ohne gespeicherten Inhalt: kein Seitenbild – Meldung, kein leeres Blatt hochgeladen', async () => {
    const erg = await nachweisArtSichern(
      { ...EINGABE, antragBilder: { ...NEU, hintergrund: { art: 'unveraendert' } } },
      ICH,
    );
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect((erg.fehler as ApiError).status).toBe(422);
    expect(dateiHochgeladen()).toEqual([]);
    expect(erg.erledigt).not.toContain('antrag');
  });
});

describe('(c) Der Hintergrund geht nicht verloren', () => {
  it('„unverändert“: das Seitenbild stammt aus dem HTML, das in ChurchTools steht', async () => {
    const erg = await angelegt();
    const neueFelder = SEITE.felder.map((f, i) => (i === 0 ? { ...f, x: 40 } : f));
    const zweite = await nochmal(erg.gruppeId!, {}, { pdf: { ...SEITE, felder: neueFelder } });
    expect(zweite.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: JPG,
    });
    expect(inhalt()).toContain('left:40%');
  });

  it('das HTML lässt sich nicht lesen (503): nichts wird hochgeladen, das Seitenbild bleibt', async () => {
    const erg = await angelegt();
    const vorher = inhalt();
    falsch.scheitert = [{ muster: '/html', status: 503 }];
    const zweite = await nochmal(
      erg.gruppeId!,
      {},
      { pdf: { ...SEITE, felder: SEITE.felder.slice(0, 2) } },
    );
    expect(zweite.fehler).toBeInstanceOf(ApiError);
    expect(zweite.erledigt).not.toContain('antrag');
    expect(dateiHochgeladen()).toEqual([]);
    expect(inhalt()).toBe(vorher);
    expect(antragBilderLesen(inhalt())!.hintergrund).toBe(JPG);
  });

  it('ChurchTools liefert etwas, das kein Blatt von uns ist: abgebrochen, nichts hochgeladen', async () => {
    const erg = await angelegt();
    falsch.htmlUmgeformt = true;
    const zweite = await nochmal(
      erg.gruppeId!,
      {},
      { pdf: { ...SEITE, felder: SEITE.felder.slice(0, 2) } },
    );
    expect(zweite.fehler).toBeInstanceOf(ApiError);
    expect(dateiHochgeladen()).toEqual([]);
    expect(antragBilderLesen(inhalt())!.hintergrund).toBe(JPG);
  });

  it('eine andere PDF („neu“) braucht das alte HTML nicht und ersetzt das Seitenbild', async () => {
    const erg = await angelegt();
    const zweite = await nochmal(erg.gruppeId!, {
      antragBilder: { ...UNVERAENDERT, hintergrund: { art: 'neu', src: JPG2 } },
    });
    expect(zweite.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: JPG2,
    });
  });

  it('antragLaden liest das Seitenbild fürs Fenster; unlesbar → null, nie „kein Bild“', async () => {
    await angelegt();
    expect(await antragLaden(vorlage().id)).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: JPG,
    });
    falsch.htmlUmgeformt = true;
    expect(await antragLaden(vorlage().id)).toBeNull();
  });

  it('ohne Änderung wird nichts noch einmal hochgeladen', async () => {
    const erg = await angelegt();
    const zweite = await nochmal(erg.gruppeId!);
    expect(zweite.fehler).toBeNull();
    expect(dateiHochgeladen()).toEqual([]);
    expect(vorlagenAngelegt()).toEqual([]);
  });
});

describe('Nachlesen: jedes Bild muss so zurückkommen, wie es hochgeladen wurde', () => {
  it('ChurchTools liefert das Blatt ohne Seitenbild zurück: gemeldet, nicht „fertig“', async () => {
    falsch.htmlOhneBild = 'hintergrund';
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(erg.erledigt).not.toContain('antrag');
    expect(erg.befund).toBeNull();
  });

  it('ChurchTools liefert das Blatt ohne Unterschrift zurück: gemeldet', async () => {
    falsch.htmlOhneBild = 'unterschrift';
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(erg.erledigt).not.toContain('antrag');
  });
});

describe('Aufrufer ohne Angabe zum Seitenbild (wie vor N1d)', () => {
  it('„unverändert“ gilt auch für den Hintergrund: das Seitenbild bleibt, wie es in ChurchTools steht', async () => {
    const erg = await angelegt();
    const zweite = await nochmal(erg.gruppeId!, {
      antragBilder: { logo: { art: 'unveraendert' }, unterschrift: { art: 'unveraendert' } },
    });
    expect(zweite.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())!.hintergrund).toBe(JPG);
  });
});

describe('Wechsel zwischen Baukasten und PDF', () => {
  it('von PDF auf Baukasten: dieselbe Vorlage, Blatt ohne Hintergrund, die Unterschrift bleibt', async () => {
    const erg = await angelegt();
    const baukasten = await nochmal(
      erg.gruppeId!,
      {},
      { art: 'baukasten', pdf: undefined, logo: 'ohne' },
    );
    expect(baukasten.fehler).toBeNull();
    expect(vorlagenAngelegt()).toEqual([]);
    expect(inhalt()).not.toContain('data-art="pdf"');
    expect(antragBilderLesen(inhalt())).toEqual({
      logo: null,
      unterschrift: PNG,
      hintergrund: null,
    });
    expect(nachweisEinstellungenLesen(gruppeDerArt().note)!.antrag!.art).toBe('baukasten');
  });

  it('von Baukasten auf PDF: das Seitenbild kommt neu, dieselbe Vorlage', async () => {
    const erg = await angelegt();
    await nochmal(erg.gruppeId!, {}, { art: 'baukasten', pdf: undefined, logo: 'ohne' });
    const wieder = await nochmal(erg.gruppeId!, {
      antragBilder: { ...UNVERAENDERT, hintergrund: { art: 'neu', src: JPG } },
    });
    expect(wieder.fehler).toBeNull();
    expect(vorlagenAngelegt()).toEqual([]);
    expect(inhalt()).toContain('data-art="pdf"');
    expect(antragBilderLesen(inhalt())!.hintergrund).toBe(JPG);
  });
});

describe('(g) Vorlagenliste mit Pflicht-Filter domain_type', () => {
  it('die Nummer wurde nie festgehalten: die Vorlage wird über den Namen gefunden (Liste mit domain_type), keine zweite angelegt', async () => {
    falsch.mitArt();
    falsch.vorlagen.set(900, {
      id: 900,
      name: antragVorlagenName('Führungszeugnis'),
      domainType: 'groupmember-document',
      isGlobal: true,
      htmlFileId: null,
    });
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(vorlagenAngelegt()).toEqual([]);
    expect(erg.vorlageId).toBe(900);
    expect(ct.ctAlleSeiten.mock.calls.map((c) => c[0])).toContain(
      '/htmltemplates?domain_type=groupmember-document',
    );
    expect(inhalt(falsch.vorlagen.get(900))).toContain('data-art="pdf"');
  });
});
