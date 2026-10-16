/**
 * **„Wer kann?“ – die Kandidaten für einen freien Platz** (Bauplan E4-2, Entwurf v17). Nur Regeln; geladen
 * wird in `dienstplaner/src/ladeWerKann.ts` aus `GET /events/{e}/services/{dienst}/possiblepersons`.
 *
 * Gemessen an der Test-Instanz (E4-0, 14.10.2026):
 * - Kandidaten sind die Mitglieder der ChurchTools-Gruppen des Dienstes; je Dienst ein Aufruf (0,2 s).
 * - `score` mit `scoreHints` (`{score, reason, nameTranslated}`): Abwesenheit −1000 (`absence`), am selben Tag
 *   schon im Dienst −250 (`service.same-day`), letzter/nächster Dienst nah, Auslastung im Monat.
 * - **„Hat zuvor abgesagt“ (`service.previously-declined`, −500) ist über die Schnittstelle nicht von „vom
 *   Planer herausgenommen oder ersetzt“ zu unterscheiden.** Alwin (14.10.): frühere Absagen werden gar nicht
 *   gezeigt – deshalb zählt dieser Abzug auch nicht für die Reihenfolge, sonst stünde jemand still unten.
 * - `monthlyUtilization` zählt je Monat die Dienste **in dieser Dienstgruppe**, nicht über alle Dienste.
 * - Abwesenheiten mit Grund (`absenceReason.nameTranslated`) und einem freien Kommentar – der Kommentar kann
 *   privat sein und wird nicht gezeigt.
 */

export interface Kandidat {
  personId: number;
  name: string;
  /** Punkte für die Reihenfolge: ChurchTools' `score` ohne den Abzug für frühere Absagen. */
  punkte: number;
  /** Grund der Abwesenheit an diesem Tag, sonst `null`. */
  abwesend: string | null;
  /** Dienste, die die Person an diesem Tag schon hat. */
  amTag: string[];
  /** Dienste in dieser Dienstgruppe im Monat des Termins. */
  imMonat: number;
  /** Die Gründe aus ChurchTools' `scoreHints` (`reason`) – der Zauberstab prüft daran, was schon abgezogen ist. */
  gruende: string[];
  /** ChurchTools' Abzug für den nächsten Dienst davor bzw. danach (`last/next.service.near`, 0 = keiner). */
  abstandDavor: number;
  abstandDanach: number;
  /** Vorliebe „höchstens N× im Monat“ (`serviceGroupPreferences.maxPerMonth`), `null` = keine gespeichert. */
  hoechstensImMonat: number | null;
  /**
   * ChurchTools' eigener Text zum größten Abzug (`nameTranslated`, z. B. „Heute bereits eingeteilt“) – so zeigt es
   * auch der ChurchTools-Zauberstab. Ohne den Abzug für frühere Absagen (zählt nicht, s. o.); `null` ohne Abzug.
   */
  hauptGrund: string | null;
}

interface RohHinweis {
  score?: unknown;
  reason?: unknown;
  nameTranslated?: unknown;
}

export interface RohKandidat {
  person?: {
    title?: unknown;
    domainIdentifier?: unknown;
    domainAttributes?: { firstName?: unknown; lastName?: unknown } | null;
  } | null;
  score?: unknown;
  scoreHints?: RohHinweis[] | null;
  monthlyUtilization?: Record<string, unknown> | null;
  absences?: { absenceReason?: { nameTranslated?: unknown; name?: unknown } | null }[] | null;
  servicesOnSameDay?: { eventService?: { serviceName?: unknown } | null }[] | null;
  /** Gemessen E5-0 (16.10.2026): `{personId, serviceGroupId, maxPerMonth, relationWeight, morningWeight, …}`. */
  serviceGroupPreferences?: { maxPerMonth?: unknown } | null;
}

/** Der Abzug, den ChurchTools für frühere Absagen gibt – siehe oben, warum er nicht zählt. */
export const FRUEHER_ABGESAGT = 'service.previously-declined';

const text = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

/** Summe der Abzüge mit diesem Grund (ChurchTools gibt je Grund höchstens einen). */
const abzugFuer = (hinweise: RohHinweis[], grund: string): number =>
  hinweise
    .filter((h) => h.reason === grund && typeof h.score === 'number')
    .reduce((s, h) => s + (h.score as number), 0);

/** Der Text zum größten Abzug – wie der ChurchTools-Zauberstab (`sortBy(scoreHints, 'score')[0]`). */
function hauptGrundAus(hinweise: RohHinweis[]): string | null {
  const abzuege = hinweise.filter(
    (h) =>
      h.reason !== FRUEHER_ABGESAGT &&
      typeof h.score === 'number' &&
      h.score < 0 &&
      text(h.nameTranslated) !== '',
  );
  if (abzuege.length === 0) return null;
  const groesster = abzuege.reduce((a, b) => ((b.score as number) < (a.score as number) ? b : a));
  return text(groesster.nameTranslated);
}

function nameAus(p: NonNullable<RohKandidat['person']>): string {
  const a = p.domainAttributes;
  const voll = [text(a?.firstName), text(a?.lastName)].filter(Boolean).join(' ');
  return voll || text(p.title);
}

/**
 * Die Kandidaten in der Reihenfolge „frei und selten dran“ zuerst. `monat` ist der Monat des Termins
 * (`JJJJ-MM`); wer an diesem Platz-Dienst schon eingeteilt ist (`schonDa`), steht nicht in der Liste.
 */
export function kandidatenAus(
  roh: RohKandidat[] | null | undefined,
  o: { monat: string; schonDa: ReadonlySet<number> },
): Kandidat[] {
  const out: Kandidat[] = [];
  for (const k of roh ?? []) {
    if (!k.person) continue;
    const personId = Number(k.person.domainIdentifier);
    const name = nameAus(k.person);
    if (!Number.isInteger(personId) || personId <= 0 || name === '' || o.schonDa.has(personId))
      continue;
    const hinweise = k.scoreHints ?? [];
    const abzug = abzugFuer(hinweise, FRUEHER_ABGESAGT);
    const hoechstens = k.serviceGroupPreferences?.maxPerMonth;
    const abwesend = (k.absences ?? [])[0];
    const monat = k.monthlyUtilization?.[o.monat];
    out.push({
      personId,
      name,
      punkte: (typeof k.score === 'number' ? k.score : 0) - abzug,
      abwesend: abwesend
        ? text(abwesend.absenceReason?.nameTranslated) ||
          text(abwesend.absenceReason?.name) ||
          'abwesend'
        : null,
      amTag: [
        ...new Set(
          (k.servicesOnSameDay ?? []).map((d) => text(d.eventService?.serviceName)).filter(Boolean),
        ),
      ],
      imMonat: typeof monat === 'number' ? monat : 0,
      gruende: hinweise.map((h) => text(h.reason)).filter(Boolean),
      abstandDavor: abzugFuer(hinweise, 'last.service.near'),
      abstandDanach: abzugFuer(hinweise, 'next.service.near'),
      hoechstensImMonat:
        typeof hoechstens === 'number' && Number.isInteger(hoechstens) && hoechstens >= 0
          ? hoechstens
          : null,
      hauptGrund: hauptGrundAus(hinweise),
    });
  }
  return out.sort((a, b) => b.punkte - a.punkte || a.name.localeCompare(b.name, 'de'));
}

/** Kurz, warum jemand oben oder unten steht – wie im Entwurf („frei“, „abwesend: …“, „am Tag schon: …“). */
export function kandidatHinweis(k: Kandidat): { text: string; warnung: boolean } {
  if (k.abwesend) return { text: `abwesend: ${k.abwesend}`, warnung: true };
  if (k.amTag.length) return { text: `am Tag schon: ${k.amTag.join(', ')}`, warnung: true };
  return { text: 'frei', warnung: false };
}
