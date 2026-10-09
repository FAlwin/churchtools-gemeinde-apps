import { BlockList, isIP } from 'node:net';

/**
 * Welchen Zwischenstationen glaubt die App die `X-Forwarded-For`-Angabe? (`trust proxy`, #214, #459)
 *
 * Davon hängt das Login-Limit ab (`routes/auth.ts`): Vor dem Anmelden gibt es keine Sitzung, nur die
 * IP. Ist `req.ip` für alle gleich, teilen sich alle EIN Kontingent – 50 Fehlversuche von außen
 * sperrten dann die Anmeldung für die ganze Gemeinde.
 *
 * **Warum `'loopback'` nicht reichte (#459):** Prod läuft in Docker mit `127.0.0.1:3001:3001`. Der
 * Reverse-Proxy des NAS spricht 127.0.0.1 an, im Container kommt die Verbindung aber vom
 * **Docker-Gateway** (172.x.0.1) – nicht von Loopback. Dem wurde nicht vertraut, also war `req.ip`
 * das Gateway, für jede Anfrage dasselbe. Ein Cloudflare-Tunnel im selben Docker-Netz (andere
 * Gemeinden) sieht genauso aus: privat, nicht Loopback.
 *
 * **Die Regel:** Der DIREKTE Nachbar (Hop 0 = die Verbindung selbst) darf lokal ODER privat sein –
 * das ist der eigene Proxy, Docker oder der Tunnel. Jeder WEITERE Hop in `X-Forwarded-For` nur lokal
 * (ein zweiter Proxy auf derselben Maschine). So zählt die Adresse, die der eigene Proxy gesehen hat;
 * was ein Client selbst in die Kopfzeile schreibt, steht links davon und wird nie erreicht – auch
 * nicht von einem Gerät im eigenen WLAN (dessen Adresse ist privat, aber eben nicht Hop 0).
 */
const lokal = new BlockList();
lokal.addSubnet('127.0.0.0', 8, 'ipv4');
lokal.addAddress('::1', 'ipv6');

const privat = new BlockList();
privat.addSubnet('10.0.0.0', 8, 'ipv4');
privat.addSubnet('172.16.0.0', 12, 'ipv4');
privat.addSubnet('192.168.0.0', 16, 'ipv4');
privat.addSubnet('fc00::', 7, 'ipv6'); // eindeutige lokale IPv6-Adressen

function liegtIn(liste: BlockList, addr: string): boolean {
  const art = isIP(addr);
  if (art === 0) return false;
  // `check` erkennt auch IPv4-mapped-IPv6 (`::ffff:172.18.0.1`) – so schreibt Node die Adresse oft.
  return liste.check(addr, art === 4 ? 'ipv4' : 'ipv6');
}

/** Für Express: `app.set('trust proxy', vertrauterProxy)`. `hop` 0 ist die Verbindung selbst. */
export function vertrauterProxy(addr: string, hop: number): boolean {
  if (liegtIn(lokal, addr)) return true;
  return hop === 0 && liegtIn(privat, addr);
}
