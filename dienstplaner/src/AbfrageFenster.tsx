import { useEffect, useRef, useState } from 'react';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { tagMonat } from '@shared/ct/datum';
import { gemeindeZeitzone, tagAusIso } from '@shared/ct/zeit';
import type { SpeicherErgebnis } from '@shared/ct/versionierterWert';
import {
  abfragenAus,
  geltenderPlan,
  laufendeAbfrage,
  type AbfragenInhalt,
} from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import {
  formularFehler,
  formularStart,
  heuteZeilenText,
  lageAus,
  mitBeendeterAbfrage,
  mitNeuerAbfrage,
  neueAbfrage,
  oeffnenTagAus,
  standAbschnitte,
  zeitleiste,
} from '@shared/dienstplan/abfrageFenster';
import { abfrageRoutinenSchritte } from '@shared/dienstplan/abfrageAutomatik';
import type { SchubladenStand } from '@shared/dienstplan/entwuerfe';
import { abfrageRegelAus } from '@shared/dienstplan/erinnern';
import type { Personenliste } from '@shared/dienstplan/personenliste';
import { gruppenName, type Plan, type PlanGruppe } from '@shared/dienstplan/plan';
import {
  abgleichen,
  eintragen,
  eintragenText,
  fehlendeNachtragen,
  gruppeLeeren,
  startVorbereiten,
  type AutomatikAnschluss,
  type PersonNr,
} from './abfrageAutomatikLauf';
import { AbfrageStand } from './AbfrageStand';
import { AbfrageStart } from './AbfrageStart';
import { ABFRAGE_UNLESBAR, abfrageOhneAblage, abfragenFehlerText } from './abfragenTexte';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import { abfrageLink } from './ladeErinnern';
import type { TermineDaten } from './ladeTermine';
import { useAbfrageLage } from './useAbfrageLage';
import styles from './AbfrageFenster.module.scss';

/** Was das Fenster „Abfrage“ von außen braucht: Lesen und Speichern der Abfragen einer Dienstgruppe, und wer es tut. */
export interface AbfrageAnschluss {
  lesen: (dienstgruppeId: number) => Promise<AbfragenStand>;
  speichern: (
    dienstgruppeId: number,
    neu: AbfragenInhalt,
    von: { personId: number; name: string },
    erwartet: number | null,
  ) => Promise<SpeicherErgebnis<AbfragenInhalt>>;
  /**
   * Der Stand der Ablage „Antworten <Gruppe>“ (V-4): Eine Abfrage „Nur abwesend“ startet nur, wenn sie `bereit` ist – ohne sie gibt es kein
   * „Fertig“. Ohne Angabe wird nicht geprüft.
   */
  ablageStand?: (dienstgruppe: { id: number; name: string }) => Promise<SchubladenStand>;
  /** Wer startet und beendet – kommt in `gestartet`. */
  ich: { personId: number; name: string };
  /**
   * Die Automatik in ChurchTools (R-5b): Mitglieder der Hilfsgruppe. Fehlt sie, startet und endet jede Abfrage wie vor R-5b –
   * ohne Erinnerungen von ChurchTools.
   */
  automatik?: AutomatikAnschluss;
  /** Die Adresse von „Verfügbarkeit“ mit der Abfrage **der Dienstgruppe** (Knopf in der Mail). Standard: `abfrageLink`. */
  link?: (dienstgruppeId: number) => string;
  /** Nur für Tests: die ID einer neuen Abfrage und der Zeitpunkt. */
  neueId?: () => string;
  jetzt?: () => string;
}

/**
 * Wer beim Start nicht in die Hilfsgruppe kam – je Abfrage, für „Fehlende nachtragen“. Im Speicher dieser Sitzung (nicht im
 * Dokument): Nachgetragen wird nur am Starttag, und die Abfrage-ID ist der Schlüssel.
 */
const FEHLENDE = new Map<string, PersonNr[]>();

const fehlendeKeyFuer = (dienstgruppeId: number | null, abfrageId: string): string | null =>
  dienstgruppeId === null ? null : `${dienstgruppeId}:${abfrageId}`;

const zufallsId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * **Das Fenster „Abfrage“** (Bauplan R-2, Entwurf `runden-entwurf.html` Schritt 3 und 6): Hat die gewählte Dienstgruppe eine
 * laufende Abfrage (auch eine, die erst öffnet), zeigt es ihren **Stand**; sonst das Formular zum **Starten**. Eine Abfrage
 * je Dienstgruppe zur Zeit.
 *
 * **Hausregeln des Speichers** (wie `EinstellungenFenster`): Gelesen wird beim Öffnen frisch. Ein Lesefehler sperrt Starten
 * und Beenden (es gälte sonst ein „keine Abfrage“, das nicht stimmt). Ein **unlesbarer** Wert wird nie überschrieben – er kann
 * aus einer neueren Fassung stammen. Hat inzwischen ein anderer gespeichert, wird nichts überschrieben und der neue Stand
 * erscheint (hat dort jemand eine Abfrage gestartet, springt das Fenster auf deren Stand). Es wird nie automatisch
 * wiederholt.
 *
 * **Zeitraum:** Vorbelegt mit dem Zeitraum, den Planen zeigt. Liegt der gewählte Zeitraum nicht im geladenen Plan, lädt
 * `useAbfrageLage` ihn über `ladeZeitraum` nach – die Zahlen und die Termine der Abfrage stimmen also für jeden Zeitraum.
 */
export function AbfrageFenster({
  plan,
  spalten,
  gruppen,
  heute,
  ladeZeitraum,
  ladePersonen,
  ladeAntworten,
  personenlisten,
  anschluss,
  onClose,
}: {
  /** Der Plan, den Planen gerade zeigt. */
  plan: Plan;
  /** Die gezeigten Spalten (Indizes in `plan.spalten`) – daraus kommt die Vorbelegung des Zeitraums. */
  spalten: readonly number[];
  /** Die planbaren Dienstgruppen – dieselbe Quelle wie bei „Erinnern“. */
  gruppen: readonly PlanGruppe[];
  heute: string;
  ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
  ladePersonen: PersonenLader;
  ladeAntworten: AntwortenLader;
  personenlisten?: ReadonlyMap<number, Personenliste>;
  anschluss: AbfrageAnschluss;
  onClose: () => void;
}) {
  const gezeigt = spalten.length
    ? { von: plan.spalten[spalten[0]].tag, bis: plan.spalten[spalten[spalten.length - 1]].tag }
    : null;
  const [gewaehlt, setGewaehlt] = useState<number | null>(gruppen[0]?.gruppe?.id ?? null);
  const [formular, setFormular] = useState(() => formularStart(gezeigt, heute));
  const [arbeitet, setArbeitet] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [beendenFrage, setBeendenFrage] = useState(false);
  /** Die Hilfsgruppe ist nicht leer (Reste einer früheren Abfrage) – „Gruppe leeren“ wird angeboten. */
  const [leerenAngebot, setLeerenAngebot] = useState(false);
  const [abgleich, setAbgleich] = useState<{ drin: number; ausgetragen: number } | null>(null);
  /** Zählt hoch, wenn `FEHLENDE` sich ändert – sonst zeichnet sich das Fenster nicht neu. */
  const [, setFehlendeStand] = useState(0);
  const abgeglichenFuer = useRef<string | null>(null);
  /** Die Person hat die Dienstgruppe selbst gewählt – dann springt die Vorwahl nicht mehr dazwischen. */
  const selbstGewaehlt = useRef(false);

  const gruppe = gruppen.find((g) => g.gruppe?.id === gewaehlt) ?? null;
  const dienstgruppeId = gruppe?.gruppe?.id ?? null;
  const { lesen } = anschluss;
  const name = gruppe ? gruppenName(gruppe) : '';

  // ── Lesen: frisch, beim Öffnen und mit jeder Dienstgruppe ──
  const {
    stand,
    neu: neuLesen,
    setze,
  } = useLaden<AbfragenStand>(
    () => (dienstgruppeId === null ? null : lesen(dienstgruppeId)),
    [lesen, dienstgruppeId],
  );
  const lese = stand.art === 'fertig' ? stand.daten : null;
  const lesefehler =
    stand.art === 'fehler'
      ? stand.fehler.text
      : lese?.fehler
        ? abfragenFehlerText(lese.fehler, true)
        : null;
  const unlesbar = lese?.unlesbar === true;
  // Nur mit sauber gelesenem Stand darf gestartet oder beendet werden.
  const schreibbar = lese !== null && lese.fehler === null && !lese.unlesbar;
  const laufend = schreibbar ? laufendeAbfrage(lese.inhalt, heute) : null;

  // Nach welcher Regel „offen“ gilt: die Art der Dienstgruppe, bei „Nur abwesend“ mit der laufenden Abfrage (V-4). Beim Starten
  // (noch keine Abfrage) hat niemand bestätigt.
  const regel = abfrageRegelAus(schreibbar ? lese.inhalt : null, heute);
  const lage = useAbfrageLage({
    plan,
    ladeZeitraum,
    ladePersonen,
    ladeAntworten,
    personenlisten,
    gruppe,
    von: schreibbar ? (laufend?.von ?? formular.von) : '',
    bis: schreibbar ? (laufend?.bis ?? formular.bis) : '',
    fest: laufend?.termine ?? null,
    heute,
    regel,
  });

  // ── Vorwahl: Hat eine planbare Dienstgruppe eine laufende Abfrage, ist die erste davon gewählt (sonst bleibt es die erste) ──
  // Geladen über `useLaden` (späte Antworten zählen nicht) – ein Lesen je Dienstgruppe. Abhängig von den Nummern als Text,
  // nicht von `gruppen` selbst: Die Liste ist bei jedem Zeichnen neu und löste sonst immer wieder ein Lesen aus.
  const gruppenNummern = gruppen
    .map((g) => g.gruppe?.id)
    .filter((id): id is number => id !== undefined && id !== null)
    .join(',');
  const { stand: vorwahl } = useLaden<number | null>(() => {
    const ids = gruppenNummern === '' ? [] : gruppenNummern.split(',').map(Number);
    return ids.length < 2
      ? null
      : Promise.all(
          ids.map(async (id): Promise<number | null> => {
            try {
              const s = await lesen(id);
              return s.fehler === null && !s.unlesbar && laufendeAbfrage(s.inhalt, heute)
                ? id
                : null;
            } catch {
              return null;
            }
          }),
        ).then((treffer) => treffer.find((i) => i !== null) ?? null);
  }, [gruppenNummern, lesen, heute]);
  useEffect(() => {
    if (vorwahl.art === 'fertig' && vorwahl.daten !== null && !selbstGewaehlt.current)
      setGewaehlt(vorwahl.daten);
  }, [vorwahl]);

  const wechsleGruppe = (id: number) => {
    selbstGewaehlt.current = true;
    // Dieselbe Gruppe noch einmal gewählt: nichts ändert sich – Meldungen und Abgleich bleiben stehen.
    if (id === gewaehlt) return;
    setGewaehlt(id);
    setProblem(null);
    setMeldung(null);
    setLeerenAngebot(false);
    setAbgleich(null);
  };

  // ── Automatik: nur mit Einrichtung, Anschluss und einem bekannten Absender ──
  const einrichtung = lese?.inhalt.einrichtung ?? null;
  const auto: AutomatikAnschluss | null =
    einrichtung && anschluss.automatik && anschluss.ich.personId > 0 ? anschluss.automatik : null;
  const fehlendeKey = dienstgruppeId !== null && laufend ? `${dienstgruppeId}:${laufend.id}` : null;
  const fehlende = fehlendeKey ? (FEHLENDE.get(fehlendeKey) ?? []) : [];

  // ── Abgleich beim Öffnen des Stands: nur austragen, nur mit vollständig gelesenem Ergebnis, einmal je Abfrage ──
  const ergebnis = lage.ergebnis;
  const bereitFuerAbgleich =
    auto !== null &&
    einrichtung !== null &&
    laufend !== null &&
    ergebnis?.art === 'ok' &&
    !lage.laedt &&
    !lage.planLaedt;
  const abgleichSchluessel =
    laufend && dienstgruppeId !== null ? `${dienstgruppeId}:${laufend.id}` : null;
  useEffect(() => {
    if (
      !bereitFuerAbgleich ||
      abgleichSchluessel === null ||
      abgeglichenFuer.current === abgleichSchluessel ||
      auto === null ||
      einrichtung === null ||
      ergebnis?.art !== 'ok'
    )
      return;
    abgeglichenFuer.current = abgleichSchluessel;
    const offen = new Set(ergebnis.personen.map((p) => p.personId));
    void abgleichen(auto, einrichtung, offen).then((r) => {
      if (r.art === 'ok') setAbgleich({ drin: r.drin, ausgetragen: r.ausgetragen });
    });
  }, [bereitFuerAbgleich, abgleichSchluessel, auto, einrichtung, ergebnis]);

  // ── Schreiben: ein Versuch, nie automatisch wiederholt ──
  const schreiben = async (neuerInhalt: AbfragenInhalt): Promise<boolean> => {
    if (!schreibbar || dienstgruppeId === null) return false;
    setArbeitet(true);
    setProblem(null);
    setMeldung(null);
    try {
      const r = await anschluss.speichern(
        dienstgruppeId,
        neuerInhalt,
        anschluss.ich,
        lese.gespeichert?.version ?? null,
      );
      if (r.ok) {
        if (r.daten) {
          setze({ inhalt: r.daten.inhalt, gespeichert: r.daten, unlesbar: false, fehler: null });
        } else {
          neuLesen();
        }
        return true;
      }
      if (r.grund === 'konflikt') {
        if (r.jetzt === undefined) {
          neuLesen();
          setProblem(abfragenFehlerText('konflikt', false));
          return false;
        }
        // Wie `EinstellungenFenster`: der neue Stand, nichts überschrieben – auch ein unlesbarer bleibt unangetastet.
        const jetzt = r.jetzt;
        const inhalt = jetzt ? abfragenAus(jetzt.inhalt) : null;
        setze(
          jetzt === null
            ? { inhalt: standardInhalt(), gespeichert: null, unlesbar: false, fehler: null }
            : inhalt
              ? { inhalt, gespeichert: { ...jetzt, inhalt }, unlesbar: false, fehler: null }
              : {
                  inhalt: standardInhalt(),
                  gespeichert: { ...jetzt, inhalt: standardInhalt() },
                  unlesbar: true,
                  fehler: null,
                },
        );
        setProblem(
          `${jetzt?.von.name ?? 'Ein anderer'} hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.`,
        );
        return false;
      }
      setProblem(abfragenFehlerText(r.grund, false));
      return false;
    } catch (e) {
      setProblem(fehlerMeldung(e).text);
      return false;
    } finally {
      setArbeitet(false);
    }
  };

  const fehler = formularFehler(formular, heute);
  /**
   * Wem beim Start Erinnerungen gelten: alle, die jetzt offen sind (nicht pausiert – `fehlendeInGruppe`, dieselbe Rechnung wie
   * die Zahlen im Fenster; auch Planer, die im Team sind). `null`: nicht zu sagen (gesperrt, lädt) – mit Automatik **kein Start**,
   * sonst liefe die Abfrage ohne einen Eingetragenen.
   */
  const startPersonen: PersonNr[] | null =
    lage.ergebnis?.art === 'ok' && !lage.laedt && !lage.planLaedt
      ? lage.ergebnis.personen.map((p) => ({ id: p.personId, name: p.name }))
      : null;
  const starten = async () => {
    if (!schreibbar || laufend || fehler || lage.termine.length === 0 || gruppe === null) return;
    if (auto && startPersonen === null) return;
    // „Nur abwesend“ ohne bereite Ablage der Antworten: nicht starten – es gäbe kein „Fertig“ (V-4). Zusagen-Gruppen unverändert.
    if (lese.inhalt.verfuegbarkeit === 'abwesend' && anschluss.ablageStand) {
      setArbeitet(true);
      setProblem(null);
      setMeldung(null);
      let ablage: SchubladenStand | null = null;
      try {
        ablage = await anschluss.ablageStand({ id: gruppe.gruppe?.id ?? 0, name });
      } catch (e) {
        setProblem(fehlerMeldung(e).text);
      }
      setArbeitet(false);
      if (ablage === null) return;
      if (ablage !== 'bereit') {
        setProblem(abfrageOhneAblage(name));
        return;
      }
    }
    const abfrage = neueAbfrage({
      id: (anschluss.neueId ?? zufallsId)(),
      formular,
      heute,
      termine: lage.termine,
      ich: anschluss.ich,
      zeit: (anschluss.jetzt ?? (() => new Date().toISOString()))(),
    });
    const neuerInhalt = mitNeuerAbfrage(lese.inhalt, abfrage, heute);
    // Ohne Automatik: wie bisher.
    if (!auto || !einrichtung || startPersonen === null) {
      if (await schreiben(neuerInhalt)) setMeldung('Die Abfrage läuft.');
      return;
    }
    // (a) Gruppe lesen, (b) Schritte ersetzen und nachlesen – ohne etwas im Dokument zu ändern.
    setArbeitet(true);
    setProblem(null);
    setMeldung(null);
    setLeerenAngebot(false);
    const schritte = abfrageRoutinenSchritte({
      plan: geltenderPlan(lese.inhalt),
      abfrage,
      heute,
      dienstgruppe: name,
      link: (anschluss.link ?? abfrageLink)(gruppe.gruppe?.id ?? 0),
      art: lese.inhalt.verfuegbarkeit,
      senderId: anschluss.ich.personId,
    });
    const v = await startVorbereiten(auto, einrichtung, schritte);
    setArbeitet(false);
    if (v.art === 'gestoppt') {
      setProblem(v.text);
      setLeerenAngebot(v.leeren);
      return;
    }
    if (v.art === 'ohneAutomatik') {
      // Ehrlich: Die Abfrage startet, aber ChurchTools erinnert nicht.
      if (await schreiben(neuerInhalt))
        setMeldung(
          `Die Abfrage läuft ohne automatische Erinnerungen: ${v.text} Erinnern geht weiter per „Erinnern“.`,
        );
      return;
    }
    // (c) die Abfrage ins Dokument (Version wie gelesen). Der Abgleich beim Öffnen darf NICHT dazwischenfunken: Sobald die
    // Abfrage läuft, würde er die Hilfsgruppe halb gefüllt lesen, während (d) noch einträgt (Zähler stimmte dann nicht).
    // Der Schlüssel gilt darum schon jetzt als erledigt; die Zahl kommt aus dem Nachlesen von (d).
    const startSchluessel = dienstgruppeId !== null ? `${dienstgruppeId}:${abfrage.id}` : null;
    abgeglichenFuer.current = startSchluessel;
    if (!(await schreiben(neuerInhalt))) {
      abgeglichenFuer.current = null;
      setProblem((p) =>
        `${p ?? ''} Die Schritte der Routine stehen schon in ChurchTools; ohne Mitglieder in der Hilfsgruppe wird aber nichts verschickt.`.trim(),
      );
      return;
    }
    // (d) alle Offenen als Teilnehmer eintragen, nachlesen – nichts wird automatisch wiederholt
    setArbeitet(true);
    const r = await eintragen(auto, einrichtung, v.rolle, startPersonen);
    setArbeitet(false);
    const schluessel = fehlendeKeyFuer(gruppe.gruppe?.id ?? null, abfrage.id);
    if (schluessel !== null) {
      FEHLENDE.set(schluessel, r.fehlen);
      setFehlendeStand((n) => n + 1);
    }
    // Wer nachgelesen als Teilnehmer drinsteht – dieselbe Zahl wie in der Meldung (nichts war vorher drin: Start nur bei leerer Gruppe).
    if (!r.unklar) setAbgleich({ drin: r.eingetragen.length, ausgetragen: 0 });
    setMeldung(`Die Abfrage läuft. ${eintragenText(r, startPersonen.length) ?? ''}`.trim());
  };
  const gruppeLeerenKlick = async () => {
    if (!auto || !einrichtung) return;
    setArbeitet(true);
    setProblem(null);
    const r = await gruppeLeeren(auto, einrichtung);
    setArbeitet(false);
    if (r.art === 'leer') {
      setLeerenAngebot(false);
      setMeldung(
        `Die Hilfsgruppe ist leer${r.ausgetragen > 0 ? ` (${r.ausgetragen} ausgetragen)` : ''}. Du kannst die Abfrage jetzt starten.`,
      );
    } else setProblem(r.text);
  };
  const nachtragenKlick = async () => {
    if (!auto || !einrichtung || fehlendeKey === null || fehlende.length === 0) return;
    setArbeitet(true);
    setProblem(null);
    const r = await fehlendeNachtragen(auto, einrichtung, fehlende);
    setArbeitet(false);
    if ('art' in r) {
      setProblem(r.text);
      return;
    }
    FEHLENDE.set(fehlendeKey, r.fehlen);
    setFehlendeStand((n) => n + 1);
    setMeldung(eintragenText(r, fehlende.length) ?? 'Alle sind eingetragen.');
  };
  const beenden = async () => {
    setBeendenFrage(false);
    if (!laufend || !schreibbar) return;
    // Erst alle aus der Hilfsgruppe austragen (nachgelesen), dann beenden – scheitert das, wird nicht beendet gespeichert.
    if (auto && einrichtung) {
      setArbeitet(true);
      setProblem(null);
      setMeldung(null);
      const r = await gruppeLeeren(auto, einrichtung);
      setArbeitet(false);
      if (r.art !== 'leer') {
        setProblem(
          `Die Abfrage wurde nicht beendet. ${r.text} Bitte noch einmal versuchen – bis dahin laufen die Erinnerungen weiter.`,
        );
        return;
      }
    }
    if (await schreiben(mitBeendeterAbfrage(lese.inhalt, laufend.id, heute)))
      setMeldung('Die Abfrage wurde beendet.');
  };

  // Eingerichtet heißt: Die Einrichtung steht im Dokument (R-5a) – kein Schalter von außen mehr.
  const eingerichtet = lese?.inhalt.einrichtung != null;

  // ── Anzeige ──
  const gruppenWahl = (
    <>
      <label className={styles.feldName} htmlFor="abfrage-gruppe">
        Dienstgruppe
      </label>
      <select
        id="abfrage-gruppe"
        className={styles.feld}
        value={gewaehlt ?? ''}
        disabled={arbeitet}
        onChange={(e) => wechsleGruppe(Number(e.target.value))}
      >
        {gruppen.map((g) =>
          g.gruppe ? (
            <option key={g.gruppe.id} value={g.gruppe.id}>
              {gruppenName(g)}
            </option>
          ) : null,
        )}
      </select>
    </>
  );
  const meldungen = (
    <>
      {meldung && (
        <p className={styles.status} role="status">
          {meldung}
        </p>
      )}
      {problem && (
        <p className={styles.fehler} role="alert">
          {problem}
        </p>
      )}
      {leerenAngebot && !laufend && (
        <p className={styles.nochmal}>
          <TextKnopf disabled={arbeitet} onClick={() => void gruppeLeerenKlick()}>
            Gruppe leeren
          </TextKnopf>
        </p>
      )}
      {laufend && fehlende.length > 0 && (
        <p className={styles.nochmal}>
          {tagAusIso(laufend.gestartet.zeit, gemeindeZeitzone()) === heute ? (
            <TextKnopf disabled={arbeitet} onClick={() => void nachtragenKlick()}>
              Fehlende nachtragen
            </TextKnopf>
          ) : (
            <span className={styles.leise}>
              {fehlende.map((p) => p.name).join(', ')} {fehlende.length === 1 ? 'steht' : 'stehen'}{' '}
              nicht in der Hilfsgruppe – nachgetragen wird nur am Starttag, danach per „Erinnern“.
            </span>
          )}
        </p>
      )}
    </>
  );

  if (!schreibbar) {
    // Lädt, Lesefehler oder unlesbar: nichts anzubieten außer „Nochmal versuchen“.
    return (
      <Sheet
        title="Abfrage starten"
        onClose={onClose}
        mittel
        knoepfe={
          stand.art === 'laedt' ? undefined : (
            <FensterKnopf onClick={neuLesen}>Nochmal versuchen</FensterKnopf>
          )
        }
      >
        {gruppenWahl}
        {stand.art === 'laedt' && (
          <p className={styles.leise} role="status">
            Wird geladen …
          </p>
        )}
        {unlesbar && (
          <p className={styles.fehler} role="alert">
            {ABFRAGE_UNLESBAR}
          </p>
        )}
        {lesefehler && (
          <p className={styles.fehler} role="alert">
            {lesefehler}
          </p>
        )}
        {meldungen}
      </Sheet>
    );
  }

  if (laufend) {
    const abschnitte = lage.ergebnis
      ? standAbschnitte(
          lage.ergebnis,
          laufend,
          dienstgruppeId !== null ? personenlisten?.get(dienstgruppeId) : undefined,
        )
      : null;
    const zeilen = zeitleiste({
      plan: geltenderPlan(lese.inhalt),
      abfrage: laufend,
      heute,
      ab: laufend.oeffnen,
    });
    return (
      <>
        <Sheet
          title={`Abfrage ${name} · ${tagMonat(laufend.von)}–${tagMonat(laufend.bis)}`}
          onClose={onClose}
          mittel
          beschaeftigt={arbeitet}
          cancelLabel={null}
          links={
            <FensterKnopf art="loeschen" disabled={arbeitet} onClick={() => setBeendenFrage(true)}>
              Abfrage beenden
            </FensterKnopf>
          }
          knoepfe={<FensterKnopf onClick={onClose}>Fertig</FensterKnopf>}
        >
          {gruppenWahl}
          {meldungen}
          <AbfrageStand
            abfrage={laufend}
            heute={heute}
            gruppeName={name}
            abschnitte={abschnitte}
            laedt={lage.laedt || lage.planLaedt}
            grund={
              lage.ergebnis?.art === 'gesperrt'
                ? lage.ergebnis.grund
                : (lage.planFehler?.text ?? null)
            }
            nochmal={
              lage.ergebnis?.art === 'gesperrt' ? lage.ergebnis.nochmal : lage.planFehler !== null
            }
            onNochmal={lage.neuLaden}
            zeilen={zeilen}
            eingerichtet={eingerichtet}
            art={lese.inhalt.verfuegbarkeit}
            automatik={abgleich}
          />
        </Sheet>
        {beendenFrage && (
          <ConfirmDialog
            title="Abfrage beenden?"
            message={`Die Abfrage für ${name} (${tagMonat(laufend.von)}–${tagMonat(laufend.bis)}) wird jetzt beendet. Danach kannst du eine neue starten.`}
            confirmLabel="Abfrage beenden"
            onConfirm={() => void beenden()}
            onCancel={() => setBeendenFrage(false)}
          />
        )}
      </>
    );
  }

  // Starten
  const kandidat =
    fehler === null
      ? neueAbfrage({
          id: 'vorschau',
          formular,
          heute,
          termine: lage.termine,
          ich: anschluss.ich,
          zeit: '',
        })
      : null;
  const keineTermine =
    fehler === null && !lage.planLaedt && lage.planFehler === null && lage.termine.length === 0;
  const heuteText =
    lage.laedt || lage.planLaedt
      ? 'Zahlen werden geladen …'
      : heuteZeilenText({
          lage: lage.ergebnis ? lageAus(lage.ergebnis) : null,
          grund: lage.ergebnis?.art === 'gesperrt' ? lage.ergebnis.grund : null,
          sofort: oeffnenTagAus(formular, heute) === heute,
        });
  const zeilen =
    kandidat && !keineTermine && !lage.planFehler
      ? zeitleiste({
          plan: geltenderPlan(lese.inhalt),
          abfrage: kandidat,
          heute,
          ab: heute,
          heuteText,
        })
      : null;
  return (
    <Sheet
      title="Abfrage starten"
      onClose={onClose}
      mittel
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={
            arbeitet ||
            fehler !== null ||
            lage.planLaedt ||
            lage.planFehler !== null ||
            lage.termine.length === 0 ||
            (auto !== null && startPersonen === null)
          }
          onClick={() => void starten()}
        >
          {arbeitet ? 'Wird gespeichert …' : 'Abfrage starten'}
        </FensterKnopf>
      }
    >
      {gruppenWahl}
      {meldungen}
      <AbfrageStart
        gruppeName={name}
        formular={formular}
        onFormular={setFormular}
        heute={heute}
        fehler={fehler}
        planFehler={lage.planFehler?.text ?? null}
        onNochmal={lage.neuLaden}
        keineTermine={keineTermine}
        zeilen={zeilen}
        eingerichtet={eingerichtet}
      />
    </Sheet>
  );
}
