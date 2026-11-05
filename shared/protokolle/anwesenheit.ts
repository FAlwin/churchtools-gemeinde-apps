/**
 * **Anwesenheit** (Bauplan S5-3, Entwürfe `s5-3-anwesenheit-v1/-v2`, Alwin 05.11.2026) – die Regel ohne ChurchTools.
 *
 * - Die Anwesenheit der Mitglieder steht im **ChurchTools-Gruppentreffen** (dort hat ChurchTools auch die Tabelle über
 *   alle Sitzungen – kein eigener Verlauf). Gemessen (`messung-s5-3-2026-11-05.md`): je Person `present` / `absent` /
 *   `unsure`; „Gruppentreffen pflegen“ = Recht 10124.
 * - **Von selbst vorbelegt:** Zusage = anwesend, Absage = abwesend, ohne Antwort bleibt offen – nur, solange am Treffen
 *   noch niemand etwas eingetragen hat (`hasEditingStarted`). Wer danach bewusst auf „offen“ zurücksetzt, bekommt
 *   nichts darübergeschrieben.
 * - **Gäste** sind freie Namen und stehen **nur im Protokoll** (`props.gaeste` am festen Punkt), nie im Gruppentreffen
 *   (Alwin: „die müssen nicht in der Gruppe stehen“). Sie gelten als anwesend.
 */
import type { Anfrage } from './sitzungen';

export type AnwesenheitsStatus = 'offen' | 'da' | 'weg';

export interface TeilnahmePerson {
  person: number;
  name: string;
  status: AnwesenheitsStatus;
}

/** Was das Gruppentreffen sagt. */
export interface TreffenStand {
  /** Abgeschlossen (bei der Freigabe, S6) – dann sperrt ChurchTools die Anwesenheit. */
  abgeschlossen: boolean;
  /** Hat schon jemand etwas eingetragen? Dann wird nicht mehr von selbst vorbelegt. */
  begonnen: boolean;
  personen: TeilnahmePerson[];
}

/** ChurchTools → unser Status. Unbekanntes zählt als offen. */
export function statusAus(ct: unknown): AnwesenheitsStatus {
  return ct === 'present' ? 'da' : ct === 'absent' ? 'weg' : 'offen';
}

/** Unser Status → ChurchTools. */
export function ctStatus(s: AnwesenheitsStatus): 'present' | 'absent' | 'unsure' {
  return s === 'da' ? 'present' : s === 'weg' ? 'absent' : 'unsure';
}

const text = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

/**
 * Die Personen aus `GET /groups/{g}/meetings/{m}/members` (ausgepackt) – nach Namen sortiert. Einträge ohne
 * Personen-ID fallen weg.
 */
export function personenAus(roh: unknown): TeilnahmePerson[] {
  if (!Array.isArray(roh)) return [];
  const out: TeilnahmePerson[] = [];
  for (const z of roh as {
    personId?: unknown;
    status?: unknown;
    member?: {
      person?: { title?: unknown; domainAttributes?: { firstName?: unknown; lastName?: unknown } };
    };
  }[]) {
    if (typeof z?.personId !== 'number') continue;
    const p = z.member?.person;
    const name =
      [text(p?.domainAttributes?.firstName), text(p?.domainAttributes?.lastName)]
        .filter(Boolean)
        .join(' ') ||
      text(p?.title) ||
      `Person ${z.personId}`;
    out.push({ person: z.personId, name, status: statusAus(z.status) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Das Treffen aus `GET /groups/{g}/meetings/{m}` (ausgepackt) plus seine Personen. */
export function treffenStandAus(treffen: unknown, personen: unknown): TreffenStand {
  const t = (treffen ?? {}) as { isCompleted?: unknown; hasEditingStarted?: unknown };
  return {
    abgeschlossen: t.isCompleted === true,
    begonnen: t.hasEditingStarted === true,
    personen: personenAus(personen),
  };
}

/**
 * **Was von selbst eingetragen wird:** Zusage → anwesend, Absage → abwesend – nur bei Personen, die im Treffen noch
 * offen sind, und nur, solange am Treffen niemand etwas eingetragen hat und es nicht abgeschlossen ist.
 */
export function vorbelegung(
  stand: TreffenStand,
  anfragen: readonly Anfrage[],
): { person: number; status: AnwesenheitsStatus }[] {
  if (stand.begonnen || stand.abgeschlossen) return [];
  const antwort = new Map(anfragen.map((a) => [a.person, a.antwort]));
  return stand.personen.flatMap((p): { person: number; status: AnwesenheitsStatus }[] => {
    if (p.status !== 'offen') return [];
    const a = antwort.get(p.person);
    return a === 'zugesagt'
      ? [{ person: p.person, status: 'da' }]
      : a === 'abgesagt'
        ? [{ person: p.person, status: 'weg' }]
        : [];
  });
}

/** Ein Tipp auf „Anwesend“/„Abwesend“: setzt ihn – oder, wenn er schon so steht, wieder auf offen. */
export function nachTipp(jetzt: AnwesenheitsStatus, tipp: 'da' | 'weg'): AnwesenheitsStatus {
  return jetzt === tipp ? 'offen' : tipp;
}

/** Die Kurzform (zugeklappt, beim Lesen): wer da war, wer fehlte, wer offen ist, und die Gäste. */
export function kurzform(
  personen: readonly TeilnahmePerson[],
  gaeste: readonly string[],
): { anwesend: string[]; abwesend: string[]; offen: string[]; gaeste: string[] } {
  const je = (s: AnwesenheitsStatus) => personen.filter((p) => p.status === s).map((p) => p.name);
  return { anwesend: je('da'), abwesend: je('weg'), offen: je('offen'), gaeste: [...gaeste] };
}

/** `props.gaeste` lesen – eine JSON-Liste von Namen; Leeres, Doppeltes und Kaputtes fällt weg. */
export function gaesteAus(x: unknown): string[] {
  if (typeof x !== 'string' || !x) return [];
  try {
    const v: unknown = JSON.parse(x);
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const n of v) {
      const name = text(n);
      if (name && !out.includes(name)) out.push(name);
    }
    return out;
  } catch {
    return [];
  }
}

/** `props.gaeste` schreiben – leer, wenn es keine Gäste gibt (dann bleibt der Block wie vorher). */
export function gaesteWert(gaeste: readonly string[]): string {
  const sauber = gaesteAus(JSON.stringify(gaeste));
  return sauber.length ? JSON.stringify(sauber) : '';
}
