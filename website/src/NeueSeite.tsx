import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Seite } from '@shared/website/modell';
import { freierPfad, neueLeereSeite, pfadAusTitel } from '@shared/website/seitenListe';
import { neueId } from './ids';
import styles from './Fenster.module.scss';

/**
 * **Fenster „Neue Seite“** (Bauplan Website W3a-1): ein Titel, der Pfad (die Adresse der Seite) entsteht daraus von selbst
 * – ist er schon vergeben, kommt `-2` dahinter. Die Seite ist zunächst leer; sie landet in den Entwürfen.
 *
 * **Bereich (W3b-4b):** Die Seite erbt den Bereich dessen, der sie anlegt (`bereicheFuerNeueSeite`): Wer alle Seiten sieht, legt
 * sie für die Website an; wer nur über eine Untergruppe dabei ist, für diese; wer in mehreren ist, wählt hier. `seiten` sind
 * **alle** Seiten – auch die, die man nicht sieht –, damit die Adresse über alle Bereiche frei ist (E-W30).
 */
export function NeueSeite({
  seiten,
  bereiche,
  speichern,
  onAngelegt,
  onClose,
}: {
  /** ALLE Seiten der Website (nicht nur die sichtbaren) – für die freie Adresse. */
  seiten: readonly Seite[];
  /** Wohin die Seite gehören kann (`null` = Website); mehrere → Auswahl. Fehlt: zur Website. */
  bereiche?: readonly { wert: number | null; name: string }[];
  /** Schreibt die Seite in den Speicher (wirft bei einem Fehler). */
  speichern: (seite: Seite) => Promise<void>;
  onAngelegt: (seite: Seite) => void;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState('');
  const [bereich, setBereich] = useState<number | null>(bereiche?.[0]?.wert ?? null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const bereit = titel.trim() !== '' && !laeuft;
  const pfad = freierPfad(
    pfadAusTitel(titel),
    seiten.map((s) => s.pfad),
  );

  const anlegen = async () => {
    if (!bereit) return;
    setLaeuft(true);
    setFehler(null);
    const leer = neueLeereSeite(titel, seiten, neueId);
    const seite: Seite = bereich === null ? leer : { ...leer, bereich };
    try {
      await speichern(seite);
      onAngelegt(seite);
    } catch (e) {
      setLaeuft(false);
      setFehler(fehlerMeldung(e));
    }
  };

  return (
    <Sheet
      title="Neue Seite"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => void anlegen()}>
          {laeuft ? 'Wird angelegt …' : 'Anlegen'}
        </FensterKnopf>
      }
    >
      <label className={styles.feld}>
        <span>Titel der Seite</span>
        <input
          className={styles.eingabe}
          value={titel}
          maxLength={150}
          autoFocus
          disabled={laeuft}
          placeholder="z. B. Unsere Gruppen"
          onChange={(e) => setTitel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void anlegen();
          }}
        />
      </label>
      {bereiche && bereiche.length > 1 && (
        <label className={styles.feld}>
          <span>Bereich</span>
          <select
            className={styles.eingabe}
            value={bereich === null ? '' : String(bereich)}
            disabled={laeuft}
            onChange={(e) => setBereich(e.target.value === '' ? null : Number(e.target.value))}
          >
            {bereiche.map((b) => (
              <option key={b.wert ?? 'website'} value={b.wert === null ? '' : String(b.wert)}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className={styles.leise}>
        Adresse der Seite: <code>/{titel.trim() === '' ? '…' : pfad}/</code> – sie entsteht aus dem
        Titel. Die Seite ist zuerst leer; Inhalte kommen im nächsten Schritt.
      </p>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
