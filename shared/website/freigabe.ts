/**
 * **Freigabe: was ist online, was wartet, und wie kommt etwas nach „Veröffentlicht“** (Bauplan Website W3b-2).
 *
 * Drei Dinge, alle ohne Oberfläche, damit die Tests sie gegen die Erzeuger prüfen:
 *
 * 1. **Der Vergleich** „Entwurf ↔ online“ (`onlineVergleich`): je Einheit die Prüfsumme (`stand`) aus „Entwürfe“ gegen die aus
 *    „Veröffentlicht“ – nie veröffentlicht · online, unverändert · geändert seit der Freigabe · online, aber Entwurf gelöscht.
 *    Die Prüfsumme ist die des Texts (`teileBauen`), nicht der Zeit: Wer eine Seite speichert, ohne etwas zu ändern, macht sie
 *    nicht „geändert“.
 * 2. **Die Liste** des Reiters „Freigaben“ (`freigabeListe`) samt Zähler (`freigabeZaehler`): Leitung sieht alles, was vom
 *    Online-Stand abweicht, Redakteure nur ihre eigenen eingereichten und zurückgegebenen Seiten.
 * 3. **Das Schreiben** (`gibFrei`, `seiteEntfernen`, `alleFreigeben`): **Freigeben = die Einheit aus „Entwürfe“ unverändert
 *    nach „Veröffentlicht“ schreiben** – mit demselben Speicher-Anschluss wie das Speichern der Entwürfe
 *    (`einheitSpeichern`: neue Teile → nachlesen → Kopf → nachlesen → alte Teile weg). Danach wird **nachgelesen, dass dort
 *    derselbe `stand` steht – erst dann wird der Status entfernt**, und nur, wenn der Entwurf sich währenddessen nicht
 *    geändert hat (E-W24: Redakteure dürfen nach dem Einreichen weiterarbeiten; was nach dem Lesen kam, wurde nicht geprüft und
 *    bleibt „eingereicht“).
 *
 * **Fehler einzeln** (vorübergehend ist nicht ungültig): Netz, 5xx und Bremse werfen – nichts wird als „online“ gemeldet, der
 * Status bleibt, ein neuer Versuch ist möglich. Scheitert es mitten im Schreiben (Teile da, Kopf nicht), gilt der alte
 * Online-Stand weiter; der nächste Versuch nutzt oder räumt die liegengebliebenen Teile. **Kein Recht** (`401`/`403`): eine
 * klare Meldung statt „abgemeldet“ – dort darf nur die Leitung schreiben.
 *
 * Die Regeln, WER das darf (`darfFreigeben`), stehen in `zugang.ts`; geschützt sind die Daten allein durch die Rechte an den
 * Kategorien in ChurchTools.
 *
 * **Bereiche (W3b-4b, E-W31):** Jede Seite gehört der Website oder einer Untergruppe (`Seite.bereich`); jeder Bereich hat seine
 * eigene Veröffentlicht-Kategorie (`veroeffentlicht-g<Gruppe>`). Darum:
 * - **Online-Stand je Bereich** (`onlineSicht`): Der Stand einer Seite kommt aus der Kategorie IHRES Bereichs. Liegt sie (auch)
 *   in einer anderen, ist sie „geändert“ – sie muss verschoben werden. Gelesen werden alle Kategorien, die man lesen darf; eine
 *   ohne Leserecht ist kein Fehler.
 * - **Freigeben** schreibt in die Kategorie des Bereichs. **Verschieben** (der Bereich wurde geändert): neue Kategorie schreiben
 *   → nachlesen → **erst dann** aus der alten löschen (`einheitLoeschen` liest selbst nach). Scheitert das Löschen der alten,
 *   ist die Seite in der neuen online – das Ergebnis sagt, wo sie zusätzlich noch steht (`bleibtIn`), statt es zu verschweigen
 *   oder die Freigabe als gescheitert zu melden. Ein `201` ist kein Beleg.
 * - **Löschen/Offline nehmen** (`seiteEntfernen`) nimmt die Seite aus **jeder** Veröffentlicht-Kategorie, in der sie steht und
 *   die man schreiben darf – erst dann den Entwurf.
 * - Liste und Zähler: Die Leitung einer Untergruppe sieht und bearbeitet nur Seiten ihres Bereichs, Menü und Einstellungen nur
 *   die Leitung der Website.
 */
import { werteLesen, type ModulPort } from '../ct/modulDaten';
import type { UntergruppenKategorie } from './einrichten';
import { pruefsumme } from '../ct/teile';
import {
  einstellungenAusText,
  menueAusText,
  seiteAlsText,
  seiteAusText,
  type Menue,
  type Seite,
} from './modell';
import {
  EINSTELLUNGEN_ID,
  MENUE_ID,
  einheitLoeschen,
  einheitSpeichern,
  einheitText,
  websiteAusWerten,
  type EinheitStand,
  type Einheit,
  type WebsiteStand,
} from './speicher';
import { statusEntfernen, type SeitenStatus } from './status';
import { bereichVon, darfFreigeben, leitetWebsite, siehtBereich, type Zugang } from './zugang';

// ── 1. Der Vergleich ─────────────────────────────────────────────────────────────────────────────────────────────

/** Nie veröffentlicht · online, unverändert · geändert seit der Freigabe · online, aber der Entwurf ist gelöscht. */
export type OnlineLage = 'nie' | 'gleich' | 'geaendert' | 'nurOnline';

export interface Vergleich {
  einheit: Einheit;
  id: string;
  lage: OnlineLage;
  entwurf: EinheitStand | null;
  online: EinheitStand | null;
}

const schluessel = (einheit: Einheit, id: string) => `${einheit}:${id}`;

/**
 * **Der Vergleich beider Kategorien** – je Einheit eine Zeile. Gleich heißt: dieselbe Prüfsumme. Die Reihenfolge ist die der
 * Entwürfe (so, wie sie angelegt wurden), danach die, die nur noch online sind.
 */
export function onlineVergleich(
  entwuerfe: readonly EinheitStand[],
  online: readonly EinheitStand[],
  /** Seiten, die (auch) in der Kategorie eines anderen Bereichs liegen (`onlineSicht`) – sie gelten als „geändert“. */
  falsch: ReadonlySet<string> = new Set(),
): Vergleich[] {
  const onlineNach = new Map(online.map((o) => [schluessel(o.einheit, o.id), o]));
  const aus: Vergleich[] = [];
  const gesehen = new Set<string>();
  for (const e of entwuerfe) {
    const s = schluessel(e.einheit, e.id);
    gesehen.add(s);
    const o = onlineNach.get(s) ?? null;
    aus.push({
      einheit: e.einheit,
      id: e.id,
      entwurf: e,
      online: o,
      lage:
        e.einheit === 'seite' && falsch.has(e.id)
          ? 'geaendert'
          : !o
            ? 'nie'
            : o.stand === e.stand
              ? 'gleich'
              : 'geaendert',
    });
  }
  for (const o of online)
    if (!gesehen.has(schluessel(o.einheit, o.id)))
      aus.push({ einheit: o.einheit, id: o.id, entwurf: null, online: o, lage: 'nurOnline' });
  return aus;
}

/**
 * Die Prüfsumme einer Seite, wie sie als `stand` gespeichert würde – **dieselbe Rechnung wie beim Speichern**
 * (`einheitSpeichern` → `teileBauen` → `pruefsumme(text)`). Die Seitenliste kennt die Seite oft schon neuer als den gelesenen
 * Kopf (sie übernimmt gespeicherte Änderungen, ohne neu zu lesen) – so lässt sich die Lage trotzdem richtig bestimmen.
 */
export function seitenStand(seite: Seite): string {
  return pruefsumme(seiteAlsText(seite));
}

/**
 * **Wo steht diese Seite gegenüber „Veröffentlicht“?** `null`, wenn der Online-Stand unbekannt ist (nicht lesbar) – dann zeigt die
 * Oberfläche nichts Falsches an.
 */
export function seitenLage(
  seite: Seite,
  online: readonly EinheitStand[] | null,
  /** Liegt die Seite (auch) im falschen Bereich (`onlineSicht`), ist sie „geändert“ – sie muss verschoben werden. */
  falsch?: ReadonlySet<string>,
): Exclude<OnlineLage, 'nurOnline'> | null {
  if (!online) return null;
  if (falsch?.has(seite.id)) return 'geaendert';
  const o = online.find((x) => x.einheit === 'seite' && x.id === seite.id);
  if (!o) return 'nie';
  return o.stand === seitenStand(seite) ? 'gleich' : 'geaendert';
}

/** Eine gelesene Veröffentlicht-Kategorie (W3b-4b): ihr Bereich (`null` = Website), ihre ID und ihr Inhalt. */
export interface OnlineKategorie {
  bereich: number | null;
  kategorie: number;
  stand: WebsiteStand;
}

/** Der Online-Stand über alle Bereiche hinweg, wie die Oberfläche ihn vergleicht (`onlineSicht`). */
export interface OnlineSicht {
  /**
   * Menü und Einstellungen aus der Kategorie der Website; je Seite der Stand aus der Kategorie **ihres** Bereichs (liegt sie dort
   * nicht, der erste Fundort). Seiten ohne Entwurf mit ihrem ersten Fundort.
   */
  stand: WebsiteStand;
  /** Seiten, die (auch) in der Kategorie eines anderen Bereichs liegen – gelten als „geändert“, Freigeben verschiebt sie. */
  falsch: ReadonlySet<string>;
  /** In welchen Bereichen jede Seite online liegt (`null` = Website). */
  liegtIn: ReadonlyMap<string, readonly (number | null)[]>;
}

/**
 * **Der Online-Stand je Bereich** (W3b-4b): aus allen gelesenen Veröffentlicht-Kategorien und dem Entwurf (der sagt, welchem
 * Bereich eine Seite gehört). Fehlt die Kategorie der Website in der Liste, gilt sie als leer.
 */
export function onlineSicht(
  entwurf: WebsiteStand,
  online: readonly OnlineKategorie[],
): OnlineSicht {
  const website = online.find((o) => o.bereich === null)?.stand ?? websiteAusWerten([]);
  const bereichNach = new Map(entwurf.seiten.map((s) => [s.id, bereichVon(s)]));
  const fundorte = new Map<
    string,
    { bereich: number | null; stand: EinheitStand; seite: Seite | undefined }[]
  >();
  for (const o of online)
    for (const st of o.stand.staende) {
      if (st.einheit !== 'seite') continue;
      const orte = fundorte.get(st.id) ?? [];
      orte.push({
        bereich: o.bereich,
        stand: st,
        seite: o.stand.seiten.find((x) => x.id === st.id),
      });
      fundorte.set(st.id, orte);
    }
  const staende = website.staende.filter((st) => st.einheit !== 'seite');
  const seiten: Seite[] = [];
  const falsch = new Set<string>();
  const liegtIn = new Map<string, (number | null)[]>();
  for (const [id, orte] of fundorte) {
    const ziel = bereichNach.has(id) ? bereichNach.get(id)! : undefined;
    const passend = orte.find((o) => o.bereich === ziel) ?? orte[0];
    if (ziel !== undefined && orte.some((o) => o.bereich !== ziel)) falsch.add(id);
    staende.push(passend.stand);
    if (passend.seite) seiten.push(passend.seite);
    liegtIn.set(
      id,
      orte.map((o) => o.bereich),
    );
  }
  return { stand: { ...website, seiten, staende }, falsch, liegtIn };
}

/** Nur die Kategorie der Website – so lasen Liste und Vergleich bis W3b-4a (und lesen es, wo es keine Untergruppen gibt). */
export const nurWebsite = (entwurf: WebsiteStand, online: WebsiteStand): OnlineSicht =>
  onlineSicht(entwurf, [{ bereich: null, kategorie: 0, stand: online }]);

// ── 2. Die Liste ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Wie ein Eintrag im Reiter „Freigaben“ gruppiert und sortiert wird – in dieser Reihenfolge. */
export const EINTRAG_ARTEN = [
  'eingereicht',
  'loeschenAngefragt',
  'zurueck',
  'geaendert',
  'neu',
  'menue',
  'einstellungen',
  'nurOnline',
] as const;
export type EintragArt = (typeof EINTRAG_ARTEN)[number];

export interface Eintrag {
  schluessel: string;
  einheit: Einheit;
  id: string;
  /** Seitentitel, „Menü“ oder „Einstellungen und Aussehen“. */
  titel: string;
  art: EintragArt;
  lage: OnlineLage;
  /** Status der Seite (nur Seiten). */
  status: SeitenStatus | null;
  /** Lässt sich der Entwurf lesen? Sonst gibt es nichts zu zeigen und nichts freizugeben. */
  lesbar: boolean;
  /** Ein Hinweis, der vor dem Freigeben gelesen werden sollte (Menü: verweist auf Seiten, die noch nicht online sind). */
  warnung?: string;
  /**
   * Der Bereich (W3b-4b): `null` = Website (auch Menü und Einstellungen), sonst die Untergruppe. Bei „nur noch online“ der Bereich,
   * in dem die Seite liegt. Bestimmt, ob die Person hier freigeben darf (`darfFreigeben`).
   */
  bereich: number | null;
  /** Die Seite steht online (auch) im Bereich einer anderen Kategorie – Freigeben verschiebt sie (`OnlineSicht.falsch`). */
  verschieben?: true;
}

/** Titel der festen Einheiten. */
export const MENUE_TITEL = 'Menü';
export const EINSTELLUNGEN_TITEL = 'Einstellungen und Aussehen';

/**
 * **Das Menü verweist auf Seiten, die noch nicht online sind** – ihre Titel. Wer das Menü veröffentlicht, ohne dass die Seite
 * online ist, zeigt Besuchern einen Menüpunkt ins Leere. Kein Hindernis (die Leitung entscheidet), aber ein Hinweis.
 */
export function menueOhneOnlineSeiten(
  menue: Menue | null,
  seiten: readonly Seite[],
  online: readonly EinheitStand[],
): string[] {
  if (!menue) return [];
  const imNetz = new Set(online.filter((o) => o.einheit === 'seite').map((o) => o.id));
  return menue.eintraege.flatMap((e) =>
    e.ziel.art === 'seite' && !imNetz.has(e.ziel.seiteId)
      ? [seiten.find((s) => s.id === (e.ziel as { seiteId: string }).seiteId)?.titel ?? e.titel]
      : [],
  );
}

function artDerSeite(status: SeitenStatus | null, lage: OnlineLage): EintragArt | null {
  if (status) return status.zustand;
  if (lage === 'nie') return 'neu';
  if (lage === 'geaendert') return 'geaendert';
  return null;
}

/**
 * **Alles, was im Reiter „Freigaben“ steht** – für diese Person, schon sortiert:
 *
 * - **Leitung und Admin:** alles, was vom Online-Stand abweicht (Seiten, Menü, Einstellungen), dazu jede Seite mit Status –
 *   eingereichte zuerst (die älteste oben), dann „Löschen angefragt“, dann zurückgegebene und eigene Änderungen, das Menü, die
 *   Einstellungen, zuletzt „online, aber Entwurf gelöscht“.
 * - **Redakteur:** nur **ihre eigenen** eingereichten, zurückgegebenen und zum Löschen angefragten Seiten – zum Ansehen.
 *   Menü und Einstellungen ändert nur die Leitung (E-W22), sie stehen hier nie.
 *
 * Die Reihenfolge der Arten steht in `EINTRAG_ARTEN`. **Bereiche (W3b-4b, E-W31):** Wer nur Untergruppen sieht, bekommt nur
 * Seiten dieser Bereiche; ob eine Seite wie von der Leitung oder wie vom Redakteur gezeigt wird, entscheidet `darfFreigeben` **je
 * Seite** (die Leitung einer Untergruppe ist für Seiten der Website nur Redakteurin). Menü und Einstellungen stehen nur bei der
 * Leitung der Website.
 */
export function freigabeListe(
  entwurf: WebsiteStand,
  sicht: OnlineSicht,
  zugang: Zugang,
  ichId: number,
): Eintrag[] {
  const online = sicht.stand;
  const lagen = onlineVergleich(entwurf.staende, online.staende, sicht.falsch);
  const titelVon = (id: string, aus: WebsiteStand) =>
    aus.seiten.find((s) => s.id === id)?.titel ?? `Seite „${id}“`;
  const liste: Eintrag[] = [];

  for (const v of lagen) {
    const s = schluessel(v.einheit, v.id);
    if (v.einheit === 'seite') {
      if (v.lage === 'nurOnline') {
        const bereich = sicht.liegtIn.get(v.id)?.[0] ?? null;
        if (siehtBereich(zugang, bereich) && darfFreigeben(zugang, bereich))
          liste.push({
            schluessel: s,
            einheit: 'seite',
            id: v.id,
            titel: titelVon(v.id, online),
            art: 'nurOnline',
            lage: v.lage,
            status: null,
            lesbar: true,
            bereich,
          });
        continue;
      }
      const lesbarEntwurf = v.entwurf?.lesbar ?? false;
      const seite = entwurf.seiten.find((x) => x.id === v.id);
      const seiteDa = seite !== undefined;
      // Ohne lesbaren Entwurf ist der Bereich unbekannt – sichtbar ist die Seite dann nur für den, der alle Seiten sieht.
      const bereich = seite ? bereichVon(seite) : null;
      if (!siehtBereich(zugang, bereich)) continue;
      const leitung = darfFreigeben(zugang, bereich);
      // Ein Status gilt nur für eine Seite, die es (lesbar) gibt – `entwurf.status` ist schon so gefiltert.
      const status = entwurf.status[v.id] ?? null;
      const art = artDerSeite(status, v.lage);
      if (!art) continue;
      if (!leitung) {
        if (!status) continue;
        const meine =
          status.zustand === 'zurueck' ? status.einreicher?.von === ichId : status.von === ichId;
        if (!meine) continue;
      }
      liste.push({
        schluessel: s,
        einheit: 'seite',
        id: v.id,
        titel: seiteDa ? titelVon(v.id, entwurf) : `Seite „${v.id}“`,
        art,
        lage: v.lage,
        status,
        lesbar: lesbarEntwurf && seiteDa,
        bereich,
        ...(sicht.falsch.has(v.id) ? { verschieben: true as const } : {}),
      });
    } else if (leitetWebsite(zugang) && v.lage !== 'gleich' && v.lage !== 'nurOnline') {
      const menueEintrag = v.einheit === 'menue';
      const warnung = menueEintrag
        ? menueOhneOnlineSeiten(entwurf.menue, entwurf.seiten, online.staende)
        : [];
      liste.push({
        schluessel: s,
        einheit: v.einheit,
        id: v.id,
        titel: menueEintrag ? MENUE_TITEL : EINSTELLUNGEN_TITEL,
        art: menueEintrag ? 'menue' : 'einstellungen',
        lage: v.lage,
        status: null,
        lesbar: v.entwurf?.lesbar ?? false,
        bereich: null,
        ...(warnung.length > 0
          ? {
              warnung: `Das Menü verweist auf Seiten, die noch nicht online sind: ${warnung.join(', ')}.`,
            }
          : {}),
      });
    }
  }

  const rang = (e: Eintrag) => EINTRAG_ARTEN.indexOf(e.art);
  return liste.sort((a, b) => {
    if (rang(a) !== rang(b)) return rang(a) - rang(b);
    // Eingereichtes: die älteste Bitte zuerst.
    if (a.status && b.status && a.status.zeit !== b.status.zeit)
      return a.status.zeit < b.status.zeit ? -1 : 1;
    return a.titel.localeCompare(b.titel, 'de');
  });
}

/**
 * **Die Zahl am Reiter „Freigaben“** – was auf diese Person wartet: wo sie freigibt, eingereichte Seiten und „Löschen
 * angefragt“; wo sie Redakteur ist, ihre zurückgegebenen Seiten. Je Eintrag nach seinem Bereich (W3b-4b). `liste` ist die Liste
 * dieser Person (`freigabeListe`).
 */
export function freigabeZaehler(liste: readonly Eintrag[], zugang: Zugang): number {
  return liste.filter((e) =>
    darfFreigeben(zugang, e.bereich)
      ? e.art === 'eingereicht' || e.art === 'loeschenAngefragt'
      : e.art === 'zurueck',
  ).length;
}

/**
 * **Kann diese Seite zur Prüfung eingereicht werden?** Nur, wenn sie vom Online-Stand abweicht oder nie online war – und noch
 * nicht eingereicht oder zum Löschen angefragt ist. Eine zurückgegebene Seite lässt sich erneut einreichen. Ist der Online-Stand
 * unbekannt (`null`), geht es (die Leitung sieht dann selbst, ob etwas zu tun ist).
 */
export function kannEinreichen(
  lage: Exclude<OnlineLage, 'nurOnline'> | null,
  status: SeitenStatus | null,
): boolean {
  if (status?.zustand === 'eingereicht' || status?.zustand === 'loeschenAngefragt') return false;
  return lage !== 'gleich';
}

// ── 3. Das Schreiben ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FreigabeOrt {
  p: ModulPort;
  modul: number;
  entwuerfe: number;
  /** „Veröffentlicht“ der Website. */
  veroeffentlicht: number;
  /**
   * Die Veröffentlicht-Kategorien der **eingerichteten** Untergruppen, die die Person sieht (W3b-4b). Fehlt: keine – dann gibt
   * es nur die Kategorie der Website (wie bis W3b-4a).
   */
  untergruppen?: readonly UntergruppenKategorie[];
}

const entwurfsOrt = (o: FreigabeOrt) => ({ p: o.p, modul: o.modul, kategorie: o.entwuerfe });
const ortIn = (o: FreigabeOrt, kategorie: number) => ({ p: o.p, modul: o.modul, kategorie });

/** Alle Veröffentlicht-Kategorien, die dieser Ort kennt – die der Website zuerst. */
export function onlineKategorien(o: FreigabeOrt): { bereich: number | null; kategorie: number }[] {
  return [
    { bereich: null, kategorie: o.veroeffentlicht },
    ...(o.untergruppen ?? []).map((u) => ({ bereich: u.gruppe, kategorie: u.kategorie })),
  ];
}

/** **Die Kategorie eines Bereichs** – `null`: Die Untergruppe ist nicht eingerichtet (oder man sieht ihre Kategorie nicht). */
export function kategorieDesBereichs(o: FreigabeOrt, bereich: number | null): number | null {
  return onlineKategorien(o).find((k) => k.bereich === bereich)?.kategorie ?? null;
}

const NICHT_EINGERICHTET =
  'gehört zu einer Untergruppe, die noch nicht eingerichtet ist – es wurde nichts veröffentlicht. Ein Admin richtet die Untergruppe unter Einstellungen → „Wer darf was“ ein; oder die Leitung der Website ändert den Bereich der Seite.';

const KEIN_RECHT =
  'Dafür fehlt dir das Recht: Seiten veröffentlichen und offline nehmen darf nur die Leitung der Website.';

/** ChurchTools meldet fehlendes Recht mal als 401, mal als 403 – beides ist hier „kein Recht“, nicht „abgemeldet“. */
function istKeinRechtFehler(p: ModulPort, e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  return p.istKeinRecht(e) || status === 401 || status === 403;
}

/** Ein Schreiben oder Lesen in „Veröffentlicht“: ein fehlendes Recht bekommt eine klare Meldung, alles andere bleibt, wie es ist. */
async function aufOnline<T>(o: FreigabeOrt, tun: () => Promise<T>): Promise<T> {
  try {
    return await tun();
  } catch (e) {
    if (istKeinRechtFehler(o.p, e)) throw o.p.fehler(403, KEIN_RECHT);
    throw e;
  }
}

/** Ist dieser Text eine gültige Einheit? Was nicht gültig ist, geht nie nach „Veröffentlicht“. */
function textPruefen(einheit: Einheit, text: string): string | null {
  const r =
    einheit === 'seite'
      ? seiteAusText(text)
      : einheit === 'menue'
        ? menueAusText(text)
        : einstellungenAusText(text);
  return r.ok ? null : r.meldung;
}

/** Wie eine Einheit heißt, für Meldungen. */
function nennung(einheit: Einheit, id: string): string {
  return einheit === 'seite'
    ? `die Seite „${id}“`
    : einheit === 'menue'
      ? 'das Menü'
      : 'die Einstellungen';
}

export interface Freigegeben {
  /** Der Stand, der jetzt online steht. */
  stand: string;
  /** Wurde der Status entfernt? `false`: Er blieb – `grund` sagt, warum. Online ist die Seite trotzdem. */
  statusEntfernt: boolean;
  grund?: 'geaendert' | 'fehler';
  /**
   * Verschieben (W3b-4b): Die Seite ist in der Kategorie ihres Bereichs online, ließ sich aber aus diesen anderen Bereichen
   * (`null` = Website) nicht entfernen – sie steht dort **zusätzlich** noch. Fehlt: Sie steht nur in ihrem Bereich.
   */
  bleibtIn?: (number | null)[];
}

/**
 * Nach dem Freigeben einer Seite: sie aus allen **anderen** Veröffentlicht-Kategorien entfernen (Verschieben). Erst aufgerufen,
 * wenn sie in der neuen nachgelesen ist. Eine Kategorie ohne Leserecht wird übersprungen (dort kann man nichts sehen und nichts
 * tun); jeder andere Fehler – auch ein fehlendes Recht zum Löschen – heißt: Sie bleibt dort, und das wird gesagt.
 */
async function ausAnderenBereichen(
  o: FreigabeOrt,
  id: string,
  ziel: number,
): Promise<(number | null)[]> {
  const bleibt: (number | null)[] = [];
  for (const k of onlineKategorien(o)) {
    if (k.kategorie === ziel) continue;
    let liegtDort: boolean;
    try {
      liegtDort = websiteAusWerten(await werteLesen(o.p, o.modul, k.kategorie)).staende.some(
        (s) => s.einheit === 'seite' && s.id === id,
      );
    } catch (e) {
      if (istKeinRechtFehler(o.p, e)) continue;
      console.warn('Website: alter Bereich nach dem Freigeben nicht lesbar', k.kategorie, e);
      bleibt.push(k.bereich);
      continue;
    }
    if (!liegtDort) continue;
    try {
      await einheitLoeschen(ortIn(o, k.kategorie), 'seite', id);
    } catch (e) {
      console.warn('Website: Seite im alten Bereich nicht entfernt', k.kategorie, e);
      bleibt.push(k.bereich);
    }
  }
  return bleibt;
}

/**
 * **Eine Einheit freigeben:** den gespeicherten Text aus „Entwürfe“ **unverändert** nach „Veröffentlicht“ schreiben (derselbe
 * Anschluss wie beim Speichern, `einheitSpeichern`), **nachlesen, dass dort derselbe Stand steht** – und erst dann den Status
 * entfernen, wenn der Entwurf inzwischen nicht weitergeändert wurde. Wirft bei jedem Fehler; **nichts gilt als online, was
 * nicht nachgelesen ist**, der Status bleibt dann unberührt.
 */
export async function gibFrei(o: FreigabeOrt, einheit: Einheit, id: string): Promise<Freigegeben> {
  const vorher = await werteLesen(o.p, o.modul, o.entwuerfe);
  const e = einheitText(vorher, einheit, id);
  if (!e)
    throw o.p.fehler(
      502,
      `Der Entwurf für ${nennung(einheit, id)} lässt sich gerade nicht vollständig lesen – es wurde nichts veröffentlicht.`,
    );
  const ungueltig = textPruefen(einheit, e.text);
  if (ungueltig)
    throw o.p.fehler(
      422,
      `Der Entwurf für ${nennung(einheit, id)} ist nicht gültig und wurde nicht veröffentlicht: ${ungueltig}`,
    );

  // Wohin? Menü und Einstellungen in die Kategorie der Website, eine Seite in die ihres Bereichs (W3b-4b).
  let ziel = o.veroeffentlicht;
  if (einheit === 'seite') {
    const gelesen = seiteAusText(e.text);
    const k = gelesen.ok ? kategorieDesBereichs(o, bereichVon(gelesen.wert)) : null;
    if (k === null)
      throw o.p.fehler(
        409,
        `Die Seite „${gelesen.ok ? gelesen.wert.titel : id}“ ${NICHT_EINGERICHTET}`,
      );
    ziel = k;
  }

  await aufOnline(o, () => einheitSpeichern(ortIn(o, ziel), einheit, id, e.text));

  // Nachlesen: Steht dort wirklich derselbe Stand, vollständig lesbar? (Ein `201` ist kein Beleg.)
  const jetzt = await aufOnline(o, () => werteLesen(o.p, o.modul, ziel));
  const dort = einheitText(jetzt, einheit, id);
  if (!dort || dort.stand !== e.stand)
    throw o.p.fehler(
      502,
      'ChurchTools hat die Freigabe nicht vollständig übernommen – der bisherige Online-Stand gilt weiter.',
    );

  if (einheit !== 'seite') return { stand: e.stand, statusEntfernt: true };

  // Verschieben: erst jetzt, da die Seite im neuen Bereich nachgelesen ist, aus den anderen entfernen.
  const bleibt = await ausAnderenBereichen(o, id, ziel);
  const mitBleibt = (r: Freigegeben): Freigegeben =>
    bleibt.length > 0 ? { ...r, bleibtIn: bleibt } : r;

  // Erst jetzt den Status – und nur, wenn der Entwurf noch der ist, der gerade freigegeben wurde (E-W24).
  try {
    const neu = await werteLesen(o.p, o.modul, o.entwuerfe);
    if (einheitText(neu, 'seite', id)?.stand !== e.stand)
      return mitBleibt({ stand: e.stand, statusEntfernt: false, grund: 'geaendert' });
    await statusEntfernen(entwurfsOrt(o), id);
    return mitBleibt({ stand: e.stand, statusEntfernt: true });
  } catch (fehler) {
    console.warn('Website: Status nach der Freigabe nicht entfernt', id, fehler);
    return mitBleibt({ stand: e.stand, statusEntfernt: false, grund: 'fehler' });
  }
}

/**
 * **Eine Seite löschen und offline nehmen** (Löschen angefragt und bestätigt, oder „online, aber Entwurf gelöscht“): erst aus
 * **jeder** Veröffentlicht-Kategorie entfernen, in der sie steht (W3b-4b – nachlesen, dass der Kopf weg ist:
 * `einheitLoeschen`), **dann** den Entwurf löschen (mit seinem Status). Scheitert das Offline-Nehmen, bleibt der Entwurf samt
 * „Löschen angefragt“ stehen und man kann es noch einmal versuchen; nie ist eine Seite online, deren Entwurf schon weg ist,
 * ohne dass es unter „Freigaben“ steht.
 *
 * `bereich` ist der Bereich der Seite (bei „nur noch online“ der, in dem sie liegt). Fehlt das Recht in der Kategorie **dieses**
 * Bereichs, ist das ein Fehler wie bisher (nichts wird gelöscht). Fehlt es in einer **fremden** Kategorie (die Seite lag noch im
 * alten Bereich, und dort schreibt nur die Leitung der Website), bleibt sie dort – das Ergebnis nennt es (`bleibtIn`), und die
 * Leitung der Website sieht sie unter „Freigaben“ als „nur noch online“. Eine Kategorie ohne Leserecht wird übersprungen.
 */
export async function seiteEntfernen(
  o: FreigabeOrt,
  id: string,
  bereich: number | null = null,
): Promise<{ bleibtIn: (number | null)[] }> {
  const bleibtIn: (number | null)[] = [];
  for (const k of onlineKategorien(o)) {
    const eigene = k.bereich === bereich;
    try {
      await einheitLoeschen(ortIn(o, k.kategorie), 'seite', id);
    } catch (e) {
      if (!istKeinRechtFehler(o.p, e)) throw e;
      if (eigene) throw o.p.fehler(403, KEIN_RECHT);
      // Ohne Leserecht weiß man nicht einmal, ob sie dort liegt – nichts zu tun. Liegt sie dort und man darf nicht löschen: sagen.
      const lesbar = await werteLesen(o.p, o.modul, k.kategorie).then(
        (w) => websiteAusWerten(w).staende.some((s) => s.einheit === 'seite' && s.id === id),
        () => false,
      );
      if (lesbar) bleibtIn.push(k.bereich);
    }
  }
  await einheitLoeschen(entwurfsOrt(o), 'seite', id);
  return { bleibtIn };
}

/** Der Name der festen Einheiten in der Reihenfolge, in der sie freigegeben werden: erst Seiten, dann das Menü, dann das Aussehen. */
const RANG: Record<Einheit, number> = { seite: 0, menue: 1, einstellungen: 2 };

export interface Ziel {
  einheit: Einheit;
  id: string;
}

export interface AlleErgebnis {
  geschafft: Ziel[];
  /** Verschobene Seiten, die zusätzlich noch im alten Bereich stehen (`Freigegeben.bleibtIn`). */
  bleibt?: { ziel: Ziel; bleibtIn: (number | null)[] }[];
  /** Beim ersten Fehler bricht es ab – die übrigen sind nicht versucht worden. */
  fehler: { ziel: Ziel; fehler: unknown } | null;
  /** Wie viele nicht mehr versucht wurden. */
  offen: number;
}

/**
 * **Alles freigeben** – nacheinander, **bricht beim ersten Fehler ab** und sagt, was geschafft ist. Die Reihenfolge: Seiten, dann
 * das Menü, dann die Einstellungen – so zeigt das Menü nie auf eine Seite, die noch nicht online ist.
 */
export async function alleFreigeben(
  o: FreigabeOrt,
  ziele: readonly Ziel[],
  beiFortschritt?: (geschafft: number, von: number) => void,
): Promise<AlleErgebnis> {
  const reihe = [...ziele].sort((a, b) => RANG[a.einheit] - RANG[b.einheit]);
  const geschafft: Ziel[] = [];
  const bleibt: { ziel: Ziel; bleibtIn: (number | null)[] }[] = [];
  const mit = (r: AlleErgebnis): AlleErgebnis => (bleibt.length > 0 ? { ...r, bleibt } : r);
  for (const z of reihe) {
    try {
      const r = await gibFrei(o, z.einheit, z.id);
      if (r.bleibtIn) bleibt.push({ ziel: z, bleibtIn: r.bleibtIn });
    } catch (fehler) {
      return mit({
        geschafft,
        fehler: { ziel: z, fehler },
        offen: reihe.length - geschafft.length - 1,
      });
    }
    geschafft.push(z);
    beiFortschritt?.(geschafft.length, reihe.length);
  }
  return mit({ geschafft, fehler: null, offen: 0 });
}

/** Das Menü und die Einstellungen haben feste Kennungen – für den Aufruf von `gibFrei`. */
export const FESTE_ZIELE: Record<'menue' | 'einstellungen', Ziel> = {
  menue: { einheit: 'menue', id: MENUE_ID },
  einstellungen: { einheit: 'einstellungen', id: EINSTELLUNGEN_ID },
};
