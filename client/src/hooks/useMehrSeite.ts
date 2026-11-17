import { useCallback, useState } from 'react';

/**
 * **Welche Unterseite von „Mehr“ offen ist** (E10-V3b): `null` = „Mehr“ selbst, `{ vorlage: null }` = die Liste der
 * Ablaufvorlagen, `{ vorlage: 7 }` = Vorlage 7.
 *
 * Bewusst ein kleiner Zustand der App und nicht Teil von `useAppNav`: Der Reiter „Mehr“ bleibt markiert, die Seite braucht
 * weder Termin noch Lied und soll einen Kaltstart nicht überleben (ein offenes Fenster oder der Bearbeiten-Modus gingen
 * ohnehin verloren – wer nach dem Kaltstart in „Mehr“ landet, findet die Zeile wieder). Verlauf-Einträge legt die App für
 * keine ihrer Ansichten an (auch das Liedblatt nicht); „‹ Mehr“ ist der Weg zurück, wie „‹ Termine“ im Ablauf.
 *
 * Ein Wechsel des Reiters – auch das erneute Tippen auf „Mehr“ – führt zurück auf „Mehr“ selbst (`reiterGewechselt`): Wer
 * später wiederkommt, sieht nicht eine halb vergessene Vorlage.
 */
export function useMehrSeite(): {
  /** Die offene Vorlage – `null`: die Liste (oder gar keine Unterseite, siehe `offen`). */
  vorlage: number | null;
  /** Ist eine Unterseite offen? */
  offen: boolean;
  /** Die Liste der Ablaufvorlagen öffnen. */
  vorlagenOeffnen: () => void;
  /** Eine Vorlage öffnen (`id`) bzw. zurück zur Liste (`null`). */
  vorlageOeffnen: (id: number | null) => void;
  /** Zurück auf „Mehr“. */
  zurueck: () => void;
  /** Der Reiter wurde gewechselt (oder „Mehr“ erneut getippt). */
  reiterGewechselt: () => void;
} {
  const [seite, setSeite] = useState<{ vorlage: number | null } | null>(null);
  const vorlagenOeffnen = useCallback(() => setSeite({ vorlage: null }), []);
  const vorlageOeffnen = useCallback((id: number | null) => setSeite({ vorlage: id }), []);
  const zurueck = useCallback(() => setSeite(null), []);
  return {
    vorlage: seite?.vorlage ?? null,
    offen: seite !== null,
    vorlagenOeffnen,
    vorlageOeffnen,
    zurueck,
    reiterGewechselt: zurueck,
  };
}
