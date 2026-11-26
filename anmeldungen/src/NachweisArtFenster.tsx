import { useRef, useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { useLaden } from '@ui/ct/useLaden';
import { PersonenSuche } from '@ui/bedienung/PersonenSuche';
import {
  NACHWEIS_JAHRE_MAX,
  NACHWEIS_JAHRE_MIN,
  NACHWEIS_NAME_MAX,
  nachweisEinstellungenFehler,
  nachweisNameFehler,
  type NachweisAb,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import {
  antragVorgabe,
  nachweisMailVorgabe,
  type NachweisAntrag,
} from '@shared/anmeldung/nachweisAntrag';
import { AntragAbschnitt, type AntragFormular } from './AntragAbschnitt';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import {
  NACHWEIS_SCHRITTE,
  NACHWEIS_SCHRITT_TEXT,
  antragLaden,
  gemeindeLogoLaden,
  ichLaden,
  nachweisArtSichern,
  type NachweisArt,
  type NachweisErgebnis,
  type Vertrauensperson,
} from './nachweisArten';
import type { NachweisGrundlage } from './nachweise';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import n from './Nachweise.module.scss';

/** Die Vorgabe des Betreffs für eine neue Art – frei änderbar; der Text (`nachweisMailVorgabe`) nennt bei „Mit Antrag“ den Weg zur Bescheinigung. */
const VORLAGE_BETREFF = 'Bitte Nachweis vorlegen';

/**
 * **„Nachweis-Art“** (N1b, Entwurf `n-nachweise-v2`, Ansicht 3) – anlegen und bearbeiten: Name, Gültigkeit, die Aufforderung an
 * die Person und die Vertrauenspersonen. Dazu der **Antrag als Bescheinigung** (N1c: Baukasten mit A4-Vorschau; N1d: eigene PDF mit ziehbaren Platzhaltern).
 *
 * Gespeichert wird alles in ChurchTools (`nachweisArtSichern`) und danach nachgelesen. **Scheitert ein Schritt**, bleibt das
 * Fenster offen und sagt, was steht und was fehlt; „Nochmal“ legt nichts doppelt an (das Fenster merkt sich die Gruppe).
 * Eine Vertrauensperson wird nur auf ausdrücklichen Klick entfernt („Entfernen“, bei Gespeichertem erst beim Speichern).
 */
export function NachweisArtFenster({
  art,
  grundlage,
  gemeinde = null,
  onClose,
  onFertig,
}: {
  /** `null`: neue Art. */
  art: NachweisArt | null;
  grundlage: NachweisGrundlage;
  /** Name der Gemeinde – Vorgabe für den Briefkopf des Antrags. */
  gemeinde?: string | null;
  onClose: () => void;
  /** Alles gespeichert und nachgelesen – die Seite lädt neu. */
  onFertig: (text: string) => void;
}) {
  const ichStand = useLaden(() => ichLaden(), []).stand;
  const ich = ichStand.art === 'fertig' ? ichStand.daten : null;

  const [name, setName] = useState(art?.name ?? '');
  const [jahre, setJahre] = useState<number | null>(art?.einstellungen?.gueltigJahre ?? 3);
  const [ab, setAb] = useState<NachweisAb>(art?.einstellungen?.ab ?? 'ausstellung');
  const [betreff, setBetreff] = useState(art?.einstellungen?.betreff ?? VORLAGE_BETREFF);
  // Der Text der Mail: Eine neue Art folgt der Vorgabe (sie nennt den Namen der Art und den Weg zum Antrag), bis jemand selbst schreibt.
  const [eigenerText, setEigenerText] = useState<string | null>(art?.einstellungen?.text ?? null);

  // Der Antrag (N1c): Texte kommen in den Datenblock der Art, die Bilder nur ins HTML der Vorlage.
  const antragArt = art?.einstellungen?.antrag;
  const antragVorg = antragVorgabe(gemeinde);
  const [antrag, setAntrag] = useState<AntragFormular>({
    an: art ? (antragArt?.an ?? false) : true,
    logo: antragArt?.logo ?? antragVorg.logo,
    briefkopf: antragArt?.briefkopf ?? antragVorg.briefkopf,
    ueberschrift: antragArt?.ueberschrift ?? antragVorg.ueberschrift,
    text: antragArt?.text ?? antragVorg.text,
    logoBild: antragArt?.vorlageId ? { art: 'unveraendert' } : { art: 'keins' },
    unterschrift: antragArt?.vorlageId ? { art: 'unveraendert' } : { art: 'keins' },
    art: antragArt?.art ?? 'baukasten',
    hintergrund:
      antragArt?.vorlageId && antragArt.art === 'pdf' ? { art: 'unveraendert' } : { art: 'keins' },
    seite: antragArt?.pdf ?? null,
    pdfName: null,
    pdfHinweis: null,
  });
  const [vorlageId, setVorlageId] = useState<number | null>(antragArt?.vorlageId ?? null);
  const text = eigenerText ?? nachweisMailVorgabe(name, antrag.an);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Die Vertrauenspersonen: bei einer neuen Art zuerst die Person, die gerade anlegt.
  const [eigene, setEigene] = useState<Vertrauensperson[] | null>(null);
  const liste = eigene ?? (art ? (art.vertrauen ?? []) : ich ? [ich] : []);
  /** Schon gespeicherte Vertrauenspersonen, die beim Speichern entfernt werden sollen (Klick auf „Entfernen“). */
  const [entfernen, setEntfernen] = useState<Set<number>>(new Set());
  const gespeichertSind = new Set((art?.vertrauen ?? []).map((p) => p.personId));
  const bleiben = liste.filter((p) => !entfernen.has(p.personId));

  const [gruppeId, setGruppeId] = useState<number | null>(art?.id ?? null);
  const [arbeitet, setArbeitet] = useState(false);
  const [eingabeFehler, setEingabeFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<NachweisErgebnis | null>(null);

  const gemeindeLogoStand = useLaden(() => gemeindeLogoLaden(), []).stand;
  const gemeindeLogo =
    gemeindeLogoStand.art === 'fertig'
      ? gemeindeLogoStand.daten
      : gemeindeLogoStand.art === 'fehler'
        ? null
        : undefined;
  const bisherStand = useLaden(
    () => (antragArt?.vorlageId ? antragLaden(antragArt.vorlageId) : null),
    [antragArt?.vorlageId],
  ).stand;
  const bisher =
    bisherStand.art === 'fertig' ? bisherStand.daten : bisherStand.art === 'laedt' ? 'laedt' : null;

  // Nur eine Art mit Antrag (oder die schon einen hatte) trägt ihn im Datenblock; „aus“ behält die Nummer der Vorlage.
  const antragDaten: NachweisAntrag | undefined =
    antrag.an || antragArt
      ? {
          an: antrag.an,
          logo: antrag.logo,
          briefkopf: antrag.briefkopf,
          ueberschrift: antrag.ueberschrift,
          text: antrag.text,
          vorlageId,
          // Gespeichert wird die gewählte Art; Seite und Platzhalter der PDF nur, wenn sie gewählt ist.
          ...(antrag.art === 'pdf'
            ? { art: 'pdf' as const, ...(antrag.seite ? { pdf: antrag.seite } : {}) }
            : {}),
        }
      : undefined;
  const einstellungen: NachweisEinstellungen = {
    gueltigJahre: jahre ?? 0,
    ab,
    betreff,
    text,
    ...(antragDaten ? { antrag: antragDaten } : {}),
  };
  const fehler =
    nachweisNameFehler(name) ??
    nachweisEinstellungenFehler(einstellungen) ??
    (antrag.an && antrag.art === 'pdf' && antrag.hintergrund.art === 'keins'
      ? 'Bitte eine PDF mit dem Antragsformular wählen.'
      : null) ??
    (bleiben.length === 0 ? 'Bitte mindestens eine Vertrauensperson eintragen.' : null);

  const hinzu = (p: Vertrauensperson) => {
    setEntfernen((x) => {
      const neu = new Set(x);
      neu.delete(p.personId);
      return neu;
    });
    if (!liste.some((x) => x.personId === p.personId)) setEigene([...liste, p]);
  };
  const weg = (p: Vertrauensperson) => {
    // Gespeicherte erst beim Speichern entfernen (und bis dahin zurückholen); eben Hinzugefügte einfach aus der Liste.
    if (gespeichertSind.has(p.personId))
      setEntfernen((x) => {
        const neu = new Set(x);
        if (neu.has(p.personId)) neu.delete(p.personId);
        else neu.add(p.personId);
        return neu;
      });
    else setEigene(liste.filter((x) => x.personId !== p.personId));
  };

  async function speichern() {
    if (fehler) return setEingabeFehler(fehler);
    setArbeitet(true);
    setEingabeFehler(null);
    try {
      const erg = await nachweisArtSichern(
        {
          gruppeId,
          name,
          einstellungen,
          vertrauen: bleiben.map((p) => p.personId),
          entfernen: [...entfernen],
          antragBilder: {
            logo: antrag.logoBild,
            unterschrift: antrag.unterschrift,
            hintergrund: antrag.hintergrund,
          },
        },
        ich?.personId ?? null,
      );
      // Die Gruppe merken – „Nochmal“ nach einem Teilerfolg findet sie wieder und legt keine zweite an.
      setGruppeId(erg.gruppeId);
      // Ebenso die Vorlage des Antrags – „Nochmal“ legt keine zweite an.
      if (erg.vorlageId !== null) setVorlageId(erg.vorlageId);
      setErgebnis(erg);
    } catch (e) {
      // Eingabefehler und „gibt es schon“: vor dem Schreiben abgewiesen, es steht nichts in ChurchTools.
      setEingabeFehler(fehlerMeldung(e).text);
    }
    setArbeitet(false);
  }

  const alleErledigt =
    ergebnis !== null && NACHWEIS_SCHRITTE.every((s) => ergebnis.erledigt.includes(s));

  // ── Ergebnis: alles geschrieben und nachgelesen ──
  if (ergebnis && alleErledigt) {
    const b = ergebnis.befund;
    const titel = `„${name.trim()}“ ${art ? 'gespeichert' : 'angelegt'}`;
    return (
      <Sheet
        title={art ? 'Nachweis-Art gespeichert' : 'Nachweis-Art angelegt'}
        onClose={() => onFertig(`${titel}.`)}
        cancelLabel={null}
        knoepfe={<FensterKnopf onClick={() => onFertig(`${titel}.`)}>Fertig</FensterKnopf>}
      >
        <p className={f.hinweis}>In ChurchTools nachgelesen:</p>
        {b ? (
          <ul className={n.schritte} aria-label="Nachgelesen">
            <li>
              <span className={n.fertig} aria-hidden="true">
                ✓
              </span>
              Gruppe „{b.gruppenName}“ (Nummer {b.gruppeId}), eingeschränkt sichtbar
            </li>
            <li>
              <span className={n.fertig} aria-hidden="true">
                ✓
              </span>
              Angaben je Person: {b.felder.join(', ')}
            </li>
            <li>
              <span className={n.fertig} aria-hidden="true">
                ✓
              </span>
              Vertrauenspersonen: {b.vertrauen.map((p) => p.name).join(', ')}
            </li>
            <li>
              <span className={b.ablauf?.an ? n.fertig : n.fehlt} aria-hidden="true">
                {b.ablauf?.an ? '✓' : '✗'}
              </span>
              {b.ablauf
                ? `Ablauf mit ${b.ablauf.schritte} Schritten, ${b.ablauf.an ? 'eingeschaltet' : 'ausgeschaltet'}`
                : 'Ablauf nicht gefunden'}
            </li>
            {b.antrag && (
              <li>
                <span className={b.antrag.haengt ? n.fertig : n.fehlt} aria-hidden="true">
                  {b.antrag.haengt ? '✓' : '✗'}
                </span>
                Antrag als Bescheinigung (Vorlage Nummer {b.antrag.vorlageId})
                {b.antrag.haengt ? '' : ' – hängt noch nicht an der Rolle „Teilnehmer“'}
              </li>
            )}
          </ul>
        ) : (
          <p className={f.hinweis}>
            Alles ist geschrieben und beim Schreiben nachgelesen. Die Zusammenfassung ließ sich
            gerade nicht laden – die Seite „Nachweise“ zeigt den Stand.
          </p>
        )}
      </Sheet>
    );
  }

  const teilErfolg = ergebnis !== null && !alleErledigt;
  const ersteinrichtung = grundlage.typId === null || grundlage.rechtFehlt !== false;

  return (
    <Sheet
      title={art ? `Nachweis-Art · ${art.name}` : 'Neue Nachweis-Art'}
      onClose={onClose}
      beschaeftigt={arbeitet}
      breit
      knoepfe={
        <FensterKnopf disabled={arbeitet || !!fehler} onClick={() => void speichern()}>
          {arbeitet ? 'Wird gespeichert …' : teilErfolg ? 'Nochmal' : 'Speichern'}
        </FensterKnopf>
      }
    >
      {teilErfolg && (
        <div role="alert">
          <p className={f.fehler}>
            Noch nicht alles geschrieben: {fehlerMeldung(ergebnis.fehler).text}
          </p>
          <ul className={n.schritte} aria-label="Stand">
            {NACHWEIS_SCHRITTE.map((s) => {
              const da = ergebnis.erledigt.includes(s);
              return (
                <li key={s}>
                  <span className={da ? n.fertig : n.fehlt} aria-hidden="true">
                    {da ? '✓' : '✗'}
                  </span>
                  {NACHWEIS_SCHRITT_TEXT[s]} – {da ? 'steht in ChurchTools' : 'fehlt noch'}
                </li>
              );
            })}
          </ul>
          <p className={f.hinweis}>
            „Nochmal“ schreibt nur, was fehlt – es entsteht nichts doppelt.
          </p>
        </div>
      )}

      {!art && ersteinrichtung && (
        <p className={f.hinweis}>
          Beim ersten Speichern legt die Erweiterung in ChurchTools die Gruppenart „Nachweis“ an und
          setzt die Rechte der Leiter-Rolle (dazu „Anmeldungen sehen“, damit die Vertrauenspersonen
          in die Erweiterung kommen) und an der Teilnehmer-Rolle „Gruppeninfos sehen“ (damit sie
          ihren Antrag unter „Meine Gruppen“ finden – sie sehen dann die Gruppe und die Namen der
          anderen Mitglieder, aber keine Angaben oder Ergebnisse). Das darf nur, wer „Berechtigungen
          verwalten“ hat – sonst sagt dir das Fenster, wer es tun muss.
        </p>
      )}

      <label className={f.feld}>
        <span>Name</span>
        <input
          className={f.eingabe}
          value={name}
          maxLength={NACHWEIS_NAME_MAX}
          placeholder="Führungszeugnis"
          onChange={(ev) => setName(ev.target.value)}
        />
        <small className={f.hinweis}>
          Die Gruppe in ChurchTools heißt „Nachweis: {name.trim() || '…'}“.
        </small>
      </label>

      <div className={f.feld} role="group" aria-label="Gültig">
        <span>Gültig</span>
        <div className={n.gueltig}>
          <input
            className={`${f.eingabe} ${n.jahre}`}
            type="number"
            inputMode="numeric"
            min={NACHWEIS_JAHRE_MIN}
            max={NACHWEIS_JAHRE_MAX}
            aria-label="Jahre"
            value={jahre ?? ''}
            onChange={(ev) => setJahre(ev.target.value === '' ? null : Number(ev.target.value))}
          />
          Jahre ab
          <Segment<NachweisAb>
            ariaLabel="Ab wann"
            value={ab}
            onChange={setAb}
            options={[
              { value: 'ausstellung', label: 'Ausstellung' },
              { value: 'einsicht', label: 'Einsicht' },
            ]}
          />
        </div>
        <small className={f.hinweis}>
          Danach legt ChurchTools die nächste Aufgabe „Erneut einsehen“ an.
        </small>
      </div>

      <div className={f.feld}>
        <span>Aufforderung an die Person</span>
        <p className={f.hinweis}>
          Jede Person in dieser Nachweis-Art bekommt automatisch die Einladung zu ChurchTools
          (Standardmail von ChurchTools) und diese Mail. Die Aufgabe „Einsicht nehmen“ erscheint bei
          den Vertrauenspersonen.
        </p>
      </div>
      <label className={f.feld}>
        <span>Betreff</span>
        <input
          className={f.eingabe}
          value={betreff}
          onChange={(ev) => setBetreff(ev.target.value)}
        />
      </label>
      <label className={f.feld}>
        <span>Text</span>
        <textarea
          ref={textRef}
          className={`${f.eingabe} ${a.rundmailText}`}
          value={text}
          onChange={(ev) => setEigenerText(ev.target.value)}
        />
      </label>
      <div className={f.feld}>
        <AntwortKnoepfe
          namen={['Vorname']}
          beschriftung="Einfügen"
          wer="ChurchTools setzt den Namen je Person ein"
          streng
          feld={textRef}
          wert={text}
          onWert={setEigenerText}
        />
      </div>

      <AntragAbschnitt
        wert={antrag}
        onAendern={(x) => setAntrag((alt) => ({ ...alt, ...x }))}
        gemeindeLogo={gemeindeLogo}
        bisher={bisher}
      />

      <div className={f.feld}>
        <span>Vertrauenspersonen (dürfen sehen und abhaken)</span>
        {art && art.vertrauen === null && (
          <p className={f.hinweis}>
            Die Vertrauenspersonen lassen sich für dich in ChurchTools nicht lesen. Hier
            hinzugefügte kommen dazu; entfernt wird nichts.
          </p>
        )}
        <ul className={f.zahlarten} aria-label="Vertrauenspersonen">
          {liste.length === 0 && (
            <li className={f.zahlart}>
              <span className={n.personen}>
                {ichStand.art === 'laedt' && !art ? 'Wird geladen …' : 'Noch niemand.'}
              </span>
            </li>
          )}
          {liste.map((p) => {
            const geht = entfernen.has(p.personId);
            return (
              <li key={p.personId} className={f.zahlart}>
                <span className={geht ? n.wirdEntfernt : undefined}>
                  {p.name}
                  {geht && ' – wird beim Speichern entfernt'}
                </span>
                <button
                  type="button"
                  className={f.textKnopf}
                  aria-label={`${p.name} ${geht ? 'doch behalten' : 'entfernen'}`}
                  onClick={() => weg(p)}
                >
                  {geht ? 'Doch behalten' : 'Entfernen'}
                </button>
              </li>
            );
          })}
        </ul>
        <PersonenSuche
          klassen={{
            form: n.suche,
            feld: f.eingabe,
            liste: n.treffer,
            zeile: f.aktion,
            leer: f.hinweis,
            fehler: f.fehler,
          }}
          label="Person suchen"
          knopfArt="zweit"
          gesperrt={(p) => bleiben.some((x) => x.personId === p.personId)}
          onWahl={(p) => hinzu({ personId: p.personId, name: `${p.vor} ${p.nach}`.trim() })}
          zeile={(p) => (
            <>
              <span>
                <b>{`${p.vor} ${p.nach}`.trim()}</b>
                {p.email && <small>{p.email}</small>}
              </span>
              {bleiben.some((x) => x.personId === p.personId) && <Etikett>schon dabei</Etikett>}
            </>
          )}
        />
        <small className={f.hinweis}>
          Sie bekommen in ChurchTools das Recht, die Angaben zu sehen, einzutragen und die Aufgaben
          abzuhaken.
        </small>
      </div>

      {eingabeFehler && (
        <p className={f.fehler} role="alert">
          {eingabeFehler}
        </p>
      )}
      {!eingabeFehler && fehler && (name.trim() !== '' || art) && (
        <p className={f.hinweis}>{fehler}</p>
      )}
    </Sheet>
  );
}
