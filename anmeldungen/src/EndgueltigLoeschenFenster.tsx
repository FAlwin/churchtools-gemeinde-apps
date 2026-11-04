import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { loeschenEndgueltig } from './einrichten';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import f from './Formular.module.scss';

/**
 * **Rückfrage „Endgültig löschen?“** (A4-Nachtrag, A9-4 D7) – ein Baustein für das Archiv und die Startseite. Löscht die
 * Gruppe samt Verlauf; ChurchTools kann das nicht zurückholen. Darum muss man den Namen zur Bestätigung eintippen.
 * `ohneAnmeldungen`: Die Anmeldungen hat ChurchTools schon gelöscht – dann geht es nur noch um die Antworten im Verlauf.
 */
export function EndgueltigLoeschenFenster({
  id,
  name,
  ohneAnmeldungen = false,
  onClose,
  onGeloescht,
}: {
  id: number;
  name: string;
  ohneAnmeldungen?: boolean;
  onClose: () => void;
  onGeloescht: () => void;
}) {
  const [bestaetigung, setBestaetigung] = useState('');
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  return (
    <Sheet
      title="Endgültig löschen?"
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          art="gefahr"
          disabled={bestaetigung.trim() !== name.trim() || arbeitet}
          onClick={() => speichern(() => loeschenEndgueltig(id), onGeloescht)}
        >
          {arbeitet ? 'Wird gelöscht …' : 'Endgültig löschen'}
        </FensterKnopf>
      }
    >
      <p className={f.fehler}>
        {ohneAnmeldungen ? (
          <>
            „{name}“ wird aus ChurchTools gelöscht – samt dem <b>Verlauf mit allen Antworten</b> der
            früheren Anmeldungen. Das lässt sich nicht rückgängig machen.
          </>
        ) : (
          <>
            „{name}“ wird mit <b>allen Anmeldungen</b> aus ChurchTools gelöscht. Das lässt sich
            nicht rückgängig machen.
          </>
        )}
      </p>
      <label className={f.feld}>
        <span>Zum Bestätigen den Namen eintippen</span>
        <input
          className={f.eingabe}
          value={bestaetigung}
          autoComplete="off"
          onChange={(e) => setBestaetigung(e.target.value)}
        />
      </label>
      <Fehler text={fehler} />
    </Sheet>
  );
}
