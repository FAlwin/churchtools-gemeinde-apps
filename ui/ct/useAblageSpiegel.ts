/**
 * **Einstellungen je Person auf allen Geräten – der eine Baustein dahinter** (herausgezogen aus
 * `protokolle/src/useToDoEinstellungen.ts`, als „Meine Anzeige“ des Dienstplaners (L4-5) dasselbe brauchte; die
 * Mechanik soll nicht zum zweiten Mal handgeschrieben dastehen).
 *
 * - **Im Gerät** liegt ein Spiegel im Format der Personen-Datei (je Feld Wert + Zeitpunkt) – die Seite startet damit
 *   sofort, auch ohne Netz. Er enthält **nur, was die Person selbst gewählt hat**; Standardwerte stehen nie darin.
 * - **In ChurchTools** liegt dieselbe Datei am eigenen Konto (`@shared/ct/personenAblage`, Ersetzen als Doppelschritt).
 *   Beim Öffnen, kurz nach jeder Änderung, beim Weglegen der Seite und wenn das Netz zurückkommt, wird **Feld für Feld
 *   zusammengeführt** – die jüngere Änderung gewinnt (`mische`).
 * - **Vorübergehend ist nicht ungültig:** Scheitert der Abgleich (Netz, 5xx, Zeitgrenze, fehlendes Recht), bleibt alles im
 *   Gerät und wird beim nächsten Anlass nachgeholt (`abgleichFehler` sagt es der Anzeige). **Die Datei wird nie mit
 *   Standardwerten überschrieben:** Hochgeladen wird nur, was die Person gewählt hat und dort fehlt oder älter ist
 *   (`mischeEin`); ein Lesefehler wirft und lädt nichts hoch.
 * - **Je Person:** Der Spiegel trägt die Person im Namen (geteiltes iPad).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { leseImGeraet, merkeImGeraet } from '../bedienung/geraet';
import { mische, type DatenDatei } from '@shared/ct/personenAblage';

/** Wie lange nach der letzten Änderung gewartet wird, bevor sie nach ChurchTools geht (Ziehen/Klicken erzeugt viele). */
export const ABGLEICH_NACH_MS = 1500;

/** Der Weg nach ChurchTools – austauschbar für Tests. */
export type Abgleich = (lokal: DatenDatei) => Promise<DatenDatei>;

/** Der Spiegel aus dem Gerät – `null`, wenn dort nichts (Brauchbares) steht. */
export function spiegelImGeraet(schluessel: string): DatenDatei | null {
  return leseImGeraet<DatenDatei | null>(schluessel, null, (x) => {
    const o = x as Partial<DatenDatei> | null;
    return o?.v === 1 && o.felder && typeof o.felder === 'object' ? (o as DatenDatei) : null;
  });
}

const gleich = (a: DatenDatei, b: DatenDatei) => JSON.stringify(a) === JSON.stringify(b);

export interface AblageSpiegelOptionen {
  person: number;
  /** Der Schlüssel des Spiegels im Gerät – je Person. */
  merkSchluessel: (person: number) => string;
  abgleich: Abgleich;
  /** Wo der Spiegel beginnt, wenn man ihn öffnet (Übernahme von Altem). Ohne: was im Gerät steht, sonst leer. */
  anfang?: (person: number) => DatenDatei;
  jetzt?: () => number;
  /** Was ins Log kommt, wenn der Abgleich scheitert (keine personenbezogenen Daten). */
  warnung: string;
}

export function useAblageSpiegel(o: AblageSpiegelOptionen) {
  const { person, merkSchluessel, abgleich, warnung } = o;
  const jetzt = o.jetzt ?? Date.now;
  const [spiegel, setSpiegel] = useState<DatenDatei>(() =>
    o.anfang ? o.anfang(person) : (spiegelImGeraet(merkSchluessel(person)) ?? { v: 1, felder: {} }),
  );
  const [abgleichFehler, setAbgleichFehler] = useState(false);
  const aktuell = useRef(spiegel);
  const laeuft = useRef(false);
  const nochmal = useRef(false);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uebernehmen = useCallback(
    (neu: DatenDatei) => {
      aktuell.current = neu;
      merkeImGeraet(merkSchluessel(person), neu);
      setSpiegel(neu);
    },
    [person, merkSchluessel],
  );

  /** Einen Abgleich anstoßen – läuft schon einer, danach noch einmal (was inzwischen geändert wurde, fehlt ihm). */
  const abgleichen = useCallback(() => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    if (laeuft.current) {
      nochmal.current = true;
      return;
    }
    laeuft.current = true;
    const gesendet = aktuell.current;
    abgleich(gesendet)
      .then(
        (dort) => {
          setAbgleichFehler(false);
          // Was während des Abgleichs im Gerät geändert wurde, ist jünger – es bleibt und geht beim nächsten Mal mit.
          const neu = mische(dort, aktuell.current);
          if (!gleich(aktuell.current, gesendet)) nochmal.current = true;
          if (!gleich(neu, aktuell.current)) uebernehmen(neu);
        },
        (e: unknown) => {
          setAbgleichFehler(true);
          console.warn(warnung, e);
        },
      )
      .finally(() => {
        laeuft.current = false;
        if (nochmal.current) {
          nochmal.current = false;
          abgleichen();
        }
      });
  }, [abgleich, uebernehmen, warnung]);

  // Beim Öffnen holen; beim Weglegen der Seite und wenn das Netz zurückkommt, sofort abgleichen.
  useEffect(() => {
    abgleichen();
    const weg = () => {
      if (document.visibilityState === 'hidden' && uhr.current) abgleichen();
    };
    document.addEventListener('visibilitychange', weg);
    window.addEventListener('online', abgleichen);
    return () => {
      document.removeEventListener('visibilitychange', weg);
      window.removeEventListener('online', abgleichen);
      if (uhr.current) clearTimeout(uhr.current);
    };
  }, [abgleichen]);

  /** Felder setzen (Wert + jetzt) – sofort im Gerät, nach ChurchTools nach der Pause. */
  const setzen = useCallback(
    (teil: Record<string, unknown>) => {
      const t = jetzt();
      const felder = { ...aktuell.current.felder };
      for (const [k, w] of Object.entries(teil)) felder[k] = { w, t };
      uebernehmen({ v: 1, felder });
      if (uhr.current) clearTimeout(uhr.current);
      uhr.current = setTimeout(abgleichen, ABGLEICH_NACH_MS);
    },
    [jetzt, uebernehmen, abgleichen],
  );

  return { spiegel, setzen, abgleichFehler, nochmalVersuchen: abgleichen };
}
