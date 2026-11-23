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
 * - **Aus dem Protokoll genommen** (`props.ohne`, Alwin 17.11.2026): Jede Person lässt sich aus der Anwesenheit DIESES
 *   Protokolls ausblenden – etwa ein Gemeinschaftskonto, das als Gruppenmitglied in jedem Gruppentreffen steht. Das
 *   steht **nur im Protokoll**; im Gruppentreffen bleibt die Person unverändert. `ohneAusgeblendete` ist die EINE
 *   Stelle, die sie aus dem Stand nimmt – Anzeige, Zahlen, PDF, Freigabe-Hinweis und Vorbelegung gehen alle darüber.
 * - **Das Protokoll merkt sich die Anwesenheit** (W16, Alwin 23.11.2026): ChurchTools zeigt sie nur Rollen mit
 *   „Gruppentreffen durchführen/pflegen“ (10111/10124) – Mitarbeitende sahen beim Lesen „ChurchTools erlaubt dir das
 *   nicht“. Beim Schreiben steht darum ein **Schnappschuss** (Person, Name, Status) im Block (`props.schnappschuss`).
 *   Gelesen wird live, wo ChurchTools es erlaubt; sonst – kein Recht **oder** ein vorübergehender Fehler – der
 *   Schnappschuss, ohne Fehlermeldung (`zumLesen`, die EINE Stelle für Ansicht und PDF).
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
 * offen sind, und nur, solange am Treffen niemand etwas eingetragen hat und es nicht abgeschlossen ist. Aus dem
 * Protokoll genommene Personen (`ohne`) bleiben unberührt.
 */
export function vorbelegung(
  stand: TreffenStand,
  anfragen: readonly Anfrage[],
  ohne: readonly number[],
): { person: number; status: AnwesenheitsStatus }[] {
  if (stand.begonnen || stand.abgeschlossen) return [];
  // Wer aus dem Protokoll genommen ist, bekommt nichts von selbst eingetragen (das stünde sonst im Gruppentreffen).
  const sichtbar = ohneAusgeblendete(stand, ohne);
  const antwort = new Map(anfragen.map((a) => [a.person, a.antwort]));
  return sichtbar.personen.flatMap((p): { person: number; status: AnwesenheitsStatus }[] => {
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

/** `props.ohne` lesen – eine JSON-Liste von Personen-IDs; Kaputtes, Doppeltes und Keine-Zahl fällt weg. */
export function ohneAus(x: unknown): number[] {
  if (typeof x !== 'string' || !x) return [];
  try {
    const v: unknown = JSON.parse(x);
    if (!Array.isArray(v)) return [];
    const out: number[] = [];
    for (const n of v)
      if (typeof n === 'number' && Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    return out;
  } catch {
    return [];
  }
}

/** `props.ohne` schreiben – leer, wenn niemand ausgeblendet ist (dann bleibt der Block wie vorher). */
export function ohneWert(ohne: readonly number[]): string {
  const sauber = ohneAus(JSON.stringify(ohne));
  return sauber.length ? JSON.stringify(sauber) : '';
}

/**
 * **Der Stand ohne die aus dem Protokoll genommenen Personen** – die einzige Stelle, die `props.ohne` auf einen
 * `TreffenStand` anwendet. Wer in der Liste nicht (mehr) vorkommt, ist egal.
 */
export function ohneAusgeblendete(stand: TreffenStand, ohne: readonly number[]): TreffenStand {
  if (!ohne.length) return stand;
  return { ...stand, personen: stand.personen.filter((p) => !ohne.includes(p.person)) };
}

/**
 * **`props.schnappschuss` schreiben** (W16) – Person, Name und Status je Person, wie das Gruppentreffen sie liefert (auch
 * Ausgeblendete: `props.ohne` gilt beim Anzeigen, wie beim Live-Stand). Keine Personen: leer.
 */
export function schnappschussWert(stand: Pick<TreffenStand, 'personen'>): string {
  const personen = stand.personen.map(({ person, name, status }) => ({ person, name, status }));
  return personen.length ? JSON.stringify({ personen }) : '';
}

/** `props.schnappschuss` lesen – `null`, wenn keiner da ist oder er kaputt ist. Einträge ohne Person/Name fallen weg. */
export function schnappschussAus(x: unknown): TreffenStand | null {
  if (typeof x !== 'string' || !x) return null;
  try {
    const v = JSON.parse(x) as { personen?: unknown };
    if (!Array.isArray(v?.personen)) return null;
    const personen: TeilnahmePerson[] = [];
    for (const p of v.personen as { person?: unknown; name?: unknown; status?: unknown }[]) {
      const name = text(p?.name);
      if (typeof p?.person !== 'number' || !Number.isInteger(p.person) || !name) continue;
      const status: AnwesenheitsStatus =
        p.status === 'da' || p.status === 'weg' ? p.status : 'offen';
      personen.push({ person: p.person, name, status });
    }
    // Ein Schnappschuss ist kein Treffen: Er wird nie vorbelegt und nie angetippt.
    return { abgeschlossen: false, begonnen: true, personen };
  } catch {
    return null;
  }
}

/**
 * **Was gelesen wird** (W16) – Lese-Ansicht und PDF gleich: der Live-Stand, wo ChurchTools ihn zeigt; scheitert das Lesen
 * (kein Recht **oder** vorübergehend: `'unbekannt'`), der Schnappschuss aus dem Block – gibt es keinen, bleibt es beim
 * `'unbekannt'`. `null` (kein Gruppentreffen) bleibt `null`.
 */
export function zumLesen(
  live: TreffenStand | null | 'unbekannt',
  schnappschuss: unknown,
): TreffenStand | null | 'unbekannt' {
  if (live !== 'unbekannt') return live;
  return schnappschussAus(schnappschuss) ?? 'unbekannt';
}
