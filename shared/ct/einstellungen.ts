/**
 * Die Gemeinde-Einstellungen (Name, Links, Standard-Ansicht, Gruppen, Termin-Arten) – **Prüfen und
 * Zusammensetzen für beide Auslieferungen** (#335, Phase 3b-4).
 *
 * Lag bis dahin in `server/src/services/siteConfig.ts`. Gespeichert wird je Auslieferung anders – der
 * Server in einer `site.json`, die Erweiterung im Datenbereich ihres ChurchTools-Moduls –, aber was
 * gültig ist und wie aus Rohdaten eine `SiteConfig` wird, steht hier, einmal. Eine zweite Fassung im
 * Browser hätte genau die Lücke, die das Schema schließt: `javascript:`-Links aus einem Wert, den
 * jeder mit Schreibrecht an der Kategorie ändern kann.
 */
import { z } from 'zod';
import { DEFAULT_SITE_CONFIG, SITE_CONFIG_GRENZEN, type SiteConfig } from '../types/index';

/** Nur echte Web-Links zulassen – verhindert `javascript:`/`data:`-XSS in gerenderten Links. */
const linkSchema = z.object({
  id: z.string().trim().min(1).max(SITE_CONFIG_GRENZEN.id),
  label: z.string().trim().min(1).max(SITE_CONFIG_GRENZEN.linkLabel),
  url: z
    .string()
    .trim()
    .max(SITE_CONFIG_GRENZEN.linkUrl)
    .refine((u) => /^https?:\/\//i.test(u), 'Nur http(s)-Adressen sind erlaubt.'),
  showOnLogin: z.boolean(),
});

// Rollen-Freigabe je Gruppe für Team-Notizen. Leere Liste = niemand (kein „alle").
// `view`/`manage` = kurzlebiges Zwischenformat aus der Entwicklung – wird beim Einlesen in
// `roles` überführt (Vereinigung), damit eine Staging-Konfiguration nicht verloren geht.
const noteRoleSchema = z
  .object({
    groupId: z.number().int().positive(),
    roles: z.array(z.number().int().positive()).max(50).optional().default([]),
    view: z.array(z.number().int().positive()).max(50).optional().default([]),
    manage: z.array(z.number().int().positive()).max(50).optional().default([]),
  })
  .transform((r) => ({
    groupId: r.groupId,
    roles: r.roles.length > 0 ? r.roles : [...new Set([...r.view, ...r.manage])],
  }));

/**
 * Termin-Arten für den Filter im Tab „Abwesenheiten" (#400). Die Grenzen sind Missbrauchs-Bremsen,
 * keine Fachregeln – und sie kommen aus `SITE_CONFIG_GRENZEN`, damit das Formular dieselben kennt.
 */
const terminArtSchema = z.object({
  id: z.string().trim().min(1).max(SITE_CONFIG_GRENZEN.id),
  name: z
    .string()
    .trim()
    .min(1, 'Jede Termin-Art braucht einen Namen.')
    .max(SITE_CONFIG_GRENZEN.terminArtName),
  suchwort: z
    .string()
    .trim()
    .min(1, 'Jede Termin-Art braucht ein Suchwort.')
    .max(SITE_CONFIG_GRENZEN.terminArtSuchwort),
});

// Tolerant gegenüber Altfeldern (bestehende site.json aus der White-Label-Phase),
// die nur ignoriert werden. Anpassbar: orgName + links + Anmerkungs-Gruppen/-Rollen.
export const siteConfigSchema = z
  .object({
    orgName: z.string().trim().min(1).max(80),
    // Obergrenze als reine Missbrauchs-Bremse, weit über realer Nutzung.
    links: z.array(linkSchema).max(SITE_CONFIG_GRENZEN.maxEintraege).optional().default([]),
    // ChurchTools-Gruppen-IDs für „globale" Anmerkungen; leer = Funktion aus.
    musicianGroupIds: z.array(z.number().int().positive()).max(50).optional().default([]),
    // Abwärtskompatibel: frühere Einzel-ID (wird beim Einlesen in das Array überführt).
    musicianGroupId: z.number().int().positive().nullable().optional(),
    // Rollen-Freigabe je Gruppe (Sehen/Verwalten).
    noteRoles: z.array(noteRoleSchema).max(50).optional().default([]),
    // Termin-Arten für den Abwesenheiten-Filter (#400); leer = kein Filter.
    terminArten: z
      .array(terminArtSchema)
      .max(SITE_CONFIG_GRENZEN.maxEintraege)
      .optional()
      .default([]),
    // Liedblatt: Standard-Ansicht (07.10.2026); fehlt sie (Bestand), gilt „Akkorde".
    standardAnsicht: z.enum(['akkorde', 'dokument']).optional().default('akkorde'),
  })
  .passthrough();

/** Was ein Admin einstellen kann – alles andere an `SiteConfig` ist fest. */
export type EinstellbareWerte = Pick<
  SiteConfig,
  'orgName' | 'links' | 'musicianGroupIds' | 'noteRoles' | 'terminArten' | 'standardAnsicht'
>;

/** Setzt eine eingelesene/eingehende Konfiguration auf die festen Felder + anpassbare Werte zusammen. */
export function einstellungenZusammensetzen({
  orgName,
  links = [],
  musicianGroupIds = [],
  noteRoles = [],
  terminArten = [],
  standardAnsicht = 'akkorde',
}: Partial<EinstellbareWerte> & { orgName: string }): SiteConfig {
  // Duplikate entfernen (falls mehrfach übergeben).
  const groupIds = [...new Set(musicianGroupIds)];
  const groupSet = new Set(groupIds);
  // Nur Rollen-Freigaben für tatsächlich gewählte Gruppen behalten; Rollen-IDs deduplizieren.
  const roles = noteRoles
    .filter((r) => groupSet.has(r.groupId))
    .map((r) => ({ groupId: r.groupId, roles: [...new Set(r.roles)] }));
  return {
    appName: DEFAULT_SITE_CONFIG.appName,
    description: DEFAULT_SITE_CONFIG.description,
    orgName,
    links,
    musicianGroupIds: groupIds,
    noteRoles: roles,
    // Eine ID nur einmal – die gemerkte Auswahl auf dem Gerät hängt daran (#400).
    terminArten: terminArten.filter((t, i, alle) => alle.findIndex((x) => x.id === t.id) === i),
    standardAnsicht,
  };
}

/**
 * Eine Eingabe prüfen und zusammensetzen – beim Speichern. Wirft `fehler(400, …)` mit der ersten
 * Meldung des Schemas, damit beide Auslieferungen dasselbe sagen.
 */
export function einstellungenPruefen(
  eingabe: unknown,
  fehler: (status: number, meldung: string) => Error,
): SiteConfig {
  const parsed = siteConfigSchema.safeParse(eingabe);
  if (!parsed.success) {
    throw fehler(400, parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.');
  }
  return einstellungenZusammensetzen(parsed.data);
}

/**
 * Gespeicherte Rohdaten lesen – beim Laden. `null`, wenn sie nicht zum Schema passen (dann gelten die
 * Vorgaben; ein Lesefehler ist etwas anderes und bleibt Sache des Aufrufers, #273).
 *
 * Altbestand: Die frühere Einzel-ID `musicianGroupId` wird in das Array überführt.
 */
export function einstellungenAus(roh: unknown): SiteConfig | null {
  const parsed = siteConfigSchema.safeParse(roh);
  if (!parsed.success) return null;
  const ids =
    parsed.data.musicianGroupIds.length > 0
      ? parsed.data.musicianGroupIds
      : parsed.data.musicianGroupId != null
        ? [parsed.data.musicianGroupId]
        : [];
  return einstellungenZusammensetzen({ ...parsed.data, musicianGroupIds: ids });
}
