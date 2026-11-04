/**
 * **Kein Hineinzoomen beim Antippen eines Felds am iPhone** (Alwin, 04.11.2026, Protokolle K3a: „wenn ich am Handy
 * doppelklicke, um zu tippen, wird leicht reingezoomt“).
 *
 * Safari auf iPhone und iPad vergrößert die Seite, sobald man in ein Feld mit Schrift unter 16 px tippt – im
 * Protokoll-Editor 15 px, in vielen Feldern aller Apps 15 px. Statt überall die Schrift zu vergrößern, sagt die Seite
 * `maximum-scale=1`: Das hält iOS vom Zoomen beim Antippen ab, das **Vergrößern mit zwei Fingern bleibt** (iOS
 * übergeht die Angabe dafür seit iOS 10). **Nur auf iOS** – Android-Browser würden damit auch das Fingerzoomen sperren.
 *
 * In der ChurchTools-Erweiterung gehört die Viewport-Angabe der Seite von ChurchTools; die Ergänzung gilt dann, solange
 * die Seite offen ist (auch für ChurchTools selbst – dort zoomt dann ebenfalls kein Feld mehr). Unsere PWA (Musik-App)
 * hat `maximum-scale` schon in ihrer `index.html`. Jede App ruft das beim Start auf (`main.tsx`, geprüft in
 * `tippZoom.test.ts`).
 */

type Geraet = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

/** iPhone/iPad (inkl. iPadOS 13+, das sich als „MacIntel“ mit Touch meldet). Vorher nur in der Musik-App (`pwaInstall`). */
export function istIos(n: Geraet = navigator): boolean {
  const iPhoneOderPad = /iphone|ipad|ipod/i.test(n.userAgent);
  const iPadOs13Plus = n.platform === 'MacIntel' && n.maxTouchPoints > 1;
  return iPhoneOderPad || iPadOs13Plus;
}

export function zoomBeimTippenAus(d: Document = document, n: Geraet = navigator): void {
  if (!istIos(n)) return;
  let meta = d.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = d.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    d.head.append(meta);
  }
  const ohne = meta.content
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !/^maximum-scale\s*=/i.test(t));
  meta.content = [...ohne, 'maximum-scale=1'].join(', ');
}
