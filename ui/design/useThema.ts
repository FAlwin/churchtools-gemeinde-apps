import { useEffect, useState } from 'react';
import type { Thema } from './thema';

const lies = (): Thema => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/**
 * **Hell oder dunkel, laufend** – folgt `html[data-theme]` (das setzt `folgeChurchToolsThema`). Für alles, was die Farbe
 * nicht über CSS-Variablen bekommt: den Editor der Protokolle (BlockNote will das Thema als Wert) und die Markier-Farben
 * in Leiste und Lese-Ansicht (K3a). Vorher stand der Hook nur im Protokoll-Editor.
 */
export function useThema(): Thema {
  const [thema, setThema] = useState<Thema>(lies);
  useEffect(() => {
    const b = new MutationObserver(() => setThema(lies()));
    b.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => b.disconnect();
  }, []);
  return thema;
}
