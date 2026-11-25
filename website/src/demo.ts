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
 * **Bereiche (W3b-4b):** Drei Fälle mit Seiten der Untergruppe „Website – Jugend“ („Jugendabend“ – eingereicht von Lena Kraft, nie
 * online; „Freizeit 2027“ – gehört zu Jugend, steht online aber noch in der Kategorie der Website, muss also verschoben werden;
 * „Jugend-Team“ – online in der Kategorie von Jugend). In diesen Fällen **gelten die Rechte auch beim Lesen und Schreiben der
 * Werte** (sonst 403) – so sieht man, was ChurchTools sagen würde.
 *  - `?demo=jugend-redakteur` – Mitarbeiter NUR in „Website – Jugend“ (Rechte: Entwürfe schreiben, beide Veröffentlicht lesen):
 *    sieht nur die drei Jugend-Seiten, reicht ein, kein Aussehen/Einstellungen.
 *  - `?demo=jugend-leitung` – Leiter NUR in „Website – Jugend“ (schreibt Entwürfe und `veroeffentlicht-g21`): sieht nur die
 *    Jugend-Seiten, gibt sie frei; „Freizeit 2027“ freigeben schreibt nach Jugend, aus der Kategorie der Website darf er sie
 *    nicht entfernen – die Meldung sagt, dass sie dort zusätzlich noch steht.
 *  - `?demo=bereiche` – Leitung der Website (kein Admin) mit denselben Seiten: alle Seiten, „Bereich“ in „Seite einstellen“,
 *    „Freizeit 2027“ freigeben verschiebt sie (neue Kategorie → nachlesen → alte löschen). Den Bereich einer online stehenden Seite
 *    ändern (z. B. „Impressum“ → „Website – Jugend“) verschiebt ihre Online-Fassung sofort (W3b-4b-2) – Meldung und Etikett „Online“.
 *
 * **Untergruppen (W3b-4a):** Die Gruppe „Website“ hat zwei direkte Untergruppen – „Website – Jugend“ (in allen eingerichteten
 * Fällen eingerichtet: Kategorie `veroeffentlicht-g21`, Rechte nach der Regel) und „Website – Technik“ (nicht eingerichtet:
 * Hinweis beim Start, unter „Wer darf was“ mit der Vorbelegung). „Website – Jugend – Band“ ist ein Enkel und zählt nicht.
 * Ihre Rollen tragen eigene `group_role`-IDs (2101 …), an den Mitgliedern dieselben Gruppenart-Rollen (16/15) – verschieden
 * wie in ChurchTools.
 *
 * Alle Fälle mit Seiten haben gespeicherte Einstellungen (Farben, Schriften Quicksand und Caveat Brush) – der Reiter „Aussehen“
 * zeigt damit etwas. Die Schriften werden im Entwicklungsmodus wie im Bau als `data:`-Adresse nachgeladen.
 *
 * **Im Demo-Modus geht keine Anfrage ins Netz:** `fetch` wird vor dem ersten Zeichnen ersetzt und beantwortet jeden Pfad
 * selbst – was nicht bekannt ist, bekommt 404 und wird in der Konsole genannt, statt an einen Server zu gehen.
 */
import { teileBauen } from '@shared/ct/teile';
import { sperreVon } from '@shared/ct/sperre';
import { kategorienFuer, untergruppenKategorie } from '@shared/website/einrichten';
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
/** Die Untergruppen (W3b-4a): Jugend ist eingerichtet, Technik nicht; Band ist ein Enkel. */
const JUGEND = 21;
const TECHNIK = 22;
const BAND = 23;
const VEROEFFENTLICHT_JUGEND = 203;

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
    'jugend-redakteur',
    'jugend-leitung',
    'bereiche',
  ].includes(fall);
  /** Die Fälle mit Seiten der Untergruppe Jugend (W3b-4b) – dort gelten die Rechte auch an den Werten. */
  const mitBereichen = ['jugend-redakteur', 'jugend-leitung', 'bereiche'].includes(fall);
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
  const jugend = untergruppenKategorie(JUGEND, 'Website – Jugend');
  if (eingerichtet)
    kategorien.push(
      { id: ENTWUERFE, shorty: e.kuerzel, name: e.name },
      { id: VEROEFFENTLICHT, shorty: v.kuerzel, name: v.name },
      { id: VEROEFFENTLICHT_JUGEND, shorty: jugend.kuerzel, name: jugend.name },
    );

  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [ENTWUERFE, []],
    [VEROEFFENTLICHT, []],
    [VEROEFFENTLICHT_JUGEND, []],
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
      'jugend-redakteur',
      'jugend-leitung',
      'bereiche',
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
    // ── Bereiche (W3b-4b): Seiten der Untergruppe Jugend, online wie oben beschrieben.
    if (mitBereichen) {
      for (const s of [start, gruppen, impressum])
        lege('seite', s.id, seiteAlsText(s), VEROEFFENTLICHT);
      lege('menue', MENUE_ID, menueAlsText(menue), VEROEFFENTLICHT);
      lege('einstellungen', EINSTELLUNGEN_ID, einstellungenAlsText(aussehen), VEROEFFENTLICHT);
      const jugendabend: Seite = {
        id: 'demo-jugendabend',
        titel: 'Jugendabend',
        pfad: 'jugendabend',
        abschnitte: [],
        // Am Ende, wie im Schema – der Text (und damit die Prüfsumme) hängt an der Reihenfolge.
        bereich: JUGEND,
      };
      const freizeit: Seite = {
        id: 'demo-freizeit',
        titel: 'Freizeit 2027',
        pfad: 'freizeit-2027',
        abschnitte: [],
        // Am Ende, wie im Schema – der Text (und damit die Prüfsumme) hängt an der Reihenfolge.
        bereich: JUGEND,
      };
      const team: Seite = {
        id: 'demo-jugend-team',
        titel: 'Jugend-Team',
        pfad: 'jugend-team',
        abschnitte: [],
        // Am Ende, wie im Schema – der Text (und damit die Prüfsumme) hängt an der Reihenfolge.
        bereich: JUGEND,
      };
      for (const s of [jugendabend, freizeit, team]) lege('seite', s.id, seiteAlsText(s));
      // „Freizeit 2027“ wurde freigegeben, als sie noch der Website gehörte – sie liegt in deren Kategorie.
      const { bereich: _ohne, ...freizeitAlt } = freizeit;
      lege('seite', freizeit.id, seiteAlsText(freizeitAlt), VEROEFFENTLICHT);
      lege('seite', team.id, seiteAlsText(team), VEROEFFENTLICHT_JUGEND);
      const w: WebsiteStatus = {
        art: 'website-status',
        fassung: 1,
        id: jugendabend.id,
        zustand: 'eingereicht',
        von: 8,
        name: 'Lena Kraft',
        zeit: vorMin(30),
      };
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(w) });
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
      : fall === 'bereiche'
        ? [ENTWUERFE, VEROEFFENTLICHT, VEROEFFENTLICHT_JUGEND]
        : fall === 'jugend-leitung'
          ? [ENTWUERFE, VEROEFFENTLICHT_JUGEND]
          : fall === 'redakteur' || fall === 'jugend-redakteur'
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
  /** Rollen der Untergruppen (W3b-4a): eigene `group_role`-IDs, dieselben Gruppenart-Rollen wie die Website. */
  const untergruppenRollen = (basis: number) => [
    { id: basis + 1, groupTypeRoleId: 16, name: 'Leiter', isLeader: true, isActive: true },
    { id: basis + 2, groupTypeRoleId: 15, name: 'Mitarbeiter', isLeader: false, isActive: true },
  ];
  const ROLLEN_JE_GRUPPE = new Map<number, typeof ROLLEN>([
    [JUGEND, untergruppenRollen(2100)],
    [TECHNIK, untergruppenRollen(2200)],
    [BAND, untergruppenRollen(2300)],
  ]);
  const GRUPPEN_NAMEN = new Map<number, string>([
    [GRUPPE, 'Website'],
    [JUGEND, 'Website – Jugend'],
    [TECHNIK, 'Website – Technik'],
    [BAND, 'Website – Jugend – Band'],
  ]);
  const hierarchie = [
    { groupId: GRUPPE, parents: [], children: [JUGEND, TECHNIK] },
    { groupId: JUGEND, parents: [GRUPPE], children: [BAND] },
    { groupId: TECHNIK, parents: [GRUPPE], children: [] },
    { groupId: BAND, parents: [JUGEND], children: [] },
  ];
  const kat = {
    entwuerfe: ENTWUERFE,
    veroeffentlicht: VEROEFFENTLICHT,
    untergruppen: [{ gruppe: JUGEND, kategorie: VEROEFFENTLICHT_JUGEND }],
  };
  const rollenRechte: Recht[] =
    fall === 'rechte-leer' || !eingerichtet
      ? []
      : [
          ...sollRechteWebsite(
            [
              { rolle: 2, stufe: 'leitung' },
              { rolle: 3, stufe: 'redakteur' },
            ],
            kat,
            NUMMERN,
          ),
          ...sollRechteWebsite(
            [
              { rolle: 2101, stufe: 'leitung' },
              { rolle: 2102, stufe: 'redakteur' },
            ],
            kat,
            NUMMERN,
            kat.untergruppen[0],
          ),
        ];
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
    if (pfad === '/persons/1/groups' && (fall === 'jugend-redakteur' || fall === 'jugend-leitung'))
      return antwort([
        {
          // Nur in der Untergruppe (wie Spike in der Messung W3b-4-0): Gruppen-ID als Text, Rolle = Gruppenart-Rolle.
          group: { domainIdentifier: String(JUGEND), title: 'Website – Jugend' },
          groupTypeRoleId: fall === 'jugend-leitung' ? 16 : 15,
          groupMemberStatus: 'active',
          memberEndDate: null,
        },
      ]);
    if (pfad === '/persons/1/groups')
      return antwort(
        ['leitung', 'leitung-ohne-rechte', 'redakteur', 'mitglied', 'bereiche'].includes(fall)
          ? [
              {
                group: { domainIdentifier: String(GRUPPE), title: 'Website' },
                groupTypeRoleId:
                  fall === 'leitung' || fall === 'leitung-ohne-rechte' || fall === 'bereiche'
                    ? 16
                    : 15,
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
    const rollenPfad = /^\/groups\/(\d+)\/roles$/.exec(pfad);
    if (rollenPfad) return antwort(ROLLEN_JE_GRUPPE.get(Number(rollenPfad[1])) ?? ROLLEN);
    if (pfad === '/groups/hierarchies') return antwort(hierarchie);
    const gruppenPfad = /^\/groups\/(\d+)$/.exec(pfad);
    if (gruppenPfad) {
      const id = Number(gruppenPfad[1]);
      const name = GRUPPEN_NAMEN.get(id);
      return name ? antwort({ id, name }) : antwort(null, 404);
    }
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
        { id: JUGEND, name: 'Website – Jugend' },
        { id: TECHNIK, name: 'Website – Technik' },
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
      // Bereiche (W3b-4b): Lesen nur mit Leserecht, Schreiben nur mit Schreibrecht – wie ChurchTools (dort 401 → „kein Recht“).
      if (mitBereichen && method === 'GET' && !kategorien.some((k) => k.id === kat))
        return antwort(null, 403);
      if (mitBereichen && method !== 'GET' && !schreibt.includes(kat)) return antwort(null, 403);
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
