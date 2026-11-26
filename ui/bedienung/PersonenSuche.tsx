import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
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
  /** Nur `beimTippen`: die Zeile, auf der die Pfeiltasten stehen (zusätzlich zu `zeile`). */
  aktiv?: string;
}

/**
 * **Personen in ChurchTools suchen und eine wählen** – Feld, „Suchen“, Treffer zum Antippen. EIN Baustein für alle
 * Erweiterungen (Anmeldungen: von Hand, Vertrauenspersonen; Organigramm: aufnehmen; Protokolle: „Im Auftrag von“).
 * Was in einer Trefferzeile steht, sagt der Aufrufer (`zeile`), ebenso, wer nicht wählbar ist (`gesperrt`).
 *
 * **Zwei Bedienarten:** Standard ist Feld + Knopf „Suchen“. Mit **`beimTippen`** gibt es keinen Knopf: Ab zwei Zeichen
 * sucht der Baustein von selbst (entprellt, `usePersonenSuche`), die Treffer stehen als Liste unter dem Feld
 * (Auswahlfeld mit Vorschlägen wie im ChurchTools-Dialog „Termin erstellen“ → „Im Auftrag von“); ↑/↓ wandern durch die
 * Treffer, Enter wählt, Escape schließt die Liste. Dann ist `klassen.form` die Hülle um Feld und Liste (der Aufrufer
 * stellt sie `position: relative` und die Liste darunter), `klassen.zeile` die Zeile – ohne Knopf darin.
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
  beimTippen = false,
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
  /** Ohne Knopf, sucht beim Tippen (siehe oben). Der `zustand` von außen muss dann mit `beimTippen` erzeugt sein. */
  beimTippen?: boolean;
}) {
  const eigen = usePersonenSuche({ beimTippen });
  const s = zustand ?? eigen;
  const text = s.sucht ? 'Sucht …' : 'Suchen';
  // „Beim Tippen“: die Zeile unter den Pfeiltasten und „Liste mit Escape geschlossen“ (bis zur nächsten Eingabe).
  const listenId = useId();
  const [aktivIndex, setAktivIndex] = useState(0);
  const [zu, setZu] = useState(false);
  if (beimTippen) {
    const treffer = zu ? null : s.treffer;
    const waehlbar = (p: Gefunden) => !(gesperrt?.(p) ?? false);
    const aktivZeile = treffer && treffer.length ? Math.min(aktivIndex, treffer.length - 1) : -1;
    const taste = (ev: KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === 'Escape' && treffer) {
        // Nur die Liste zu – nicht auch das Fenster dahinter (`useEscape` hört am Dokument).
        ev.stopPropagation();
        setZu(true);
      } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && treffer?.length) {
        ev.preventDefault();
        const n = treffer.length;
        setAktivIndex((aktivZeile + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n);
      } else if (ev.key === 'Enter' && treffer && aktivZeile >= 0) {
        ev.preventDefault();
        if (waehlbar(treffer[aktivZeile])) onWahl(treffer[aktivZeile]);
      }
    };
    return (
      <div className={klassen.form}>
        <input
          type="text"
          role="combobox"
          aria-expanded={!!treffer}
          aria-controls={listenId}
          aria-autocomplete="list"
          aria-activedescendant={aktivZeile >= 0 ? `${listenId}-${aktivZeile}` : undefined}
          autoComplete="off"
          className={klassen.feld}
          aria-label={label}
          placeholder={label}
          autoFocus={autoFocus}
          value={s.suche}
          onChange={(ev) => {
            setZu(false);
            setAktivIndex(0);
            s.setSuche(ev.target.value);
          }}
          onKeyDown={taste}
        />
        {s.fehler && (
          <p className={klassen.fehler} role="alert">
            {s.fehler}
          </p>
        )}
        {treffer && (
          <ul id={listenId} className={klassen.liste} role="listbox" aria-label="Gefunden">
            {treffer.length === 0 && (
              <li className={klassen.leer} role="presentation">
                Niemand gefunden.
              </li>
            )}
            {treffer.map((p, i) => (
              <li
                key={p.personId}
                id={`${listenId}-${i}`}
                role="option"
                aria-selected={i === aktivZeile}
                aria-disabled={!waehlbar(p)}
                className={
                  i === aktivZeile && klassen.aktiv
                    ? `${klassen.zeile} ${klassen.aktiv}`
                    : klassen.zeile
                }
                // Der Klick darf dem Feld den Fokus nicht nehmen, sonst ist die Liste weg, bevor er ankommt.
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => waehlbar(p) && onWahl(p)}
              >
                {zeile(p)}
              </li>
            ))}
            {danach?.(s.suche)}
          </ul>
        )}
      </div>
    );
  }
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
