import { createContext } from 'react';

/**
 * **Steht der Vollbild-Knopf neben den Reitern?** (B8, „Ruhige Bedienung“): Am iPad/Rechner rückt er aus dem Seitenkopf jeder
 * Reiter-Seite (Termine, Lieder, Abwesenheiten, Mehr) in die Reiterzeile darüber – eine Stelle statt vier Köpfe. Der Rahmen
 * mit den Reitern (`App.tsx`) sagt es seinen Seiten; `SeitenGeruest` setzt den Knopf dann nicht noch einmal in den Kopf.
 * Am Handy und auf allen Seiten ohne Reiterzeile (Ablauf, Liedblatt) bleibt er im Kopf.
 */
export const VollbildImReiter = createContext(false);
