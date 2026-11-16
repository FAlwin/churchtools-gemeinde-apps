import { useId, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { useAufklapp } from '@ui/bedienung/useAufklapp';
import { initialenAus } from '@shared/organigramm/mitglieder';
import { passtZuName, type FokusKandidat, type FokusTexte } from '@shared/dienstplan/fokus';
import styles from './Fokus.module.scss';

/** Die Person, die im Fokus steht – `personId` ist der Schlüssel (nie der Name). */
export interface FokusPerson {
  personId: number;
  name: string;
}

/**
 * **Die Fokus-Leiste** (Wunsch 11): „Fokus: Daniel F. · 5 Einsätze in 5 Terminen …“ und „Fokus aus“. Kommt „im Plan
 * zeigen“ aus „Wer kann?“, steht darunter der Weg zurück („‹ Zurück zu ‚Wer kann?‘ für Ton · So, 20.12.“) und – wo man
 * eintragen darf – „Hier eintragen“.
 */
export function FokusLeiste({
  person,
  texte,
  onAus,
  zurueck,
  handy = false,
}: {
  person: FokusPerson;
  /** Die Zahlen in Kurz- und Langfassung (`fokusTexte`). */
  texte: FokusTexte;
  onAus: () => void;
  zurueck?: {
    /** „Ton · So, 20.12.“ */
    text: string;
    onZurueck: () => void;
    /** Fehlt, wo man hier keinen Entwurf anlegen kann. */
    onEintragen?: () => void;
    laeuft?: boolean;
  };
  /**
   * Am Handy kompakt (Entwurf e11 Abschnitt 5): Name und „N Einsätze“ in einer Zeile, „Fokus aus“ nur als ✕, die
   * Einzelheiten klein darunter, der Weg zurück einzeilig. Am Rechner die volle Fassung.
   */
  handy?: boolean;
}) {
  const voll = !handy && texte.detail ? `${texte.kurz} ${texte.detail}` : texte.kurz;
  return (
    <div
      className={`${styles.leiste}${handy ? ' ' + styles.leisteHandy : ''}`}
      role="status"
      aria-label="Fokus"
    >
      <div className={styles.zeile}>
        <span className={styles.avatar} aria-hidden="true">
          {initialenAus(person.name)}
        </span>
        <span className={styles.text}>
          Fokus: <b>{person.name}</b> · {voll}
          {handy && texte.detail && <small className={styles.detail}>{texte.detail}</small>}
        </span>
        {handy ? (
          <button type="button" className={styles.aus} onClick={onAus} aria-label="Fokus aus">
            <Icon name="x" size={16} />
          </button>
        ) : (
          <button type="button" className={styles.knopf} onClick={onAus}>
            <Icon name="x" size={14} /> Fokus aus
          </button>
        )}
      </div>
      {zurueck && (
        <div className={styles.zeile}>
          <button
            type="button"
            className={styles.zurueck}
            onClick={zurueck.onZurueck}
            aria-label={`Zurück zu „Wer kann?“ für ${zurueck.text}`}
          >
            {handy
              ? `‹ Wer kann? · ${zurueck.text}`
              : `‹ Zurück zu „Wer kann?“ für ${zurueck.text}`}
          </button>
          {zurueck.onEintragen && (
            <button
              type="button"
              className={`${styles.knopf} ${styles.haupt}`}
              disabled={zurueck.laeuft}
              onClick={zurueck.onEintragen}
            >
              Hier eintragen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_VORSCHLAEGE = 8;

/**
 * **Das Suchfeld „Person hervorheben“** (Wunsch 11) in der Werkzeugleiste von Planen: tippen → Vorschläge mit Kreis,
 * Name und Diensten (nur wer im geladenen Plan eingeteilt ist) → wählen → Fokus. Es filtert nichts – deshalb der Name.
 * Am Handy steckt das Feld hinter einem Such-Symbol.
 */
export function FokusSuche({
  kandidaten,
  onWahl,
  handy,
}: {
  kandidaten: FokusKandidat[];
  onWahl: (p: FokusPerson) => void;
  handy: boolean;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const [eingabe, setEingabe] = useState('');
  const [aktiv, setAktiv] = useState(0);
  const id = useId();
  const treffer = kandidaten.filter((k) => passtZuName(k.name, eingabe)).slice(0, MAX_VORSCHLAEGE);
  const zeigeListe = (!handy || offen) && eingabe.trim() !== '';

  const waehle = (k: FokusKandidat) => {
    onWahl({ personId: k.personId, name: k.name });
    setEingabe('');
    setAktiv(0);
    setOffen(false);
  };
  const feld = (
    <div className={styles.suche}>
      <span className={styles.lupe} aria-hidden="true">
        <Icon name="search" size={15} />
      </span>
      <input
        className={styles.feld}
        type="search"
        role="combobox"
        placeholder="Person hervorheben"
        aria-label="Person hervorheben"
        aria-expanded={zeigeListe && treffer.length > 0}
        aria-controls={id}
        aria-activedescendant={zeigeListe && treffer[aktiv] ? `${id}-${aktiv}` : undefined}
        autoComplete="off"
        autoFocus={handy}
        value={eingabe}
        onChange={(e) => {
          setEingabe(e.target.value);
          setAktiv(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAktiv((a) => Math.min(a + 1, treffer.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAktiv((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && treffer[aktiv]) {
            e.preventDefault();
            waehle(treffer[aktiv]);
          } else if (e.key === 'Escape') {
            setEingabe('');
          }
        }}
      />
      {zeigeListe && (
        <ul className={styles.menue} id={id} role="listbox" aria-label="Vorschläge">
          {treffer.length === 0 && (
            <li className={styles.leer}>Niemand im Plan mit diesem Namen.</li>
          )}
          {treffer.map((k, i) => (
            <li
              key={k.personId}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === aktiv}
              className={styles.vorschlag}
              onMouseEnter={() => setAktiv(i)}
              onClick={() => waehle(k)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initialenAus(k.name)}
              </span>
              <span>
                {k.name}
                <small>{k.dienste.join(' · ')}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  if (!handy) return <div ref={rahmen}>{feld}</div>;
  return (
    <div ref={rahmen} className={styles.suche}>
      <button
        type="button"
        className={styles.lupenKnopf}
        aria-label="Person hervorheben"
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
      >
        <Icon name="search" size={16} />
      </button>
      {offen && <div className={styles.handyMenue}>{feld}</div>}
    </div>
  );
}
