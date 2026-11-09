import { Icon } from '@ui/icons/icons';
import type { Feld } from '@shared/anmeldung/formular';
import { BausteinSymbol } from './bausteinIcons';

/**
 * **Die Knöpfe an einem Feld im Baukasten** (#845, Scheibe 4b-1: aus der Hülle herausgezogen, unverändert): hoch,
 * runter, kopieren (eigene Felder), entfernen bzw. ausschalten (nicht bei festen Feldern). Jeder Klick bleibt beim
 * Knopf – sonst wählte er zugleich das Feld.
 */
export function FeldWerkzeug({
  f,
  beweglich,
  fest,
  hochGesperrt,
  runterGesperrt,
  onHoch,
  onRunter,
  onKopieren,
  onEntfernen,
}: {
  f: Feld;
  beweglich: boolean;
  fest: boolean;
  hochGesperrt: boolean;
  runterGesperrt: boolean;
  onHoch: () => void;
  onRunter: () => void;
  onKopieren: () => void;
  onEntfernen: () => void;
}) {
  return (
    <>
      {beweglich && (
        <>
          <button
            type="button"
            aria-label={`${f.frage || 'Trennlinie'} nach oben`}
            disabled={hochGesperrt}
            onClick={(ev) => {
              ev.stopPropagation();
              onHoch();
            }}
          >
            <Icon name="chev-down" size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button
            type="button"
            aria-label={`${f.frage || 'Trennlinie'} nach unten`}
            disabled={runterGesperrt}
            onClick={(ev) => {
              ev.stopPropagation();
              onRunter();
            }}
          >
            <Icon name="chev-down" size={16} />
          </button>
        </>
      )}
      {f.art === 'eigen' && (
        <button
          type="button"
          aria-label={`${f.frage || 'Trennlinie'} kopieren`}
          title="Kopieren"
          onClick={(ev) => {
            ev.stopPropagation();
            onKopieren();
          }}
        >
          <BausteinSymbol name="kopie" size={16} />
        </button>
      )}
      {!fest && (
        <button
          type="button"
          aria-label={`${f.frage || 'Trennlinie'} entfernen`}
          title={f.art === 'eigen' ? 'Entfernen' : 'Ausschalten'}
          onClick={(ev) => {
            ev.stopPropagation();
            onEntfernen();
          }}
        >
          <Icon name="trash" size={16} />
        </button>
      )}
    </>
  );
}
