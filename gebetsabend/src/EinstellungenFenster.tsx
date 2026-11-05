import { useEffect, useId, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ctDaten } from '@ui/ct/verbindung';
import { einstellungenLesen, einstellungenSpeichern } from '@shared/gebetsabend/ablage';
import { KATEGORIE_EINSTELLUNGEN } from '@shared/gebetsabend/einrichten';
import type { Einstellungen } from '@shared/gebetsabend/einstellungen';
import { speicherFehlerText } from '@shared/gebetsabend/technik';
import { NUR_TECHNIK_EINSTELLUNGEN, port } from './speicher';
import type { Start } from './start';
import styles from './EinstellungenFenster.module.scss';

interface Props {
  start: Start;
  /** ID der Kategorie „Einstellungen“. */
  kategorie: number;
  /** Nach dem Speichern – der Termin lädt neu. */
  onGespeichert: () => void;
  onSchliessen: () => void;
}

interface Kalender {
  id: number;
  name: string;
}

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'da'; version: number | null; kalender: Kalender[] };

/** `/calendars` – nur, was die angemeldete Person sehen darf (G0-4). Unbrauchbare Einträge fallen weg. */
function kalenderAus(roh: unknown): Kalender[] {
  return (Array.isArray(roh) ? roh : []).flatMap((k: { id?: unknown; name?: unknown }) =>
    typeof k?.id === 'number' && typeof k.name === 'string' ? [{ id: k.id, name: k.name }] : [],
  );
}

/**
 * **Einstellungen des Gebetsabends** (Bauplan Gebetsabend G3, Entwurf v3): aus welchem Kalender der nächste Termin
 * kommt und an welchem Wort im Titel er erkannt wird. Nur für die Technik. Gespeichert mit Version und Nachlesen
 * (`@shared/gebetsabend/ablage`); hat inzwischen ein anderer gespeichert, wird nichts überschrieben.
 */
export function EinstellungenFenster({ start, kategorie, onGespeichert, onSchliessen }: Props) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [werte, setWerte] = useState<Einstellungen>({ kalender: null, suchwort: '' });
  const [arbeitet, setArbeitet] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const kalenderId = useId();
  const wortId = useId();

  useEffect(() => {
    let aktuell = true;
    Promise.all([
      einstellungenLesen(port, start.modul, kategorie),
      ctDaten<unknown>('/calendars'),
    ]).then(
      ([l, roh]) => {
        if (!aktuell) return;
        if (!l.ok) {
          setLaden({
            art: 'fehler',
            text: speicherFehlerText(l.grund, 'geladen', KATEGORIE_EINSTELLUNGEN.name),
          });
          return;
        }
        setWerte(l.stand.inhalt);
        setLaden({ art: 'da', version: l.stand.version, kalender: kalenderAus(roh) });
      },
      (e: unknown) => {
        if (aktuell) setLaden({ art: 'fehler', text: fehlerMeldung(e).text });
      },
    );
    return () => {
      aktuell = false;
    };
  }, [start.modul, kategorie]);

  const speichern = async () => {
    if (laden.art !== 'da') return;
    setArbeitet(true);
    setProblem(null);
    try {
      const r = await einstellungenSpeichern(
        port,
        start.modul,
        kategorie,
        { kalender: werte.kalender, suchwort: werte.suchwort.trim() },
        { personId: start.ichId, name: start.name || start.vorname },
        laden.version,
        NUR_TECHNIK_EINSTELLUNGEN,
      );
      if (r.ok) {
        onGespeichert();
        onSchliessen();
        return;
      }
      if (r.jetzt) {
        // Nichts überschreiben: Was jetzt dasteht, gilt – und steht im Fenster.
        setWerte(r.jetzt.inhalt);
        setLaden({ ...laden, version: r.jetzt.version });
      }
      setProblem(speicherFehlerText(r.grund, 'gespeichert', KATEGORIE_EINSTELLUNGEN.name));
    } catch (e) {
      setProblem(fehlerMeldung(e).text);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Sheet
      title="Einstellungen"
      onClose={onSchliessen}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf disabled={arbeitet || laden.art !== 'da'} onClick={() => void speichern()}>
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      {laden.art === 'laedt' && <p className={styles.leise}>Wird geladen …</p>}
      {laden.art === 'fehler' && (
        <p className={styles.fehler} role="alert">
          {laden.text}
        </p>
      )}
      {laden.art === 'da' && (
        <div className={styles.felder}>
          <label htmlFor={kalenderId}>Kalender des Gebetsabends</label>
          <select
            id={kalenderId}
            className={styles.feld}
            value={werte.kalender ?? ''}
            onChange={(e) =>
              setWerte({ ...werte, kalender: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">– kein Termin anzeigen –</option>
            {/* Ein gespeicherter Kalender, den man selbst nicht sieht, bleibt wählbar statt still zu verschwinden. */}
            {werte.kalender !== null && !laden.kalender.some((k) => k.id === werte.kalender) && (
              <option value={werte.kalender}>{`Kalender ${werte.kalender}`}</option>
            )}
            {laden.kalender.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <label htmlFor={wortId}>Termin erkennen am Wort im Titel</label>
          <input
            id={wortId}
            className={styles.feld}
            value={werte.suchwort}
            onChange={(e) => setWerte({ ...werte, suchwort: e.target.value })}
          />
          <p className={styles.leise}>
            Angezeigt wird der nächste Termin aus diesem Kalender, dessen Titel das Wort enthält.
            Leer = jeder Termin. Damit alle den Termin sehen, müssen Mitglieder den Kalender in
            ChurchTools sehen dürfen.
          </p>
        </div>
      )}
      {problem && (
        <p className={styles.fehler} role="alert">
          {problem}
        </p>
      )}
    </Sheet>
  );
}
