import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import type { Feld, Formular } from '@shared/anmeldung/formular';
import {
  bedingungAufbereiten,
  bedingungSatz,
  gemeinsameQuellen,
  kaputteStellen,
  regelGruppen,
  zielKandidaten,
  type AntwortBedingung,
  type Bedingung,
  type RegelGruppe,
  type RegelZiel,
} from '@shared/anmeldung/bedingungen';
import { BedingungBlock, DarstellungWahl } from './Bedingungen';
import { antwortSatz, standardRegel, zielName } from './bedingungTexte';
import k from './Baukasten.module.scss';

/**
 * **Der Reiter „Bedingungen“ im Baukasten** (Etappe F1d, Entwurf `f1-bedingungen-nachweise-v1` Ansicht 1, abgenommen
 * 11.11.2026): alle Regeln als „Wenn … dann zeige …“, gleiche Bedingungen zusammengefasst (`regelGruppen`). Hier
 * lassen sich Regeln auch anlegen – mit mehreren Zielen – und für alle Ziele zugleich bearbeiten. Gespeichert wird
 * weiter je Feld und Antwort (`regelSetzen`).
 */

const istGleich = (a: RegelZiel, b: RegelZiel) => a.id === b.id && a.antwort === b.antwort;

/** Was am Ende einer Antwort-Regel steht: „sonst ausgegraut („nur für Getaufte“)“. */
function sonstText(bed: AntwortBedingung): string {
  const grund = bed.grund?.trim();
  return bed.art === 'weg'
    ? 'sonst ausgeblendet'
    : `sonst ausgegraut${grund ? ` („${grund}“)` : ''}`;
}

export function RegelListe({
  formular,
  darf,
  onBearbeiten,
}: {
  formular: Formular;
  darf: boolean;
  /** `null` = neue Regel. */
  onBearbeiten: (g: RegelGruppe | null) => void;
}) {
  const gruppen = regelGruppen(formular);
  const kaputt = kaputteStellen(formular);
  const keineQuelle = gemeinsameQuellen(formular, []).length === 0;
  return (
    <div className={k.regelListe}>
      <div className={k.regelKopf}>
        <p className={k.regelHilfe}>
          Alle Bedingungen dieses Formulars auf einen Blick. Gleiche Bedingungen sind zu einer Regel
          zusammengefasst.
        </p>
        {darf && (
          <KopfKnopf
            neu
            label="Neue Regel"
            symbol={<Icon name="plus" size={18} />}
            disabled={keineQuelle}
            onClick={() => onBearbeiten(null)}
          />
        )}
      </div>
      {gruppen.length === 0 ? (
        <p className={k.regelLeer}>
          Noch keine Bedingungen. „Neue Regel“ – oder im Reiter „Formular“ an einer Frage „Nur
          zeigen, wenn …“.
        </p>
      ) : (
        <ul className={k.regelKarten}>
          {gruppen.map((g, i) => {
            const fehler = kaputt.filter((s) =>
              g.ziele.some((z) => z.id === s.ziel.id && z.antwort === s.antwort),
            );
            return (
              <li key={i} className={k.regelKarte}>
                <div className={k.regelZeilen}>
                  <p className={k.regelZeile}>
                    <span className={k.bedWort}>wenn</span>
                    <span>{bedingungSatz(formular, g.bed)}</span>
                  </p>
                  <p className={k.regelZeile}>
                    <span className={k.bedWort}>dann</span>
                    <span>
                      {g.antwort !== undefined ? <>„{g.antwort}“ nur wählbar in </> : <>zeige </>}
                      {g.ziele.map((z) => (
                        <span key={`${z.id}/${z.antwort ?? ''}`} className={k.bedZiel}>
                          {zielName(formular, z)}
                        </span>
                      ))}
                      {g.antwort !== undefined && 'art' in g.bed && <> · {sonstText(g.bed)}</>}
                    </span>
                  </p>
                  {fehler.map((s, j) => (
                    <span key={j} className={k.bedKaputt} role="alert">
                      <Icon name="warnung" size={14} />
                      <span>{s.text}</span>
                    </span>
                  ))}
                </div>
                {darf && (
                  <KopfKnopf
                    label="Bearbeiten"
                    title={`Regel bearbeiten: wenn ${bedingungSatz(formular, g.bed)}`}
                    symbol={<Icon name="pencil" size={16} />}
                    onClick={() => onBearbeiten(g)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * **Das Fenster „Neue Regel“ / „Regel bearbeiten“.** Bei einer Regel für Fragen wählt man die Ziele per Häkchen:
 * angeboten werden nur Felder, die auf jede Quelle schauen dürfen (`zielKandidaten`), und als Quelle nur Fragen, die
 * vor allen gewählten Zielen stehen (`gemeinsameQuellen`) – so bleibt beides stimmig. Bei einer Regel für eine
 * Antwort bleiben die Ziele, wie sie sind.
 */
export function RegelFenster({
  formular,
  gruppe,
  onSpeichern,
  onClose,
}: {
  formular: Formular;
  /** `null` = neue Regel (für Fragen). */
  gruppe: RegelGruppe | null;
  /** `bed = null` = Regel entfernen. */
  onSpeichern: (
    alt: RegelZiel[],
    ziele: RegelZiel[],
    bed: Bedingung | AntwortBedingung | null,
  ) => void;
  onClose: () => void;
}) {
  const alle = [...formular.anmeldung, ...formular.person];
  const feldVon = (id: string) => alle.find((x) => x.id === id);
  const alt = gruppe?.ziele ?? [];
  const anAntwort = gruppe?.antwort !== undefined;
  const [ziele, setZiele] = useState<RegelZiel[]>(alt);
  const [bed, setBed] = useState<AntwortBedingung>(() =>
    gruppe
      ? { art: 'grau', ...structuredClone(gruppe.bed) }
      : {
          modus: 'eine',
          regeln: [standardRegel(gemeinsameQuellen(formular, []))],
          art: 'grau',
          grund: '',
        },
  );
  const zielFelder = ziele.map((z) => feldVon(z.id)).filter((x): x is Feld => !!x);
  const quellen = gemeinsameQuellen(formular, zielFelder);
  const kandidaten = anAntwort ? [] : zielKandidaten(formular, bed);

  const umschalten = (f: Feld, an: boolean) => {
    const rest = ziele.filter((z) => z.id !== f.id);
    const neu = an ? [...rest, { id: f.id }] : rest;
    // In der Reihenfolge des Formulars – so steht es auch in der Liste.
    setZiele(
      neu.sort(
        (a, b) => alle.findIndex((x) => x.id === a.id) - alle.findIndex((x) => x.id === b.id),
      ),
    );
  };

  const satz = !bed.regeln.length
    ? 'Ohne Bedingung gilt nichts – „Speichern“ entfernt die Regel.'
    : anAntwort
      ? antwortSatz(formular, gruppe.antwort!, bed)
      : !ziele.length
        ? 'Wähle bei „Dann“, welche Felder nur unter dieser Bedingung erscheinen.'
        : `${ziele.length > 1 ? `Diese ${ziele.length} Felder erscheinen` : 'Die Frage erscheint'} nur, wenn ${bedingungSatz(formular, bed)}. Pflicht gilt nur, solange sie zu sehen ist.`;

  const fertig = bedingungAufbereiten(bed, anAntwort);
  // Bei Fragen nur Ziele, die auf jede Quelle schauen dürfen – sonst schlüge das Speichern fehl (`bedingungFehler`).
  const gueltig = anAntwort ? ziele : ziele.filter((z) => kandidaten.some((f) => f.id === z.id));
  return (
    <Sheet
      title={!gruppe ? 'Neue Regel' : 'Regel bearbeiten'}
      onClose={onClose}
      mittel
      links={
        gruppe ? (
          <FensterKnopf art="loeschen" onClick={() => onSpeichern(alt, alt, null)}>
            Regel entfernen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={
        <FensterKnopf
          disabled={!!fertig && !gueltig.length}
          onClick={() => onSpeichern(alt, gueltig, fertig)}
        >
          Speichern
        </FensterKnopf>
      }
    >
      <div className={k.bedFenster}>
        <BedingungBlock bed={bed} quellen={quellen} onBed={setBed} />

        <section className={k.bedBlock} aria-label="Dann">
          <span className={k.bedBlockTitel}>Dann</span>
          {anAntwort ? (
            <>
              <p>
                <b>„{gruppe.antwort}“</b> ist nur wählbar in:{' '}
                {ziele.map((z) => (
                  <span key={z.id} className={k.bedZiel}>
                    {zielName(formular, z)}
                  </span>
                ))}
              </p>
              <DarstellungWahl bed={bed} onBed={setBed} />
            </>
          ) : (
            <>
              <p>zeige:</p>
              {kandidaten.length ? (
                <div className={k.regelZiele} role="group" aria-label="Felder, die erscheinen">
                  {kandidaten.map((f) => {
                    const gewaehlt = ziele.some((z) => z.id === f.id);
                    // Hat das Feld schon eine andere Bedingung, wird sie ersetzt – das soll man vorher sehen.
                    const andere = !!f.bed && !alt.some((z) => istGleich(z, { id: f.id }));
                    return (
                      <label key={f.id} className={k.regelZiel}>
                        <input
                          type="checkbox"
                          checked={gewaehlt}
                          onChange={(e) => umschalten(f, e.target.checked)}
                        />
                        <span>
                          {zielName(formular, { id: f.id })}
                          {andere && (
                            <small> (hat schon eine andere Bedingung – wird ersetzt)</small>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className={k.bedNotiz}>
                  Kein Feld steht nach allen gewählten Fragen. Eine Bedingung kann nur auf Fragen
                  davor schauen.
                </p>
              )}
            </>
          )}
        </section>

        <p className={k.bedSatz}>{satz}</p>
        {!anAntwort && (
          <p className={k.bedNotiz}>
            Als Bedingung gehen nur Fragen vor allen gewählten Feldern; zeigen lassen sich nur
            Felder nach den Bedingungsfragen.
          </p>
        )}
      </div>
    </Sheet>
  );
}
