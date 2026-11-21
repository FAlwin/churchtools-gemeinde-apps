import { useCallback, useMemo, useState } from 'react';
import { tagKurz } from '@shared/ct/datum';
import type { DienstPort } from '@shared/dienstplan/einteilen';
import type { TerminZeile } from '@shared/dienstplan/termine';
import {
  offeneVertretungen,
  uebernehmen,
  type Gesuchte,
  type UebernehmenGrund,
} from '@shared/dienstplan/vertretung';
import { useToast } from '@ui/fenster/useToast';
import { antwortFehlerText } from './antwortTexte';
import { dienstPort } from './dienstPort';
import { ladeAntworten } from './ladeAntworten';
import { vertretungAnschluss, type VertretungAnschluss } from './ladeVertretung';
import { eigeneDienste, eigeneDienstgruppen, type Start } from './start';
import { usePersonenAntworten } from './usePersonenAntworten';

/** Eine gesuchte Vertretung auf der Startseite – mit ihrem Termin. */
export type OffeneVertretung = Gesuchte & { termin: TerminZeile };

/** Der Schlüssel einer Zeile – Person, Termin, Dienst (nie die flüchtige Platz-ID). */
export const vertretungsZeilenSchluessel = (
  g: Pick<Gesuchte, 'personId' | 'terminId' | 'dienstId'>,
) => `${g.personId}|${g.terminId}|${g.dienstId}`;

/** Was Startseite, „Dienste“ und Termin-Ansicht zu „Vertretung suchen“ brauchen – aus `useVertretung`. */
export interface VertretungZugriff {
  /** Der Anschluss für das Fenster „Vertretung suchen“ (ChurchTools). */
  anschluss: VertretungAnschluss;
  ich: { id: number; name: string };
  /** Eine Suche ist durchgelaufen (abgesagt): Termine und Antworten leise neu laden. */
  geaendert: () => void;
  /** Wer in meinem Team eine Vertretung sucht und der Platz noch frei ist („Für dich offen“). */
  offen: OffeneVertretung[];
  laeuft: (schluessel: string) => boolean;
  fehler: (schluessel: string) => string | null;
  uebernehmen: (g: OffeneVertretung) => Promise<void>;
  meldung: string | null;
}

/** Was „Übernehmen“ sagt, wenn es nicht geklappt hat – die Zweige einzeln. */
export function uebernehmenText(grund: UebernehmenGrund): string {
  switch (grund) {
    case 'besetzt':
      return 'Schon übernommen – danke!';
    case 'kein-recht':
      return 'Du darfst dich hier nicht selbst eintragen – frag die Leitung.';
    case 'nicht-angekommen':
      return 'ChurchTools hat deine Zusage nicht übernommen. Bitte noch einmal versuchen.';
    default:
      return antwortFehlerText(grund);
  }
}

/**
 * **Vertretung suchen** (E5c-6) – der Zustand für Startseite, „Dienste“ und Termin-Ansicht, an einer Stelle in der App.
 * - Der Anschluss für das Fenster (`vertretungAnschluss`, je Start einmal).
 * - **„Für dich offen“:** Die Antworten der **eigenen** Dienstgruppen (mit den gesuchten Vertretungen, `ladeAntworten`) werden
 *   geladen, solange die Startseite offen ist (`aktiv`); `offeneVertretungen` rechnet daraus mit den geladenen Terminen die
 *   Zeilen (nur, solange ein Platz des Dienstes frei ist). Scheitert das Laden, fehlen die Zeilen – das ist Beiwerk, nichts
 *   wird behauptet.
 * - **Übernehmen:** `uebernehmen` (frisch lesen, schreiben, nachlesen); danach Termine und Antworten neu.
 */
export function useVertretung(o: {
  start: Start | null;
  zeilen: readonly TerminZeile[];
  heute: string;
  /** Ist die Startseite offen? Nur dann wird geladen. */
  aktiv: boolean;
  onGeaendert: () => void;
  port?: DienstPort;
}): VertretungZugriff | undefined {
  const { start, zeilen, heute, aktiv, onGeaendert } = o;
  const port = o.port ?? dienstPort;
  const [laeuftSet, setLaeuft] = useState<ReadonlySet<string>>(new Set());
  const [fehlerKarte, setFehler] = useState<ReadonlyMap<string, string>>(new Map());
  const { toast, showToast } = useToast();

  const anschluss = useMemo(() => (start ? vertretungAnschluss(start) : null), [start]);
  const eigeneGruppen = useMemo(() => (start ? eigeneDienstgruppen(start) : []), [start]);
  const eigeneIds = useMemo(
    () => new Set(start ? eigeneDienste(start).map((d) => d.id) : []),
    [start],
  );
  // Stabil, solange der Start gleich bleibt (`usePersonenAntworten` lädt neu, wenn sich der Lader ändert).
  const lader = useCallback(
    (ids: readonly number[]) => ladeAntworten(eigeneGruppen.filter((g) => ids.includes(g.id))),
    [eigeneGruppen],
  );
  const antw = usePersonenAntworten(lader, aktiv ? eigeneGruppen.map((g) => g.id) : []);
  const neuLaden = antw.neuLaden;

  const offen = useMemo(
    () =>
      start
        ? offeneVertretungen({
            vertretungen: antw.antworten.vertretungen,
            zeilen,
            eigeneDienste: eigeneIds,
            ichId: start.ichId,
            dienstName: (id) => start.dienste.get(id)?.name,
            heute,
          })
        : [],
    [start, antw.antworten, zeilen, eigeneIds, heute],
  );

  const geaendert = useCallback(() => {
    onGeaendert();
    neuLaden();
  }, [onGeaendert, neuLaden]);

  const uebernehmenZeile = useCallback(
    async (g: OffeneVertretung) => {
      if (!start) return;
      const k = vertretungsZeilenSchluessel(g);
      setLaeuft((s) => new Set(s).add(k));
      setFehler((m) => {
        const n = new Map(m);
        n.delete(k);
        return n;
      });
      const r = await uebernehmen(port, {
        eventId: g.terminId,
        serviceId: g.dienstId,
        ichId: start.ichId,
      });
      setLaeuft((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
      if (r.ok) {
        showToast(`Übernommen – du hast jetzt ${g.dienst} am ${tagKurz(g.termin.tag)}.`);
        geaendert();
      } else if (r.grund === 'besetzt') {
        // Jemand war schneller: Die Zeile verschwindet mit dem Neuladen, der Hinweis bleibt kurz stehen.
        showToast(uebernehmenText('besetzt'));
        geaendert();
      } else {
        setFehler((m) => new Map(m).set(k, uebernehmenText(r.grund)));
      }
    },
    [start, port, showToast, geaendert],
  );

  const ich = useMemo(
    () =>
      start
        ? { id: start.ichId, name: [start.vorname, start.nachname].filter(Boolean).join(' ') }
        : null,
    [start],
  );

  return useMemo(
    () =>
      anschluss && ich
        ? {
            anschluss,
            ich,
            geaendert,
            offen,
            laeuft: (k: string) => laeuftSet.has(k),
            fehler: (k: string) => fehlerKarte.get(k) ?? null,
            uebernehmen: uebernehmenZeile,
            meldung: toast,
          }
        : undefined,
    [anschluss, ich, geaendert, offen, laeuftSet, fehlerKarte, uebernehmenZeile, toast],
  );
}
