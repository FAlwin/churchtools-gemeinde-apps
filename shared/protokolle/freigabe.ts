/**
 * **Freigeben und zurücknehmen** (Bauplan S6-1, entschieden 09./11.11.2026, Entwurf `s6-freigabe-pdf-v1`).
 *
 * - Vor dem Freigeben **Hinweise, kein Zwang:** offene Anwesenheit („geprüft?“), To-Dos ohne Zuständigen, offene
 *   Vorschläge – dazu eine Zusammenfassung. Alles aus derselben Ableitung wie die Bereiche (`ableiten`).
 * - Freigegeben = Kopf „frei“ mit `freigabe {von, am}`; **zurücknehmen** darf die Leitung → wieder Entwurf. Beides steht
 *   im **Verlauf** des Kopfs (wer, wann, mit Namen – Mitglieder sehen die Mitgliederliste oft nicht), damit über dem
 *   Protokoll „Freigabe zurückgenommen am … von …“ stehen kann. Der Verlauf ist neu (S6-1) und fehlt älteren Köpfen.
 */
import { ableiten, BLOCK, type Block } from './dokument';
import type { Aufgabe } from './aufgaben';
import type { TreffenStand } from './anwesenheit';
import type { ProtokollKopf } from './speicher';

export interface FreigabeEintrag {
  art: 'freigegeben' | 'zurueckgenommen';
  von: number;
  name: string;
  /** ISO-Zeit. */
  am: string;
}

/** Der Kopf mit seinem Verlauf (S6-1). Ältere Köpfe haben keinen. */
export type KopfMitVerlauf = ProtokollKopf & { verlauf?: FreigabeEintrag[] };

/** Der Verlauf eines Kopfs – kaputte Einträge fallen weg. */
export function verlaufAus(kopf: object | null): FreigabeEintrag[] {
  const v = (kopf as { verlauf?: unknown } | null)?.verlauf;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is FreigabeEintrag =>
      !!e &&
      typeof e === 'object' &&
      ((e as FreigabeEintrag).art === 'freigegeben' ||
        (e as FreigabeEintrag).art === 'zurueckgenommen') &&
      typeof (e as FreigabeEintrag).von === 'number' &&
      typeof (e as FreigabeEintrag).name === 'string' &&
      typeof (e as FreigabeEintrag).am === 'string',
  );
}

export interface Wer {
  person: number;
  name: string;
}

/** Der Kopf nach der Freigabe – auf dem frisch gelesenen; die Sperre fällt weg. */
export function freigegebenerKopf(k: ProtokollKopf, ich: Wer, am: string): KopfMitVerlauf {
  return {
    ...k,
    status: 'frei',
    freigabe: { von: ich.person, am },
    sperre: null,
    verlauf: [...verlaufAus(k), { art: 'freigegeben', von: ich.person, name: ich.name, am }],
  };
}

/** Der Kopf nach „Freigabe zurücknehmen“ – wieder Entwurf, ohne Sperre; der Verlauf behält die Freigabe. */
export function zurueckgenommenerKopf(k: ProtokollKopf, ich: Wer, am: string): KopfMitVerlauf {
  return {
    ...k,
    status: 'entwurf',
    freigabe: null,
    sperre: null,
    verlauf: [...verlaufAus(k), { art: 'zurueckgenommen', von: ich.person, name: ich.name, am }],
  };
}

/**
 * **Was über dem Protokoll steht:** die (letzte) Freigabe mit Namen – und bei einem Entwurf, dessen letzte Freigabe
 * zurückgenommen wurde, „Freigabe zurückgenommen am … von …“ samt der Freigabe davor.
 */
export function freigabeVermerk(k: KopfMitVerlauf | null): {
  freigabe: { am: string; name: string | null } | null;
  zurueck: { am: string; name: string; vorher: FreigabeEintrag | null } | null;
} {
  if (!k) return { freigabe: null, zurueck: null };
  const v = verlaufAus(k);
  const letzteFreigabe = [...v].reverse().find((e) => e.art === 'freigegeben') ?? null;
  if (k.status === 'frei')
    return {
      freigabe: k.freigabe
        ? {
            am: k.freigabe.am,
            name: letzteFreigabe?.von === k.freigabe.von ? letzteFreigabe.name : null,
          }
        : null,
      zurueck: null,
    };
  const letzter = v.at(-1);
  if (letzter?.art !== 'zurueckgenommen') return { freigabe: null, zurueck: null };
  return {
    freigabe: null,
    zurueck: { am: letzter.am, name: letzter.name, vorher: letzteFreigabe },
  };
}

/**
 * **„Freigabe zurückgenommen am … von … – vorher freigegeben am … von ….“** – der Satz über einem zurückgenommenen
 * Entwurf, auf der Seite (`ZurueckVermerk`) und im PDF (S6-3a). `tag` macht aus einem Zeitpunkt den Tag der Gemeinde.
 */
export function zurueckText(
  z: NonNullable<ReturnType<typeof freigabeVermerk>['zurueck']>,
  tag: (iso: string) => string,
): string {
  return `Freigabe zurückgenommen am ${tag(z.am)} von ${z.name}${
    z.vorher ? ` – vorher freigegeben am ${tag(z.vorher.am)} von ${z.vorher.name}` : ''
  }.`;
}

export interface Hinweis {
  art: 'anwesenheit' | 'todos' | 'vorschlaege';
  text: string;
  /** Namen bzw. Titel darunter. */
  einzeln: string[];
  /** Block-ID, zu der „Ansehen“ springt – `null`: keine Stelle im Protokoll. */
  ziel: string | null;
}

const zahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/**
 * **Die Hinweise im Fenster „Protokoll freigeben?“** – nur, was einen Blick wert ist; leer = alles in Ordnung.
 * - Anwesenheit: wer im Gruppentreffen noch „offen“ ist (nur mit Treffen, und nur solange es nicht abgeschlossen ist).
 * - To-Dos ohne Zuständigen: weder Person noch externer Name – am gespeicherten To-Do, sonst an der Vorab-Wahl (K1).
 * - Offene Vorschläge dieser Sitzung (S5-4): sie rutschen nach der Freigabe zur nächsten Sitzung.
 */
export function freigabeHinweise(q: {
  dokument: readonly Block[];
  aufgaben: ReadonlyMap<string, Aufgabe>;
  anwesenheit: TreffenStand | null;
  offeneVorschlaege: readonly { titel: string }[];
}): { hinweise: Hinweis[]; zusammenfassung: string } {
  const a = ableiten(q.dokument);
  const hinweise: Hinweis[] = [];

  if (q.anwesenheit && !q.anwesenheit.abgeschlossen) {
    const offen = q.anwesenheit.personen.filter((p) => p.status === 'offen');
    if (offen.length)
      hinweise.push({
        art: 'anwesenheit',
        text: `Anwesenheit: ${offen.length} noch offen – geprüft?`,
        einzeln: offen.map((p) => p.name),
        ziel: verweisBlock(q.dokument, 'anwesenheit'),
      });
  }

  const ohne = a.aufgaben.filter((e) => {
    const t = e.aufgabe ? q.aufgaben.get(e.aufgabe) : undefined;
    if (t?.geloescht) return false;
    const wer = t ? t.wer : (e.vorab?.wer ?? []);
    const extern = t ? t.extern : (e.vorab?.extern ?? '');
    return wer.length === 0 && !extern.trim();
  });
  if (ohne.length)
    hinweise.push({
      art: 'todos',
      text: `${zahl(ohne.length, 'To-Do', 'To-Dos')} ohne Zuständigen`,
      einzeln: ohne.map((e) => e.text || '(ohne Text)'),
      ziel: ohne[0].blockId,
    });

  if (q.offeneVorschlaege.length)
    hinweise.push({
      art: 'vorschlaege',
      text: `${zahl(q.offeneVorschlaege.length, 'Vorschlag', 'Vorschläge')} noch offen – ${
        q.offeneVorschlaege.length === 1 ? 'er rutscht' : 'sie rutschen'
      } zur nächsten Sitzung`,
      einzeln: q.offeneVorschlaege.map((v) => v.titel),
      ziel: null,
    });

  const zusammenfassung = [
    zahl(a.beschluesse.length, 'Beschluss', 'Beschlüsse'),
    zahl(a.aufgaben.length, 'To-Do', 'To-Dos'),
    zahl(a.termine.length, 'Termin', 'Termine'),
    zahl(a.punkte.filter((p) => p.tiefe === 0).length, 'Tagesordnungspunkt', 'Tagesordnungspunkte'),
  ].join(', ');
  return { hinweise, zusammenfassung };
}

/** Der erste feste Punkt dieser Art (auch eingerückt) – `null`, wenn es keinen gibt. */
function verweisBlock(dokument: readonly Block[], art: string): string | null {
  for (const b of dokument) {
    if (b.type === BLOCK.verweis && b.props?.art === art) return b.id;
    const k = verweisBlock(b.children ?? [], art);
    if (k) return k;
  }
  return null;
}
