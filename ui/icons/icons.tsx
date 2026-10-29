/**
 * Schlanke Line-Icons im ChurchTools-Stil (portiert aus dem Design-Handoff).
 * Nutzung: <Icon name="calendar" size={24} stroke={1.9} />
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'calendar'
  | 'home'
  | 'grid'
  | 'anhang'
  | 'dokument'
  | 'bild'
  | 'warnung'
  | 'offline'
  | 'calendar-fill'
  | 'music'
  | 'music-fill'
  | 'cog'
  | 'cog-fill'
  | 'chev-left'
  | 'pfeil-links'
  | 'chev-right'
  | 'chev-down'
  | 'search'
  | 'sun'
  | 'moon'
  | 'info'
  | 'lock'
  | 'lock-open'
  | 'type'
  | 'logout'
  | 'check'
  | 'pencil'
  | 'columns'
  | 'spalten-schmal'
  | 'spalten-breit'
  | 'people'
  | 'clock'
  | 'pin'
  | 'link'
  | 'external'
  | 'share'
  | 'trash'
  | 'heading'
  | 'plus'
  | 'minus'
  | 'metronome'
  | 'tap'
  | 'play'
  | 'pause'
  | 'marker'
  | 'eraser'
  | 'lasso'
  | 'eye'
  | 'eye-off'
  | 'zoom-reset'
  | 'vollbild'
  | 'vollbild-aus'
  | 'download'
  | 'drucker'
  | 'brief'
  | 'undo'
  | 'redo'
  | 'refresh'
  | 'x'
  | 'grip'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'cloud-check'
  | 'cloud-download'
  | 'user-slash'
  | 'regler'
  | 'zauberstab'
  | 'zahnrad'
  | 'liste'
  | 'nummern'
  | 'zitat'
  | 'trennlinie'
  | 'einruecken'
  | 'ausruecken'
  | 'format-weg'
  | 'kreis'
  | 'kreis-halb'
  | 'kreis-haken'
  | 'aufgabe'
  | 'stempel'
  | 'todo-liste';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 22, stroke = 2, style, className }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
    className,
  };
  const f = { ...p, fill: 'currentColor', stroke: 'none' };
  switch (name) {
    case 'calendar':
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
      );
    // Reiter „Start“ und „Planen“ des Dienstplaners (Entwurf v17, E3).
    case 'home':
      return (
        <svg {...p}>
          <path d="M3.5 11 12 4l8.5 7" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M9.5 4.5v15" />
        </svg>
      );
    case 'calendar-fill':
      return (
        <svg {...f}>
          <path d="M6 2.2a1 1 0 0 1 1 1V4h10v-.8a1 1 0 1 1 2 0V4.5h.5A2.5 2.5 0 0 1 22 7v12.5A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5V7a2.5 2.5 0 0 1 2.5-2.5H5v-.3a1 1 0 0 1 1-1ZM4 9.5v10a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-10H4Z" />
        </svg>
      );
    // Anhang, Dokument, Bild (22.10.2026): Ersatz für 📎 📄 🖼️ und 🖉 – Behelfszeichen fehlten auf iOS
    // („Bearbeiten (neue Version)“ zeigte ein leeres Kästchen) und passten nicht zu den Linien-Icons.
    case 'anhang':
      return (
        <svg {...p}>
          <path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.07-7.07l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.36-2.36L15.3 7" />
        </svg>
      );
    case 'dokument':
      return (
        <svg {...p}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    case 'bild':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M21 16l-5-5-8 8" />
        </svg>
      );
    // Warnung und Offline (22.10.2026): Ersatz für ⚠️ und 📴 in den Statusmeldungen (`CenterMessage`).
    case 'warnung':
      return (
        <svg {...p}>
          <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9.5v4.5M12 17.2v.3" />
        </svg>
      );
    case 'offline':
      return (
        <svg {...p}>
          <path d="M17.5 18.5a4.3 4.3 0 0 0 .4-8.6 6 6 0 0 0-11.8 1.2 3.8 3.8 0 0 0 .4 7.4h11Z" />
          <path d="M4 4l16 16" />
        </svg>
      );
    case 'music':
      return (
        <svg {...p}>
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      );
    case 'music-fill':
      return (
        <svg {...f}>
          <path d="M20 3.2a1.2 1.2 0 0 0-1.46-1.17l-10 2.2A1.2 1.2 0 0 0 7.6 5.4v9.04A4.2 4.2 0 1 0 10 18.2V9.16l8-1.76v4.28A4.2 4.2 0 1 0 20 15.5V3.2Z" />
        </svg>
      );
    case 'cog':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 18.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 14a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 3.6a1.7 1.7 0 0 0 1.03-1.56V2a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 3.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8v.05A1.7 1.7 0 0 0 21 9.09H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
        </svg>
      );
    // **Das Zahnrad von ChurchTools** (Alwin, 14.10.2026: „das Einstellungs-Icon an das von ChurchTools
    // anpassen“). ChurchTools zeigt „System-Einstellungen“ mit Font Awesome `fas fa-cog` (gemessen in der
    // Test-Instanz: „Font Awesome Pro“, Gewicht 900). Die Form hier ist dieselbe aus Font Awesome Free 6.5.2
    // („gear“, solid) – Icons: CC BY 4.0, https://fontawesome.com/license/free, © Fonticons, Inc.
    case 'zahnrad':
      return (
        <svg {...f} viewBox="0 0 512 512">
          <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z" />
        </svg>
      );
    case 'cog-fill':
      return (
        <svg {...f}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65a.49.49 0 0 0-.49-.42h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.32.61.22l2.49-1c.52.39 1.08.73 1.69.98l.38 2.65c.04.24.25.42.49.42h4c.24 0 .45-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.19.1.47.02.61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      );
    // „← Termine“ im Seitenkopf (Scheibe S, 26.10.2026) – Pfeil mit Schaft wie in ChurchTools.
    case 'pfeil-links':
      return (
        <svg {...p}>
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </svg>
      );
    case 'chev-left':
      return (
        <svg {...p}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case 'chev-right':
      return (
        <svg {...p}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case 'chev-down':
      return (
        <svg {...p}>
          <path d="M5 9l7 7 7-7" />
        </svg>
      );
    case 'search':
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'zoom-reset':
      return (
        <svg {...p}>
          <circle cx="10" cy="10" r="7" />
          <path d="M20 20l-4.3-4.3" />
          <path d="M7.6 9.2V7.6H9.2" />
          <path d="M10.8 7.6H12.4V9.2" />
          <path d="M7.6 10.8V12.4H9.2" />
          <path d="M12.4 10.8V12.4H10.8" />
        </svg>
      );
    case 'vollbild':
      return (
        <svg {...p}>
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      );
    case 'vollbild-aus':
      return (
        <svg {...p}>
          <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...p}>
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
        </svg>
      );
    case 'info':
      // Kleines ⓘ – „Woher kommt das?“ im Formular-Baukasten der Anmeldungen (14.10.2026).
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.6v.1" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      );
    case 'lock-open':
      // Wie `lock`, der Bügel nach oben links gelöst – „Ablauf öffnen" (09.10.2026).
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V7a4 4 0 0 1 7.6-1.8" />
        </svg>
      );
    case 'type':
      return (
        <svg {...p}>
          <path d="M4 6.5V5h16v1.5M9 19h6M12 5v14" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...p}>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
        </svg>
      );
    case 'check':
      return (
        <svg {...p}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'pencil':
      return (
        <svg {...p}>
          <path d="M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );
    // Werkzeuge des Liedblatts (02.10.2026): drei Regler wie in iOS – ein Knopf für Aussehen, Tempo,
    // Notizen von anderen und Anmerken.
    case 'regler':
      return (
        <svg {...p}>
          <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    // Ersatz für den ChurchTools-Zauberstab (`fa-magic`), wo dessen Schrift fehlt – Demo, NAS-App (E5-2).
    case 'zauberstab':
      return (
        <svg {...p}>
          <path d="M4 20 15 9M13.5 7.5l3 3" />
          <path d="M18 3v3M16.5 4.5h3M20 10v2M19 11h2M10 3v2M9 4h2" />
        </svg>
      );
    case 'columns':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M12 4.5v15" />
        </svg>
      );
    // Spaltenbreite der Matrix (Entwurf `e6-6-breiten-plus.html`): vier schmale bzw. zwei breite Spalten im Rahmen.
    case 'spalten-schmal':
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M7.5 4.5v15M12 4.5v15M16.5 4.5v15" />
        </svg>
      );
    case 'spalten-breit':
      return (
        <svg {...p}>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M12 4.5v15" />
        </svg>
      );
    case 'people':
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 6M16.5 14c2.5.3 4 2.2 4 5" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    // Person mit Schrägstrich – das Symbol, das ChurchTools selbst für „Abwesenheit eintragen" zeigt
    // (Alwin, 19.09.2026). Kopf, Schultern, Strich von links oben nach rechts unten.
    case 'user-slash':
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
          <path d="M4.5 4.5l15 15" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...p}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...p}>
          <path d="M4 12s3.5-6.5 8-6.5c1.3 0 2.5.3 3.5.8M20 12s-1.2 2.2-3.3 3.9" />
          <path d="M9.8 9.9a2.8 2.8 0 0 0 3.9 3.9" />
          <path d="M4.5 4.5l15 15" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...p}>
          <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      );
    case 'link':
      return (
        <svg {...p}>
          <path d="M9.5 14.5l5-5" />
          <path d="M11.5 7.5l1-1a4 4 0 0 1 5.66 5.66l-1 1" />
          <path d="M12.5 16.5l-1 1a4 4 0 0 1-5.66-5.66l1-1" />
        </svg>
      );
    case 'external':
      return (
        <svg {...p}>
          <path d="M14 5h5v5M19 5l-8 8" />
          <path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5" />
        </svg>
      );
    case 'share':
      return (
        <svg {...p}>
          <path d="M12 3v13" />
          <path d="M8 7l4-4 4 4" />
          <path d="M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...p}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
        </svg>
      );
    // Werkzeugleiste des Protokoll-Editors (Protokolle S4-1, Entwurf 7).
    case 'liste':
      return (
        <svg {...p}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case 'nummern':
      return (
        <svg {...p}>
          <path d="M10 6h10M10 12h10M10 18h10" />
          <path
            d="M4 4.5h1.5V9M4 9h3M4 14.5c.4-.6 1-1 1.7-1 .9 0 1.5.6 1.5 1.3 0 1.2-3.2 2.4-3.2 4.2h3.3"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'zitat':
      return (
        <svg {...p}>
          <path d="M4 5v14M9 7h11M9 12h11M9 17h7" />
        </svg>
      );
    case 'trennlinie':
      return (
        <svg {...p}>
          <path d="M7 6h10M7 18h10" strokeOpacity="0.45" />
          <path d="M3 12h18" />
        </svg>
      );
    case 'einruecken':
      return (
        <svg {...p}>
          <path d="M11 6h9M11 12h9M11 18h9M4 9l3 3-3 3" />
        </svg>
      );
    case 'ausruecken':
      return (
        <svg {...p}>
          <path d="M11 6h9M11 12h9M11 18h9M7 9l-3 3 3 3" />
        </svg>
      );
    case 'format-weg':
      return (
        <svg {...p}>
          <path d="M5 5.5V4h12v1.5M11 4l-3 14M6 18h5M15 14l5 5M20 14l-5 5" />
        </svg>
      );
    // Status eines To-Dos (offen · in Arbeit · erledigt) und Blöcke Aufgabe/Beschluss im Protokoll (S4-2, Entwurf 7).
    case 'kreis':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case 'kreis-halb':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
        </svg>
      );
    case 'kreis-haken':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.2 12.2 2.6 2.6 5-5.4" />
        </svg>
      );
    case 'aufgabe':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="7" height="7" rx="1.5" />
          <path d="m5.2 8 1.4 1.4 2.4-2.6M14 8h6.5M3.5 17h7M14 17h6.5" />
        </svg>
      );
    // Fester Punkt „Offene To-Dos“ (Protokolle S4-3a): Liste mit Haken.
    case 'todo-liste':
      return (
        <svg {...p}>
          <path d="m3.5 6.5 1.6 1.6 2.6-2.8M3.5 16.5l1.6 1.6 2.6-2.8M11 7h9.5M11 17h9.5M11 12h6" />
        </svg>
      );
    case 'stempel':
      return (
        <svg {...p}>
          <path d="M9 6.5a3 3 0 1 1 6 0c0 1.5-.8 2.3-.8 4.5h-4.4c0-2.2-.8-3-.8-4.5Z" />
          <rect x="4.5" y="13.5" width="15" height="4" rx="1.2" />
          <path d="M5.5 20.5h13" />
        </svg>
      );
    case 'heading':
      return (
        <svg {...p}>
          <path d="M6 4v16M18 4v16M6 12h12" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...p}>
          <path d="M5 12h14" />
        </svg>
      );
    // Metronom statt Viertelnote (#145): Das ♩ ist die richtige Schreibweise für eine Tempo-ANGABE,
    // sagt als Knopf aber nicht, dass dahinter etwas zum Mitlaufen steckt. Gehäuse, Standfuß,
    // Pendel und Gewicht – vier Striche, die jeder Musiker sofort liest.
    case 'metronome':
      return (
        <svg {...p}>
          {/* Trapez statt Dreieck und ein Pendel, das OBEN herausragt: Genau diese zwei Merkmale
              machen das Metronom auch bei 13 px noch erkennbar. Als reines Dreieck las es sich wie
              ein Warnzeichen. */}
          <path d="M10.6 5.2h2.8L18.5 20.5h-13z" />
          <path d="M7.4 16h9.2" />
          <path d="m11.4 18 4.4-15.4" />
          <path d="m12.6 13.8 2.6.8" />
        </svg>
      );
    // „Antippen": ein Finger, der auf eine Fläche tippt. Der erste Versuch waren ein Punkt und zwei
    // Bögen – das las sich als Klammerausdruck „(•)" und nicht als Geste. Die Hand ist eindeutig.
    case 'tap':
      return (
        <svg {...p}>
          <path d="M11 12.2V5.4a1.6 1.6 0 0 1 3.2 0v6.2" />
          <path d="M14.2 10.4a1.5 1.5 0 0 1 3 0v1.2" />
          <path d="M17.2 11.2a1.5 1.5 0 0 1 3 0v3.2a5.6 5.6 0 0 1-5.6 5.6h-1.4a4 4 0 0 1-3.1-1.5l-3-3.7a1.6 1.6 0 0 1 2.4-2.1l1.5 1.4" />
        </svg>
      );
    case 'play':
      return (
        <svg {...p}>
          <path d="M7.5 4.8 19 12 7.5 19.2Z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...p}>
          <path d="M9 5v14M15 5v14" />
        </svg>
      );
    case 'marker':
      return (
        <svg {...p}>
          <path d="m9 11-6 6v3h9l3-3" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      );
    case 'lasso':
      return (
        <svg {...p}>
          <path d="M7 22a5 5 0 0 1-2-4" />
          <path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1" />
          <path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      );
    case 'eraser':
      return (
        <svg {...p}>
          <path d="m7 21-4.3-4.3a1.7 1.7 0 0 1 0-2.4l9.3-9.3a1.7 1.7 0 0 1 2.4 0l5.6 5.6a1.7 1.7 0 0 1 0 2.4L13 21Z" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      );
    // Drucker und Brief: Druckliste und Rundmail (U2-1) – vorher die Zeichen ⎙ und ✉, am Handy kaum zu erkennen.
    case 'drucker':
      return (
        <svg {...p}>
          <path d="M7 9V3h10v6" />
          <rect x="3" y="9" width="18" height="8" rx="2" />
          <path d="M7 14h10v7H7z" />
        </svg>
      );
    case 'brief':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case 'download':
      return (
        <svg {...p}>
          <path d="M12 3v12M8 11l4 4 4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    // Wolke mit Häkchen: „liegt offline vor" (Termin-Badge, #32).
    case 'cloud-check':
      return (
        <svg {...p}>
          <path d="M17.5 18.5a4.3 4.3 0 0 0 .4-8.6 6 6 0 0 0-11.8 1.2 3.8 3.8 0 0 0 .4 7.4h11Z" />
          <path d="m9.2 13.7 2.1 2.1 3.9-3.9" />
        </svg>
      );
    // Wolke mit Pfeil nach unten: „für offline speichern/holen" (gleiche Wolke wie cloud-check,
    // damit beide als Familie lesbar sind – NICHT der Geräte-Download-Pfeil, #32).
    case 'cloud-download':
      return (
        <svg {...p}>
          <path d="M17.5 17.5a4.3 4.3 0 0 0 .4-8.6 6 6 0 0 0-11.8 1.2 3.8 3.8 0 0 0 .4 7.4" />
          <path d="M12 12v6M9.5 15.5 12 18l2.5-2.5" />
        </svg>
      );
    case 'refresh':
      // Zwei Pfeile im Kreis – „Ablauf aktualisiert" (12.10.2026).
      return (
        <svg {...p}>
          <path d="M20 11a8 8 0 0 0-14.6-4.5" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.6 4.5" />
          <path d="M20 20v-4h-4" />
        </svg>
      );
    case 'x':
      // Schließen – etwa für die Hinweisleiste über dem Ablauf (12.10.2026).
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...p}>
          <path d="M9 7l-5 5 5 5" />
          <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
        </svg>
      );
    case 'redo':
      return (
        <svg {...p}>
          <path d="M15 7l5 5-5 5" />
          <path d="M20 12H9a5 5 0 0 0 0 10h3" />
        </svg>
      );
    case 'grip':
      return (
        <svg {...f}>
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      );
    case 'align-left':
      return (
        <svg {...p}>
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
      );
    case 'align-center':
      return (
        <svg {...p}>
          <path d="M4 6h16M7 12h10M6 18h12" />
        </svg>
      );
    case 'align-right':
      return (
        <svg {...p}>
          <path d="M4 6h16M10 12h10M7 18h13" />
        </svg>
      );
    default:
      return null;
  }
}
