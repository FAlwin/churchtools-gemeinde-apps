import type { BausteinTyp } from '@shared/website/modell';

/**
 * Die Namen der Bausteine in der Oberfläche. Ein `Record` über alle Typen: kommt im Modell ein Typ dazu, scheitert hier die
 * Typprüfung (nicht erst eine leere Beschriftung im Fenster).
 */
export const BAUSTEIN_NAMEN: Record<BausteinTyp, string> = {
  ueberschrift: 'Überschrift',
  akzentzeile: 'Handschrift-Zeile',
  text: 'Text',
  bild: 'Bild',
  bildText: 'Bild und Text',
  galerie: 'Galerie',
  knoepfe: 'Knöpfe',
  beitraege: 'Beiträge aus ChurchTools',
  termine: 'Termine aus ChurchTools',
  slider: 'Slider (Aktuelle Designs)',
  livestream: 'Livestream',
  kontaktformular: 'Kontaktformular',
  gruppenliste: 'Gruppen aus ChurchTools',
  trenner: 'Trenner',
  html: 'Eigenes HTML',
};
