/**
 * **Bilder für den Antrag** (N1c): eigenes Logo und Unterschrift. Sie werden im Browser verkleinert und als `data:`-Adresse
 * ins HTML der Bescheinigung eingebettet – sie landen NIE als Gruppenbild oder sonst ohne Login in ChurchTools (M4:
 * Gruppenbilder sind über den Link öffentlich). PNG bleibt PNG (Transparenz, z. B. ein freigestellter Stempel), JPG bleibt
 * JPG, alles andere (WebP, GIF, SVG …) wird PNG.
 */
import { ApiError } from '@ui/ct/fehler';
import { bildAdresseOk } from '@shared/anmeldung/nachweisAntrag';

/** Längste Seite nach dem Verkleinern – auf A4 reichen 800 px für Logo und Unterschrift gut. */
export const ANTRAG_BILD_KANTE = 800;
/** Größe der Datei, die gewählt werden darf (vor dem Verkleinern). */
export const ANTRAG_BILD_QUELLE_MAX = 8 * 1024 * 1024;
/** Größe der eingebetteten Adresse nach dem Verkleinern – drei Bilder ließen das Blatt sonst zu schwer werden. */
export const ANTRAG_BILD_MAX = 400 * 1024;

/** Zielgröße: längste Seite höchstens `kante`, nie vergrößern, nie unter 1 px. */
export function antragBildGroesse(
  breite: number,
  hoehe: number,
  kante: number = ANTRAG_BILD_KANTE,
): { breite: number; hoehe: number } {
  const f = Math.min(1, kante / Math.max(breite, hoehe));
  return { breite: Math.max(1, Math.round(breite * f)), hoehe: Math.max(1, Math.round(hoehe * f)) };
}

/** Das Ausgabeformat: JPG bleibt JPG, alles andere wird PNG. */
export const antragBildTyp = (mime: string): 'image/png' | 'image/jpeg' =>
  mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';

/** Prüft die gewählte Datei, bevor sie gelesen wird. */
export function antragBildPruefen(datei: Pick<File, 'type' | 'size'>): void {
  if (!datei.type.startsWith('image/'))
    throw new ApiError(422, 'Bitte ein Bild wählen (PNG oder JPG).');
  if (datei.size > ANTRAG_BILD_QUELLE_MAX)
    throw new ApiError(413, 'Das Bild ist größer als 8 MB. Bitte vorher verkleinern.');
}

/**
 * Das Bild verkleinern und als `data:`-Adresse liefern. Wirft mit verständlicher Meldung, wenn es kein lesbares Bild ist
 * oder auch verkleinert noch zu groß bleibt.
 */
export async function antragBildLaden(datei: File): Promise<string> {
  antragBildPruefen(datei);
  let quelle: ImageBitmap;
  try {
    quelle = await createImageBitmap(datei);
  } catch {
    throw new ApiError(422, 'Dieses Bild lässt sich nicht lesen. Bitte ein PNG oder JPG wählen.');
  }
  const { breite, hoehe } = antragBildGroesse(quelle.width, quelle.height);
  const flaeche = document.createElement('canvas');
  flaeche.width = breite;
  flaeche.height = hoehe;
  const stift = flaeche.getContext('2d');
  if (!stift) {
    quelle.close();
    throw new ApiError(500, 'Der Browser kann das Bild nicht verkleinern.');
  }
  const typ = antragBildTyp(datei.type);
  // JPG kennt keine Transparenz: weißer Grund statt schwarz.
  if (typ === 'image/jpeg') {
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, breite, hoehe);
  }
  stift.drawImage(quelle, 0, 0, breite, hoehe);
  quelle.close();
  const adresse = flaeche.toDataURL(typ, 0.85);
  if (!bildAdresseOk(adresse))
    throw new ApiError(
      422,
      'Dieses Bild lässt sich nicht verwenden. Bitte ein PNG oder JPG wählen.',
    );
  if (adresse.length > ANTRAG_BILD_MAX)
    throw new ApiError(
      413,
      'Das Bild ist auch verkleinert noch zu groß. Bitte ein einfacheres Bild wählen (z. B. ohne Foto-Hintergrund).',
    );
  return adresse;
}
