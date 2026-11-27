/**
 * **Was die Startseite der Protokolle braucht** (Bauplan S1): wer angemeldet ist, die Gemeinde und die Gruppen
 * (nur die, deren Protokolle man sehen darf). Die Regeln stehen in `@shared/protokolle/gruppen`; hier wird nur
 * gelesen.
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „keine Gruppen“ gemacht – vorübergehend ist nicht leer
 * (die Seite zeigt dann „Erneut versuchen“).
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { modulRechteAus } from '@shared/ct/modulRechte';
import { protokollGruppen, type ProtokollGruppe } from '@shared/protokolle/gruppen';
import { darfVerwalten } from '@shared/ct/rollenRechte';
import {
  darfTagsVerwalten,
  schreibbareKalender,
  vorlagenKalender,
} from '@shared/ct/kalenderRechte';
import { eventInfosKalender, eventKalender } from '@shared/ct/eventRechte';
import { gruppenTypenAnlegen } from '@shared/ct/gruppenTypRechte';
import { buchbareRessourcen, verwaltbareRessourcen } from '@shared/ct/ressourcenRechte';
import { gruppenMitRecht } from '@shared/ct/gruppenRechteListe';
import { ctDaten } from '@ui/ct/verbindung';

export interface Start {
  id: number;
  vorname: string;
  /** Für „vorgeschlagen von …“ (S5-4) – fehlt, wenn ChurchTools keinen liefert. */
  nachname: string;
  gemeinde: string | null;
  modul: number;
  gruppen: ProtokollGruppe[];
  /** Darf Rechte vergeben → sieht den Reiter „Einstellungen“ (S2-2). */
  darfVerwalten: boolean;
  /**
   * Kategorien, in denen man anlegen, ändern und löschen darf – bei „Protokolle“ heißt das: Protokolle schreiben
   * (die Leitung, S4-1). Die Schnittstelle prüft es ohnehin; hier entscheidet es nur, ob der Editor aufgeht.
   */
  schreibbar: number[];
  /** Kalender, in denen man Termine anlegen darf (`churchcal` „edit category“) – Reiter „Termine“ (W14): ohne keiner „Eintragen“. */
  kalenderSchreiben: number[];
  /** Kalender, in die man Termin-Vorlagen speichern darf (`edit calendar entry template`) – „Als Vorlage speichern“ (W15-1). */
  vorlagenSchreiben: number[];
  /** Darf neue Termin-Tags anlegen (`admin appointment tags`, W15-1). */
  tagsVerwalten: boolean;
  /** Ressourcen, die man buchen darf (`churchresource` „create bookings“, W15-2) – ohne keine gibt es den Reiter „Ressourcen“. */
  ressourcenBuchen: number[];
  /** Ressourcen, bei denen man den Status einer Buchung setzen darf („administer bookings“). */
  ressourcenVerwalten: number[];
  /** Kalender, in denen man Events anlegen darf (`churchservice` „edit events“, W15-3) – nur dort gibt es den Reiter „Events“. */
  eventsAnlegen: number[];
  /** Kalender, in denen man die Infos von Events ändern darf (`edit events`, Baustein „Reihe“); `null` = alle (`eventInfosKalender`). */
  eventsAendern: number[] | null;
  /** Gruppentypen, in denen man Gruppen anlegen darf (`churchdb` „create groups of grouptype“, W15-5) – ohne keinen gibt es den Reiter „Anmeldung“. */
  gruppentypenAnlegen: number[];
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul, rechte] = await Promise.all([
    ladeIch(),
    modulId('Die Erweiterung „Protokolle“'),
    ctDaten('/permissions/global'),
  ]);
  const [kategorien, intern] = await Promise.all([
    kategorienLesen(modulPort, modul),
    // Nur für „Rolle unbekannt + Schreibt mit“ (`istLeitungIn`, v1.6.1). Scheitert es, lädt der Start trotzdem – `null`
    // heißt dort „keine Leitungsknöpfe“, beim nächsten Laden stimmt es wieder (vorübergehend ist nicht ungültig).
    ctDaten('/permissions/internal/groups').then(
      (roh) => gruppenMitRecht(roh, 'churchdb', '+admin meetings'),
      () => null,
    ),
  ]);
  const admin = darfVerwalten(rechte);
  return {
    id: ich.id,
    vorname: ich.vorname,
    nachname: ich.nachname ?? '',
    gemeinde: ich.gemeinde,
    modul,
    gruppen: protokollGruppen(ich.mitgliedschaften, kategorien).map((g) => ({
      ...g,
      treffenPflegen: admin || (intern === null ? null : intern.has(g.id)),
    })),
    darfVerwalten: admin,
    schreibbar: modulRechteAus(
      (rechte as Record<string, unknown> | null)?.[modulPort.kuerzel() ?? 'protokolle'],
    ).aendern,
    kalenderSchreiben: [...schreibbareKalender(rechte)],
    vorlagenSchreiben: [...vorlagenKalender(rechte)],
    tagsVerwalten: darfTagsVerwalten(rechte),
    ressourcenBuchen: [...buchbareRessourcen(rechte)],
    ressourcenVerwalten: [...verwaltbareRessourcen(rechte)],
    eventsAnlegen: [...eventKalender(rechte)],
    eventsAendern: eventInfosKalender(rechte),
    gruppentypenAnlegen: [...gruppenTypenAnlegen(rechte)],
  };
}
