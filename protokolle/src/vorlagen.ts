/**
 * **Vorlagen lesen, speichern, löschen** (Bauplan Protokolle S2-3) – gemeindeweit in der Kategorie „Vorlagen“, ein
 * Wert je Vorlage. Schreiben dürfen nur Admins (S2-1: nur sie haben Schreibrechte auf diese Kategorie); lesen dürfen
 * alle eingerichteten Gruppen. Die Regeln (Formular ↔ Dokument) stehen in `@shared/protokolle/vorlagen`.
 *
 * **Jeder Schreibschritt wird nachgelesen** – ein 201 ist kein Beleg (Lehre vom 11.08.2026).
 */
import {
  inhaltAus,
  kategorieSicherstellen,
  kategorieSuchen,
  MAX_ZEICHEN,
  werteLesen,
  wertAendern,
  wertAnlegen,
  wertLoeschen,
} from '@shared/ct/modulDaten';
import { KUERZEL_VORLAGEN } from '@shared/protokolle/speicher';
import {
  ausFormular,
  formularPruefen,
  istVorlage,
  STANDARD_VORLAGEN,
  type Vorlage,
  type VorlagenFormular,
} from '@shared/protokolle/vorlagen';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';

export const NUR_ADMIN = 'Das darf nur, wer in ChurchTools Rechte vergeben darf (Admin).';

export interface GespeicherteVorlage {
  /** ID des Werts in ChurchTools. */
  wert: number;
  vorlage: Vorlage;
}

const neueId = (): string => crypto.randomUUID();

/**
 * Die Kategorie „Vorlagen“ – gibt es sie noch nicht, wird sie angelegt und mit den **drei Standard-Vorlagen**
 * gefüllt (Alwin, 22.10.2026). Nur dann: Hat ein Admin später alle Vorlagen gelöscht, kommen sie nicht wieder.
 * (Scheitert das Füllen mittendrin, fehlen sie – der Admin kann eigene anlegen; ein Fehler wird gemeldet.)
 */
export async function vorlagenKategorie(modul: number): Promise<number> {
  const da = await kategorieSuchen(modulPort, modul, KUERZEL_VORLAGEN);
  if (da !== null) return da;
  const kategorie = await kategorieSicherstellen(
    modulPort,
    modul,
    {
      kuerzel: KUERZEL_VORLAGEN,
      name: 'Vorlagen',
      beschreibung: 'Angelegt von der Erweiterung „Protokolle“.',
    },
    NUR_ADMIN,
  );
  for (const v of STANDARD_VORLAGEN)
    await wertAnlegen(modulPort, modul, kategorie, JSON.stringify(v), NUR_ADMIN);
  const gezaehlt = (await ladeVorlagen(modul)).vorlagen.length;
  if (gezaehlt < STANDARD_VORLAGEN.length) throw new NichtUebernommen('die Standard-Vorlagen');
  return kategorie;
}

/** Alle Vorlagen nach Namen. Gibt es die Kategorie noch nicht (keine Gruppe eingerichtet): keine. */
export async function ladeVorlagen(
  modul: number,
): Promise<{ kategorie: number | null; vorlagen: GespeicherteVorlage[] }> {
  const kategorie = await kategorieSuchen(modulPort, modul, KUERZEL_VORLAGEN);
  if (kategorie === null) return { kategorie: null, vorlagen: [] };
  const vorlagen: GespeicherteVorlage[] = [];
  for (const w of await werteLesen(modulPort, modul, kategorie)) {
    const v = inhaltAus<unknown>(w, 'vorlage', 1);
    if (istVorlage(v)) vorlagen.push({ wert: w.id, vorlage: v });
  }
  vorlagen.sort((a, b) => a.vorlage.name.localeCompare(b.vorlage.name, 'de'));
  return { kategorie, vorlagen };
}

/**
 * **Eine Vorlage speichern** – neu (`vorhanden: null`) oder geändert. Wirft bei fehlendem Namen/Punkt (422), bei zu
 * langer Vorlage (413) und wenn ChurchTools sie nicht übernommen hat (`NichtUebernommen`).
 */
export async function vorlageSpeichern(
  modul: number,
  formular: VorlagenFormular,
  vorhanden: GespeicherteVorlage | null,
): Promise<Vorlage> {
  const fehler = formularPruefen(formular);
  if (fehler.length) throw new ApiError(422, fehler[0]);
  const vorlage = ausFormular(formular, vorhanden?.vorlage.id ?? neueId(), neueId);
  const text = JSON.stringify(vorlage);
  if (text.length > MAX_ZEICHEN)
    throw new ApiError(
      413,
      'Die Vorlage ist zu lang – bitte Text kürzen oder auf zwei Vorlagen verteilen.',
    );
  const kategorie = await vorlagenKategorie(modul);
  if (vorhanden) await wertAendern(modulPort, modul, kategorie, vorhanden.wert, text, NUR_ADMIN);
  else await wertAnlegen(modulPort, modul, kategorie, text, NUR_ADMIN);

  const gleiche = (await ladeVorlagen(modul)).vorlagen.filter((g) => g.vorlage.id === vorlage.id);
  if (gleiche.length !== 1 || JSON.stringify(gleiche[0].vorlage) !== text)
    throw new NichtUebernommen('die Vorlage');
  return vorlage;
}

/** **Eine Vorlage löschen** – danach nachgesehen, dass sie weg ist. */
export async function vorlageLoeschen(modul: number, g: GespeicherteVorlage): Promise<void> {
  const kategorie = await kategorieSuchen(modulPort, modul, KUERZEL_VORLAGEN);
  if (kategorie === null) return;
  await wertLoeschen(modulPort, modul, kategorie, g.wert, NUR_ADMIN);
  if ((await ladeVorlagen(modul)).vorlagen.some((x) => x.wert === g.wert))
    throw new NichtUebernommen('das Löschen der Vorlage');
}
