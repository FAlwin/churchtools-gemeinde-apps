/**
 * **Nur zum Entwickeln** (`npm run dev -w website`, dann `…/ccm/website/?demo`): spielt die ChurchTools-Antworten nach,
 * in der Form, die an der Test-Instanz gemessen wurde (Messung W0, 19.11.2026), damit die Seite ohne Instanz zu sehen
 * ist. Wird nie mitgebaut (`main.tsx`). Gespeichert wird nur im Browser-Speicher. Fälle:
 *  - `?demo` – Admin, noch nicht eingerichtet; „Einrichten“ legt die Kategorien im Speicher an und setzt die Rechte je Rolle.
 *  - `?demo=leer` – Admin, eingerichtet, noch keine Seite (Hinweis „Startseite anlegen“).
 *  - `?demo=seiten` – Admin, eingerichtet, Startseite plus zwei Seiten, eine im Menü. „Unsere Gruppen“ hat Beispiel-Inhalt für die neue
 *    Bedienung in der Vorschau (W3c-1): Text mit Fett, Link und Liste, einen dunklen Abschnitt, drei Spalten, „Eigenes HTML“.
 *  - `?demo=leitung` – Leitung der Gruppe (kein Admin; Rechte an Entwürfe UND Veröffentlicht), sonst wie `seiten` – **mit
 *    Eingereichtem** (W3b-2): „Impressum“ (Jonas Peters) und die neue Seite „Jugend“ (Lena Kraft) sind eingereicht, „Alte Seite“
 *    ist zum Löschen angefragt, „Unsere Gruppen“ ist seit der Freigabe geändert; der Reiter „Freigaben“ zeigt die Zahl 3.
 *  - `?demo=redakteur` (W3b-1, W3b-2) – Redakteur (kein Admin; Rechte nur an Entwürfe): Reiter „Seiten“ und „Freigaben“, kein
 *    Aussehen, kein Fenster „Einstellungen“, kein Menü in „Seite einstellen“, kein Baustein „Eigenes HTML“. **Mit einer
 *    zurückgegebenen Seite:** „Impressum“ kam von der Leitung mit Anmerkung zurück (Zähler 1 am Reiter „Freigaben“); „Unsere
 *    Gruppen“ ist online. Einreichen, Löschen anfragen und der Reiter „Freigaben“ lassen sich durchklicken.
 *  - `?demo=leitung-ohne-rechte` (W3b-1) – leitet die Gruppe, hat aber keine Rechte: Hinweis „noch nicht eingerichtet“.
 *  - `?demo=rechte-leer` (W3b-1) – Admin, eingerichtet, aber noch keine Rechte an den Rollen: Hinweis oben, „Wer darf was“ im
 *    Fenster „Einstellungen“ (letzter Reiter) setzt sie.
 *  - `?demo=rechte-abweicht` (W3b-1) – wie `seiten`, aber die Rolle „Mitarbeiter“ darf zusätzlich in „Veröffentlicht“ schreiben
 *    (von Hand verändert): Hinweis „stimmt nicht überein“, „Rechte setzen“ nimmt es zurück.
 *  - `?demo=mitglied` – Mitglied der Gruppe, sieht den Editor nicht.
 *  - `?demo=kaputt` – wie `seiten`, aber ein Wert in „Entwürfe“ ist beschädigt (Hinweis „stimmt etwas nicht“).
 *  - `?demo=gesperrt` – wie `seiten`, aber die Startseite bearbeitet gerade jemand anderes („Gerade bearbeitet von …“,
 *    nur ansehen). Die Sperre gilt zehn Minuten ab dem Laden der Seite.
 *  - `?demo=eigene` – wie `gesperrt`, aber die Sperre ist die eigene aus einem anderen Fenster (so sieht es nach dem Neuladen
 *    aus, wenn die Freigabe beim Verlassen nicht durchkam): „Hier weiterbearbeiten“ nimmt sie.
 *  - `?demo=wackelt` – wie `seiten`, aber das erste Speichern einer Seite scheitert vorübergehend (503): „Nicht gespeichert“,
 *    die Änderung bleibt stehen, „Erneut versuchen“ klappt.
 *  - `?demo=aussehen-gesperrt` – wie `seiten`, aber das Aussehen (die Einstellungen) bearbeitet gerade jemand anderes.
 *  - `?demo=fehler` – ChurchTools antwortet nicht.
 *
 * Alle Fälle mit Seiten haben gespeicherte Einstellungen (Farben, Schriften Quicksand und Caveat Brush) – der Reiter „Aussehen“
 * zeigt damit etwas. Die Schriften werden im Entwicklungsmodus wie im Bau als `data:`-Adresse nachgeladen.
 *
 * **Im Demo-Modus geht keine Anfrage ins Netz:** `fetch` wird vor dem ersten Zeichnen ersetzt und beantwortet jeden Pfad
 * selbst – was nicht bekannt ist, bekommt 404 und wird in der Konsole genannt, statt an einen Server zu gehen.
 */
import { teileBauen } from '@shared/ct/teile';
import { sperreVon } from '@shared/ct/sperre';
import { kategorienFuer } from '@shared/website/einrichten';
import {
  einstellungenAlsText,
  seiteAlsText,
  menueAlsText,
  type Abschnitt,
  type Einstellungen,
  type Menue,
  type Seite,
} from '@shared/website/modell';
import {
  EINSTELLUNGEN_ID,
  MENUE_ID,
  type Einheit,
  type WebsiteKopf,
  type WebsiteTeil,
} from '@shared/website/speicher';
import { neueStartseite, vorlaeufigeEinstellungen } from '@shared/website/seitenListe';
import { findeVorlage, neuerBaustein } from '@shared/website/vorlagen';
import { sollRechte as sollRechteWebsite } from '@shared/website/rechte';
import { rechteAus, type DatenRechteNummern, type Recht } from '@shared/ct/rollenRechte';
import type { WebsiteSperre } from '@shared/website/sperre';
import type { WebsiteStatus } from '@shared/website/status';

const MODUL = 40;
const GRUPPE = 7;
const ENTWUERFE = 201;
const VEROEFFENTLICHT = 202;

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const eingerichtet = [
    'leer',
    'seiten',
    'leitung',
    'redakteur',
    'leitung-ohne-rechte',
    'rechte-leer',
    'rechte-abweicht',
    'mitglied',
    'kaputt',
    'gesperrt',
    'eigene',
    'wackelt',
    'aussehen-gesperrt',
  ].includes(fall);
  const admin = [
    '',
    'leer',
    'rechte-leer',
    'rechte-abweicht',
    'seiten',
    'kaputt',
    'gesperrt',
    'eigene',
    'wackelt',
    'aussehen-gesperrt',
  ].includes(fall);
  const kategorien: { id: number; shorty: string; name: string }[] = [];
  const [e, v] = kategorienFuer(GRUPPE, 'Website');
  if (eingerichtet)
    kategorien.push(
      { id: ENTWUERFE, shorty: e.kuerzel, name: e.name },
      { id: VEROEFFENTLICHT, shorty: v.kuerzel, name: v.name },
    );

  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [ENTWUERFE, []],
    [VEROEFFENTLICHT, []],
  ]);
  let naechsteId = 1000;
  /** Eine Einheit so ablegen, wie `einheitSpeichern` es tut: Teile und Kopf. */
  const lege = (einheit: Einheit, id: string, text: string, kategorie = ENTWUERFE) => {
    const { stand, werte: teile } = teileBauen(
      text,
      (t) =>
        ({
          art: 'website-teil',
          fassung: 1,
          einheit,
          id,
          stand: t.stand,
          nr: t.nr,
          von: t.von,
          daten: t.daten,
        }) satisfies WebsiteTeil,
      'Ein Website-Teil',
    );
    const liste = werte.get(kategorie)!;
    for (const value of teile) liste.push({ id: naechsteId++, dataCategoryId: kategorie, value });
    const kopf: WebsiteKopf = {
      art: 'website-kopf',
      fassung: 1,
      einheit,
      id,
      stand,
      zeit: new Date().toISOString(),
    };
    liste.push({ id: naechsteId++, dataCategoryId: kategorie, value: JSON.stringify(kopf) });
  };

  if (
    [
      'seiten',
      'leitung',
      'redakteur',
      'leitung-ohne-rechte',
      'rechte-leer',
      'rechte-abweicht',
      'mitglied',
      'kaputt',
      'gesperrt',
      'eigene',
      'wackelt',
      'aussehen-gesperrt',
    ].includes(fall)
  ) {
    let n = 0;
    const id = () => `demo-${++n}`;
    const start = neueStartseite([], id);
    // „Unsere Gruppen“ zum Ausprobieren der Bedienung in der Vorschau (W3c-1): Text direkt tippen, Leisten auf hellem UND
    // dunklem Abschnitt, zwei Spalten, Knöpfe, ein Text mit Fett, Link und Liste, „Eigenes HTML“; für das Ziehen (W3c-2) mehrere Abschnitte, Spalten
    // und eine leere Spalte.
    const gruppenAbschnitte = ['start-schriftzug', 'bild-text', 'drei-spalten'].map((name) => {
      const v = findeVorlage(name);
      if (!v) throw new Error(`Die Vorlage „${name}“ gibt es nicht.`);
      return v.erzeugen(id);
    });
    const fuerText = gruppenAbschnitte[1].spalten
      .flatMap((sp) => sp.bausteine)
      .find((b) => b.typ === 'text' || b.typ === 'bildText');
    if (fuerText?.typ === 'text' || fuerText?.typ === 'bildText')
      fuerText.markdown =
        'Hier treffen sich **Jung und Alt** – mehr dazu auf der [Startseite](/).\n\n- Mittwoch: Hauskreis\n- Freitag: Jugend\n\nSternchen * und eckige Klammern [so] bleiben Text.';
    const dunkel = gruppenAbschnitte[2];
    dunkel.gestaltung = { ...dunkel.gestaltung, hintergrund: { art: 'haupt' }, text: 'auto' };
    const html: Abschnitt = {
      id: id(),
      gestaltung: gruppenAbschnitte[0].gestaltung,
      aufteilung: '1',
      spalten: [
        {
          id: id(),
          bausteine: [
            { typ: 'html', id: id(), html: '<p>Eigenes HTML – nur für die Leitung.</p>' },
          ],
        },
      ],
    };
    // Zum Ziehen (W3c-2): zwei Spalten, die rechte ist leer – ein Baustein lässt sich dort hineinziehen.
    const leereSpalte: Abschnitt = {
      id: id(),
      gestaltung: gruppenAbschnitte[0].gestaltung,
      aufteilung: '1-1',
      spalten: [
        { id: id(), bausteine: [{ typ: 'trenner', id: id(), art: 'linie' }] },
        { id: id(), bausteine: [] },
      ],
    };
    // Zum Maße ziehen (W3c-3): zwei Spalten ungleich breit auf DUNKLER Fläche – Spaltenbreite und Abstand (die Bänder müssen auf Petrol
    // zu sehen sein); dazu der helle zweispaltige Abschnitt von oben (`bild-text`) und der dreispaltige dunkle (Griff gedämpft).
    const dunkelZwei: Abschnitt = {
      id: id(),
      gestaltung: { ...dunkel.gestaltung, abstand: 'normal' },
      aufteilung: '2-1',
      spalten: [
        { id: id(), bausteine: [neuerBaustein('ueberschrift', id), neuerBaustein('text', id)] },
        { id: id(), bausteine: [neuerBaustein('text', id)] },
      ],
    };
    const gruppen: Seite = {
      id: 'demo-gruppen',
      titel: 'Unsere Gruppen',
      pfad: 'unsere-gruppen',
      abschnitte: [...gruppenAbschnitte, dunkelZwei, leereSpalte, html],
    };
    const impressum: Seite = {
      id: 'demo-impressum',
      titel: 'Impressum',
      pfad: 'impressum',
      abschnitte: [],
    };
    for (const s of [start, gruppen, impressum]) lege('seite', s.id, seiteAlsText(s));
    const menue: Menue = {
      eintraege: [{ titel: 'Unsere Gruppen', ziel: { art: 'seite', seiteId: gruppen.id } }],
    };
    lege('menue', MENUE_ID, menueAlsText(menue));
    const vorMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const aussehen: Einstellungen = {
      ...vorlaeufigeEinstellungen('Demo-Gemeinde'),
      noindex: false,
      // Für das Fenster „Einstellungen“ (W3a-3b): ein Fußzeilen-Link auf die Impressum-Seite.
      fusszeile: [{ titel: 'Impressum', ziel: { art: 'seite', seiteId: impressum.id } }],
      farben: {
        haupt: '#00434c',
        akzent: '#e3aa1d',
        grund: '#ffffff',
        sanft: '#eef3f3',
        text: '#1e2a2b',
      },
      schriften: {
        text: { art: 'auswahl', name: 'Quicksand' },
        ueberschrift: { art: 'auswahl', name: 'Quicksand' },
        akzent: { art: 'auswahl', name: 'Caveat Brush' },
      },
    };
    lege('einstellungen', EINSTELLUNGEN_ID, einstellungenAlsText(aussehen));

    // ── Freigabe (W3b-2): was online steht, und wer was eingereicht hat – für `leitung` und `redakteur`.
    if (fall === 'leitung' || fall === 'redakteur') {
      const alt: Seite = {
        id: 'demo-alt',
        titel: 'Alte Seite',
        pfad: 'alte-seite',
        abschnitte: [],
      };
      const jugend: Seite = { id: 'demo-jugend', titel: 'Jugend', pfad: 'jugend', abschnitte: [] };
      const gruppenAlt: Seite = { ...gruppen, titel: 'Gruppen' };
      // Online: Startseite, „Unsere Gruppen“ (in der Fassung vor der letzten Änderung bei `leitung`), Impressum, Menü, Einstellungen.
      // „Impressum“ steht in einer früheren Fassung online – im Entwurf ist es seitdem geändert.
      const impressumOnline: Seite = { ...impressum, beschreibung: 'Frühere Fassung' };
      for (const s of [start, fall === 'leitung' ? gruppenAlt : gruppen, impressumOnline])
        lege('seite', s.id, seiteAlsText(s), VEROEFFENTLICHT);
      lege('menue', MENUE_ID, menueAlsText(menue), VEROEFFENTLICHT);
      lege('einstellungen', EINSTELLUNGEN_ID, einstellungenAlsText(aussehen), VEROEFFENTLICHT);
      const setzeStatus = (
        seiteId: string,
        st: Omit<WebsiteStatus, 'art' | 'fassung' | 'id'>,
      ): void => {
        const w: WebsiteStatus = { art: 'website-status', fassung: 1, id: seiteId, ...st };
        werte
          .get(ENTWUERFE)!
          .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(w) });
      };
      if (fall === 'leitung') {
        for (const s of [jugend, alt]) lege('seite', s.id, seiteAlsText(s));
        lege('seite', alt.id, seiteAlsText(alt), VEROEFFENTLICHT);
        setzeStatus(impressum.id, {
          zustand: 'eingereicht',
          von: 2,
          name: 'Jonas Peters',
          zeit: vorMin(25),
        });
        setzeStatus(jugend.id, {
          zustand: 'eingereicht',
          von: 5,
          name: 'Lena Kraft',
          zeit: vorMin(90),
        });
        setzeStatus(alt.id, {
          zustand: 'loeschenAngefragt',
          von: 5,
          name: 'Lena Kraft',
          zeit: vorMin(10),
        });
      } else {
        setzeStatus(impressum.id, {
          zustand: 'zurueck',
          von: 2,
          name: 'Jonas Peters',
          zeit: vorMin(40),
          anmerkung: 'Bitte die Anschrift prüfen – die Hausnummer fehlt noch.',
          einreicher: { von: 1, name: 'Helene Wiebe' },
        });
      }
    }
    if (fall === 'aussehen-gesperrt') {
      const sperre: WebsiteSperre = {
        art: 'website-sperre',
        fassung: 1,
        einheit: 'einstellungen',
        id: EINSTELLUNGEN_ID,
        sperre: sperreVon(
          { person: 2, name: 'Jonas Peters', fenster: 'anderes-fenster' },
          new Date(),
        ),
      };
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(sperre) });
    }
    if (fall === 'gesperrt' || fall === 'eigene') {
      // Jemand anderes (oder `eigene`: dieselbe Person 1 in einem anderen Fenster) hat die Startseite gerade offen.
      const sperre: WebsiteSperre = {
        art: 'website-sperre',
        fassung: 1,
        einheit: 'seite',
        id: start.id,
        sperre: sperreVon(
          fall === 'eigene'
            ? { person: 1, name: 'Helene Wiebe', fenster: 'anderes-fenster' }
            : { person: 2, name: 'Jonas Peters', fenster: 'anderes-fenster' },
          new Date(),
        ),
      };
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(sperre) });
    }
    if (fall === 'kaputt')
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: 'kein JSON' });
  }

  /** In welchen Kategorien die Person schreiben darf – so liest die Oberfläche ihren Zugang (`schreibtIn`). */
  const schreibt = admin
    ? [ENTWUERFE, VEROEFFENTLICHT]
    : fall === 'leitung'
      ? [ENTWUERFE, VEROEFFENTLICHT]
      : fall === 'redakteur'
        ? [ENTWUERFE]
        : [];
  const rechte = () => ({
    churchdb: { 'administer groups': admin },
    churchcore: { 'administer persons': admin },
    website: {
      view: true,
      'create custom category': admin,
      'view custom data': kategorien.map((k) => k.id),
      'create custom data': schreibt,
      'edit custom data': schreibt,
      'delete custom data': schreibt,
    },
  });

  // ── Rechte an den Rollen der Gruppe (W3b-1): so, wie `GET /permissions/definitions` und `/permissions/group_role/{rolle}` sie
  // liefern. Nummern wie auf der Test-Instanz (Messung W3b-0). Die Anfangsrechte kommen aus der Regel (`sollRechte`), nicht
  // aus abgeschriebenen Zahlen.
  const NUMMERN: DatenRechteNummern = {
    modulSehen: 2080,
    kategorieSehen: 2081,
    datenSehen: 2085,
    datenAnlegen: 2086,
    datenAendern: 2087,
    datenLoeschen: 2088,
  };
  const definitionen = {
    modules: [
      {
        key: 'website',
        permissions: [
          { authId: NUMMERN.modulSehen, key: 'view' },
          { authId: NUMMERN.kategorieSehen, key: 'view custom category' },
          { authId: 2082, key: 'create custom category' },
          { authId: NUMMERN.datenSehen, key: 'view custom data' },
          { authId: NUMMERN.datenAnlegen, key: 'create custom data' },
          { authId: NUMMERN.datenAendern, key: 'edit custom data' },
          { authId: NUMMERN.datenLoeschen, key: 'delete custom data' },
        ],
      },
    ],
  };
  const ROLLEN = [
    // `id` = group_role (Rechte), `groupTypeRoleId` = Rolle an den Mitgliedern – verschieden wie in ChurchTools.
    { id: 2, groupTypeRoleId: 16, name: 'Leiter', isLeader: true, isActive: true },
    { id: 3, groupTypeRoleId: 15, name: 'Mitarbeiter', isLeader: false, isActive: true },
    { id: 4, groupTypeRoleId: 18, name: 'Coach', isLeader: false, isActive: true },
  ];
  const rollenRechte: Recht[] =
    fall === 'rechte-leer' || !eingerichtet
      ? []
      : sollRechteWebsite(
          [
            { rolle: 2, stufe: 'leitung' },
            { rolle: 3, stufe: 'redakteur' },
          ],
          { entwuerfe: ENTWUERFE, veroeffentlicht: VEROEFFENTLICHT },
          NUMMERN,
        );
  // Von Hand verändert: Mitarbeiter dürfen in „Veröffentlicht“ schreiben (statt nur lesen).
  if (fall === 'rechte-abweicht')
    rollenRechte.push({ rolle: 3, authId: NUMMERN.datenAnlegen, dataId: VEROEFFENTLICHT });

  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify({ data: daten }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  /** `?demo=wackelt`: Das erste Schreiben eines Seiteninhalts scheitert vorübergehend (wie ein 503 von ChurchTools). */
  let ausfaelle = fall === 'wackelt' ? 1 : 0;

  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname.replace(/^.*\/api/, '');
    const method = init?.method ?? 'GET';
    if (fall === 'fehler' && pfad === '/custommodules') return antwort(null, 502);
    if (pfad === '/csrftoken') return antwort('demo-csrf');
    if (pfad === '/whoami') return antwort({ id: 1, firstName: 'Helene', lastName: 'Wiebe' });
    if (pfad === '/persons/1/groups')
      return antwort(
        ['leitung', 'leitung-ohne-rechte', 'redakteur', 'mitglied'].includes(fall)
          ? [
              {
                group: { domainIdentifier: String(GRUPPE), title: 'Website' },
                groupTypeRoleId: fall === 'leitung' || fall === 'leitung-ohne-rechte' ? 16 : 15,
                groupMemberStatus: 'active',
                memberEndDate: null,
              },
            ]
          : [],
      );
    if (pfad === '/group/roles')
      return antwort([
        { id: 16, isLeader: true },
        { id: 15, isLeader: false },
      ]);
    if (pfad === '/info') return antwort({ shortName: 'Demo-Gemeinde' });
    if (pfad === '/config') return antwort({});
    if (pfad === '/permissions/global') return antwort(rechte());
    if (pfad === '/permissions/definitions') return antwort(definitionen);
    if (/^\/groups\/\d+\/roles$/.test(pfad)) return antwort(ROLLEN);
    // Mails im Freigabe-Weg (W3b-3): Mitglieder der Gruppe (Jonas = Leiter, Helene je nach Fall), das alte Mail-Senden und das Protokoll – gesendet
    // wird nichts, es wird nur „angenommen“.
    if (/^\/groups\/\d+\/members$/.test(pfad))
      return antwort([
        {
          personId: 1,
          person: { title: 'Helene Wiebe' },
          // Dieselbe Rolle wie in ihren Gruppen (`/persons/1/groups`): Leiterin nur im Fall „leitung“.
          groupTypeRoleId: fall === 'leitung' || fall === 'leitung-ohne-rechte' ? 16 : 15,
          groupMemberStatus: 'active',
        },
        {
          personId: 7,
          person: { title: 'Jonas Peters' },
          groupTypeRoleId: 16, // Leiter – er hat in der Demo das Impressum zurückgegeben
          groupMemberStatus: 'active',
        },
        {
          personId: 8,
          person: { title: 'Lena Kraft' },
          groupTypeRoleId: 15,
          groupMemberStatus: 'active',
        },
      ]);
    if (url.pathname.endsWith('/index.php') && url.searchParams.get('q') === 'churchhome/ajax')
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'success', data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    if (pfad === '/logs') return antwort([]);
    const rollenRechtePfad = /^\/permissions\/group_role\/(\d+)$/.exec(pfad);
    if (rollenRechtePfad) {
      const rolle = Number(rollenRechtePfad[1]);
      if (method === 'GET')
        return antwort(
          rollenRechte
            .filter((r) => r.rolle === rolle)
            .map((r) => ({ authId: r.authId, dataId: r.dataId, type: 'grant' })),
        );
      const rumpf = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
        authId: number;
        dataId?: number[];
      };
      const [neu] = rechteAus(rolle, [{ authId: rumpf.authId, dataId: rumpf.dataId?.[0] }]);
      const i = rollenRechte.findIndex(
        (r) => r.rolle === rolle && r.authId === neu.authId && r.dataId === neu.dataId,
      );
      if (method === 'PUT' && i < 0) rollenRechte.push(neu);
      if (method === 'DELETE' && i >= 0) rollenRechte.splice(i, 1);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (pfad === '/groups')
      return antwort([
        { id: 3, name: 'Gottesdienstteam' },
        { id: GRUPPE, name: 'Website' },
        { id: 9, name: 'Jugend' },
      ]);
    if (pfad === '/custommodules') return antwort([{ id: MODUL, shorty: 'website' }]);
    if (pfad === '/calendars')
      return antwort([
        { id: 1, name: 'Gemeindeveranstaltungen' },
        { id: 2, name: 'Jugend' },
      ]);
    if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
      if (method === 'POST' && typeof init?.body === 'string') {
        const k = JSON.parse(init.body) as { shorty: string; name: string };
        kategorien.push({ id: ENTWUERFE + kategorien.length, shorty: k.shorty, name: k.name });
        return antwort(kategorien.at(-1), 201);
      }
      return antwort(kategorien);
    }
    const wertePfad =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (wertePfad) {
      const kat = Number(wertePfad[1]);
      const liste = werte.get(kat) ?? [];
      const rumpf =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as { value: string }) : null;
      if (
        ausfaelle > 0 &&
        (method === 'POST' || method === 'PUT') &&
        rumpf?.value.includes('"art":"website-teil"')
      ) {
        ausfaelle--;
        return antwort(null, 503);
      }
      if (method === 'POST' && rumpf) {
        liste.push({ id: naechsteId++, dataCategoryId: kat, value: rumpf.value });
        werte.set(kat, liste);
        return antwort(liste.at(-1), 201);
      }
      if (method === 'PUT' && rumpf) {
        const w = liste.find((x) => x.id === Number(wertePfad[2]));
        if (!w) return antwort(null, 404);
        w.value = rumpf.value;
        return antwort(w);
      }
      if (method === 'DELETE') {
        const i = liste.findIndex((x) => x.id === Number(wertePfad[2]));
        if (i < 0) return antwort(null, 404);
        liste.splice(i, 1);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return antwort(liste);
    }
    // Nichts geht ins Netz: Was hier nicht bekannt ist, bekommt 404 – und wird genannt, damit es auffällt.
    console.warn('Demo: unbekannte Anfrage', method, pfad);
    return antwort(null, 404);
  };
}
