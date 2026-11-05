/**
 * **Das Blatt „Meine Dienste“** (Bauplan E8-3, Entwurf `e8-teilen.html`) – alle kommenden eigenen Dienste, zugesagte und
 * angefragte, z. B. für den Familienkalender. Nichts zu wählen. Quelle sind die eigenen Einteilungen
 * (`/persons/{ich}/servicerequests?only_future=true`, ausgewertet von `einteilungenAus` – derselben Regel wie beim
 * Tauschen); abgesagte liefert ChurchTools dort nicht. Es ist eine Tabelle wie das Plan-Blatt und wird mit dessen
 * Zeichnung (`ui/teilen/planBlattPdf.ts`) gezeichnet.
 */
import { tagKurz } from '../ct/datum';
import { ortszeitAus } from '../ct/zeit';
import type { Zelle } from '../ct/terminBlatt';
import { spanneLang, type PlanBlatt } from './planBlatt';
import type { Einteilung } from './tausch';

export interface MeineBlattQuelle {
  /** „Alwin Friesen“ – im Kopf und im Dateinamen. */
  name: string;
  einteilungen: readonly Einteilung[];
  zeitzone: string;
  gemeinde: string | null;
  app: string;
  stand: string;
}

const zelle = (text: string, stil?: 'fett' | 'grau'): Zelle => ({
  absaetze: [{ laeufe: [{ text, ...(stil ? { stil } : {}) }] }],
});

/** **Das Blatt bauen** – nach Beginn sortiert, mit Datum, Uhrzeit, Termin, Dienst und Stand. */
export function meineBlatt(q: MeineBlattQuelle): PlanBlatt {
  const zeilen = [...q.einteilungen]
    .filter((e) => e.beginn)
    .map((e) => ({ e, lokal: ortszeitAus(e.beginn, q.zeitzone) }))
    .sort((a, b) => a.lokal.localeCompare(b.lokal));
  const tage = zeilen.map((z) => z.lokal.slice(0, 10));
  const spanne = tage.length > 0 ? spanneLang(tage[0], tage[tage.length - 1]) : '';
  const titel = 'Meine Dienste';
  return {
    titel,
    untertitel: [q.name, spanne].filter(Boolean).join(' · '),
    gemeinde: q.gemeinde,
    app: q.app,
    stand: q.stand,
    quer: false,
    oben: null,
    abschnitte:
      zeilen.length > 0
        ? [
            {
              titel: null,
              kopf: ['Datum', 'Termin', 'Dienst', 'Stand'],
              zeilen: zeilen.map(({ e, lokal }) => [
                {
                  absaetze: [
                    {
                      laeufe: [
                        { text: tagKurz(lokal.slice(0, 10)), stil: 'fett' },
                        { text: ` ${lokal.slice(11, 16)}`, stil: 'grau' },
                      ],
                    },
                  ],
                },
                zelle(e.termin),
                zelle(e.dienst),
                e.zugesagt ? zelle('zugesagt') : zelle('angefragt', 'grau'),
              ]),
            },
          ]
        : [],
    leer: zeilen.length > 0 ? null : 'Du hast keine kommenden Dienste.',
    dateiname: [titel, q.name].filter(Boolean).join(' '),
  };
}
