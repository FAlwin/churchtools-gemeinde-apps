import { Icon, type IconName } from '@ui/icons/icons';
import { hatChurchToolsSymbole } from './ctSchrift';

/**
 * **Ein Symbol genau wie in ChurchTools** (Alwin, 16.10.2026: „exakt das Icon von ChurchTools“). ChurchTools nutzt
 * Font Awesome **Pro** – die Zeichen dürfen wir nicht in unseren Code kopieren (Lizenz). Die Erweiterung läuft aber
 * in der ChurchTools-Seite, und dort ist die Schrift schon geladen (gemessen 16.10.: `fas fa-magic` und `fas fa-pen`
 * erscheinen in der Erweiterung wie im ChurchTools-Dienstplan). Wo sie fehlt (Demo, später die NAS-App), steht
 * das Ersatzsymbol aus unserem Satz.
 *
 * `info` und `paperclip` (T2b, Alwin 03.11.2026: „die Icons von ChurchTools direkt nehmen“) sind das „i“ und die
 * Büroklammer der Dienstplan-Liste (gemessen: `fas fa-info fa-fw`, `fas fa-paperclip fa-fw`, 14 px, Gewicht 900).
 * `exchange-alt` (E7-3) ist der Doppelpfeil fürs Tauschen – Font Awesome 5 wie `magic`.
 */
export type CtSymbolName = 'magic' | 'pen' | 'info' | 'paperclip' | 'exchange-alt';

const ERSATZ: Record<CtSymbolName, IconName> = {
  magic: 'zauberstab',
  pen: 'pencil',
  info: 'info',
  paperclip: 'anhang',
  'exchange-alt': 'refresh',
};

export function CtSymbol({ name, size }: { name: CtSymbolName; size: number }) {
  if (hatChurchToolsSymbole()) {
    return <i className={`fas fa-${name}`} aria-hidden style={{ fontSize: size, width: size }} />;
  }
  return <Icon name={ERSATZ[name]} size={size} />;
}
