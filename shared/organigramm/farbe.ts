/**
 * **Die Farbe einer Gruppe – wie ChurchTools sie zeichnet** (Bauplan Organigramm, Alwin 19.10.2026:
 * „Gruppenfarben bitte immer aus der jeweiligen Gruppe nehmen“).
 *
 * Reihenfolge: die eigene Farbe der Gruppe (`information.color`); hat sie keine – oder soll sie erst
 * angelegt werden –, die Farbe ihres Gruppentyps (`/group/grouptypes[].color`); sonst Schiefergrau.
 * ChurchTools nennt Tailwind-Namen; gezeichnet wird mit Stufe 500 (in der Weboberfläche gemessen: Kachel
 * „Technik“ = lime-500). EINE Stelle für Organigramm, Gruppenfenster und Präsentation.
 */
export const TAILWIND_500: Readonly<Record<string, string>> = {
  slate: '#62748e',
  gray: '#6a7282',
  zinc: '#71717b',
  neutral: '#737373',
  stone: '#79716b',
  red: '#fb2c36',
  orange: '#ff6900',
  amber: '#fe9a00',
  yellow: '#f0b100',
  lime: '#7ccf00',
  green: '#00c950',
  emerald: '#00bc7d',
  teal: '#00bba7',
  cyan: '#00b8db',
  sky: '#00a6f4',
  blue: '#2b7fff',
  indigo: '#615fff',
  violet: '#8e51ff',
  purple: '#ad46ff',
  fuchsia: '#e12afb',
  pink: '#f6339a',
  rose: '#ff2056',
};

const RUECKFALL = TAILWIND_500.slate;

/** Ein ChurchTools-Farbname als Farbwert – oder `null`, wenn der Name unbekannt ist. */
export function farbWert(name: string | null | undefined): string | null {
  return name ? (TAILWIND_500[name] ?? null) : null;
}

/** Die Farbe einer Gruppe: eigene Farbe, sonst Typ, sonst Schiefergrau. */
export function gruppenFarbe(
  gruppe: { farbe: string | null; typId: number | null },
  typFarben: ReadonlyMap<number, string | null>,
): string {
  return (
    farbWert(gruppe.farbe) ??
    farbWert(gruppe.typId === null ? null : typFarben.get(gruppe.typId)) ??
    RUECKFALL
  );
}

/** Typfarben aus `GET /group/grouptypes` (`{ id, color }`). */
export function typFarbenAus(
  rows: readonly { id?: unknown; color?: unknown }[] | null | undefined,
): Map<number, string | null> {
  const m = new Map<number, string | null>();
  for (const r of rows ?? []) {
    if (typeof r.id === 'number' && Number.isInteger(r.id)) {
      m.set(r.id, typeof r.color === 'string' && r.color !== '' ? r.color : null);
    }
  }
  return m;
}
