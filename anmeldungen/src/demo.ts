/**
 * **Nur zum Entwickeln** (`npm run dev -w anmeldungen`, dann `…/ccm/anmeldungen/?demo`): spielt ChurchTools
 * nach – in der Form, die an der Test-Instanz gemessen wurde (12.10.2026) –, damit die Seite ohne Instanz
 * zu sehen und zu bedienen ist. Seit A3 merkt sich die Demo auch, was geschrieben wird (Anlegen,
 * Einrichten, Termine), bis die Seite neu geladen wird. `?demo=leer` zeigt „keine Gruppen",
 * `?demo=fehler` den Fehlerfall, `?demo=einrichten` die Erweiterung vor dem Einrichten (keine Formular-Adresse), `?demo=admin` einen Gruppen-Admin (verschieben, endgültig löschen), `?demo=vertrauen` eine Vertrauensperson der Nachweise ohne „Berechtigungen verwalten“ (sieht die Seite „Nachweise“, kann nichts anlegen). Seit N1b gibt es zwei Nachweis-Arten (Führungszeugnis, JuLeiCa), `#/nachweise` zeigt sie. Seit N3b zeigt die Lobpreisfreizeit (`#/v/46`, Vorbereiten) die Karte „Nachweise“ mit einer „Nur wenn“-Bedingung, der Worship-Workshop (`#/v/43`) eine kaputte. Wird nie mitgebaut (siehe `main.tsx`).
 *
 * Die Beschreibungen entstehen mit `einstellungenAlsText` – wie im Betrieb.
 */
import { einstellungenAlsText, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import {
  NACHWEIS_ABLAUF_NAME,
  NACHWEIS_STAND_KATEGORIE,
  nachweisEinstellungenLesen,
  nachweisNotiz,
  nachweisSchritte,
} from '@shared/anmeldung/nachweise';

function beschreibung(
  beginn: string,
  ende: string | null,
  ort: string,
  grundpreis: OeffentlicheEinstellungen['preis']['grundpreis'],
  bezahlt?: number,
  mehr: Partial<OeffentlicheEinstellungen> = {},
): string {
  return einstellungenAlsText({
    ...neueEinstellungen('einfach'),
    termin: { beginn, ende, ort, terminId: null },
    preis: { grundpreis, alter: [], anpassungen: [], extras: [] },
    ctFelder: bezahlt ? { bezahlt } : {},
    ...mehr,
  });
}

const fest = (betragCent: number) => ({
  art: 'fest' as const,
  betragCent,
  gilt: 'person' as const,
  auswahlName: '',
  optionen: [],
});

/** Ein Tag relativ zu heute, damit die Demo nie veraltet. */
function tag(abHeute: number, uhr = '19:00'): string {
  const d = new Date(Date.now() + abHeute * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${uhr}`;
}
const utc = (lokal: string) => new Date(lokal).toISOString().replace('.000Z', 'Z');

interface G {
  name: string;
  parent: number;
  /** Beim Verschieben: die neue Obergruppe, bis die alte entfernt ist (`PUT`, dann `DELETE` parents). */
  neuParent?: number;
  status: number;
  note: string;
  settings: Record<string, unknown>;
  felder: { id: number; name: string; [k: string]: unknown }[];
  /** Personenfelder im Anmeldeformular (F4: `street`, `zip`, `city`). */
  personenfelder?: string[];
  /** Titelbild (A5). */
  bild?: string;
  /** Gruppenart; ohne Angabe „Anmeldung“ (5). Die Nachweis-Arten (N1b) sind Art 11. */
  typ?: number;
}

let naechste = 500;

function g(
  name: string,
  parent: number,
  note: string,
  settings: Record<string, unknown>,
  status = 1,
): G {
  return { name, parent, status, note, settings, felder: [{ id: 73, name: 'Bezahlt' }] };
}

/**
 * **Bedingungen in der Demo** (F1e, 16.11.2026): Die Lobpreisfreizeit fragt im Kontakt „Bist du im Team?“, je Person
 * „Bereich“ („Technik“ nur fürs Team) und „Team-Erfahrung“ (nur fürs Team). Die Familie Beispiel (Anmelde-Nr. DEMO01)
 * verstößt dagegen – so, als hätte jemand in ChurchTools von Hand etwas eingetragen. Damit zeigt die Nachprüfung zwei
 * Befunde. Tom Muster (DEMO02) ist im Team – bei ihm zeigt „Person dazu“ die Fragen fürs Team.
 */
const DEMO_SPALTEN = {
  nr: 74,
  kontakt: 75,
  auswahl: 76,
  team: 78,
  bereich: 79,
  erfahrung: 80,
  // F3: der Text der freien Antwort „Anderer Bereich“ in seiner zweiten Spalte.
  'bereich.frei': 81,
};
function mitBedingungen(
  f: OeffentlicheEinstellungen['formular'],
): OeffentlicheEinstellungen['formular'] {
  const frage = (
    id: string,
    typ: 'janein' | 'radio' | 'text' | 'schritt',
    text: string,
    antworten: string[] = [],
  ) => ({
    id,
    art: 'eigen' as const,
    typ,
    frage: text,
    hilfe: '',
    zustand: 'freiwillig' as const,
    antworten,
  });
  const imTeam = {
    modus: 'eine' as const,
    regeln: [{ feld: 'team', op: 'ist' as const, wert: 'Ja' }],
  };
  return {
    anmeldung: [
      ...f.anmeldung.slice(0, -1),
      // F2: Das Formular blättert – „Mitarbeit“ (Team-Frage + Personen), dann „Team“ nur für Mitarbeitende.
      frage('s-mit', 'schritt', 'Mitarbeit'),
      frage('team', 'janein', 'Bist du im Team?'),
      ...f.anmeldung.slice(-1),
    ],
    person: [
      ...f.person,
      {
        ...frage('bereich', 'radio', 'Bereich', ['Küche', 'Technik']),
        antwortBed: { Technik: { ...imTeam, art: 'grau' as const, grund: 'nur fürs Team' } },
        frei: { name: 'Anderer Bereich', textfeld: 'auf' as const },
      },
      { ...frage('s-team', 'schritt', 'Team'), bed: imTeam },
      { ...frage('erfahrung', 'text', 'Team-Erfahrung'), bed: imTeam },
    ],
  };
}
const DEMO_FELDER = [
  { id: 73, name: 'Bezahlt' },
  { id: 74, name: 'Anmelde-Nr.' },
  { id: 75, name: 'Angemeldet von' },
  { id: 76, name: 'Zimmer' },
  {
    id: 78,
    name: 'Bist du im Team?',
    fieldTypeCode: 'radioselect',
    options: [
      { id: 781, name: 'Ja' },
      { id: 782, name: 'Nein' },
    ],
  },
  {
    id: 79,
    name: 'Bereich',
    fieldTypeCode: 'radioselect',
    options: [
      { id: 791, name: 'Küche' },
      { id: 792, name: 'Technik' },
      { id: 793, name: 'Anderer Bereich' },
    ],
  },
  { id: 80, name: 'Team-Erfahrung' },
  { id: 81, name: 'Bereich (Anderer Bereich)' },
];
/** Ein Tag (`YYYY-MM-DD`) relativ zu heute, optional Jahre davor/danach – für die Nachweise (N2a). */
function isoTag(abHeute: number, jahre = 0): string {
  const d = new Date(Date.now() + abHeute * 86_400_000);
  d.setUTCFullYear(d.getUTCFullYear() + jahre);
  return d.toISOString().slice(0, 10);
}

/**
 * Teilnehmer der Nachweis-Arten (N2a, Entwurf `n2-stand-v1`): je ein Stand – fehlt, Rücksprache, abgelaufen, läuft ab,
 * angefordert (ohne Geburtsdatum und Adresse), gültig. Nicht in der Personensuche.
 */
const NACHWEIS_PERSONEN = [
  {
    id: 911,
    firstName: 'Lena',
    lastName: 'Probst',
    email: 'lena@beispiel.test',
    birthday: '2001-03-14',
    street: 'Bachweg 7',
    zip: '53797',
    city: 'Lohmar',
  },
  {
    id: 912,
    firstName: 'Jonas',
    lastName: 'Weber',
    email: 'jonas@beispiel.test',
    birthday: '1999-07-02',
    street: 'Ringstr. 1',
    zip: '53797',
    city: 'Lohmar',
  },
  {
    id: 913,
    firstName: 'Ben',
    lastName: 'Alt',
    email: 'ben@beispiel.test',
    birthday: '1990-01-20',
    street: '',
    zip: '',
    city: '',
  },
  {
    id: 914,
    firstName: 'Mia',
    lastName: 'Muster',
    email: 'mia@beispiel.test',
    birthday: '2003-11-05',
    street: 'Am Bach 2',
    zip: '51766',
    city: 'Engelskirchen',
  },
  {
    id: 915,
    firstName: 'Paula',
    lastName: 'Neu',
    email: 'paula@beispiel.test',
    birthday: null,
    street: '',
    zip: '',
    city: '',
  },
  {
    id: 916,
    firstName: 'Sara',
    lastName: 'Weber',
    email: 'sara@beispiel.test',
    birthday: '1997-05-30',
    street: 'Ringstr. 1',
    zip: '53797',
    city: 'Lohmar',
  },
  // N2c: läuft bald ab, aber ChurchTools kennt keine Mailadresse – steht in „Fällige anschreiben“ grau da.
  {
    id: 917,
    firstName: 'Tom',
    lastName: 'Leise',
    email: '',
    birthday: '1995-09-09',
    street: 'Dorfstr. 3',
    zip: '53797',
    city: 'Lohmar',
  },
];

const DEMO_PERSONEN = [
  {
    id: 901,
    firstName: 'Maria',
    lastName: 'Beispiel',
    email: 'maria@beispiel.test',
    birthday: '1988-04-12',
    // F4b: Adressen aus dem Profil – zu sehen, sobald der Baustein „Adresse“ im Formular ist.
    street: 'Hauptstr. 4',
    zip: '53797',
    city: 'Lohmar',
  },
  {
    id: 902,
    firstName: 'Jonas',
    lastName: 'Beispiel',
    email: null,
    birthday: '2014-06-01',
    street: 'Hauptstr. 4',
    zip: '53797',
    city: 'Lohmar',
  },
  {
    id: 903,
    firstName: 'Tom',
    lastName: 'Muster',
    email: 'tom@muster.test',
    birthday: '1979-09-30',
    street: 'Am Bach 2',
    zip: '51766',
    city: 'Engelskirchen',
  },
  // Zum Finden bei „Person dazu“ (noch in keiner Veranstaltung). F4c: mit Adresse – „Von Hand“ zeigt sie vorbelegt.
  {
    id: 904,
    firstName: 'Anna',
    lastName: 'Muster',
    email: null,
    birthday: '2012-03-08',
    street: 'Am Bach 2',
    zip: '51766',
    city: 'Engelskirchen',
  },
];
/**
 * Weitere Anmeldungen der Lobpreisfreizeit (R2, 23.11.2026) – erfundene Namen, unterschiedliche Antworten, damit Filter,
 * Summen und eigene Ansichten in der Demo etwas zu tun haben. Nicht in der Personensuche.
 */
const FREIZEIT_PERSONEN = [
  [921, 'Petra', 'Albers', '1984-02-11'],
  [922, 'Lukas', 'Albers', '2015-08-20'],
  [923, 'Jonas', 'Brenner', '2001-05-03'],
  [924, 'Ruth', 'Dietrich', '1957-10-30'],
  [925, 'Daniel', 'Engel', '1990-01-15'],
  [926, 'Mila', 'Engel', '2018-04-09'],
  [927, 'Ben', 'Engel', '2021-12-01'],
  [928, 'Lea', 'Fuchs', '1999-07-21'],
].map(([id, firstName, lastName, birthday]) => ({
  id: id as number,
  firstName: firstName as string,
  lastName: lastName as string,
  email: `${String(firstName).toLowerCase()}@beispiel.test`,
  birthday: birthday as string,
  street: '',
  zip: '',
  city: '',
}));

const familie = (seit: string) => ({
  data: [
    // Maria: nicht im Team, aber „Technik“ (nur fürs Team).
    [
      901,
      { 73: '0', 74: 'DEMO01', 75: 'Maria Beispiel', 76: '4-Bett-Zimmer', 78: '782', 79: '792' },
    ],
    // Jonas: „Team-Erfahrung“ beantwortet – die Frage käme nur fürs Team. Bereich: freie Antwort „Fotos“ (F3).
    [902, { 73: '0', 74: 'DEMO01', 79: '793', 80: 'drei Jahre', 81: 'Fotos' }],
    // Tom (DEMO02): im Team, alles erlaubt – für „Person dazu“ mit der Kontakt-Antwort „Ja“.
    [
      903,
      {
        73: '0',
        74: 'DEMO02',
        75: 'Tom Muster',
        76: '2-Bett-Zimmer',
        78: '781',
        79: '792',
        80: 'Leitung Technik',
      },
    ],
    // R2: weitere Anmeldungen zum Filtern (Küche/Technik/anderer Bereich, bezahlt/offen, im Team oder nicht).
    [921, { 73: '1', 74: 'DEMO03', 75: 'Petra Albers', 76: '4-Bett-Zimmer', 78: '782', 79: '791' }],
    [922, { 73: '0', 74: 'DEMO03', 79: '791' }],
    [
      923,
      {
        73: '0',
        74: 'DEMO04',
        75: 'Jonas Brenner',
        76: '2-Bett-Zimmer',
        78: '781',
        79: '792',
        80: 'Mischpult',
      },
    ],
    [
      924,
      { 73: '0', 74: 'DEMO05', 75: 'Ruth Dietrich', 76: '4-Bett-Zimmer', 78: '782', 79: '791' },
    ],
    [
      925,
      {
        73: '1',
        74: 'DEMO06',
        75: 'Daniel Engel',
        76: '4-Bett-Zimmer',
        78: '781',
        79: '793',
        80: 'Bühne',
        81: 'Aufbau',
      },
    ],
    [926, { 73: '0', 74: 'DEMO06', 79: '791' }],
    [927, { 73: '0', 74: 'DEMO06' }],
    [928, { 73: '0', 74: 'DEMO07', 75: 'Lea Fuchs', 76: '4-Bett-Zimmer', 78: '782' }],
  ].map(([id, werte]) => {
    const p = [...DEMO_PERSONEN, ...FREIZEIT_PERSONEN].find((x) => x.id === id)!;
    // Lea Fuchs wartet (R2: Filter „Status: Warteliste“ je Person).
    const wartet = id === 928;
    return {
      personId: p.id,
      person: { domainAttributes: { firstName: p.firstName, lastName: p.lastName } },
      groupTypeRoleId: 15,
      groupMemberStatus: wartet ? 'waiting' : 'active',
      waitinglistPosition: wartet ? 1 : null,
      memberStartDate: seit,
      fields: Object.entries(werte as Record<string, string>).map(([f, value]) => ({
        id: Number(f),
        value,
      })),
    };
  }),
  meta: { pagination: { lastPage: 1 } },
});

/** Die Angaben je Person einer Nachweis-Gruppe – Stufe 4, nicht im Anmeldeformular (N1b). */
const nachweisFelder = () =>
  [
    { id: 91, name: 'Eingesehen am', fieldTypeCode: 'date' },
    { id: 92, name: 'Ausgestellt am', fieldTypeCode: 'date' },
    {
      id: 93,
      name: 'Ergebnis',
      fieldTypeCode: 'radioselect',
      options: [
        { id: '931', name: 'Keine Eintragung, die einer Mitarbeit entgegensteht' },
        { id: '932', name: 'Eintragung – Rücksprache mit der Leitung nötig' },
      ],
    },
  ].map((f) => ({
    ...f,
    securityLevel: 4,
    useInRegistrationForm: false,
    requiredInRegistrationForm: false,
  }));

function demoGruppen(): Map<number, G> {
  return new Map([
    [
      61,
      {
        ...g(
          'Nachweis: Führungszeugnis',
          0,
          nachweisNotiz({
            gueltigJahre: 3,
            ab: 'ausstellung',
            betreff: 'Bitte erweitertes Führungszeugnis beantragen',
            text: 'Hallo [Vorname],\n\nfür deine Mitarbeit brauchen wir ein erweitertes Führungszeugnis. Den Antrag findest du in ChurchTools unter „Meine Gruppen“.',
          }),
          { visibility: 'restricted' },
        ),
        typ: 11,
        felder: nachweisFelder(),
      },
    ],
    [
      62,
      {
        ...g(
          'Nachweis: JuLeiCa',
          0,
          nachweisNotiz({
            gueltigJahre: 5,
            ab: 'einsicht',
            betreff: 'Bitte JuLeiCa vorlegen',
            text: 'Hallo [Vorname],\n\nbitte zeig einer Vertrauensperson deine JuLeiCa.',
          }),
          { visibility: 'restricted' },
        ),
        typ: 11,
        felder: nachweisFelder(),
      },
    ],
    [
      40,
      g('Lobpreisabend', 9, beschreibung(tag(20), null, 'Gemeindesaal', fest(0)), {
        maxMembers: 6,
        allowWaitinglist: true,
        signUpOpeningDate: utc(tag(-11)),
        signUpClosingDate: utc(tag(18)),
      }),
    ],
    [
      43,
      g(
        'Worship-Workshop',
        9,
        // N3b: eine kaputte Bedingung (die Frage gibt es nicht mehr) und eine Art, die diese Person nicht sieht – beides zeigt
        // die Karte „Nachweise“ mit Hinweis statt still zu brechen.
        beschreibung(tag(54, '10:00'), null, 'Gemeindesaal', fest(1500), 73, {
          nachweise: [
            { artGruppeId: 61, fuer: 'nurWenn', feld: 'frage:gibtsnicht', antworten: ['Ja'] },
            { artGruppeId: 99, fuer: 'alle' },
          ],
        }),
        { maxMembers: 20 },
        2,
      ),
    ],
    [
      46,
      g(
        'Lobpreisfreizeit',
        9,
        beschreibung(
          tag(39, '18:00'),
          tag(41, '13:00'),
          'Haus Lutzenberg',
          {
            art: 'auswahl',
            betragCent: 0,
            gilt: 'person',
            auswahlName: 'Zimmer',
            optionen: [
              { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 8, belegt: 0, personenJe: 0 },
              { name: '2-Bett-Zimmer', preisCent: 8900, kontingent: 4, belegt: 0, personenJe: 0 },
            ],
          },
          73,
          // A4: alle Preis-Bausteine und eine Bankverbindung, damit „Probe rechnen“ etwas zu tun hat.
          {
            preis: {
              grundpreis: {
                art: 'auswahl',
                betragCent: 0,
                gilt: 'person',
                auswahlName: 'Zimmer',
                optionen: [
                  {
                    name: '4-Bett-Zimmer',
                    preisCent: 6552,
                    kontingent: 8,
                    belegt: 0,
                    personenJe: 0,
                  },
                  {
                    name: '2-Bett-Zimmer',
                    preisCent: 8900,
                    kontingent: 4,
                    belegt: 0,
                    personenJe: 0,
                  },
                ],
              },
              alter: [
                { von: 0, bis: 2, art: 'frei', wert: 0 },
                { von: 3, bis: 11, art: 'prozent', wert: 50 },
              ],
              anpassungen: [
                {
                  art: 'rabatt',
                  bezeichnung: 'Frühbucher',
                  bedingung: 'fruehbucher',
                  bis: tag(10).slice(0, 10),
                  abKind: 2,
                  einheit: 'euro',
                  wert: 500,
                  gilt: 'person',
                },
              ],
              extras: [{ bezeichnung: 'Bettwäsche leihen', preisCent: 800, gilt: 'person' }],
            },
            formular: mitBedingungen(neueEinstellungen('freizeit').formular),
            ctFelder: { bezahlt: 73, ...DEMO_SPALTEN },
            bezahlung: {
              kontoinhaber: 'Gemeinde e.V. (Beispiel)',
              iban: 'DE89370400440532013000',
              bic: '',
              fristTage: 14,
              zweck: 'Lobpreisfreizeit [Nachname]',
            },
            // N3b: Führungszeugnis nur fürs Team „Technik“ (Frage je Person), JuLeiCa aus – die Karte „Nachweise“ zeigt es.
            nachweise: [
              { artGruppeId: 61, fuer: 'nurWenn', feld: 'frage:bereich', antworten: ['Technik'] },
            ],
          },
        ),
        {
          maxMembers: 20,
          allowWaitinglist: true,
          signUpOpeningDate: utc(tag(-27)),
          signUpClosingDate: utc(tag(29)),
        },
      ),
    ],
    [
      49,
      g('Technik-Schulung', 7, beschreibung(tag(-23, '10:00'), null, 'Technikraum', fest(0)), {
        maxMembers: 10,
      }),
    ],
    [
      52,
      g(
        'Tontechnik-Grundkurs',
        7,
        beschreibung(tag(33, '09:30'), null, 'Gemeindesaal', fest(1200), 73),
        { maxMembers: 12, signUpOpeningDate: utc(tag(8)) },
      ),
    ],
  ]);
}

const mitglieder = (aktiv: (string | null)[], wartend = 0) => ({
  data: [
    ...aktiv.map((b) => ({
      groupMemberStatus: 'active',
      fields: b === null ? [] : [{ id: 73, name: 'Bezahlt', value: b }],
    })),
    ...Array.from({ length: wartend }, () => ({ groupMemberStatus: 'waiting', fields: [] })),
  ],
  meta: { pagination: { lastPage: 1 } },
});

const MITGLIEDER: Record<number, unknown> = {
  40: mitglieder([null, null, null, null, null], 2),
  46: familie(tag(-5).slice(0, 10)),
  52: mitglieder(['0', '0']),
};

const TERMINE: Record<string, unknown>[] = [
  {
    id: 801,
    title: 'Gemeindeessen',
    startDate: utc(tag(34, '12:00')),
    endDate: utc(tag(34, '14:00')),
    address: { name: 'Gemeindesaal', city: 'Lohmar' },
  },
  {
    id: 802,
    title: 'Gemeindefreizeit',
    startDate: utc(tag(60, '17:00')),
    endDate: utc(tag(62, '13:00')),
    address: { name: 'Haus Lutzenberg' },
  },
];

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  if (fall === 'einrichten') DATEN.werte = [];
  const gruppen = demoGruppen();
  gruppen.get(46)!.felder = DEMO_FELDER.map((f) => ({ ...f }));
  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      // 204 hat keinen Inhalt – sonst wirft `Response`.
      new Response(status === 204 ? null : JSON.stringify(daten), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  const gruppeRoh = (id: number, x: G) => ({
    id,
    name: x.name,
    information: {
      note: x.note,
      groupStatusId: x.status,
      groupTypeId: x.typ ?? 5,
      imageUrl: x.bild ?? null,
    },
    settings: x.settings,
  });
  // Archivierte Gruppen stehen weder in `children` noch in `hierarchies` (gemessen 13.10.2026).
  const kinderVon = (p: number) => [...gruppen].filter(([, x]) => x.parent === p && x.status !== 3);
  const TEAMS: Record<number, string> = { 7: 'Technik', 9: 'Lobpreisteam' };

  // ── Nachweise (N1b): Mitglieder, Rechte der Leiter-Rolle und Abläufe merkt sich die Demo, bis neu geladen wird ──
  const NACHWEIS_TYP = 11;
  const LEITER_ROLLE = 56;
  const TEILNEHMER_ROLLE = 53;
  // Rechte je Rolle der Gruppenart (Leiter und – seit M6 – Teilnehmer).
  const nachweisRechte = new Map<number, { authId: number; dataId: number | null }[]>();
  // Bescheinigungen (N1c): Vorlagen, Dateien und Rollen IN den Gruppen (andere Nummern als die der Art).
  const vorlagen = new Map<
    number,
    { id: number; name: string; domainType: string; htmlFileId: number | null }
  >();
  const dateien = new Map<number, string>();
  const gruppenRollen = new Map<
    number,
    { id: number; groupTypeRoleId: number; htmlTemplateIds: number[] }[]
  >();
  const rollenVon = (gid: number) => {
    let l = gruppenRollen.get(gid);
    if (!l) {
      l = [
        { id: 3000 + gid, groupTypeRoleId: TEILNEHMER_ROLLE, htmlTemplateIds: [] },
        { id: 4000 + gid, groupTypeRoleId: LEITER_ROLLE, htmlTemplateIds: [] },
      ];
      gruppenRollen.set(gid, l);
    }
    return l;
  };
  let naechsteVorlage = 800;
  let naechsteRoutine = 700;
  interface Schritt {
    id?: number;
    specId?: number;
    actionKey: string;
    children?: Schritt[];
    [k: string]: unknown;
  }
  const routinen = new Map<
    number,
    {
      id: number;
      name: string;
      isEnabled: boolean;
      steps: Schritt[];
      groupId: number;
      groupTypeRoleId: number;
      groupMemberStatus: string;
    }
  >();
  // N2a: Teilnehmer mit Angaben (Feld 91 Eingesehen am, 92 Ausgestellt am, 93 Ergebnis: '931' ohne, '932' Eintragung).
  type Angaben = Partial<Record<91 | 92 | 93, string>>;
  const teilnehmer = (personId: number, fields: Angaben = {}) => ({
    personId,
    groupTypeRoleId: TEILNEHMER_ROLLE,
    groupMemberStatus: 'active',
    fields,
  });
  const nachweisMitglieder = new Map<
    number,
    { personId: number; groupTypeRoleId: number; groupMemberStatus: string; fields?: Angaben }[]
  >([
    [
      61,
      [
        { personId: 903, groupTypeRoleId: LEITER_ROLLE, groupMemberStatus: 'active' },
        // Die angemeldete Demo-Person leitet „Führungszeugnis“ (`?demo=vertrauen`, `/persons/1/groups`).
        { personId: 1, groupTypeRoleId: LEITER_ROLLE, groupMemberStatus: 'active' },
        teilnehmer(911),
        teilnehmer(912, { 91: isoTag(-17), 92: isoTag(-31), 93: '932' }),
        teilnehmer(913, { 91: isoTag(-42, -3), 92: isoTag(-49, -3), 93: '931' }),
        teilnehmer(914, { 91: isoTag(45, -3), 92: isoTag(38, -3), 93: '931' }),
        teilnehmer(915),
        teilnehmer(916, { 91: isoTag(-9), 92: isoTag(-17), 93: '931' }),
        teilnehmer(917, { 91: isoTag(-3), 92: isoTag(20, -3), 93: '931' }),
      ],
    ],
    [
      62,
      [
        { personId: 903, groupTypeRoleId: LEITER_ROLLE, groupMemberStatus: 'active' },
        { personId: 901, groupTypeRoleId: LEITER_ROLLE, groupMemberStatus: 'active' },
        teilnehmer(916, { 91: isoTag(-9), 93: '931' }),
      ],
    ],
  ]);
  // Folgeaufgaben wie aus dem Ablauf (N2a): offen = `doneDate` null; „angefordert am“ = Tag der Anlage.
  let naechsteAufgabe = 700;
  interface DemoAufgabe {
    id: number;
    personId: number;
    title: string;
    doneDate: string | null;
    dueDate?: string | null;
    effectiveDueDate?: string | null;
    meta: { createdDate: string };
  }
  const aufgabe = (
    personId: number,
    title: string,
    angelegt: number,
    erledigt: number | null,
  ): DemoAufgabe => ({
    id: naechsteAufgabe++,
    personId,
    title,
    doneDate: erledigt === null ? null : `${isoTag(erledigt)}T10:00:00Z`,
    meta: { createdDate: `${isoTag(angelegt)}T10:00:00Z` },
  });
  const nachweisAufgaben = new Map<number, DemoAufgabe[]>([
    [
      61,
      [
        aufgabe(911, 'Einsicht nehmen', -35, null),
        aufgabe(912, 'Einsicht nehmen', -60, -17),
        aufgabe(912, 'Erneut einsehen', -17, null),
        aufgabe(915, 'Einsicht nehmen', -1, null),
        aufgabe(916, 'Einsicht nehmen', -40, -9),
        aufgabe(916, 'Erneut einsehen', -9, null),
        // N2c: die fälligen Personen haben ihre offene „Erneut einsehen“ – daran landet der Vermerk.
        aufgabe(913, 'Erneut einsehen', -20, null),
        aufgabe(914, 'Erneut einsehen', -5, null),
        aufgabe(917, 'Erneut einsehen', -2, null),
      ],
    ],
    [62, [aufgabe(916, 'Einsicht nehmen', -30, -9), aufgabe(916, 'Erneut einsehen', -9, null)]],
  ]);
  // N2c: Notizen an Folgeaufgaben und der Protokoll-Stand der „verschickten“ Mails – nichts wird wirklich gesendet.
  const aufgabenNotizen = new Map<number, { id: number; text: string }[]>();
  const mailProtokoll: { date: string; message: string }[] = [];
  let naechsteNotiz = 5000;
  /** Den Ablauf der beiden vorhandenen Arten gibt es schon – mit den Nummern, die ChurchTools vergibt. */
  const schritteNummern = (liste: Schritt[]): Schritt[] =>
    liste.map((x) => ({
      ...x,
      id: x.id ?? naechsteRoutine++,
      ...(x.actionKey === 'create-follow-up' ? { specId: x.specId ?? naechsteRoutine++ } : {}),
      ...(x.children ? { children: schritteNummern(x.children) } : {}),
    }));
  for (const [gid, e] of [
    [61, { name: 'Führungszeugnis', jahre: 3 }],
    [62, { name: 'JuLeiCa', jahre: 5 }],
  ] as const) {
    const einst = nachweisEinstellungenLesen(gruppen.get(gid)?.note)!;
    routinen.set(naechsteRoutine, {
      id: naechsteRoutine,
      name: NACHWEIS_ABLAUF_NAME,
      isEnabled: true,
      steps: schritteNummern(
        nachweisSchritte({ name: e.name, ...einst }, 903) as unknown as Schritt[],
      ),
      groupId: gid,
      groupTypeRoleId: TEILNEHMER_ROLLE,
      groupMemberStatus: 'active',
    });
    naechsteRoutine++;
  }
  // Die angemeldete Demo-Person (`/whoami`: Nummer 1) steht nicht in der Personensuche, soll aber als Leitung einen Namen haben.
  const personName = (id: number) =>
    id === 1
      ? { firstName: 'Alwin', lastName: '' }
      : [...DEMO_PERSONEN, ...NACHWEIS_PERSONEN, ...FREIZEIT_PERSONEN].find((p) => p.id === id);

  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    // Die Verbindung schickt JSON immer als Text (`ui/ct/verbindung.ts`).
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (fall === 'fehler' && pfad.endsWith('/children')) return antwort({}, 502);
    if (pfad === '/csrftoken') return antwort({ data: 'demo' });
    if (pfad === '/whoami') return antwort({ data: { id: 1, firstName: 'Alwin' } });
    // F4: die eingebauten Personenfelder für die Adresse – Nummern wie auf der Test-Instanz (gemessen 17.11.2026).
    if (pfad === '/fields')
      return antwort({
        data: [
          { id: 4, key: 'street' },
          { id: 6, key: 'zip' },
          { id: 7, key: 'city' },
        ],
      });
    if (pfad === '/info') return antwort({ siteName: 'Evangeliumschristen- Gemeinde e.V.' });
    if (pfad === '/persons/1/groups') {
      const team = (title: string, id: number, rolle: number) => ({
        group: { title, domainIdentifier: String(id) },
        groupTypeRoleId: rolle,
        groupMemberStatus: 'active',
      });
      return antwort({
        data:
          fall === 'leer'
            ? []
            : [
                team('Technik', 7, 15),
                team('Lobpreisteam', 9, 16),
                // Die Vertrauensperson leitet eine Nachweis-Gruppe (N1b).
                ...(fall === 'vertrauen'
                  ? [team('Nachweis: Führungszeugnis', 61, LEITER_ROLLE)]
                  : []),
              ],
      });
    }
    if (pfad === '/group/roles') {
      return antwort({
        data: [
          { id: 16, name: 'Leiter', isLeader: true },
          { id: 15, name: 'Mitarbeiter', isLeader: false },
          // Gruppenart „Nachweis“ (N1b): Teilnehmer und Leiter, wie ChurchTools sie beim Anlegen der Art erzeugt.
          { id: TEILNEHMER_ROLLE, groupTypeId: NACHWEIS_TYP, isLeader: false, isDefault: true },
          { id: LEITER_ROLLE, groupTypeId: NACHWEIS_TYP, isLeader: true },
        ],
      });
    }
    if (pfad === '/group/grouptypes') {
      return antwort({
        data: [
          { id: 2, name: 'Dienst' },
          { id: 5, name: 'Anmeldung' },
          { id: NACHWEIS_TYP, name: 'Nachweis', sortKey: 100 },
        ],
      });
    }
    if (pfad === '/groups/hierarchies') {
      return antwort({
        data: [9, 7].map((p) => ({ groupId: p, children: kinderVon(p).map(([id]) => id) })),
      });
    }
    if (pfad === '/permissions/global') {
      // `?demo=admin`: Gruppen-Admin (darf verschieben und endgültig löschen).
      const churchdb = fall === 'admin' ? { 'administer groups': true } : {};
      // „Berechtigungen verwalten“ (Nachweise einrichten) – nur nicht für `?demo=vertrauen`.
      const churchcore =
        fall === 'vertrauen'
          ? { 'view birthdays': true }
          : { 'administer persons': true, 'administer church html templates': true };
      return antwort({ data: { churchcore, churchdb, churchcal: { 'edit category': [1] } } });
    }
    // ── Nachweise (N1b) ──
    // Rechte-Definitionen: das Modulrecht „Anmeldungen sehen“ und die Rechte des Datenspeichers (Nummern je Instanz anders –
    // hier die der Test-Instanz).
    if (pfad === '/permissions/definitions')
      return antwort({
        data: {
          modules: [
            {
              key: 'anmeldungen',
              name: 'Anmeldungen',
              permissions: [
                { authId: 2020, key: 'view', name: 'Anmeldungen sehen', valueType: 'boolean' },
                { authId: 2021, key: 'view custom category' },
                { authId: 2025, key: 'view custom data' },
                { authId: 2026, key: 'create custom data' },
                { authId: 2027, key: 'edit custom data' },
                { authId: 2028, key: 'delete custom data' },
              ],
            },
          ],
        },
      });
    // Wer „Anmeldungen sehen“ hat (N3a): in der Demo nur die Leiter-Rolle der Nachweise.
    if (pfad === '/permissions/global/auths/2020/assignment-summary')
      return antwort({
        data: {
          authId: 2020,
          dataId: null,
          effectivePersonCount: 1,
          assignments: {
            statuses: [],
            groupTypes: [
              { groupTypeId: NACHWEIS_TYP, groupTypeRoleIds: [LEITER_ROLLE], personCount: 1 },
            ],
            groups: [],
            persons: [],
          },
        },
      });
    let r = /^\/permissions\/group_type_role\/(\d+)$/.exec(pfad);
    if (r && [LEITER_ROLLE, TEILNEHMER_ROLLE].includes(Number(r[1]))) {
      const liste = nachweisRechte.get(Number(r[1])) ?? [];
      if (m === 'PUT') {
        const dataId = Array.isArray(body.dataId) ? Number(body.dataId[0]) : null;
        nachweisRechte.set(Number(r[1]), [...liste, { authId: Number(body.authId), dataId }]);
        return antwort({ data: {} });
      }
      return antwort({ data: liste.map((x) => ({ ...x, isInherited: false })) });
    }
    if (r) return antwort({ data: [] });
    // ── Bescheinigungen (N1c) ──
    if (pfad === '/htmltemplates') {
      if (m === 'POST') {
        if (body.isGlobal !== true) return antwort({ message: 'global html template' }, 403);
        const id = naechsteVorlage++;
        vorlagen.set(id, {
          id,
          name: String(body.name),
          domainType: String(body.domainType),
          htmlFileId: null,
        });
        return antwort({ data: { id } }, 201);
      }
      return antwort({ data: [...vorlagen.values()] });
    }
    r = /^\/htmltemplates\/(\d+)(\/html)?$/.exec(pfad);
    if (r) {
      const v = vorlagen.get(Number(r[1]));
      if (!v) return antwort({}, 404);
      if (r[2]) {
        const html = v.htmlFileId === null ? undefined : dateien.get(v.htmlFileId);
        return html === undefined ? antwort({}, 404) : antwort({ data: html });
      }
      if (m === 'PATCH') {
        if (typeof body.htmlFileId === 'number') v.htmlFileId = body.htmlFileId;
        return antwort({ data: {} });
      }
      return antwort({ data: v });
    }
    r = /^\/files\/html_template\/(\d+)$/.exec(pfad);
    if (r && m === 'POST') {
      const datei = (init?.body as FormData | undefined)?.get('files[]');
      if (!(datei instanceof Blob)) return antwort({}, 400);
      return datei.text().then((html) => {
        const id = naechsteVorlage++;
        dateien.set(id, html);
        return antwort({ data: [{ id }] });
      });
    }
    r = /^\/groups\/(\d+)\/roles(?:\/(\d+))?$/.exec(pfad);
    if (r && gruppen.get(Number(r[1]))?.typ === NACHWEIS_TYP) {
      const rollen = rollenVon(Number(r[1]));
      if (r[2] && m === 'PATCH') {
        const x = rollen.find((y) => y.id === Number(r![2]));
        if (!x) return antwort({}, 404);
        if (Array.isArray(body.htmlTemplateIds))
          x.htmlTemplateIds = (body.htmlTemplateIds as unknown[]).map(Number);
        return antwort({ data: {} });
      }
      return antwort({ data: rollen });
    }
    r = /^\/groups\/(\d+)\/members\/routines$/.exec(pfad);
    if (r)
      return antwort({
        data: [...routinen.values()]
          .filter((x) => x.groupId === Number(r![1]))
          .map((x) => ({
            id: x.id,
            groupTypeRoleId: x.groupTypeRoleId,
            groupMemberStatus: x.groupMemberStatus,
            routine: { id: x.id, name: x.name, isEnabled: x.isEnabled, steps: x.steps },
          })),
      });
    if (pfad === '/routines' && m === 'POST') {
      const ctx = body.domainContext as {
        groupId: number;
        groupTypeRoleId: number;
        groupMemberStatus: string;
      };
      const id = naechsteRoutine++;
      routinen.set(id, {
        id,
        name: String(body.name),
        isEnabled: body.isEnabled === true,
        steps: [],
        groupId: ctx.groupId,
        groupTypeRoleId: ctx.groupTypeRoleId,
        groupMemberStatus: ctx.groupMemberStatus,
      });
      return antwort({ data: { id } }, 201);
    }
    r = /^\/routines\/(\d+)$/.exec(pfad);
    if (r) {
      const x = routinen.get(Number(r[1]));
      if (!x) return antwort({}, 404);
      if (m === 'PATCH') {
        if (typeof body.isEnabled === 'boolean') x.isEnabled = body.isEnabled;
        if (Array.isArray(body.steps)) x.steps = schritteNummern(body.steps as Schritt[]);
        return antwort({ data: {} });
      }
      return antwort({ data: { id: x.id, name: x.name, isEnabled: x.isEnabled, steps: x.steps } });
    }
    r = /^\/groups\/(\d+)\/members\/(\d+)$/.exec(pfad);
    if (r && gruppen.get(Number(r[1]))?.typ === NACHWEIS_TYP) {
      const liste = nachweisMitglieder.get(Number(r[1])) ?? [];
      const da = liste.find((x) => x.personId === Number(r![2]));
      if (m === 'PUT') {
        if (da) return antwort({ message: 'member.add.already-in-group' }, 403);
        liste.push({
          personId: Number(r[2]),
          groupTypeRoleId: Number(body.groupTypeRoleId),
          groupMemberStatus:
            typeof body.groupMemberStatus === 'string' ? body.groupMemberStatus : 'active',
        });
        nachweisMitglieder.set(Number(r[1]), liste);
        return antwort({ data: {} });
      }
      if (!da) return antwort({}, 404);
      if (m === 'GET')
        return antwort({
          data: {
            personId: da.personId,
            fields: Object.entries(da.fields ?? {}).map(([id, value]) => ({
              id: Number(id),
              value,
            })),
          },
        });
      if (m === 'PATCH') {
        if (typeof body.groupTypeRoleId === 'number') da.groupTypeRoleId = body.groupTypeRoleId;
        if (typeof body.groupMemberStatus === 'string')
          da.groupMemberStatus = body.groupMemberStatus;
        // Gruppenfelder (N2b: „Einsicht festhalten“): `{<Nummer>: Wert}`, `null` leert.
        for (const [nr, wert] of Object.entries((body.fields ?? {}) as Record<string, unknown>)) {
          const fields = (da.fields ?? {}) as Record<string, string>;
          if (wert === null) delete fields[nr];
          else fields[nr] = typeof wert === 'string' ? wert : JSON.stringify(wert);
          da.fields = fields;
        }
        return antwort({ data: {} });
      }
      if (m === 'DELETE') {
        nachweisMitglieder.set(
          Number(r[1]),
          liste.filter((x) => x !== da),
        );
        return antwort({}, 204);
      }
    }
    r = /^\/groups\/(\d+)\/members$/.exec(pfad);
    if (r && gruppen.get(Number(r[1]))?.typ === NACHWEIS_TYP)
      return antwort({
        data: (nachweisMitglieder.get(Number(r[1])) ?? []).map((x) => ({
          ...x,
          person: {
            domainAttributes: {
              firstName: personName(x.personId)?.firstName,
              lastName: personName(x.personId)?.lastName,
            },
          },
          fields: Object.entries(x.fields ?? {}).map(([id, value]) => ({
            id: Number(id),
            name: gruppen.get(Number(r![1]))?.felder.find((f) => f.id === Number(id))?.name,
            value,
          })),
        })),
        meta: { pagination: { lastPage: 1 } },
      });
    r = /^\/groups\/(\d+)\/followups$/.exec(pfad);
    if (r && gruppen.get(Number(r[1]))?.typ === NACHWEIS_TYP)
      return antwort({
        data: (nachweisAufgaben.get(Number(r[1])) ?? []).map((a) => ({
          groupId: Number(r![1]),
          ...a,
          effectiveDueDate: a.effectiveDueDate ?? a.dueDate ?? null,
        })),
        meta: { pagination: { lastPage: 1 } },
      });
    // N2c: Notiz an einer Folgeaufgabe (204 ohne Inhalt, wie ChurchTools) und Nachlesen.
    r = /^\/followups\/(\d+)\/notes$/.exec(pfad);
    if (r && m === 'POST') {
      const liste = aufgabenNotizen.get(Number(r[1])) ?? [];
      liste.push({ id: naechsteNotiz++, text: String(body.comment) });
      aufgabenNotizen.set(Number(r[1]), liste);
      return antwort(null, 204);
    }
    r = /^\/notes\/follow_up\/(\d+)$/.exec(pfad);
    if (r && m === 'GET')
      return antwort({
        data: (aufgabenNotizen.get(Number(r[1])) ?? []).map((x) => ({
          id: x.id,
          domainType: 'follow_up',
          domainId: Number(r![1]),
          text: x.text,
          meta: { createdDate: new Date().toISOString() },
        })),
      });
    // N2c: Rundmail über die alte Schnittstelle – hier geht NICHTS raus; das Protokoll merkt sich nur die Adressen.
    if (
      m === 'POST' &&
      url.pathname.endsWith('index.php') &&
      url.searchParams.get('q') === 'churchhome/ajax'
    ) {
      const ids = (typeof body.ids === 'string' ? body.ids : '').split(',').map(Number);
      for (const p of [...DEMO_PERSONEN, ...NACHWEIS_PERSONEN, ...FREIZEIT_PERSONEN])
        if (ids.includes(p.id) && p.email)
          mailProtokoll.push({
            date: new Date().toISOString(),
            message: `Speichere Mail an ${p.email} von Demo - ${String(body.betreff)}`,
          });
      return antwort({ status: 'success', data: {} });
    }
    // Wie bei einer Vertrauensperson ohne Admin: das Protokoll von ChurchTools ist nicht lesbar (→ „Bestätigung nicht lesbar“).
    if (pfad === '/logs')
      return fall === 'vertrauen' ? antwort({}, 403) : antwort({ data: mailProtokoll });
    // N2b: Folgeaufgabe erledigen (der Ablauf legt nach „Einsicht nehmen“ gleich „Erneut einsehen“ an) und verschieben.
    r = /^\/followups\/(\d+)\/(complete|postpone)$/.exec(pfad);
    if (r && m === 'POST') {
      for (const [gid, liste] of nachweisAufgaben) {
        const a = liste.find((x) => x.id === Number(r![1]));
        if (!a) continue;
        if (r[2] === 'postpone') {
          // Wie ChurchTools: nur auf ein Datum nach heute.
          if (String(body.dueDate) <= isoTag(0))
            return antwort({ message: 'Ungültiges Datum' }, 400);
          a.effectiveDueDate = String(body.dueDate);
        } else {
          a.doneDate = new Date().toISOString();
          if (a.title === 'Einsicht nehmen') {
            const jahre = nachweisEinstellungenLesen(gruppen.get(gid)?.note)?.gueltigJahre ?? 3;
            const neu = aufgabe(a.personId, 'Erneut einsehen', 0, null);
            neu.dueDate = isoTag(0, jahre);
            liste.push(neu);
          }
        }
        return antwort({ data: {} });
      }
      return antwort({}, 404);
    }
    r = /^\/permissions\/internal\/groups\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[1]);
      // Wie bei Alwin: Leitung im Lobpreisteam (darf anlegen und einrichten), Mitglied in Technik.
      const leitung = id === 9 || gruppen.get(id)?.parent === 9;
      return antwort({
        data: {
          churchdb: {
            '+create group': id === 9 ? [5] : 0,
            '+edit group infos': leitung,
            '+edit group basic settings': leitung,
          },
        },
      });
    }
    r = /^\/groups\/(\d+)\/children$/.exec(pfad);
    if (r) {
      return antwort({
        data: kinderVon(Number(r[1])).map(([id, x]) => ({
          title: x.name,
          domainIdentifier: String(id),
          domainAttributes: { note: x.note, groupStatusId: x.status, groupTypeId: 5 },
        })),
      });
    }
    if (pfad === '/groups' && m === 'GET' && url.searchParams.has('group_status_ids[]')) {
      const status = Number(url.searchParams.get('group_status_ids[]'));
      // Mit `group_type_ids[]` nur diese Gruppenart (N1b: die Nachweis-Arten); ohne alle, wie bisher.
      const art = url.searchParams.has('group_type_ids[]')
        ? Number(url.searchParams.get('group_type_ids[]'))
        : null;
      return antwort({
        data: [...gruppen]
          .filter(([, x]) => x.status === status && (art === null || (x.typ ?? 5) === art))
          .map(([id, x]) => gruppeRoh(id, x)),
        meta: { pagination: { lastPage: 1 } },
      });
    }
    r = /^\/groups\/(\d+)\/parents(?:\/(\d+))?$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]));
      if (!x) return antwort({}, 404);
      if (fall !== 'admin' && m !== 'GET') return antwort({ message: 'Forbidden' }, 403);
      const p = Number(r[2]);
      if (m === 'PUT') x.neuParent = p;
      if (m === 'DELETE' && x.parent === p && x.neuParent) {
        x.parent = x.neuParent;
        x.neuParent = undefined;
      }
      return antwort(
        m === 'GET'
          ? { data: [{ title: TEAMS[x.parent] ?? 'Team', domainIdentifier: String(x.parent) }] }
          : {},
        m === 'PUT' ? 201 : m === 'DELETE' ? 204 : 200,
      );
    }
    // Personensuche (Anmeldung von Hand): findet die Demo-Personen am Vor- oder Nachnamen.
    if (pfad === '/search') {
      const q = (url.searchParams.get('query') ?? '').toLowerCase();
      return antwort({
        data: DEMO_PERSONEN.filter((p) =>
          q.split(/\s+/).every((w) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(w)),
        ).map((p) => ({ domainType: 'person', domainIdentifier: String(p.id) })),
      });
    }
    if (pfad === '/persons' && m === 'GET' && url.searchParams.has('ids[]')) {
      const ids = url.searchParams.getAll('ids[]').map(Number);
      return antwort({
        data: [...DEMO_PERSONEN, ...NACHWEIS_PERSONEN, ...FREIZEIT_PERSONEN].filter((p) =>
          ids.includes(p.id),
        ),
      });
    }
    if (pfad === '/groups' && m === 'GET') {
      const ids = url.searchParams.getAll('ids[]').map(Number);
      return antwort({
        data: ids.filter((id) => gruppen.has(id)).map((id) => gruppeRoh(id, gruppen.get(id)!)),
        meta: { pagination: { lastPage: 1 } },
      });
    }
    if (pfad === '/groups' && m === 'POST') {
      const id = naechste++;
      gruppen.set(id, {
        name: String(body.name),
        parent: Number(body.parentGroupId),
        status: Number(body.groupStatusId ?? 2),
        note: '',
        settings: typeof body.visibility === 'string' ? { visibility: body.visibility } : {},
        felder: [],
        ...(Number(body.groupTypeId) === NACHWEIS_TYP ? { typ: NACHWEIS_TYP } : {}),
      });
      return antwort({ data: { id } }, 201);
    }
    r = /^\/groups\/(\d+)\/duplicate$/.exec(pfad);
    if (r) {
      const q = gruppen.get(Number(r[1]))!;
      const id = naechste++;
      gruppen.set(id, {
        ...q,
        name: String(body.newName),
        status: 2,
        settings: { ...q.settings },
        felder: q.felder.map((f) => ({ ...f, id: f.id + 1000 })),
      });
      return antwort({ data: { id } }, 201);
    }
    // Antwortmöglichkeiten bekommen IDs wie in ChurchTools (A5).
    const mitIds = (o: unknown) =>
      Array.isArray(o)
        ? (o as { id?: string; name: string }[]).map((x) => ({
            id: x.id ?? String(naechste++),
            name: x.name,
          }))
        : o;
    r = /^\/groups\/(\d+)\/memberfields\/group\/(\d+)$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      const feld = x.felder.find((f) => f.id === Number(r![2]));
      if (!feld) return antwort({}, 404);
      if (m === 'DELETE') {
        x.felder = x.felder.filter((f) => f !== feld);
        return antwort({}, 204);
      }
      Object.assign(feld, body, 'options' in body ? { options: mitIds(body.options) } : {});
      return antwort({ data: feld });
    }
    r = /^\/groups\/(\d+)\/memberfields\/person\/(\d+)$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      const key = { 4: 'street', 6: 'zip', 7: 'city' }[Number(r[2])];
      if (!key) return antwort({}, 404);
      const ohne = (x.personenfelder ?? []).filter((k) => k !== key);
      x.personenfelder = m === 'DELETE' ? ohne : [...ohne, key];
      return antwort(m === 'DELETE' ? {} : { data: {} }, m === 'DELETE' ? 204 : 200);
    }
    r = /^\/files\/groupimage\/(\d+)$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      if (m === 'DELETE') {
        x.bild = undefined;
        return antwort({}, 204);
      }
      const datei = (init?.body as FormData | undefined)?.get('files[]');
      x.bild = datei instanceof Blob ? URL.createObjectURL(datei) : undefined;
      return antwort({ data: [{ imageUrl: x.bild }] });
    }
    r = /^\/groups\/(\d+)\/memberfields(\/group)?$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      if (m === 'POST') {
        const id = naechste++;
        x.felder.push({
          ...body,
          id,
          name: String(body.name),
          note: null,
          options: mitIds(body.options),
        });
        return antwort({ data: { id } }, 201);
      }
      return antwort({
        data: [
          ...x.felder.map((f) => ({ type: 'group', field: f })),
          ...(x.personenfelder ?? []).map((key) => ({
            type: 'person',
            field: { dbField: { key } },
          })),
        ],
      });
    }
    // Verlauf (Anmeldetag, Absagen, A7): in der Demo leer – ohne ihn brach der Bereich „Anmeldungen“ mit 404 ab.
    if (/^\/groups\/\d+\/members\/history$/.test(pfad)) return antwort({ data: [] });
    r = /^\/groups\/(\d+)\/members$/.exec(pfad);
    if (r) {
      return antwort(
        MITGLIEDER[Number(r[1])] ?? { data: [], meta: { pagination: { lastPage: 0 } } },
      );
    }
    r = /^\/groups\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[1]);
      const x = gruppen.get(id);
      if (!x) return antwort({}, 404);
      if (m === 'DELETE') {
        if (fall !== 'admin') return antwort({ message: 'Forbidden' }, 403);
        gruppen.delete(id);
        return antwort({}, 204);
      }
      if (m === 'PATCH') {
        for (const [k, v] of Object.entries(body)) {
          if (k === 'note') x.note = String(v);
          else if (k === 'name') x.name = String(v);
          else if (k === 'groupStatusId') x.status = Number(v);
          else x.settings[k] = v;
        }
      }
      return antwort({ data: gruppeRoh(id, x) });
    }
    if (pfad === '/calendars') {
      return antwort({
        data: [
          { id: 2, name: 'Gottesdienst' },
          { id: 1, name: 'Sonstige Veranstaltung' },
        ],
      });
    }
    if (pfad === '/calendars/appointments')
      return antwort({ data: TERMINE.map((t) => ({ base: t })) });
    r = /^\/calendars\/(\d+)\/appointments$/.exec(pfad);
    if (r && m === 'POST') {
      // Wie ChurchTools: `name`, der veraltete Alias `meetingAt` wird noch angenommen.
      const a = body.address as { name?: string; meetingAt?: string } | null;
      const ort = a?.name ?? a?.meetingAt ?? null;
      const t = { ...body, id: naechste++, address: { name: ort } };
      TERMINE.push(t);
      return antwort({ data: { id: t.id } }, 201);
    }
    r = /^\/calendars\/(\d+)\/appointments\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[2]);
      return antwort({ data: { appointment: { base: TERMINE.find((t) => t.id === id) } } });
    }
    // Datenbereich der Erweiterung (A6-2): die Einstellungen der Gemeinde. Vorbelegt mit einer Formular-
    // Adresse, damit die Startseite zu sehen ist; `?demo=einrichten` zeigt den Zustand davor.
    // Stammdaten für die Vorgaben neuer Personen (gemessen 14.10.2026 in der Test-Instanz).
    if (pfad === '/statuses')
      return antwort({
        data: [
          { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
          { id: 3, name: 'status.member', nameTranslated: 'Mitglied', isMember: true },
        ],
      });
    if (pfad === '/campuses') return antwort({ data: [{ id: 0, name: 'Zentrale' }] });
    if (pfad === '/departments') return antwort({ data: [{ id: 1, name: 'Gemeindeliste' }] });
    if (pfad === '/config')
      return antwort({
        data: { access_control_allow_origins: '["https://anmeldung.beispiel.de"]' },
      });
    if (pfad === '/custommodules') return antwort({ data: [{ id: 7, shorty: 'anmeldungen' }] });
    if (pfad === '/custommodules/7/customdatacategories') {
      if (m === 'POST') {
        const id = 50 + DATEN.kategorien.length;
        DATEN.kategorien.push({ id, shorty: String(body.shorty) });
        return antwort({ data: { id } }, 201);
      }
      return antwort({ data: DATEN.kategorien });
    }
    r = /^\/custommodules\/7\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
      pfad,
    );
    if (r) {
      const kategorie = Number(r[1]);
      if (m === 'POST')
        DATEN.werte.push({ id: naechste++, dataCategoryId: kategorie, value: String(body.value) });
      if (m === 'PUT') {
        const w = DATEN.werte.find((x) => x.id === Number(r[2]));
        if (w) w.value = String(body.value);
      }
      return antwort(
        { data: m === 'GET' ? DATEN.werte.filter((w) => w.dataCategoryId === kategorie) : {} },
        m === 'POST' ? 201 : 200,
      );
    }
    return antwort({}, 404);
  };
}

/** Was die Demo im Datenbereich der Erweiterung hält (`?demo=einrichten`: noch nichts). */
const DATEN: {
  kategorien: { id: number; shorty: string }[];
  werte: { id: number; dataCategoryId: number; value: string }[];
} = {
  // 51: die Ablage „Nachweis-Stand“ (N3a) – die Demo schreibt dort beim Öffnen der Seite „Nachweise“.
  kategorien: [
    { id: 50, shorty: 'anmeldungen-einstellungen' },
    { id: 51, shorty: NACHWEIS_STAND_KATEGORIE.kuerzel },
  ],
  werte: [
    {
      id: 1,
      dataCategoryId: 50,
      value: JSON.stringify({
        art: 'anmeldungen-einstellungen',
        fassung: 1,
        neuePersonen: { statusId: 2, campusId: 0, departmentId: 1 },
        formularAdresse: 'https://anmeldung.beispiel.de/',
      }),
    },
  ],
};
