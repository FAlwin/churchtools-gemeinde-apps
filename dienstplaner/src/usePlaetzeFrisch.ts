import { useEffect, useRef, useState } from 'react';

/** Wie lange Plan und Entwürfe nach einer Platzänderung Zeit haben, neu zu laden, bevor die Fenster wieder freigegeben werden. */
const WARTEZEIT_MS = 20_000;

interface Wartet<P, D> {
  /** Der Plan beim Abschluss der Änderung – erst ein ANDERER Plan ist der neu geladene. */
  plan: P;
  /** Die Entwürfe beim Abschluss – `undefined`, wenn keine umgetragen wurden (dann muss auf sie nicht gewartet werden). */
  daten: D | null | undefined;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * **Nach einer Platzänderung passen Plan und Entwürfe erst wieder zusammen, wenn BEIDE neu geladen sind** (19.11.2026, beim
 * Durchklicken gefunden): Die Entwürfe wurden sofort neu geladen, der Plan erst beim Schließen des Fensters. Dazwischen
 * rechnete das offene Plätze-Fenster mit neuen Entwurfs-Nummern auf alten Plätzen – nach 1 → 2 passte „Platz 1“ zu keinem
 * Platz mehr, die Untergrenze für „−“ fiel auf 0, und die Matrix dahinter zeigte „Entwurf ohne Platz“.
 *
 * `geaendert` nach jeder echten Änderung aufrufen: lädt den Plan neu (und die Entwürfe, wenn welche umgetragen wurden) und
 * meldet `laedt`, bis beide da sind – solange sperren die Plätze-Fenster ihre Knöpfe. Kommt das Neuladen nicht binnen
 * `wartezeit`, wird wieder freigegeben, mit einer Meldung (lieber ein Hinweis als ein Fenster, das für immer hängt).
 */
export function usePlaetzeFrisch<P, D>({
  plan,
  daten,
  planNeu,
  entwuerfeNeu,
  showToast,
  wartezeit = WARTEZEIT_MS,
}: {
  plan: P;
  /** Die geladenen Entwürfe (`null`, solange sie neu geladen werden). */
  daten: D | null;
  planNeu: () => void;
  entwuerfeNeu: () => void;
  showToast: (text: string) => void;
  wartezeit?: number;
}) {
  const [wartet, setWartet] = useState<Wartet<P, D> | null>(null);
  // Der Stand beim Abschluss der Änderung – der Aufruf kommt nach einem `await`, die Werte der Zeichnung von damals sind alt.
  const jetzt = useRef({ plan, daten, wartet });
  jetzt.current = { plan, daten, wartet };

  const laedt =
    wartet !== null &&
    (plan === wartet.plan ||
      (wartet.daten !== undefined && (daten === null || daten === wartet.daten)));

  // Sind beide da, endet das Warten.
  useEffect(() => {
    if (wartet && !laedt) setWartet(null);
  }, [wartet, laedt]);

  // Endet ein Warten (fertig, abgelöst, Seite weg), braucht es seinen Zeitgeber nicht mehr.
  useEffect(
    () => () => {
      if (wartet) clearTimeout(wartet.timer);
    },
    [wartet],
  );

  /** Eine Platzzahl hat sich wirklich geändert; `entwuerfeUmgetragen`: es sind Entwürfe umgezogen (oder es ist unklar). */
  const geaendert = (entwuerfeUmgetragen: boolean) => {
    const timer = setTimeout(() => {
      if (jetzt.current.wartet?.timer !== timer) return;
      showToast(
        'Die Plätze sind in ChurchTools gespeichert, der Plan ließ sich aber nicht neu laden. Bitte die Seite neu laden.',
      );
      setWartet(null);
    }, wartezeit);
    setWartet({
      plan: jetzt.current.plan,
      daten: entwuerfeUmgetragen ? jetzt.current.daten : undefined,
      timer,
    });
    planNeu();
    if (entwuerfeUmgetragen) entwuerfeNeu();
  };

  return { laedt, geaendert };
}
