import type { Plugin } from 'vite';

/**
 * ChurchTools übernimmt von unserer `index.html` nur den **Inhalt** in die eigene Seite – der Kopf
 * mit `<script>` und `<link rel="stylesheet">` fällt weg (gemessen 07.10.2026, Plan §2a). Im
 * Extension-Build wandern sie deshalb ans Ende des Inhalts. Die Pfade sind über `base` ohnehin
 * absolut (`/ccm/<Kürzel>/…`) – relative zeigten wegen ChurchTools' `<base href>` ins Leere.
 *
 * Gilt für jede Erweiterung dieses Repos (#474, aus `client/vite.config.ts` hierher gezogen).
 */
export function kopfInDenInhalt(): Plugin {
  return {
    name: 'ct-extension-kopf-in-den-inhalt',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const tags: string[] = [];
        const ohne = html.replace(
          /<head>([\s\S]*?)<\/head>/,
          (_m, kopf: string) =>
            `<head>${kopf.replace(
              /<script type="module"[^>]*><\/script>|<link rel="(?:stylesheet|modulepreload)"[^>]*>/g,
              (tag) => {
                tags.push(tag);
                return '';
              },
            )}</head>`,
        );
        // Inline-Skripte (der Start-Hinweis) verbietet die CSP von ChurchTools ohnehin – raus damit,
        // statt bei jedem Öffnen eine Fehlermeldung in der Konsole zu erzeugen.
        const ohneInline = ohne.replace(/<script>[\s\S]*?<\/script>/g, '');
        return ohneInline.replace('</body>', `${tags.join('\n')}\n</body>`);
      },
    },
  };
}
