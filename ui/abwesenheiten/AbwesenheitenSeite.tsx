import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type {
  Absence,
  AbsenceEvent,
  AbsenceReason,
  NeueAbsence,
  TerminArt,
} from '@shared/types/index';
import { Icon } from '../icons/icons';
import { useNeuAnlegen } from '../bedienung/NeuAnlegen';
import { ZeitraumKnopf } from '../bedienung/ZeitraumKnopf';
import { FilterKnopf } from '../bedienung/FilterKnopf';
import { Segment } from '../bedienung/Segment';
import { ApiError } from '../ct/fehler';
import {
  AB_HEUTE,
  spanneText,
  zeitraumGrenzen,
  zeitraumText,
  type Zeitraum,
} from '@shared/ct/zeitraum';
import { MAX_VORAUS_TAGE, decktTermin, zeitfensterFuer } from '@shared/absences/index';
import { gleicheAntworten, type Antworten, type Zusage } from '@shared/dienstplan/verfuegbarkeit';
import { plusTage, tagImMonat } from '@shared/ct/wochen';
import { letzterTag, monatLabel, monatNurKurz, monatPlus, monatVon } from '@shared/ct/monate';
import { AbsenceSheet, type Entwurf } from './AbsenceSheet';
import { ZeitraumFrage } from './ZeitraumFrage';
import {
  abwesenheitFuerTermin,
  tagKurz,
  uhrzeit,
  wochentagLang,
  zeitfensterKurz,
  zeitraumKurz,
} from './absenceDatum';
import { ausgeblendetAusAlterWahl, filtereTermine, knoepfeAus } from './terminFilter';
import styles from './Abwesenheiten.module.scss';

// Nicht exportiert (Fast Refresh mag nur Komponenten als Export) – wer die Zahlen braucht, liest sie hier.
/** So viele Monate ab dem laufenden werden vorab geholt – „dieser“ und „nächster Monat“ brauchen nichts nachzuladen. */
const RASTER_MONATE = 12;
/** „Ab heute“ zeigt die nächsten vier Wochen (Entwurf A, 28.10.2026). */
const AB_HEUTE_TAGE = 28;
/** So weit reicht „Einträge → Früher" zurück. */
const RUECKBLICK_TAGE = 365;

/** Was die Seite lesen muss – jede App holt es auf ihre Art (Musik-App mit Zwischenspeicher, Dienstplaner direkt). */
export interface AbwesenheitenDaten {
  /** Die eigenen Einträge im angefragten Bereich; `undefined`, solange sie laden. */
  eintraege: Absence[] | undefined;
  /** Die Termine bis `bis` – zum Abhaken. */
  termine: AbsenceEvent[] | undefined;
  /** Die Gründe der Gemeinde (Krank, Urlaub, Abwesend …). */
  gruende: AbsenceReason[] | undefined;
  laedt: boolean;
  fehler: boolean;
  /** Einträge UND Termine neu holen – ein Versprechen, damit die Ladeanzeige bis zum Letzten steht. */
  neuLaden: () => Promise<unknown>;
}

/** Wie die Seite schreibt. Jeder Aufruf wirft bei einem Fehlschlag (die Meldung zeigt die Seite). */
export interface AbwesenheitenSchreiben {
  anlegen: (neu: NeueAbsence) => Promise<unknown>;
  aendern: (id: number, neu: NeueAbsence) => Promise<unknown>;
  loeschen: (id: number) => Promise<unknown>;
  /** Nach jedem Schreiben – auch nach einem Fehlschlag in der Mitte –, damit die Liste den wahren Stand zeigt. */
  geaendert: () => void;
}

/** Was die App in ihren Rahmen setzt (Seitenkopf, Knopf rechts oben, Inhalt, was darüber schwebt). */
export interface AbwesenheitenTeile {
  /** „Termine | Einträge“ – steht an der Stelle der Überschrift. */
  kopf: ReactNode;
  /** Am Rechner der grüne Knopf „Zeitraum eintragen“ im Kopf. */
  aktionen: ReactNode;
  /** Die Liste – nur zeigen, wenn weder `laedt` noch `fehler`. */
  inhalt: ReactNode;
  /** Speichern-Leiste oder schwebendes Plus, dazu die Fenster. */
  ueberlagerung: ReactNode;
  laedt: boolean;
  fehler: boolean;
  neuLaden: () => Promise<unknown>;
}

/**
 * **„Wann kann ich?“ (Dienstplaner E5c-1c):** Mit dieser Angabe zeigt jeder Termin **Ja · Vielleicht · Nein** statt des
 * Hakens „Abwesend“. „Nein“ ist der bisherige Haken (eine ChurchTools-Abwesenheit mit Terminfenster); Ja und Vielleicht
 * gehören in den Speicher der Dienstgruppen (`@shared/dienstplan/verfuegbarkeit`) – wie sie dorthin kommen, regelt die App.
 * **Ohne diese Angabe bleibt alles wie bisher** (Musik-App: Abhakfeld).
 */
export interface Zusagen {
  /** Die gespeicherten eigenen Antworten (Termin-ID als Text → Antwort); leer, solange nichts da ist. */
  antworten: Antworten;
  /** Kann man Ja/Vielleicht speichern? Sonst sind die zwei Knöpfe gesperrt. */
  bereit: boolean;
  /** Der Hinweis oben, warum Ja/Vielleicht gesperrt ist; `null`, wenn es geht (oder noch lädt). */
  hinweis: string | null;
  /** Darf man den Speicher selbst einrichten? Dann steht neben dem Hinweis „Einrichten“. */
  einrichten?: { gruppen: string[]; los: () => Promise<void> };
  /**
   * Die **vollständige** neue Antworten-Karte speichern (gespeichert + vorgemerkt, `tag` = Tag des Termins). Wirft nicht;
   * ein Fehlschlag trägt den Text für die Person. Danach hat die App die Antworten neu geladen.
   */
  speichern: (antworten: Antworten) => Promise<{ ok: true } | { ok: false; text: string }>;
}

export interface AbwesenheitenSeiteProps {
  /** Schreiben braucht Netz (ChurchTools). */
  online: boolean;
  onToast: (text: string) => void;
  /** Heute im Kalender der Gemeinde (`YYYY-MM-DD`). */
  heute: string;
  /** Holt Einträge (von–bis), Termine (bis) und Gründe. Ein Hook – immer dieselbe Funktion übergeben. */
  useDaten: (bereich: { von: string; bis: string }) => AbwesenheitenDaten;
  schreiben: AbwesenheitenSchreiben;
  /**
   * Die Termin-Arten für den Filter-Knopf: in der Musik-App die der Gemeinde (#400), im Dienstplaner aus den Terminen
   * gebildet (Funktion – immer dieselbe übergeben, sonst rechnet der Filter bei jedem Zeichnen neu).
   */
  arten: TerminArt[] | ((termine: AbsenceEvent[]) => TerminArt[]);
  /** Die ausgeblendeten Arten, auf dem Gerät gemerkt. `lesen` liefert `null`, solange nichts gemerkt ist. */
  filter: {
    lesen: () => string[] | null;
    schreiben: (ids: string[]) => void;
    alteWahl: () => string[];
  };
  /**
   * Was unter einem Termin zusätzlich steht – im Dienstplaner die eigenen Dienste (E7-2c). `abwesend` = der Haken
   * sitzt (auch vorgemerkt), damit die App warnen kann („bitte auch den Dienst absagen“). Ohne: nichts.
   */
  terminZusatz?: (ev: AbsenceEvent, abwesend: boolean) => ReactNode;
  /** „Wann kann ich?“ – drei Knöpfe statt des Hakens, siehe `Zusagen`. Ohne: der Haken. */
  zusagen?: Zusagen;
  /** Setzt die Teile in den Rahmen der App. */
  rahmen: (teile: AbwesenheitenTeile) => ReactNode;
}

type Seite = 'termine' | 'eintraege';
/** Was ein Kästchen zeigt: der Eintrag dahinter, ob er zum Löschen vorgemerkt ist, ob der Haken sitzt. */
interface Kasten {
  absence: Absence | undefined;
  soll: boolean;
  vorgemerkt: boolean;
}

/**
 * Abwesenheiten (#177). Aufbau nach acht Entwurfsrunden mit Alwin (18./19.09.2026), Vorbild ist die
 * kleine Abwesenheits-App, die das Musikteam gern benutzt – „an diesem Sonntag kann ich nicht" soll
 * ein Häkchen sein, kein Fenster:
 *
 *  1. **Zeitraum-Knopf** wie im Dienstplaner (`ZeitraumKnopf`, seit 28.10.2026 – vorher eine Monatsleiste mit
 *     Kapseln): ab heute (vier Wochen), dieser oder nächster Monat, eigener Zeitraum. Daneben der **Filter-Knopf**
 *     (`FilterKnopf`) mit Häkchen je Termin-Art. Nur nach vorn – Vergangenes steht unter „Einträge → Früher".
 *  2. **Terminliste des Zeitraums**, nach Monaten überschrieben, mit einem **Abhakfeld** je Termin. Die Kästchen sind immer aktiv,
 *     aber ein Haken ist nur **vorgemerkt** (blauer Ring), bis man unten **Speichern** drückt – dann
 *     gehen alle Häkchen auf einmal nach ChurchTools (`useSaveAbsenceChanges`). Kein Bearbeiten-Modus:
 *     Alwins Frau wollte es wie im alten Planner – anfassen, dann speichern (19.09.2026).
 *  3. Ein Termin in einem **mehrtägigen** Zeitraum (Urlaub) lässt sich nicht stumm herausnehmen:
 *     `ZeitraumFrage` bietet „Zeitraum löschen" (vorgemerkt) oder „Zeitraum anpassen" (Fenster).
 *  4. Das **Plus** unten rechts trägt einen ganzen Zeitraum ein (`AbsenceSheet` mit Schnellwahl); es
 *     verschwindet, solange etwas vorgemerkt ist – dann ist die Speichern-Leiste der einzige Weg.
 *  5. **„Einträge"**: die eigenen Abwesenheiten, „Anstehend" und „Früher"; ein Tipp öffnet das Fenster
 *     zum Ändern und Löschen, Vergangenes nur zum Ansehen.
 *
 * Kopfleiste nur mit Titel, wie bei Termine und Lieder (Alwin, 19.09.2026).
 *
 * **Gemeinsamer Baustein seit Dienstplaner E7-2b** (04.11.2026): Die Seite gehört Musik-App und Dienstplaner. Was je App
 * verschieden ist, kommt von außen – Daten (`useDaten`), Schreiben (`schreiben`), Rahmen (`rahmen`), Termin-Arten und
 * die gemerkte Filter-Wahl. Seit E7-2b sehen alle Einträge gleich aus, egal wo sie eingetragen wurden, und Löschen fragt
 * immer nach (kein Kennzeichen „[Musikteam]“ mehr, Alwin 04.11.2026).
 */
export function AbwesenheitenSeite({
  online,
  onToast,
  heute,
  useDaten,
  schreiben,
  arten: artenVorgabe,
  filter,
  terminZusatz,
  zusagen,
  rahmen,
}: AbwesenheitenSeiteProps) {
  const laufend = monatVon(heute);
  const bisMonat = monatPlus(laufend, RASTER_MONATE - 1);
  /** Gezeigter Zeitraum – beim Öffnen „ab heute“, nicht gemerkt (Vergangenes zählt hier nicht). */
  const [zeitraum, setZeitraum] = useState<Zeitraum>(AB_HEUTE);
  const grenzen = zeitraumGrenzen(zeitraum, heute) ?? {
    von: heute,
    bis: plusTage(heute, AB_HEUTE_TAGE - 1),
  };
  // Höchstens so weit holt der Server Termine (ein Jahr, `MAX_VORAUS_TAGE`) – einen Tag Luft für die Zeitzone. Weiter
  // lässt der Zeitraum-Knopf einen eigenen Zeitraum nicht reichen.
  const spaetestens = plusTage(heute, MAX_VORAUS_TAGE - 1);
  // Geholt werden die nächsten zwölf Monate; ein eigener Zeitraum darüber hinaus holt nach.
  const vorab = letzterTag(bisMonat);
  const ladenBis = grenzen.bis > vorab ? grenzen.bis : vorab;
  const daten = useDaten({ von: plusTage(heute, -RUECKBLICK_TAGE), bis: ladenBis });
  /** Was gerade geschrieben wird – Fenster, einzelnes Löschen oder die gesammelten Häkchen. */
  const [laeuft, setLaeuft] = useState<'fenster' | 'loeschen' | 'sichern' | null>(null);

  const [seite, setSeite] = useState<Seite>('termine');
  const [frueher, setFrueher] = useState(false);
  /**
   * Vorgemerkte Häkchen: **Termin-ID** → gewünschter Zustand (true = abwesend).
   *
   * Bis zum 22.09.2026 stand hier der Tag. Damit hingen zwei Termine am selben Tag zusammen – genau
   * das, was Alwin gestört hat („manchmal hab ich morgens keine Zeit kann aber nachmittags").
   */
  const [pending, setPending] = useState<Record<number, boolean>>({});
  /** Vorgemerkt zu löschende Zeiträume (IDs). */
  const [loeschen, setLoeschen] = useState<number[]>([]);
  /**
   * Vorgemerkte Ja/Vielleicht-Antworten (nur mit `zusagen`): **Termin-ID** → gewünschte Antwort, `null` = Antwort weg.
   * Ein Eintrag steht nur da, solange er vom Gespeicherten abweicht.
   */
  const [pendingZ, setPendingZ] = useState<Record<number, Zusage | null>>({});
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [frage, setFrage] = useState<{
    tag: string;
    absence: Absence;
    /** Die anderen Termine, die derselbe Eintrag abdeckt – leer bei einem reinen Zeitraum. */
    weitere: string[];
    /** „Ja/Vielleicht“ an diesem Termin gewählt, während ein Zeitraum ihn abdeckt: erst nach „Zeitraum löschen“ vormerken. */
    danach?: { ev: AbsenceEvent; wahl: Zusage };
  } | null>(null);
  /**
   * Ausgeblendete Termin-Arten (#400, seit 28.10.2026 mit Häkchen) – vom Gerät gelesen, dorthin geschrieben. `null`:
   * noch nichts gemerkt, dann gilt die umgerechnete alte Wahl (siehe unten).
   */
  const [aus, setAus] = useState<string[] | null>(filter.lesen);

  const liste = useMemo(() => daten.eintraege ?? [], [daten.eintraege]);
  const alleEvents = useMemo(() => daten.termine ?? [], [daten.termine]);
  const anstehend = liste
    .filter((a) => a.endDate >= heute)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const frueherListe = liste
    .filter((a) => a.endDate < heute)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  /**
   * Der Termin-Filter (#400): Den Knopf gibt es nur, wenn es etwas zu wählen gibt – bei einer einzigen
   * Art wäre ein Menü mit einem Häkchen eine Frage ohne Antwort (`FilterKnopf` blendet sich dann selbst aus). Die
   * Auswahl wirkt auf die Liste UND auf die Zahl am Zeitraum-Knopf; die vorgemerkten Häkchen „Abwesend“ hängen am
   * Termin, nicht an der Liste, und überstehen jeden Filterwechsel. Die Regeln stehen in `terminFilter.ts`.
   */
  // Die Arten: fest (Musik-App, vom Admin gepflegt) oder aus den Terminen gebildet (Dienstplaner, wie in „Dienste“).
  const arten = useMemo(
    () => (typeof artenVorgabe === 'function' ? artenVorgabe(alleEvents) : artenVorgabe),
    [artenVorgabe, alleEvents],
  );
  const knoepfe = useMemo(() => knoepfeAus(arten, alleEvents), [arten, alleEvents]);
  // Noch nichts gemerkt: die Wahl der alten Art („nur Gottesdienst“) einmal umrechnen – gespeichert wird erst beim
  // ersten Häkchen, bis dahin gilt die Umrechnung bei jedem Öffnen gleich.
  const ausgeblendet = aus ?? ausgeblendetAusAlterWahl(filter.alteWahl(), knoepfe);
  const setzeAusgeblendet = (neu: string[]): void => {
    setAus(neu);
    filter.schreiben(neu);
  };
  // Termine im Zeitraum – nur ab heute (Vergangenes steht unter „Einträge → Früher“), ohne ausgeblendete Arten.
  const ab = grenzen.von > heute ? grenzen.von : heute;
  const zeitraumEvents = filtereTermine(
    alleEvents.filter((e) => e.date >= ab && e.date <= grenzen.bis),
    ausgeblendet,
    arten,
  );
  const monatsGruppen = [...new Set(zeitraumEvents.map((e) => monatVon(e.date)))].map((m) => ({
    monat: m,
    events: zeitraumEvents.filter((e) => monatVon(e.date) === m),
  }));
  const terminText = (n: number) => `${n} ${n === 1 ? 'Termin' : 'Termine'}`;

  // Ein Wechsel Nein → Ja ist EIN Schritt für die Person: Termin mit Abwesenheit UND Antwort zählt einmal, ebenso der
  // Zeitraum, der nur wegen einer Antwort gelöscht wird.
  const zusageTermine = Object.keys(pendingZ).map(Number);
  const geaenderteTermine = new Set([...Object.keys(pending).map(Number), ...zusageTermine]);
  const loeschenOhneAntwort = loeschen.filter(
    (id) =>
      !zusageTermine.some((tid) => {
        const t = alleEvents.find((e) => e.id === tid);
        return t !== undefined && abwesenheitFuerTermin(liste, t)?.id === id;
      }),
  );
  const anzahl = geaenderteTermine.size + loeschenOhneAntwort.length;

  const meldeFehler = (e: unknown, sonst: string): void => {
    onToast(e instanceof ApiError ? e.message : sonst);
  };

  /* ---------------------------------------------------------------- Häkchen (vorgemerkt) */

  const kasten = (ev: AbsenceEvent): Kasten => {
    const absence = abwesenheitFuerTermin(liste, ev);
    const weg = absence !== undefined && loeschen.includes(absence.id);
    const soll = weg ? false : ev.id in pending ? pending[ev.id] : absence !== undefined;
    return { absence, soll, vorgemerkt: ev.id in pending || weg };
  };

  const haken = (ev: AbsenceEvent, danach?: Zusage): void => {
    if (!online) return onToast('Zum Ändern brauchst du Netz.');
    const a = abwesenheitFuerTermin(liste, ev);
    /**
     * **Deckt der Eintrag mehr ab als diesen einen Termin?** Dann wird gefragt statt stumm gelöscht.
     *
     * Bis zum 23.09.2026 stand hier nur „mehrtägig" – ein **ganztägiger** Eintrag deckt aber ebenso
     * jeden Termin des Tages. Wer bei einem Termin den Haken wegnahm, löschte ihn damit auch für den
     * anderen, ohne Warnung und ohne sichtbare Vormerkung. Das traf JEDEN Bestandseintrag, denn die
     * sind alle ganztägig (Fund im Code-Check vor v2.25.2).
     */
    const weitere = a ? alleEvents.filter((e) => e.id !== ev.id && decktTermin(a, e)) : [];
    if (a && (a.startDate !== a.endDate || weitere.length > 0)) {
      // Entweder die vorgemerkte Löschung zurücknehmen – oder nachfragen.
      if (loeschen.includes(a.id)) setLoeschen((l) => l.filter((id) => id !== a.id));
      else {
        setFrage({
          tag: ev.date,
          absence: a,
          weitere: weitere.map((e) => e.name),
          ...(danach ? { danach: { ev, wahl: danach } } : {}),
        });
      }
      return;
    }
    const ist = a !== undefined;
    const soll = ev.id in pending ? !pending[ev.id] : !ist;
    setPending((p) => {
      const n = { ...p };
      if (soll === ist) delete n[ev.id];
      else n[ev.id] = soll;
      return n;
    });
    if (danach) merkeZusage(ev, danach);
  };

  /* ---------------------------------------------------------------- Ja / Vielleicht (nur mit `zusagen`) */

  const gespeicherteZusage = (ev: AbsenceEvent): Zusage | null =>
    zusagen?.antworten[String(ev.id)]?.a ?? null;

  /** Eine Antwort vormerken – steht sie schon so gespeichert da, ist nichts vorzumerken. */
  const merkeZusage = (ev: AbsenceEvent, z: Zusage | null): void => {
    setPendingZ((p) => {
      const n = { ...p };
      if (z === gespeicherteZusage(ev)) delete n[ev.id];
      else n[ev.id] = z;
      return n;
    });
  };

  /**
   * Was der Termin zeigt. **Eine ChurchTools-Abwesenheit gilt immer** (Nein), auch wenn noch eine alte Ja-Antwort
   * gespeichert ist – ChurchTools plant eine abwesende Person nicht ein.
   */
  const antwortFuer = (ev: AbsenceEvent): Zusage | 'nein' | null => {
    if (kasten(ev).soll) return 'nein';
    return ev.id in pendingZ ? pendingZ[ev.id] : gespeicherteZusage(ev);
  };

  const waehle = (ev: AbsenceEvent, wahl: Zusage | 'nein'): void => {
    if (!online) return onToast('Zum Ändern brauchst du Netz.');
    // „Nein“ ist der Haken: ein Tipp setzt ihn, ein zweiter nimmt ihn weg. Eine vorgemerkte Ja-Antwort bleibt dabei
    // stehen (und kommt zurück, wenn man „Nein“ wieder wegnimmt); gespeichert wird sie nur, wo kein „Nein“ gilt.
    if (wahl === 'nein') return haken(ev);
    if (!zusagen?.bereit) return;
    const jetzt = antwortFuer(ev);
    // Ja/Vielleicht auf einem „Nein“: erst die Abwesenheit wegnehmen (mit der Rückfrage bei Zeiträumen), die Antwort
    // dann gleich mit vormerken.
    if (jetzt === 'nein') return haken(ev, wahl);
    // Noch einmal auf den aktiven Knopf: die Antwort ist weg.
    merkeZusage(ev, jetzt === wahl ? null : wahl);
  };

  /** Die neue Antworten-Karte; `null`, wenn sich gegenüber dem Gespeicherten nichts ändert. */
  const neueZusagen = (): Antworten | null => {
    if (!zusagen) return null;
    const karte: Antworten = { ...zusagen.antworten };
    for (const [id, z] of Object.entries(pendingZ)) {
      const ev = alleEvents.find((e) => e.id === Number(id));
      if (!ev) continue;
      if (z) karte[id] = { a: z, tag: ev.date };
      else delete karte[id];
    }
    // Wo „Nein“ gilt (Abwesenheit steht oder wird eingetragen), gibt es keine Ja/Vielleicht-Antwort.
    for (const ev of alleEvents) if (kasten(ev).soll) delete karte[String(ev.id)];
    return gleicheAntworten(karte, zusagen.antworten) ? null : karte;
  };

  const verwerfen = (): void => {
    setPending({});
    setLoeschen([]);
    setPendingZ({});
  };

  const speichernAlles = (): void => {
    /** Zu einer vorgemerkten Termin-ID den Termin selbst – ohne ihn gäbe es kein Zeitfenster. */
    const terminZu = (id: string): AbsenceEvent | undefined =>
      alleEvents.find((e) => e.id === Number(id));
    const eintragen = Object.entries(pending)
      .filter(([, soll]) => soll)
      .map(([id]) => terminZu(id))
      .filter((ev): ev is AbsenceEvent => ev !== undefined)
      .map((ev) => {
        // Ein Haken trägt das Zeitfenster GENAU dieses Termins ein; ohne bekanntes Ende den Tag.
        const fenster = zeitfensterFuer(ev);
        return { startDate: ev.date, endDate: ev.date, ...(fenster ?? {}) };
      });
    const weg = [
      ...loeschen,
      ...Object.entries(pending)
        .filter(([, soll]) => !soll)
        .map(([id]) => {
          const ev = terminZu(id);
          return ev && abwesenheitFuerTermin(liste, ev)?.id;
        })
        .filter((id): id is number => id !== undefined),
    ];
    const zusageNeu = neueZusagen();
    setLaeuft('sichern');
    void (async () => {
      try {
        /**
         * **Nacheinander, nicht parallel:** ChurchTools drosselt (429, #383), und ein Musiker hakt selten mehr als drei
         * Termine auf einmal ab. Erst anlegen, dann löschen – so ist nach einem Fehlschlag in der Mitte höchstens ein
         * Haken zu viel gesetzt, nie einer zu wenig. Danach in jedem Fall neu holen (`geaendert`).
         */
        for (const e of eintragen) await schreiben.anlegen(e);
        for (const id of weg) await schreiben.loeschen(id);
        const n = zusagen ? anzahl : eintragen.length + weg.length;
        // Danach, in EINEM Aufruf, die Antworten. Gelingt das nicht ganz, bleiben sie vorgemerkt – die Abwesenheiten
        // stehen dann schon und werden nicht noch einmal geschrieben.
        let zusageFehler: string | null = null;
        if (zusagen && zusageNeu) {
          try {
            const r = await zusagen.speichern(zusageNeu);
            if (!r.ok) zusageFehler = r.text;
          } catch {
            zusageFehler = 'Ja/Vielleicht konnte nicht gespeichert werden – bitte noch einmal.';
          }
        }
        if (zusageFehler === null) {
          verwerfen();
          onToast(
            `${n} ${n === 1 ? 'Änderung' : 'Änderungen'} gespeichert – steht jetzt in ChurchTools.`,
          );
        } else {
          setPending({});
          setLoeschen([]);
          onToast(
            eintragen.length + weg.length > 0
              ? `Abwesenheiten gespeichert. ${zusageFehler}`
              : zusageFehler,
          );
        }
      } catch (e) {
        meldeFehler(e, 'Konnte nicht gespeichert werden – bitte noch einmal.');
      } finally {
        setLaeuft(null);
        schreiben.geaendert();
      }
    })();
  };

  /* ---------------------------------------------------------------- Fenster (Zeitraum, Ändern) */

  const speichernFenster = (neu: NeueAbsence): void => {
    const id = entwurf?.art === 'aendern' ? entwurf.absence.id : null;
    const fertig = (text: string) => (): void => {
      setEntwurf(null);
      onToast(text);
    };
    setLaeuft('fenster');
    void (id === null ? schreiben.anlegen(neu) : schreiben.aendern(id, neu))
      .then(
        fertig(
          id === null ? 'Eingetragen – steht jetzt als Abwesenheit in ChurchTools.' : 'Geändert.',
        ),
        (e) =>
          meldeFehler(
            e,
            id === null ? 'Konnte nicht eingetragen werden.' : 'Konnte nicht geändert werden.',
          ),
      )
      .finally(() => {
        setLaeuft(null);
        schreiben.geaendert();
      });
  };

  const entfernen = (a: Absence): void => {
    setLaeuft('loeschen');
    void schreiben
      .loeschen(a.id)
      .then(
        () => {
          setEntwurf(null);
          onToast('Gelöscht.');
        },
        (e) => meldeFehler(e, 'Konnte nicht gelöscht werden.'),
      )
      .finally(() => {
        setLaeuft(null);
        schreiben.geaendert();
      });
  };

  const zeitraumOeffnen = (): void => {
    if (!online) return onToast('Zum Eintragen brauchst du Netz.');
    const naechster = alleEvents.find((e) => e.date >= heute)?.date ?? heute;
    setEntwurf({ art: 'neu', tag: naechster });
  };

  const { laedt, fehler, neuLaden } = daten;

  /* ---------------------------------------------------------------- Zeilen */

  const datumKachel = (tag: string, dritteZeile: string, ton: 'blau' | 'rot') => (
    <div
      className={`${styles.datum}${ton === 'rot' ? ' ' + styles.datumRot : ''}`}
      aria-hidden="true"
    >
      <b>{tagImMonat(tag)}</b>
      <small>{monatNurKurz(monatVon(tag))}.</small>
      <em>{dritteZeile}</em>
    </div>
  );

  /** Ja · Vielleicht · Nein – eine Gruppe, der gewählte Knopf trägt `aria-pressed` (Variante 1A, Entwurf 18.11.2026). */
  const dreiKnoepfe = (ev: AbsenceEvent, k: Kasten) => {
    const jetzt = antwortFuer(ev);
    const wahlen: { wert: Zusage | 'nein'; text: string; klasse: string }[] = [
      { wert: 'ja', text: 'Ja', klasse: styles.antwortJa },
      { wert: 'vielleicht', text: 'Vielleicht', klasse: styles.antwortVielleicht },
      { wert: 'nein', text: 'Nein', klasse: styles.antwortNein },
    ];
    return (
      <div
        className={styles.antwort}
        role="group"
        aria-label={`Antwort – ${ev.name}, ${tagKurz(ev.date)}`}
      >
        {wahlen.map((w) => {
          const an = jetzt === w.wert;
          const vorgemerkt = w.wert === 'nein' ? k.vorgemerkt : ev.id in pendingZ;
          const gesperrt = w.wert === 'nein' ? !online : !zusagen?.bereit;
          return (
            <button
              key={w.wert}
              type="button"
              className={`${w.klasse}${an ? ' ' + styles.antwortAn : ''}${an && vorgemerkt ? ' ' + styles.antwortVorgemerkt : ''}`}
              aria-pressed={an}
              aria-label={`${w.text} – ${ev.name}, ${tagKurz(ev.date)}`}
              disabled={gesperrt || laeuft === 'sichern'}
              onClick={() => waehle(ev, w.wert)}
            >
              {w.text}
            </button>
          );
        })}
      </div>
    );
  };

  const terminZeile = (ev: AbsenceEvent) => {
    const k = kasten(ev);
    const a = k.absence;
    const teil = a !== undefined && a.startDate !== a.endDate;
    return (
      <div
        key={`ev-${ev.id}`}
        className={`${styles.zeile}${zusagen ? ' ' + styles.zeileAntwort : ''}`}
      >
        {datumKachel(ev.date, uhrzeit(ev.startDate), k.soll ? 'rot' : 'blau')}
        <div className={styles.text}>
          <span className={styles.titel}>{ev.name}</span>
          <span className={styles.sub}>
            {wochentagLang(ev.date)}
            {a && k.soll
              ? ` · ${a.reason ?? 'Abwesend'}${teil ? ` · ${zeitraumKurz(a)}` : ''}${
                  zeitfensterKurz(a) ? ` · ${zeitfensterKurz(a)}` : ''
                }`
              : ''}
          </span>
          {terminZusatz?.(ev, k.soll)}
        </div>
        {zusagen ? (
          dreiKnoepfe(ev, k)
        ) : (
          <button
            className={`${styles.kasten}${k.soll ? ' ' + styles.kastenAn : ''}${k.vorgemerkt ? ' ' + styles.vorgemerkt : ''}`}
            aria-pressed={k.soll}
            aria-label={`Abwesend – ${ev.name}, ${tagKurz(ev.date)}`}
            disabled={!online || laeuft === 'sichern'}
            onClick={() => haken(ev)}
          >
            <span className={styles.box}>{k.soll ? '✓' : ''}</span>
            Abwesend
          </button>
        )}
      </div>
    );
  };

  const abwesenheitZeile = (a: Absence, vergangen: boolean) => {
    const trifft = vergangen ? [] : alleEvents.filter((e) => decktTermin(a, e));
    return (
      <button
        key={`ab-${a.id}`}
        className={`${styles.zeile} ${styles.zeileTip}${vergangen ? ' ' + styles.vergangen : ''}`}
        disabled={!online && !vergangen}
        onClick={() => setEntwurf({ art: 'aendern', absence: a })}
        aria-label={`Abwesenheit ${zeitraumKurz(a)} ${vergangen ? 'ansehen' : 'ändern'}`}
      >
        {/*
          Die dritte Zeile der Kachel zeigt die Uhrzeit, sobald der Eintrag ein Zeitfenster hat –
          sonst den Wochentag wie bisher. Seit ein Haken das Fenster des Termins einträgt
          (22.09.2026), können an einem Tag mehrere Einträge stehen; ohne die Uhrzeit sähen sie
          gleich aus.
        */}
        {datumKachel(
          a.startDate,
          zeitfensterKurz(a) ? uhrzeit(a.startTime ?? '') : tagKurz(a.startDate).slice(0, 2),
          'rot',
        )}
        <div className={styles.text}>
          <span className={styles.titel}>
            {a.reason ?? 'Abwesend'}
            {a.startDate !== a.endDate ? ` · ${zeitraumKurz(a)}` : ''}
            {zeitfensterKurz(a) ? ` · ${zeitfensterKurz(a)}` : ''}
          </span>
          <span className={styles.sub}>
            {[
              trifft.length
                ? `trifft ${trifft.map((e) => tagKurz(e.date)).join(', ')}`
                : vergangen
                  ? ''
                  : 'trifft keinen Termin',
              a.comment,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <span className={styles.chev}>
          <Icon name="chev-right" size={18} />
        </span>
      </button>
    );
  };

  /** Einträge nach Monat gruppiert – die Reihenfolge der Liste bleibt (anstehend aufwärts, früher abwärts). */
  const gruppiert = (eintraege: Absence[]) => {
    const monate = [...new Set(eintraege.map((a) => monatVon(a.startDate)))];
    return monate.map((m) => ({
      monat: m,
      eintraege: eintraege.filter((a) => monatVon(a.startDate) === m),
    }));
  };

  const termineSeite = (
    <>
      <div className={styles.werkzeug}>
        {/* Zeitraum- und Filter-Knopf: dieselben Komponenten wie im Dienstplaner (28.10.2026). */}
        <div data-tour="verf-zeitraum">
          <ZeitraumKnopf
            zeitraum={zeitraum}
            zeile1={
              zeitraum.art === 'abHeute'
                ? spanneText(grenzen.von, grenzen.bis)
                : zeitraumText(zeitraum)
            }
            zeile2={`${terminText(zeitraumEvents.length)}${zeitraum.art === 'abHeute' ? ' · ab heute' : ''}`}
            heute={heute}
            abHeuteZusatz="die nächsten 4 Wochen"
            spaetestens={spaetestens}
            fruehestens={`${laufend}-01`}
            onWahl={setZeitraum}
          />
        </div>
        {knoepfe.length > 1 && (
          <div data-tour="verf-filter">
            <FilterKnopf
              abschnitte={[
                {
                  titel: 'Veranstaltungen',
                  optionen: knoepfe.map((k) => ({ wert: k.id, text: k.name })),
                  aus: ausgeblendet,
                  onAus: setzeAusgeblendet,
                },
              ]}
            />
          </div>
        )}
      </div>
      {zusagen?.hinweis && (
        <ZusageHinweis hinweis={zusagen.hinweis} einrichten={zusagen.einrichten} />
      )}
      <section data-tour="verf-termine">
        {monatsGruppen.length === 0 && (
          <div className={styles.liste}>
            <div className={styles.leer}>Kein Termin in diesem Zeitraum.</div>
          </div>
        )}
        {monatsGruppen.map((g) => (
          <Fragment key={g.monat}>
            <div className={styles.sec}>
              {monatLabel(g.monat)}
              <span>{terminText(g.events.length)}</span>
            </div>
            <div className={styles.liste}>{g.events.map(terminZeile)}</div>
          </Fragment>
        ))}
      </section>
      {/**
       * Der Halbsatz beantwortet die Frage, die Alwin am 05.09.2026 beim Durchklicken hatte: „Sind
       * das die Termine, bei denen ich eingetragen bin?" Nein – es sind ALLE, die das Konto in
       * ChurchTools sehen darf. Wer welchen Dienst hat, weiß die App nicht (Dienst-Einteilung ist Phase 2).
       */}
      <p className={styles.hinweis}>
        Alle Termine aus ChurchTools – wer eingeteilt ist, spielt hier keine Rolle.{' '}
        {zusagen
          ? 'Deine Antwort wird erst mit „Speichern“ übernommen – Ja und Vielleicht kann deine Dienstgruppe sehen, Nein steht als Abwesenheit in ChurchTools.'
          : 'Ein Haken wird erst mit „Speichern" eingetragen.'}
      </p>
    </>
  );

  const eintraegeListe = frueher ? frueherListe : anstehend;
  const eintraegeSeite = (
    <>
      <Segment
        ariaLabel="Zeitraum"
        value={frueher ? 'frueher' : 'anstehend'}
        onChange={(v) => setFrueher(v === 'frueher')}
        options={[
          { value: 'anstehend', label: `Anstehend (${anstehend.length})` },
          { value: 'frueher', label: `Früher (${frueherListe.length})` },
        ]}
      />
      {eintraegeListe.length === 0 ? (
        <div className={styles.leerBox}>
          <b>{frueher ? 'Nichts in der Vergangenheit.' : 'Noch nichts eingetragen.'}</b>
          {frueher
            ? 'Was du einträgst, bleibt hier ein Jahr lang stehen.'
            : zusagen
              ? 'Unter „Termine“ bei einem Termin „Nein“ wählen – oder über das Plus einen Zeitraum eintragen.'
              : 'Unter „Termine" ein Kästchen abhaken – oder über das Plus einen Zeitraum eintragen.'}
        </div>
      ) : (
        gruppiert(eintraegeListe).map((g) => (
          <section key={g.monat}>
            <div className={styles.sec}>{monatLabel(g.monat)}</div>
            <div className={styles.liste}>
              {g.eintraege.map((a) => abwesenheitZeile(a, frueher))}
            </div>
          </section>
        ))
      )}
      {!frueher && eintraegeListe.length > 0 && (
        <p className={styles.hinweis}>
          Tipp auf eine Zeile: Zeitraum, Grund oder Kommentar ändern, löschen – auch Einträge, die
          du direkt in ChurchTools gemacht hast.
        </p>
      )}
    </>
  );

  /**
   * Was über dem Inhalt schwebt: die Speichern-Leiste (sobald etwas vorgemerkt ist) oder das Plus,
   * dazu die Fenster und die Einführung. Es scrollt nicht mit, deshalb steht es neben dem Inhalt
   * und nicht darin.
   */
  // Am iPad/Rechner grün im Seitenkopf, am Handy das Plus (`useNeuAnlegen`). Solange etwas vorgemerkt ist, gibt es
  // keins – EIN Speichern-Weg.
  const neu = useNeuAnlegen({
    label: 'Zeitraum eintragen',
    onClick: zeitraumOeffnen,
    sichtbar: !laedt && !fehler && anzahl === 0,
    disabled: !online,
    dataTour: 'verf-plus',
  });

  const ueberlagerung = (
    <>
      {anzahl > 0 ? (
        <div className={styles.leiste} role="status">
          <button className={styles.verwerfen} onClick={verwerfen} disabled={laeuft === 'sichern'}>
            Verwerfen
          </button>
          <span className={styles.leisteInfo}>
            {anzahl} {anzahl === 1 ? 'Änderung' : 'Änderungen'} vorgemerkt
          </span>
          <button
            className={styles.speichern}
            onClick={speichernAlles}
            disabled={laeuft === 'sichern'}
          >
            {laeuft === 'sichern' ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      ) : (
        neu.schwebend
      )}

      {entwurf && (
        <AbsenceSheet
          entwurf={entwurf}
          heute={heute}
          laeuft={laeuft === 'fenster'}
          loeschtGerade={laeuft === 'loeschen'}
          gruende={daten.gruende ?? []}
          standardGrund={daten.gruende?.find((g) => g.standard)?.id ?? null}
          nurLesen={entwurf.art === 'aendern' && entwurf.absence.endDate < heute}
          onClose={() => setEntwurf(null)}
          onSubmit={speichernFenster}
          onDelete={entfernen}
        />
      )}

      {frage && (
        <ZeitraumFrage
          tag={frage.tag}
          absence={frage.absence}
          weitereTermine={frage.weitere}
          onLoeschen={() => {
            setLoeschen((l) => (l.includes(frage.absence.id) ? l : [...l, frage.absence.id]));
            if (frage.danach) merkeZusage(frage.danach.ev, frage.danach.wahl);
            setFrage(null);
          }}
          onAnpassen={() => {
            setEntwurf({ art: 'aendern', absence: frage.absence });
            setFrage(null);
          }}
          onClose={() => setFrage(null)}
        />
      )}
    </>
  );

  return rahmen({
    // „Termine | Einträge“ steht an der Stelle der Überschrift – „Abwesenheiten“ sagt schon der Reiter (28.10.2026).
    kopf: (
      <Segment
        ariaLabel="Ansicht"
        value={seite}
        onChange={setSeite}
        options={[
          { value: 'termine', label: 'Termine' },
          {
            value: 'eintraege',
            label: (
              <>
                Einträge
                {anstehend.length > 0 && <span className={styles.zaehler}>{anstehend.length}</span>}
              </>
            ),
          },
        ]}
      />
    ),
    aktionen: neu.kopf,
    inhalt: (
      <div className={styles.wrap}>{seite === 'termine' ? termineSeite : eintraegeSeite}</div>
    ),
    ueberlagerung,
    laedt,
    fehler,
    neuLaden,
  });
}

/**
 * Der Hinweis oben, wenn Ja/Vielleicht gesperrt ist – mit „Einrichten“, wenn man den Speicher selbst anlegen darf (wie
 * bei den Entwürfen in „Planen“: erst nach dem Recht fragen, sonst entsteht ein zweiter). Scheitert es, steht der Grund da.
 */
function ZusageHinweis({
  hinweis,
  einrichten,
}: {
  hinweis: string;
  einrichten: Zusagen['einrichten'];
}) {
  const [stand, setStand] = useState<
    { art: 'bereit' | 'laeuft' } | { art: 'fehler'; text: string }
  >({
    art: 'bereit',
  });
  const los = async (): Promise<void> => {
    if (!einrichten) return;
    setStand({ art: 'laeuft' });
    try {
      await einrichten.los();
      setStand({ art: 'bereit' });
    } catch (e) {
      setStand({
        art: 'fehler',
        text: e instanceof Error ? e.message : 'Einrichten hat nicht geklappt.',
      });
    }
  };
  return (
    <div className={styles.zusageHinweis} role="note">
      <p>{hinweis}</p>
      {einrichten && (
        <>
          <p>
            <b>Für {einrichten.gruppen.map((g) => `„${g}“`).join(', ')} einrichten.</b> Dafür gibt
            es in ChurchTools noch keinen Platz – oder du darfst ihn nur nicht sehen. Dann bitte
            erst nach dem Recht fragen, sonst entsteht ein zweiter. Danach stellt die
            Gemeinde-Verwaltung in ChurchTools ein, wer die Antworten sehen und ändern darf.
          </p>
          <button
            type="button"
            className={styles.einrichten}
            disabled={stand.art === 'laeuft'}
            onClick={() => void los()}
          >
            {stand.art === 'laeuft' ? 'Wird eingerichtet …' : 'Einrichten'}
          </button>
          {stand.art === 'fehler' && (
            <p className={styles.zusageFehler} role="alert">
              {stand.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
