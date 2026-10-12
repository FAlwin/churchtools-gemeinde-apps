/**
 * **Nur zum Entwickeln** (`npm run dev -w anmeldungen`, dann `…/ccm/anmeldungen/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (12.10.2026), damit
 * die Seite ohne Instanz zu sehen ist. `?demo=leer` zeigt „keine Gruppen", `?demo=fehler` den
 * Fehlerfall. Wird nie mitgebaut (siehe `main.tsx`).
 *
 * Die Beschreibungen entstehen mit `einstellungenAlsText` – wie im Betrieb.
 */
import {
  einstellungenAlsText,
  standardFormular,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';

function beschreibung(
  beginn: string,
  ende: string | null,
  ort: string,
  grundpreis: OeffentlicheEinstellungen['preis']['grundpreis'],
  bezahlt?: number,
): string {
  return einstellungenAlsText({
    termin: { beginn, ende, ort, terminId: null },
    preis: { grundpreis, alter: [], anpassungen: [], extras: [] },
    formular: standardFormular(),
    gestaltung: {
      vorlage: 'klassisch',
      farbe: '#2563eb',
      feldstil: 'kasten',
      knoepfe: 'rund',
      text: '',
      gemeindename: true,
    },
    ctFelder: bezahlt ? { bezahlt } : {},
    wer: 'familie',
    plaetze: { zeigen: 'knapp', knappUnter: 5 },
  });
}

const fest = (betragCent: number) => ({
  art: 'fest' as const,
  betragCent,
  gilt: 'person' as const,
  auswahlName: '',
  optionen: [],
});

const kind = (id: number, title: string, note: string, groupStatusId = 1) => ({
  title,
  domainIdentifier: String(id),
  domainAttributes: { note, groupStatusId },
});

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

/** Ein Jahr vor/nach heute, damit die Demo nie veraltet. */
function tag(abHeute: number, uhr = '19:00'): string {
  const d = new Date(Date.now() + abHeute * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${uhr}`;
}

const DATEN: Record<string, unknown> = {
  '/api/whoami': { data: { id: 1, firstName: 'Alwin' } },
  '/api/persons/1/groups': {
    data: [
      {
        group: { title: 'Technik', domainIdentifier: '7' },
        groupTypeRoleId: 15,
        groupMemberStatus: 'active',
      },
      {
        group: { title: 'Lobpreisteam', domainIdentifier: '9' },
        groupTypeRoleId: 16,
        groupMemberStatus: 'active',
      },
      {
        group: { title: 'Gemeindeessen', domainIdentifier: '20' },
        groupTypeRoleId: 17,
        groupMemberStatus: 'active',
      },
    ],
  },
  '/api/group/roles': {
    data: [
      { id: 16, name: 'Leiter', isLeader: true },
      { id: 17, name: 'Co-Leiter', isLeader: true },
      { id: 15, name: 'Mitarbeiter', isLeader: false },
    ],
  },
  '/api/info': { siteName: 'Evangeliumschristen- Gemeinde e.V.' },
  '/api/groups/hierarchies': {
    data: [
      { groupId: 9, children: [40, 43, 46] },
      { groupId: 7, children: [49, 52, 60] },
      { groupId: 20, children: [] },
    ],
  },
  '/api/groups/9/children': {
    data: [
      kind(40, 'Lobpreisabend', beschreibung(tag(20), null, 'Gemeindesaal', fest(0))),
      kind(
        43,
        'Worship-Workshop',
        beschreibung(tag(54, '10:00'), null, 'Gemeindesaal', fest(1500), 70),
        2,
      ),
      kind(
        46,
        'Lobpreisfreizeit',
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
              { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 8, belegt: 0 },
              { name: '2-Bett-Zimmer', preisCent: 8900, kontingent: 4, belegt: 0 },
            ],
          },
          73,
        ),
      ),
    ],
  },
  '/api/groups/7/children': {
    data: [
      kind(49, 'Technik-Schulung', beschreibung(tag(-23, '10:00'), null, 'Technikraum', fest(0))),
      kind(
        52,
        'Tontechnik-Grundkurs',
        beschreibung(tag(33, '09:30'), null, 'Gemeindesaal', fest(1200), 73),
      ),
    ],
  },
  '/api/groups/20/children': { data: [] },
  '/api/groups': {
    data: [
      {
        id: 40,
        settings: { maxMembers: 6, signUpOpeningDate: tag(-11), signUpClosingDate: tag(18) },
      },
      { id: 43, settings: { maxMembers: 20 } },
      {
        id: 46,
        settings: { maxMembers: 20, signUpOpeningDate: tag(-27), signUpClosingDate: tag(29) },
      },
      { id: 49, settings: { maxMembers: 10 } },
      { id: 52, settings: { maxMembers: 12, signUpOpeningDate: tag(8) } },
    ],
    meta: { pagination: { lastPage: 1 } },
  },
  '/api/groups/40/members': mitglieder([null, null, null, null, null], 2),
  '/api/groups/46/members': mitglieder(['1', '0', '0', '0']),
  '/api/groups/52/members': mitglieder(['0', '0']),
};

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  window.fetch = (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname;
    if (fall === 'fehler' && pfad.endsWith('/children')) {
      return Promise.resolve(new Response('{}', { status: 502 }));
    }
    const daten =
      fall === 'leer' && pfad.endsWith('/persons/1/groups') ? { data: [] } : DATEN[pfad];
    return Promise.resolve(
      daten === undefined
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify(daten), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  };
}
