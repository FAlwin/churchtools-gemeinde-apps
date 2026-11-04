// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { istIos, zoomBeimTippenAus } from './tippZoom';

const IPHONE = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
};
const IPAD = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.7 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
};
const MAC = { ...IPAD, maxTouchPoints: 0 };
const ANDROID = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
};

const viewport = () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content;
function mitViewport(content: string): void {
  const m = document.createElement('meta');
  m.name = 'viewport';
  m.content = content;
  document.head.append(m);
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('Kein Zoom beim Antippen am iPhone (K3a)', () => {
  it('erkennt iPhone und iPad (auch iPadOS als „MacIntel“ mit Touch), nicht Mac und Android', () => {
    expect(istIos(IPHONE)).toBe(true);
    expect(istIos(IPAD)).toBe(true);
    expect(istIos(MAC)).toBe(false);
    expect(istIos(ANDROID)).toBe(false);
  });

  it('iPhone: ergänzt maximum-scale=1, der Rest der Angabe bleibt', () => {
    mitViewport('width=device-width, initial-scale=1.0, viewport-fit=cover');
    zoomBeimTippenAus(document, IPHONE);
    expect(viewport()).toBe(
      'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1',
    );
  });

  it('ein anderes maximum-scale wird ersetzt, nicht doppelt angehängt – auch beim zweiten Aufruf', () => {
    mitViewport('width=device-width, maximum-scale=5');
    zoomBeimTippenAus(document, IPAD);
    zoomBeimTippenAus(document, IPAD);
    expect(viewport()).toBe('width=device-width, maximum-scale=1');
  });

  it('ohne Viewport-Angabe legt es eine an', () => {
    zoomBeimTippenAus(document, IPHONE);
    expect(viewport()).toBe('width=device-width, initial-scale=1, maximum-scale=1');
  });

  it('Android und Mac: nichts ändern – dort sperrte maximum-scale auch das Fingerzoomen', () => {
    mitViewport('width=device-width, initial-scale=1.0');
    zoomBeimTippenAus(document, ANDROID);
    zoomBeimTippenAus(document, MAC);
    expect(viewport()).toBe('width=device-width, initial-scale=1.0');
  });
});
