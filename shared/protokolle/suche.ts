/**
 * **Die Suche der Protokolle** (Bauplan S3-4, Alwin 23.10.2026): eine globale Suche über Beschlüsse, To-Dos, Termine
 * und den Protokolltext aller Gruppen, filterbar nach Art und Gruppe. Ohne Suchbegriff zeigt sie die Beschlüsse –
 * das ist die Beschluss-Übersicht des Bauplans.
 *
 * - **Beschlüsse, Termine, Protokolltext** nur aus **freigegebenen** Protokollen (Alwin: „nur freigegebene“).
 * - **To-Dos** aus allen Protokollen (laufende Aufgaben; sie stehen auch auf der Startseite), gelöschte nie.
 * - Tagesordnungspunkte und Beschlüsse/Termine kommen aus der EINEN Ableitung (`ableiten`), damit Nummern und
 *   Zuordnung dieselben sind wie im Protokoll selbst.
 */
import type { Aufgabe } from './aufgaben';
import { ableiten, BLOCK, textAus, type Ableitung, type Block } from './dokument';
import { dokumentDerSitzung, type ProtokollTeil } from './speicher';
import type { Sitzung } from './sitzungen';

export type SuchArt = 'beschluss' | 'aufgabe' | 'termin' | 'text';

export interface SuchEintrag {
  art: SuchArt;
  /** Eindeutig über alle Gruppen – für Listen-Schlüssel. */
  schluessel: string;
  gruppe: { id: number; name: string };
  /** Die Sitzung, in der der Eintrag steht – `null` bei einem To-Do, dessen Protokoll nicht (mehr) da ist. */
  sitzung: { schluessel: string; titel: string; beginn: string } | null;
  /** Der Tagesordnungspunkt – `null` vor dem ersten Punkt oder ohne Protokoll. */
  punkt: { blockId: string; nummer: number; titel: string } | null;
  text: string;
  /** Nur Termine: `JJJJ-MM-TT` oder `null`. */
  datum?: string | null;
  /** Nur To-Dos: der Stand aus „Mitarbeit“. */
  aufgabe?: Aufgabe;
}

/** Was je Gruppe gelesen ist – derselbe Stand wie für die Startseite (`ladeUebersicht`). */
export interface SuchGruppe {
  gruppe: { id: number; name: string };
  sitzungen: {
    kommend: readonly Sitzung[];
    protokolle: readonly Sitzung[];
    teile: readonly ProtokollTeil[];
  };
  aufgaben: readonly Aufgabe[];
}

export interface SuchFrage {
  begriff: string;
  art: SuchArt | 'alles';
  /** `null` = alle Gruppen. */
  gruppe: number | null;
}

interface Gelesen {
  sitzung: Sitzung;
  dokument: Block[];
  ableitung: Ableitung;
  punkte: Map<string, { blockId: string; nummer: number; titel: string }>;
  /** Block-ID → Position im Dokument (für die Reihenfolge). */
  stelle: Map<string, number>;
  /** Block-ID → Tagesordnungspunkt. */
  punktVon: Map<string, string | null>;
}

/** Ein Protokoll lesen: Dokument, Punkte und für jeden Block Position und Punkt. `null`, wenn es nicht lesbar ist. */
function lesen(s: Sitzung, teile: readonly ProtokollTeil[]): Gelesen | null {
  const dokument = dokumentDerSitzung(s.kopf, teile);
  if (!dokument) return null;
  const a = ableiten(dokument);
  const punkte = new Map(a.punkte.map((p) => [p.blockId, p]));
  const stelle = new Map<string, number>();
  const punktVon = new Map<string, string | null>();
  let punkt: string | null = null;
  const besuche = (b: Block): void => {
    stelle.set(b.id, stelle.size);
    punktVon.set(b.id, punkt);
    for (const k of b.children ?? []) besuche(k);
  };
  for (const b of dokument) {
    // Ein Tagesordnungspunkt ist, was die Ableitung dafür hält – nicht hier nachgebaut.
    if (punkte.has(b.id)) punkt = b.id;
    besuche(b);
  }
  return { sitzung: s, dokument, ableitung: a, punkte, stelle, punktVon };
}

const ART_DER_BLOECKE = new Set<string>([BLOCK.beschluss, BLOCK.aufgabe, BLOCK.termin]);

/**
 * **Alles Durchsuchbare** aus den gelesenen Gruppen – neueste Sitzung zuerst, innerhalb einer Sitzung in der
 * Reihenfolge des Dokuments; To-Dos ohne bekanntes Protokoll ganz am Ende.
 */
export function suchIndex(gruppen: readonly SuchGruppe[]): SuchEintrag[] {
  const eintraege: { e: SuchEintrag; zeit: number; stelle: number }[] = [];

  for (const g of gruppen) {
    const alle = [...g.sitzungen.kommend, ...g.sitzungen.protokolle];
    const gelesen = new Map<string, Gelesen>();
    for (const s of alle) {
      const x = s.kopf ? lesen(s, g.sitzungen.teile) : null;
      if (x && s.kopf) gelesen.set(s.kopf.sitzung, x);
    }
    const sitzungVon = (s: Sitzung) => ({
      schluessel: s.schluessel,
      titel: s.titel,
      beginn: s.beginn,
    });
    const punktVon = (x: Gelesen, blockId: string) => {
      const p = x.punktVon.get(blockId);
      return (p && x.punkte.get(p)) || null;
    };

    // Beschlüsse, Termine, Protokolltext – nur freigegebene Protokolle.
    for (const x of gelesen.values()) {
      if (x.sitzung.kopf?.status !== 'frei') continue;
      const zeit = Date.parse(x.sitzung.beginn);
      const a = x.ableitung;
      const neu = (art: SuchArt, blockId: string, text: string, extra: Partial<SuchEintrag> = {}) =>
        eintraege.push({
          e: {
            art,
            schluessel: `${g.gruppe.id}:${x.sitzung.schluessel}:${blockId}`,
            gruppe: g.gruppe,
            sitzung: sitzungVon(x.sitzung),
            punkt: punktVon(x, blockId),
            text,
            ...extra,
          },
          zeit,
          stelle: x.stelle.get(blockId) ?? 0,
        });
      for (const b of a.beschluesse) neu('beschluss', b.blockId, b.text);
      for (const t of a.termine) neu('termin', t.blockId, t.text, { datum: t.datum });
      const textBloecke = (bloecke: readonly Block[]): void => {
        for (const b of bloecke) {
          const text = textAus(b.content).trim();
          if (text && !x.punkte.has(b.id) && !ART_DER_BLOECKE.has(b.type)) neu('text', b.id, text);
          textBloecke(b.children ?? []);
        }
      };
      textBloecke(x.dokument);
    }

    // To-Dos – aus allen Protokollen, der Stand kommt aus „Mitarbeit“.
    for (const a of g.aufgaben) {
      if (a.geloescht) continue;
      const x = a.sitzung ? gelesen.get(a.sitzung) : undefined;
      const s = x?.sitzung ?? alle.find((y) => y.kopf?.sitzung === a.sitzung) ?? null;
      const block = x ? x.ableitung.aufgaben.find((b) => b.aufgabe === a.id) : undefined;
      eintraege.push({
        e: {
          art: 'aufgabe',
          schluessel: `${g.gruppe.id}:aufgabe:${a.id}`,
          gruppe: g.gruppe,
          sitzung: s ? sitzungVon(s) : null,
          punkt: x && block ? punktVon(x, block.blockId) : null,
          text: a.text,
          aufgabe: a,
        },
        zeit: s ? Date.parse(s.beginn) : -Infinity,
        stelle: x && block ? (x.stelle.get(block.blockId) ?? 0) : Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return eintraege.sort((p, q) => q.zeit - p.zeit || p.stelle - q.stelle).map((x) => x.e);
}

const klein = (s: string): string => s.toLocaleLowerCase('de-DE');

/** Die Wörter eines Suchbegriffs – klein, ohne Leerstellen. */
export function begriffe(begriff: string): string[] {
  return klein(begriff).split(/\s+/).filter(Boolean);
}

/** Worin gesucht wird: der Eintrag selbst, sein Tagesordnungspunkt und der Titel der Sitzung. */
function heuhaufen(e: SuchEintrag): string {
  return klein([e.text, e.punkt?.titel ?? '', e.sitzung?.titel ?? ''].join('\n'));
}

/**
 * **Suchen:** Jedes Wort des Begriffs muss vorkommen (Groß-/Kleinschreibung egal). Ohne Begriff gibt es keinen
 * Protokolltext (das wären alle Absätze) – „Alles“ zeigt dann Beschlüsse, To-Dos und Termine.
 */
export function suchen(index: readonly SuchEintrag[], frage: SuchFrage): SuchEintrag[] {
  const woerter = begriffe(frage.begriff);
  return index.filter((e) => {
    if (frage.gruppe !== null && e.gruppe.id !== frage.gruppe) return false;
    if (frage.art !== 'alles' && e.art !== frage.art) return false;
    if (!woerter.length) return e.art !== 'text';
    const h = heuhaufen(e);
    return woerter.every((w) => h.includes(w));
  });
}

/** **Fundstellen** zum Hervorheben: Bereiche `[von, bis)` im Text, sortiert und zusammengelegt. */
export function fundstellen(
  text: string,
  woerter: readonly string[],
): { von: number; bis: number }[] {
  const t = klein(text);
  const roh: { von: number; bis: number }[] = [];
  for (const w of woerter) {
    for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + w.length))
      roh.push({ von: i, bis: i + w.length });
  }
  roh.sort((a, b) => a.von - b.von);
  const out: { von: number; bis: number }[] = [];
  for (const r of roh) {
    const letzte = out[out.length - 1];
    if (letzte && r.von <= letzte.bis) letzte.bis = Math.max(letzte.bis, r.bis);
    else out.push({ ...r });
  }
  return out;
}
