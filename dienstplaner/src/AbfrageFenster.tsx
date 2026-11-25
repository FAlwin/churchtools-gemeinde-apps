import { useState } from 'react';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { tagMonat } from '@shared/ct/datum';
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
import type { Personenliste } from '@shared/dienstplan/personenliste';
import { gruppenName, type Plan, type PlanGruppe } from '@shared/dienstplan/plan';
import { AbfrageStand } from './AbfrageStand';
import { AbfrageStart } from './AbfrageStart';
import { ABFRAGE_UNLESBAR, abfragenFehlerText } from './abfragenTexte';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
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
  /** Wer startet und beendet – kommt in `gestartet`. */
  ich: { personId: number; name: string };
  /**
   * Gibt es die automatische Erinnerung (R-5) für die Dienstgruppe? Solange nicht, sagt das Fenster es ehrlich und verweist
   * auf „Erinnern“. R-5 ersetzt den Schalter durch die Prüfung der eingerichteten Routine.
   */
  automatik?: (dienstgruppeId: number) => boolean;
  /** Nur für Tests: die ID einer neuen Abfrage und der Zeitpunkt. */
  neueId?: () => string;
  jetzt?: () => string;
}

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
  });

  const wechsleGruppe = (id: number) => {
    setGewaehlt(id);
    setProblem(null);
    setMeldung(null);
  };

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
  const starten = async () => {
    if (!schreibbar || laufend || fehler || lage.termine.length === 0 || gruppe === null) return;
    const abfrage = neueAbfrage({
      id: (anschluss.neueId ?? zufallsId)(),
      formular,
      heute,
      termine: lage.termine,
      ich: anschluss.ich,
      zeit: (anschluss.jetzt ?? (() => new Date().toISOString()))(),
    });
    if (await schreiben(mitNeuerAbfrage(lese.inhalt, abfrage, heute)))
      setMeldung('Die Abfrage läuft.');
  };
  const beenden = async () => {
    setBeendenFrage(false);
    if (!laufend || !schreibbar) return;
    if (await schreiben(mitBeendeterAbfrage(lese.inhalt, laufend.id, heute)))
      setMeldung('Die Abfrage wurde beendet.');
  };

  const automatik = dienstgruppeId !== null && (anschluss.automatik?.(dienstgruppeId) ?? false);

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
            automatik={automatik}
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
            lage.termine.length === 0
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
        automatik={automatik}
      />
    </Sheet>
  );
}
