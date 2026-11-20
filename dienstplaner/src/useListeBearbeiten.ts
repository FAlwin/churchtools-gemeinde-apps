import { useRef, useState } from 'react';
import type { ListeInhalt, Personenliste } from '@shared/dienstplan/personenliste';
import type { PersonenlisteErgebnis } from '@shared/dienstplan/personenlisteSpeichern';
import type { EntwuerfeDaten, EntwurfAnschluss } from './ladeEntwuerfe';

/**
 * **Die Personenliste bearbeiten** (PL-2, Entwurf `personenliste.html`, Variante B): der Modus „Liste bearbeiten“ und der Weg
 * zum Speichern. Geschrieben wird in `personenlisteSpeichern` (Kern: frisch lesen, Version vergleichen, nachlesen); hier
 * steht nur, **wer ändern darf** und was nach dem Ergebnis mit den geladenen Daten geschieht.
 *
 * Ändern darf, wer die Schublade der Dienstgruppe ändern darf (`stand === 'bereit'`, dieselben Rechte wie bei den Entwürfen)
 * und deren Werte sich laden ließen. Ohne Schublade (noch nicht eingerichtet) gibt es hier nichts zu ändern.
 *
 * Übernommen wird **nur, was nachgelesen bestätigt ist**: bei `ok` die Liste, die dasteht; bei einem Konflikt der Stand des
 * anderen Planers (damit das Raster nicht länger einen alten Stand zeigt). Alles andere (vorübergehend, nicht angekommen)
 * lässt die Anzeige, wie sie ist – der Aufrufer behält die Eingabe und meldet den Grund.
 */
export function useListeBearbeiten({
  entwuerfe,
  daten,
  setzeListe,
}: {
  entwuerfe: EntwurfAnschluss | undefined;
  daten: EntwuerfeDaten | null;
  setzeListe: (gruppeId: number, liste: Personenliste | null) => void;
}) {
  const [an, setAn] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  // Ein Schreiben zurzeit: ein zweites Ziehen oder Speichern während des ersten würde mit der alten Version loslaufen und
  // sich selbst einen Konflikt machen. Der Zustand sperrt die Bedienung, die Marke schützt vor zwei Aufrufen im selben Takt.
  const besetzt = useRef(false);

  const darf = (gruppeId: number | null): boolean => {
    if (!entwuerfe || !daten || gruppeId === null) return false;
    const s = daten.schubladen.get(gruppeId);
    return !!s && s.stand === 'bereit' && s.kategorie !== null && !s.fehler;
  };

  /** Die Liste der Gruppe, wie sie jetzt geladen ist – `null` ohne. */
  const aktuell = (gruppeId: number): Personenliste | null =>
    daten?.personenlisten.get(gruppeId) ?? null;

  const aendern = async (
    gruppeId: number,
    was: (alt: Personenliste | null) => ListeInhalt,
  ): Promise<PersonenlisteErgebnis> => {
    if (!entwuerfe || !daten || !darf(gruppeId)) return { ok: false, grund: 'kein-recht' };
    if (besetzt.current) return { ok: false, grund: 'voruebergehend' };
    besetzt.current = true;
    setLaeuft(true);
    try {
      const r = await entwuerfe.personenliste(
        daten,
        gruppeId,
        was,
        aktuell(gruppeId)?.version ?? null,
      );
      if (r.ok) setzeListe(gruppeId, r.liste);
      else if (r.grund === 'konflikt') setzeListe(gruppeId, r.jetzt ?? null);
      return r;
    } finally {
      besetzt.current = false;
      setLaeuft(false);
    }
  };

  return { an, setAn, laeuft, darf, aktuell, aendern };
}

export type ListeBearbeitenZustand = ReturnType<typeof useListeBearbeiten>;
