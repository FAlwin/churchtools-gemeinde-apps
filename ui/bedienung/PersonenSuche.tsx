import type { ReactNode } from 'react';
import { FensterKnopf, type FensterKnopfArt } from '../fenster/FensterKnopf';
import type { Gefunden } from '../ct/personen';
import { usePersonenSuche, type PersonenSucheZustand } from './usePersonenSuche';

/** Die Klassen des Aufrufers – jede Erweiterung behält so ihr Aussehen. */
export interface PersonenSucheKlassen {
  /** Die Zeile aus Feld und Knopf (`<form>`). */
  form: string;
  feld: string;
  /** Die Trefferliste (`<ul>`). */
  liste: string;
  /** Der Knopf je Treffer. */
  zeile: string;
  /** „Niemand gefunden.“ */
  leer: string;
  fehler: string;
}

/**
 * **Personen in ChurchTools suchen und eine wählen** – Feld, „Suchen“, Treffer zum Antippen. EIN Baustein für alle
 * Erweiterungen (Anmeldungen: von Hand, Vertrauenspersonen; Organigramm: aufnehmen; Protokolle: „Im Auftrag von“).
 * Was in einer Trefferzeile steht, sagt der Aufrufer (`zeile`), ebenso, wer nicht wählbar ist (`gesperrt`).
 */
export function PersonenSuche({
  klassen,
  zeile,
  onWahl,
  gesperrt,
  danach,
  label = 'Name',
  autoFocus,
  knopfArt = 'haupt',
  knopf,
  zustand,
}: {
  klassen: PersonenSucheKlassen;
  /** Der Inhalt einer Trefferzeile (im Knopf). */
  zeile: (p: Gefunden) => ReactNode;
  onWahl: (p: Gefunden) => void;
  gesperrt?: (p: Gefunden) => boolean;
  /** Weitere Zeilen unter den Treffern, z. B. „Nicht dabei – neue Person anlegen“ (bekommt den Suchtext). */
  danach?: (suche: string) => ReactNode;
  /** Beschriftung und Platzhalter des Feldes. */
  label?: string;
  autoFocus?: boolean;
  knopfArt?: FensterKnopfArt;
  /** Eigener Suchknopf, wo die Erweiterung keinen `FensterKnopf` nimmt (Organigramm). */
  knopf?: (p: { disabled: boolean; text: string }) => ReactNode;
  /**
   * Der Zustand von außen (`usePersonenSuche()` beim Aufrufer) – wo die Suche zwischendurch verschwindet und beim
   * Zurückkommen Suchtext und Treffer noch dastehen sollen (Schritte im Fenster).
   */
  zustand?: PersonenSucheZustand;
}) {
  const eigen = usePersonenSuche();
  const s = zustand ?? eigen;
  const text = s.sucht ? 'Sucht …' : 'Suchen';
  return (
    <>
      <form
        className={klassen.form}
        onSubmit={(ev) => {
          ev.preventDefault();
          if (s.kannSuchen) void s.suchen();
        }}
      >
        <input
          type="search"
          className={klassen.feld}
          aria-label={label}
          placeholder={label}
          autoFocus={autoFocus}
          value={s.suche}
          onChange={(ev) => s.setSuche(ev.target.value)}
        />
        {knopf ? (
          knopf({ disabled: !s.kannSuchen, text })
        ) : (
          <FensterKnopf type="submit" art={knopfArt} disabled={!s.kannSuchen}>
            {text}
          </FensterKnopf>
        )}
      </form>
      {s.fehler && (
        <p className={klassen.fehler} role="alert">
          {s.fehler}
        </p>
      )}
      {s.treffer && (
        <ul className={klassen.liste} aria-label="Gefunden">
          {s.treffer.length === 0 && <li className={klassen.leer}>Niemand gefunden.</li>}
          {s.treffer.map((p) => (
            <li key={p.personId}>
              <button
                type="button"
                className={klassen.zeile}
                disabled={gesperrt?.(p) ?? false}
                onClick={() => onWahl(p)}
              >
                {zeile(p)}
              </button>
            </li>
          ))}
          {danach?.(s.suche)}
        </ul>
      )}
    </>
  );
}
