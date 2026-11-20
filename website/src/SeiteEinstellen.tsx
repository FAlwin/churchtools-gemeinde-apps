import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import {
  imMenueZeigen,
  menueFuerSeite,
  menueTitelNachziehen,
  menueVerschieben,
} from '@shared/website/bearbeiten';
import { SLUG, type Menue, type Seite } from '@shared/website/modell';
import { Feld, Haken } from './Felder';
import { pfadEingabe } from './regeln';
import styles from './Fenster.module.scss';

/**
 * **Fenster „Seite einstellen“** (W3a-2): Titel, Adresse (die Startseite hat immer `/`), Beschreibung, „Im Menü zeigen“ und
 * die **Reihenfolge im Menü** (hoch/runter; Unterpunkte kommen später). Hier wird **nichts sofort geändert** – erst „Fertig“
 * gibt Seite und Menü an den Editor, der sie prüft und speichert (Meldungen stehen im Fenster). „Seite löschen“ geht den
 * Weg aus W3a-1 (Bestätigung, Menüpunkt zuerst).
 */
export function SeiteEinstellen({
  seite,
  menue,
  andereSeiten,
  meldungen,
  menueAendern,
  onFertig,
  onLoeschen,
  onClose,
}: {
  seite: Seite;
  menue: Menue | null;
  andereSeiten: readonly Seite[];
  meldungen: readonly string[];
  /**
   * Darf die Person das Menü ändern („Im Menü zeigen“, Reihenfolge)? Nur Leitung und Admin (E-W22) – ein Redakteur sieht beides
   * nicht. Der Menütitel zieht dem Seitentitel trotzdem nach (sonst stünde dort der alte Name).
   */
  menueAendern: boolean;
  /** `menue` ist `null`, wenn sich am Menü nichts ändert. */
  onFertig: (seite: Seite, menue: Menue | null) => void;
  onLoeschen: () => void;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState(seite.titel);
  const [pfad, setPfad] = useState(seite.pfad);
  const [beschreibung, setBeschreibung] = useState(seite.beschreibung ?? '');
  const [entwurf, setEntwurf] = useState<Menue>(menue ?? { eintraege: [] });
  const imMenue = imMenueZeigen(entwurf, seite.id);

  const pfadProblem = seite.startseite
    ? ''
    : !SLUG.test(pfad)
      ? 'Nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „unsere-gruppen“).'
      : andereSeiten.some((s) => s.id !== seite.id && s.pfad === pfad)
        ? 'Diese Adresse hat schon eine andere Seite.'
        : '';
  const titelLeer = titel.trim() === '';

  const fertig = () => {
    const neu: Seite = {
      ...seite,
      titel: titel.trim(),
      pfad: seite.startseite ? seite.pfad : pfad,
    };
    if (beschreibung.trim() === '') delete neu.beschreibung;
    else neu.beschreibung = beschreibung;
    const nachgezogen = menueTitelNachziehen(entwurf, seite.id, seite.titel, neu.titel) ?? entwurf;
    const geaendert = JSON.stringify(nachgezogen) !== JSON.stringify(menue ?? { eintraege: [] });
    onFertig(neu, geaendert ? nachgezogen : null);
  };

  return (
    <Sheet
      title="Seite einstellen"
      onClose={onClose}
      onAbbrechen={onClose}
      links={
        <FensterKnopf art="loeschen" onClick={onLoeschen}>
          Seite löschen
        </FensterKnopf>
      }
      knoepfe={
        <FensterKnopf disabled={titelLeer || pfadProblem !== ''} onClick={fertig}>
          Fertig
        </FensterKnopf>
      }
      mittel
    >
      <Feld label="Titel">
        {(id) => (
          <input
            id={id}
            className={styles.eingabe}
            value={titel}
            maxLength={150}
            onChange={(e) => setTitel(e.target.value)}
          />
        )}
      </Feld>
      <Feld
        label="Adresse"
        hilfe={
          seite.startseite ? (
            'Die Startseite hat immer die Adresse „/“.'
          ) : pfadProblem ? (
            <span role="alert" className={styles.fehler}>
              {pfadProblem}
            </span>
          ) : undefined
        }
      >
        {(id) => (
          <input
            id={id}
            className={styles.eingabe}
            value={seite.startseite ? '/' : pfad}
            disabled={seite.startseite === true}
            maxLength={80}
            onChange={(e) => setPfad(pfadEingabe(e.target.value))}
          />
        )}
      </Feld>
      <Feld label="Beschreibung für Suchmaschinen (optional)">
        {(id) => (
          <textarea
            id={id}
            className={`${styles.textfeld} ${styles.kurz}`}
            rows={2}
            maxLength={300}
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
        )}
      </Feld>
      {menueAendern && (
        <Haken
          an={imMenue}
          onChange={(an) => setEntwurf(menueFuerSeite(entwurf, { ...seite, titel }, an) ?? entwurf)}
        >
          Im Menü zeigen
        </Haken>
      )}

      {menueAendern && entwurf.eintraege.length > 0 && (
        <>
          <h4 className={styles.gruppe}>Reihenfolge im Menü</h4>
          {entwurf.eintraege.map((e, n) => (
            <div className={styles.reihe} key={`${n}-${e.titel}`}>
              <span
                className={
                  e.ziel.art === 'seite' && e.ziel.seiteId === seite.id ? styles.fett : undefined
                }
              >
                {e.titel}
              </span>
              <button
                type="button"
                className={styles.sehrKlein}
                title={`„${e.titel}“ nach oben`}
                aria-label={`„${e.titel}“ nach oben`}
                disabled={n === 0}
                onClick={() => setEntwurf(menueVerschieben(entwurf, n, 'hoch'))}
              >
                <Icon name="chev-up" size={16} />
              </button>
              <button
                type="button"
                className={styles.sehrKlein}
                title={`„${e.titel}“ nach unten`}
                aria-label={`„${e.titel}“ nach unten`}
                disabled={n === entwurf.eintraege.length - 1}
                onClick={() => setEntwurf(menueVerschieben(entwurf, n, 'runter'))}
              >
                <Icon name="chev-down" size={16} />
              </button>
            </div>
          ))}
        </>
      )}
      {meldungen.length > 0 && (
        <ul className={styles.meldungen} role="alert">
          {meldungen.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
