/**
 * **Wie eine Datei am Termin aussieht** (T2a): Symbol und Zeile darunter – über dieselbe Erkennung wie bei den
 * Lied-Dateien (`fileKind`, `DATEI_SYMBOL`, `dateiGroesse`), nicht über eigene.
 */
import { fileKind } from '@shared/ct/arrangementFiles';
import type { TerminDatei } from '@shared/ct/terminDateien';
import type { IconName } from '../icons/icons';
import { DATEI_ART, DATEI_SYMBOL } from '../lied/dateiAnzeige';
import { dateiGroesse } from '../lied/dateiGroesse';

export function terminDateiAnzeige(d: TerminDatei): { symbol: IconName; unter: string } {
  if (d.art === 'link') {
    let host = '';
    try {
      host = new URL(d.url).host;
    } catch {
      /* keine lesbare Adresse – nur „Link“ */
    }
    return { symbol: 'link', unter: host ? `Link · ${host}` : 'Link' };
  }
  const art = fileKind({ name: d.name, fileUrl: d.url });
  // Die ChordPro-Arten meinen Lied-Dateien („daraus entsteht das Notenblatt“) – am Termin ist es einfach eine Datei.
  const teile = [art === 'pdf' || art === 'image' ? DATEI_ART[art] : DATEI_ART.other];
  if (d.groesse !== null) teile.push(dateiGroesse(d.groesse));
  return { symbol: DATEI_SYMBOL[art], unter: teile.join(' · ') };
}
