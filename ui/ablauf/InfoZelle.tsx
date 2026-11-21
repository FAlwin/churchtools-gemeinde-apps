/**
 * **Eine Info-Zelle im Bearbeiten-Modus** (Entwurf `ablauf-infos-bearbeiten.html`, Variante B – ohne Knöpfe): Die Spalten
 * der Dienstgruppen bleiben beim Bearbeiten stehen wie im Lesemodus, und die ganze Zelle ist ein Knopf – ein Klick öffnet
 * ein Textfeld in der Zelle. **Gespeichert wird beim Verlassen** (Klick daneben, Tab), und nur, wenn sich der Text
 * geändert hat; **Esc verwirft**. Scheitert das Speichern, geht die Zelle wieder auf – mit dem eingegebenen Text und einer
 * roten Meldung darunter: Nichts geht still verloren, und ein vorübergehender Fehler zerstört nichts.
 *
 * Die Zelle schreibt nicht selbst: `onSpeichern` kommt von der Bearbeiten-Liste (`handleUpdate`: spiegelt den Text sofort,
 * rollt bei Fehler zurück und wirft weiter). `gesehen` ist der Stand des Punkts **beim Öffnen** – hat inzwischen jemand
 * anderes dieselbe Info geändert, antwortet ChurchTools mit 412 statt still zu überschreiben; nach einem Fehler gilt
 * derselbe Stand weiter (kein stilles Überschreiben beim zweiten Versuch).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { itemLabel, punktStand, type AblaufZeile, type PunktStand } from '@shared/ct/ablaufZeile';
import { ABLAUFPUNKT_GRENZEN, type InfoGruppe } from '@shared/types/index';
import { infoText } from './infoTabellenRegeln';
import styles from './InfoZelle.module.scss';

/** Was `SortableRow` für die Zellen braucht – alle Gruppen und der gemeinsame Schreibweg. */
export interface InfoZellen {
  gruppen: readonly InfoGruppe[];
  /**
   * Schreibt die Info; wirft bei Fehler (die Zelle zeigt die Meldung). `gesehen` fehlt = „Trotzdem speichern“ nach einem
   * Konflikt (412) – wie im Punkt-Fenster (E6-3c).
   */
  onSpeichern: (gruppeId: number, text: string, gesehen: PunktStand | undefined) => Promise<void>;
  /** Ablauf abgeschlossen: Ein Klick öffnet kein Feld, sondern zeigt den Sperr-Hinweis. */
  gesperrt?: () => void;
}

export function InfoZelle({
  item,
  gruppe,
  onSpeichern,
  gesperrt,
}: {
  item: AblaufZeile;
  gruppe: InfoGruppe;
  onSpeichern: InfoZellen['onSpeichern'];
  gesperrt?: () => void;
}) {
  const text = infoText(item, gruppe.id);
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement | null>(null);
  // Der Stand beim Öffnen – nach einem Fehler bleibt er (sonst überschriebe der zweite Versuch eine fremde Änderung).
  const gesehen = useRef<PunktStand | null>(null);
  // Esc hat verworfen: das Blur, das darauf folgt, speichert nicht.
  const verworfen = useRef(false);
  // Nach einem Konflikt (412) speichert das nächste Verlassen ohne Vergleich – „Trotzdem speichern“ wie im Punkt-Fenster.
  // Ohne das scheiterte jeder weitere Versuch am alten Stand, und der Text ließe sich nur noch verwerfen.
  const trotzdem = useRef(false);
  const lebt = useRef(true);
  useEffect(() => {
    lebt.current = true;
    return () => {
      lebt.current = false;
    };
  }, []);

  // Beim Öffnen: Fokus, Cursor ans Ende.
  useEffect(() => {
    const f = feld.current;
    if (!offen || !f) return;
    f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
  }, [offen]);
  // Das Feld wächst mit dem Text (dynamischer Laufzeitwert, darum nicht im Stil).
  useLayoutEffect(() => {
    const f = feld.current;
    if (!offen || !f) return;
    f.style.height = 'auto';
    f.style.height = `${f.scrollHeight}px`;
  }, [offen, entwurf]);

  function oeffnen(): void {
    if (gesperrt) {
      gesperrt();
      return;
    }
    verworfen.current = false;
    trotzdem.current = false;
    gesehen.current = punktStand(item);
    setEntwurf(text);
    setFehler(null);
    setOffen(true);
  }

  function beimVerlassen(): void {
    if (verworfen.current) {
      verworfen.current = false;
      return;
    }
    setOffen(false);
    const neu = entwurf.trim();
    if (neu === text.trim()) return;
    const stand = trotzdem.current ? undefined : (gesehen.current ?? punktStand(item));
    onSpeichern(gruppe.id, neu, stand).catch((e: unknown) => {
      if (!lebt.current) return;
      const meldung =
        e instanceof Error && e.message ? e.message : 'Info konnte nicht gespeichert werden.';
      const konflikt = (e as { status?: unknown } | null)?.status === 412;
      trotzdem.current = konflikt;
      setFehler(konflikt ? `${meldung} Verlassen speichert trotzdem · Esc verwirft.` : meldung);
      setOffen(true);
    });
  }

  function verwerfen(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    verworfen.current = true;
    setOffen(false);
    setFehler(null);
    // Das Feld verlässt den Fokus – das Blur sieht `verworfen` und speichert nicht.
    e.currentTarget.blur();
  }

  return (
    <div className={`${styles.zelle}${offen ? ` ${styles.zelleOffen}` : ''}`}>
      {offen ? (
        <>
          <textarea
            ref={feld}
            className={styles.feld}
            value={entwurf}
            maxLength={ABLAUFPUNKT_GRENZEN.gruppenInfo}
            rows={2}
            aria-label={`Info für ${gruppe.name} bei „${itemLabel(item)}“`}
            onChange={(e) => setEntwurf(e.target.value)}
            onBlur={beimVerlassen}
            onKeyDown={verwerfen}
          />
          {fehler ? (
            <div className={styles.fehler} role="alert">
              {fehler}
            </div>
          ) : (
            <div className={styles.hinweis}>Speichert beim Verlassen · Esc verwirft</div>
          )}
        </>
      ) : (
        <button
          type="button"
          className={`${styles.knopf}${text ? '' : ` ${styles.leer}`}`}
          aria-label={`Info für ${gruppe.name} bei „${itemLabel(item)}“ bearbeiten`}
          onClick={oeffnen}
        >
          <span className={styles.text}>{text || '–'}</span>
          {!text && (
            <span className={styles.plus} aria-hidden="true">
              + Info
            </span>
          )}
        </button>
      )}
    </div>
  );
}
