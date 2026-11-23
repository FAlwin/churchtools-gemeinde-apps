/**
 * **Die Einstellungen des Dienstplaners „für alle“** (Live-Ansicht 2, L4-2, Alwin 23.11.2026): bisher nur die
 * **Betriebsart der Live-Ansicht** (`Betriebsart` in `shared/ct/liveAgenda.ts`, die Regel selbst steht dort).
 *
 * Gespeichert wird EIN Wert in der Kategorie `dienstplaner-einstellungen` des Dienstplaner-Moduls – mit Version, Konflikt
 * und Nachlesen wie bei jedem Dokument der Erweiterung (`shared/ct/versionierterWert`, Schwester: „Was das Organigramm
 * zeigt“). Die Rechte setzt Alwin an der Kategorie in ChurchTools (sehen: alle mit Dienstplaner, ändern: Planer); die
 * Oberfläche bietet das Ändern nur Planern an (`darfPlanen`).
 *
 * Hausregeln:
 *  - **Ohne Wert, ohne Kategorie, bei einem Wert in unbekannter Form oder bei einem Lesefehler gilt der Standard**
 *    (`STANDARD_BETRIEBSART`) – die Live-Ansicht darf daran nie scheitern.
 *  - **Ein Lesefehler zerstört nichts:** Er ist ein eigenes Ergebnis (`fehler`), kein „kein Wert“ – wer ihn sieht, darf
 *    nicht auf „es gibt noch keinen Wert“ hin speichern (das fängt zusätzlich die Versionsprüfung beim Schreiben ab).
 *  - **Geschrieben wird nie automatisch wiederholt**, erfolgreich ist erst, was nachgelesen dasteht.
 */
import { z } from 'zod';
import { BETRIEBSARTEN, STANDARD_BETRIEBSART, type Betriebsart } from '../ct/liveAgenda';
import { kategorieSicherstellen, kategorieSuchen, type KategorieAngabe } from '../ct/modulDaten';
import {
  dokumentLesen,
  dokumentSpeichern,
  type Dokumentart,
  type SpeicherErgebnis,
  type SpeicherGrund,
  type VersionPort,
  type Versioniert,
} from '../ct/versionierterWert';

export const EINSTELLUNGEN_ART: Dokumentart = { art: 'dienstplaner-einstellungen', fassung: 1 };

export const EINSTELLUNGEN_KATEGORIE: KategorieAngabe = {
  kuerzel: 'dienstplaner-einstellungen',
  name: 'Einstellungen',
  beschreibung:
    'Angelegt vom Dienstplaner – lesen: alle, die den Dienstplaner nutzen; ändern: Planer. Enthält die Einstellungen für alle (z. B. die Betriebsart der Live-Ansicht).',
};

export const VERWEIGERT =
  'Die Einstellungen für alle dürfen nur Planer ändern – und wer in ChurchTools die Kategorie „Einstellungen“ des Dienstplaners bearbeiten darf.';

/** Was gespeichert wird. */
export interface DienstplanerEinstellungen {
  betriebsart: Betriebsart;
}

const schema = z.object({ betriebsart: z.enum(BETRIEBSARTEN) });

/** Ein gespeicherter Inhalt – `null`, wenn er nicht dieses Format hat (andere Fassung, beschädigt, von Hand geändert). */
export function einstellungenAus(roh: unknown): DienstplanerEinstellungen | null {
  const r = schema.safeParse(roh);
  return r.success ? { betriebsart: r.data.betriebsart } : null;
}

/** Was beim Lesen herauskommt. `betriebsart` gilt **immer** (Standard, wenn nichts Lesbares dasteht). */
export interface EinstellungenStand {
  betriebsart: Betriebsart;
  /** Der gespeicherte Wert samt Version – `null`: es gibt keinen (oder er war nicht zu lesen, dann steht `fehler` da). */
  gespeichert: Versioniert<DienstplanerEinstellungen> | null;
  /** Der Wert war da, hatte aber nicht das erwartete Format – es gilt der Standard; Speichern ersetzt ihn. */
  unlesbar: boolean;
  /** Nicht lesbar (abgemeldet, kein Recht, vorübergehend) – dann gilt der Standard und es darf nicht gespeichert werden. */
  fehler: SpeicherGrund | null;
}

const standard = (teil: Partial<EinstellungenStand> = {}): EinstellungenStand => ({
  betriebsart: STANDARD_BETRIEBSART,
  gespeichert: null,
  unlesbar: false,
  fehler: null,
  ...teil,
});

function grundAus(p: VersionPort, e: unknown): SpeicherGrund {
  if (p.istAbgemeldet(e)) return 'abgemeldet';
  if (p.istKeinRecht(e)) return 'kein-recht';
  return 'voruebergehend';
}

/**
 * **Frisch lesen.** Die ID des Moduls kommt als Funktion (`modul`), weil die Suche nach ihr selbst scheitern kann – auch das
 * ist dann ein Lesefehler und kein „kein Wert“. Keine Kategorie (noch nie gespeichert – oder ChurchTools zeigt sie einem
 * nicht) = Standard.
 */
export async function einstellungenLesen(
  p: VersionPort,
  modul: () => Promise<number>,
): Promise<EinstellungenStand> {
  let modulId: number;
  let kategorie: number | null;
  try {
    modulId = await modul();
    kategorie = await kategorieSuchen(p, modulId, EINSTELLUNGEN_KATEGORIE.kuerzel);
  } catch (e) {
    return standard({ fehler: grundAus(p, e) });
  }
  if (kategorie === null) return standard();
  const l = await dokumentLesen<unknown>(p, modulId, kategorie, EINSTELLUNGEN_ART);
  if (!l.ok) return standard({ fehler: l.grund });
  if (l.daten === null) return standard();
  const inhalt = einstellungenAus(l.daten.inhalt);
  return inhalt
    ? {
        betriebsart: inhalt.betriebsart,
        gespeichert: { ...l.daten, inhalt },
        unlesbar: false,
        fehler: null,
      }
    : standard({
        gespeichert: { ...l.daten, inhalt: { betriebsart: STANDARD_BETRIEBSART } },
        unlesbar: true,
      });
}

/**
 * **Speichern.** `erwartet` ist die gesehene Version (`null` = es gab keinen Wert). Steht inzwischen eine andere da, wird
 * nichts überschrieben (`konflikt`). Die Kategorie wird bei Bedarf angelegt (nur Admins) und danach nachgesehen.
 */
export async function einstellungenSpeichern(
  p: VersionPort,
  modul: () => Promise<number>,
  neu: DienstplanerEinstellungen,
  von: { personId: number; name: string },
  erwartet: number | null,
): Promise<SpeicherErgebnis<DienstplanerEinstellungen>> {
  let modulId: number;
  let kategorie: number;
  try {
    modulId = await modul();
    kategorie = await kategorieSicherstellen(p, modulId, EINSTELLUNGEN_KATEGORIE, VERWEIGERT);
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  return dokumentSpeichern(
    p,
    modulId,
    kategorie,
    EINSTELLUNGEN_ART,
    neu,
    von,
    erwartet,
    VERWEIGERT,
  );
}
