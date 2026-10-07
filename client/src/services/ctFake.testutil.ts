/**
 * Ein nachgebautes ChurchTools für die Tests der Extension (#334, #335) – nur die Endpunkte, die
 * `ctRuntime`/`personenAblage`/`ctLesen`/`ctSchreiben` nutzen, mit dem Verhalten, das am 07.10.2026 auf der Test-Instanz
 * gemessen wurde: aufsteigende Datei-IDs, gleiche Namen erlaubt, fremde Person → 403 mit
 * ChurchTools-Rumpf, Herunterladen über die `fileUrl`.
 *
 * Fehler lassen sich gezielt einschalten, damit jede Härtung ihre eigene Gegenprobe bekommt.
 */
import { vi } from 'vitest';

export const BASIS = 'https://ct.test';

/** Die Adresse einer fetch-Anfrage – ob als Text, URL oder Request übergeben. */
export function urlVon(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

interface FakeDatei {
  id: number;
  personId: number;
  name: string;
  inhalt: Uint8Array;
}

export class FakeCt {
  ich = 19;
  dateien: FakeDatei[] = [];
  private naechsteId = 100;
  /** Aufrufe als „METHODE pfad" – zum Zählen. */
  aufrufe: string[] = [];
  /** Hochladen meldet Erfolg, legt aber nichts ab (lügender Erfolg, Lehre 11.08.2026). */
  uploadVerschwindet = false;
  /** Löschen scheitert vorübergehend (500). */
  loeschenScheitert = false;
  /** Herunterladen scheitert mit einem Netzfehler. */
  herunterladenScheitert = false;
  /** Hochladen an sich selbst verboten (fehlendes Recht) – Antwort wie ChurchTools: 401 + whoami ok. */
  hochladenVerboten = false;
  /** Weitere GET-Antworten je Pfad (ohne Basis), z. B. `/api/events/1/agenda` → `{ data: … }`. */
  antworten: Record<string, () => Response> = {};
  /**
   * Antworten auf Schreibvorgänge (#335, 3b) je „METHODE pfad" ohne Basis, z. B.
   * `PUT /api/events/1/agenda`. Ohne Eintrag: 200 `{ data: {} }`.
   */
  schreibAntworten: Record<string, () => Response> = {};
  /**
   * Was geschrieben wurde – mit Rumpf und CSRF-Kopfzeile, zum Nachsehen statt Glauben. `felder` bei
   * der alten Schnittstelle (Formular-Felder), `datei` bei einem Upload (`files[]`).
   */
  geschrieben: {
    was: string;
    json: unknown;
    csrf: string | null;
    felder?: Record<string, string>;
    datei?: File;
    xrw?: string | null;
  }[] = [];

  /**
   * Der Datenbereich der Erweiterung (3b-4), wie gemessen (Plan §2c): Module nur als Liste, Kategorien
   * und Werte mit aufsteigenden IDs, ein Wert als Text.
   */
  module: { id: number; shorty: string }[] = [{ id: 10, shorty: 'musik-app' }];
  kategorien: { id: number; customModuleId: number; name: string; shorty: string }[] = [];
  werte: { id: number; dataCategoryId: number; value: string }[] = [];
  /** Ohne „Kategorien sehen": ChurchTools liefert eine LEERE Liste, keinen Fehler. */
  kategorienUnsichtbar = false;
  /** Schreiben eines Werts meldet Erfolg, ändert aber nichts (lügender Erfolg). */
  wertSchreibenVerschwindet = false;
  /** Schreiben im Datenbereich verboten – wie ChurchTools: 401 + whoami ok. */
  datenSchreibenVerboten = false;

  /** Eine JSON-Antwort für einen Pfad hinterlegen. */
  liefere(pfad: string, body: unknown, status = 200, headers: Record<string, string> = {}): void {
    this.antworten[pfad] = () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
  }

  /** Eine Datei ablegen, als käme sie von einem anderen Gerät desselben Kontos. */
  ablegen(name: string, inhalt: string | Uint8Array, personId = this.ich): number {
    const id = this.naechsteId++;
    const bytes = typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt;
    this.dateien.push({ id, personId, name, inhalt: bytes });
    return id;
  }

  namen(personId = this.ich): string[] {
    return this.dateien.filter((d) => d.personId === personId).map((d) => d.name);
  }

  text(id: number): string {
    const d = this.dateien.find((x) => x.id === id);
    return d ? new TextDecoder().decode(d.inhalt) : '';
  }

  zaehle(praefix: string): number {
    return this.aufrufe.filter((a) => a.startsWith(praefix)).length;
  }

  installieren(): void {
    vi.stubGlobal('window', {
      settings: { base_url: `${BASIS}/` },
      location: { origin: 'https://falsch.test' },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      this.antwort(urlVon(input), init),
    );
  }

  private json(status: number, body: unknown): Response {
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Module, Kategorien und Werte der Erweiterung – `null`, wenn der Pfad nicht dazugehört. */
  private datenbereich(method: string, pfad: string, init?: RequestInit): Response | null {
    const rumpf = () =>
      (typeof init?.body === 'string' ? JSON.parse(init.body) : {}) as {
        customModuleId?: unknown;
        name?: unknown;
        shorty?: unknown;
        value?: unknown;
      };
    const schreiben = method !== 'GET';
    if (schreiben && this.datenSchreibenVerboten && pfad.startsWith('/api/custommodules/')) {
      return this.json(401, { message: 'Die Session ist abgelaufen.' });
    }
    if (pfad === '/api/custommodules' && method === 'GET')
      return this.json(200, { data: this.module });
    const kat = pfad.match(/^\/api\/custommodules\/(\d+)\/customdatacategories$/);
    if (kat) {
      const modul = Number(kat[1]);
      if (method === 'GET') {
        const sichtbar = this.kategorienUnsichtbar ? [] : this.kategorien;
        return this.json(200, { data: sichtbar.filter((k) => k.customModuleId === modul) });
      }
      const b = rumpf();
      if (
        b.customModuleId !== modul ||
        typeof b.name !== 'string' ||
        typeof b.shorty !== 'string'
      ) {
        return this.json(400, { message: 'customModuleId, name, shorty fehlen' });
      }
      const neu = {
        id: this.naechsteId++,
        customModuleId: modul,
        name: b.name,
        shorty: b.shorty,
      };
      this.kategorien.push(neu);
      return this.json(201, { data: neu });
    }
    const werte = pfad.match(
      /^\/api\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/,
    );
    if (werte) {
      const katId = Number(werte[1]);
      if (method === 'GET') {
        return this.json(200, { data: this.werte.filter((w) => w.dataCategoryId === katId) });
      }
      if (method === 'DELETE') {
        // Gemessen: 204, ein zweites Mal 404.
        const vorher = this.werte.length;
        this.werte = this.werte.filter((x) => x.id !== Number(werte[2]));
        return this.werte.length < vorher ? this.json(204, null) : this.json(404, {});
      }
      const b = rumpf();
      if (typeof b.value !== 'string') return this.json(400, { message: 'value fehlt' });
      const value = b.value;
      if (method === 'POST') {
        const neu = { id: this.naechsteId++, dataCategoryId: katId, value };
        if (!this.wertSchreibenVerschwindet) this.werte.push(neu);
        return this.json(201, { data: { id: neu.id } });
      }
      if (method === 'PUT') {
        const w = this.werte.find((x) => x.id === Number(werte[2]));
        if (!w) return this.json(404, { message: 'Not found' });
        if (!this.wertSchreibenVerschwindet) w.value = value;
        return this.json(200, { data: w });
      }
    }
    return null;
  }

  private async antwort(url: string, init?: RequestInit): Promise<Response> {
    const method = init?.method ?? 'GET';
    const pfad = url.replace(BASIS, '');
    this.aufrufe.push(`${method} ${pfad}`);

    const download = pfad.match(/^\/\?q=public\/filedownload&id=(\d+)$/);
    if (download) {
      if (this.herunterladenScheitert) throw new TypeError('Failed to fetch');
      const d = this.dateien.find((x) => x.id === Number(download[1]));
      if (!d) return this.json(404, { message: 'Not found' });
      return new Response(new Uint8Array(d.inhalt), {
        status: 200,
        headers: { 'Content-Type': 'application/unknown' },
      });
    }
    const hinterlegt = this.antworten[pfad.split('?')[0]] ?? this.antworten[pfad];
    if (hinterlegt && method === 'GET') return hinterlegt();
    if (pfad === '/api/whoami') return this.json(200, { data: { id: this.ich } });
    if (pfad === '/api/csrftoken') return this.json(200, { data: 'csrf-123' });

    const daten = this.datenbereich(method, pfad, init);
    if (daten) return daten;

    const person = pfad.match(/^\/api\/files\/person\/(\d+)$/);
    if (person && method === 'GET') {
      const pid = Number(person[1]);
      return this.json(200, {
        data: this.dateien
          .filter((d) => d.personId === pid)
          .map((d) => ({
            id: d.id,
            name: d.name,
            fileUrl: `${BASIS}/?q=public/filedownload&id=${d.id}`,
          })),
      });
    }
    if (person && method === 'POST') {
      const pid = Number(person[1]);
      if (pid !== this.ich) {
        return this.json(403, {
          message: 'Forbidden to edit person files',
          messageKey: 'error.forbidden.edit',
        });
      }
      if (this.hochladenVerboten) {
        return this.json(401, { message: 'Keine ausreichende Berechtigung.' });
      }
      const datei = (init?.body as FormData).get('files[]') as File;
      if (!this.uploadVerschwindet) {
        this.ablegen(datei.name, new Uint8Array(await datei.arrayBuffer()), pid);
      }
      return this.json(200, { data: [] });
    }
    const loeschen = pfad.match(/^\/api\/files\/(\d+)$/);
    if (loeschen && method === 'DELETE') {
      if (this.loeschenScheitert) return this.json(500, { message: 'Serverfehler' });
      const id = Number(loeschen[1]);
      const vorher = this.dateien.length;
      this.dateien = this.dateien.filter((d) => d.id !== id);
      return this.dateien.length < vorher ? this.json(204, null) : this.json(404, {});
    }
    if (method !== 'GET') {
      const was = `${method} ${pfad}`;
      const rumpf = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      const kopf = new Headers(init?.headers);
      const csrf = kopf.get('CSRF-Token');
      const felder =
        init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : undefined;
      const teil = init?.body instanceof FormData ? init.body.get('files[]') : null;
      // Nur, was es gibt – sonst müsste jeder Test, der einen JSON-Schreibvorgang vergleicht, leere
      // Felder mitschreiben.
      this.geschrieben.push({
        was,
        json: rumpf,
        csrf,
        ...(felder ? { felder } : {}),
        ...(teil instanceof File ? { datei: teil } : {}),
        ...(kopf.has('X-Requested-With') ? { xrw: kopf.get('X-Requested-With') } : {}),
      });
      return this.schreibAntworten[was]?.() ?? this.json(200, { data: {} });
    }
    return this.json(404, { message: `Unbekannt: ${method} ${pfad}` });
  }
}
