import { type ReactNode } from 'react';
import { type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { terminZeile } from '@shared/anmeldung/termin';
import { SCHRIFT, textAufFarbe } from './daten';
import { titelbildGross } from '@shared/anmeldung/gestaltung';
import s from './AnmeldeFormular.module.scss';
import { adresseInInstanz } from '@shared/ct/sichereAdresse';

export interface Ansicht {
  /** Die ChurchTools-Instanz (`https://gemeinde.church.tools`) – das Logo kommt nur von dort (#849). */
  basis: string;
  name: string;
  gemeinde: string | null;
  einstellungen: OeffentlicheEinstellungen;
  /** Titelbild (Gruppenbild in ChurchTools), sonst das Bild der Vorlage. */
  bildUrl?: string | null;
  /** Freie Plätze, falls bekannt – angezeigt nach `plaetze.zeigen`. */
  freiePlaetze?: number | null;
  /** Gibt es eine Warteliste? (#602: Hinweis an der Person, die keinen Platz mehr bekommt.) */
  warteliste?: boolean;
  /** Letzter Anmeldetag, `YYYY-MM-DD`. */
  anmeldeschluss?: string | null;
}

const SYMBOLE = {
  leute:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2.5-1.5-4.2-4-4.8',
  uhr: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  preis: 'M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7c-2-4-6-4-6-1s6 1 6 1Zm0 0c2-4 6-4 6-1s-6 1-6 1Z',
} as const;

export function Symbol({ name }: { name: keyof typeof SYMBOLE }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={SYMBOLE[name]} />
    </svg>
  );
}

/**
 * **Der Rahmen des Formulars** – Gestaltung (Farben, Schriften, Aufbau), Kopf mit Logo und Titelbild, Seitenleiste.
 * Die EINE Stelle dafür: das Anmeldeformular und „Deine Anmeldung“ (A6-4) sehen gleich aus, ohne die Regeln zu
 * kopieren. `info` steht unter dem Kopf (Fakten, Begrüßung), `children` im Hauptbereich.
 */
export function FormularRahmen({
  ansicht,
  titel,
  kopfZusatz,
  info,
  children,
}: {
  ansicht: Ansicht;
  titel: ReactNode;
  kopfZusatz?: ReactNode;
  info?: ReactNode;
  children: ReactNode;
}) {
  const e = ansicht.einstellungen;
  const g = e.gestaltung;
  const unter = terminZeile(e);
  // Jede Einstellung eine Klasse bzw. eine Variable (Entwurf v3) – keine starren Vorlagen mehr.
  const mitBild = !!ansicht.bildUrl;
  // Das Logo nur aus der eigenen Instanz (#849): Die Adresse steht in der Gruppe und ist über die API änderbar – ein
  // fremder Host erführe sonst, wer das Formular ansieht. Das Schema kennt die Instanz nicht, deshalb hier.
  const logoUrl = g.logo !== 'keins' ? adresseInInstanz(g.logoUrl, ansicht.basis) : null;
  const logoOben = !!logoUrl && g.logoOrt === 'oben';
  const bildAlsSeite = mitBild && (g.hintergrund === 'bild' || g.aufbau === 'seite');
  const klassen = [
    s.pv,
    s[`a-${g.aufbau}`],
    s[`kh-${g.kopfHoehe}`],
    // Steht das Logo oben in der Mitte, steht auch der Titel mittig (Alwin, 14.10.2026) – sonst wirkt es schief.
    g.kopfAusrichtung === 'mitte' || logoOben ? s['kopf-mitte'] : '',
    s[`fs-${g.feldstil}`],
    s[`bt-${g.knoepfe}`],
    g.knopfVoll ? s['bt-voll'] : '',
    s[`br-${g.breite}`] ?? '',
    s[`ek-${g.ecken}`],
    g.schatten ? s.schatten : '',
    g.rahmen ? s.rahmen : '',
    g.bunt ? s.bunt : '',
    g.gross ? s.gross : '',
    g.hintergrund === 'muster' ? s[`m-${g.muster}`] : '',
    bildAlsSeite ? s['bild-seite'] : mitBild ? s['bild-kopf'] : '',
  ].join(' ');
  const stil = {
    '--p-accent': g.farbe,
    '--p-on-accent': textAufFarbe(g.farbe),
    '--p-page': g.seitenfarbe,
    // Text direkt auf der Seite (Hinweise, Begrüßung) muss auf der Seitenfarbe lesbar sein.
    '--p-auf-seite': bildAlsSeite ? '#ffffff' : textAufFarbe(g.seitenfarbe),
    '--p-card': g.kartenfarbe,
    '--p-text': g.schriftfarbe,
    '--p-muster': g.musterfarbe,
    '--p-head': SCHRIFT[g.kopfSchrift],
    '--p-body': SCHRIFT[g.textSchrift],
    ...(mitBild ? { '--user-img': `url("${titelbildGross(ansicht.bildUrl!)}")` } : {}),
  } as React.CSSProperties;
  const logo = logoUrl ? (
    <img
      className={`${s.logo} ${g.logoOrt === 'oben' ? s['logo-oben'] : ''}`}
      src={titelbildGross(logoUrl, 240)}
      alt=""
    />
  ) : null;

  return (
    <div className={klassen} style={stil}>
      <div className={s['pv-shell']}>
        <aside className={s.side}>
          <header className={s.hero}>
            <div
              className={`${s['hero-in']} ${g.logoOrt === 'links' && logo ? s['mit-logo-links'] : ''}`}
            >
              {logo}
              <div>
                <h1>{titel}</h1>
                <p className={s.sub}>{unter}</p>
              </div>
            </div>
            {kopfZusatz}
          </header>
          {info}
        </aside>
        <div className={s.main}>{children}</div>
      </div>
    </div>
  );
}
