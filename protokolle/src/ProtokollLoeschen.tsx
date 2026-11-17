import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { terminSperre } from '@shared/protokolle/bearbeiten';
import {
  aufgabenAusProtokoll,
  eingeladeneMitMail,
  gesperrtText,
  NICHT_RUECKGAENGIG,
  statusWort,
  terminZusatz,
  todosUeberschrift,
  treffenZusatz,
} from '@shared/protokolle/loeschen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Schreiber } from '@shared/protokolle/speicher';
import { ANMELDUNG, terminStand } from './bearbeiten';
import { protokollLoeschen } from './loeschen';
import felder from './Fensterfelder.module.scss';
import styles from './Loeschen.module.scss';

/** Was der Termin jetzt sagt: sein Titel, wie viele die Mail bekämen, Serie, Anmeldung. */
interface TerminJetzt {
  titel: string;
  eingeladene: number;
  serie: boolean;
  anmeldung: boolean;
}

/**
 * **Fenster „Protokoll löschen?“** (Bauplan W6, Entwurf abgenommen 17.11.2026) – für die Leitung, bei einem Entwurf oder
 * freigegebenen Protokoll. Zeigt, was gelöscht wird (Titel · Datum · Status), sagt, dass es sich nicht rückgängig machen
 * lässt, und fragt nach dem, was daran hängt:
 * - **To-Dos aus diesem Protokoll** (nur wenn es welche gibt): „Mitlöschen“ (vorgewählt – als gelöscht vermerkt, im Verlauf
 *   sichtbar) oder „Behalten“;
 * - **in ChurchTools außerdem löschen:** Termin (mit Zahl derer, die die Mail „Termin gelöscht“ bekommen; bei einer Serie nur
 *   diese Sitzung, still) und Gruppentreffen (bei einem abgeschlossenen geht die Anwesenheit verloren) – je ein Häkchen,
 *   **anfangs aus**, nur wo es das gibt.
 *
 * Gelöscht wird in `protokollLoeschen` (Reihenfolge und Begründung dort). Scheitert ein Schritt, bleibt das Fenster offen
 * und sagt, was schon erledigt ist; „Nochmal versuchen“ macht nichts doppelt. `vorher` läuft vor dem Löschen (der Editor
 * hält sein Speichern an), `onAbbrechen`, wenn das Fenster ohne Löschen schließt (der Editor macht weiter).
 */
export function ProtokollLoeschen({
  sitzung,
  gruppe,
  modul,
  ich,
  zeitzone,
  aufgaben,
  schreiber,
  vorher,
  onAbbrechen,
  onFertig,
  onClose,
}: {
  sitzung: Sitzung;
  gruppe: { id: number; protokolle: number; mitarbeit: number | null };
  modul: number;
  /** Wer löscht – der Vorname landet im Verlauf der vermerkten To-Dos. */
  ich: { person: number; name: string };
  zeitzone: string;
  /** Die To-Dos der Gruppe – gezählt werden die aus diesem Protokoll (`aufgabenAusProtokoll`). */
  aufgaben: readonly Aufgabe[];
  /** Das Schreib-Fenster des Editors, wenn von dort gelöscht wird – sonst ein eigenes (fremd für jede Sperre). */
  schreiber?: Schreiber;
  vorher?: () => Promise<void>;
  onAbbrechen?: () => void;
  /** Gelöscht – der Aufrufer geht zurück zur Liste. */
  onFertig: () => void;
  onClose: () => void;
}) {
  const kopf = sitzung.kopf;
  const termin = sitzung.termin;
  const treffen = kopf?.treffen ?? sitzung.treffen;
  const [eigener] = useState<Schreiber>(() => ({ ...ich, fenster: crypto.randomUUID() }));
  const mich = schreiber ?? eigener;
  const todos =
    gruppe.mitarbeit === null ? [] : aufgabenAusProtokoll(aufgaben, kopf?.sitzung ?? '');

  const [todosMit, setTodosMit] = useState(true);
  const [terminWeg, setTerminWeg] = useState(false);
  const [treffenWeg, setTreffenWeg] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Mit Termin gilt, was ChurchTools jetzt hat (Eingeladene, Serie, Anmeldung) – nicht die Liste (`terminStand`).
  const stand = useLaden(
    () =>
      termin
        ? terminStand(termin).then(
            ({ roh, eingeladen }): TerminJetzt | null => ({
              titel: typeof roh.title === 'string' && roh.title ? roh.title : sitzung.titel,
              eingeladene: eingeladeneMitMail(eingeladen, ich.person),
              serie: terminSperre(roh) === 'serie',
              anmeldung: terminSperre(roh) === 'anmeldung',
            }),
            // 404: den Termin gibt es schon nicht mehr – dann nichts anzubieten.
            (e: unknown) => {
              if (e instanceof ApiError && e.status === 404) return null;
              throw e;
            },
          )
        : null,
    [termin, sitzung.titel, ich.person],
  ).stand;
  // Ein Termin, den es nicht mehr gibt (404), oder den ChurchTools gerade nicht liefert, bleibt unberührt.
  const t = stand.art === 'fertig' ? stand.daten : null;
  const terminLesenFehler = stand.art === 'fehler' ? stand.fehler.text : null;

  if (!kopf) return null;

  const loeschen = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      await vorher?.();
      const r = await protokollLoeschen({
        ort: { modul, kategorie: gruppe.protokolle, sitzung: kopf.sitzung },
        ich: mich,
        gruppe: gruppe.id,
        mitarbeit: gruppe.mitarbeit === null ? null : { modul, kategorie: gruppe.mitarbeit },
        todos: todos.length > 0 && todosMit,
        termin:
          termin && t && terminWeg
            ? {
                termin,
                beginn: sitzung.beginn,
                zeitzone,
                // Bei einer Serie nur diese Sitzung, still – nie die ganze Serie.
                ...(t.serie ? { art: 'diese' as const } : {}),
              }
            : null,
        treffen: treffen !== null && treffenWeg ? treffen : null,
      });
      if (r.art === 'gesperrt') {
        setFehler(gesperrtText(r.sperre, ich.person, r.erledigt));
        setLaeuft(false);
        return;
      }
      onFertig();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setLaeuft(false);
    }
  };

  const zumSchliessen = () => {
    onAbbrechen?.();
    onClose();
  };
  const hatChurchTools =
    treffen !== null || (termin !== null && (t !== null || !!terminLesenFehler));

  return (
    <Sheet
      title="Protokoll löschen?"
      onClose={zumSchliessen}
      mittel
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf art="gefahr" disabled={laeuft} onClick={() => void loeschen()}>
          {laeuft ? 'Wird gelöscht …' : fehler ? 'Nochmal versuchen' : 'Löschen'}
        </FensterKnopf>
      }
    >
      <p className={felder.unter}>
        {sitzung.titel} · {tagPunkt(tagAusIso(sitzung.beginn, zeitzone))} ·{' '}
        {statusWort(kopf.status)}
      </p>
      <p className={styles.warnung}>
        <b>{NICHT_RUECKGAENGIG}</b>
      </p>

      {todos.length > 0 && (
        <div className={styles.gruppe} role="radiogroup" aria-label="To-Dos aus diesem Protokoll">
          <span className={styles.ueberschrift}>{todosUeberschrift(todos.length)}</span>
          <label className={felder.schalter}>
            <input
              type="radio"
              name="todos"
              checked={todosMit}
              disabled={laeuft}
              onChange={() => setTodosMit(true)}
            />
            <span>
              Mitlöschen
              <small>im Verlauf vermerkt</small>
            </span>
          </label>
          <label className={felder.schalter}>
            <input
              type="radio"
              name="todos"
              checked={!todosMit}
              disabled={laeuft}
              onChange={() => setTodosMit(false)}
            />
            <span>
              Behalten
              <small>bleiben in der To-Do-Liste, ohne Protokoll dahinter</small>
            </span>
          </label>
        </div>
      )}

      {hatChurchTools && (
        <div className={styles.gruppe}>
          <span className={styles.ueberschrift}>In ChurchTools außerdem löschen</span>
          {t && (
            <label className={felder.schalter}>
              <input
                type="checkbox"
                className={felder.haken}
                checked={terminWeg}
                disabled={laeuft || t.anmeldung}
                onChange={(e) => setTerminWeg(e.target.checked)}
              />
              <span>
                Termin „{t.titel}“
                <small>
                  {t.anmeldung
                    ? ANMELDUNG
                    : terminZusatz({ eingeladene: t.eingeladene, serie: t.serie })}
                </small>
              </span>
            </label>
          )}
          {terminLesenFehler && (
            <p className={felder.leise}>
              Der Termin ließ sich gerade nicht lesen und bleibt, wie er ist: {terminLesenFehler}
            </p>
          )}
          {treffen !== null && (
            <label className={felder.schalter}>
              <input
                type="checkbox"
                className={felder.haken}
                checked={treffenWeg}
                disabled={laeuft}
                onChange={(e) => setTreffenWeg(e.target.checked)}
              />
              <span>
                Gruppentreffen
                {treffenZusatz(!!sitzung.abgeschlossen) && (
                  <small>{treffenZusatz(!!sitzung.abgeschlossen)}</small>
                )}
              </span>
            </label>
          )}
        </div>
      )}

      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
