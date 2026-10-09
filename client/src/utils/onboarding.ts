import type { CoachStep } from '../components/Coachmarks';
import { lokalSchreiben } from './lokalSpeicher';

/**
 * Merker + Schrittdefinitionen der geführten Einführung (#Onboarding). Der „gesehen"-Zustand liegt
 * in localStorage (pro Gerät); „Einführung nochmal ansehen" im Mehr-Tab setzt ihn zurück.
 */
const PREFIX = 'worship:onboard-';
//
// ═══ Wann die Version erhöht werden MUSS ═══════════════════════════════════════════════════════
// Nur wenn die bisherige Fassung **ausgeliefert** war: Wer die Tour einmal weggeklickt hat, sieht
// einen nachgezogenen Text sonst nie wieder. War sie nie draußen, kennt sie niemand – dann genügt
// das Nachziehen. **Diese Frage wird gemessen, nicht geschätzt** (siehe chart-v4 unten, wo die
// Schätzung falsch war): `git show <letzter-Tag>:client/src/utils/onboarding.ts | grep <version>`.
//
// termine-v3: Der Schritt „Die Bereiche" nennt jetzt das Anlegen neuer Lieder (#322) – der +-Knopf
// im Liederheft ist neu und sieht nach nichts aus. Version erhöht, damit Bestandsnutzer den
// geänderten Schritt sehen.
// (termine-v2 hatte den Schritt „geändert"-Hinweis (#143) ergänzt.)
// #378 (14.08.2026): Der Schritt nannte kurz den Quellen-Umschalter „Bibliothek | Liedtexte |
// SongSelect" – der ist am 03.09.2026 wieder weg (Rückmeldung Alwin). Der Text beschreibt jetzt, was
// das Liederheft tut: ein Suchfeld, darunter das Angebot „Auch in den Liedtexten suchen". **Ohne
// Versionssprung, belegt:** `termine-v3` steckt in v2.22.0 (Prod) mit einem Text, der genau dieses
// Verhalten beschreibt („durchsuchst du alle Lieder"); der Umschalter-Text war nie draußen. Für
// Bestandsnutzer hat sich am Liederheft nichts geändert – ein erneutes Zeigen wäre Lärm.
export const TOUR_TERMINE = 'termine-v3';
// chart-v4: Der Tempo-Knopf oeffnet jetzt ein MENUE (#145 Folge) statt nur den Puls zu schalten –
// und er ist neuerdings auch bei Liedern OHNE gepflegtes Tempo da, weil man genau dort eins
// antippen will. Beides sieht man dem Knopf nicht an, also gehoert es in die Einfuehrung.
// Die spaeteren Textaenderungen (Metronom-Menue, „Lied-Optionen" mit der Dateiverwaltung #321,
// „Notizen von anderen" mit dem Umschalter) wurden NACHGEZOGEN, ohne die Version zu erhoehen –
// begruendet damit, chart-v4 sei „nie in Produktion" gewesen.
// ACHTUNG, diese Begruendung war falsch (gemessen am 13.08.2026 im ausgelieferten Bundle): chart-v4
// steckt seit v2.18.0 im Code, und produktiv laeuft v2.20.0. Die Fassung IST also draussen.
// chart-v5 (13.08.2026): Der Schritt „Lied-Optionen" nennt jetzt auch die **Stammdaten** (#322,
// Schritt 11) – Name, Kategorie, Autor, CCLI-Nummer und Copyright aendert man in der App. Hier wurde
// die Version deshalb wirklich erhoeht: Wer die Tour unter v2.20.0 weggeklickt hat, saehe einen
// nachgezogenen Text sonst nie.
// chart-v3: Der Tipp in die Mitte blendet jetzt die Leisten aus (#319) – die Geste findet man
// sonst nicht von selbst. Version erhöht, damit Bestandsnutzer den geänderten Schritt sehen.
// (chart-v2 hatte den Schritt „Team-Anmerkungen" (#124) ergänzt.)
// chart-v6 (20.09.2026, #398): Der Schritt „Lied-Optionen" sagt jetzt, dass der Editor in der
// eingestellten Tonart arbeitet – vorher musste man das erraten (und Alwin hat zurückgerechnet).
// chart-v7 (02.10.2026): Aussehen, Tempo, Anmerken und „Notizen von …" sind keine eigenen Knöpfe
// mehr, sondern stecken hinter EINEM runden Werkzeuge-Knopf (Alwin: „Ein Knopf für alles"). Die vier
// Schritte zeigten auf Knöpfe, die es nicht mehr gibt – jetzt ein Schritt, der alle vier nennt.
// chart-v8 (03.10.2026, #421): Im Querformat steht über jedem der beiden Lieder eine eigene
// Titel-Kapsel mit EINZELNEN Werkzeug-Knöpfen (kein gemeinsamer Werkzeuge-Knopf – dessen Schritt
// entfällt dort von selbst, weil sein Ziel fehlt); ein Tipp darauf wählt das Lied. Der Tipp aufs
// Blatt wählt nichts mehr aus.
// chart-v9 (05.10.2026): Auch im Hochformat stehen die Werkzeuge einzeln oben, solange der Titel
// genug Platz behält – erst im schmalen Fenster (iPhone, kleines Stage-Manager-Fenster) wandern sie
// hinter den einen Knopf. Neuer Schritt am Ziel `chart-werkzeuge-einzeln`; v2.26.1 (produktiv) trägt v8.
export const TOUR_CHART = 'chart-v9';

/**
 * Einmaliger Hinweis, wenn die Leisten zum ersten Mal ausgeblendet werden (#319).
 *
 * Ohne ihn kann man feststecken: Mit ausgeblendeten Leisten ist auch der Zurück-Knopf weg, und
 * dass ein weiterer Tipp in die Mitte sie zurückholt, sieht man dem Blatt nicht an. Nutzt bewusst
 * dieselbe Merker-Mechanik wie die Touren, statt eine zweite daneben zu bauen.
 */
export const HINT_VOLLBILD = 'hinweis-vollbild';

/**
 * Einmaliger Hinweis auf den Vollbild-Knopf der Erweiterung (v2.32.0, Release-Routine Schritt 2 –
 * Alwins Wahl „einmaliger Hinweis" statt eines neuen Tour-Schritts: Der hätte die Termine-Einführung
 * allen erneut gezeigt, auch in der Server-App, wo es den Knopf nicht gibt).
 */
export const HINT_VOLLBILD_KNOPF = 'hinweis-vollbild-knopf';
// setlist-v2 (08.10.2026, v2.29.0): Teilen fragt jetzt nach den Anmerkungen und nimmt auch die PDFs aus
// ChurchTools mit – der Schritt „Als PDF teilen" sagt es, und Bestandsnutzer sollen ihn einmal sehen.
// v2.30.0 (08.10.2026): Text um Vorschau und Herunterladen ergänzt – bewusst OHNE neue Version: v2 ging
// erst am Vorabend raus, die Tour noch einmal zu zeigen wäre lästiger als der fehlende Halbsatz.
export const TOUR_SETLIST = 'setlist-v2';
// setlist-edit-v2: „Hinzufügen" kann jetzt auch ein Lied ANLEGEN (#322) – bisher konnte man nur
// vorhandene wählen. Version erhöht, damit Bestandsnutzer den geänderten Schritt sehen.
// #378 (14.08.2026): Der Schritt sprach von „bei SongSelect gesucht oder selbst eingetippt" – das
// war die **Wegwahl**, die es nicht mehr gibt. Kurz nannte er den Umschalter (nie ausgeliefert).
// setlist-edit-v3 (03.09.2026): Jetzt nennt er das eine Suchfeld mit den Angeboten darunter – und
// hier ist der Sprung nötig, **gemessen**: `git show v2.22.0:client/src/utils/onboarding.ts` enthält
// `setlist-edit-v2` mit dem Wegwahl-Text, und v2.22.0 läuft produktiv. Wer die Tour dort weggeklickt
// hat, sähe den geänderten Einfüge-Dialog sonst nie erklärt. (Die Begründung „nie ausgeliefert" ist
// genau die, die bei chart-v4 schon einmal falsch war – siehe oben.)
// setlist-edit-v4 (18.09.2026, #391): „Lied verknüpfen" kann jetzt auch ein Lied ANLEGEN („Neues Lied"
// und SongSelect wie beim Hinzufügen) – der Schritt „Punkt bearbeiten" sagt das.
// setlist-edit-v5 (05.10.2026, #423): Der Dialog hat „Vor Gottesdienstbeginn" statt „Uhrzeit
// ausblenden" – der Schritt nennt den Soundcheck als Beispiel. v2.26.1 (produktiv) trägt v4. Im selben
// Release: „Hinzufügen" ist das schwebende Plus und öffnet den Bearbeiten-Dialog als „Neuer Eintrag".
export const TOUR_SETLIST_EDIT = 'setlist-edit-v5';
/** Gruppe 5 – Verfügbarkeit (#177), beim ersten Öffnen des Bereichs. */
// v3 (05.09.2026, abends): Statuskopf, Streifen zieht mit, Eintragen über EIN Fenster,
// eigene Einträge per Tipp auf die Zeile änderbar – jeder Schritt zeigt jetzt etwas anderes.
// v4 (19.09.2026): Neubau nach acht Entwurfsrunden – Monatsleiste statt Wochenstreifen, Abhakfeld je
// Termin mit „Speichern"-Leiste, Plus für Zeiträume, Seite „Einträge" mit „Früher". Alle drei
// Schritte zeigen andere Elemente als v3.
// v5 (20.09.2026, #400): neuer Schritt „Nur bestimmte Termine" für den Termin-Filter – er wird
// übersprungen, wenn es höchstens eine Termin-Art gibt (dann gibt es die Knöpfe nicht).
export const TOUR_VERFUEGBARKEIT = 'verfuegbarkeit-v5';

/**
 * Gruppe 6 – das **Stammdaten-Blatt eines Liedes** (#396), beim ersten Öffnen.
 *
 * Neu, weil dort seit #396 mehr steht als Name und Autor: die Arrangements mit allen Angaben, die
 * ChurchTools führt. Ohne einen Hinweis findet das niemand, der das Blatt bisher nur zum Umbenennen
 * geöffnet hat – und „zum Standard machen" steckt noch eine Ebene tiefer.
 */
export const TOUR_LIED_STAMMDATEN = 'lied-stammdaten-v1';

export function isTourDone(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return true; // kein Speicher → Tour lieber nicht aufdrängen
  }
}

export function markTourDone(key: string): void {
  lokalSchreiben(PREFIX + key, '1'); // voll → dann eben erneut zeigen
}

/** Alle Touren zurücksetzen → erscheinen wieder („Einführung nochmal ansehen"). */
export function resetTours(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignorieren */
  }
}

/** Gruppe 1 – Termine. Zielt auf `[data-tour="…"]`-Elemente; fehlende werden übersprungen. */
export const TERMINE_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="termine-liste"]',
    title: 'Eure Gottesdienste',
    body: 'Hier findest du die kommenden Gottesdienste mit ihrem Ablauf. Tippe einen an, um ihn zu öffnen.',
  },
  {
    selector: '[data-tour="songbook"]',
    title: 'Liedblätter öffnen',
    body: 'Tippe auf das Notensymbol, um direkt alle Lieder als Akkord-Blätter zu öffnen. Die kleine Zahl zeigt, wie viele es sind.',
  },
  {
    selector: '[data-tour="setlist-geaendert"]',
    title: 'Was sich geändert hat',
    body: 'Der blaue Punkt erscheint, wenn sich der Ablauf geändert hat, seit du den Termin zuletzt geöffnet hast – wie bei ungelesenen Nachrichten. Er verschwindet, sobald du wieder reingeschaut hast.',
  },
  {
    selector: '[data-tour="offline"]',
    title: 'Auch ohne Netz da',
    body: 'Der nächste Gottesdienst wird automatisch für den Offline-Gebrauch vorbereitet. Die Wolke zeigt, dass er auch ohne Internet verfügbar ist.',
  },
  {
    selector: '[data-tour="tabbar"]',
    title: 'Die Bereiche',
    body: 'Unter „Lieder" durchsuchst du alle Lieder; findet der Titel nichts, kannst du darunter auch in den Liedtexten suchen. Über „Neues Lied" legst du eines an, wenn du in ChurchTools Lieder bearbeiten darfst. Unter „Mehr" findest du Einstellungen und kannst diese Einführung erneut starten.',
  },
];

/** Gruppe 2 – Chart-Ansicht (beim ersten Öffnen eines Liedes). */
export const CHART_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="chart-blaettern"]',
    title: 'Blättern & Zoomen',
    body: 'Wische seitwärts, um zwischen den Seiten zu blättern. Mit zwei Fingern zoomst du rein und wieder heraus. Ein Tipp in die Mitte blendet die Leisten aus – dann hat das Blatt die ganze Fläche.',
  },
  {
    selector: '[data-tour="chart-lied"]',
    title: 'Lied-Optionen',
    body: 'Im Querformat steht über jedem der beiden Lieder ein eigener Titel mit seinen Werkzeugen – ein Tipp auf den blassen Titel oder eines seiner Werkzeuge wählt dieses Lied aus. Tippe auf den Titel, um die Tonart zu ändern, eine Version zu wählen oder zu transponieren. Bearbeitest du eine Version, arbeitet der Editor in der Tonart, die hier eingestellt ist – gespeichert wird, was du siehst. Unter „Dateien …" verwaltest du die Notenblätter des Arrangements, unter „Stammdaten …" Name, Kategorie, Autor und Copyright des Liedes.',
  },
  {
    selector: '[data-tour="chart-werkzeuge"]',
    title: 'Werkzeuge',
    body: 'Hinter diesem Knopf steckt alles Weitere: „Aussehen" für Schriftgröße und Spalten, „Tempo" mit Puls, Klick und Mittippen (gespeichert in ChurchTools wird es nur über den Knopf ganz unten im Tempo-Fenster), „Anmerken" zum Zeichnen und Schreiben auf der Seite und – wenn freigeschaltet – „Notizen von …" für die geteilten Anmerkungen deines Teams. Läuft der Puls, leuchtet der Knopf blau; beim Zeichnen wird er zum Haken, mit dem du fertig bist.',
  },
  {
    // Dasselbe für die EINZELN stehenden Werkzeuge (breites Fenster, Querformat). Es gibt immer nur
    // eines der beiden Ziele – die Einführung überspringt das fehlende.
    selector: '[data-tour="chart-werkzeuge-einzeln"]',
    title: 'Werkzeuge',
    body: 'Hier oben stehen die Werkzeuge: „Aa" für Schriftgröße und Spalten, das Metronom für Tempo mit Puls, Klick und Mittippen (gespeichert in ChurchTools wird es nur über den Knopf ganz unten im Tempo-Fenster), der Stift zum Anmerken und – wenn freigeschaltet – „Notizen von …" für die geteilten Anmerkungen deines Teams. Wird das Fenster schmal, wandern sie hinter einen gemeinsamen Knopf.',
  },
];

/** Gruppe 3 – Ablauf-Ansicht (beim ersten Öffnen eines Gottesdienstes). */
export const SETLIST_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="setlist-song"]',
    title: 'Lieder öffnen',
    body: 'Tippe ein Lied im Ablauf an, um seine Akkord-Blätter zu öffnen.',
  },
  {
    selector: '[data-tour="setlist-share"]',
    title: 'Als PDF teilen',
    body: 'Alle Lieder dieses Gottesdienstes auf einmal als PDF teilen – z. B. per Mail oder zum Drucken. Vorher siehst du die Seiten, wählst, ob deine Anmerkungen mit hinein sollen, und kannst das PDF auch einfach herunterladen.',
  },
  {
    selector: '[data-tour="setlist-edit"]',
    title: 'Ablauf bearbeiten',
    body: 'Reihenfolge ändern, Punkte hinzufügen oder anpassen. Tippe hier, um in den Bearbeiten-Modus zu wechseln.',
  },
];

/** Gruppe 4 – Ablauf-Bearbeiten (beim ersten Wechsel in den Bearbeiten-Modus). */
export const SETLIST_EDIT_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="edit-drag"]',
    title: 'Sortieren',
    body: 'Ziehe einen Punkt an diesem Griff, um die Reihenfolge zu ändern.',
  },
  {
    selector: '[data-tour="edit-item"]',
    title: 'Punkt bearbeiten',
    body: 'Tippe einen Eintrag an, um Titel, Dauer, Zuständige zu ändern oder ein Lied zu verknüpfen – auch eines, das ihr dort gerade erst anlegt. Läuft etwas vor dem Gottesdienst, etwa der Soundcheck, schalte „Vor Gottesdienstbeginn“ ein.',
  },
  {
    selector: '[data-tour="edit-add"]',
    title: 'Hinzufügen',
    body: 'Mit dem Plus legst du einen neuen Eintrag an – im selben Fenster wie beim Bearbeiten: oben wählst du Programmpunkt oder Überschrift. Für ein Lied tippst du „Lied verknüpfen“: Titel, Autor oder CCLI-Nummer – eure Lieder stehen oben, SongSelect darunter. Das Auge zeigt den Liedtext, das Plus wählt aus. Dauer und Zuständige setzt du gleich mit.',
  },
];

/** Gruppe 6 – Stammdaten-Blatt eines Liedes (#396). */
export const LIED_STAMMDATEN_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="arrangements"]',
    title: 'Arrangements',
    body: 'Hier stehen alle Arrangements des Liedes. Tippe eines an, um Tonart, Tempo, Takt, Länge, Quelle und Liednummer zu ändern – oder um es zum Standard zu machen. Unten legst du ein weiteres an.',
  },
  {
    selector: '[data-tour="notenblatt-bearbeiten"]',
    title: 'Notenblatt',
    body: 'Der Text mit den Akkorden, den alle sehen. Was du hier speicherst, gilt für das Team – eure eigenen Fassungen bleiben davon unberührt.',
  },
];

/** Gruppe 5 – Verfügbarkeit: eigene Abwesenheiten (#177). */
export const VERFUEGBARKEIT_STEPS: CoachStep[] = [
  {
    selector: '[data-tour="verf-monate"]',
    title: 'Monat wählen',
    body: 'Oben stehen die kommenden Monate. Der Pfeil rechts klappt ein Jahr auf, „Heute" bringt dich zum laufenden Monat zurück.',
  },
  {
    selector: '[data-tour="verf-filter"]',
    title: 'Nur bestimmte Termine',
    body: 'Tippe eine Termin-Art an, um nur deren Termine zu sehen – etwa nur Gottesdienste. Ein zweiter Tipp auf denselben Knopf oder auf „Alle" zeigt wieder alles. Die App merkt sich deine Wahl.',
  },
  {
    selector: '[data-tour="verf-termine"]',
    title: 'Abhaken, dann speichern',
    body: 'Setze bei einem Termin den Haken „Abwesend". Unten erscheint „Speichern" – erst damit landet es in ChurchTools, alle Haken auf einmal. Ein zweiter Tipp nimmt einen Haken zurück.',
  },
  {
    selector: '[data-tour="verf-plus"]',
    title: 'Zeiträume und Einträge',
    body: 'Das Plus trägt einen ganzen Zeitraum ein, etwa Urlaub. Unter „Einträge" siehst du alles – auch Vergangenes – und kannst Eigenes ändern oder löschen.',
  },
];
