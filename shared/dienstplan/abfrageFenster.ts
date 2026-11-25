/**
 * **Das Fenster „Abfrage“ im Dienstplaner – die Rechenregeln** (Bauplan R-2, 25.11.2026): Formular prüfen, die Abfrage
 * zusammenbauen, die Zeitleiste „Was passiert wann“ und die drei Abschnitte des Stands. Nur Rechnen und Texte – gelesen und
 * gespeichert wird in `abfragenSpeicher.ts`, die Oberfläche steht in `dienstplaner/src/AbfrageFenster.tsx`.
 *
 * **Nichts nachgebaut:** Welche Tage erinnert wird, sagt allein `erinnerungsTage` (`abfragen.ts`); welche Termine zur Abfrage
 * gehören, `termineFuerAbfrage`; wer offen ist, `fehlendeInGruppe` (beide `erinnern.ts`). Hier werden ihre Ergebnisse nur
 * beschriftet und gruppiert.
 *
 * **Ehrlich, solange es die Automatik (R-5) nicht gibt:** Die Zeitleiste sagt, was **geplant** ist – nie, dass etwas schon
 * verschickt wurde. Das weiß erst die ChurchTools-Routine.
 */
import { plusTage, tageBis, tagKurz, tagMonat } from '../ct/datum';
import {
  erinnerungsTage,
  GRENZEN,
  abfrageZustand,
  type Abfrage,
  type AbfragenInhalt,
  type AbfrageZustand,
  type Erinnerungsplan,
} from './abfragen';
import type { GruppenErgebnis } from './erinnern';
import type { Personenliste } from './personenliste';

// ── Formular ────────────────────────────────────────────────────────────────

/** Was der Planer eingibt. Alle Tage `YYYY-MM-DD`, leer = noch nicht gewählt. */
export interface AbfrageFormular {
  von: string;
  bis: string;
  frist: string;
  /** „sofort“ = heute; sonst der Tag in `oeffnenTag`. */
  oeffnen: 'sofort' | 'tag';
  oeffnenTag: string;
}

/** Der Tag, an dem die Abfrage öffnet. Leer, solange „an einem Tag“ noch keinen hat. */
export const oeffnenTagAus = (f: AbfrageFormular, heute: string): string =>
  f.oeffnen === 'sofort' ? heute : f.oeffnenTag;

/**
 * **Passt das Formular zu dem, was eine Abfrage sein darf?** (`abfrageSchema` in `abfragen.ts`: `von <= bis`,
 * `oeffnen <= frist < von`) – plus „nicht in der Vergangenheit“. `null`, wenn alles stimmt; sonst der Satz für den Planer.
 * Der erste Fehler gewinnt.
 */
export function formularFehler(f: AbfrageFormular, heute: string): string | null {
  const oeffnen = oeffnenTagAus(f, heute);
  if (!f.von || !f.bis || !f.frist || !oeffnen)
    return 'Bitte Zeitraum, Frist und Öffnungstag ausfüllen.';
  if (f.von > f.bis) return 'Der Zeitraum endet vor seinem Beginn.';
  if (f.von <= heute)
    return 'Der Zeitraum muss nach heute beginnen – sonst bleibt keine Zeit für eine Frist davor.';
  if (oeffnen < heute) return 'Der Öffnungstag liegt in der Vergangenheit.';
  if (f.frist >= f.von)
    return 'Die Frist muss vor dem Beginn des Zeitraums liegen – die Antworten sollen da sein, bevor er beginnt.';
  if (f.frist < oeffnen)
    return f.oeffnen === 'sofort'
      ? 'Die Frist liegt vor heute.'
      : 'Die Frist liegt vor dem Öffnungstag.';
  return null;
}

/**
 * **Die Vorbelegung** des Formulars aus dem gezeigten Zeitraum von Planen (`gezeigt`, `null` = nichts gezeigt): Beginn ist
 * der erste gezeigte Tag, frühestens morgen (eine Abfrage braucht eine Frist vor dem Beginn); Ende der letzte, mindestens der
 * Beginn. Frist: vier Wochen vor dem Beginn, aber nicht vor heute und höchstens der Tag davor.
 */
export function formularStart(
  gezeigt: { von: string; bis: string } | null,
  heute: string,
): AbfrageFormular {
  const morgen = plusTage(heute, 1);
  const von = gezeigt && gezeigt.von > morgen ? gezeigt.von : morgen;
  const bis = gezeigt && gezeigt.bis > von ? gezeigt.bis : gezeigt ? von : plusTage(heute, 60);
  const vierWochen = plusTage(von, -28);
  const davor = plusTage(von, -1);
  const frist = vierWochen < heute ? heute : vierWochen > davor ? davor : vierWochen;
  return { von, bis, frist, oeffnen: 'sofort', oeffnenTag: '' };
}

/** Die neue Abfrage – `id` und `zeit` kommen vom Aufrufer (Zufall und Uhr gehören nicht in die Regel). */
export function neueAbfrage(o: {
  id: string;
  formular: AbfrageFormular;
  heute: string;
  /** `termineFuerAbfrage(...)` */
  termine: number[];
  ich: { personId: number; name: string };
  zeit: string;
}): Abfrage {
  return {
    id: o.id,
    von: o.formular.von,
    bis: o.formular.bis,
    frist: o.formular.frist,
    oeffnen: oeffnenTagAus(o.formular, o.heute),
    termine: o.termine,
    gestartet: { personId: o.ich.personId, name: o.ich.name, zeit: o.zeit },
    beendet: null,
  };
}

/**
 * Der Inhalt mit der neuen Abfrage: der **eigene Plan und die Einrichtung bleiben unverändert**, die vorhandenen Abfragen bleiben, solange sie in
 * die Liste passen (`GRENZEN.abfragen`) – reicht der Platz nicht, gehen die ältesten **beendeten** zuerst (das Aufräumen, das
 * `abfragen.ts` der Oberfläche überlässt). Laufende werden nie entfernt.
 */
export function mitNeuerAbfrage(
  inhalt: AbfragenInhalt,
  neu: Abfrage,
  heute: string,
): AbfragenInhalt {
  const platz = GRENZEN.abfragen - 1;
  let ueberzaehlig = Math.max(0, inhalt.abfragen.length - platz);
  const behalten = inhalt.abfragen.filter((a) => {
    if (ueberzaehlig > 0 && abfrageZustand(a, heute) === 'beendet') {
      ueberzaehlig--;
      return false;
    }
    return true;
  });
  // Gespreizt statt Feld für Feld: Plan und Einrichtung (und was später dazukommt) bleiben, wie sie sind.
  return { ...inhalt, abfragen: [...behalten, neu] };
}

/** Der Inhalt, in dem die Abfrage `id` beendet ist (am Tag `heute`); alles andere – auch der Plan und die Einrichtung – bleibt. */
export function mitBeendeterAbfrage(
  inhalt: AbfragenInhalt,
  id: string,
  heute: string,
): AbfragenInhalt {
  return {
    ...inhalt,
    abfragen: inhalt.abfragen.map((a) => (a.id === id ? { ...a, beendet: heute } : a)),
  };
}

// ── Zahlen von heute ────────────────────────────────────────────────────────

/** Die Zahlen von heute aus `fehlendeInGruppe`. */
export interface Lage {
  /** Alle Mitglieder der Dienstgruppe. */
  mitglieder: number;
  /** Denen noch Antworten fehlen (und die nicht pausieren). */
  offen: number;
  /** Denen nur wegen der Pause nichts fehlt – sie bekommen keine Erinnerung. */
  pausiert: number;
  /** Alles beantwortet (oder eingeteilt). */
  fertig: number;
}

/** Die Zahlen – `null`, wenn die Gruppe gesperrt ist (Antworten oder Mitglieder nicht sichtbar, nicht geladen …). */
export function lageAus(e: GruppenErgebnis): Lage | null {
  if (e.art !== 'ok') return null;
  const offen = e.personen.length;
  const pausiert = e.pausiert.length;
  return {
    mitglieder: e.mitglieder.length,
    offen,
    pausiert,
    fertig: Math.max(0, e.mitglieder.length - offen - pausiert),
  };
}

const personen = (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`;

/** „5 fehlen noch Antworten (1 pausiert – keine Mail, 6 schon fertig)“ – der Satz hinter „heute“ in der Zeitleiste. */
function fehlenText(l: Lage): string {
  const teile = [
    ...(l.pausiert > 0 ? [`${l.pausiert} pausiert – keine Mail`] : []),
    ...(l.fertig > 0 ? [`${l.fertig} schon fertig`] : []),
  ];
  const wer =
    l.offen === 0
      ? 'Niemandem fehlen noch Antworten'
      : l.offen === 1
        ? '1 Person fehlt noch Antworten'
        : `${l.offen} fehlen noch Antworten`;
  return teile.length ? `${wer} (${teile.join(', ')}).` : `${wer}.`;
}

// ── Zeitleiste „Was passiert wann“ ──────────────────────────────────────────

export interface Zeitzeile {
  /** Stabil je Zeile. */
  schluessel: string;
  /** Der (erste) Tag der Zeile – danach wird geordnet. */
  tag: string;
  wann: string;
  /** Kleiner darunter („gegen 0:15“). */
  klein?: string;
  text: string;
  /** Der Tag liegt hinter uns – grau (nur im Stand). */
  vorbei: boolean;
}

/** „Di, 05.01.“, aber „heute“ und „morgen“, wo es stimmt. */
function wannText(tag: string, heute: string): string {
  if (tag === heute) return 'heute';
  if (tag === plusTage(heute, 1)) return 'morgen';
  return tagKurz(tag);
}

/**
 * **Die Zeitleiste** einer Abfrage, aus `erinnerungsTage` (die eine Stelle für die Tage). Zeilen, aufsteigend nach Tag:
 * - der Öffnen-Tag (die Abfrage erscheint auf der Startseite; liegt er auf einem Erinnerungstag, steht dort auch die Mail);
 * - jeder weitere Erinnerungstag – Erinnerungen **nach der Frist**, die in Folge liegen, stehen in einer Zeile;
 * - am Ende: der Zeitraum beginnt, die Abfrage endet.
 *
 * `heuteText` (nur beim Starten): der Satz mit den Zahlen von heute; er steht in der Zeile von heute – ist `oeffnen` heute,
 * ist es die Öffnen-Zeile („sofort“), sonst eine eigene Zeile davor. **`ab` = `heute`** zeigt nur, was noch kommt; im Stand
 * rechnet man ab dem Öffnen und lässt die vergangenen Tage grau stehen (`vorbei`).
 */
export function zeitleiste(o: {
  plan: Erinnerungsplan;
  abfrage: Abfrage;
  heute: string;
  /** Von welchem Tag an gerechnet wird: `heute` (Vorschau beim Starten) oder `abfrage.oeffnen` (Stand mit Vergangenem). */
  ab: string;
  heuteText?: string | null;
}): Zeitzeile[] {
  const { abfrage: a, heute } = o;
  const mailTage = erinnerungsTage(o.plan, a, o.ab);
  const vorbei = (tag: string) => tag < heute;
  const klein = (tag: string) => (tag > heute ? 'gegen 0:15' : undefined);

  const zeilen: Zeitzeile[] = [];
  const oeffnenSofort = a.oeffnen === heute;
  const oeffnenMail = mailTage.includes(a.oeffnen);

  // Heute – mit den Zahlen. Ist heute der Öffnen-Tag, ist es seine Zeile; sonst steht sie davor.
  const mitHeute = o.heuteText !== undefined && o.heuteText !== null;
  if (mitHeute && !oeffnenSofort)
    zeilen.push({
      schluessel: 'heute',
      tag: heute,
      wann: 'heute',
      text: o.heuteText as string,
      vorbei: false,
    });

  const oeffnenText = oeffnenSofort
    ? `Abfrage erscheint sofort auf der Startseite${oeffnenMail ? ' · erste Erinnerung an alle, die dann noch offen sind' : ''}.`
    : `Abfrage erscheint auf der Startseite${oeffnenMail ? ' · erste Erinnerung an alle, die dann noch offen sind' : ''}.`;
  zeilen.push({
    schluessel: `oeffnen-${a.oeffnen}`,
    tag: a.oeffnen,
    wann: wannText(a.oeffnen, heute),
    klein: oeffnenSofort ? 'sofort' : klein(a.oeffnen),
    text: mitHeute && oeffnenSofort ? `${oeffnenText} ${o.heuteText as string}` : oeffnenText,
    vorbei: vorbei(a.oeffnen),
  });

  const uebrige = mailTage.filter((t) => t !== a.oeffnen);
  for (let i = 0; i < uebrige.length; i++) {
    const tag = uebrige[i];
    if (tag > a.frist) {
      // Erinnerungen nach der Frist, die in Folge liegen, in eine Zeile.
      let ende = i;
      while (ende + 1 < uebrige.length && uebrige[ende + 1] === plusTage(uebrige[ende], 1)) ende++;
      const n = ende - i + 1;
      if (n > 1) {
        zeilen.push({
          schluessel: `nach-${tag}`,
          tag,
          wann: `${tagMonat(tag)}–${tagMonat(uebrige[ende])}`,
          klein: klein(uebrige[ende]),
          text: `Erinnerung an ${n} Tagen in Folge, jeweils an alle, die dann noch offen sind.`,
          vorbei: vorbei(uebrige[ende]),
        });
        i = ende;
        continue;
      }
    }
    const text =
      tag === a.frist
        ? 'Frist · Erinnerung an alle, die dann noch offen sind – danach steht die Abfrage rot da.'
        : 'Erinnerung an alle, die dann noch offen sind.';
    const vorFrist = tageBis(tag, a.frist);
    zeilen.push({
      schluessel: `mail-${tag}`,
      tag,
      wann: wannText(tag, heute),
      klein:
        [
          tag < a.frist ? `${vorFrist} ${vorFrist === 1 ? 'Tag' : 'Tage'} vor der Frist` : null,
          klein(tag),
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      text,
      vorbei: vorbei(tag),
    });
  }

  // Ist die Frist selbst kein Erinnerungstag, steht sie trotzdem als Marke da (ab da ist die Abfrage rot).
  if (!mailTage.includes(a.frist) && a.frist !== a.oeffnen && a.frist >= o.ab)
    zeilen.push({
      schluessel: `frist-${a.frist}`,
      tag: a.frist,
      wann: wannText(a.frist, heute),
      text: 'Frist – danach steht die Abfrage rot da.',
      vorbei: vorbei(a.frist),
    });

  zeilen.push({
    schluessel: `ende-${a.von}`,
    tag: a.von,
    wann: wannText(a.von, heute),
    text: 'Zeitraum beginnt: Abfrage endet.',
    vorbei: vorbei(a.von),
  });

  // Nach Tag ordnen – `sort` ist stabil, gleiche Tage behalten ihre Reihenfolge.
  return zeilen.sort((x, y) => x.tag.localeCompare(y.tag));
}

/** Der Satz „heute“ beim Starten, mit den Zahlen aus `lageAus`. */
export function heuteZeilenText(o: {
  lage: Lage | null;
  /** Grund, wenn die Gruppe gesperrt ist. */
  grund: string | null;
  sofort: boolean;
}): string {
  if (o.lage === null)
    return o.grund
      ? `Wer noch offen ist, lässt sich gerade nicht sagen: ${o.grund}.`
      : 'Wer noch offen ist, wird berechnet …';
  const l = o.lage;
  return o.sofort
    ? `Erscheint bei ${personen(l.mitglieder)}. ${fehlenText(l)}`
    : `Heute: ${personen(l.mitglieder)} im Team. ${fehlenText(l)}`;
}

// ── Stand ───────────────────────────────────────────────────────────────────

export interface StandPerson {
  personId: number;
  name: string;
}

/** Die drei Abschnitte des Stands. */
export interface StandAbschnitte {
  /** Mit der Zahl ihrer offenen Termine (`von`: alle Termine der Abfrage). */
  offen: (StandPerson & { offen: number; von: number })[];
  fertig: StandPerson[];
  /** `bis`: Ende der Pause, wenn es eines gibt (`YYYY-MM-DD`). */
  pausiert: (StandPerson & { bis: string | null })[];
}

/**
 * Wer offen, fertig oder pausiert ist – `null`, wenn die Gruppe gesperrt ist. Die Zuordnung kommt aus `fehlendeInGruppe`
 * (Fehlende, Pausierte, Mitglieder); „fertig“ ist der Rest. `liste` ist die Personenliste der Dienstgruppe (für „Pause bis“).
 */
export function standAbschnitte(
  e: GruppenErgebnis,
  abfrage: Pick<Abfrage, 'termine'>,
  liste?: Personenliste | null,
): StandAbschnitte | null {
  if (e.art !== 'ok') return null;
  const offen = new Set(e.personen.map((p) => p.personId));
  const pausiert = new Set(e.pausiert);
  return {
    offen: e.personen.map((p) => ({
      personId: p.personId,
      name: p.name,
      offen: p.termine.length,
      von: abfrage.termine.length,
    })),
    fertig: e.mitglieder.filter((m) => !offen.has(m.personId) && !pausiert.has(m.personId)),
    pausiert: e.mitglieder
      .filter((m) => pausiert.has(m.personId))
      .map((m) => ({
        ...m,
        // Die Pause, die gerade gilt – „bis“ fehlt bei einer Pause ohne Ende.
        bis: liste?.pause[String(m.personId)]?.bis ?? null,
      })),
  };
}

// ── Etikett ─────────────────────────────────────────────────────────────────

/** Was das Etikett einer Abfrage sagt: blau bis zur Frist, rot danach (R9). `null`: beendet, kein Etikett. */
export function abfrageEtikett(
  a: Abfrage,
  heute: string,
): { ton: 'neutral' | 'blau' | 'rot'; text: string } | null {
  const z: AbfrageZustand = abfrageZustand(a, heute);
  switch (z) {
    case 'geplant':
      return { ton: 'neutral', text: `öffnet ${tagKurz(a.oeffnen)}` };
    case 'offen':
      return { ton: 'blau', text: `bis ${tagKurz(a.frist)}` };
    case 'fristVorbei':
      return { ton: 'rot', text: `Frist war ${tagKurz(a.frist)}` };
    case 'beendet':
      return null;
  }
}
