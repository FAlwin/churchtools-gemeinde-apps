/**
 * **Das Termin-Blatt** (Bauplan E8-1, Entwurf `e8-teilen.html` Version 5, abgenommen 05.11.2026) – was aufs geteilte
 * PDF eines Termins kommt: oben (oder unten) die Dienste je Gruppe, darunter der Ablauf mit Beginn, Abschnitten und Ende.
 * Hier steht nur, **was** auf dem Blatt steht; gezeichnet wird in `ui/teilen/terminBlattPdf.ts`. Dienstplaner und
 * Musik-App bauen dasselbe Blatt aus denselben Ablauf-Zeilen (`ablaufZeile.ts`) – Uhrzeit, Vorlauf, Ende und Zuständige
 * werden nicht ein zweites Mal gerechnet.
 *
 * Gegenüber dem ChurchTools-Druck (Alwin, 05.11.2026: „nicht so schön“): keine leeren Info-Spalten, ganze Teams nur als
 * Dienst-Name (die Namen stehen einmal oben), Abschnitte mit ihrer Dauer, Beginn und Ende hervorgehoben.
 */
import type { InfoGruppe, ResponsibleEntry } from '../types/index';
import { ablaufEnde, beginnStelle, itemTitleParts, type AblaufZeile } from './ablaufZeile';
import { tagLang } from './datum';

// ── Eingang ──────────────────────────────────────────────────────────────────

export interface BlattPerson {
  name: string;
  /** Angefragt, noch nicht zugesagt. */
  angefragt: boolean;
}

export interface BlattDienst {
  name: string;
  personen: BlattPerson[];
  /** Freie Plätze. */
  frei: number;
}

export interface BlattGruppe {
  /** `null` = Dienste ohne bekannte Dienstgruppe („Weitere Dienste“). */
  id: number | null;
  name: string;
  dienste: BlattDienst[];
}

/** Was der Aufrufer über den Termin weiß. */
export interface BlattQuelle {
  titel: string;
  /** `YYYY-MM-DD` in der Gemeinde. */
  tag: string;
  /** Beginn des Termins („10:00“). */
  beginn: string;
  gemeinde: string | null;
  /** „Dienstplaner“ oder „Musik-App“ – unten auf jeder Seite. */
  app: string;
  /** Stand, z. B. „Stand 05.11.2026, 09:25“. */
  stand: string;
  /** Die Ablauf-Zeilen – `null`, wenn der Termin keinen Ablauf hat. */
  zeilen: readonly AblaufZeile[] | null;
  /** Die Dienste des Termins je Gruppe – nur Gesendetes (keine Entwürfe). */
  dienste: readonly BlattGruppe[];
  /** Die Dienstgruppen, deren Infos man sieht (`infoGruppen`) – in der Reihenfolge der Gemeinde. */
  infoGruppen: readonly InfoGruppe[];
  /** Die Gruppen unter „Spalten“ in der Ansicht – Vorgabe für die Infos, solange im Fenster nichts gewählt ist. */
  ansichtInfos: readonly number[];
}

/** Die Wahl im Fenster „Termin teilen“ – das Gerät merkt sie sich (`ui/teilen/terminBlattWahl.ts`). */
export interface BlattEinstellungen {
  dienste: {
    an: boolean;
    /** Abgewählte Gruppen (`-1` = ohne Gruppe) – so sind neue Gruppen von selbst dabei. */
    ohne: number[];
    frei: boolean;
    angefragt: boolean;
    /** Unter dem Ablauf statt darüber. */
    unten: boolean;
  };
  ablauf: {
    an: boolean;
    uhrzeit: boolean;
    dauer: boolean;
    zustaendig: boolean;
    /** Zuständige klein unter dem Eintrag statt in einer eigenen Spalte (Vorgabe: Spalte, Alwin 05.11.2026). */
    zustaendigUnter: boolean;
    notiz: boolean;
    tonart: boolean;
    tempo: boolean;
    arrangement: boolean;
    vorlauf: boolean;
    weggelassen: boolean;
  };
  infos: {
    an: boolean;
    /** Gewählte Gruppen – `null` = wie unter „Spalten“ in der Ansicht. Gilt nur fürs Teilen. */
    gruppen: number[] | null;
    /** Klein unter dem Eintrag statt als Spalten. */
    unter: boolean;
  };
  quer: boolean;
}

export const BLATT_VORGABE: BlattEinstellungen = {
  dienste: { an: true, ohne: [], frei: true, angefragt: true, unten: false },
  ablauf: {
    an: true,
    uhrzeit: true,
    dauer: true,
    zustaendig: true,
    zustaendigUnter: false,
    notiz: false,
    tonart: true,
    tempo: false,
    arrangement: false,
    vorlauf: true,
    weggelassen: false,
  },
  infos: { an: true, gruppen: null, unter: false },
  quer: false,
};

/** Schlüssel einer Dienstgruppe für `dienste.ohne`. */
export const gruppenSchluessel = (g: Pick<BlattGruppe, 'id'>) => g.id ?? -1;

// ── Ausgang ──────────────────────────────────────────────────────────────────

/** Eine Farbe als Rot, Grün, Blau (0–255). */
export type Rgb = readonly [number, number, number];

/** Ein Stück Text mit seiner Auszeichnung. `schild` = kleines Schild (Tonart), `rot` = frei/offen. */
export interface Lauf {
  text: string;
  stil?: 'fett' | 'grau' | 'rot' | 'schild' | 'kleinFett';
  /**
   * Auszeichnung wie im Editor des Protokolls (S6-3a) – Termin- und Plan-Blatt brauchen sie nicht. `farbe` geht vor der
   * Farbe des `stil`; `link` macht den Lauf im PDF anklickbar (nur sichere Adressen, geprüft beim Bauen des Blatts).
   */
  kursiv?: boolean;
  unterstrichen?: boolean;
  durchgestrichen?: boolean;
  /** Code im Text (`code`): grau hinterlegt. */
  code?: boolean;
  farbe?: Rgb;
  hintergrund?: Rgb;
  link?: string;
}
/** Ein Absatz – Läufe nebeneinander, umbrochen am Wortende. */
export type Absatz = Lauf[];
/** Eine Zelle – Absätze untereinander. `klein` = kleinere Schrift (Zuständige, Notiz, Infos unter dem Eintrag). */
export interface Zelle {
  absaetze: { laeufe: Absatz; klein?: boolean }[];
}

export type SpaltenArt = 'zeit' | 'dauer' | 'eintrag' | 'zustaendig' | 'info';

export type BlattZeile =
  | { art: 'abschnitt'; titel: string; dauer: string | null; vorlauf: boolean }
  | { art: 'beginn'; zeit: string }
  | { art: 'ende'; zeit: string; dauer: string }
  | { art: 'eintrag'; zellen: Zelle[]; vorlauf: boolean; weggelassen: boolean };

export interface TerminBlatt {
  titel: string;
  /** „Sonntag, 1. November 2026 · 10:00 – 11:35 Uhr“ */
  untertitel: string;
  gemeinde: string | null;
  app: string;
  stand: string;
  quer: boolean;
  dienste: BlattGruppe[] | null;
  diensteUnten: boolean;
  ablauf: { kopf: string[]; arten: SpaltenArt[]; zeilen: BlattZeile[] } | null;
  /** „Gottesdienst 01.11.2026“ – ohne Endung. */
  dateiname: string;
}

// ── Regeln ───────────────────────────────────────────────────────────────────

/** 95 → „1 Std. 35 Min“, 60 → „1 Std.“, 14 → „14 Min“. */
export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min`;
}

/** Minuten zwischen zwei Uhrzeiten („10:00“ → „11:35“ = 95), über Mitternacht weiter. `null` ohne gültige Zeiten. */
export function minutenZwischen(von: string, bis: string): number | null {
  const m = (z: string) => {
    const t = /^(\d{1,2}):(\d{2})$/.exec(z);
    return t ? Number(t[1]) * 60 + Number(t[2]) : null;
  };
  const a = m(von);
  const b = m(bis);
  if (a === null || b === null) return null;
  return (b - a + 24 * 60) % (24 * 60);
}

/**
 * **Teams kurz:** Sind mehrere Personen über denselben Dienst zuständig („Gesang“ mit fünf Sängerinnen), steht nur der
 * Dienst da – die Namen stehen einmal oben bei den Diensten. Einzelne Personen bleiben mit Namen, offene Plätze rot.
 */
export function zustaendigeKurz(eintraege: readonly ResponsibleEntry[]): Lauf[] {
  const anzahl = new Map<string, number>();
  for (const e of eintraege) {
    if (!e.open && e.dienst) anzahl.set(e.dienst, (anzahl.get(e.dienst) ?? 0) + 1);
  }
  const teile: Lauf[] = [];
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    if (e.open) teile.push({ text: `${e.label} – frei`, stil: 'rot' });
    else if (e.dienst && (anzahl.get(e.dienst) ?? 0) > 1) {
      if (gesehen.has(e.dienst)) continue;
      gesehen.add(e.dienst);
      teile.push({ text: e.dienst, stil: 'grau' });
    } else teile.push({ text: e.label });
  }
  // Kommas dazwischen – im Stil des Vorgängers, damit ein Komma nach Rot nicht schwarz absteht.
  return teile.flatMap((t, i) => (i === 0 ? [t] : [{ text: ', ', stil: teile[i - 1].stil }, t]));
}

const infoText = (z: Pick<AblaufZeile, 'infos'>, gruppe: number) =>
  z.infos?.find((i) => i.gruppeId === gruppe)?.text ?? '';

/** Die Info-Gruppen aufs Blatt: gewählt (oder wie in der Ansicht), nur mit Text an diesem Termin – keine leeren Spalten. */
export function blattInfoGruppen(
  q: Pick<BlattQuelle, 'infoGruppen' | 'ansichtInfos'>,
  e: BlattEinstellungen,
  zeilen: readonly AblaufZeile[],
): InfoGruppe[] {
  if (!e.infos.an) return [];
  const ids = e.infos.gruppen ?? q.ansichtInfos;
  return q.infoGruppen.filter((g) => ids.includes(g.id) && zeilen.some((z) => infoText(z, g.id)));
}

/** Die Dienste aufs Blatt – abgewählte Gruppen weg, ohne Freie/Angefragt-Zusatz nach Wahl, leere Dienste weg. */
export function blattDienste(
  gruppen: readonly BlattGruppe[],
  e: BlattEinstellungen['dienste'],
): BlattGruppe[] {
  return gruppen
    .filter((g) => !e.ohne.includes(gruppenSchluessel(g)))
    .map((g) => ({
      ...g,
      dienste: g.dienste
        .map((d) => ({
          ...d,
          personen: d.personen.map((p) => ({ ...p, angefragt: e.angefragt && p.angefragt })),
          frei: e.frei ? d.frei : 0,
        }))
        .filter((d) => d.personen.length > 0 || d.frei > 0),
    }))
    .filter((g) => g.dienste.length > 0);
}

function eintragZelle(
  z: AblaufZeile,
  e: BlattEinstellungen['ablauf'],
  unterInfos: readonly InfoGruppe[],
): Zelle {
  const { title, songName } = itemTitleParts(z);
  const erste: Absatz = songName
    ? [
        { text: `${title} · `, stil: 'grau' },
        { text: songName, stil: 'fett' },
      ]
    : [{ text: title, stil: 'fett' }];
  const schild = [
    e.tonart && z.song?.originalKey ? z.song.originalKey : null,
    e.tempo && z.song?.bpm ? `${z.song.bpm} bpm` : null,
  ].filter(Boolean);
  if (schild.length > 0) erste.push({ text: schild.join(' · '), stil: 'schild' });
  if (z.weggelassen) erste.push({ text: ' (weggelassen)', stil: 'grau' });
  const absaetze: Zelle['absaetze'] = [{ laeufe: erste }];
  if (e.arrangement && z.song?.arrangement)
    absaetze.push({
      laeufe: [{ text: `Arrangement ${z.song.arrangement}`, stil: 'grau' }],
      klein: true,
    });
  if (e.zustaendig && e.zustaendigUnter && z.responsible.length > 0)
    absaetze.push({ laeufe: zustaendigeKurz(z.responsible), klein: true });
  if (e.notiz && z.note.trim())
    absaetze.push({ laeufe: [{ text: z.note.trim(), stil: 'grau' }], klein: true });
  for (const g of unterInfos) {
    const t = infoText(z, g.id);
    if (t)
      absaetze.push({
        laeufe: [{ text: `${g.name}: `, stil: 'kleinFett' }, { text: t }],
        klein: true,
      });
  }
  return { absaetze };
}

const einfach = (text: string, stil?: Lauf['stil']): Zelle => ({
  absaetze: [{ laeufe: text ? [{ text, ...(stil ? { stil } : {}) }] : [] }],
});

/** **Das Blatt bauen** – alles, was gezeichnet wird, steht danach fest. */
export function terminBlatt(q: BlattQuelle, e: BlattEinstellungen): TerminBlatt {
  const alle = (q.zeilen ?? []).filter((z) => !z.removed);
  const ende = q.zeilen ? ablaufEnde(alle) : null;
  const datum = `${tagLang(q.tag)} ${q.tag.slice(0, 4)}`;
  const untertitel = `${datum} · ${q.beginn}${ende ? ` – ${ende}` : ''} Uhr`;
  const [j, m, t] = [q.tag.slice(0, 4), q.tag.slice(5, 7), q.tag.slice(8, 10)];

  let ablauf: TerminBlatt['ablauf'] = null;
  if (q.zeilen && e.ablauf.an && alle.length > 0) {
    const a = e.ablauf;
    const gezeigt = alle.filter(
      (z) => (a.vorlauf || !z.vorBeginn) && (a.weggelassen || !z.weggelassen),
    );
    const infos = blattInfoGruppen(q, e, gezeigt);
    const spalten = e.infos.unter ? [] : infos;
    const arten: SpaltenArt[] = [
      ...(a.uhrzeit ? (['zeit'] as const) : []),
      ...(a.dauer ? (['dauer'] as const) : []),
      'eintrag',
      ...(a.zustaendig && !a.zustaendigUnter ? (['zustaendig'] as const) : []),
      ...spalten.map(() => 'info' as const),
    ];
    const kopf = arten.map((art, i) =>
      art === 'zeit'
        ? 'Zeit'
        : art === 'dauer'
          ? 'Dauer'
          : art === 'eintrag'
            ? 'Eintrag'
            : art === 'zustaendig'
              ? 'Zuständig'
              : spalten[i - arten.indexOf('info')].name,
    );
    const zeilen: BlattZeile[] = [];
    // „Beginn“ vor dem ersten Eintrag nach dem Vorlauf – ohne gezeigten Vorlauf ganz oben (Alwin 05.11.2026: deutlich).
    const stelle = beginnStelle(gezeigt);
    const beginnBei = stelle < 0 ? 0 : stelle;
    gezeigt.forEach((z, i) => {
      if (i === beginnBei) zeilen.push({ art: 'beginn', zeit: q.beginn });
      if (z.isHeader) {
        let summe = 0;
        for (const n of gezeigt.slice(i + 1)) {
          if (n.isHeader) break;
          if (!n.weggelassen) summe += n.durationMin ?? 0;
        }
        zeilen.push({
          art: 'abschnitt',
          titel: z.title,
          dauer: summe > 0 ? `ca. ${dauerText(summe)}` : null,
          vorlauf: z.vorBeginn,
        });
        return;
      }
      const zellen = arten.map((art, k): Zelle => {
        if (art === 'zeit') return einfach(z.weggelassen ? '' : (z.time ?? ''));
        if (art === 'dauer') return einfach(z.durationMin ? `${z.durationMin} Min` : '', 'grau');
        if (art === 'eintrag') return eintragZelle(z, a, e.infos.unter ? infos : []);
        if (art === 'zustaendig') return { absaetze: [{ laeufe: zustaendigeKurz(z.responsible) }] };
        return einfach(infoText(z, spalten[k - arten.indexOf('info')].id), 'grau');
      });
      zeilen.push({ art: 'eintrag', zellen, vorlauf: z.vorBeginn, weggelassen: !!z.weggelassen });
    });
    if (beginnBei >= gezeigt.length) zeilen.push({ art: 'beginn', zeit: q.beginn });
    if (ende) {
      const haupt = minutenZwischen(q.beginn, ende);
      const erste = gezeigt.find((z) => z.time)?.time;
      const gesamt =
        erste && a.vorlauf && gezeigt.some((z) => z.vorBeginn)
          ? minutenZwischen(erste, ende)
          : null;
      zeilen.push({
        art: 'ende',
        zeit: ende,
        dauer: [
          haupt !== null ? `Dauer ${dauerText(haupt)}` : null,
          gesamt !== null && gesamt !== haupt ? `mit Vorlauf ${dauerText(gesamt)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
    ablauf = { kopf, arten, zeilen };
  }

  return {
    titel: q.titel,
    untertitel,
    gemeinde: q.gemeinde,
    app: q.app,
    stand: q.stand,
    quer: e.quer,
    dienste: e.dienste.an ? blattDienste(q.dienste, e.dienste) : null,
    diensteUnten: e.dienste.unten,
    ablauf,
    dateiname: `${q.titel} ${t}.${m}.${j}`,
  };
}
