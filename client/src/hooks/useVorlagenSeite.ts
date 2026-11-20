import { useCallback, useState } from 'react';

/**
 * **Ob die Seite „Ablaufvorlagen“ im Reiter „Termine“ offen ist** (E10-V3b, seit „Ruhige Bedienung“ R13 über das „⋯“ in
 * der Werkzeugzeile der Termine – vorher eine Zeile unter „Mehr“): `null` = die Terminliste selbst, `{ vorlage: null }` =
 * die Liste der Ablaufvorlagen, `{ vorlage: 7 }` = Vorlage 7.
 *
 * Bewusst ein kleiner Zustand der App und nicht Teil von `useAppNav`: Der Reiter „Termine“ bleibt markiert, die Seite
 * braucht weder Termin noch Lied und soll einen Kaltstart nicht überleben (ein offenes Fenster oder der Bearbeiten-Modus
 * gingen ohnehin verloren – wer nach dem Kaltstart bei den Terminen landet, findet das „⋯“ wieder). Verlauf-Einträge legt
 * die App für keine ihrer Ansichten an (auch das Liedblatt nicht); „‹ Termine“ ist der Weg zurück, wie im Ablauf.
 *
 * Ein Wechsel des Reiters – auch das erneute Tippen auf „Termine“ – führt zurück auf die Terminliste (`reiterGewechselt`):
 * Wer später wiederkommt, sieht nicht eine halb vergessene Vorlage.
 */
export function useVorlagenSeite(): {
  /** Die offene Vorlage – `null`: die Liste (oder gar keine Unterseite, siehe `offen`). */
  vorlage: number | null;
  /** Ist die Seite „Ablaufvorlagen“ (oder eine Vorlage) offen? */
  offen: boolean;
  /** Die Liste der Ablaufvorlagen öffnen. */
  vorlagenOeffnen: () => void;
  /** Eine Vorlage öffnen (`id`) bzw. zurück zur Liste (`null`). */
  vorlageOeffnen: (id: number | null) => void;
  /** Zurück zur Terminliste. */
  zurueck: () => void;
  /** Der Reiter wurde gewechselt (oder „Termine“ erneut getippt). */
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
