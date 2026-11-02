/**
 * Was die Dateiverwaltung sagt und prüft (#321, Schritt 4).
 *
 * **Warum als eigene Datei:** Drei Dinge hängen an der Art einer Datei – ihr Symbol, ihre Bezeichnung
 * und die **Folge des Löschens**. Lägen sie verstreut (Symbol in der Liste, Folge im Dialog), wäre
 * die nächste Art eine Änderung an zwei Orten, und eine davon würde vergessen. Dazu die Prüfung vor
 * dem Hochladen, die als reine Funktion in Sekunden prüfbar ist statt nur durch Anklicken.
 *
 * Die Liste der Dateien ist bewusst **flach** und behandelt alle gleich (Entscheidung Alwin,
 * 11.08.2026). Der Schutz liegt deshalb ausschließlich im **Wortlaut der Rückfrage**: Sie muss sagen,
 * was danach fehlt. Ich hatte eine geschützte Gruppierung empfohlen; da sie es nicht wurde, ist dieser
 * Text die einzige Bremse, und entsprechend genau ist er formuliert.
 */
import type { ArrangementFileEntry, ArrangementFileKind } from '@shared/types/index';
// Symbol, Art und Anzeige einer Datei liegen seit E6-O O4 in `ui/lied/dateiAnzeige` – der Dienstplaner zeigt
// dieselben Dateien (Lied-Ansicht) und soll sie nicht nachbauen.
export { DATEI_ART, DATEI_SYMBOL, dateiZeilen } from '@ui/lied/dateiAnzeige';
import { MAX_FILE_BYTES, MAX_FILE_TEXT } from '@shared/dateien/index';
import {
  nameTeilen,
  neuerDateiname,
  versionNameOf,
  versionSlug,
} from '@shared/ct/arrangementFiles';

/**
 * Die Folge des Löschens, in einem Satz – oder `null`, wenn es keine über das Offensichtliche hinaus
 * gibt.
 *
 * **Beim Original-ChordPro ist das der wichtigste Satz der ganzen Dateiverwaltung.** Es ist die
 * Quelle des Notenblatts; ohne es zeigt die App für dieses Arrangement keine Akkorde mehr. In einer
 * flachen Liste sieht es aber aus wie jede andere Datei.
 */
export function loeschFolge(kind: ArrangementFileKind): string | null {
  if (kind === 'chordpro-original') {
    return 'Das ist die Quelle des Notenblatts – danach zeigt die App für dieses Arrangement keine Akkorde mehr.';
  }
  if (kind === 'chordpro-version') {
    return 'Die Version verschwindet damit aus dem Lied-Menü.';
  }
  return null;
}

/** Der vollständige Text der Rückfrage vor dem Löschen. */
export function loeschFrage(datei: ArrangementFileEntry): string {
  const folge = loeschFolge(datei.kind);
  return [
    `„${datei.name}" wird aus ChurchTools entfernt.`,
    folge,
    'Wiederherstellen geht nur durch erneutes Hochladen.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Prüft eine ausgewählte Datei, BEVOR sie durchs Netz geht – `null` heißt „in Ordnung".
 *
 * **Die Größe zuerst:** 50 MB erst zu übertragen und dann abgelehnt zu bekommen ist der schlechteste
 * Moment für eine Fehlermeldung, besonders über Mobilfunk. Die Grenze kommt aus `@shared/dateien` und
 * ist damit dieselbe, die der Server durchsetzt.
 *
 * **Ein vorhandener gleicher Name ist eine Warnung, kein Verbot:** ChurchTools ersetzt nicht, die
 * Datei läge danach zweimal da. Was davon die richtige ist, weiß nur der Nutzer – deshalb bekommt er
 * die Auskunft und entscheidet selbst.
 */
export function pruefeUpload(
  datei: { name: string; size: number },
  vorhandene: ArrangementFileEntry[],
): { art: 'fehler' | 'warnung'; text: string } | null {
  if (datei.size === 0) {
    return { art: 'fehler', text: `„${datei.name}" ist leer und wurde nicht hochgeladen.` };
  }
  if (datei.size > MAX_FILE_BYTES) {
    return {
      art: 'fehler',
      text: `„${datei.name}" ist zu groß. Erlaubt sind bis zu ${MAX_FILE_TEXT}.`,
    };
  }
  if (vorhandene.some((v) => v.name === datei.name)) {
    return {
      art: 'warnung',
      text: `Es gibt hier schon eine Datei „${datei.name}". Sie wird NICHT ersetzt – beide liegen danach in ChurchTools. Trotzdem hochladen?`,
    };
  }
  return null;
}

/**
 * Was im Fenster „Umbenennen“ steht (31.10.2026): der Name zum Ändern und die feste Endung daneben.
 *
 * **Bei einer Version aus dem Editor** steht nur ihr Name da („Akustik“), ohne Lied-Titel, „(App)“ und Endung: Den Rest
 * setzt die App selbst zusammen (`versionFileName`), und genau so heißt die Version auch im Lied-Menü. `versionKey` ist
 * ihr Schlüssel – unter ihm liegen Tonart, Aussehen und Anmerkungen, die beim Umbenennen mitgehen.
 */
export function umbenennVorlage(datei: ArrangementFileEntry): {
  basis: string;
  endung: string;
  versionKey: string | null;
} {
  if (datei.kind === 'chordpro-version') {
    const name = versionNameOf({ name: datei.name, fileUrl: '' }) ?? datei.name;
    return { basis: name, endung: '', versionKey: versionSlug(name) };
  }
  return { ...nameTeilen(datei.name), versionKey: null };
}

/**
 * Prüft die Eingabe im Fenster, BEVOR etwas durchs Netz geht – mit derselben Regel, die der Kern vor dem Schreiben
 * anwendet (`neuerDateiname`). `fehler` = warum nicht; `gleich` = nichts geändert (der Knopf bleibt dann grau).
 *
 * Bei einer Version prüft hier nur „nicht leer“: Ihre Namensregeln (Klammern, gleiche Version schon da) setzt
 * `versionAendern` durch, und die Meldung von dort steht dann im Fenster.
 */
export function umbenennPruefung(
  datei: ArrangementFileEntry,
  eingabe: string,
): { fehler: string | null; gleich: boolean } {
  const vorlage = umbenennVorlage(datei);
  if (vorlage.versionKey !== null) {
    const name = eingabe.trim();
    return { fehler: name ? null : 'Bitte einen Namen angeben.', gleich: name === vorlage.basis };
  }
  const neu = neuerDateiname(datei.name, eingabe);
  return { fehler: neu.fehler, gleich: neu.name === datei.name };
}
