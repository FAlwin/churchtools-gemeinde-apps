import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import { useAppVollbild } from '../hooks/useAppVollbild';
import { funktionen } from '../services/funktionen';

/**
 * Wie der Vollbild-Knopf AUSSIEHT – Symbol, Titel, Hervorhebung – an EINER Stelle (#463): eckiger Kopfknopf, nur
 * Symbol. Seitenkopf (`VollbildKnopf`) und Liedblatt (`BlattKopf`, Scheibe B1) zeichnen ihn hierüber; bis B1 baute
 * das Liedblatt eine runde Fassung daneben.
 */
export function VollbildKopfKnopf({ an, onClick }: { an: boolean; onClick: () => void }) {
  return (
    <KopfKnopf
      onClick={onClick}
      label={an ? 'Vollbild beenden' : 'Vollbild'}
      aktiv={an}
      nurSymbol
      symbol={<Icon name={an ? 'vollbild-aus' : 'vollbild'} size={18} stroke={2.2} />}
    />
  );
}

/**
 * Der Vollbild-Knopf für jede Seite (Entwurf mit Alwin, 08.10.2026) – `SeitenGeruest` setzt ihn ganz
 * rechts in den Seitenkopf. Nur in der Erweiterung – sonst rendert er nichts.
 */
export function VollbildKnopf() {
  const [an, umschalten] = useAppVollbild();
  if (!funktionen.vollbildKnopf) return null;
  return <VollbildKopfKnopf an={an} onClick={umschalten} />;
}
