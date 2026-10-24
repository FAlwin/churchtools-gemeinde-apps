/**
 * **Einfügen aus Word: Listen bleiben Listen** (Bauplan Protokolle S4-1, Alwin 24.10.2026). Word legt Aufzählungen
 * nicht als `<ul>`/`<ol>` in die Zwischenablage, sondern als Absätze mit `mso-list:l0 level2 lfo1` und einem
 * vorangestellten Zeichen („·“, „o“, „1.“) zwischen `<![if !supportLists]>` … `<![endif]>`. Der Editor machte daraus
 * im S0-Durchstich Absätze mit „·“ – die Einrückung ging verloren.
 *
 * Hier wird das HTML vor dem Einfügen umgebaut: Folgen solcher Absätze werden zu echten, verschachtelten Listen
 * (Ebene aus `levelN`, Art aus dem Zeichen: Zahl/Buchstabe mit Punkt oder Klammer → Nummerierung, sonst Aufzählung).
 * Alles andere bleibt, wie Word es liefert – den Rest erledigt der Editor beim Einfügen.
 */

/** Stammt das HTML aus Word (oder Outlook, das denselben Aufbau nutzt)? */
export function istWordHtml(html: string): boolean {
  return /mso-list|urn:schemas-microsoft-com:office/i.test(html);
}

const LISTE = /mso-list:\s*l\d+\s+level(\d+)/i;
const NUMMERIERT = /^(\d+|[a-z]|[ivxlcdm]+)[.)]$/i;

/** Ebene eines Word-Listenabsatzes (1, 2 …) – `null` für alles andere. */
function ebeneVon(el: Element): number | null {
  if (el.tagName !== 'P') return null;
  const m = LISTE.exec(el.getAttribute('style') ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Das vorangestellte Listenzeichen entfernen und zurückgeben. Word schließt es in `<![if !supportLists]>` ein (im
 * DOM: Kommentare); manche Fassungen markieren es stattdessen mit `mso-list:Ignore`.
 */
function zeichenEntfernen(p: Element): string {
  let zeichen = '';
  const kinder = [...p.childNodes];
  const start = kinder.findIndex(
    (n) => n.nodeType === 8 && /if\s+!supportLists/i.test(n.textContent ?? ''),
  );
  if (start >= 0) {
    for (let i = start; i < kinder.length; i++) {
      const n = kinder[i];
      const ende = n.nodeType === 8 && /endif/i.test(n.textContent ?? '');
      if (n.nodeType !== 8) zeichen += n.textContent ?? '';
      n.parentNode?.removeChild(n);
      if (ende) break;
    }
  } else {
    const ignore = [...p.querySelectorAll('span')].find((s) =>
      /mso-list:\s*Ignore/i.test(s.getAttribute('style') ?? ''),
    );
    if (ignore) {
      zeichen = ignore.textContent ?? '';
      ignore.remove();
    }
  }
  return zeichen.replace(/\u00a0/g, ' ').trim();
}

/** Die nächsten Geschwister-Elemente; Leerraum dazwischen zählt nicht. */
function naechstesElement(n: Node): Element | null {
  let x = n.nextSibling;
  while (x && x.nodeType !== 1) {
    if (x.nodeType === 3 && (x.textContent ?? '').trim()) return null;
    x = x.nextSibling;
  }
  return x as Element | null;
}

/** Eine Folge von Listenabsätzen (ab `erster`) durch eine verschachtelte Liste ersetzen. */
function folgeUmbauen(doc: Document, erster: Element): void {
  const absaetze: { el: Element; ebene: number }[] = [];
  for (let el: Element | null = erster; el; el = naechstesElement(el)) {
    const ebene = ebeneVon(el);
    if (ebene === null) break;
    absaetze.push({ el, ebene });
  }
  const stapel: { ebene: number; liste: Element; letzter: Element | null }[] = [];
  let wurzel: Element | null = null;
  for (const { el, ebene } of absaetze) {
    const zeichen = zeichenEntfernen(el);
    const art = NUMMERIERT.test(zeichen) ? 'ol' : 'ul';
    while (stapel.length && stapel[stapel.length - 1].ebene > ebene) stapel.pop();
    let oben = stapel[stapel.length - 1];
    if (!oben || oben.ebene < ebene) {
      const liste = doc.createElement(art);
      if (oben?.letzter) oben.letzter.appendChild(liste);
      else if (!wurzel) wurzel = liste;
      else wurzel.appendChild(liste); // tiefer eingestiegen als die erste Ebene – bleibt in derselben Liste
      oben = { ebene, liste, letzter: null };
      stapel.push(oben);
    }
    const li = doc.createElement('li');
    li.innerHTML = el.innerHTML;
    oben.liste.appendChild(li);
    oben.letzter = li;
  }
  if (wurzel) erster.parentNode?.insertBefore(wurzel, erster);
  for (const { el } of absaetze) el.remove();
}

/** Word-HTML mit echten Listen (aufgerufen nur für Word-HTML, `istWordHtml`). */
export function wordListenUmbauen(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // `<o:p>` ist Words leerer Absatz-Rest.
  for (const o of [...doc.getElementsByTagName('o:p')]) o.remove();
  for (;;) {
    const erster = [...doc.body.querySelectorAll('p')].find((p) => ebeneVon(p) !== null);
    if (!erster) break;
    folgeUmbauen(doc, erster);
  }
  return doc.body.innerHTML;
}
