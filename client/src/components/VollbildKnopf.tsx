import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import { useAppVollbild } from '../hooks/useAppVollbild';
import { funktionen } from '../services/funktionen';

/**
 * Wie der Vollbild-Knopf AUSSIEHT – Symbol, Titel, Hervorhebung – an EINER Stelle (#463): eckiger Kopfknopf, nur
 * Symbol. Seitenkopf (`VollbildKnopf`) und Liedblatt (`BlattKopf`, Scheibe B1) zeichnen ihn hierüber; bis B1 baute
 * das Liedblatt eine runde Fassung daneben. **Still** (R2, B8) mit `still`: ein Werkzeug neben den Reitern, kein eigener Knopf – am Handy
 * rahmt `KopfKnopf still` ihn selbst (R12).
 */
export function VollbildKopfKnopf({
  an,
  onClick,
  still = false,
}: {
  an: boolean;
  onClick: () => void;
  /** Still (R2): neben den Reitern und im breiten Liedblatt-Kopf. Sonst Neben-Stufe mit Rahmen. */
  still?: boolean;
}) {
  return (
    <KopfKnopf
      onClick={onClick}
      label={an ? 'Vollbild beenden' : 'Vollbild'}
      aktiv={an}
      still={still}
      nurSymbol
      symbol={<Icon name={an ? 'vollbild-aus' : 'vollbild'} size={18} stroke={2.2} />}
    />
  );
}

/**
 * Der Vollbild-Knopf für jede Seite (Entwurf mit Alwin, 08.10.2026) – `SeitenGeruest` setzt ihn ganz
 * rechts in den Seitenkopf. Nur in der Erweiterung – sonst rendert er nichts.
 */
export function VollbildKnopf({ still = false }: { still?: boolean } = {}) {
  const [an, umschalten] = useAppVollbild();
  if (!funktionen.vollbildKnopf) return null;
  return <VollbildKopfKnopf an={an} onClick={umschalten} still={still} />;
}
