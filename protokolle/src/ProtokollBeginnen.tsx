import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { anfangsDokument } from '@shared/protokolle/beginnen';
import type { ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { protokollBeginnen } from './beginnen';
import { useAnfangWahl } from './AnfangWahl';
import { wannLang } from './anzeige';
import styles from './ProtokollBeginnen.module.scss';

/**
 * **Fenster „Protokoll beginnen“** (Bauplan S5-1, Entwurf 7) – für die Leitung bei einer Sitzung ohne Protokoll (oder
 * einer geplanten): eine **Vorlage**, **„Wie letztes Mal“** (Tagesordnung des letzten freigegebenen Protokolls) oder
 * **leer**. Danach öffnet sich das Protokoll im Editor. Hat inzwischen jemand anderes begonnen, sagt das Fenster das
 * und öffnet dessen Protokoll.
 */
export function ProtokollBeginnen({
  sitzung,
  gruppeId,
  modul,
  kategorie,
  mitarbeit,
  protokolle,
  teile,
  ich,
  zeitzone,
  onBegonnen,
  onClose,
}: {
  sitzung: Sitzung;
  gruppeId: number;
  modul: number;
  kategorie: number;
  mitarbeit: number | null;
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  ich: { person: number };
  zeitzone: string;
  /** Begonnen (oder schon da) – die Sitzung wird mit diesem Protokoll geöffnet. */
  onBegonnen: (sitzung: string) => void;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [ende, setEnde] = useState<{ sitzung: string; text: string } | null>(null);
  const { laden, anfang, auswahl } = useAnfangWahl({
    modul,
    protokolle,
    teile,
    beginn: sitzung.beginn,
    zeitzone,
  });

  const beginnen = () => {
    const a = anfang();
    if (!a) return;
    setLaeuft(true);
    setFehler(null);
    protokollBeginnen({
      modul,
      kategorie,
      mitarbeit: mitarbeit === null ? null : { modul, kategorie: mitarbeit },
      gruppe: gruppeId,
      sitzung,
      dokument: anfangsDokument(a, () => crypto.randomUUID()),
      von: ich.person,
    }).then(
      (r) => {
        setLaeuft(false);
        if (r.art === 'schon')
          setEnde({
            sitzung: r.sitzung,
            text: 'Inzwischen hat jemand anderes dieses Protokoll begonnen – deine Wahl wurde nicht übernommen.',
          });
        else if (r.hinweis) setEnde({ sitzung: r.sitzung, text: r.hinweis });
        else onBegonnen(r.sitzung);
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  return (
    <Sheet
      title="Protokoll beginnen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        ende ? (
          <FensterKnopf onClick={() => onBegonnen(ende.sitzung)}>Protokoll öffnen</FensterKnopf>
        ) : laden.art === 'fertig' && anfang() ? (
          <FensterKnopf disabled={laeuft} onClick={beginnen}>
            {laeuft ? 'Wird angelegt …' : 'Beginnen'}
          </FensterKnopf>
        ) : null
      }
    >
      <p className={styles.unter}>
        {sitzung.titel} · {wannLang(sitzung.beginn, zeitzone)}
      </p>
      {ende && (
        <p className={styles.hinweis} role="status">
          {ende.text}
        </p>
      )}
      {!ende && auswahl(laeuft)}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
