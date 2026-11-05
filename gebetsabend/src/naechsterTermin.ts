import { useEffect, useState } from 'react';
import type { GebetsTermin } from '@shared/gebetsabend/termin';
import { ladeEinstellungen, ladeTermin } from './lesen';

/**
 * **Der nächste Termin** – oder `null`: ohne gewählten Kalender, ohne passenden Termin und auch, wenn ChurchTools
 * gerade nicht antwortet. Der Termin ist Beiwerk; das Zuhören darf daran nicht hängen. `aktualisiert` zählt hoch, wenn
 * die Einstellungen gespeichert wurden – dann neu laden (G3).
 */
export function useNaechsterTermin(
  modul: number,
  kategorie: number | null,
  aktualisiert = 0,
): GebetsTermin | null {
  const [termin, setTermin] = useState<GebetsTermin | null>(null);
  useEffect(() => {
    if (kategorie === null) return;
    let aktuell = true;
    ladeEinstellungen(modul, kategorie)
      .then((e) => ladeTermin(e))
      .then(
        (t) => {
          if (aktuell) setTermin(t);
        },
        () => undefined,
      );
    return () => {
      aktuell = false;
    };
  }, [modul, kategorie, aktualisiert]);
  return termin;
}
