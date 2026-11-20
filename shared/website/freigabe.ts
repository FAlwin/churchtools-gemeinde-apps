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
 */
import { werteLesen, type ModulPort } from '../ct/modulDaten';
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
  type EinheitStand,
  type Einheit,
  type WebsiteStand,
} from './speicher';
import { statusEntfernen, type SeitenStatus } from './status';
import { darfFreigeben, type Zugang } from './zugang';

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
      lage: !o ? 'nie' : o.stand === e.stand ? 'gleich' : 'geaendert',
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
): Exclude<OnlineLage, 'nurOnline'> | null {
  if (!online) return null;
  const o = online.find((x) => x.einheit === 'seite' && x.id === seite.id);
  if (!o) return 'nie';
  return o.stand === seitenStand(seite) ? 'gleich' : 'geaendert';
}

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
 * Die Reihenfolge der Arten steht in `EINTRAG_ARTEN`. **W3b-4 (Untergruppen)** schränkt die Leitung einer Untergruppe hier auf
 * ihre Seiten ein.
 */
export function freigabeListe(
  entwurf: WebsiteStand,
  online: WebsiteStand,
  zugang: Zugang,
  ichId: number,
): Eintrag[] {
  const leitung = darfFreigeben(zugang);
  const lagen = onlineVergleich(entwurf.staende, online.staende);
  const titelVon = (id: string, aus: WebsiteStand) =>
    aus.seiten.find((s) => s.id === id)?.titel ?? `Seite „${id}“`;
  const liste: Eintrag[] = [];

  for (const v of lagen) {
    const s = schluessel(v.einheit, v.id);
    if (v.einheit === 'seite') {
      if (v.lage === 'nurOnline') {
        if (leitung)
          liste.push({
            schluessel: s,
            einheit: 'seite',
            id: v.id,
            titel: titelVon(v.id, online),
            art: 'nurOnline',
            lage: v.lage,
            status: null,
            lesbar: true,
          });
        continue;
      }
      const lesbarEntwurf = v.entwurf?.lesbar ?? false;
      const seiteDa = entwurf.seiten.some((x) => x.id === v.id);
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
      });
    } else if (leitung && v.lage !== 'gleich' && v.lage !== 'nurOnline') {
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
 * **Die Zahl am Reiter „Freigaben“** – was auf diese Person wartet: bei der Leitung eingereichte Seiten und „Löschen
 * angefragt“, beim Redakteur seine zurückgegebenen Seiten. `liste` ist die Liste dieser Person (`freigabeListe`).
 */
export function freigabeZaehler(liste: readonly Eintrag[], zugang: Zugang): number {
  const arten: EintragArt[] = darfFreigeben(zugang)
    ? ['eingereicht', 'loeschenAngefragt']
    : ['zurueck'];
  return liste.filter((e) => arten.includes(e.art)).length;
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
  veroeffentlicht: number;
}

const entwurfsOrt = (o: FreigabeOrt) => ({ p: o.p, modul: o.modul, kategorie: o.entwuerfe });
const onlineOrt = (o: FreigabeOrt) => ({ p: o.p, modul: o.modul, kategorie: o.veroeffentlicht });

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
  return einheit === 'seite' ? `die Seite „${id}“` : einheit === 'menue' ? 'das Menü' : 'die Einstellungen';
}

export interface Freigegeben {
  /** Der Stand, der jetzt online steht. */
  stand: string;
  /** Wurde der Status entfernt? `false`: Er blieb – `grund` sagt, warum. Online ist die Seite trotzdem. */
  statusEntfernt: boolean;
  grund?: 'geaendert' | 'fehler';
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

  await aufOnline(o, () => einheitSpeichern(onlineOrt(o), einheit, id, e.text));

  // Nachlesen: Steht dort wirklich derselbe Stand, vollständig lesbar? (Ein `201` ist kein Beleg.)
  const jetzt = await aufOnline(o, () => werteLesen(o.p, o.modul, o.veroeffentlicht));
  const dort = einheitText(jetzt, einheit, id);
  if (!dort || dort.stand !== e.stand)
    throw o.p.fehler(
      502,
      'ChurchTools hat die Freigabe nicht vollständig übernommen – der bisherige Online-Stand gilt weiter.',
    );

  if (einheit !== 'seite') return { stand: e.stand, statusEntfernt: true };

  // Erst jetzt den Status – und nur, wenn der Entwurf noch der ist, der gerade freigegeben wurde (E-W24).
  try {
    const neu = await werteLesen(o.p, o.modul, o.entwuerfe);
    if (einheitText(neu, 'seite', id)?.stand !== e.stand)
      return { stand: e.stand, statusEntfernt: false, grund: 'geaendert' };
    await statusEntfernen(entwurfsOrt(o), id);
    return { stand: e.stand, statusEntfernt: true };
  } catch (fehler) {
    console.warn('Website: Status nach der Freigabe nicht entfernt', id, fehler);
    return { stand: e.stand, statusEntfernt: false, grund: 'fehler' };
  }
}

/**
 * **Eine Seite löschen und offline nehmen** (Löschen angefragt und bestätigt, oder „online, aber Entwurf gelöscht“): erst aus
 * „Veröffentlicht“ entfernen (nachlesen, dass der Kopf weg ist – `einheitLoeschen`), **dann** den Entwurf löschen (mit seinem
 * Status). Scheitert das Offline-Nehmen, bleibt der Entwurf samt „Löschen angefragt“ stehen und man kann es noch einmal
 * versuchen; nie ist eine Seite online, deren Entwurf schon weg ist, ohne dass es unter „Freigaben“ steht.
 */
export async function seiteEntfernen(o: FreigabeOrt, id: string): Promise<void> {
  await aufOnline(o, () => einheitLoeschen(onlineOrt(o), 'seite', id));
  await einheitLoeschen(entwurfsOrt(o), 'seite', id);
}

/** Der Name der festen Einheiten in der Reihenfolge, in der sie freigegeben werden: erst Seiten, dann das Menü, dann das Aussehen. */
const RANG: Record<Einheit, number> = { seite: 0, menue: 1, einstellungen: 2 };

export interface Ziel {
  einheit: Einheit;
  id: string;
}

export interface AlleErgebnis {
  geschafft: Ziel[];
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
  for (const z of reihe) {
    try {
      await gibFrei(o, z.einheit, z.id);
    } catch (fehler) {
      return { geschafft, fehler: { ziel: z, fehler }, offen: reihe.length - geschafft.length - 1 };
    }
    geschafft.push(z);
    beiFortschritt?.(geschafft.length, reihe.length);
  }
  return { geschafft, fehler: null, offen: 0 };
}

/** Das Menü und die Einstellungen haben feste Kennungen – für den Aufruf von `gibFrei`. */
export const FESTE_ZIELE: Record<'menue' | 'einstellungen', Ziel> = {
  menue: { einheit: 'menue', id: MENUE_ID },
  einstellungen: { einheit: 'einstellungen', id: EINSTELLUNGEN_ID },
};
