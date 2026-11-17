import { useMemo } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AlsVorlageZugriff, VorlagenZugriff } from '@ui/ablauf/vorlagenZugriff';
import * as api from '../services/churchtoolsApi';
import { schluessel } from './abfrageSchluessel';

/** Den Vorlagen-Zwischenspeicher von „Ablauf anlegen“ / „Neu aufsetzen“ verwerfen – **eine** Stelle für alle Schreiber. */
function vorlagenVerwerfen(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: schluessel.ablaufVorlagen() });
}

/**
 * **Der Zugriff der Musik-App auf die Seite „Ablaufvorlagen“** (E10-V3b) – für `VorlagenBereich` aus `ui/ablauf`. Jede
 * Funktion geht durch die Weiche in `churchtoolsApi.ts` (ChurchTools-Erweiterung: direkt aus dem Browser, Server-Betrieb:
 * über `/api/ablauf-vorlagen/…`); die Regeln stehen in beiden Fällen im Kern, nicht hier. Gelesen wird frisch, ohne
 * Zwischenspeicher: Nach dem Schreiben wird nachgesehen, was geschrieben wurde.
 *
 * Eine Sache gehört der Musik-App allein: Das Fenster „Ablauf anlegen“ merkt sich die Vorlagenliste fünf Minuten
 * (`useAblaufVorlagen`). Wer hier eine Vorlage anlegt, umbenennt, löscht oder ihre Punkte ändert, soll sie dort sofort
 * so sehen – darum wird dieser Zwischenspeicher nach jedem gelungenen Schreiben verworfen.
 *
 * Die Aktionen für die Punkte: `geschrieben()` nach jedem gelungenen Schreiben, **nicht abgewartet** – scheitert nur das
 * Neu-Lesen, war das Schreiben trotzdem gelungen und darf nicht als Fehler zurückgerollt werden.
 */
export function vorlagenZugriffAus(qc: QueryClient): VorlagenZugriff {
  const verwerfen = () => vorlagenVerwerfen(qc);
  async function danach<T>(schreiben: Promise<T>): Promise<T> {
    const ergebnis = await schreiben;
    verwerfen();
    return ergebnis;
  }
  return {
    liste: () => api.getVorlagenStand(),
    vorlage: (id) => api.getVorlage(id),
    aktionen: (vorlageId, geschrieben) => {
      const ziel = { vorlageId };
      async function punkt<T>(schreiben: Promise<T>): Promise<T> {
        const ergebnis = await danach(schreiben);
        geschrieben();
        return ergebnis;
      }
      return {
        reorder: async (order, gesehen) => {
          await punkt(api.reorderAgenda(ziel, order, gesehen));
        },
        remove: async (itemId) =>
          (await punkt(api.deleteAgendaItem(ziel, itemId))).wiederherstellen ?? null,
        restore: async (zettel) => {
          await punkt(api.restoreAgendaItem(ziel, zettel));
        },
        update: async (itemId, fields, gesehen) => {
          await punkt(api.updateAgendaItem(ziel, itemId, fields, gesehen));
        },
        setVorBeginn: async (itemId, vorBeginn) => {
          await punkt(api.setAgendaItemVorBeginn(ziel, itemId, vorBeginn));
        },
        add: async (daten) => {
          await punkt(api.createAgendaItem(ziel, daten));
        },
      };
    },
    anlegen: (daten) => danach(api.vorlageAnlegen(daten)),
    umbenennen: (id, name) => danach(api.vorlageUmbenennen(id, name)),
    loeschen: (id) => danach(api.vorlageLoeschen(id)),
  };
}

/** Der Zugriff, einmal je Lebensdauer der Seite – `VorlagenBereich` lädt neu, sobald sich seine Identität ändert. */
export function useVorlagenZugriff(): VorlagenZugriff {
  const qc = useQueryClient();
  return useMemo(() => vorlagenZugriffAus(qc), [qc]);
}

/**
 * **„Als Vorlage …“ im Ablauf eines Termins** (E10-V5) – dieselbe Weiche (`churchtoolsApi`: Erweiterung direkt, Server über
 * `/api/…/als-vorlage` und `/aus-termin/`). Der Zwischenspeicher der Vorlagenliste wird nach **jedem Versuch** verworfen,
 * auch einem gescheiterten: Ein „nicht vollständig ersetzt“ (502) hat die Vorlage trotzdem verändert, und „Ablauf anlegen“
 * soll nie eine veraltete Liste zeigen.
 */
export function alsVorlageZugriffAus(qc: QueryClient, eventId: number): AlsVorlageZugriff {
  return {
    stand: () => api.getVorlagenStand(),
    speichern: async (daten) => {
      try {
        return await api.vorlageAusTermin(eventId, daten);
      } finally {
        vorlagenVerwerfen(qc);
      }
    },
    ersetzen: async (vorlageId, gesehen) => {
      try {
        await api.vorlageMitTerminErsetzen(vorlageId, eventId, gesehen);
      } finally {
        vorlagenVerwerfen(qc);
      }
    },
  };
}

/** Der Zugriff für einen Termin, einmal je Termin – das Fenster lädt neu, sobald sich seine Identität ändert. */
export function useAlsVorlageZugriff(eventId: number): AlsVorlageZugriff {
  const qc = useQueryClient();
  return useMemo(() => alsVorlageZugriffAus(qc, eventId), [qc, eventId]);
}
