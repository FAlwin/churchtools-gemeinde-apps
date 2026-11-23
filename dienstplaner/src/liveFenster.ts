import { utcAus } from '@shared/ct/zeit';

/**
 * **Wann steht auf der Startseite der Knopf „Live“?** (Alwin 23.11.2026): am **Tag des Termins ab 0 Uhr** – in der Ortszeit
 * der Gemeinde (`utcAus`, nicht die Zeitzone des Browsers) – **bis zum Ende des Termins** (`endDate`, einschließlich). Davor und
 * danach nicht. Ein Termin über Mitternacht (Beginn 23 Uhr, Ende 1 Uhr) bleibt bis zu seinem Ende da; hat ein Termin kein eigenes Ende
 * (`ende` nicht nach `beginn`), gilt der Tag bis 24 Uhr.
 */
export function liveKnopfOffen(
  termin: { tag: string; beginn: string; ende: string },
  jetzt: Date,
  zeitzone: string,
): boolean {
  const von = Date.parse(utcAus(`${termin.tag}T00:00`, zeitzone));
  const eigenesEnde = Date.parse(termin.ende) > Date.parse(termin.beginn);
  const bis = eigenesEnde
    ? Date.parse(termin.ende)
    : Date.parse(utcAus(`${folgetag(termin.tag)}T00:00`, zeitzone)) - 1;
  const t = jetzt.getTime();
  return t >= von && t <= bis;
}

function folgetag(tag: string): string {
  const [j, m, t] = tag.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, t + 1)).toISOString().slice(0, 10);
}
