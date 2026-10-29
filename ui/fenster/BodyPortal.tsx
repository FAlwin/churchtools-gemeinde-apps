import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BEREICH_ATTRIBUT } from '../erweiterung/cssBereich';

/**
 * Hängt Inhalt an `body` – **mit** dem Bereichs-Attribut (`BEREICH_ATTRIBUT`), sonst gelten dort weder Farb-Variablen
 * noch Grundregeln der App (gefunden E6-6b: das Zieh-Bild war durchsichtig und ohne Rand). Gebraucht, wo ein Fenster
 * oder Bild aus einer Tabelle heraus muss: Ein `div` in `tbody` wäre kein gültiges HTML.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  return createPortal(<div {...{ [BEREICH_ATTRIBUT]: '' }}>{children}</div>, document.body);
}
