import type { PlanGruppe, Ref, Schritt } from '@shared/organigramm/plan';

/**
 * **Was ein Umbau-Schritt sagt** (O7-3, Entwurf `o7-plan-v1`): Titel, darunter wo bzw. worauf er wartet. Namen von
 * heute für das, was ChurchTools jetzt zeigt; Namen aus dem Plan für Ziele (die es vielleicht erst als neue Gruppe gibt).
 */
export function schrittText(
  s: Schritt,
  plan: readonly PlanGruppe[],
  typName: (id: number) => string,
  /** Namen der in ChurchTools archivierten Gruppen – die stehen nicht mehr im Plan. */
  archiviert: ReadonlyMap<number, string> | null = null,
): { titel: string; wo: string } {
  const nach = new Map(plan.map((g) => [g.ref, g]));
  const name = (r: Ref) =>
    nach.get(r)?.name ?? (typeof r === 'number' ? (archiviert?.get(r) ?? '') : '');
  const heuteName = (id: number) => nach.get(id)?.heute?.name ?? name(id);
  const ort = (r: Ref | null) => (r === null ? 'eigener Bereich' : `„${name(r)}“`);
  const warten =
    s.wartetAuf !== null
      ? `wartet auf „${name(s.wartetAuf)}“ (Schritt oben)`
      : s.art === 'arch' && !s.erledigt && s.untergruppen.length > 0
        ? `wartet: erst ${s.untergruppen.map((u) => `„${heuteName(u)}“`).join(', ')} woanders einhängen`
        : null;
  if (s.erledigt) {
    // Erledigt: ChurchTools sieht schon so aus – „vorher“ ist dann nicht mehr bekannt, also in der Vergangenheit.
    switch (s.art) {
      case 'neu':
        // Gefunden, aber nicht vom Umbau vermerkt: direkt in ChurchTools angelegt, oder das Speichern nach dem Anlegen
        // ging schief → „Im Plan übernehmen“.
        return s.vermerkt
          ? {
              titel: `„${s.name}“ angelegt`,
              wo: s.eltern === null ? 'als eigener Bereich' : `unter ${ort(s.eltern)}`,
            }
          : {
              titel: `„${s.name}“ gibt es schon in ChurchTools`,
              wo: 'im Plan noch als neu vermerkt',
            };
      case 'um':
        return {
          titel: `„${heuteName(s.id)}“ umgehängt`,
          wo: s.eltern === null ? 'jetzt eigener Bereich' : `jetzt unter ${ort(s.eltern)}`,
        };
      case 'name':
        return { titel: `umbenannt in „${s.name}“`, wo: '' };
      case 'arch':
        return {
          titel: `„${heuteName(s.id)}“ archiviert`,
          wo: 'Status „archiviert“ – Mitglieder und Historie bleiben',
        };
    }
  }
  switch (s.art) {
    case 'neu':
      return {
        titel: `„${s.name}“ anlegen`,
        wo:
          warten ??
          `${typName(s.typId)} · ${s.eltern === null ? 'als eigener Bereich' : `unter ${ort(s.eltern)}`}`,
      };
    case 'um': {
      const vorher = nach.get(s.id)?.heute?.eltern ?? null;
      return {
        titel: `„${heuteName(s.id)}“ umhängen`,
        wo:
          warten ??
          `von ${vorher === null ? 'eigener Bereich' : `„${heuteName(vorher)}“`} nach ${ort(s.eltern)}`,
      };
    }
    case 'name':
      return { titel: `„${heuteName(s.id)}“ umbenennen`, wo: `in „${s.name}“` };
    case 'arch':
      return {
        titel: `„${heuteName(s.id)}“ archivieren`,
        wo: warten ?? 'Status „archiviert“ – nicht gelöscht, Mitglieder und Historie bleiben',
      };
  }
}
