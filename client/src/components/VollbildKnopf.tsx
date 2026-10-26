import { RundKnopf } from '@ui/bedienung/KnopfReihe';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
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
 * rechts in den Seitenkopf, seit Scheibe S als eckiger Kopfknopf (nur Symbol). Im Liedblatt sitzt er
 * bis B1 noch rund in der Kopfzeile (`ChartHeader`), nie im Werkzeug-Menü. Nur in der Erweiterung –
 * sonst rendert er nichts.
 */
export function VollbildKnopf() {
  const [an, umschalten] = useAppVollbild();
  if (!funktionen.vollbildKnopf) return null;
  const titel = an ? 'Vollbild beenden' : 'Vollbild';
  return (
    <KopfKnopf
      onClick={umschalten}
      label={titel}
      aktiv={an}
      nurSymbol
      symbol={<Icon name={an ? 'vollbild-aus' : 'vollbild'} size={18} stroke={2.2} />}
    />
  );
}
