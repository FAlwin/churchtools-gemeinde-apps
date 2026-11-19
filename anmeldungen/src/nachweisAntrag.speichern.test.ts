import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import {
  antragBilderLesen,
  antragVorgabe,
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
  htmlVorlagenRecht,
  nachweisArtSichern,
  nachweisArtenLesen,
  type AntragBilder,
  type NachweisEingabe,
} from './nachweisArten';
import * as Einrichten from './einrichten';
import { FalschesNachweisCt } from './nachweisArten.testutil';

/**
 * Der Antrag als Bescheinigung (N1c) gegen ein nachgestelltes ChurchTools (`FalschesNachweisCt`, gemessen 19.11.2026): Der
 * Anschluss `@ui/ct/verbindung` ist ersetzt, ebenso das Logo der Gemeinde. Soll-Werte stammen aus den Erzeugern.
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
const einrichten = vi.mocked(Einrichten);

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const GEMEINDE_LOGO = 'https://ecg.church.tools/images/558/logo.png';

let falsch: FalschesNachweisCt;

const ANTRAG: NachweisAntrag = { ...antragVorgabe('ECG Donrath'), vorlageId: null };
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
  antrag: ANTRAG,
};
const OHNE_BILDER: AntragBilder = { logo: { art: 'keins' }, unterschrift: { art: 'keins' } };
const MIT_UNTERSCHRIFT: AntragBilder = {
  logo: { art: 'keins' },
  unterschrift: { art: 'neu', src: JPG },
};
const EINGABE: NachweisEingabe = {
  gruppeId: null,
  name: 'Führungszeugnis',
  einstellungen: E,
  vertrauen: [7],
  antragBilder: OHNE_BILDER,
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
    // Ein Datei-Upload: der Inhalt der Datei (`files[]`) als Text.
    else if (o?.body instanceof FormData) {
      const datei = o.body.get('files[]') as File;
      json = { html: await datei.text(), name: datei.name };
    }
    return await falsch.schicken(pfad, o?.method ?? 'GET', json);
  });
  einrichten.gemeindeLogo.mockReset().mockResolvedValue(GEMEINDE_LOGO);
});

const reihe = () => falsch.aufrufe.map((a) => `${a.methode} ${a.pfad}`);
const gruppeDerArt = () => [...falsch.gruppen.values()].find((g) => g.name.startsWith('Nachweis'))!;
const vorlagenAngelegt = () =>
  falsch.aufrufe.filter((a) => a.methode === 'POST' && a.pfad === '/htmltemplates');
const dateiHochgeladen = () => falsch.schreibend('POST /files/html_template');
/** Die Rollen der Gruppe: Teilnehmer (Gruppenart-Rolle 53) und Leiter (56) – mit anderen Nummern IN der Gruppe. */
const teilnehmer = (gruppeId: number) =>
  falsch.rollenVon(gruppeId).find((r) => r.groupTypeRoleId === 53)!;
const leiter = (gruppeId: number) =>
  falsch.rollenVon(gruppeId).find((r) => r.groupTypeRoleId === 56)!;
const vorlage = () => [...falsch.vorlagen.values()][0];
const inhalt = (v = vorlage()) => falsch.dateien.get(v.htmlFileId!)!;

/** Eine fertig angelegte Art mit Antrag, wie nach dem ersten Speichern. */
async function angelegt(bilder: AntragBilder = MIT_UNTERSCHRIFT) {
  const erg = await nachweisArtSichern({ ...EINGABE, antragBilder: bilder }, ICH);
  expect(erg.fehler).toBeNull();
  falsch.aufrufe = [];
  return erg;
}
const nochmal = (
  gruppeId: number,
  mehr: Partial<NachweisEingabe> = {},
  antrag: Partial<NachweisAntrag> = {},
) =>
  nachweisArtSichern(
    {
      ...EINGABE,
      gruppeId,
      antragBilder: { logo: { art: 'unveraendert' }, unterschrift: { art: 'unveraendert' } },
      ...mehr,
      einstellungen: { ...E, ...mehr.einstellungen, antrag: { ...ANTRAG, ...antrag } },
    },
    ICH,
  );

describe('Neue Nachweis-Art mit Antrag', () => {
  it('legt Vorlage, Inhalt und Rolle an – in dieser Reihenfolge – und liest alles nach', async () => {
    const erg = await nachweisArtSichern({ ...EINGABE, antragBilder: MIT_UNTERSCHRIFT }, ICH);
    expect(erg.fehler).toBeNull();
    expect(erg.erledigt).toEqual([...NACHWEIS_SCHRITTE]);
    const g = gruppeDerArt();
    const v = vorlage();

    // Vorlage: globale Bescheinigung mit eindeutigem Namen
    expect(v).toMatchObject({
      name: antragVorlagenName('Führungszeugnis'),
      domainType: 'groupmember-document',
      isGlobal: true,
    });
    expect(v.name).toBe('Antrag: Nachweis: Führungszeugnis');
    expect(erg.vorlageId).toBe(v.id);

    // Reihenfolge: Ablauf der Gruppe, Vorlage, Nummer sofort im Block, Datei, htmlFileId, Rolle
    const r = reihe();
    const nach = (muster: string) => r.findIndex((x) => x.includes(muster));
    expect(nach('PATCH /routines')).toBeLessThan(nach('POST /htmltemplates'));
    expect(nach('POST /htmltemplates')).toBeLessThan(nach('POST /files/html_template'));
    expect(nach('POST /files/html_template')).toBeLessThan(nach(`PATCH /htmltemplates/${v.id}`));
    expect(nach(`PATCH /htmltemplates/${v.id}`)).toBeLessThan(nach(`PATCH /groups/${g.id}/roles`));
    // die Nummer steht im Block, bevor die Datei hochgeladen wird
    const blockMitNummer = r.findIndex(
      (x, i) =>
        x === `PATCH /groups/${g.id}` &&
        i > nach('POST /htmltemplates') &&
        i < nach('POST /files/html_template'),
    );
    expect(blockMitNummer).toBeGreaterThan(-1);

    // Inhalt: ChurchTools-Platzhalter, Unterschrift eingebettet und lesbar
    expect(inhalt()).toContain('{{person.firstName}}');
    expect(antragBilderLesen(inhalt())).toEqual({ logo: GEMEINDE_LOGO, unterschrift: JPG });
    expect(v.htmlFileId).not.toBeNull();

    // Block: Texte und Nummer der Vorlage – keine Bilder
    const block = nachweisEinstellungenLesen(g.note)!;
    expect(block.antrag).toEqual({ ...ANTRAG, vorlageId: v.id });
    expect(g.note).not.toContain('data:image');

    // Nachgelesen
    expect(erg.befund?.antrag).toEqual({ vorlageId: v.id, haengt: true });
  });

  it('(f) hängt an die Rolle IN DER GRUPPE, nicht an die der Gruppenart', async () => {
    await nachweisArtSichern(EINGABE, ICH);
    const g = gruppeDerArt();
    const v = vorlage();
    expect(teilnehmer(g.id).id).not.toBe(53);
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([v.id]);
    expect(leiter(g.id).htmlTemplateIds).toEqual([]);
    const patch = falsch.schreibend('/roles/');
    expect(patch.map((a) => a.pfad)).toEqual([`/groups/${g.id}/roles/${teilnehmer(g.id).id}`]);
    expect(patch[0].json).toEqual({ htmlTemplateIds: [v.id] });
  });

  it('keine Bilder aus der Gruppe: nichts wird als Gruppenbild abgelegt', async () => {
    await nachweisArtSichern({ ...EINGABE, antragBilder: MIT_UNTERSCHRIFT }, ICH);
    expect(falsch.aufrufe.some((a) => a.pfad.includes('groupimage'))).toBe(false);
    expect(
      falsch.aufrufe.some((a) => a.pfad.startsWith('/files/') && !a.pfad.includes('html_template')),
    ).toBe(false);
  });

  it('Logo „der Gemeinde“: die Adresse aus ChurchTools; „eigen“: das hochgeladene; „ohne“: keins', async () => {
    const lesen = async (logo: NachweisAntrag['logo'], bilder: AntragBilder) => {
      falsch = new FalschesNachweisCt();
      await nachweisArtSichern(
        {
          ...EINGABE,
          einstellungen: { ...E, antrag: { ...ANTRAG, logo } },
          antragBilder: bilder,
        },
        ICH,
      );
      return antragBilderLesen(inhalt())!.logo;
    };
    expect(await lesen('gemeinde', OHNE_BILDER)).toBe(GEMEINDE_LOGO);
    expect(await lesen('eigen', { ...OHNE_BILDER, logo: { art: 'neu', src: PNG } })).toBe(PNG);
    expect(await lesen('ohne', { ...OHNE_BILDER, logo: { art: 'neu', src: PNG } })).toBeNull();
  });

  it('das Logo der Gemeinde lässt sich nicht lesen (Fehler): der Schritt scheitert, die Vorlage bekommt kein Blatt ohne Logo', async () => {
    einrichten.gemeindeLogo.mockRejectedValue(new ApiError(503, 'weg'));
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(erg.erledigt).not.toContain('antrag');
    expect(dateiHochgeladen()).toEqual([]);
  });

  it('eine Art ohne Antrag (wie aus N1b) rührt keine Vorlage an', async () => {
    const erg = await nachweisArtSichern(
      { ...EINGABE, einstellungen: { ...E, antrag: undefined } },
      ICH,
    );
    expect(erg.fehler).toBeNull();
    expect(erg.erledigt).toEqual([...NACHWEIS_SCHRITTE]);
    expect(reihe().some((x) => x.includes('htmltemplates') || x.includes('html_template'))).toBe(
      false,
    );
    expect(reihe().some((x) => x.includes('/roles/'))).toBe(false);
    expect(erg.befund?.antrag).toBeNull();
  });
});

describe('(c) fremde Bescheinigungen an der Rolle bleiben', () => {
  it('hängt die eigene schon dran, wird an der Rolle nichts mehr geschrieben', async () => {
    const erg = await angelegt();
    const g = gruppeDerArt();
    teilnehmer(g.id).htmlTemplateIds = [5, 6, vorlage().id];
    const zweite = await nochmal(erg.gruppeId!, {}, { text: 'Hallo [Vorname]' });
    expect(zweite.fehler).toBeNull();
    expect(falsch.schreibend('/roles/')).toEqual([]);
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([5, 6, vorlage().id]);
  });

  it('eine fremde Vorlage vor der eigenen bleibt, auch wenn die eigene neu dazukommt', async () => {
    await nachweisArtSichern(EINGABE, ICH);
    const g = gruppeDerArt();
    // jemand hängt in ChurchTools eine fremde dazu, die eigene fliegt raus (z. B. von Hand abgehängt)
    teilnehmer(g.id).htmlTemplateIds = [5, 6];
    await nochmal(g.id);
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([5, 6, vorlage().id]);
  });

  it('beim Abhängen („Mit Antrag“ aus) bleiben die fremden', async () => {
    const erg = await angelegt();
    const g = gruppeDerArt();
    teilnehmer(g.id).htmlTemplateIds = [5, vorlage().id, 6];
    const aus = await nochmal(erg.gruppeId!, {}, { an: false });
    expect(aus.fehler).toBeNull();
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([5, 6]);
  });

  it('ChurchTools übernimmt das Anhängen nicht (200, nichts geändert): NichtUebernommen', async () => {
    falsch.ignoriere = ['/roles/'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(erg.erledigt).toContain('ablauf');
    expect(erg.erledigt).not.toContain('antrag');
  });
});

describe('(d) „Nochmal“ legt keine zweite Vorlage an', () => {
  it('scheitert das Anhängen: Nochmal mit der gemerkten Nummer', async () => {
    falsch.scheitert = [{ muster: '/roles/', status: 503 }];
    const erste = await nachweisArtSichern(EINGABE, ICH);
    expect(erste.fehler).toBeInstanceOf(ApiError);
    expect(erste.erledigt).not.toContain('antrag');
    expect(erste.erledigt).toContain('ablauf');
    expect(erste.vorlageId).not.toBeNull();
    falsch.scheitert = [];

    const zweite = await nochmal(erste.gruppeId!, {}, { vorlageId: erste.vorlageId });
    expect(zweite.fehler).toBeNull();
    expect(vorlagenAngelegt()).toHaveLength(1);
    expect(falsch.vorlagen.size).toBe(1);
    expect(teilnehmer(erste.gruppeId!).htmlTemplateIds).toEqual([erste.vorlageId]);
  });

  it('auch ohne dass das Fenster die Nummer gemerkt hat: sie steht im Block der Gruppe (nicht nur über den Namen)', async () => {
    // Ohne Liste der Vorlagen kann nur die Nummer im Block helfen.
    falsch.ohneVorlagenListe = true;
    falsch.scheitert = [{ muster: '/roles/', status: 503 }];
    const erste = await nachweisArtSichern(EINGABE, ICH);
    falsch.scheitert = [];
    const zweite = await nochmal(erste.gruppeId!, {}, { vorlageId: null });
    expect(zweite.fehler).toBeNull();
    expect(vorlagenAngelegt()).toHaveLength(1);
    expect(zweite.vorlageId).toBe(erste.vorlageId);
  });

  it('die Nummer wurde nie festgehalten, die Vorlage gibt es aber: sie wird über den Namen übernommen', async () => {
    falsch.mitArt();
    const alt = falsch.vorlagen.set(900, {
      id: 900,
      name: antragVorlagenName('Führungszeugnis'),
      domainType: 'groupmember-document',
      isGlobal: true,
      htmlFileId: null,
    });
    expect(alt.size).toBe(1);
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(vorlagenAngelegt()).toEqual([]);
    expect(erg.vorlageId).toBe(900);
    expect(inhalt(falsch.vorlagen.get(900))).toContain('data-nachweis="blatt"');
  });

  it('zwei Vorlagen gleichen Namens: nicht raten, nichts anlegen', async () => {
    falsch.mitArt();
    for (const id of [900, 901])
      falsch.vorlagen.set(id, {
        id,
        name: antragVorlagenName('Führungszeugnis'),
        domainType: 'groupmember-document',
        isGlobal: true,
        htmlFileId: null,
      });
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect((erg.fehler as ApiError).status).toBe(409);
    expect(vorlagenAngelegt()).toEqual([]);
  });

  it('ChurchTools hat keine Liste der Vorlagen (404): es wird angelegt, die Nummer wird gemerkt', async () => {
    falsch.ohneVorlagenListe = true;
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(vorlagenAngelegt()).toHaveLength(1);
  });

  it('die Liste scheitert vorübergehend (503): nichts wird blind angelegt', async () => {
    falsch.mitArt();
    falsch.scheitert = [];
    ct.ctAlleSeiten.mockImplementation((pfad: string) =>
      pfad.startsWith('/htmltemplates')
        ? Promise.reject(new ApiError(503, 'weg'))
        : falsch.alleSeiten(pfad),
    );
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(vorlagenAngelegt()).toEqual([]);
  });

  it('die Vorlage zur gemerkten Nummer ist in ChurchTools weg (404): es gibt eine neue, Nummer im Block', async () => {
    const erg = await angelegt(OHNE_BILDER);
    falsch.vorlagen.clear();
    teilnehmer(gruppeDerArt().id).htmlTemplateIds = [];
    const zweite = await nochmal(erg.gruppeId!);
    expect(zweite.fehler).toBeNull();
    expect(vorlagenAngelegt()).toHaveLength(1);
    expect(nachweisEinstellungenLesen(gruppeDerArt().note)!.antrag!.vorlageId).toBe(
      zweite.vorlageId,
    );
  });
});

describe('(e) Bilder gehen nicht verloren', () => {
  it('„unverändert“: Logo und Unterschrift stammen aus dem HTML, das in ChurchTools steht', async () => {
    const erg = await angelegt({ logo: { art: 'keins' }, unterschrift: { art: 'neu', src: JPG } });
    const zweite = await nochmal(erg.gruppeId!, {}, { text: 'Hallo [Vorname], ein anderer Text.' });
    expect(zweite.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())!.unterschrift).toBe(JPG);
    expect(inhalt()).toContain('ein anderer Text');
  });

  it('das HTML lässt sich nicht lesen (503): nichts wird hochgeladen, die Unterschrift bleibt in ChurchTools', async () => {
    const erg = await angelegt();
    const vorher = inhalt();
    falsch.scheitert = [{ muster: '/html', status: 503 }];
    const zweite = await nochmal(erg.gruppeId!, {}, { text: 'Hallo [Vorname], neu.' });
    expect(zweite.fehler).toBeInstanceOf(ApiError);
    expect(zweite.erledigt).not.toContain('antrag');
    expect(dateiHochgeladen()).toEqual([]);
    expect(inhalt()).toBe(vorher);
    expect(antragBilderLesen(inhalt())!.unterschrift).toBe(JPG);
  });

  it('ChurchTools liefert etwas, das kein Blatt von uns ist: abgebrochen, nichts hochgeladen', async () => {
    const erg = await angelegt();
    falsch.htmlUmgeformt = true;
    const zweite = await nochmal(erg.gruppeId!, {}, { text: 'Hallo [Vorname], neu.' });
    expect(zweite.fehler).toBeInstanceOf(ApiError);
    expect(dateiHochgeladen()).toEqual([]);
    expect(antragBilderLesen(inhalt())!.unterschrift).toBe(JPG);
  });

  it('wer die Unterschrift ausdrücklich ersetzt oder entfernt, braucht das alte HTML nicht', async () => {
    const erg = await angelegt();
    falsch.scheitert = [{ muster: '/html', status: 503 }];
    // neu gewählt: schreibt, soweit das Nachlesen möglich ist – hier scheitert nur das Nachlesen des Inhalts
    const neu = await nochmal(erg.gruppeId!, {
      antragBilder: { logo: { art: 'keins' }, unterschrift: { art: 'neu', src: PNG } },
    });
    // das Hochladen ging, das Nachlesen (503) nicht: gemeldet, nicht „fertig“
    expect(neu.fehler).toBeInstanceOf(ApiError);
    expect(dateiHochgeladen()).toHaveLength(1);
    falsch.scheitert = [];
    const entfernt = await nochmal(erg.gruppeId!, {
      antragBilder: { logo: { art: 'keins' }, unterschrift: { art: 'keins' } },
    });
    expect(entfernt.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())!.unterschrift).toBeNull();
  });

  it('die Vorlage hat noch keinen Inhalt (frisch angelegt): „unverändert“ heißt dann „keins“, nichts bricht ab', async () => {
    falsch.scheitert = [{ muster: 'POST /files/html_template', status: 503 }];
    const erste = await nachweisArtSichern(EINGABE, ICH);
    expect(erste.fehler).toBeInstanceOf(ApiError);
    falsch.scheitert = [];
    const zweite = await nochmal(erste.gruppeId!, {}, { vorlageId: erste.vorlageId });
    expect(zweite.fehler).toBeNull();
    expect(antragBilderLesen(inhalt())).toEqual({ logo: GEMEINDE_LOGO, unterschrift: null });
  });

  it('ohne Änderung wird nichts noch einmal hochgeladen', async () => {
    const erg = await angelegt();
    const zweite = await nochmal(erg.gruppeId!);
    expect(zweite.fehler).toBeNull();
    expect(dateiHochgeladen()).toEqual([]);
    expect(vorlagenAngelegt()).toEqual([]);
  });

  it('antragLaden: lesbar → die Bilder; nicht lesbar (Fehler, kein Blatt) → null, nie „keine Bilder“', async () => {
    const erg = await angelegt();
    expect(await antragLaden(vorlage().id)).toEqual({ logo: GEMEINDE_LOGO, unterschrift: JPG });
    falsch.htmlUmgeformt = true;
    expect(await antragLaden(vorlage().id)).toBeNull();
    falsch.htmlUmgeformt = false;
    falsch.scheitert = [{ muster: '/html', status: 503 }];
    expect(await antragLaden(vorlage().id)).toBeNull();
    expect(erg.gruppeId).not.toBeNull();
  });
});

describe('„Mit Antrag“ aus', () => {
  it('hängt die Vorlage von der Rolle ab – löscht nichts; die Nummer bleibt im Block', async () => {
    const erg = await angelegt();
    const g = gruppeDerArt();
    const v = vorlage();
    const aus = await nochmal(erg.gruppeId!, {}, { an: false });
    expect(aus.fehler).toBeNull();
    expect(aus.erledigt).toEqual([...NACHWEIS_SCHRITTE]);
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([]);
    expect(falsch.vorlagen.has(v.id)).toBe(true);
    expect(falsch.aufrufe.some((a) => a.methode === 'DELETE')).toBe(false);
    expect(dateiHochgeladen()).toEqual([]);
    expect(nachweisEinstellungenLesen(g.note)!.antrag).toMatchObject({
      an: false,
      vorlageId: v.id,
    });
    expect(aus.befund?.antrag).toBeNull();
  });

  it('wieder eingeschaltet: dieselbe Vorlage, keine zweite; die Bilder sind noch da', async () => {
    const erg = await angelegt();
    const g = gruppeDerArt();
    await nochmal(erg.gruppeId!, {}, { an: false });
    const an = await nochmal(erg.gruppeId!);
    expect(an.fehler).toBeNull();
    expect(vorlagenAngelegt()).toEqual([]);
    expect(teilnehmer(g.id).htmlTemplateIds).toEqual([vorlage().id]);
    expect(antragBilderLesen(inhalt())!.unterschrift).toBe(JPG);
  });

  it('von Anfang an ohne Antrag und ohne Vorlage: schreibt nichts an Vorlagen', async () => {
    const erg = await nachweisArtSichern(
      { ...EINGABE, einstellungen: { ...E, antrag: { ...ANTRAG, an: false } } },
      ICH,
    );
    expect(erg.fehler).toBeNull();
    expect(reihe().some((x) => x.includes('htmltemplates') || x.includes('/roles/'))).toBe(false);
    // zum Rechtsprüfen braucht es dann auch kein Recht
  });
});

describe('(h) Recht „Gemeinde-HTML-Vorlagen verwalten“', () => {
  it('fehlt es (ausdrücklich falsch): verständliche Meldung, bevor irgendetwas geschrieben wird', async () => {
    falsch.global = {
      churchcore: { 'administer persons': true, 'administer church html templates': false },
    };
    await expect(nachweisArtSichern(EINGABE, ICH)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('Gemeinde-HTML-Vorlagen verwalten'),
    });
    expect(falsch.aufrufe).toEqual([]);
    expect(falsch.gruppen.size).toBe(0);
  });

  it('mit „Mit Antrag“ aus braucht es das Recht nicht', async () => {
    falsch.global = {
      churchcore: { 'administer persons': true, 'administer church html templates': false },
    };
    const erg = await nachweisArtSichern(
      { ...EINGABE, einstellungen: { ...E, antrag: { ...ANTRAG, an: false } } },
      ICH,
    );
    expect(erg.fehler).toBeNull();
  });

  it('das Recht steht in der Antwort, ChurchTools sagt trotzdem 403: die Meldung steht im Ergebnis', async () => {
    falsch.keinVorlagenRecht = true;
    ct.ctAnfrage.mockImplementation(async (pfad: string, opt?: unknown) => {
      const o = opt as { method?: string; body?: string | FormData; verweigert?: string };
      try {
        return await falsch.schicken(
          pfad,
          o?.method ?? 'GET',
          typeof o?.body === 'string' ? JSON.parse(o.body) : undefined,
        );
      } catch (e) {
        // so übersetzt `fehlerAus` ein 403 mit der Meldung, die der Aufrufer mitgibt
        if (e instanceof ApiError && e.status === 403 && o.verweigert)
          throw new ApiError(403, o.verweigert);
        throw e;
      }
    });
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect((erg.fehler as ApiError).message).toContain('Gemeinde-HTML-Vorlagen verwalten');
    expect(erg.erledigt).toContain('ablauf');
    expect(erg.erledigt).not.toContain('antrag');
    expect(falsch.vorlagen.size).toBe(0);
  });

  it('htmlVorlagenRecht: fehlt der Schlüssel, fehlt das Recht; ohne Block churchcore ist es nicht zu entscheiden', () => {
    expect(htmlVorlagenRecht({ churchcore: { 'administer church html templates': true } })).toBe(
      true,
    );
    expect(htmlVorlagenRecht({ churchcore: { 'administer church html templates': false } })).toBe(
      false,
    );
    expect(htmlVorlagenRecht({ churchcore: { 'administer persons': true } })).toBe(false);
    expect(htmlVorlagenRecht({})).toBeNull();
    expect(htmlVorlagenRecht(null)).toBeNull();
  });
});

describe('ChurchTools meldet Erfolg, übernimmt aber nichts', () => {
  it('die Vorlage wird nicht angelegt (201, keine Vorlage): NichtUebernommen, die Nummer wird nicht gemerkt', async () => {
    falsch.ignoriere = ['POST /htmltemplates'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(erg.erledigt).not.toContain('antrag');
    expect(dateiHochgeladen()).toEqual([]);
  });

  it('die Datei wird nicht übernommen: NichtUebernommen', async () => {
    falsch.ignoriere = ['POST /files/html_template'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(erg.erledigt).not.toContain('antrag');
  });

  it('der Inhalt wird nicht gesetzt (htmlFileId bleibt leer): NichtUebernommen', async () => {
    falsch.ignoriere = ['PATCH /htmltemplates/'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(teilnehmerOhneFehler()).toBe(true);
  });

  /** Nach einem gescheiterten Inhalt hängt die Vorlage nicht an der Rolle. */
  function teilnehmerOhneFehler() {
    return teilnehmer(gruppeDerArt().id).htmlTemplateIds.length === 0;
  }
});

describe('Lesen', () => {
  it('die Seite sieht, ob eine Art einen Antrag hat', async () => {
    await nachweisArtSichern(EINGABE, ICH);
    await nachweisArtSichern(
      {
        ...EINGABE,
        name: 'JuLeiCa',
        einstellungen: { ...E, antrag: undefined },
      },
      ICH,
    );
    const arten = await nachweisArtenLesen(11);
    expect(arten.map((a) => [a.name, a.einstellungen?.antrag?.an ?? false])).toEqual([
      ['Führungszeugnis', true],
      ['JuLeiCa', false],
    ]);
  });
});
