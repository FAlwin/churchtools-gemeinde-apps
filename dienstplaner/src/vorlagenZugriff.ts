/**
 * **Wie der Dienstplaner die Seite „Ablaufvorlagen“ mit ChurchTools verbindet** (E10-V3a): der Browser-Zugriff, den sich
 * Dienstplaner und Musik-App-Erweiterung teilen (`@ui/ablauf/browserAblaufZugriff`, seit V3b dort) – hier steht nichts
 * mehr, nur der Name, unter dem `App` ihn kennt.
 */
import { browserVorlagenZugriff } from '@ui/ablauf/browserAblaufZugriff';
import type { VorlagenZugriff } from '@ui/ablauf/vorlagenZugriff';

export const vorlagenZugriff: VorlagenZugriff = browserVorlagenZugriff;
