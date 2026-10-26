/**
 * **Was darf ich im eigenen Modul?** – aus `/permissions/global` → `<kürzel>` (IDs der Kategorien je Recht). Bis
 * 24.10.2026 im Dienstplaner (`shared/dienstplan/entwuerfe.ts`, E4-3); seit S4-1 nutzen die Protokolle dieselbe
 * Regel, um zu wissen, ob jemand ein Protokoll schreiben darf.
 */
export interface ModulRechte {
  anlegen: boolean;
  sehen: number[];
  aendern: number[];
}

const ids = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((v): v is number => typeof v === 'number') : [];

/** Aus dem Rohwert von ChurchTools; fehlt er, darf man nichts. */
export function modulRechteAus(roh: unknown): ModulRechte {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const schreiben = ['create custom data', 'edit custom data', 'delete custom data'].map((k) =>
    ids(r[k]),
  );
  return {
    anlegen: r['create custom category'] === true,
    sehen: ids(r['view custom data']),
    // Ändern heißt hier: anlegen, ändern UND löschen – ein Entwurf (Dienstplaner) und ein Protokoll (Teile neu
    // anlegen, alte löschen) brauchen alle drei.
    aendern: schreiben[0].filter((id) => schreiben[1].includes(id) && schreiben[2].includes(id)),
  };
}
