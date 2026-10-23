import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AblaufQuelle, AblaufVorlage } from '@shared/types/index';
import {
  standAus,
  type AblaufBestand,
  type AblaufStand,
  type VerbundenerTermin,
} from '@shared/ct/ablaufNeu';
import { tagKurz } from '@shared/ct/datum';
import { ConfirmDialog } from '../fenster/ConfirmDialog';
import { Icon } from '../icons/icons';
import { AblaufAnlegenFenster, type KopieVorschlag } from './AblaufAnlegenFenster';
import styles from './NeuAufsetzen.module.scss';

interface Props {
  /** Für welchen Termin – wie im Fenster „Ablauf anlegen“. */
  fuer: ReactNode;
  vorlagen: { liste: AblaufVorlage[]; laedt: boolean; fehler: boolean };
  /** Frühere Termine mit Ablauf; verbundene Termine nimmt das Fenster selbst heraus. */
  vorschlaege: KopieVorschlag[];
  keineVorschlaege: string;
  /** Frisch lesen, was ersetzt würde (`ablaufBestandLesen`). */
  bestandLesen: () => Promise<AblaufBestand>;
  /** Schreiben (`ablaufNeuAufsetzen`); wirft bei Fehler. */
  neuAufsetzen: (quelle: AblaufQuelle, gesehen: AblaufStand, nurDieser: boolean) => Promise<void>;
  /** Nach jedem Schreibversuch – auch einem gescheiterten, er kann etwas geändert haben. */
  neuLaden: () => void;
  onClose: () => void;
}

/**
 * **Ablauf neu aufsetzen** (Bauplan E6-5b, #691; Entwurf `e6-5b-entwurf.html`, abgenommen 23.10.2026): erst dasselbe
 * Fenster wie „Ablauf anlegen“ (Titel „Ablauf neu aufsetzen“, Knopf „Weiter“), dann eine klare Nachfrage – kein
 * Rückgängig. Bei geteiltem Ablauf nennt sie die anderen Termine und bietet „Für alle“ oder „Nur für diesen Termin neu“.
 * Ist der Ablauf leer, geht nichts verloren: ohne Nachfrage.
 *
 * Der Stand für die Nachfrage wird bei „Weiter“ **frisch** gelesen; mit genau diesem vergleicht der Kern
 * (`@shared/ct/ablaufNeu`) vor dem Schreiben – hat ihn inzwischen jemand geändert, kommt 412 statt eines Ersetzens.
 */
export function NeuAufsetzen({
  fuer,
  vorlagen,
  vorschlaege,
  keineVorschlaege,
  bestandLesen,
  neuAufsetzen,
  neuLaden,
  onClose,
}: Props) {
  // Nur zum Ausblenden verbundener Termine unter „Wie eine frühere“ – geprüft wird bei „Weiter“ neu.
  const [verbunden, setVerbunden] = useState<number[]>([]);
  const [frage, setFrage] = useState<{ quelle: AblaufQuelle; bestand: AblaufBestand } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Einmal beim Öffnen – nicht bei jeder neuen Funktion, die der Aufrufer hereinreicht.
  const erstesLesen = useRef(bestandLesen);
  useEffect(() => {
    let aus = false;
    erstesLesen.current().then(
      (b) => !aus && setVerbunden(b.verbunden.map((t) => t.id)),
      () => undefined, // Bei „Weiter“ wird ohnehin neu gelesen – und dort zählt ein Fehler.
    );
    return () => {
      aus = true;
    };
  }, []);

  async function schreiben(quelle: AblaufQuelle, bestand: AblaufBestand, nurDieser: boolean) {
    setLaeuft(true);
    try {
      await neuAufsetzen(quelle, standAus(bestand), nurDieser);
      neuLaden();
      onClose();
    } catch (e) {
      neuLaden();
      setFehler(e instanceof Error ? e.message : 'Neu aufsetzen fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  }

  async function weiter(quelle: AblaufQuelle) {
    const bestand = await bestandLesen();
    if (bestand.punkte.length === 0) {
      // Nichts geht verloren – auch nicht bei einem (unerkennbar) geteilten leeren Ablauf.
      await neuAufsetzen(quelle, standAus(bestand), false);
      neuLaden();
      onClose();
      return;
    }
    setFrage({ quelle, bestand });
  }

  if (fehler) {
    return (
      <ConfirmDialog
        title="Nicht neu aufgesetzt"
        message={fehler}
        confirmLabel="OK"
        cancelLabel={null}
        harmlos
        onConfirm={onClose}
        onCancel={onClose}
      />
    );
  }

  if (frage) {
    const { quelle, bestand } = frage;
    const leer = quelle.art === 'leer';
    const n = bestand.punkte.length;
    const k = bestand.verbunden.length;
    const abbrechen = () => setFrage(null);
    if (k === 0) {
      return (
        <ConfirmDialog
          title={leer ? 'Ablauf leeren?' : 'Ablauf ersetzen?'}
          message={
            leer
              ? `${n === 1 ? 'Der eine Punkt dieses Ablaufs wird' : `Alle ${n} Punkte dieses Ablaufs werden`} entfernt. Der Ablauf selbst bleibt und kann neu gefüllt werden. Rückgängig geht danach nicht.`
              : `${n === 1 ? 'Der eine Punkt dieses Ablaufs wird' : `Die ${n} Punkte dieses Ablaufs werden`} durch ${quelleText(quelle, vorlagen.liste, vorschlaege)} ersetzt – samt Liedern und Infos für die Gruppen. Rückgängig geht danach nicht.`
          }
          confirmLabel={leer ? 'Leeren' : 'Ersetzen'}
          beschaeftigt={laeuft}
          onConfirm={() => void schreiben(quelle, bestand, false)}
          onCancel={abbrechen}
        />
      );
    }
    const alle = k === 1 ? 'beide' : 'alle';
    return (
      <ConfirmDialog
        title={leer ? 'Ablauf leeren?' : 'Ablauf ersetzen?'}
        message={`Dieser Ablauf gilt auch für ${k === 1 ? 'einen weiteren Termin' : `${k} weitere Termine`}. ${leer ? 'Leeren' : 'Ersetzen'} trifft ${alle}:`}
        confirmLabel={`Für ${alle} ${leer ? 'leeren' : 'ersetzen'}`}
        zweit={{
          label: 'Nur für diesen Termin neu',
          onClick: () => void schreiben(quelle, bestand, true),
        }}
        fuss={
          k === 1
            ? '„Nur für diesen Termin“: Der andere Termin behält den bisherigen Ablauf.'
            : '„Nur für diesen Termin“: Die anderen Termine behalten den bisherigen Ablauf.'
        }
        beschaeftigt={laeuft}
        onConfirm={() => void schreiben(quelle, bestand, false)}
        onCancel={abbrechen}
      >
        <ul className={styles.andere}>
          {bestand.verbunden.map((t) => (
            <li key={t.id}>
              <Icon name="calendar" size={14} />
              {terminText(t)}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    );
  }

  return (
    <AblaufAnlegenFenster
      titel="Ablauf neu aufsetzen"
      knopf={{ label: 'Weiter', laeuft: 'Wird geprüft …' }}
      fuer={fuer}
      vorlagen={vorlagen}
      vorschlaege={vorschlaege.filter((v) => !verbunden.includes(v.id))}
      keineVorschlaege={keineVorschlaege}
      onAnlegen={weiter}
      onClose={onClose}
    />
  );
}

function quelleText(
  q: AblaufQuelle,
  vorlagen: AblaufVorlage[],
  vorschlaege: KopieVorschlag[],
): string {
  if (q.art === 'vorlage') {
    const v = vorlagen.find((x) => x.id === q.vorlageId);
    return v ? `die Vorlage „${v.name}“` : 'die Vorlage';
  }
  if (q.art === 'kopie') {
    const s = vorschlaege.find((x) => x.id === q.eventId);
    return s ? `den Ablauf von „${s.titel}“` : 'den Ablauf des anderen Termins';
  }
  return 'nichts';
}

/** „So, 26.10. · 12:00 · Gottesdienst“ – oder ehrlich, wenn sich der Termin nicht lesen ließ. */
function terminText(t: VerbundenerTermin): string {
  if (t.beginn === null) return t.name ?? 'Ein weiterer Termin (für dich nicht sichtbar)';
  return `${tagKurz(t.beginn.slice(0, 10))} · ${t.beginn.slice(11, 16)} · ${t.name ?? 'Termin'}`;
}
