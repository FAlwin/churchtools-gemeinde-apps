import { Icon } from '@ui/icons/icons';
import { rueckgaengigStile, useAenderungZurueck, type Aenderung } from '@ui/fenster/aenderung';
import v from './VeranstaltungSeite.module.scss';

// Die Zeile im Fenster und der Ablauf liegen seit O5 (23.10.2026) in `ui/fenster/` (Rueckgaengig, aenderung) – das Organigramm
// braucht sie auch. Hier bleibt nur die Leiste unten, die zu den Anmeldungen gehört (sie weicht dem Baukasten aus).
export { RueckgaengigImFenster } from '@ui/fenster/Rueckgaengig';
export type { Aenderung } from '@ui/fenster/aenderung';

/**
 * **Was zuletzt geändert wurde – als Leiste** (Alwin, 13.10.2026): Sie steht unten über der Seite und bleibt auch nach
 * einem Seitenwechsel stehen (nach dem Archivieren springt die Seite zur Übersicht). Es gibt immer nur die letzte
 * Änderung zurück.
 */
export function RueckgaengigLeiste({
  aenderung,
  onRueckgaengig,
  onSchliessen,
}: {
  aenderung: Aenderung;
  /** Nach erfolgreichem Rückgängig – die offene Seite lädt neu. */
  onRueckgaengig: () => void;
  onSchliessen: () => void;
}) {
  const { stand, fehler, zurueck } = useAenderungZurueck(aenderung, onRueckgaengig);

  return (
    <div className={v.leiste} role="status">
      <span>
        {stand === 'erledigt' ? 'Rückgängig gemacht.' : aenderung.text}
        {fehler && <span className={rueckgaengigStile.fehler}> {fehler}</span>}
      </span>
      {aenderung.rueckgaengig && stand !== 'erledigt' && (
        <button
          type="button"
          className={rueckgaengigStile.knopf}
          disabled={stand === 'arbeitet'}
          onClick={zurueck}
        >
          {stand === 'arbeitet' ? 'Wird rückgängig gemacht …' : 'Rückgängig'}
        </button>
      )}
      <button
        type="button"
        className={v.leisteZu}
        aria-label="Hinweis schließen"
        onClick={onSchliessen}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
