import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { tagPunkt } from '@shared/ct/datum';
import type { LoeschdatumVorbei } from './ablaeufe';
import f from './Formular.module.scss';

/**
 * **Rückfrage „Sofort löschen?“** (A9-4 D5, A9-5) – ein Baustein für Freigeben und nachträgliches Einrichten: Das
 * Löschdatum ist erreicht, und ChurchTools entfernte beim Schreiben sofort die Anmeldungen, die noch da sind
 * (`LoeschdatumVorbei` mit Anzahl). `wann`: „Beim Freigeben“, „Beim Einrichten“.
 */
export function SofortLoeschenFrage({
  frage,
  wann,
  knopf,
  arbeitet,
  onWeiter,
  onZurueck,
  onClose,
}: {
  frage: LoeschdatumVorbei;
  wann: string;
  knopf: string;
  arbeitet: boolean;
  onWeiter: () => void;
  onZurueck: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      title="Sofort löschen?"
      onClose={onClose}
      zurueck={onZurueck}
      onAbbrechen={onZurueck}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf art="gefahr" disabled={arbeitet} onClick={onWeiter}>
          {arbeitet ? 'Einen Moment …' : knopf}
        </FensterKnopf>
      }
    >
      <p className={f.fehler}>
        Das Löschdatum ({tagPunkt(frage.datum)}) ist schon erreicht. {wann} entfernt ChurchTools{' '}
        <b>sofort</b>{' '}
        {frage.anzahl === 1
          ? 'die eine Anmeldung'
          : frage.anzahl === undefined
            ? 'alle Anmeldungen'
            : `alle ${frage.anzahl} Anmeldungen`}
        . Das lässt sich nicht rückgängig machen.
      </p>
      <p className={f.hinweis}>
        Sollen sie bleiben: abbrechen und unter „Datenschutz“ die Frist verlängern oder den Termin
        prüfen.
      </p>
    </Sheet>
  );
}
