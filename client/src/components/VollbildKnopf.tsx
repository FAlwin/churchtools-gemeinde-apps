import { RundKnopf } from './KnopfReihe';
import { Icon } from './icons';
import { useAppVollbild } from '../hooks/useAppVollbild';
import { funktionen } from '../services/funktionen';

/**
 * Wie der Vollbild-Knopf AUSSIEHT – Symbol, Titel, Hervorhebung – an EINER Stelle (#463). Vorher baute
 * `ChartHeader` ihn nach; eine geänderte Beschriftung hätte nur eine der beiden Stellen erreicht.
 */
export function VollbildRundKnopf({ an, onClick }: { an: boolean; onClick: () => void }) {
  return (
    <RundKnopf onClick={onClick} title={an ? 'Vollbild beenden' : 'Vollbild'} aktiv={an}>
      <Icon name={an ? 'vollbild-aus' : 'vollbild'} size={18} stroke={2.2} />
    </RundKnopf>
  );
}

/**
 * Der Vollbild-Knopf für jede Seite (Entwurf mit Alwin, 08.10.2026) – `SeitenGeruest` setzt ihn ganz
 * rechts oben. Im Liedblatt sitzt er abgesetzt rechts in der Kopfzeile (`ChartHeader`), nie im
 * Werkzeug-Menü. Nur in der Erweiterung – sonst rendert er nichts.
 */
export function VollbildKnopf() {
  const [an, umschalten] = useAppVollbild();
  if (!funktionen.vollbildKnopf) return null;
  return <VollbildRundKnopf an={an} onClick={umschalten} />;
}
