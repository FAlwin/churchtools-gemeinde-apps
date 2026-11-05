/**
 * **Zugang und Einstellungen im Speicher der Erweiterung** (Bauplan Gebetsabend G3) – je EIN Dokument mit
 * Versionsnummer über den gemeinsamen Baustein `@shared/ct/versionierterWert` (Vorbild: Plan und Sichtbarkeit des
 * Organigramms). Daraus folgt:
 *  - Starten zwei Technik-Geräte gleichzeitig, wird nichts still überschrieben (`konflikt`).
 *  - Erfolg ist erst, was **nachgelesen** dasteht (ein 201/200 ist kein Beleg, Lehre vom 11.08.2026).
 *  - Lesefehler bleiben Fehler (`ok: false`) – vorübergehend ist nicht „keine Übertragung“.
 *
 * Steht ein Dokument da, dessen Inhalt nicht passt, gilt es als „kein Zugang“ – seine **Version bleibt aber
 * bekannt**: Sonst gäbe jeder Start einen Konflikt, und die Technik säße fest.
 */
import {
  dokumentLesen,
  dokumentSpeichern,
  type Dokumentart,
  type SpeicherGrund,
  type SpeicherErgebnis,
  type VersionPort,
} from '../ct/versionierterWert';
import { einstellungenAus, EINSTELLUNGEN_DOKUMENT, type Einstellungen } from './einstellungen';
import { zugangAus, ZUGANG_DOKUMENT, type Zugang } from './zugang';

/** Was gerade gespeichert ist. `version: null` = noch nie gespeichert. */
export interface Stand<T> {
  version: number | null;
  inhalt: T;
}

export type StandLesen<T> = { ok: true; stand: Stand<T> } | { ok: false; grund: SpeicherGrund };

export type StandSpeichern<T> =
  | { ok: true; stand: Stand<T> }
  /** `jetzt`: was nach einem Konflikt oder nicht angekommenem Schreiben dasteht (falls nachgelesen). */
  | { ok: false; grund: SpeicherGrund; jetzt?: Stand<T> };

/** Wer schreibt – steht im Dokument (`von`). */
export interface Schreiber {
  personId: number;
  name: string;
}

async function lesen<T>(
  p: VersionPort,
  modul: number,
  kategorie: number,
  art: Dokumentart,
  aus: (roh: unknown) => T,
): Promise<StandLesen<T>> {
  const l = await dokumentLesen<unknown>(p, modul, kategorie, art);
  if (!l.ok) return l;
  return {
    ok: true,
    stand: { version: l.daten?.version ?? null, inhalt: aus(l.daten?.inhalt ?? null) },
  };
}

function standAus<T>(r: SpeicherErgebnis<unknown>, aus: (roh: unknown) => T): StandSpeichern<T> {
  const stand = (d: { version: number; inhalt: unknown } | null): Stand<T> => ({
    version: d?.version ?? null,
    inhalt: aus(d?.inhalt ?? null),
  });
  if (r.ok) return { ok: true, stand: stand(r.daten) };
  return r.jetzt === undefined
    ? { ok: false, grund: r.grund }
    : { ok: false, grund: r.grund, jetzt: stand(r.jetzt) };
}

/** Der Zugang – `inhalt: null`, wenn keiner (oder keiner, der passt) gespeichert ist. */
export function zugangLesen(
  p: VersionPort,
  modul: number,
  kategorie: number,
): Promise<StandLesen<Zugang | null>> {
  return lesen(p, modul, kategorie, ZUGANG_DOKUMENT, zugangAus);
}

/** Den Zugang speichern – `erwartet` ist die gesehene Version (`null` = es gab noch keinen). */
export async function zugangSpeichern(
  p: VersionPort,
  modul: number,
  kategorie: number,
  z: Zugang,
  von: Schreiber,
  erwartet: number | null,
  verweigert: string,
): Promise<StandSpeichern<Zugang | null>> {
  return standAus(
    await dokumentSpeichern(p, modul, kategorie, ZUGANG_DOKUMENT, z, von, erwartet, verweigert),
    zugangAus,
  );
}

export function einstellungenLesen(
  p: VersionPort,
  modul: number,
  kategorie: number,
): Promise<StandLesen<Einstellungen>> {
  return lesen(p, modul, kategorie, EINSTELLUNGEN_DOKUMENT, einstellungenAus);
}

export async function einstellungenSpeichern(
  p: VersionPort,
  modul: number,
  kategorie: number,
  e: Einstellungen,
  von: Schreiber,
  erwartet: number | null,
  verweigert: string,
): Promise<StandSpeichern<Einstellungen>> {
  return standAus(
    await dokumentSpeichern(
      p,
      modul,
      kategorie,
      EINSTELLUNGEN_DOKUMENT,
      e,
      von,
      erwartet,
      verweigert,
    ),
    einstellungenAus,
  );
}
