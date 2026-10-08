import { RundKnopf } from './KnopfReihe';
import { Icon } from './icons';
import { useAppVollbild } from '../hooks/useAppVollbild';
import { funktionen } from '../services/funktionen';

/**
 * Der Vollbild-Knopf für Liederliste und Ablauf (Entwurf mit Alwin, 08.10.2026): schon VOR dem Öffnen
 * eines Lieds ins Vollbild. Im Liedblatt ist es ein Werkzeug (`ChartHeader`). Nur in der Erweiterung –
 * sonst rendert er nichts.
 */
export function VollbildKnopf() {
  const [an, umschalten] = useAppVollbild();
  if (!funktionen.vollbildKnopf) return null;
  return (
    <RundKnopf onClick={umschalten} title={an ? 'Vollbild beenden' : 'Vollbild'} aktiv={an}>
      <Icon name={an ? 'vollbild-aus' : 'vollbild'} size={18} stroke={2.2} />
    </RundKnopf>
  );
}
