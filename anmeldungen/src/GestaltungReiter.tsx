import { useRef, useState } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import { AnmeldeFormular } from '@ui/anmeldeformular/AnmeldeFormular';
import { musterAntworten } from '@ui/anmeldeformular/daten';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { FARBEN, VORLAGEN_GESTALTUNG, vorlageWechseln } from '@shared/anmeldung/gestaltung';
import { aendereEinstellungen, bildEntfernen, bildHochladen } from './einrichten';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import s from './Startseite.module.scss';
import f from './Formular.module.scss';
import g from './GestaltungReiter.module.scss';

/**
 * **Reiter „Gestaltung“** (A5) – Vorlage, Titelbild, Farbe, Feldstil, Knöpfe, Begrüßungstext; rechts die
 * Vorschau mit Musterdaten, genau so, wie Gäste das Formular sehen (`AnmeldeFormular`, dieselbe Darstellung wie
 * das öffentliche Formular). Geändert wird erst im Entwurf, gespeichert mit „Speichern“ – sonst schriebe jeder
 * Klick auf eine Farbe sofort nach ChurchTools.
 */
export function GestaltungReiter({
  id,
  name,
  gemeinde,
  einstellungen: e,
  bildUrl,
  darf,
  heute,
  onGespeichert,
}: {
  id: number;
  name: string;
  gemeinde: string | null;
  einstellungen: OeffentlicheEinstellungen;
  bildUrl: string | null;
  darf: boolean;
  heute: string;
  onGespeichert: (text: string, rueckgaengig: boolean) => void;
}) {
  const [entwurf, setEntwurf] = useState(e.gestaltung);
  const [geraet, setGeraet] = useState<'handy' | 'computer'>('handy');
  const [bildFehler, setBildFehler] = useState<string | null>(null);
  const [bildArbeitet, setBildArbeitet] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  const geaendert = JSON.stringify(entwurf) !== JSON.stringify(e.gestaltung);
  const vorlage = VORLAGEN_GESTALTUNG.find((x) => x.id === entwurf.vorlage)!;

  async function bild(tun: () => Promise<unknown>, text: string) {
    setBildArbeitet(true);
    setBildFehler(null);
    try {
      await tun();
      // Ein Bild lässt sich nicht über „Rückgängig“ zurückholen – ChurchTools hebt das alte nicht auf.
      onGespeichert(text, false);
    } catch (err) {
      setBildFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.');
    } finally {
      setBildArbeitet(false);
    }
  }

  return (
    <div className={g.raster}>
      {darf && (
        <div className={s.spalte}>
          <section className={s.karte} aria-label="Vorlage">
            <div className={s.kopf}>
              <h2>Vorlage</h2>
            </div>
            <div className={g.vorlagen}>
              {VORLAGEN_GESTALTUNG.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={g.vorlage}
                  aria-pressed={x.id === entwurf.vorlage}
                  onClick={() => setEntwurf(vorlageWechseln(entwurf, x.id))}
                >
                  <span
                    className={`${g.mini} ${g[`mini-${x.id}`]}`}
                    style={{ '--m': x.farbe } as React.CSSProperties}
                  />
                  <b>{x.name}</b>
                  <small>{x.hinweis}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={s.karte} aria-label="Titelbild">
            <div className={s.kopf}>
              <h2>Titelbild</h2>
            </div>
            <div className={g.innen}>
              <div className={g.reihe}>
                <button
                  type="button"
                  className={f.option}
                  disabled={bildArbeitet}
                  onClick={() => datei.current?.click()}
                >
                  {bildArbeitet
                    ? 'Wird hochgeladen …'
                    : bildUrl
                      ? 'Anderes Bild hochladen'
                      : 'Eigenes Bild hochladen'}
                </button>
                {bildUrl && (
                  <button
                    type="button"
                    className={f.textKnopf}
                    disabled={bildArbeitet}
                    onClick={() => void bild(() => bildEntfernen(id), 'Titelbild entfernt.')}
                  >
                    Bild der Vorlage nehmen
                  </button>
                )}
                <input
                  ref={datei}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label="Titelbild wählen"
                  onChange={(ev) => {
                    const d = ev.target.files?.[0];
                    ev.target.value = '';
                    if (d) void bild(() => bildHochladen(id, d), 'Titelbild hochgeladen.');
                  }}
                />
              </div>
              <p className={f.hinweis}>
                {bildUrl ? 'Eigenes Bild aktiv, leicht abgedunkelt. ' : 'Bild der Vorlage. '}
                Bei „{vorlage.name}“ landet es als {vorlage.bildOrt}. Es ist das Gruppenbild in
                ChurchTools und öffentlich sichtbar.
              </p>
              <Fehler text={bildFehler} />
            </div>
          </section>

          <section className={s.karte} aria-label="Farbe und Stil">
            <div className={s.kopf}>
              <h2>Farbe und Stil</h2>
            </div>
            <div className={g.innen}>
              <div className={g.farben} role="group" aria-label="Farbe">
                {FARBEN.map(([hex, name]) => (
                  <button
                    key={hex}
                    type="button"
                    className={g.farbe}
                    aria-label={name}
                    aria-pressed={entwurf.farbe.toLowerCase() === hex}
                    style={{ background: hex }}
                    onClick={() => setEntwurf({ ...entwurf, farbe: hex })}
                  />
                ))}
                <label className={g.eigeneFarbe}>
                  <input
                    type="color"
                    value={entwurf.farbe}
                    aria-label="Eigene Farbe"
                    onChange={(ev) => setEntwurf({ ...entwurf, farbe: ev.target.value })}
                  />
                  eigene
                </label>
              </div>
              <div className={f.feld}>
                <span>Eingabefelder</span>
                <Segment
                  ariaLabel="Eingabefelder"
                  value={entwurf.feldstil}
                  onChange={(feldstil) => setEntwurf({ ...entwurf, feldstil })}
                  options={[
                    { value: 'kasten', label: 'Kasten' },
                    { value: 'linie', label: 'Nur Linie' },
                    { value: 'gefuellt', label: 'Gefüllt' },
                  ]}
                />
              </div>
              <div className={f.feld}>
                <span>Knöpfe</span>
                <Segment
                  ariaLabel="Knöpfe"
                  value={entwurf.knoepfe}
                  onChange={(knoepfe) => setEntwurf({ ...entwurf, knoepfe })}
                  options={[
                    { value: 'eckig', label: 'Eckig' },
                    { value: 'rund', label: 'Rund' },
                  ]}
                />
              </div>
            </div>
          </section>

          <section className={s.karte} aria-label="Texte">
            <div className={s.kopf}>
              <h2>Texte</h2>
            </div>
            <div className={g.innen}>
              <label className={f.feld}>
                <span>Begrüßungstext ({entwurf.text.length}/1200)</span>
                <textarea
                  className={g.text}
                  rows={5}
                  maxLength={1200}
                  value={entwurf.text}
                  onChange={(ev) => setEntwurf({ ...entwurf, text: ev.target.value })}
                />
              </label>
              <label className={g.ankreuzen}>
                <input
                  type="checkbox"
                  checked={entwurf.gemeindename}
                  onChange={(ev) => setEntwurf({ ...entwurf, gemeindename: ev.target.checked })}
                />
                Gemeindename im Kopf zeigen
              </label>
              <p className={f.hinweis}>
                Überschrift, Datum, Ort, Plätze und Preise kommen aus dem Reiter „Veranstaltung“,
                die Felder aus „Formular“.
              </p>
            </div>
          </section>

          <div className={g.speichern}>
            <Fehler text={fehler} />
            <button
              type="button"
              className={f.knopf}
              disabled={!geaendert || arbeitet}
              onClick={() =>
                speichern(
                  () => aendereEinstellungen(id, (frisch) => ({ ...frisch, gestaltung: entwurf })),
                  () => onGespeichert('Gestaltung gespeichert.', true),
                )
              }
            >
              {arbeitet ? 'Wird gespeichert …' : geaendert ? 'Gestaltung speichern' : 'Gespeichert'}
            </button>
            {geaendert && (
              <button
                type="button"
                className={f.textKnopf}
                onClick={() => setEntwurf(e.gestaltung)}
              >
                Änderungen verwerfen
              </button>
            )}
          </div>
        </div>
      )}

      <div className={s.spalte}>
        <div className={g.vorschauKopf}>
          <Segment
            ariaLabel="Vorschaugröße"
            value={geraet}
            onChange={setGeraet}
            options={[
              { value: 'handy', label: 'Handy' },
              { value: 'computer', label: 'Computer' },
            ]}
          />
          <span className={s.leise}>Vorschau mit Musterdaten – abgeschickt wird hier nichts.</span>
        </div>
        <div className={`${g.buehne} ${geraet === 'handy' ? g.handy : ''}`}>
          <AnmeldeFormular
            key={`${entwurf.vorlage}-${e.wer}`}
            ansicht={{ name, gemeinde, einstellungen: { ...e, gestaltung: entwurf }, bildUrl }}
            heute={heute}
            vorschau
            start={musterAntworten(e, heute)}
          />
        </div>
      </div>
    </div>
  );
}
