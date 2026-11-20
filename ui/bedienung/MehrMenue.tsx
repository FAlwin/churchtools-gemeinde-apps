import { useState } from 'react';
import { Icon } from '../icons/icons';
import { KopfKnopf } from './KopfKnopf';
import { AuswahlBlatt, KnopfMitMenue, type Option } from './OptionWaehlen';

/**
 * **Das „⋯“-Menü der Werkzeugzeile** (R6/E3, „Ruhige Bedienung“ B3): Seltenes liegt einen Klick tiefer, jeder Eintrag mit
 * Symbol und Wort (`Option.symbol`). Ein stiller Knopf mit drei Punkten – am Rechner klappt ein kleines Menü darunter auf
 * (`KnopfMitMenue`), am Handy kommt das Blatt von unten (`AuswahlBlatt`, wie nach dem „+“ in der ChurchTools-App).
 *
 * **Reihenfolge „Aktion“ / „Menü schließen“:** Erst geht das Menü zu, dann läuft die Aktion – eine Aktion, die selbst ein
 * Fenster öffnet, wird so nicht vom Schließen zurückgesetzt (Lehre 05.08.2026). Jeder Eintrag hat dafür einen eigenen Test.
 *
 * Ohne Einträge gibt es auch den Knopf nicht.
 */
export function MehrMenue({
  optionen,
  handy,
  titel = 'Mehr',
}: {
  optionen: Option[];
  handy: boolean;
  /** Name von Knopf und Menü. */
  titel?: string;
}) {
  const [blatt, setBlatt] = useState(false);
  if (optionen.length === 0) return null;
  const symbol = <Icon name="mehr" size={18} />;
  if (!handy)
    return (
      <KnopfMitMenue
        optionen={optionen}
        titel={titel}
        knopf={({ offen, umschalten }) => (
          <KopfKnopf
            still
            nurSymbol
            label={titel}
            symbol={symbol}
            menuOffen={offen}
            offen={offen}
            onClick={umschalten}
          />
        )}
      />
    );
  return (
    <>
      <KopfKnopf
        still
        nurSymbol
        label={titel}
        symbol={symbol}
        menuOffen={blatt}
        offen={blatt}
        onClick={() => setBlatt(true)}
      />
      {blatt && (
        <AuswahlBlatt
          titel={titel}
          optionen={optionen.map((o) => ({
            ...o,
            onClick: () => {
              setBlatt(false);
              o.onClick();
            },
          }))}
          onClose={() => setBlatt(false)}
        />
      )}
    </>
  );
}
