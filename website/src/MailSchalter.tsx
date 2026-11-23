import { useState } from 'react';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { ladeMailAn, setzeMailAn, type EntwurfsOrt } from './daten';
import fenster from './Fenster.module.scss';
import styles from './Rechte.module.scss';

/**
 * **Der Schalter „Mails im Freigabe-Weg“** im Fenster „Einstellungen“ (Bauplan Website W3b-3, Alwins Entscheidung 23.11.2026) –
 * nur für die Leitung (das Fenster gibt es nur für sie, E-W22). Er **wirkt sofort**, unabhängig vom „Speichern“ des Fensters:
 * Gespeichert wird als eigener Wert in „Entwürfe“ (`website-mail`, `mailWerte.ts`), nicht in der Einheit „Einstellungen“ – die
 * geht erst über „Freigeben“ online. Darum geht ein Fehler hier nie als Fehler der Einstellungen durch und umgekehrt: Dieser
 * Bereich meldet nur, was er selbst nicht geschafft hat.
 *
 * Ein Haken (`type="checkbox"`) und kein eigener Knopf: Die Obergrenze für rohe Knöpfe je App (`bedienKnoepfe.test.ts`) steigt
 * nicht, und im Fenster „Einstellungen“ sind Haken die gewohnte Form. Erst was beim Nachlesen dasteht, gilt; scheitert es, bleibt der Schalter, wie er war, und die Meldung sagt warum.
 * Kein Wert = an.
 */
export function MailSchalter({ ort }: { ort: EntwurfsOrt }) {
  const { modul, kategorie } = ort;
  const geladen = useLaden(() => ladeMailAn({ modul, kategorie }), [modul, kategorie]);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const { setze } = geladen;

  const stand = geladen.stand;
  const an = stand.art === 'fertig' ? stand.daten : null;

  const umschalten = () => {
    if (an === null) return;
    setLaeuft(true);
    setFehler(null);
    setzeMailAn({ modul, kategorie }, !an).then(
      () => {
        setLaeuft(false);
        setze(!an);
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  return (
    <section aria-label="Mails im Freigabe-Weg">
      <h4 className={fenster.gruppe}>Mails im Freigabe-Weg</h4>
      <p className={styles.erklaerung}>
        Beim Einreichen und beim Löschen anfragen bekommt die Leitung eine Mail, beim Zurückgeben
        und Freigeben die Person, die eingereicht hat. Der Schalter wirkt sofort.
      </p>
      {stand.art === 'laedt' && <p className={fenster.leise}>Wird gelesen …</p>}
      {stand.art === 'fehler' && (
        <p className={`${styles.meldung} ${styles.fehler}`} role="alert">
          Der Schalter ließ sich nicht lesen – {stand.fehler.text}
        </p>
      )}
      {an !== null && (
        <label className={fenster.haken}>
          <input type="checkbox" checked={an} disabled={laeuft} onChange={umschalten} />
          Mails im Freigabe-Weg
        </label>
      )}
      <div aria-live="polite">
        {fehler && (
          <p className={`${styles.meldung} ${styles.fehler}`} role="alert">
            Nicht gespeichert – {fehler.text}
          </p>
        )}
      </div>
    </section>
  );
}
