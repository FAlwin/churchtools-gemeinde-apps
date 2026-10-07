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
  /** Was geschrieben wurde – mit Rumpf und CSRF-Kopfzeile, zum Nachsehen statt Glauben. */
  geschrieben: { was: string; json: unknown; csrf: string | null }[] = [];

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
      const csrf = new Headers(init?.headers).get('CSRF-Token');
      this.geschrieben.push({ was, json: rumpf, csrf });
      return this.schreibAntworten[was]?.() ?? this.json(200, { data: {} });
    }
    return this.json(404, { message: `Unbekannt: ${method} ${pfad}` });
  }
}
