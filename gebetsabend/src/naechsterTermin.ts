import { useLaden } from '@ui/ct/useLaden';
import type { GebetsTermin } from '@shared/gebetsabend/termin';
import { ladeEinstellungen, ladeTermin } from './lesen';

/**
 * **Der nächste Termin** – oder `null`: ohne gewählten Kalender, ohne passenden Termin und auch, wenn ChurchTools
 * gerade nicht antwortet. Der Termin ist Beiwerk; das Zuhören darf daran nicht hängen. `aktualisiert` zählt hoch, wenn
 * die Einstellungen gespeichert wurden – dann neu laden (G3). Bis der neue da ist, bleibt der alte stehen (`behalten`):
 * sonst spränge die Karte um und ein laufender Player würde neu aufgebaut.
 */
export function useNaechsterTermin(
  modul: number,
  kategorie: number | null,
  aktualisiert = 0,
): GebetsTermin | null {
  const { stand } = useLaden(
    () =>
      kategorie === null ? null : ladeEinstellungen(modul, kategorie).then((e) => ladeTermin(e)),
    // `aktualisiert` steht nur in den deps: Es ist der Anlass zum Neuladen, gelesen wird es nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modul, kategorie, aktualisiert],
    { behalten: true },
  );
  return stand.art === 'fertig' ? stand.daten : null;
}
