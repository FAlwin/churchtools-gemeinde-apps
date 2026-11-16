import { useState } from 'react';
import type { Antworten, Feld, OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  gezeigteSeiten,
  mitSchritten,
  schrittName,
  seiteFehlt,
  seiten,
  type Seite,
} from '@shared/anmeldung/formularSchritte';

/** Woran eine Seite zu erkennen ist – an ihrem Baustein; Schritt 1 hat keinen. */
const kennung = (s: Seite) => s.schritt?.id ?? null;

/**
 * **Das Formular in Schritten** (Etappe F2b, Entwurf `f2-schritte-v1`): welche Seite gerade offen ist, „Weiter“ und
 * „Zurück“. Was auf welcher Seite steht, welche gezeigt werden und was fehlt, kommt aus
 * `@shared/anmeldung/formularSchritte` (F2a) – hier nur das Blättern.
 *
 * Die offene Seite merkt sich ihren Baustein, nicht ihre Nummer: Wird davor ein Schritt übersprungen oder wieder
 * gezeigt, bleibt man auf derselben Seite. Fällt die offene Seite selbst weg, gilt die gezeigte davor.
 * Ohne Schritte (oder `aktiv` = false, z. B. im Baukasten) gibt es genau eine Seite mit allem.
 */
export function useSchritte({
  e,
  antworten,
  aktiv,
}: {
  e: OeffentlicheEinstellungen;
  antworten: Antworten;
  aktiv: boolean;
}) {
  const mit = aktiv && mitSchritten(e.formular);
  const [offen, setOffen] = useState<string | null>(null);
  const alle = seiten(e.formular);
  // Aus denselben Seiten wie `alle` – sonst findet `includes` die offene Seite nicht (F2b, Durchlauf 16.11.2026).
  const gezeigt = mit ? gezeigteSeiten(e.formular, antworten, alle) : [];
  let seite: Seite | null = null;
  if (mit) {
    // Die offene Seite – fällt sie weg, die gezeigte davor (in der Reihenfolge aller Seiten).
    const bis = alle.findIndex((s) => kennung(s) === offen);
    for (let i = Math.max(0, bis); i >= 0 && !seite; i--)
      if (gezeigt.includes(alle[i])) seite = alle[i];
    seite ??= gezeigt[0];
  }
  const nr = seite ? gezeigt.indexOf(seite) : 0;
  const letzte = !mit || nr === gezeigt.length - 1;
  const erstePersonen = mit ? gezeigt.find((s) => s.person.length > 0) : undefined;

  return {
    /** Hat das Formular Schritte (und blättert es)? */
    mit,
    /** Alle Seiten (für den Balken: übersprungene gestrichelt) und die gezeigten. */
    alle,
    gezeigt,
    /** Die offene Seite (`null` ohne Schritte). */
    seite,
    /** Nummer der offenen Seite unter den gezeigten (ab 0). */
    nr,
    erste: nr === 0,
    letzte,
    /** Wie der offene Schritt heißt. */
    name: seite ? schrittName(e, seite) : '',
    /** Steht dieses Kontakt-Feld auf der offenen Seite? Ohne Schritte: alle. */
    zeigtKontakt: (f: Feld) => !seite || seite.anmeldung.includes(f),
    /** Steht diese Frage je Person auf der offenen Seite? Ohne Schritte: alle. */
    zeigtPerson: (f: Feld) => !seite || seite.person.includes(f),
    /** Hat die offene Seite Fragen je Person? */
    mitPersonen: !seite || seite.person.length > 0,
    /** „+ Weitere Person“ und „Entfernen“ – nur auf der ersten Seite mit Fragen je Person (Klick-Runde 8). */
    personenAnlegen: !mit || seite === erstePersonen,
    /**
     * **Weiter:** Was auf der offenen Seite fehlt (dieselbe Pflichtprüfung wie beim Absenden, `seiteFehlt`). Fehlt
     * nichts, geht es zur nächsten gezeigten Seite.
     */
    weiter(): string[] {
      if (!seite || letzte) return [];
      const fehlt = seiteFehlt(e.formular, antworten, seite, false);
      if (!fehlt.length) setOffen(kennung(gezeigt[nr + 1]));
      return fehlt;
    },
    /** Zurück zur gezeigten Seite davor – ohne Prüfung, die Antworten bleiben. */
    zurueck() {
      if (seite && nr > 0) setOffen(kennung(gezeigt[nr - 1]));
    },
  };
}
