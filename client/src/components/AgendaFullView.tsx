/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen – wie in ChurchTools, nur
 * aufgeräumt (#198 – vorher in `pages/Setlist.tsx`). Lieder sind antippbar (→ Charts).
 *
 * Die Uhrzeit (`item.time`) ist bereits serverseitig richtig: In ChurchTools ausgeblendete Punkte
 * (Auge) liefern gar keine Zeit.
 *
 * Änderungen seit dem letzten Ansehen zeigt seit 12.10.2026 ein kurzer Hinweis unten (`AblaufHinweis`)
 * samt Schildchen „neu"/„geändert" am Punkt – beide stehen ein paar Sekunden und verschwinden zusammen
 * (Alwin: „nur ein kurzer Hinweis und fertig"). Vorher leuchteten Punkte auf und entfernte zerfielen in
 * Partikel – das Abfotografieren dafür ließ die ChurchTools-Erweiterung hängen.
 */
import { useEffect, useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { itemLabel } from '@shared/ct/ablaufZeile';
import { vanishedRows, type ShownRow } from '../utils/vanishedRows';
import {
  hatAenderungen,
  meldungAus,
  meldungBereinigen,
  zusammenfassen,
  type AenderungsMeldung,
} from '../utils/ablaufAenderungen';
import { AblaufHinweis } from './AblaufHinweis';
import { useKurzerHinweis } from '../hooks/useKurzerHinweis';
import { AblaufListe } from '@ui/ablauf/AblaufListe';

export function AgendaFullView({
  items,
  eventId,
  beginn,
  onSelect,
  onSichtbar,
}: {
  items: AgendaItem[];
  eventId: number;
  /** Uhrzeit des Veranstaltungsbeginns („10:00") für die Linie nach dem Vorlauf (#423). */
  beginn?: string;
  onSelect: (songIndex: number) => void;
  /**
   * Meldet, ob die Ansicht steht (`true` nach dem Einhängen, `false` beim Aushängen). Erst dann darf
   * der Stand als „gesehen" gelten: Die Ablaufseite wird beim Start nachgeladen, die Daten kommen
   * oft vorher an – ohne dieses Signal war der Stand schon gemerkt und seine Markierungen entfernt,
   * bevor die Ansicht sie zeigen konnte (im Browser gefunden, 12.10.2026).
   */
  onSichtbar?: (sichtbar: boolean) => void;
}) {
  useEffect(() => {
    onSichtbar?.(true);
    return () => onSichtbar?.(false);
  }, [onSichtbar]);
  // Lokal erkannte Löschungen (#178): Punkte, die seit dem Gesehen-Stand hinzukamen und wieder
  // gelöscht wurden, kennt der Server nicht → er liefert für sie KEINEN removed-Platzhalter. Die Ansicht
  // merkt sich deshalb selbst, was sie zuletzt gezeigt hat, damit auch solche Punkte als „Entfernt"
  // gemeldet werden statt kommentarlos zu verschwinden.
  const [stand, setStand] = useState(() => abgleichen(null, eventId, items));
  // SYNCHRON während des Renderns abgleichen (NICHT useEffect): sonst kommt die Meldung einen Frame zu
  // spät. Bedingtes setState im Render ist das dokumentierte „State an geänderte Props
  // anpassen"-Muster – gleiche #113-Lektion wie in usePageDraw. Der Vergleichsstand liegt dabei im
  // ZUSTAND, nicht in einem Ref: Ein Ref ist nach dem ersten von zwei Durchläufen (StrictMode,
  // unterbrochenes Rendern) schon umgestellt, und der zweite verwarf das Ergebnis – die Schildchen
  // kamen nie an (im Browser gefunden, 12.10.2026).
  let aktuell = stand;
  if (stand.eventId !== eventId || stand.items !== items) {
    aktuell = abgleichen(stand, eventId, items);
    setStand(aktuell);
  }
  const meldung = aktuell.meldung;
  const zusammenfassung = zusammenfassen(meldung);
  const sichtbar = useKurzerHinweis(
    hatAenderungen(zusammenfassung)
      ? JSON.stringify([
          [...meldung.neu],
          [...meldung.geaendert],
          meldung.entfernt.map((e) => e.id),
        ])
      : '',
  );
  // Die Liste selbst ist der gemeinsame Baustein (`ui/ablauf/AblaufListe`, E6-1b) – hier kommen nur die
  // Schildchen „neu/geändert“ (solange der Hinweis steht) und das Antippen der Lieder dazu.
  const schild = (id: number) =>
    !sichtbar ? null : meldung.neu.has(id) ? 'neu' : meldung.geaendert.has(id) ? 'geändert' : null;
  return (
    <AblaufListe
      zeilen={items}
      beginn={beginn}
      onLied={onSelect}
      schild={schild}
      kopf={sichtbar && <AblaufHinweis aenderungen={zusammenfassung} />}
    />
  );
}

/** Was die Ansicht zuletzt gezeigt hat – und was die letzte Aktualisierung gebracht hat. */
interface Abgleich {
  eventId: number;
  items: AgendaItem[];
  rows: ShownRow[];
  meldung: AenderungsMeldung;
}

/** Nimmt einen neuen Stand auf; bei Terminwechsel/Erstaufbau frisch und ohne „lokal entfernt". */
function abgleichen(vorher: Abgleich | null, eventId: number, items: AgendaItem[]): Abgleich {
  const rows: ShownRow[] = items
    .filter((i) => !i.removed)
    // Gleiche Bezeichnung wie in der Liste (#215).
    .map((i) => ({ id: i.id, title: itemLabel(i) }));
  const gleicherTermin = vorher !== null && vorher.eventId === eventId;
  const weg = gleicherTermin ? vanishedRows(vorher.rows, new Set(items.map((i) => i.id))) : [];
  const neu = meldungAus(items, weg);
  // Nichts Neues (etwa die Markierungen nach dem Gesehen-Merken entfernt): laufende Meldung behalten.
  const meldung =
    gleicherTermin && !hatAenderungen(zusammenfassen(neu))
      ? meldungBereinigen(vorher.meldung, items)
      : neu;
  return { eventId, items, rows, meldung };
}
