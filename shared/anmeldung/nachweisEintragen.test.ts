import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FalschesCt } from '../ct/gruppenart.testutil';
import { einstellungenAlsText, type OeffentlicheEinstellungen } from './formular';
import { anmeldungenAus, mitgliederstandAus, type MitgliedRoh } from './liste';
import { FELDER, e as einst, mitglieder } from './liste.testdaten';
import { mitNachweisBedarf, type NachweisBedarf } from './nachweisBedarf';
import { NACHWEIS_STAND_KATEGORIE, nachweisNotiz } from './nachweise';
import { artAngabenAus, artAngabenWert } from './nachweisStandAblage';
import {
  EINTRAGEN_PAUSE_MS,
  eintragPlan,
  nachweiseEintragen,
  siehtAnmeldungen,
  type EintragFehler,
  type EintragKontext,
  type EintragPort,
} from './nachweisEintragen';

/**
 * **Eintragen beim Öffnen** (N3c) gegen ein nachgestelltes ChurchTools: Nachweis-Gruppen (Art 61, 62), Veranstaltungen
 * (500, 501) mit Anmeldungen, wie das Formular sie schreibt (`liste.testdaten.ts`), der Datenspeicher aus `FalschesCt`.
 *
 * Anmeldungen der Veranstaltung 500:
 *  - AAAAAA: Jonas (10, Fotos Ja) und Lena (11, Fotos Nein), beide mit Platz,
 *  - BBBBBB: Jonas (20, Ja) mit Platz, Lena (21, Nein) **wartet**,
 *  - dazu die Leitung (Person 90, Rolle 35).
 * „Alle“ braucht also 10, 11, 20 – nie 21 (wartet) und nie 90 (Leitung); „Nur wenn Fotos = Ja“ nur 10 und 20.
 */
const ICH = 368;
const LEITER = 56;
const TEILNEHMER = 53;
const NACHWEIS_TYP = 11;
const ANMELDUNG_TYP = 5;
const FZ = 61;
const JU = 62;
const V1 = 500;
const V2 = 501;
const HEUTE = '2026-11-01';
const FOTO = 'frage:foto';

const ART_EINST = {
  gueltigJahre: 5,
  ab: 'ausstellung',
  betreff: 'Bitte',
  text: 'Hallo [Vorname]',
} as const;

const anmeldungenRoh = (): MitgliedRoh[] => [
  ...mitglieder('AAAAAA', [true, true], 10),
  ...mitglieder('BBBBBB', [true, false], 20),
  { personId: 90, groupTypeRoleId: 35, groupMemberStatus: 'active', fields: [] },
];

const mit = (...b: NachweisBedarf[]): OeffentlicheEinstellungen => {
  let x = einst();
  // Ein Termin, wie er gespeichert werden darf (die Testdaten tragen keinen Ort und keine Termin-Nummer).
  x.termin = { ...x.termin, ende: '2026-11-22T12:00', ort: 'Testhaus', terminId: null } as never;
  for (const y of b) x = mitNachweisBedarf(x, y.artGruppeId, y);
  return x;
};
const alle = (art: number): NachweisBedarf => ({ artGruppeId: art, fuer: 'alle' });
const nurFotoJa = (art: number): NachweisBedarf => ({
  artGruppeId: art,
  fuer: 'nurWenn',
  feld: FOTO,
  antworten: ['Ja'],
});

/** Ein Fehler, den die Attrappe wirft – `fehlerArt` liest `art`. */
const fehler = (art: EintragFehler) => Object.assign(new Error(art), { art });

class FalschesEintragCt {
  ct = new FalschesCt();
  arten = new Map<number, { name: string; note: string | null }>([
    [FZ, { name: 'Nachweis: Führungszeugnis', note: nachweisNotiz({ ...ART_EINST }) }],
    [JU, { name: 'Nachweis: JuLeiCa', note: nachweisNotiz({ ...ART_EINST }) }],
  ]);
  mitglieder = new Map<
    number,
    { personId: number; groupTypeRoleId: number; groupMemberStatus: string }[]
  >([
    [FZ, [{ personId: ICH, groupTypeRoleId: LEITER, groupMemberStatus: 'active' }]],
    [JU, [{ personId: 1, groupTypeRoleId: LEITER, groupMemberStatus: 'active' }]],
  ]);
  veranstaltungen = new Map<number, { e: OeffentlicheEinstellungen; roh: MitgliedRoh[] }>();
  global: unknown = { churchdb: { 'view groups of grouptype': [ANMELDUNG_TYP] } };
  /** Eintragen scheitert für diese Person mit diesem Fehler (einmal oder immer). */
  scheitert = new Map<number, EintragFehler>();
  /** Eintragen meldet Erfolg, übernimmt aber nichts. */
  schluckt = new Set<number>();
  /** Mitglieder dieser Art sind nicht lesbar (403). */
  verborgen = new Set<number>();
  angelegt: { gruppe: number; person: number; rolle: number }[] = [];
  gelesen: string[] = [];
  warten: number[] = [];

  constructor() {
    this.ct.kategorien = [
      { id: 124, shorty: NACHWEIS_STAND_KATEGORIE.kuerzel, name: 'Nachweis-Stand' },
    ];
  }

  port(warte?: (ms: number) => Promise<void>): EintragPort {
    return {
      alleSeiten: async <T>(pfad: string): Promise<T[]> => {
        this.gelesen.push(pfad);
        await Promise.resolve();
        if (pfad === `/groups?group_type_ids[]=${NACHWEIS_TYP}&group_status_ids[]=1`)
          return [...this.arten].map(([id, a]) => ({
            id,
            name: a.name,
            information: { note: a.note, groupStatusId: 1 },
          })) as T[];
        if (pfad === `/groups?group_type_ids[]=${ANMELDUNG_TYP}&group_status_ids[]=1`)
          return [...this.veranstaltungen].map(([id, v]) => ({
            id,
            information: { note: einstellungenAlsText(v.e), groupStatusId: 1 },
          })) as T[];
        const m = /^\/groups\/(\d+)\/members$/.exec(pfad);
        if (m) {
          const id = Number(m[1]);
          if (this.verborgen.has(id)) throw fehler('keinRecht');
          if (this.arten.has(id)) return structuredClone(this.mitglieder.get(id) ?? []) as T[];
          return structuredClone(this.veranstaltungen.get(id)?.roh ?? []) as T[];
        }
        throw new Error(`unbekannt: ${pfad}`);
      },
      holen: async <T>(pfad: string): Promise<T> => {
        this.gelesen.push(pfad);
        await Promise.resolve();
        if (pfad === '/permissions/global') return this.global as T;
        if (/^\/groups\/\d+\/memberfields$/.test(pfad))
          return [...FELDER.values()].map((field) => ({ type: 'group', field })) as T;
        throw new Error(`unbekannt: ${pfad}`);
      },
      anlegen: async (gruppe, person, rolle) => {
        await Promise.resolve();
        this.angelegt.push({ gruppe, person, rolle });
        const f = this.scheitert.get(person);
        if (f) throw fehler(f);
        if (this.schluckt.has(person)) return;
        const l = this.mitglieder.get(gruppe) ?? [];
        l.push({ personId: person, groupTypeRoleId: rolle, groupMemberStatus: 'active' });
        this.mitglieder.set(gruppe, l);
      },
      fehlerArt: (e) => (e as { art?: EintragFehler }).art ?? 'voruebergehend',
      warte:
        warte ??
        (async (ms) => {
          this.warten.push(ms);
        }),
      modul: this.ct.modulPort,
      modulId: async () => 13,
    };
  }

  angaben() {
    return artAngabenAus(this.ct.werte);
  }
  personenIn(art: number) {
    return (this.mitglieder.get(art) ?? []).map((m) => m.personId).sort((a, b) => a - b);
  }
}

let ct: FalschesEintragCt;
beforeEach(() => {
  ct = new FalschesEintragCt();
});
afterEach(() => {
  vi.useRealTimers();
});

const kontext = (x: Partial<EintragKontext> = {}): EintragKontext => ({
  ich: ICH,
  admin: false,
  heute: HEUTE,
  nachweisTyp: NACHWEIS_TYP,
  leiterRolle: LEITER,
  teilnehmerRolle: TEILNEHMER,
  anmeldungTyp: ANMELDUNG_TYP,
  leitung: new Set([35]),
  verweigert: 'kein Recht',
  ...x,
});
const lauf = (x: Partial<EintragKontext> = {}) => nachweiseEintragen(ct.port(), kontext(x));
const eingetragen = () => ct.angelegt.map((a) => `${a.gruppe}:${a.person}`);

// ── Die Regel ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('eintragPlan – wer zählt (E21, E30)', () => {
  const liste = (x: OeffentlicheEinstellungen) =>
    anmeldungenAus(
      x,
      mitgliederstandAus(anmeldungenRoh(), [], FELDER, new Set([35]), new Map()),
      HEUTE,
    );
  const leer = new Set<number>();

  it('„Alle“: aktive Teilnehmer – nie Wartende, nie die Leitung', () => {
    const x = mit(alle(FZ));
    expect(eintragPlan(x, FZ, liste(x), false, leer, leer)).toEqual({
      neu: [10, 11, 20],
      erledigt: [],
    });
  });

  it('schon in der Gruppe: nicht neu, aber erledigt; auf dem Merkzettel: weder noch', () => {
    const x = mit(alle(FZ));
    expect(eintragPlan(x, FZ, liste(x), false, new Set([11]), new Set([20]))).toEqual({
      neu: [10],
      erledigt: [11],
    });
  });

  it('„Nur wenn“: als Vertrauensperson niemand (Antworten nicht lesbar, M11), als Admin nur die passenden', () => {
    const x = mit(nurFotoJa(FZ));
    expect(eintragPlan(x, FZ, liste(x), false, leer, leer)).toEqual({ neu: [], erledigt: [] });
    expect(eintragPlan(x, FZ, liste(x), true, leer, leer)).toEqual({ neu: [10, 20], erledigt: [] });
  });

  it('kaputte Bedingung (Frage gibt es nicht): niemand (E29)', () => {
    const x = mit({
      artGruppeId: FZ,
      fuer: 'nurWenn',
      feld: 'frage:gibtsnicht',
      antworten: ['Ja'],
    });
    expect(eintragPlan(x, FZ, liste(x), true, leer, leer).neu).toEqual([]);
  });

  it('Art nicht eingeschaltet: niemand', () => {
    const x = mit(alle(JU));
    expect(eintragPlan(x, FZ, liste(x), true, leer, leer).neu).toEqual([]);
  });
});

describe('siehtAnmeldungen – leere Liste ist kein „niemand“ (M11)', () => {
  it('„Gruppen eines Gruppentyps sehen“ mit „Anmeldung“ oder „Alle“, oder Gruppen-Admin', () => {
    expect(siehtAnmeldungen({ churchdb: { 'view groups of grouptype': [5] } }, 5)).toBe(true);
    expect(siehtAnmeldungen({ churchdb: { 'view groups of grouptype': ['5'] } }, 5)).toBe(true);
    expect(siehtAnmeldungen({ churchdb: { 'view groups of grouptype': [-1] } }, 5)).toBe(true);
    expect(siehtAnmeldungen({ churchdb: { 'administer groups': true } }, 5)).toBe(true);
  });
  it('andere Gruppenart, leer, fehlt, unbekannte Gestalt: nein', () => {
    expect(siehtAnmeldungen({ churchdb: { 'view groups of grouptype': [3] } }, 5)).toBe(false);
    expect(siehtAnmeldungen({ churchdb: { 'view groups of grouptype': [] } }, 5)).toBe(false);
    expect(siehtAnmeldungen({ churchdb: {} }, 5)).toBe(false);
    expect(siehtAnmeldungen(null, 5)).toBe(false);
  });
});

// ── Der Lauf ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('nachweiseEintragen – Vertrauensperson', () => {
  it('„Alle“: trägt die aktiven Teilnehmer ein (Teilnehmer-Rolle), Merkzettel und Name stehen danach', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    const r = await lauf();
    expect(eingetragen()).toEqual(['61:10', '61:11', '61:20']);
    expect(ct.angelegt.every((a) => a.rolle === TEILNEHMER)).toBe(true);
    expect(r.neu).toEqual(new Map([[FZ, [10, 11, 20]]]));
    expect(r.abbruch).toBeNull();
    expect(r.arten.map((a) => a.id)).toEqual([FZ]);
    const a = ct.angaben().get(FZ)!;
    expect(a.name).toBe('Führungszeugnis');
    expect(a.eingetragen).toEqual(new Map([[V1, [10, 11, 20]]]));
    // Nur die eigene Art: JuLeiCa leitet jemand anderes – kein Name, kein Eintrag.
    expect(ct.angaben().has(JU)).toBe(false);
  });

  it('zweiter Lauf: niemand doppelt, nichts geschrieben', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    await lauf();
    ct.angelegt = [];
    const vorher = ct.ct.aufrufe.length;
    const r = await lauf();
    expect(eingetragen()).toEqual([]);
    expect(r.neu.size).toBe(0);
    expect(ct.ct.aufrufe.length).toBe(vorher);
  });

  it('„Nur wenn …“: übersprungen – nicht einmal die Mitglieder der Veranstaltung werden gelesen', async () => {
    ct.veranstaltungen.set(V1, { e: mit(nurFotoJa(FZ)), roh: anmeldungenRoh() });
    const r = await lauf();
    expect(eingetragen()).toEqual([]);
    expect(ct.gelesen).not.toContain(`/groups/${V1}/members`);
    expect(r.abbruch).toBeNull();
    expect(ct.angaben().get(FZ)?.name).toBe('Führungszeugnis');
  });

  it('wer schon in der Nachweis-Gruppe steht (jede Rolle): nicht eingetragen, aber gemerkt', async () => {
    ct.mitglieder
      .get(FZ)!
      .push({ personId: 11, groupTypeRoleId: TEILNEHMER, groupMemberStatus: 'requested' });
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    await lauf();
    expect(eingetragen()).toEqual(['61:10', '61:20']);
    expect(ct.angaben().get(FZ)!.eingetragen.get(V1)).toEqual([10, 11, 20]);
  });

  it('vorbei (Ende vor heute): nichts', async () => {
    const x = mit(alle(FZ));
    x.termin = { ...x.termin!, beginn: '2026-10-01T10:00', ende: '2026-10-02T12:00' };
    ct.veranstaltungen.set(V1, { e: x, roh: anmeldungenRoh() });
    await lauf();
    expect(eingetragen()).toEqual([]);
  });

  it('nicht Vertrauensperson und nicht Admin: keine Art, nichts gelesen außer den Arten, nichts geschrieben', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    const r = await lauf({ ich: 4711 });
    expect(r.arten).toEqual([]);
    expect(eingetragen()).toEqual([]);
    expect(ct.ct.aufrufe).toEqual([]);
    expect(ct.gelesen).not.toContain('/permissions/global');
  });

  it('Mitglieder einer fremden Art nicht lesbar (403): die Art gehört nicht dazu, der Lauf geht weiter', async () => {
    ct.verborgen.add(JU);
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    const r = await lauf();
    expect(r.arten.map((a) => a.id)).toEqual([FZ]);
    expect(eingetragen()).toEqual(['61:10', '61:11', '61:20']);
  });

  it('ohne „Gruppen eines Gruppentyps sehen“: nichts eingetragen, keine Veranstaltung gelesen – nur der Name', async () => {
    ct.global = { churchdb: { 'view groups of grouptype': [] } };
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    const r = await lauf();
    expect(r.abbruch).toBe('ohneRecht');
    expect(eingetragen()).toEqual([]);
    expect(ct.gelesen.some((p) => p.includes(`group_type_ids[]=${ANMELDUNG_TYP}`))).toBe(false);
    expect(ct.angaben().get(FZ)?.name).toBe('Führungszeugnis');
  });

  it('ohne Ablage: nichts eingetragen (ohne Merkzettel kein Eintragen)', async () => {
    ct.ct.kategorien = [];
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    const r = await lauf();
    expect(r.abbruch).toBe('ohneAblage');
    expect(eingetragen()).toEqual([]);
  });

  it('Ablage nicht lesbar (503): wirft, bevor jemand eingetragen wird', async () => {
    ct.ct.werteLesenScheitert = 503;
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    await expect(lauf()).rejects.toMatchObject({ status: 503 });
    expect(eingetragen()).toEqual([]);
  });
});

describe('nachweiseEintragen – Admin', () => {
  it('„Nur wenn …“: nur die passenden; alle Arten (auch fremd geleitete)', async () => {
    ct.veranstaltungen.set(V1, { e: mit(nurFotoJa(FZ), alle(JU)), roh: anmeldungenRoh() });
    const r = await lauf({ ich: 1, admin: true });
    expect(eingetragen()).toEqual(['61:10', '61:20', '62:10', '62:11', '62:20']);
    expect(r.arten.map((a) => a.id)).toEqual([FZ, JU]);
    expect(ct.angaben().get(JU)?.name).toBe('JuLeiCa');
  });
});

describe('Merkzettel (E34)', () => {
  it('ausgetragen: wird für dieselbe Veranstaltung nicht wieder eingetragen', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    await lauf();
    // Eine Vertrauensperson trägt Lena (11) aus.
    ct.mitglieder.set(
      FZ,
      ct.mitglieder.get(FZ)!.filter((m) => m.personId !== 11),
    );
    ct.angelegt = [];
    await lauf();
    expect(eingetragen()).toEqual([]);
    expect(ct.angaben().get(FZ)!.eingetragen.get(V1)).toEqual([10, 11, 20]);
  });

  it('…aber für eine neue Veranstaltung schon (keine Dauer-Lücke)', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    await lauf();
    ct.mitglieder.set(
      FZ,
      ct.mitglieder.get(FZ)!.filter((m) => m.personId !== 11),
    );
    ct.veranstaltungen.set(V2, { e: mit(alle(FZ)), roh: mitglieder('CCCCCC', [true], 11) });
    ct.angelegt = [];
    await lauf();
    expect(eingetragen()).toEqual(['61:11']);
    expect(ct.angaben().get(FZ)!.eingetragen).toEqual(
      new Map([
        [V1, [10, 11, 20]],
        [V2, [11]],
      ]),
    );
  });

  it('vorbeigegangene Veranstaltungen fallen vom Zettel (§ 72a)', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
    ct.ct.werte.push({
      id: 900,
      dataCategoryId: 124,
      value: artAngabenWert({
        gruppe: FZ,
        name: 'Führungszeugnis',
        eingetragen: new Map([[333, [7]]]),
      }),
    });
    await lauf();
    expect([...ct.angaben().get(FZ)!.eingetragen.keys()]).toEqual([V1]);
  });

  it('dieselbe Person in zwei Veranstaltungen: einmal eingetragen, für beide gemerkt', async () => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: mitglieder('AAAAAA', [true], 10) });
    ct.veranstaltungen.set(V2, { e: mit(alle(FZ)), roh: mitglieder('BBBBBB', [true], 10) });
    await lauf();
    expect(eingetragen()).toEqual(['61:10']);
    expect(ct.angaben().get(FZ)!.eingetragen).toEqual(
      new Map([
        [V1, [10]],
        [V2, [10]],
      ]),
    );
  });
});

describe('Fehler beim Eintragen – die Zweige einzeln', () => {
  beforeEach(() => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
  });

  it('403 „schon drin“: kein Fehler, nicht als neu gezählt, aber gemerkt (steht nachgelesen drin)', async () => {
    ct.scheitert.set(11, 'schonDrin');
    // Lena steht „inzwischen“ drin (ein zweiter Tab war schneller) – ChurchTools lehnt mit 403 ab.
    const port = ct.port();
    const anlegen = port.anlegen;
    port.anlegen = async (g, p, rolle) => {
      if (p === 11)
        ct.mitglieder
          .get(FZ)!
          .push({ personId: 11, groupTypeRoleId: rolle, groupMemberStatus: 'active' });
      return anlegen(g, p, rolle);
    };
    const r = await nachweiseEintragen(port, kontext());
    expect(eingetragen()).toEqual(['61:10', '61:11', '61:20']);
    expect(r.neu.get(FZ)).toEqual([10, 20]);
    expect(r.abbruch).toBeNull();
    expect(ct.angaben().get(FZ)!.eingetragen.get(V1)).toEqual([10, 11, 20]);
  });

  it('anderes 403: diese Art gesperrt, kein weiterer Versuch dort, nichts gemerkt', async () => {
    ct.scheitert.set(10, 'keinRecht');
    const r = await lauf();
    expect(eingetragen()).toEqual(['61:10']);
    expect(r.verweigert).toEqual([FZ]);
    expect(r.neu.size).toBe(0);
    expect(ct.angaben().get(FZ)!.eingetragen.size).toBe(0);
  });

  it('429 (Drosselung): sofort Schluss – keine Anfrage mehr, nichts verbucht', async () => {
    ct.scheitert.set(11, 'bremse');
    const vorherGelesen = () => ct.gelesen.length;
    let nachBremse = 0;
    const port = ct.port();
    const anlegen = port.anlegen;
    port.anlegen = async (g, p, rolle) => {
      try {
        return await anlegen(g, p, rolle);
      } finally {
        if (p === 11) nachBremse = vorherGelesen();
      }
    };
    const r = await nachweiseEintragen(port, kontext());
    expect(r.abbruch).toBe('bremse');
    expect(eingetragen()).toEqual(['61:10', '61:11']);
    expect(ct.gelesen.length).toBe(nachBremse);
    expect(ct.ct.aufrufe).toEqual([]);
  });

  it('5xx/Netz: Schluss, nichts verbucht (Merkzettel bleibt leer)', async () => {
    ct.scheitert.set(11, 'voruebergehend');
    const r = await lauf();
    expect(r.abbruch).toBe('voruebergehend');
    expect(eingetragen()).toEqual(['61:10', '61:11']);
    expect(ct.ct.aufrufe).toEqual([]);
  });

  it('„Erfolg“, der nichts übernimmt: nachgelesen nicht da → weder gezählt noch gemerkt', async () => {
    ct.schluckt.add(10);
    const r = await lauf();
    expect(r.neu.get(FZ)).toEqual([11, 20]);
    expect(ct.angaben().get(FZ)!.eingetragen.get(V1)).toEqual([11, 20]);
  });
});

describe('Obergrenze und Pause', () => {
  beforeEach(() => {
    ct.veranstaltungen.set(V1, { e: mit(alle(FZ)), roh: anmeldungenRoh() });
  });

  it('höchstens `max` Versuche je Öffnen; der Rest beim nächsten Mal', async () => {
    const r = await lauf({ max: 2 });
    expect(eingetragen()).toEqual(['61:10', '61:11']);
    expect(r.abbruch).toBe('obergrenze');
    ct.angelegt = [];
    await lauf({ max: 2 });
    expect(eingetragen()).toEqual(['61:20']);
  });

  it('Pause zwischen zwei Versuchen (Fake-Timer): der zweite erst nach EINTRAGEN_PAUSE_MS', async () => {
    vi.useFakeTimers();
    const port = ct.port((ms) => new Promise((r) => setTimeout(r, ms)));
    const fertig = nachweiseEintragen(port, kontext());
    await vi.advanceTimersByTimeAsync(0);
    expect(eingetragen()).toEqual(['61:10']);
    await vi.advanceTimersByTimeAsync(EINTRAGEN_PAUSE_MS - 1);
    expect(eingetragen()).toEqual(['61:10']);
    await vi.advanceTimersByTimeAsync(1);
    expect(eingetragen()).toEqual(['61:10', '61:11']);
    await vi.advanceTimersByTimeAsync(EINTRAGEN_PAUSE_MS);
    await fertig;
    expect(eingetragen()).toEqual(['61:10', '61:11', '61:20']);
  });
});
