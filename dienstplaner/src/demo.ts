/**
 * **Nur zum Entwickeln** (`npm run dev -w dienstplaner`, dann `…/ccm/dienstplaner/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (12. und 13.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Planer-Recht,
 * `?demo=fehler` den Fehlerfall. Wird nie mitgebaut (siehe `main.tsx`).
 */
const PLANER = {
  view: true,
  'view servicegroup': [1, 3, 4],
  'edit servicegroup': [3, 4],
  'edit agenda': [1, 2, 3, 4, 5],
  'manage absent': true,
};
const MITGLIED = {
  view: false,
  'view servicegroup': [],
  'edit servicegroup': [],
  'edit agenda': [],
  'manage absent': false,
};

/** Ein Zeitpunkt `tage` nach heute um `uhr` (UTC), damit die Demo nie veraltet. */
function zeit(tage: number, uhr: string): string {
  const d = new Date(Date.now() + tage * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${uhr}:00Z`;
}

/** Plätze wie gemessen (Live, 13.10.2026): frei = ohne Namen; `isAccepted` = zugesagt. Jeder Platz hat eine ID,
 * die sich wie in ChurchTools bei jedem Schreiben ändert (E0). */
let naechstePlatzId = 700;
const platz = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  isAccepted = false,
) => ({
  id: naechstePlatzId++,
  serviceId,
  index: null as number | null,
  personId,
  name,
  isAccepted,
});

const TERMINE = [
  {
    id: 101,
    name: 'Gottesdienst',
    startDate: zeit(4, '08:00'),
    endDate: zeit(4, '10:00'),
    eventServices: [
      platz(1, 19, 'Spike', true),
      platz(6, 1, 'Alwin', true),
      platz(7, null, null),
      platz(9, 1, 'Alwin'),
      platz(9, 19, 'Spike', true),
    ],
  },
  {
    id: 102,
    name: 'Gebetsabend',
    startDate: zeit(7, '17:00'),
    endDate: zeit(7, '18:30'),
    eventServices: [platz(6, 19, 'Spike', true)],
  },
  {
    id: 103,
    name: 'Gottesdienst',
    startDate: zeit(11, '08:00'),
    endDate: zeit(11, '10:00'),
    eventServices: [platz(6, null, null), platz(7, null, null), platz(9, 19, 'Spike')],
  },
  {
    id: 104,
    name: 'Gemeindeversammlung',
    startDate: zeit(16, '17:00'),
    endDate: zeit(16, '19:00'),
    isCanceled: true,
    eventServices: [] as ReturnType<typeof platz>[],
  },
  {
    id: 105,
    name: 'Gebetsabend',
    startDate: zeit(21, '17:00'),
    endDate: zeit(21, '18:30'),
    eventServices: [platz(7, 1, 'Alwin', true)],
  },
  {
    id: 106,
    name: 'Gottesdienst',
    startDate: zeit(39, '09:00'),
    endDate: zeit(39, '11:00'),
    eventServices: [platz(6, 19, 'Spike', true), platz(7, 1, 'Alwin', true), platz(9, null, null)],
  },
].map((t) => ({
  ...t,
  // Wie ChurchTools: Jeder Termin nennt seinen Kalender – ohne ihn scheiterte „Ablauf anlegen“ in der Matrix-Demo
  // („Kalender unbekannt“, gefunden beim Durchklicken von E6-6b).
  calendar: { title: 'Gottesdienste', domainIdentifier: '1' },
}));
// Wie ChurchTools: Hat ein Dienst mehrere Plätze, sind sie durchgezählt (1, 2, …), sonst `null`.
function durchzaehlen(t: (typeof TERMINE)[number]) {
  for (const p of t.eventServices) {
    const gleiche = t.eventServices.filter((q) => q.serviceId === p.serviceId);
    p.index = gleiche.length > 1 ? gleiche.indexOf(p) + 1 : null;
  }
}
TERMINE.forEach(durchzaehlen);

/** Namen, die ChurchTools beim Einteilen an den Platz schreibt (Personen aus „Wer kann?“). */
const NAMEN: Record<number, string> = {
  1: 'Alwin',
  19: 'Spike',
  46: 'Anna Klassen',
  49: 'Ben Wiebe',
  52: 'Clara Dyck',
  55: 'David Penner',
};

/**
 * Einteilen (E4-4) wie gemessen: `PUT …/servicerequests/{platz}` mit Person bzw. Name, `POST …/decline` leert;
 * jedes Schreiben vergibt dem Platz eine **neue ID**, eine veraltete ID ändert nichts. Gesendet wird an
 * Anna, Ben, … – die Demo verschickt natürlich nichts.
 */
function einteilenDemo(methode: string, pfad: string, rumpf: unknown): unknown {
  const termin = /^\/api\/events\/(\d+)$/.exec(pfad);
  if (termin && methode === 'GET') {
    // 90: ein vergangener Termin (nicht in der Liste „ab heute“); 91 gibt es nicht → 404 (gemessen).
    const t =
      TERMINE.find((x) => x.id === Number(termin[1])) ??
      (Number(termin[1]) === 90
        ? { id: 90, name: 'Gottesdienst', startDate: zeit(-10, '08:00'), eventServices: [] }
        : undefined);
    return t ? { data: t } : undefined;
  }
  // Anzahl der Plätze (E4-5-3), wie gemessen: mehr → neue freie Plätze, weniger → leere zuerst weg.
  const anzahl = /^\/api\/events\/(\d+)\/eventservices$/.exec(pfad);
  if (anzahl && methode === 'PUT') {
    const t = TERMINE.find((x) => x.id === Number(anzahl[1]));
    const r = rumpf as { services: { serviceId: number; count: number }[] };
    if (t) {
      for (const { serviceId, count } of r.services) {
        const eigene = () => t.eventServices.filter((q) => q.serviceId === serviceId);
        while (eigene().length < count) t.eventServices.push(platz(serviceId, null, null));
        for (const q of [...eigene()].reverse()) {
          if (eigene().length <= count) break;
          if (!q.name) t.eventServices.splice(t.eventServices.indexOf(q), 1);
        }
      }
      durchzaehlen(t);
    }
    return { data: null };
  }
  const m = /^\/api\/events\/(\d+)\/servicerequests\/(\d+)(\/decline)?$/.exec(pfad);
  if (!m) return undefined;
  const p = TERMINE.find((x) => x.id === Number(m[1]))?.eventServices.find(
    (q) => q.id === Number(m[2]),
  );
  if (p) {
    const r = (m[3] ? { personId: null, name: null, isAccepted: false } : rumpf) as {
      personId: number | null;
      name: string | null;
      isAccepted: boolean;
    };
    Object.assign(p, {
      id: naechstePlatzId++,
      personId: r.personId,
      name: r.personId === null ? r.name : (NAMEN[r.personId] ?? `Person ${r.personId}`),
      isAccepted: r.isAccepted,
    });
  }
  return { data: null };
}

/**
 * „Wer kann?“ in der Form, die E4-0 gemessen hat (`possiblepersons`): Punkte mit Begründungen, Auslastung je
 * Monat, Abwesenheit mit Grund, Dienste am selben Tag. Ben hat einen „Hat zuvor abgesagt“-Abzug – der darf
 * ihn nicht nach unten schieben (Alwin, 14.10.2026).
 */
function werKannDemo(eventId: number): unknown {
  const t = TERMINE.find((x) => x.id === eventId);
  const monat = (t?.startDate ?? zeit(0, '08:00')).slice(0, 7);
  const person = (id: number, vorname: string, nachname: string) => ({
    title: `${vorname} ${nachname}`,
    domainIdentifier: String(id),
    domainAttributes: { firstName: vorname, lastName: nachname },
  });
  const k = (
    p: ReturnType<typeof person>,
    o: { score?: number; hints?: object[]; monat?: number; abwesend?: string; amTag?: string[] },
  ) => ({
    person: p,
    score: o.score ?? 0,
    scoreHints: o.hints ?? [],
    monthlyUtilization: o.monat ? { [monat]: o.monat } : {},
    absences: o.abwesend
      ? [{ absenceReason: { nameTranslated: o.abwesend }, comment: 'privat – wird nicht gezeigt' }]
      : [],
    servicesOnSameDay: (o.amTag ?? []).map((serviceName) => ({ eventService: { serviceName } })),
    servicesPreviouslyDeclined: [],
  });
  return {
    data: [
      k(person(46, 'Anna', 'Klassen'), { score: -3, monat: 1 }),
      k(person(49, 'Ben', 'Wiebe'), {
        score: -500,
        hints: [
          {
            score: -500,
            reason: 'service.previously-declined',
            nameTranslated: 'Hat zuvor abgesagt',
          },
        ],
      }),
      k(person(52, 'Clara', 'Dyck'), { score: -9, monat: 3 }),
      k(person(55, 'David', 'Penner'), { score: -1000, abwesend: 'Urlaub' }),
      k(person(1, 'Alwin', 'Friesen'), { score: -253, monat: 1, amTag: ['Ton'] }),
      k(person(19, 'Spike', 'Musiker'), { score: -6, monat: 2 }),
    ],
  };
}

function daten(fall: string): Record<string, unknown> {
  return {
    '/api/whoami': { data: { id: 1, firstName: fall === 'mitglied' ? 'Spike' : 'Alwin' } },
    '/api/persons/1/groups': {
      data: [
        {
          group: { title: 'Technik', domainIdentifier: '7' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
        },
        {
          group: { title: 'Lobpreisteam', domainIdentifier: '9' },
          groupTypeRoleId: 15,
          groupMemberStatus: 'active',
        },
      ],
    },
    '/api/group/roles': {
      data: [
        { id: 16, name: 'Leiter', isLeader: true },
        { id: 15, name: 'Mitarbeiter', isLeader: false },
      ],
    },
    '/api/info': { siteName: 'Evangeliumschristen- Gemeinde e.V.' },
    '/api/permissions/global': {
      data: {
        churchcore: { 'administer persons': fall !== 'mitglied' },
        churchservice: fall === 'mitglied' ? MITGLIED : PLANER,
      },
    },
    // Abwesend am Tag der offenen Anfrage (Gesang, erster Gottesdienst) – die Startseite warnt.
    '/api/persons/1/absences': {
      data: [
        { id: 1, startDate: zeit(4, '00:00').slice(0, 10), endDate: zeit(4, '00:00').slice(0, 10) },
        {
          id: 2,
          startDate: zeit(30, '00:00').slice(0, 10),
          endDate: zeit(33, '00:00').slice(0, 10),
        },
      ],
    },
    '/api/services': {
      data: [
        // Predigt (Programm): der Demo-Planer darf sie nur ansehen – zeigt „nur ansehen“ (16.10.2026).
        { id: 1, name: 'Predigt', serviceGroupId: 1, groupIds: [] },
        { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
        { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
        { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
      ],
    },
    '/api/servicegroups': {
      data: [
        { id: 1, name: 'Programm', nameTranslated: 'Programm', sortKey: 10 },
        { id: 3, name: 'Technik', nameTranslated: 'Technik', sortKey: 30 },
        { id: 4, name: 'Musik', nameTranslated: 'Musik', sortKey: 40 },
      ],
    },
  };
}

/** Eine Ablauf-Vorlage wie in der Test-Instanz (Vorlage 28, E6-5b). */
const VORLAGEN = [
  {
    id: 28,
    name: 'Gottesdienst',
    calendarId: 1,
    items: [
      { title: 'Ankommen', duration: 600 },
      { title: 'Lobpreis', duration: 1200 },
      { title: 'Begrüßung', duration: 300 },
      { title: 'Predigt', duration: 1800 },
      { title: 'Segen', duration: 300 },
    ],
  },
];

/** Ein einzelner Termin (E6-5b: Name des verbundenen Termins in der Nachfrage). */
function einTermin(id: number): { data: unknown } | undefined {
  const t = TERMINE.find((x) => x.id === id);
  return t && { data: t };
}

/** Wie ChurchTools: nur Termine ab `from` (Tag) und vor `to` (Tag, ausgeschlossen) – sonst stimmt „Oktober“ nicht. */
function termineVonBis(von: string | null, bis: string | null) {
  return TERMINE.filter(
    (t) => (!von || t.startDate.slice(0, 10) >= von) && (!bis || t.startDate.slice(0, 10) < bis),
  );
}

type DemoPunkt = { id: number; duration?: number; ausgeblendet?: boolean } & Record<
  string,
  unknown
>;

/**
 * **Der Ablauf des dritten Termins** (103, Gottesdienst eine Woche später) – seit E6-6b, damit sich in der Matrix ein
 * Punkt in einen anderen Termin ziehen lässt. Punkt-IDs eigene als in 101 (in ChurchTools sind sie überall eindeutig).
 */
const ABLAUF_103: DemoPunkt[] = [
  { id: 21, type: 'normal', title: 'Gebet', duration: 600 },
  { id: 22, type: 'song', title: 'Way Maker', duration: 300, song: { title: 'Way Maker' } },
  { id: 23, type: 'normal', title: 'Segen', duration: 300 },
];

/**
 * **Der Ablauf des ersten Termins** (101) – zum Ansehen und, seit E6-3a, zum Bearbeiten; seit E6-6b auch 103
 * (`ABLAUF_103`). Die anderen Termine haben keinen („Noch kein Ablauf“, ChurchTools: 404). Wie gemessen (E6-0): `startTimes` je Termin, Dauer in Sekunden,
 * `isBeforeEvent` für den Vorlauf, Zuständige aufgelöst; der Termin beginnt um 08:00 UTC. Die Uhrzeiten rechnet die
 * Demo wie ChurchTools aus Reihenfolge, Dauer und Beginn-Grenze; ein ausgeblendeter Punkt („Abkündigungen“) hat
 * keine Zeit und zählt nicht mit (E6-3-0). Geändert wird nur im Speicher.
 *
 * „Neu aufsetzen“ (E6-5b): Vorlage und leer wie gemessen – neue Punkt-IDs, gleicher Ablauf. Mit `?demo=geteilt` teilt
 * sich 101 den Ablauf mit 102 (eine Spalte `startTimes` je Termin), damit die Nachfrage mit zwei Wegen zu sehen ist.
 */
function ablaufDemo(
  fall: string,
  termin = 101,
  tage = 4,
  anfang?: DemoPunkt[],
  naechsteIdAnfang = 50,
) {
  type Punkt = DemoPunkt;
  let punkte: Punkt[] = anfang ?? [
    {
      id: 5,
      type: 'normal',
      title: 'Soundcheck',
      duration: 1800,
      responsible: {
        text: '[Ton]',
        persons: [{ service: '[Ton]', person: { title: 'Alwin Friesen' } }],
      },
    },
    { id: 1, type: 'header', title: 'Ankommen' },
    {
      id: 2,
      type: 'song',
      title: 'Lied',
      duration: 300,
      song: { title: 'Halleluja' },
      responsible: { text: '[Gesang]', persons: [{ service: '[Gesang]', person: null }] },
    },
    { id: 3, type: 'song', title: 'Treu', duration: 300, song: { title: 'Treu' } },
    {
      id: 4,
      type: 'normal',
      title: 'Predigt',
      duration: 1800,
      note: 'Thema: Psalm 23',
      responsible: { text: 'Gastprediger' },
    },
    { id: 6, type: 'normal', title: 'Abkündigungen', duration: 300, ausgeblendet: true },
  ];
  let beginnPos = 1;
  let naechsteId = naechsteIdAnfang;
  const PFAD = `/api/events/${termin}/agenda`;

  function lesen(): unknown {
    const beginn = Date.parse(zeit(tage, '08:00'));
    const zeiten = new Map<number, string | null>();
    // Vorlauf rückwärts vom Beginn, danach vorwärts.
    let t = beginn;
    // Nach dem Leeren steht die Grenze hinter dem letzten Punkt – wie ChurchTools nicht darüber hinaus.
    for (let i = Math.min(beginnPos, punkte.length) - 1; i >= 0; i--) {
      const p = punkte[i];
      if (p.ausgeblendet) continue;
      t -= (p.duration ?? 0) * 1000;
      zeiten.set(p.id, new Date(t).toISOString());
    }
    t = beginn;
    for (const p of punkte.slice(beginnPos)) {
      if (p.ausgeblendet) continue;
      zeiten.set(p.id, new Date(t).toISOString());
      t += (p.duration ?? 0) * 1000;
    }
    return {
      calendarId: 1,
      eventStartPosition: beginnPos,
      isLocked: false,
      items: punkte.map(({ ausgeblendet: _a, ...p }, i) => ({
        ...p,
        position: i,
        isBeforeEvent: i < beginnPos,
        startTimes:
          fall === 'geteilt' && termin === 101
            ? { '101': zeiten.get(p.id) ?? null, '102': zeiten.get(p.id) ?? null }
            : { [String(termin)]: zeiten.get(p.id) ?? null },
      })),
    };
  }

  /** `responsible` schreibt ChurchTools als Text und liefert es aufgelöst zurück – die Demo nur als Text. */
  function felder(r: Record<string, unknown>): Record<string, unknown> {
    const f: Record<string, unknown> = {};
    for (const k of ['title', 'note', 'duration'] as const) if (r[k] !== undefined) f[k] = r[k];
    if (typeof r.responsible === 'string') f.responsible = { text: r.responsible };
    return f;
  }

  return {
    anfrage(
      methode: string,
      pfad: string,
      rumpf: unknown,
      suche = new URLSearchParams(),
    ): { status: number; data?: unknown } | null {
      if (pfad === '/api/agendatemplates') return { status: 200, data: VORLAGEN };
      const vorlage = /^\/api\/agendatemplates\/(\d+)$/.exec(pfad);
      if (vorlage) {
        const v = VORLAGEN.find((x) => x.id === Number(vorlage[1]));
        return v ? { status: 200, data: v } : { status: 404 };
      }
      if (!pfad.startsWith(PFAD)) return null;
      const r = (rumpf ?? {}) as Record<string, unknown>;
      const punkt = /^\/items\/(\d+)$/.exec(pfad.slice(PFAD.length));
      if (pfad === PFAD && methode === 'GET') return { status: 200, data: lesen() };
      if (pfad === PFAD && methode === 'PUT' && suche.has('template_id')) {
        const v = VORLAGEN.find((x) => x.id === Number(suche.get('template_id')));
        if (!v) return { status: 404 };
        punkte = v.items.map((i) => ({ id: naechsteId++, type: 'normal', ...i }));
        beginnPos = 0;
        return { status: 200, data: lesen() };
      }
      if (pfad === PFAD && methode === 'PUT') {
        if (Array.isArray(r.items)) {
          const ids = (r.items as { id: number }[]).map((i) => i.id);
          punkte = ids.map((id) => punkte.find((p) => p.id === id)).filter((p) => p !== undefined);
        }
        if (typeof r.eventStartPosition === 'number') beginnPos = r.eventStartPosition;
        return { status: 200, data: lesen() };
      }
      if (pfad === `${PFAD}/items` && methode === 'POST') {
        const typ = r.type === 'text' ? 'normal' : r.type;
        const neu: Punkt = { id: naechsteId++, type: typ, duration: 0, ...felder(r) };
        punkte = [...punkte, neu];
        return { status: 201, data: neu };
      }
      // Auge (E6-3b): wie gemessen 204, ein zweites Mal ist harmlos.
      const auge = /^\/items\/(\d+)\/(hide|unhide)$/.exec(pfad.slice(PFAD.length));
      if (auge && methode === 'POST') {
        const id = Number(auge[1]);
        if (!punkte.some((p) => p.id === id)) return { status: 404 };
        punkte = punkte.map((p) => (p.id === id ? { ...p, ausgeblendet: auge[2] === 'hide' } : p));
        return { status: 204 };
      }
      if (punkt) {
        const id = Number(punkt[1]);
        if (!punkte.some((p) => p.id === id)) return { status: 404 };
        if (methode === 'DELETE') {
          // Die Beginn-Grenze zieht ChurchTools nicht mit (gemessen 12.10.2026) – der Schreibkern schreibt sie nach.
          punkte = punkte.filter((p) => p.id !== id);
          return { status: 204 };
        }
        if (methode === 'PUT') {
          punkte = punkte.map((p) => (p.id === id ? { ...p, ...felder(r) } : p));
          return { status: 200, data: null };
        }
      }
      return { status: 404 };
    },
  };
}

/**
 * Der Speicher der Erweiterung (Entwürfe, E4-3) – wie gemessen: Kategorien je Modul, Werte als Text, wer
 * eine Kategorie anlegt, bekommt sofort alle Rechte darauf. Musik hat schon eine Schublade mit einem
 * Entwurf von Spike; für Technik zeigt „Einrichten“, wie es beim ersten Mal aussieht.
 */
function speicherDemo(fall: string) {
  const kategorien = [{ id: 40, shorty: 'dienstplaner-entwuerfe-4', name: 'Entwürfe Musik' }];
  const spike = {
    art: 'dienstplaner-entwurf',
    fassung: 1,
    ort: { eventId: 106, serviceId: 9, index: null },
    ziel: { art: 'person', personId: 46, name: 'Anna Test' },
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: { personId: 19, name: 'Spike' },
    zeit: zeit(0, '07:00'),
    version: 1,
  };
  // Veraltet (E4-3-3): eingetragen, als Gesang am Termin 103 frei war – inzwischen ist dort Spike angefragt.
  const veraltet = {
    ...spike,
    ort: { eventId: 103, serviceId: 9, index: null },
    ziel: { art: 'person', personId: 47, name: 'Finn Test' },
    von: { personId: 1, name: 'Alwin' },
  };
  // E4-5: am ersten Gottesdienst Alwins Anfrage (Gesang 1) zurückziehen (von Spike) und Spike (Gesang 2, zugesagt)
  // durch Clara ersetzen.
  const zurueck = {
    ...spike,
    ort: { eventId: 101, serviceId: 9, index: 1 },
    ziel: { art: 'frei' },
    gesehen: { art: 'anfrage', personId: 1 },
  };
  const ersetzen = {
    ...spike,
    ort: { eventId: 101, serviceId: 9, index: 2 },
    ziel: { art: 'person', personId: 52, name: 'Clara Dyck' },
    gesehen: { art: 'zusage', personId: 19 },
    von: { personId: 1, name: 'Alwin' },
  };
  const alt = (eventId: number, index: number | null, name: string, personId: number) => ({
    ...spike,
    ort: { eventId, serviceId: 9, index },
    ziel: { art: 'person', personId, name },
  });
  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [
      40,
      [
        { id: 400, dataCategoryId: 40, value: JSON.stringify(spike) },
        { id: 401, dataCategoryId: 40, value: JSON.stringify(veraltet) },
        { id: 402, dataCategoryId: 40, value: JSON.stringify(zurueck) },
        { id: 403, dataCategoryId: 40, value: JSON.stringify(ersetzen) },
        // #582: ohne Platz (103 hat nur einen Gesang-Platz, ohne Nummer), Dienst nicht mehr im Termin (102),
        // Termin vorbei (90) und gelöscht (91).
        { id: 404, dataCategoryId: 40, value: JSON.stringify(alt(103, 1, 'Ben Wiebe', 49)) },
        { id: 405, dataCategoryId: 40, value: JSON.stringify(alt(102, null, 'Clara Dyck', 52)) },
        { id: 406, dataCategoryId: 40, value: JSON.stringify(alt(90, null, 'Anna Klassen', 46)) },
        { id: 407, dataCategoryId: 40, value: JSON.stringify(alt(91, null, 'David Penner', 55)) },
      ],
    ],
  ]);
  let naechste = 500;
  const ids = () => kategorien.map((k) => k.id);
  const rechte = () =>
    fall === 'mitglied'
      ? {}
      : {
          view: true,
          'create custom category': true,
          'view custom category': ids(),
          'view custom data': ids(),
          'create custom data': ids(),
          'edit custom data': ids(),
          'delete custom data': ids(),
        };
  /** Antwort auf eine Anfrage an den Speicher – `undefined`, wenn sie nicht dorthin geht. */
  const anfrage = (
    methode: string,
    pfad: string,
    rumpf: unknown,
  ): { status: number; data?: unknown } | undefined => {
    if (pfad === '/api/custommodules') {
      return {
        status: 200,
        data: [
          { id: 10, shorty: 'musik-app', name: 'Musik App' },
          { id: 16, shorty: 'dienstplaner', name: 'Dienstplaner' },
        ],
      };
    }
    if (pfad === '/api/custommodules/16/customdatacategories') {
      if (methode === 'GET') return { status: 200, data: kategorien };
      const r = rumpf as { name: string; shorty: string };
      const k = { id: naechste++, shorty: r.shorty, name: r.name };
      kategorien.push(k);
      werte.set(k.id, []);
      return { status: 201, data: k };
    }
    const m =
      /^\/api\/custommodules\/16\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (!m) return undefined;
    const liste = werte.get(Number(m[1]));
    if (!liste) return { status: 404 };
    if (methode === 'GET') return { status: 200, data: liste };
    if (methode === 'POST') {
      const w = {
        id: naechste++,
        dataCategoryId: Number(m[1]),
        value: (rumpf as { value: string }).value,
      };
      liste.push(w);
      return { status: 201, data: w };
    }
    const i = liste.findIndex((w) => w.id === Number(m[2]));
    if (i < 0) return { status: 404 };
    if (methode === 'PUT') liste[i] = { ...liste[i], value: (rumpf as { value: string }).value };
    else liste.splice(i, 1);
    return { status: methode === 'PUT' ? 200 : 204 };
  };
  return { anfrage, rechte };
}

/** Vorlieben der Demo (E5-3): je Gruppe je Person die Zeile, wie `getServiceGroupPersonWeight` sie liefert. */
const vorliebenDemoSpeicher = new Map<
  string,
  Record<string, Record<string, Record<string, string>>>
>();
function vorliebenDemo(f: URLSearchParams): unknown {
  const g = f.get('servicegroup_id') ?? '';
  const zeilen = vorliebenDemoSpeicher.get(g) ?? {};
  if (f.get('func') === 'editServiceGroupPersonWeight') {
    const pid = f.get('person_id') ?? '';
    zeilen[pid] = {
      [g]: {
        person_id: pid,
        servicegroup_id: g,
        max_per_month: f.get('max_per_month') ?? '4',
        relation_weight: f.get('relation_weight') ?? '0',
        morning_weight: f.get('morning_weight') ?? '0',
      },
    };
    vorliebenDemoSpeicher.set(g, zeilen);
    return null;
  }
  return Object.keys(zeilen).length ? zeilen : [];
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const antworten = daten(fall);
  const speicher = speicherDemo(fall);
  const ablaeufe = [ablaufDemo(fall), ablaufDemo(fall, 103, 11, ABLAUF_103, 80)];
  const mitDienstplanerRechten = (roh: unknown) => {
    const r = roh as { data: Record<string, unknown> };
    return { data: { ...r.data, dienstplaner: speicher.rechte() } };
  };
  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const methode = init?.method ?? 'GET';
    const rumpf = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const s =
      speicher.anfrage(methode, url.pathname, rumpf) ??
      ablaeufe.reduce<ReturnType<(typeof ablaeufe)[number]['anfrage']>>(
        (r, a) => r ?? a.anfrage(methode, url.pathname, rumpf, url.searchParams),
        null,
      );
    if (s) {
      return Promise.resolve(
        new Response(s.status === 204 ? null : JSON.stringify({ data: s.data ?? null }), {
          status: s.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    // Alte Schnittstelle (E5-3, Stift): Vorlieben je Gruppe – wie gemessen, alles Zeichenketten.
    if (url.pathname === '/index.php' && init?.body instanceof URLSearchParams) {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'success', data: vorliebenDemo(init.body) }), {
          status: 200,
        }),
      );
    }
    if (url.pathname === '/api/csrftoken') {
      return Promise.resolve(new Response(JSON.stringify({ data: 'demo' }), { status: 200 }));
    }
    if (fall === 'fehler' && url.pathname.endsWith('/servicegroups')) {
      return Promise.resolve(new Response('{}', { status: 502 }));
    }
    const werKann = /^\/api\/events\/(\d+)\/services\/\d+\/possiblepersons$/.exec(url.pathname);
    const eingeteilt = einteilenDemo(
      methode,
      url.pathname,
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    );
    if (eingeteilt && methode !== 'GET') {
      // Wie ChurchTools etwas Zeit lassen, damit der Fortschritt im Senden-Fach zu sehen ist.
      return new Promise((fertig) =>
        setTimeout(() => fertig(new Response(JSON.stringify(eingeteilt), { status: 200 })), 600),
      );
    }
    const d = eingeteilt
      ? eingeteilt
      : werKann
        ? werKannDemo(Number(werKann[1]))
        : /^\/api\/events\/\d+$/.test(url.pathname)
          ? einTermin(Number(url.pathname.split('/').pop()))
          : url.pathname === '/api/events'
            ? { data: termineVonBis(url.searchParams.get('from'), url.searchParams.get('to')) }
            : url.pathname === '/api/permissions/global'
              ? mitDienstplanerRechten(antworten[url.pathname])
              : antworten[url.pathname];
    return Promise.resolve(
      d === undefined
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify(d), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  };
}
