import { useEffect, useRef, useState } from 'react';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import styles from './TerminFormular.module.scss';

/**
 * **„Bild“ im Formular „In Kalender eintragen“** (einfach, Alwin 26.11.2026): „+ Hinzufügen“ öffnet die Dateiwahl (nur
 * Bilder), danach steht eine kleine Vorschau mit Dateiname und ✕ da – kein eigenes Fenster, kein Zuschneiden. Die Datei
 * bleibt hier im Speicher; hochgeladen wird erst nach dem Anlegen des Termins (`bildHochladen.ts`). Die Vorschau ist eine
 * Objekt-URL, die beim Entfernen und beim Schließen wieder freigegeben wird.
 */
export function TerminBildFeld({
  bild,
  onBild,
  deaktiviert,
}: {
  bild: File | null;
  onBild: (b: File | null) => void;
  deaktiviert: boolean;
}) {
  const wahl = useRef<HTMLInputElement>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  useEffect(() => {
    if (!bild) {
      setVorschau(null);
      return;
    }
    const url = URL.createObjectURL(bild);
    setVorschau(url);
    return () => URL.revokeObjectURL(url);
  }, [bild]);

  return (
    <>
      <input
        ref={wahl}
        type="file"
        accept="image/*"
        hidden
        aria-label="Bild wählen"
        onChange={(ev) => {
          const datei = ev.target.files?.[0] ?? null;
          // Dieselbe Datei muss sich nach dem Entfernen wieder wählen lassen.
          ev.target.value = '';
          if (datei) onBild(datei);
        }}
      />
      {bild ? (
        <div className={styles.bild}>
          {vorschau && <img className={styles.vorschau} src={vorschau} alt="" />}
          <span className={styles.dateiname}>{bild.name}</span>
          <ZeilenKnopf label="Bild entfernen" disabled={deaktiviert} onClick={() => onBild(null)}>
            <Icon name="x" size={14} stroke={2.4} />
          </ZeilenKnopf>
        </div>
      ) : (
        <TextKnopf disabled={deaktiviert} onClick={() => wahl.current?.click()}>
          + Hinzufügen
        </TextKnopf>
      )}
    </>
  );
}
