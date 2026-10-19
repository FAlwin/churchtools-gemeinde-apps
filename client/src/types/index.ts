/** Tatsächlich angewandtes Erscheinungsbild. */
export type Theme = 'light' | 'dark';
/** Vom Nutzer gewählte Voreinstellung – „system" folgt dem Gerät. */
export type ThemePref = 'light' | 'dark' | 'system';

/** Anmerkungs-Werkzeuge; `lasso` wählt Gemaltes und Texte aus, um sie zu verschieben/vergrößern (#615). */
export type DrawTool = 'pen' | 'marker' | 'eraser' | 'text' | 'lasso';
