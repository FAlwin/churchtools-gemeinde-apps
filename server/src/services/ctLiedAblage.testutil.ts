/**
 * Ein Lied, wie ChurchTools es nach Uploads und Löschungen liest – für die Server-Tests, die `fetch` nachbauen (#842).
 *
 * Seit dem 04.11.2026 liest `notenblaetter.ts` nach dem Hochladen nach und löscht die alte Fassung erst, wenn die neue
 * dasteht. Eine Attrappe, die nach dem Upload dasselbe Lied liefert wie vorher, spielt also den „lügenden Erfolg“ nach
 * (2xx, aber nichts angelegt) – und alle Tests des Normalfalls scheiterten daran. Diese Ablage verhält sich wie
 * gemessen: Eine hochgeladene Datei hängt danach mit **neuer ID** am Arrangement, gleiche Namen sind erlaubt, eine
 * gelöschte ist weg. `uploadVerschwindet` stellt den lügenden Erfolg gezielt nach.
 */

interface Datei {
  name: string;
  fileUrl: string;
}

interface LiedMitDateien {
  arrangements: { id: number; files: Datei[] }[];
}

const idVon = (d: Datei) => Number(new URL(d.fileUrl).searchParams.get('id'));

export function liedAblage<T extends LiedMitDateien>(
  lied: T,
  opts: {
    uploadVerschwindet?: boolean;
    basis?: string;
    /** ChurchTools legt die Datei unter einem anderen Namen ab als hochgeladen. */
    ablageName?: (hochgeladen: string) => string;
  } = {},
) {
  const basis = opts.basis ?? 'https://ct.test';
  let naechsteId = 9000;
  const neu = new Map<number, Datei[]>();
  const weg = new Set<number>();
  return {
    /** Nimmt Hochladen (`POST /api/files/song_arrangement/<id>`) und Löschen (`DELETE /api/files/<id>`) auf. */
    merke(url: string, init?: RequestInit): void {
      const method = init?.method ?? 'GET';
      const hoch = /\/api\/files\/song_arrangement\/(\d+)$/.exec(url);
      if (hoch && method === 'POST' && !opts.uploadVerschwindet && init?.body instanceof FormData) {
        const datei = init.body.get('files[]');
        if (datei instanceof File) {
          const liste = neu.get(Number(hoch[1])) ?? [];
          const name = opts.ablageName ? opts.ablageName(datei.name) : datei.name;
          liste.push({ name, fileUrl: `${basis}/?q=public/filedownload&id=${naechsteId++}` });
          neu.set(Number(hoch[1]), liste);
        }
      }
      const loeschen = /\/api\/files\/(\d+)$/.exec(url);
      if (loeschen && method === 'DELETE') weg.add(Number(loeschen[1]));
    },
    /** Das Lied, wie ChurchTools es jetzt liest. */
    lesen(): T {
      return {
        ...lied,
        arrangements: lied.arrangements.map((a) => ({
          ...a,
          files: [...a.files, ...(neu.get(a.id) ?? [])].filter((d) => !weg.has(idVon(d))),
        })),
      };
    },
  };
}
