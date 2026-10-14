import { useEffect, useRef } from 'react';

/**
 * **Einen Hinweis ins Bild rollen**, sobald er erscheint (Konflikt, Fehler). In den Fächern steht er unter
 * einer langen Liste – am Handy sah man ihn nach dem Tippen oben gar nicht (in der Test-Instanz gefunden,
 * 14.10.2026). Eine Stelle für „Wer kann?“ und das Entwurfs-Fach.
 */
export function useInsBild<T extends HTMLElement>(sichtbar: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (sichtbar) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [sichtbar]);
  return ref;
}
