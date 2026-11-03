/**
 * Ein nachgebautes `XMLHttpRequest` für Tests von `ctHochladen` – was gesendet wurde, und Knöpfe für das, was
 * ChurchTools tut: Fortschritt, fertig gesendet, antworten, Netzfehler. `FakeXhr.letzte` ist die zuletzt erzeugte.
 */
type Lauscher = ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null;

export class FakeXhr {
  static letzte: FakeXhr | null = null;
  static alle: FakeXhr[] = [];
  methode = '';
  url = '';
  kopf: Record<string, string> = {};
  rumpf: unknown = null;
  withCredentials = false;
  abgebrochen = false;
  status = 0;
  responseText = '';
  private antwortKopf = '';
  upload: { onprogress: Lauscher; onload: (() => void) | null } = {
    onprogress: null,
    onload: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeXhr.letzte = this;
    FakeXhr.alle.push(this);
  }
  open(methode: string, url: string): void {
    this.methode = methode;
    this.url = url;
  }
  setRequestHeader(name: string, wert: string): void {
    this.kopf[name] = wert;
  }
  send(rumpf: unknown): void {
    this.rumpf = rumpf;
  }
  abort(): void {
    this.abgebrochen = true;
  }
  getAllResponseHeaders(): string {
    return this.antwortKopf;
  }

  // ── Was ChurchTools tut ──
  fortschritt(loaded: number, total: number): void {
    this.upload.onprogress?.({ loaded, total, lengthComputable: true });
  }
  gesendet(): void {
    this.upload.onload?.();
  }
  antworte(status: number, body: unknown, kopf: Record<string, string> = {}): void {
    this.status = status;
    this.responseText = body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    this.antwortKopf = Object.entries({ 'content-type': 'application/json', ...kopf })
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    this.onload?.();
  }
  netzfehler(): void {
    this.onerror?.();
  }

  static zuruecksetzen(): void {
    FakeXhr.letzte = null;
    FakeXhr.alle = [];
  }
}
