/**
 * **„Wer hört zu?“** (Bauplan Gebetsabend G4, Entwurf v2/v3) – aus den Meldungen des Sender-iframes, ohne Oberfläche.
 *
 * Gemessen (G0-3, 05.11.2026; Form im VDO.Ninja-Quelltext `pokeIframeAPI`: `{action, value, UUID}`):
 *  - Zuhörer kommt: `push-connection: true` (dazu das ältere `new-push-connection: true`), danach
 *    `push-connection-info` mit `value.label` = der `&label` des Zuhörers (bei uns Vor- und Nachname aus ChurchTools).
 *  - Zuhörer geht: `push-connection: false` (dazu `new-push-connection: false`) – sofort beim Schließen des Players.
 *  - **Jede Verbindung hat eine eigene UUID**; ein Zuhörer kann sich still neu verbinden (iPhone: getrennt und eine
 *    Sekunde später mit neuer UUID wieder da). Deshalb zählt die Liste Verbindungen und zeigt **Personen**.
 *
 * Nur auf dem Gerät, das sendet, und nur, solange der Sender dort läuft – gespeichert wird nichts. Den Namen setzt der
 * Zuhörer selbst: Wer mit einem weitergegebenen Link zuhört, kommt ohne oder mit selbst gewähltem Namen an. Die Liste
 * ist ein Hinweis, kein Schutz.
 */
import type { Meldung } from './zustand';

export interface Verbindung {
  /** `null`, solange (noch) kein Name gemeldet ist. */
  name: string | null;
  /** Seit wann (ISO) diese Verbindung besteht. */
  seit: string;
}

/** Die offenen Verbindungen je UUID. */
export type Verbindungen = Readonly<Record<string, Verbindung>>;

export const KEINE_VERBINDUNGEN: Verbindungen = {};

function nameAus(value: unknown): string | null {
  const label = (value as { label?: unknown } | null)?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

/** Die Verbindungen nach einer Meldung des Senders. Fremde Meldungen und solche ohne UUID ändern nichts. */
export function verbindungenNach(v: Verbindungen, m: Meldung, jetzt: string): Verbindungen {
  const uuid = m.uuid;
  if (!uuid) return v;
  switch (m.action) {
    case 'push-connection':
    case 'new-push-connection': {
      if (m.value === false) {
        if (!(uuid in v)) return v;
        const rest = { ...v };
        delete rest[uuid];
        return rest;
      }
      return uuid in v ? v : { ...v, [uuid]: { name: null, seit: jetzt } };
    }
    case 'push-connection-info': {
      const name = nameAus(m.value);
      const da = v[uuid];
      return { ...v, [uuid]: { name: name ?? da?.name ?? null, seit: da?.seit ?? jetzt } };
    }
    default:
      return v;
  }
}

export interface Zuhoerer {
  /** `null` = ohne Namen (weitergegebener Link oder noch nicht gemeldet). */
  name: string | null;
  /** Die früheste offene Verbindung dieser Person. */
  seit: string;
  /** Wie viele Verbindungen (Geräte) – zwei gleiche Namen oder Handy und Tablet. */
  geraete: number;
}

/**
 * Die Liste für die Technik: je Name eine Zeile (A–Z), Verbindungen ohne Namen zusammen in einer Zeile am Ende.
 * `zahl` sind die Personen mit Namen plus die Verbindungen ohne – jede davon kann ein anderer Mensch sein.
 */
export function zuhoererListe(v: Verbindungen): { liste: Zuhoerer[]; zahl: number } {
  const je = new Map<string | null, Zuhoerer>();
  for (const { name, seit } of Object.values(v)) {
    const da = je.get(name);
    je.set(
      name,
      da
        ? { name, seit: da.seit < seit ? da.seit : seit, geraete: da.geraete + 1 }
        : { name, seit, geraete: 1 },
    );
  }
  const mit = [...je.values()]
    .filter((z) => z.name !== null)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'));
  const ohne = je.get(null);
  return {
    liste: ohne ? [...mit, ohne] : mit,
    zahl: mit.length + (ohne?.geraete ?? 0),
  };
}

export const WER_HOERT_TEXT = {
  niemand: 'Noch hört niemand zu.',
  ohneName: 'Ohne Namen',
  hinweis:
    'Nur auf diesem Gerät und solange der Sender hier läuft. „Ohne Namen“ heißt meist: jemand hört mit einem weitergegebenen Link zu.',
} as const;
