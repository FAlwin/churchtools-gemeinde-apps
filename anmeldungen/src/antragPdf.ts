/**
 * **Eigene PDF für den Antrag** (N1d): die Datei prüfen, die **erste Seite** mit pdf.js als Bild zeichnen (JPEG, ~150 dpi)
 * und das Seitenformat (pt → mm) übernehmen. Das Bild steht später nur im HTML der Bescheinigung (`nachweisAntrag.ts`).
 *
 * pdf.js wird **erst bei Bedarf** geladen (dynamischer `import()`), die Startseite wird dadurch nicht schwerer. Die
 * Bausteine kommen aus `ui/teilen/pdfSeiten.ts` (Worker als eigene Datei in Erweiterungen, `viteErweiterung.ts`).
 */
import { ApiError } from '@ui/ct/fehler';
import { PDF_MASS_MAX, PDF_MASS_MIN, dataBildOk, ptZuMm } from '@shared/anmeldung/nachweisAntrag';

/** Größe der gewählten PDF – größere Anträge sind kein Formular mehr. */
export const ANTRAG_PDF_MAX = 15 * 1024 * 1024;
/** Größe des Seitenbilds (die `data:`-Adresse); ChurchTools nahm 9 MB HTML an (M7), das Erweiterungs-Paket aber nur bis ~2,2 MB. */
export const ANTRAG_HINTERGRUND_MAX = 2 * 1024 * 1024;
/** Auflösungen in dpi, von scharf nach grob: Wird das JPEG zu groß, geht es mit der nächsten weiter. */
export const ANTRAG_HINTERGRUND_DPI = [150, 120, 100, 72] as const;
export const ANTRAG_HINTERGRUND_QUALITAET = 0.85;

export interface AntragPdfSeite {
  /** Erste Seite als JPEG-`data:`-Adresse. */
  hintergrund: string;
  breiteMm: number;
  hoeheMm: number;
  /** Seitenzahl der PDF – bei mehr als einer wird nur die erste verwendet. */
  seiten: number;
}

/** Prüft die gewählte Datei, bevor sie gelesen wird. */
export function antragPdfPruefen(datei: Pick<File, 'type' | 'size'>): void {
  if (datei.type !== 'application/pdf') throw new ApiError(422, 'Bitte eine PDF-Datei wählen.');
  if (datei.size > ANTRAG_PDF_MAX)
    throw new ApiError(413, 'Die PDF ist größer als 15 MB. Bitte vorher verkleinern.');
}

/** Das Seitenformat in mm – wirft, wenn es außerhalb dessen liegt, was ein Antrag sein kann. */
export function antragPdfMasse(
  breitePt: number,
  hoehePt: number,
): { breiteMm: number; hoeheMm: number } {
  const breiteMm = ptZuMm(breitePt);
  const hoeheMm = ptZuMm(hoehePt);
  if (
    !(breiteMm >= PDF_MASS_MIN && breiteMm <= PDF_MASS_MAX) ||
    !(hoeheMm >= PDF_MASS_MIN && hoeheMm <= PDF_MASS_MAX)
  )
    throw new ApiError(
      422,
      `Das Seitenformat der PDF (${breiteMm} × ${hoeheMm} mm) passt nicht zu einem Antrag (${PDF_MASS_MIN} bis ${PDF_MASS_MAX} mm je Seite).`,
    );
  return { breiteMm, hoeheMm };
}

/**
 * Das JPEG der Seite: zuerst ~150 dpi; liegt die Adresse über `max`, erneut mit der nächstgröberen Auflösung. Hilft auch
 * die gröbste nicht, wird mit Meldung abgebrochen (nichts verändert). `zeichne` liefert zu einer Auflösung die Leinwand.
 */
export async function hintergrundErzeugen(
  zeichne: (dpi: number) => Promise<Pick<HTMLCanvasElement, 'toDataURL'>>,
  max: number = ANTRAG_HINTERGRUND_MAX,
): Promise<string> {
  for (const dpi of ANTRAG_HINTERGRUND_DPI) {
    const flaeche = await zeichne(dpi);
    const adresse = flaeche.toDataURL('image/jpeg', ANTRAG_HINTERGRUND_QUALITAET);
    if (!dataBildOk(adresse))
      throw new ApiError(500, 'Der Browser kann die Seite der PDF nicht als Bild festhalten.');
    if (adresse.length <= max) return adresse;
  }
  throw new ApiError(
    413,
    'Die erste Seite der PDF wird als Bild zu groß (über 2 MB), auch grob gezeichnet. Bitte eine einfachere PDF wählen (z. B. ohne Foto-Hintergrund).',
  );
}

/** Meldung zu einem Fehler beim Öffnen der PDF – pdf.js wirft eigene Ausnahmen (`name`). */
function oeffnenFehler(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const name = (e as { name?: unknown } | null)?.name;
  if (name === 'PasswordException')
    return new ApiError(
      422,
      'Diese PDF ist mit einem Kennwort geschützt. Bitte eine ungeschützte Fassung wählen.',
    );
  return new ApiError(
    422,
    'Diese PDF lässt sich nicht lesen (beschädigt oder kein Formular). Es wurde nichts verändert.',
  );
}

/** Die erste Seite einer PDF als Bild samt Seitenformat. Wirft mit verständlicher Meldung; nichts wird verändert. */
export async function antragPdfLaden(datei: File): Promise<AntragPdfSeite> {
  antragPdfPruefen(datei);
  let daten: ArrayBuffer;
  try {
    daten = await datei.arrayBuffer();
  } catch {
    throw new ApiError(422, 'Die Datei lässt sich nicht lesen. Bitte noch einmal wählen.');
  }
  const { pdfSeiteOeffnen } = await import('@ui/teilen/pdfSeiten').catch(() => {
    throw new ApiError(500, 'Der PDF-Leser ließ sich nicht laden. Bitte die Seite neu laden.');
  });
  let seite: Awaited<ReturnType<typeof pdfSeiteOeffnen>>;
  try {
    seite = await pdfSeiteOeffnen(daten, 1);
  } catch (e) {
    throw oeffnenFehler(e);
  }
  try {
    const masse = antragPdfMasse(seite.breitePt, seite.hoehePt);
    // 1 pt = 1/72 Zoll: der Maßstab für n dpi ist n / 72.
    const hintergrund = await hintergrundErzeugen((dpi) => seite.zeichnen(dpi / 72));
    return { hintergrund, ...masse, seiten: seite.seiten };
  } catch (e) {
    throw e instanceof ApiError
      ? e
      : new ApiError(
          422,
          'Die erste Seite der PDF ließ sich nicht zeichnen. Es wurde nichts verändert.',
        );
  } finally {
    seite.schliessen();
  }
}
