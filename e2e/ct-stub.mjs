/**
 * ChurchTools-Stub für den E2E-Auth-Flow (#174).
 *
 * Warum: Der Server ist im Kern ein Proxy zu ChurchTools. Ohne Gegenstelle lässt sich im CI genau der
 * Weg nicht prüfen, der im Gottesdienst zählt – Anmelden, Termin öffnen, Chart sehen, anmerken,
 * abgleichen. Der vorhandene Render-Smoke (`?demo=chart`) mountet die Chart-Ansicht ohne Backend und
 * sagt über Login, Rechte und Sync nichts.
 *
 * Bewusst ein eigenes kleines Skript und kein Mock im Testprozess: So läuft der **echte** Server mit
 * seiner echten Session-, Rechte- und Proxy-Logik gegen etwas, das sich wie ChurchTools verhält. Nur
 * die Endpunkte, die der Flow wirklich anfasst – wächst der Bedarf, wächst diese Datei.
 *
 * Start: `node e2e/ct-stub.mjs` (Port über `PORT`, Standard 4599).
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4599);
const SESSION = 'ChurchTools_stubsid=abc123';
const PERSON = { id: 4711, firstName: 'Test', lastName: 'Musiker' };

/**
 * **Ein eigener Admin** (13.10.2026, „Termine ohne Ablauf"): Die Verwaltung ist nur für Admins da, der
 * Stub-Nutzer oben darf alles AUSSER administrieren – das soll für die übrigen Tests so bleiben. Wer sich
 * mit `admin@example.org` anmeldet, bekommt eine eigene Sitzung und eine eigene Person: Der Server merkt
 * sich Rechte je Konto, mit derselben Person mischten sich Admin- und Musiker-Rechte.
 */
const ADMIN_EMAIL = 'admin@example.org';
const SESSION_ADMIN = 'ChurchTools_stubsid=admin456';
const ADMIN_PERSON = { id: 4712, firstName: 'Admin', lastName: 'Stub' };
const istAdmin = (req) => (req.headers.cookie ?? '').includes('admin456');

/**
 * Personen-Dateien (Ablage in ChurchTools, 09.10.2026) – wie gemessen: Hochladen legt IMMER eine neue
 * Datei an (kein Überschreiben), IDs steigen, Herunterladen über denselben Query-Pfad wie die Lied-Dateien.
 */
const personenDateien = new Map(); // personId → [{ id, name, inhalt: Buffer }]
let personDateiId = 90000;

/** Die erste Datei aus einem multipart/form-data-Rumpf (Feld `files[]`): Name und Inhalt. */
function ersteDatei(rumpf, contentType) {
  const grenze = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType ?? '');
  if (!grenze) return null;
  const trenner = Buffer.from(`--${grenze[1] ?? grenze[2]}`);
  const start = rumpf.indexOf(trenner);
  const ende = rumpf.indexOf(trenner, start + trenner.length);
  if (start < 0 || ende < 0) return null;
  const teil = rumpf.subarray(start + trenner.length + 2, ende - 2); // ohne CRLF davor/danach
  const kopfEnde = teil.indexOf('\r\n\r\n');
  const kopf = teil.subarray(0, kopfEnde).toString('utf8');
  const name = /filename="([^"]*)"/.exec(kopf)?.[1];
  if (!name) return null;
  return { name, inhalt: Buffer.from(teil.subarray(kopfEnde + 4)) };
}

/** Abwesenheiten (#177): eine manuelle (ohne Marker) liegt vor, damit das Schloss zu sehen ist. */
let absenceId = 9000;

/** IDs für neu angelegte Arrangements (#396) – über den vorhandenen 9001/9002 des Testliedes. */
let arrangementId = 9100;

/**
 * Die Liedquellen (#396) – EINE Liste für `getMasterData` und für die Schreibpfade.
 * Zweimal hingeschrieben wären es zwei Stellen, und der Stub könnte eine Quelle bestätigen, die er
 * selbst nicht anbietet.
 */
const QUELLEN = [
  { id: 2, name: 'Unser Liederbuch', shorty: 'ULB' },
  { id: 5, name: 'Feiert Jesus', shorty: 'FJ' },
];
/**
 * Grund-ID → so, wie ChurchTools ihn zurückgibt: Name als **Übersetzungsschlüssel** (gemessen
 * 05.09.2026). Vorher stand hier fest „Abwesend", egal welche ID – der Stub log also über den Grund
 * und hätte einen echten Fehler beim Beibehalten des Grundes verdeckt.
 */
const GRUND_NAMEN = {
  1: 'absent.reason.absence',
  2: 'absent.reason.vacation',
  3: 'absent.reason.sick',
};
const grundZu = (id) => ({
  id: Number(id) || 1,
  name: GRUND_NAMEN[Number(id) || 1] ?? 'absent.reason.absence',
});

const ABSENCES = [
  {
    id: ++absenceId,
    personId: PERSON.id,
    startDate: '2099-12-24',
    endDate: '2099-12-26',
    comment: 'Weihnachten',
    absenceReason: { id: 2, name: 'absent.reason.vacation' },
  },
];

/** Ein Lied mit Arrangement + ChordPro-Datei. Die Datei-ID taucht in der fileUrl auf. */
const SONG = {
  id: 501,
  name: 'Testlied aus ChurchTools',
  author: 'Stub-Autor',
  /**
   * **Die CCLI-Nummer des Testliedes – hier und nur hier.**
   *
   * Bewusst eine ANDERE als die SongSelect-Treffer des Stubs: Sonst wäre beim Durchklicken nicht zu
   * sehen, welche Quelle einen Treffer geliefert hat. Sie macht außerdem die Rückfrage „Dieses Lied
   * gibt es schon" (#395) lokal durchklickbar – wer sie ins Formular tippt, muss den Dialog sehen.
   *
   * Stand bis zum 20.09.2026 dreimal im Stub: hier als `null` und zweimal als `'1234567'`, an den
   * Antworten vorbeigeschrieben. Wer die Nummer oben änderte, änderte nichts – genau die
   * Dopplung, die dieser Stub schon einmal hatte (zwei Handler für `/api/songs/<id>`).
   */
  ccli: '1234567',
  arrangements: [
    {
      id: 9001,
      name: 'Standard',
      isDefault: true,
      key: 'G',
      keyOfArrangement: 'G',
      bpm: 72,
      beat: '4/4',
      files: [
        {
          name: 'Testlied aus ChurchTools.chordpro',
          fileUrl: `http://localhost:${PORT}/?q=public/filedownload&id=77001`,
        },
      ],
    },
    // Zweites Arrangement (#320): Ohne eines liesse sich das Umschalten nicht pruefen – und die
    // Auswahl erscheint absichtlich erst ab zwei. Eigene Tonart und eigene Datei, damit im Test
    // sichtbar ist, DASS das andere Blatt geladen wurde und nicht nur der Name wechselte.
    {
      id: 9002,
      name: 'Unplugged',
      isDefault: false,
      key: 'D',
      keyOfArrangement: 'D',
      bpm: 96,
      beat: '3/4',
      files: [
        {
          name: 'Testlied aus ChurchTools.chordpro',
          fileUrl: `http://localhost:${PORT}/?q=public/filedownload&id=77002`,
        },
      ],
    },
  ],
};

const CHORDPRO_UNPLUGGED = `{title: Testlied aus ChurchTools}
{key: D}

{comment: Vers 1 Unplugged}
[D]Leise Zeile aus dem [A]Stub
`;

const CHORDPRO = `{title: Testlied aus ChurchTools}
{key: G}

{comment: Vers 1}
[G]Erste Zeile aus dem [C]Stub
[D]Zweite Zeile mit [G]Akkorden

{comment: Refrain}
[C]Hier singt die [G]Gemeinde
`;

const EVENT_ID = 1500;
const events = [
  {
    id: EVENT_ID,
    startDate: isoInDays(2),
    endDate: isoInDays(2, 12),
    name: 'Gottesdienst (Stub)',
    // `title` wie bei ChurchTools gemessen (20.09.2026). Der Termin-Filter im Tab „Abwesenheiten"
    // (#400) hängt NICHT daran – er liest den Namen –, aber so sieht die echte Antwort aus.
    calendar: { domainIdentifier: '1', title: 'Gottesdienst' },
    appointmentId: null,
  },
  /**
   * Ein zweiter Termin mit ANDEREM Namen (#400) – sonst gäbe es nichts zu filtern. Er hat
   * bewusst keinen Ablauf: Der Tab „Termine" zeigt nur Termine MIT Ablaufplan, der Tab
   * „Abwesenheiten" alle. So bleiben die bestehenden Abläufe (E2E) unberührt.
   */
  {
    id: EVENT_ID + 1,
    startDate: isoInDays(4),
    endDate: isoInDays(4, 12),
    name: 'Gebetsabend (Stub)',
    calendar: { domainIdentifier: '2', title: 'Gebetsabend' },
    appointmentId: null,
  },
  /**
   * **Ein zweiter Termin am SELBEN Tag** (22.09.2026). Seit ein Haken im Tab „Abwesenheiten" das
   * Zeitfenster des Termins einträgt, ist genau das der interessante Fall: morgens absagen, nachmittags
   * zusagen. Auch dieser Termin hat bewusst keinen Ablauf, damit die bestehenden E2E-Wege unberührt
   * bleiben.
   */
  {
    id: EVENT_ID + 2,
    startDate: isoInDays(4, 16),
    endDate: isoInDays(4, 18),
    name: 'Jugendtreff (Stub)',
    calendar: { domainIdentifier: '3', title: 'Jugend' },
    appointmentId: null,
  },
  /**
   * **Ein eigener Termin für „Ablauf abschließen"** (09.10.2026). Die E2E-Tests laufen parallel gegen
   * DIESEN Stub; schlösse der Abschluss-Test den Ablauf von „Gottesdienst (Stub)" ab, scheiterte
   * gleichzeitig das Anlegen im Hinzufügen-Test (so passiert). Deshalb ein eigener Ablauf.
   */
  {
    id: EVENT_ID + 3,
    startDate: isoInDays(6),
    endDate: isoInDays(6, 12),
    name: 'Abschlussprobe (Stub)',
    calendar: { domainIdentifier: '1', title: 'Gottesdienst' },
    appointmentId: null,
  },
  /**
   * **Ein eigener Termin für „Rückgängig"** (12.10.2026): Löschen, Verschieben und Zurückholen ändern
   * den Ablauf – im geteilten „Gottesdienst (Stub)" störte das die parallel laufenden Tests.
   */
  {
    id: EVENT_ID + 4,
    startDate: isoInDays(7),
    endDate: isoInDays(7, 12),
    name: 'Rückgängig-Probe (Stub)',
    calendar: { domainIdentifier: '1', title: 'Gottesdienst' },
    appointmentId: null,
  },
  /**
   * **„Ablauf anlegen"** (13.10.2026): eine Veranstaltung OHNE Ablauf in einem eigenen Kalender – nur
   * der Anlegen-Test schaltet diesen Kalender in der Verwaltung ein, die übrigen Tests sehen ihn nie. Ein
   * zweiter Termin im selben Kalender mit anderem Namen prüft das Suchwort.
   */
  {
    id: EVENT_ID + 5,
    startDate: isoInDays(8),
    endDate: isoInDays(8, 12),
    name: 'Gottesdienst zur Anlegeprobe',
    calendar: { domainIdentifier: '6', title: 'Anlegeprobe' },
    appointmentId: null,
  },
  {
    id: EVENT_ID + 6,
    startDate: isoInDays(9),
    endDate: isoInDays(9, 12),
    name: 'Gebetsabend zur Anlegeprobe',
    calendar: { domainIdentifier: '6', title: 'Anlegeprobe' },
    appointmentId: null,
  },
  /**
   * **Wer darf bearbeiten** (#635, gemessen E6-0): Der Musiker hat `edit agenda` nur für Kalender 1. Ein
   * Termin mit Ablauf in Kalender 2 → nur ansehen; einer in Kalender 3, dessen Admin er ist → bearbeiten.
   * Beide nur gelesen, damit kein anderer Test etwas davon merkt.
   */
  {
    id: EVENT_ID + 7,
    startDate: isoInDays(10),
    endDate: isoInDays(10, 12),
    name: 'Fremder Kalender (Stub)',
    calendar: { domainIdentifier: '2', title: 'Gebetsabend' },
    appointmentId: null,
    adminIds: [],
    eventAdminIds: [],
  },
  {
    id: EVENT_ID + 8,
    startDate: isoInDays(11),
    endDate: isoInDays(11, 12),
    name: 'Termin-Admin (Stub)',
    calendar: { domainIdentifier: '3', title: 'Jugend' },
    appointmentId: null,
    adminIds: [PERSON.id],
    eventAdminIds: [],
  },
];

/** Die Abläufe der beiden Rechte-Termine (#635) – nur gelesen. */
const agendaRecht = (calendarId) => ({
  calendarId,
  eventStartPosition: 0,
  isLocked: false,
  items: [
    {
      id: 990 + calendarId,
      title: 'Begrüßung (Recht)',
      type: 'normal',
      duration: 300,
      position: 0,
      startTimes: {},
    },
  ],
});

/** Die Ablauf-Vorlage für „Ablauf anlegen" – Punkte wie in ChurchTools (`type` text/header). */
const VORLAGE = {
  id: 77,
  name: 'Probe-Vorlage (Stub)',
  calendarId: 6,
  series: '',
  items: [
    { id: 1, type: 'header', title: 'Ankommen (Vorlage)', duration: 0 },
    { id: 2, type: 'text', title: 'Begrüßung (Vorlage)', duration: 300 },
  ],
};

/** Der angelegte Ablauf von „Anlegeprobe" – `null`, solange es keinen gibt (dann 404 wie gemessen). */
let agendaAngelegt = null;

/** Der Ablauf des Abschluss-Termins – nur abschließen/öffnen, sonst nichts. */
const agendaAbschluss = {
  calendarId: 2,
  eventStartPosition: 0,
  isLocked: false,
  items: [
    { id: 801, title: 'Ansage (Stub)', type: 'normal', duration: 300, position: 0, startTimes: {} },
  ],
};

/**
 * Der Ablauf des Rückgängig-Termins – anlegen, löschen und umsortieren wie in ChurchTools (gemessen
 * 12.10.2026): Neue Punkte kommen ans Ende und die Antwort trägt die ID; `PUT …/agenda` mit `items`
 * sortiert nach der Liste.
 */
const agendaRueckgaengig = {
  calendarId: 2,
  eventStartPosition: 0,
  items: ['Eins', 'Zwei', 'Drei'].map((title, n) => ({
    id: 901 + n,
    title: `${title} (Stub)`,
    type: 'normal',
    duration: 300,
    position: n,
    startTimes: {},
    note: '',
    responsible: { text: '' },
    serviceGroupNotes: [],
  })),
};

/**
 * Der Ablauf. `eventStartPosition` ist die Grenze „Beginn der Veranstaltung" (#423): Punkte mit
 * kleinerer `position` sind Vorlauf. Wie in ChurchTools leitet der Stub `isBeforeEvent` daraus ab
 * (`mitVorlauf`), statt es je Punkt zu speichern.
 */
const agenda = {
  calendarId: 2,
  eventStartPosition: 0,
  items: [
    { id: 1, title: 'Begrüßung', type: 'normal', duration: 300, position: 0, startTimes: {} },
    {
      id: 2,
      title: 'Lied',
      type: 'song',
      duration: 300,
      position: 1,
      startTimes: {},
      song: {
        songId: SONG.id,
        arrangementId: 9001,
        title: 'Lied',
        arrangement: 'Standard',
        key: 'G',
        bpm: 72,
      },
    },
  ],
};

/** Der Ablauf, wie ChurchTools ihn liefert: `isBeforeEvent` aus der Grenze abgeleitet (#423). */
function mitVorlauf() {
  return {
    ...agenda,
    items: agenda.items.map((i) => ({
      ...i,
      isBeforeEvent: i.position < agenda.eventStartPosition,
    })),
  };
}

/**
 * Datum RELATIV zu heute. Die App fragt Termine im Fenster -7d…+42d ab – ein festes Datum fiele je
 * nach Testzeitpunkt heraus und der Termin würde nie erscheinen (genau das ist beim Bauen passiert).
 */
function isoInDays(days, stunde = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(stunde, 0, 0, 0);
  return d.toISOString();
}

/** Alle Rechte, die die App auswertet – der Stub-Nutzer darf alles außer administrieren. */
const permissions = {
  churchservice: {
    'view agenda': [1],
    'edit agenda': [1],
    'view songcategory': [0, 1],
    'edit songcategory': [0, 1],
    // Ohne dieses Recht meldet der Server `canUseCcli: false` und der Reiter „SongSelect" (#378)
    // erschiene nie – dann liesse sich der Umschalter nicht durchklicken.
    'use ccli': [1],
    // Ohne dieses Recht gäbe es die Reiter „Häufigkeit/Zuletzt" nicht (seit 08.10.2026).
    'view song statistics': true,
  },
  churchcore: {},
};

/**
 * Die alte churchservice-Schnittstelle (`POST /index.php?q=churchservice/ajax`) – **so weit, wie der
 * Quellen-Umschalter sie braucht** (#378).
 *
 * `data` hat je Funktion eine andere Form, und das ist keine Erfindung des Stubs, sondern gemessen
 * (siehe `ctAjax.ts`): Bei SongSelect ist `data` eine **Zeichenkette** mit JSON darin, bei
 * `getMasterData` direkt ein Objekt. Ein Stub, der das glättet, würde genau den Fehler verdecken, den
 * die Grenze zu ChurchTools produziert.
 */
const CCLI_TREFFER = [
  {
    songNumber: 5841527,
    title: 'Stub-Lied bei SongSelect',
    authors: ['CCLI-Autor A', 'CCLI-Autor B'],
    defaultKey: ['E'],
    isPublicDomain: false,
    content: { ChordPro: {}, Lyrics: {} },
  },
  {
    songNumber: 7654321,
    title: 'Stub-Lied bei SongSelect (andere Fassung)',
    authors: ['CCLI-Autor C'],
    defaultKey: ['G'],
    isPublicDomain: true,
    content: { Lyrics: {} },
  },
];

function ajaxAntwort(func) {
  // Die Lied-Statistik (08.10.2026): je Arrangement-ID die Termine, Ortszeit ohne Zone – wie gemessen.
  if (func === 'getSongStatistic') {
    // Vor einer Woche – damit es im voreingestellten Zeitraum der Liederliste liegt, egal wann der Test läuft.
    const tag = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    return { status: 'success', data: { 9001: [{ date: `${tag} 10:00:00`, category_id: '2' }] } };
  }
  if (func === 'getMasterData') {
    // Kategorien: alles als Zeichenkette, Name als `bezeichnung` – so liefert es das alte Modul.
    return {
      status: 'success',
      data: {
        /**
         * Die Abwesenheitsgründe (#177) kommen aus DERSELBEN Antwort wie die Lied-Kategorien – so
         * hat es die Messung an der ECG-Instanz am 05.09.2026 gezeigt. Genau diese Form nachbauen:
         * ein OBJEKT (kein Array), IDs als Zeichenkette, Name als Übersetzungsschlüssel, Reihenfolge
         * über `sortkey` (bei der ECG steht „Krank" vorn – deshalb darf die App nicht einfach den
         * ersten Eintrag als Standard nehmen).
         */
        absent_reason: {
          1: { id: '1', bezeichnung: 'absent.reason.absence', sortkey: '2' },
          2: { id: '2', bezeichnung: 'absent.reason.vacation', sortkey: '1' },
          3: { id: '3', bezeichnung: 'absent.reason.sick', sortkey: '0' },
        },
        songcategory: [
          { id: '0', bezeichnung: 'Aktive Songs', sortkey: '0' },
          { id: '1', bezeichnung: 'Inaktive Songs', sortkey: '1' },
        ],
        /**
         * Die Liedquellen (#396) – aus DERSELBEN Antwort wie Kategorien und Abwesenheitsgründe.
         * Bewusst als **Objekt** nachgebaut, nicht als Array: So liefert ChurchTools sie wirklich
         * (gemessen 20.09.2026), während `songcategory` am selben Endpunkt ein Array ist. Ein Stub,
         * der das glättet, würde genau den Fehler verdecken, den die App dort machen könnte.
         */
        songsource: Object.fromEntries(
          QUELLEN.map((q, i) => [
            q.id,
            { id: String(q.id), name: q.name, shorty: q.shorty, sortkey: String(i) },
          ]),
        ),
      },
    };
  }
  if (func === 'getCCLISongsMatchingTitle') {
    return {
      status: 'success',
      // Absichtlich mehr `totalItems` als Treffer: So ist der Hinweis „such genauer" sichtbar.
      data: JSON.stringify({
        pagination: { totalItems: 147 },
        data: { results: CCLI_TREFFER },
      }),
    };
  }
  if (func === 'getCCLISongData') {
    return {
      status: 'success',
      data: JSON.stringify({
        data: { ...CCLI_TREFFER[0], copyrights: ['© 2019 Stub-Verlag'] },
      }),
    };
  }
  /**
   * Der Liedtext (#381) – **in der Form, die am 14.08.2026 gemessen wurde**: strukturiert in
   * `lyricParts` mit `partLabel`, dazu `disclaimer`. Der Disclaimer ist hier absichtlich dabei: Er
   * MUSS angezeigt werden, und ohne ihn im Stub liesse sich das nicht durchklicken.
   */
  if (func === 'getCCLILyrics') {
    return {
      status: 'success',
      data: JSON.stringify({
        data: {
          type: 'songLyrics',
          songNumber: CCLI_TREFFER[0].songNumber,
          title: CCLI_TREFFER[0].title,
          authors: CCLI_TREFFER[0].authors,
          copyrights: ['© 2019 Stub-Verlag'],
          disclaimer:
            'For use solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com',
          lyricParts: [
            {
              partLabel: 'Vers 1',
              partType: 'Verse',
              lyrics: 'Erste Zeile vom Stub-Vers,\nzweite Zeile.',
            },
            { partLabel: 'Chorus 1', partType: 'Chorus', lyrics: 'Stub-Refrain,\nHalleluja!' },
            // Ein Abschnitt ohne Text – er darf NICHT als leere Überschrift erscheinen.
            { partLabel: 'Bridge', partType: 'Bridge', lyrics: '   ' },
          ],
        },
      }),
    };
  }
  return null;
}

function json(res, body, status = 200, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  // Personen-Dateien (Ablage in ChurchTools): Liste, Hochladen, Herunterladen, Löschen.
  const personDateien = /^\/api\/files\/person\/(\d+)$/.exec(path);
  if (personDateien && req.method === 'GET') {
    const liste = personenDateien.get(Number(personDateien[1])) ?? [];
    return json(res, {
      data: liste.map((f) => ({
        id: f.id,
        name: f.name,
        fileUrl: `http://localhost:${PORT}/?q=public/filedownload&id=${f.id}`,
      })),
    });
  }
  if (personDateien && req.method === 'POST') {
    const teile = [];
    req.on('data', (c) => teile.push(c));
    req.on('end', () => {
      const datei = ersteDatei(Buffer.concat(teile), req.headers['content-type']);
      if (!datei) return json(res, { message: 'stub: keine Datei' }, 400);
      const id = personDateiId++;
      const liste = personenDateien.get(Number(personDateien[1])) ?? [];
      liste.push({ id, ...datei });
      personenDateien.set(Number(personDateien[1]), liste);
      json(res, { data: [{ id, name: datei.name }] });
    });
    return;
  }
  const loeschId = /^\/api\/files\/(\d+)$/.exec(path);
  if (loeschId && req.method === 'DELETE') {
    for (const [pid, liste] of personenDateien) {
      personenDateien.set(
        pid,
        liste.filter((f) => f.id !== Number(loeschId[1])),
      );
    }
    return json(res, { data: {} });
  }
  const personDatei = [...personenDateien.values()]
    .flat()
    .find((f) => String(f.id) === url.searchParams.get('id'));
  if (url.searchParams.get('q') === 'public/filedownload' && personDatei) {
    res.writeHead(200, { 'Content-Type': 'application/unknown' });
    return res.end(personDatei.inhalt);
  }

  // Datei-Download (ChordPro) – ChurchTools liefert das über einen Query-Pfad aus.
  if (url.searchParams.get('q') === 'public/filedownload') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    // Datei 77002 gehoert zum zweiten Arrangement und hat einen anderen Text: So belegt der Test,
    // dass beim Umschalten wirklich ein anderes Blatt geladen wird.
    res.end(url.searchParams.get('id') === '77002' ? CHORDPRO_UNPLUGGED : CHORDPRO);
    return;
  }

  // Die alte churchservice-Schnittstelle: Kategorien und SongSelect (#378).
  if (path === '/index.php' && url.searchParams.get('q') === 'churchservice/ajax') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const func = new URLSearchParams(body).get('func') ?? '';
      const antwort = ajaxAntwort(func);
      if (antwort) return json(res, antwort);
      console.warn(`[ct-stub] ajax-Funktion nicht abgedeckt: ${func}`);
      json(res, { status: 'error', message: `stub: ${func} nicht abgedeckt` });
    });
    return;
  }

  if (path === '/api/login' && req.method === 'POST') {
    // Der Stub prüft nichts – falsche Zugangsdaten sind ein eigener Testfall am echten CT. Nur der
    // Admin (`ADMIN_EMAIL`) bekommt eine eigene Sitzung.
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const admin = (JSON.parse(body || '{}').username ?? '') === ADMIN_EMAIL;
      json(res, { data: admin ? ADMIN_PERSON : PERSON }, 200, {
        'Set-Cookie': `${admin ? SESSION_ADMIN : SESSION}; Path=/; HttpOnly`,
      });
    });
    return;
  }
  if (path === '/api/logout') return json(res, { data: {} });
  if (path === '/api/whoami') return json(res, { data: istAdmin(req) ? ADMIN_PERSON : PERSON });
  if (path === '/api/calendars') {
    return json(res, {
      data: [
        { id: 1, name: 'Gottesdienst' },
        { id: 6, name: 'Anlegeprobe' },
      ],
    });
  }
  if (path === '/api/agendatemplates') return json(res, { data: [VORLAGE] });
  // „Ablauf anlegen": 404 bis zum Anlegen; `PUT …/agenda?template_id=` legt aus der Vorlage an.
  if (
    path === `/api/events/${EVENT_ID + 5}/agenda` ||
    path === `/api/events/${EVENT_ID + 6}/agenda`
  ) {
    const id = Number(path.split('/')[3]);
    if (req.method === 'PUT' && id === EVENT_ID + 5) {
      const vorlage = url.searchParams.get('template_id');
      agendaAngelegt = {
        calendarId: 6,
        eventStartPosition: 0,
        isLocked: false,
        items:
          vorlage === String(VORLAGE.id)
            ? VORLAGE.items.map((i, n) => ({ ...i, id: 950 + n, position: n, startTimes: {} }))
            : [],
      };
      return json(res, { data: agendaAngelegt });
    }
    if (id === EVENT_ID + 5 && agendaAngelegt) return json(res, { data: agendaAngelegt });
    return json(res, { message: 'Agenda not found' }, 404);
  }
  if (path === '/api/csrftoken') return json(res, { data: 'stub-csrf-token' });
  if (path === '/api/permissions/global') {
    // Der Admin darf zusätzlich administrieren (`STANDARD_ADMIN_RECHT` in `shared/ct/rechte.ts`).
    if (istAdmin(req)) {
      return json(res, {
        data: { ...permissions, churchcore: { 'administer persons': true } },
      });
    }
    return json(res, { data: permissions });
  }
  if (path === '/api/events') return json(res, { data: events });
  // Punkte anlegen und löschen (05.10.2026, „Neuer Eintrag" über das schwebende Plus). Neue Punkte
  // kommen ans Ende – wie in ChurchTools.
  const punktMatch = path.match(new RegExp(`^/api/events/${EVENT_ID}/agenda/items(?:/(\\d+))?$`));
  if (punktMatch && req.method === 'POST' && !punktMatch[1]) {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const neu = JSON.parse(body || '{}');
      const id = Math.max(0, ...agenda.items.map((i) => i.id)) + 1;
      const punkt = {
        id,
        title: neu.title ?? '',
        type: neu.type ?? 'text',
        duration: neu.duration ?? 0,
        position: agenda.items.length,
        startTimes: {},
        note: neu.note ?? '',
        responsible: { text: neu.responsible ?? '' },
      };
      agenda.items.push(punkt);
      json(res, { data: punkt }, 201);
    });
    return;
  }
  // Abschließen/Öffnen (09.10.2026) – wie gemessen: lock/unlock setzen `isLocked`, und im
  // abgeschlossenen Ablauf verweigert ChurchTools jedes Ändern mit 403 „error.forbidden.update".
  const sperre = path.match(new RegExp(`^/api/events/${EVENT_ID + 3}/agenda/(lock|unlock)$`));
  if (sperre && req.method === 'POST') {
    agendaAbschluss.isLocked = sperre[1] === 'lock';
    res.writeHead(204);
    return res.end();
  }
  if (path === `/api/events/${EVENT_ID + 7}/agenda`) return json(res, { data: agendaRecht(2) });
  if (path === `/api/events/${EVENT_ID + 8}/agenda`) return json(res, { data: agendaRecht(3) });
  if (path === `/api/events/${EVENT_ID + 3}/agenda`) {
    return json(res, { data: agendaAbschluss });
  }
  // Der Rückgängig-Termin (12.10.2026): Ablauf lesen/umsortieren, Punkte anlegen/löschen.
  const rPunkt = path.match(new RegExp(`^/api/events/${EVENT_ID + 4}/agenda/items(?:/(\\d+))?$`));
  if (path === `/api/events/${EVENT_ID + 4}/agenda` || rPunkt) {
    const a = agendaRueckgaengig;
    const neuNummerieren = () => a.items.forEach((i, n) => (i.position = n));
    if (req.method === 'GET') return json(res, { data: a });
    if (req.method === 'DELETE' && rPunkt?.[1]) {
      a.items = a.items.filter((i) => i.id !== Number(rPunkt[1]));
      neuNummerieren();
      res.writeHead(204);
      return res.end();
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const neu = JSON.parse(body || '{}');
      if (req.method === 'POST' && rPunkt && !rPunkt[1]) {
        const punkt = {
          id: Math.max(0, ...a.items.map((i) => i.id)) + 1,
          title: neu.title ?? '',
          type: neu.type ?? 'text',
          duration: neu.duration ?? 0,
          position: a.items.length,
          startTimes: {},
          note: neu.note ?? '',
          responsible: { text: neu.responsible ?? '' },
          serviceGroupNotes: neu.serviceGroupNotes ?? [],
        };
        a.items.push(punkt);
        return json(res, { data: punkt }, 201);
      }
      if (req.method === 'PUT' && !rPunkt) {
        if (Array.isArray(neu.items)) {
          a.items = neu.items.map((x) => a.items.find((i) => i.id === x.id)).filter(Boolean);
          neuNummerieren();
        }
        if (typeof neu.eventStartPosition === 'number')
          a.eventStartPosition = neu.eventStartPosition;
        return json(res, { data: a });
      }
      json(res, { message: 'Stub kennt das nicht' }, 400);
    });
    return;
  }
  // Auge (E6-3b, gemessen E6-3-0): `hide` setzt `startTimes[termin]` auf null, `unhide` gibt die Zeit zurück; 204.
  const auge = path.match(
    new RegExp(`^/api/events/${EVENT_ID}/agenda/items/(\\d+)/(hide|unhide)$`),
  );
  if (auge && req.method === 'POST') {
    const punkt = agenda.items.find((i) => i.id === Number(auge[1]));
    if (!punkt) return json(res, { message: 'AgendaItem not found' }, 404);
    if (auge[2] === 'hide') punkt.startTimes = { ...punkt.startTimes, [EVENT_ID]: null };
    else punkt.startTimes = {};
    res.writeHead(204);
    res.end();
    return;
  }
  if (punktMatch && req.method === 'DELETE' && punktMatch[1]) {
    agenda.items = agenda.items.filter((i) => i.id !== Number(punktMatch[1]));
    agenda.items.forEach((i, n) => (i.position = n));
    return json(res, { data: {} });
  }
  if (path === `/api/events/${EVENT_ID}/agenda`) {
    // Nur die Grenze schreiben (#423) – so wie die App es tut: `{calendarId, eventStartPosition}`
    // ohne `items`. Alles andere beantwortet der Stub wie bisher mit dem Ablauf.
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const neu = JSON.parse(body || '{}');
        if (typeof neu.eventStartPosition === 'number')
          agenda.eventStartPosition = neu.eventStartPosition;
        json(res, { data: mitVorlauf() });
      });
      return;
    }
    return json(res, { data: mitVorlauf() });
  }
  /**
   * Die Liederliste. **Nicht mehr leer** (#378): Sie ist die Quelle „Bibliothek" und liefert dem
   * Liedtext-Index die ChordPro-Datei – ohne ein Lied darin liesse sich der Umschalter nicht anfassen.
   * Die Kategorie muss mit, sonst kennt die App das Lied ohne Zuordnung.
   */
  if (path === '/api/songs') {
    // Mit CCLI-Nummer, damit die Bibliothekssuche nach der Nummer prüfbar ist (#378). Bewusst eine
    // ANDERE als die SongSelect-Treffer des Stubs – sonst wäre nicht zu sehen, welche Quelle gefunden hat.
    return json(res, {
      data: [{ ...SONG, category: { id: 0, name: 'Aktive Songs' } }],
    });
  }
  // Mitgliedschaft im „Musikteam" (Gruppe 9, Rolle 1). Wirkt nur, wenn die site.json des Servers die
  // Gruppe 9 unter musicianGroupIds führt – die E2E-Läufe tun das nicht (Standard leer), der lokale
  // Durchklick der Verfügbarkeit (#177) schon.
  if (path.startsWith('/api/persons/') && path.endsWith('/groups')) {
    return json(res, {
      data: [
        {
          group: { domainIdentifier: '9' },
          groupTypeRoleId: 1,
          groupMemberStatus: 'active',
          memberEndDate: null,
        },
      ],
    });
  }
  // Abwesenheiten (#177) – ein kleiner Speicher im Prozess, damit Anlegen/Löschen sichtbar wird.
  const absMatch = path.match(/^\/api\/persons\/(\d+)\/absences(?:\/(\d+))?$/);
  if (absMatch) {
    const personId = Number(absMatch[1]);
    if (req.method === 'GET') {
      return json(res, { data: ABSENCES.filter((a) => a.personId === personId) });
    }
    if (req.method === 'POST') {
      // Der Handler ist synchron – den Rumpf deshalb über die Ereignisse lesen.
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const neu = JSON.parse(body || '{}');
        const eintrag = {
          id: ++absenceId,
          personId,
          startDate: neu.startDate,
          endDate: neu.endDate,
          // Uhrzeiten wie ChurchTools: null = ganztägig (an der Test-Instanz gemessen, 22.09.2026).
          startTime: neu.startTime ?? null,
          endTime: neu.endTime ?? null,
          comment: neu.comment ?? null,
          absenceReason: grundZu(neu.absenceReasonId),
        };
        ABSENCES.push(eintrag);
        res.statusCode = 201;
        json(res, { data: { id: eintrag.id } });
      });
      return;
    }
    if (req.method === 'DELETE' && absMatch[2]) {
      const idx = ABSENCES.findIndex((a) => a.id === Number(absMatch[2]));
      if (idx >= 0) ABSENCES.splice(idx, 1);
      res.statusCode = 204;
      return res.end();
    }
  }
  /**
   * **Arrangements verwalten (#396) – mit echtem Speicher, nicht nur mit „ok".**
   *
   * Ein Stub, der jeden Schreibvorgang bestätigt und nichts ändert, verdeckt genau die Fehler, um
   * die es hier geht: ob der Standard wirklich wechselt und ob ein `PUT` Felder verliert. Deshalb
   * wird am `SONG.arrangements` wirklich gearbeitet – Anlegen, Ändern, Standard, Löschen.
   *
   * Die Regel „PUT ersetzt den ganzen Datensatz" wird dabei NACHGEBILDET: Was der Rumpf nicht nennt,
   * ist danach weg. Nur so zeigt der Durchklick, ob die App vollständig schreibt.
   */
  const arrMatch = path.match(/^\/api\/songs\/(\d+)\/arrangements(?:\/(\d+))?(\/default)?$/);
  if (arrMatch && req.method !== 'GET') {
    const arrId = arrMatch[2] ? Number(arrMatch[2]) : null;
    const idx = arrId === null ? -1 : SONG.arrangements.findIndex((a) => a.id === arrId);

    if (req.method === 'PATCH' && arrMatch[3]) {
      // Zum Standard machen: ChurchTools nimmt dem bisherigen das Flag selbst ab.
      if (idx < 0) return json(res, { message: 'unbekannt' }, 404);
      SONG.arrangements.forEach((a, i) => (a.isDefault = i === idx));
      res.statusCode = 204;
      return res.end();
    }
    if (req.method === 'DELETE') {
      if (idx >= 0) SONG.arrangements.splice(idx, 1);
      res.statusCode = 204;
      return res.end();
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const rumpf = JSON.parse(body || '{}');
        // Die Quelle kommt beim LESEN als Objekt zurück, beim Schreiben als `sourceId` – wie bei CT.
        const quelle = rumpf.sourceId
          ? (QUELLEN.find((q) => q.id === Number(rumpf.sourceId)) ?? null)
          : null;
        const felder = {
          name: rumpf.name ?? null,
          key: rumpf.key ?? null,
          keyOfArrangement: rumpf.key ?? null,
          bpm: rumpf.tempo ?? null,
          tempo: rumpf.tempo ?? null,
          beat: rumpf.beat ?? null,
          duration: rumpf.duration ?? null,
          description: rumpf.description ?? null,
          // Ohne Quelle keine Liednummer – ChurchTools wirft sie sonst still weg (gemessen).
          source: quelle,
          sourceId: quelle ? quelle.id : null,
          sourceReference: quelle ? (rumpf.sourceReference ?? null) : null,
          files: [],
        };
        if (req.method === 'POST') {
          const neu = { id: ++arrangementId, isDefault: rumpf.isDefault === true, ...felder };
          if (neu.isDefault) SONG.arrangements.forEach((a) => (a.isDefault = false));
          SONG.arrangements.push(neu);
          res.statusCode = 201;
          return json(res, { data: { id: neu.id } });
        }
        if (idx < 0) return json(res, { message: 'unbekannt' }, 404);
        // `isDefault` bleibt, wie es war: Ein PUT ändert es bei ChurchTools nachweislich nicht.
        SONG.arrangements[idx] = {
          ...SONG.arrangements[idx],
          ...felder,
          files: SONG.arrangements[idx].files,
        };
        return json(res, { data: SONG.arrangements[idx] });
      });
      return;
    }
  }

  if (path === '/api/groups') return json(res, { data: [] });
  if (path === '/api/services') return json(res, { data: [] });

  // Datei-Upload an ein Arrangement und Löschen einer Datei – der Editor nach dem Anlegen schreibt das
  // Original-Notenblatt darüber (04.09.2026). Der Stub bestätigt nur; was hochgeladen wurde, prüft der
  // Server-Test am protokollierten fetch.
  if (path.startsWith('/api/files/song_arrangement/') && req.method === 'POST') {
    return json(res, { data: [] });
  }
  if (path.startsWith('/api/files/') && req.method === 'DELETE') return json(res, { data: {} });
  // Einzelnes Lied (getArrangement liest es vor dem Schreiben, das Stammdaten-Blatt zeigt es an). MIT
  // Kategorie – ohne sie zeigt das Stammdaten-Blatt nur den Hinweis statt des Formulars. Stand hier
  // zweimal (einmal ohne Kategorie, der Treffer davor schattete diesen ab) – die klassische Dopplung.
  if (/^\/api\/songs\/\d+$/.test(path)) {
    return json(res, { data: { ...SONG, category: { id: 0, name: 'Aktive Songs' } } });
  }

  // Alles Übrige laut protokollieren, statt still 404 zu liefern – so fällt beim Erweitern des
  // Flows sofort auf, welcher Endpunkt noch fehlt.
  console.warn(`[ct-stub] nicht abgedeckt: ${req.method} ${req.url}`);
  json(res, { message: 'stub: not found' }, 404);
});

server.listen(PORT, () => console.log(`[ct-stub] läuft auf http://localhost:${PORT}`));

// Sauber beenden, wenn Playwright den Prozess stoppt: Ohne das halten untätige Keep-Alive-
// Verbindungen den Stub am Leben und der CI-Job hängt nach den Tests.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.closeIdleConnections();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
