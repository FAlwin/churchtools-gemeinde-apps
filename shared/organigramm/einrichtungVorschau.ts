/**
 * **„Wer wechselt wann wohin“** (Bauplan O9-5c-2, Entwurf `o9-5-einrichten-v1`, Vorschau) – die Zahlen je Jahr und
 * Übergang als reine Rechnung über die geladenen Kinder. Die Frage selbst beantwortet `werWechselt` (O9-1, dieselbe, die
 * die Regel der Wechsel-Gruppe ChurchTools stellt) – hier wird nur gezählt und sortiert.
 *
 * Nur **aktive Teilnehmer** einer Stufe zählen, keine Leitung (wie in der Sicht der Leitungen, `gruppenSicht`).
 */
import {
  uebergaenge,
  werWechselt,
  type GruppenwechselEinstellung,
  type KindInGruppe,
  type Wechseljahr,
} from './gruppenwechsel';
import type { KjDaten } from './gruppenwechselSicht';

export interface KindMitName extends KindInGruppe {
  name: string;
}

/** Die Kinder der Stufen: aktive Teilnehmer der sichtbaren Stufen mit Geburtstag (oder `null`). */
export function kinderDerStufen(
  daten: KjDaten,
  e: Pick<GruppenwechselEinstellung, 'stufen'>,
): { kinder: KindMitName[]; nichtGelesen: string[] } {
  const kinder: KindMitName[] = [];
  const nichtGelesen: string[] = [];
  for (const s of e.stufen) {
    const g = daten.gruppen.get(s.gruppeId);
    if (g?.art !== 'sichtbar') {
      nichtGelesen.push(s.name);
      continue;
    }
    for (const m of g.mitglieder)
      if (!m.leitung && m.status === 'active')
        kinder.push({
          personId: m.personId,
          gruppeId: s.gruppeId,
          geburtstag: daten.geburtstage.get(m.personId) ?? null,
          name: m.name,
        });
  }
  return { kinder, nichtGelesen };
}

export interface WerZeile {
  jahr: Wechseljahr;
  /** Je Übergang (in der Reihenfolge von `uebergaenge`): so viele wechseln. */
  zahlen: number[];
}

export interface WerVorschau {
  /** Ein Eintrag je Jahr. */
  jahre: WerZeile[];
  /** Die Überschriften der Übergänge: „Fische → Jungschar“. */
  uebergaenge: string[];
  /** Die Namen der Kinder, die im ERSTEN Jahr wechseln, je Übergang. */
  namen: string[][];
  /** Aktive Kinder in den Stufen ohne Geburtstag – sie wechseln nie von selbst. */
  ohneGeburtstag: number;
  /** Stufen, deren Kinder sich nicht lesen ließen. */
  nichtGelesen: string[];
}

export function werVorschau(
  daten: KjDaten,
  e: Pick<GruppenwechselEinstellung, 'stufen'>,
  jahre: readonly Wechseljahr[],
): WerVorschau {
  const wege = uebergaenge(e);
  const { kinder, nichtGelesen } = kinderDerStufen(daten, e);
  const name = new Map(kinder.map((k) => [k.personId, k.name]));
  // Jahr für Jahr weiterrechnen: Wer wechselt, steht im nächsten Jahr in der neuen Gruppe – wie ChurchTools es am
  // Wechseltag macht. Sonst zählte ein Kind, das 2027 wechselt, 2028 und 2029 noch einmal (Test-Instanz, 16.11.2026).
  let stand: readonly KindMitName[] = kinder;
  const je = jahre.map((jahr) => {
    const wechsel = werWechselt(stand, e, jahr);
    const nach = new Map<number, number>();
    for (const w of wechsel) if (w.art === 'wechselt') nach.set(w.personId, w.nach.gruppeId);
    stand = stand.map((k) => {
      const g = nach.get(k.personId);
      return g === undefined ? k : { ...k, gruppeId: g };
    });
    return { jahr, wechsel };
  });
  const zaehle = (wechsel: ReturnType<typeof werWechselt>, vonId: number) =>
    wechsel.filter((w) => w.art === 'wechselt' && w.von.gruppeId === vonId);
  return {
    jahre: je.map(({ jahr, wechsel }) => ({
      jahr,
      zahlen: wege.map((u) => zaehle(wechsel, u.von.gruppeId).length),
    })),
    uebergaenge: wege.map((u) => `${u.von.name} → ${u.nach.name}`),
    namen:
      je.length === 0
        ? wege.map(() => [])
        : wege.map((u) =>
            zaehle(je[0].wechsel, u.von.gruppeId)
              .map((w) => name.get(w.personId) ?? `Person ${w.personId}`)
              .sort((a, b) => a.localeCompare(b, 'de')),
          ),
    ohneGeburtstag:
      je.length === 0 ? 0 : je[0].wechsel.filter((w) => w.art === 'ohneGeburtstag').length,
    nichtGelesen,
  };
}
