/**
 * **Der Reiter „Ressourcen“ des Fensters „In Kalender eintragen“** (W15-2) – die Regeln ohne ChurchTools, wie im Dialog
 * „Termin erstellen“: Vorlauf und Nachlauf als Vorgabe, je Ressource eine Buchung mit eigenem Vorlauf, Nachlauf und Status.
 * Den Rumpf für `POST /calendars/{id}/appointments` baut `protokolle/src/terminAnlegen.ts`, das Nachlesen steht in
 * `protokolle/src/buchungenLesen.ts`, die Rechte in `shared/ct/ressourcenRechte.ts`.
 *
 * - **Vorlauf/Nachlauf** in Minuten; ChurchTools nimmt 0–20160 (Vorlauf) und 0–1440 (Nachlauf) an. Vorgabe wie in
 *   ChurchTools 15/15.
 * - **Status** 1 = „Wartet auf Bestätigung“, 2 = „Bestätigt“, 3 = „Abgelehnt“. Setzen darf ihn nur, wer die Ressource
 *   verwalten darf – sonst gilt immer 1 (`statusFuer`).
 * - **Menge** gibt es nur bei Ressourcen mit `quantity > 1` (Stühle); sonst bleibt sie 1 und geht nicht mit.
 */
export const STATUS = { wartet: 1, bestaetigt: 2, abgelehnt: 3 } as const;
export type BuchungsStatus = 1 | 2 | 3;

export const STATUS_AUSWAHL: readonly { id: BuchungsStatus; label: string }[] = [
  { id: 1, label: 'Wartet auf Bestätigung' },
  { id: 2, label: 'Bestätigt' },
  { id: 3, label: 'Abgelehnt' },
];

/** Grenzen der Schnittstelle (Minuten). */
export const VORLAUF_MAX = 20_160;
export const NACHLAUF_MAX = 1_440;
export const LAUF_VORGABE = 15;
/**
 * **Die Vorgabe für Vorlauf/Nachlauf wie in ChurchTools** (gemessen 23.11.2026 im Dialog „Termin erstellen“): mit Uhrzeit
 * 15/15 min, ganztägig 0/0.
 */
export const laufVorgabe = (ganztaegig: boolean): number => (ganztaegig ? 0 : LAUF_VORGABE);
/** Die Vorschläge im Auswahlpfeil neben Vorlauf/Nachlauf. */
export const LAUF_VORSCHLAEGE: readonly number[] = [0, 15, 30, 45, 60, 90, 120, 180, 240];

/** Eine ganze Zahl von 0 bis `max` – alles andere (leer, Text, negativ) wird 0, zu groß wird `max`. */
export function begrenzeLauf(n: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
}

/** Eine Ressource aus ChurchTools (`GET /resources`), soweit sie hier gebraucht wird. */
export interface Ressource {
  id: number;
  name: string;
  typId: number | null;
  /** Name des Ressourcentyps („Raum“) – leer, wenn unbekannt. */
  typ: string;
  /** Wie viele es davon gibt (Stühle: 80); 1 = einzeln. */
  anzahl: number;
}

/** Eine Buchung im Fenster. */
export interface Buchung {
  ressource: number;
  vorlauf: number;
  nachlauf: number;
  status: BuchungsStatus;
  /** Nur bei `Ressource.anzahl > 1` von Bedeutung. */
  menge: number;
}

const zahl = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * **Die buchbaren Ressourcen** aus `GET /resources` und `GET /resourcetypes` – nur die mit Nummer und Namen, nur die, die
 * `buchbar` nennt, nach Typ und dann nach Namen sortiert (die Typen stehen in der Reihenfolge ihrer Namen).
 */
export function ressourcenAus(
  ressourcenRoh: unknown,
  typenRoh: unknown,
  buchbar: ReadonlySet<number>,
): Ressource[] {
  const typen = new Map<number, string>();
  for (const t of Array.isArray(typenRoh) ? typenRoh : []) {
    const o = t as { id?: unknown; nameTranslated?: unknown; name?: unknown } | null;
    const id = zahl(o?.id);
    const name =
      typeof o?.nameTranslated === 'string' && o.nameTranslated.trim()
        ? o.nameTranslated
        : typeof o?.name === 'string'
          ? o.name
          : '';
    if (id !== null) typen.set(id, name.trim());
  }
  return (Array.isArray(ressourcenRoh) ? ressourcenRoh : [])
    .flatMap((r: Record<string, unknown> | null): Ressource[] => {
      const id = zahl(r?.id);
      const name = typeof r?.name === 'string' ? r.name.trim() : '';
      if (id === null || !name || !buchbar.has(id)) return [];
      const typId = zahl(r?.resourceTypeId);
      const menge = zahl(r?.quantity);
      return [
        {
          id,
          name,
          typId,
          typ: typId === null ? '' : (typen.get(typId) ?? ''),
          anzahl: menge !== null && menge > 1 ? Math.floor(menge) : 1,
        },
      ];
    })
    .sort((a, b) => a.typ.localeCompare(b.typ, 'de') || a.name.localeCompare(b.name, 'de'));
}

/** „Saal · Raum“ – Name und Typ, wie ChurchTools es in der Auswahl zeigt. */
export const ressourceText = (r: Pick<Ressource, 'name' | 'typ'>): string =>
  r.typ ? `${r.name} · ${r.typ}` : r.name;

/** Der Status, der wirklich gilt: ohne Recht an dieser Ressource immer „Wartet auf Bestätigung“. */
export const statusFuer = (wunsch: number, darfStatus: boolean): BuchungsStatus =>
  darfStatus && (wunsch === 2 || wunsch === 3) ? wunsch : STATUS.wartet;

/** Eine Buchung mit den Vorgaben oben – jede Ressource nur einmal. */
export function buchungHinzu(
  buchungen: readonly Buchung[],
  ressource: Ressource,
  vorgabe: { vorlauf: number; nachlauf: number },
): Buchung[] {
  if (buchungen.some((b) => b.ressource === ressource.id)) return [...buchungen];
  return [
    ...buchungen,
    {
      ressource: ressource.id,
      vorlauf: begrenzeLauf(vorgabe.vorlauf, VORLAUF_MAX),
      nachlauf: begrenzeLauf(vorgabe.nachlauf, NACHLAUF_MAX),
      status: STATUS.wartet,
      menge: 1,
    },
  ];
}

/**
 * **Ein Häkchen in der Liste „Ressourcen wählen“** (Alwin, 27.11.2026: mehrere auf einmal statt jede einzeln): gebucht →
 * die Buchung fällt weg, sonst kommt sie mit den Vorgaben oben dazu (`buchungHinzu`).
 */
export function buchungUmschalten(
  buchungen: readonly Buchung[],
  ressource: Ressource,
  vorgabe: { vorlauf: number; nachlauf: number },
): Buchung[] {
  return buchungen.some((b) => b.ressource === ressource.id)
    ? buchungen.filter((b) => b.ressource !== ressource.id)
    : buchungHinzu(buchungen, ressource, vorgabe);
}

/**
 * **„Status für alle“** (Alwin, 27.11.2026): setzt den Status jeder Buchung, deren Ressource die Person verwalten darf. Die
 * anderen bleiben, wie `statusFuer` es sagt – ohne Recht immer „Wartet auf Bestätigung“.
 */
export function statusFuerAlle(
  buchungen: readonly Buchung[],
  status: BuchungsStatus,
  verwaltbar: ReadonlySet<number>,
): Buchung[] {
  return buchungen.map((b) =>
    verwaltbar.has(b.ressource) ? { ...b, status: statusFuer(status, true) } : b,
  );
}

/**
 * Der Status, den **alle verwaltbaren** Buchungen gemeinsam haben – `null`, wenn sie verschieden sind oder keine dabei ist.
 * Daran zeigt die Auswahl „Status für alle“, was gerade gilt.
 */
export function gemeinsamerStatus(
  buchungen: readonly Buchung[],
  verwaltbar: ReadonlySet<number>,
): BuchungsStatus | null {
  const stati = new Set(buchungen.filter((b) => verwaltbar.has(b.ressource)).map((b) => b.status));
  return stati.size === 1 ? [...stati][0] : null;
}

/**
 * **Buchungen auf das beschränken, was die Person darf**: nur buchbare Ressourcen (jede einmal), Status ohne Verwalten-Recht
 * auf 1, Zeiten in den Grenzen der Schnittstelle. Die eine Stelle dafür – beim Anwenden einer Termin-Vorlage.
 */
export function buchungenAufRechte(
  buchungen: readonly Buchung[],
  buchbar: ReadonlySet<number>,
  verwaltbar: ReadonlySet<number>,
): Buchung[] {
  const gesehen = new Set<number>();
  return buchungen.flatMap((b) => {
    if (!buchbar.has(b.ressource) || gesehen.has(b.ressource)) return [];
    gesehen.add(b.ressource);
    return [
      {
        ...b,
        vorlauf: begrenzeLauf(b.vorlauf, VORLAUF_MAX),
        nachlauf: begrenzeLauf(b.nachlauf, NACHLAUF_MAX),
        status: statusFuer(b.status, verwaltbar.has(b.ressource)),
        menge: Math.max(1, Math.floor(b.menge) || 1),
      },
    ];
  });
}

/** Die Buchung, wie `POST /calendars/{id}/appointments` sie annimmt (`bookings`). `quantity` nur bei mehr als einer. */
export function buchungRumpf(b: Buchung): Record<string, unknown> {
  return {
    resourceId: b.ressource,
    leadTimeMinutes: b.vorlauf,
    afterwardMinutes: b.nachlauf,
    statusId: b.status,
    ...(b.menge > 1 ? { quantity: b.menge } : {}),
  };
}

/**
 * **Was nach dem Anlegen zu den Buchungen zu sagen ist** – `null`, wenn alles gebucht ist. `fehlend` sind die Ressourcen,
 * für die ChurchTools nach dem Anlegen keine Buchung zeigt; `unklar` heißt: das Nachlesen selbst ist gescheitert (dann
 * wissen wir es nicht – nicht „fehlt“, vorübergehend ist nicht ungültig).
 */
export function buchungsHinweis(
  ergebnis: { fehlend: readonly number[]; unklar: boolean },
  namen: (ressource: number) => string,
): string | null {
  if (ergebnis.unklar)
    return 'Ob die Ressourcen gebucht wurden, ließ sich nicht nachlesen. Bitte in ChurchTools nachsehen und bei Bedarf nachbuchen – der Termin selbst steht im Kalender.';
  if (!ergebnis.fehlend.length) return null;
  const liste = ergebnis.fehlend.map(namen).join(', ');
  return ergebnis.fehlend.length === 1
    ? `Die Ressource „${liste}“ wurde nicht gebucht – bitte in ChurchTools nachbuchen. Der Termin selbst steht im Kalender.`
    : `Diese Ressourcen wurden nicht gebucht: ${liste} – bitte in ChurchTools nachbuchen. Der Termin selbst steht im Kalender.`;
}
