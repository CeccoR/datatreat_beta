# Revisione di avvisi ed errori (da fare)

Mappa fatta il 17/11/2026 su v540, leggendo il codice. Ha trovato 276 messaggi mostrati all'utente:

| Modulo | Messaggi |
|---|---|
| XRPD | 155 |
| codice condiviso | 51 |
| SEM | 17 |
| DRS | 17 |
| Iodometria | 12 |
| GC | 11 |
| EPR | 9 |
| Custom | 4 |

Per ciascuno c'è una proposta. 197 restano come sono. Qui sotto ci sono le 79 da cambiare e le incoerenze tra moduli. La mappa completa, con le 197 da tenere, va rifatta dal codice quando si riprende il lavoro: i numeri di riga cambiano.

Le decisioni dell'utente sono ancora da prendere. Niente di questo è nel codice.

## Tipi

- **error**: box rosso ✕. I dati non sono utilizzabili, oppure il risultato è sbagliato.
- **warn**: box ambra ⚠. Il risultato è utilizzabile, ma va controllato qualcosa.
- **info**: box azzurro ⓘ, dalla v539. È un fatto neutro su come è stato letto il file. Oggi lo usa solo GC.
- **grigio**: riga di stato o nota `txt-meta`.

## Proposte di cambiamento

Formato: **#n**, tipo attuale → **proposta**, quando compare, il testo e il motivo in corsivo.

### XRPD

- **#13** warn → **info**: file con più scansioni. "Loaded, with a caveat: {file}: {n} scans, each a pattern of its own". _Fatto neutro._
- **#18** warn → **info**: tempi di conteggio diversi per punto. "counts over unequal counting times: loaded as counts per second". _Variante gestita._
- **#19** warn → **info**: cps senza tempo di conteggio, stimato dal rumore. "{s} s per point estimated from the noise, for the weights". _Scelta automatica; il Rietveld lo ripete (#103)._
- **#20** warn → **unire a #229**: "Already loaded file(s): {file}".
- **#21** warn → **info**: più file trascinati sullo standard. "One file at a time: … the first is the standard".
- **#22** warn → **info**: standard con più scansioni. "the standard is scan {k}…".
- **#27** warn → **unire a #230**: progetto con file senza 2θ/intensità. "…with no pattern to show: left out."
- **#33** grigio → **warn**: meno di 3 picchi nello standard. "Not fitted: it needs 3 peaks or more…". _Cambia come si corregge._
- **#43** grigio → **info**: "From the CIF, no last result to start from".
- **#44** grigio → **info**: "Scales and background refined, not held: the background's terms changed".
- **#45** grigio → **error**: raffinamento fallito ("⚠ Refinement failed", "too few points", "worker failed"). _Oggi è grigio come l'avanzamento._
- **#48** grigio → **error**: il raffinamento dello standard fallisce o non dà profilo, quindi "nothing refined".
- **#49** grigio → **error**: "⚠ {file}: not a CIF file".
- **#50** grigio → **error**: CIF con struttura inutilizzabile (cella incompleta, nessun atomo, coordinate cartesiane…).
- **#54** grigio → **unire a #41**: "No phase ticked for this pattern: tick one in the list."
- **#56** grigio → **warn**: campione raffinato prima dello standard. "No instrumental profile… Refine it again".
- **#57** grigio → **warn**: campione raffinato senza standard. "the widths, and the sizes from them, include the instrument's".
- **#58** grigio → **unire a #57**: "the widths are not corrected for the instrument's".
- **#60** riga dello strumento → **warn**: nessuna λ nel file, quindi "Cu Kα assumed". _Sbagliato se l'anodo non è Cu._
- **#61** riga dello strumento → **info**: nessun Kα₂, quindi "a single wavelength is modelled".
- **#62** riga dello strumento → **info**: rapporto Kα₂/Kα₁ assente, quindi "0.5 assumed".
- **#63** riga dello strumento → **info**: nessun raggio del goniometro, quindi "240 mm assumed".
- **#64** riga dello strumento → **info**: cristallo del monocromatore non riconosciuto, quindi "graphite (002) assumed".
- **#65** riga dello strumento → **warn**: il cristallo non può riflettere quella λ.
- **#66** riga dello strumento → **info**: riflessione del monocromatore non indicata.
- **#67** riga dello strumento → **info**: il cristallo passa solo Kα₁, quindi il rapporto del file non è usato.
- **#68** riga dello strumento → **warn**: "Sample mode … the model is Bragg–Brentano reflection".
- **#69** riga dello strumento → **warn**: asse di scansione non θ–2θ.
- **#70** riga dello strumento → **warn**: fenditura di divergenza automatica, "the data need dividing by sinθ".
- **#71** riga dello strumento → **warn**: fenditura programmabile senza lunghezza irradiata.
- **#72** riga dello strumento → **info**: fenditura sconosciuta o assente, quindi "a fixed slit is assumed".
- **#73** riga dello strumento → **warn**: il monocromatore di solito passa solo Kα₁, ma il file dà un rapporto Kα₂ ("check it").
- **#75** warn → **info**: CIF con più strutture, quindi viene usata la prima.
- **#77** warn → **info**: CIF magnetico, momenti ignorati.
- **#78** warn → **info**: angolo di cella dedotto dalla simmetria.
- **#80** warn → **info**: identità aggiunta alle operazioni.
- **#82** warn → **error**: centratura incompleta, "the cell will be filled incompletely".
- **#89** warn → **info**: fattore di forma interpolato tra cariche.
- **#90** warn → **info**: B mancanti, quindi "B = … assumed".
- **#99** grigio → **warn**: occupanze inferiori a formula × Z. _Può indicare un sito mancante._
- **#103** warn → **info**: rumore inferiore ai conteggi dichiarati, pesi riscalati.
- **#104** warn → **info**: λ non tabulata per f′ e f″, quindi poste a 0.
- **#106** warn → **unire a #105**: forma libera senza standard.
- **#113** warn → **info**: Soller diverse tra standard e campione.
- **#118** warn → **info**: forma libera ripresa dall'ultimo risultato.
- **#119** warn → **info**: forma libera già scartata nell'ultimo risultato.
- **#120** warn → **info**: forma libera non supportata dai dati, quindi resta la taglia isotropa.
- **#123** warn → **error**: punti ≤ parametri raffinati.
- **#125** warn → **info**: ultimo risultato con altre fasi, quindi si riparte dal CIF.
- **#126** warn → **info**: fase assente nell'ultimo risultato, quindi lasciata fuori.
- **#127** warn → **info**: difetti planari nuovi, con taglia e strain tenuti fissi.
- **#128** warn → **info**: occupanze cambiate, B tenuti fissi.
- **#129** warn → **info**: "Refined from the last result…" (resoconto).
- **#130** warn → **info**: la ricerca della cella copre ±a %, non il ±b % impostato.

### SEM

- **#166** warn → **unire a #229**: "Already loaded: {file}" (riconosciuto per contenuto).
- **#169**, **#170** in linea → **info**: "⚠ narrowed to fit" (ritaglio ristretto per stare nell'immagine).
- **#171** error → **unire a #230**: "its stored bytes no longer read as a Tescan TIFF".

### DRS

- **#179** warn → **info**: "not a standard format: … read as %R".
- **#180** warn → **info**: "not a standard format: … read as F(R)".
- **#187** warn → **error**: "⚠ Negative E_g for: …".
- **#188** warn → **error**: "⚠ Negative E_U for: …".

### GC

- **#192** warn → **info**: "{file}: dates read as day/month".

### EPR

- **#208** warn → **unire a #201**: "Not loaded — a .DTA and its .DSC must be uploaded together". _È un rifiuto, con il motivo "(its .DSC is missing)"._

### Iodometria

- **#217** grigio → **unire a #216**: "none: click the plot".
- **#218** grigio → **warn**: "n/a (the trace ends {t} s after the injection)".
- **#219** grigio → **warn**: "Calibration: incomplete, not used".
- **#223** grigio → **error**: meno di 2 standard con concentrazioni diverse. _Blocca Apply come #221._

### Codice condiviso

- **#228** → **buttare**: intestazione di default "Non-standard format — verify these files:", mai usata.
- **#229** warn → **info**: "Already loaded file(s): {file}". _Dire "not loaded again", con un'intestazione unica per tutti i moduli._
- **#230** warn → **error**: "Restored, with a caveat: {n} files … with no data to show: left out." _Vale anche per XRPD (#27) e SEM (#171)._
- **#232**, **#233** finestra nativa del browser → **unire a #248**: "The original file … is not available" / "No original files are available to download".
- **#241** → **unire a #240**: "Project file list is empty."
- **#252** → **unire a #250**: CSV con file non leggibili.
- **#254** → **unire a #253**: "is not a DataTreat project."
- **#256** → **unire a #259**: due frasi diverse per cancellare un progetto.
- **#264**, **#266** → **unire a #248**: byte dei file non più salvati, detto con tre frasi diverse.

### Destinazioni delle unioni

Questi messaggi restano come sono.

- **#41**: "No phase ticked for this pattern: add one from a CIF, or tick one." / "Add a phase from a CIF to refine."
- **#105**: "{WPPM / faults / …}: need the standard's instrumental profile (refine the standard first) … refined without."
- **#201**: error "Invalid file(s): {file}" (EPR, oggi senza motivo).
- **#216**: "No injection found in this trace at this minimum prominence: click the plot to set it."
- **#240**: "No data loaded in {Module}." [OK]
- **#248**: "“{title}”: {n} of its files are not stored in this browser any more; it opens without them."
- **#250**: "“{title}” could not be exported: its files could not be read from this browser's storage."
- **#253**: "“{file}” is not a DataTreat project: it cannot be read as one." [OK]
- **#259**: "Delete project “{title}”? This cannot be undone."

## Incoerenze tra moduli

1. **File rifiutato.** La forma cambia: "{file} ({motivo})" quasi ovunque, "{file} — {motivo}" in SEM. In tre casi manca il motivo: GC, EPR quando l'estensione è sbagliata, il modkit quando il lettore lancia un'eccezione.
2. **"Già caricato".** Il criterio cambia da modulo a modulo:
   - nome del file: XRPD, DRS, GC, Custom;
   - nome del file sorgente: Iodometria;
   - nome senza estensione: EPR;
   - contenuto: SEM.

   Le intestazioni sono due.
3. **File persi alla riapertura.** Tre testi e due tipi tra modkit, XRPD e SEM. In più tabs.js e sessions.js mostrano un banner con quattro frasi diverse, e il download usa una finestra nativa del browser.
4. **Intestazioni degli avvisi di lettura.** Ogni modulo ha la sua:

   | Modulo | Intestazione |
   |---|---|
   | XRPD | "Loaded, with a caveat:" |
   | SEM | "Loaded, but check:" |
   | DRS | "Verify how these files were read:" |
   | GC | una per argomento |
   | EPR | "Not loaded — …" |
5. **Varianti di formato.** Sono info in GC, warn in DRS e XRPD, e warn anche il "letto giorno/mese" di GC.
6. **Fatti neutri e problemi nella stessa riga.** Succede in DRS (#179 con #182) e in GC (#192 con #193): chiudere l'uno chiude anche l'altro.
7. **Punti o righe scartati.** Frasi diverse in ogni modulo. Iodometria scarta in silenzio le coppie con meno di 3 punti. GC conta come "celle vuote" anche le righe senza alcun gas.
8. **Persistenza e chiusura diverse.**
   - GC e DRS ricalcolano gli avvisi dai file; in DRS tornano anche dopo undo/redo.
   - XRPD li azzera al primo undo/redo, e restano anche se il file viene rimosso.
   - SEM li perde alla riapertura.
   - Gli avvisi nelle card non si chiudono, tranne #28.
9. **Valore rifiutato in un campo.** Gli stili sono diversi:
   - tremolio rosso senza testo, quasi ovunque;
   - banner con [OK] negli intervalli di GC;
   - nota ambra nel Rietveld;
   - testo rosso, o grigio, nella calibrazione di Iodometria;
   - nessun segnale nelle impostazioni CSV;
   - rosso fisso nel nome del progetto.
10. **Domande all'utente.** Tre meccanismi: il banner in alto quasi ovunque, la modale solo per lo standard XRPD, la finestra nativa del browser solo nel download.
11. **Errori in grigio.** La riga di stato del Rietveld mostra gli errori con lo stesso grigio dell'avanzamento, mentre quella del compositore li mostra in rosso.
12. **Avvisi nelle card.** Tre aspetti:
    - box ambra;
    - riga ambra senza box (rv-warn);
    - testo accodato alla riga grigia dello strumento dopo "— ⚠", che quindi non sembra un avviso.
13. **Resoconti Rietveld in ambra.** "Refined from the last result…" ha lo stesso stile dei problemi veri.
14. **Correzione strumentale assente.** È detta in cinque punti, alcuni grigi e altri ambra.
15. **Stessa situazione, parole diverse nella stessa card:**
    - "No phase ticked…" (#41 e #54);
    - "No data loaded" contro "Project file list is empty";
    - due frasi per la cancellazione di un progetto.
16. **Valori negativi.** DRS nasconde le barre negative e lo dice; GC le disegna senza dire niente.
17. **Situazioni senza messaggio.**
    - EPR senza MWFQ cambia asse in silenzio.
    - GC: la sezione Results resta nascosta senza spiegazione.
    - "Copy image" dei grafici fallisce in silenzio.
    - Rinominare un progetto con un nome già usato non chiede nulla.
    - Una palette salvata con un nome esistente sovrascrive l'altra senza chiedere.
    - Un risultato Rietveld con fasi cambiate perde la curva calcolata senza dire perché.
18. **Punteggiatura e stile.**
    - "!" solo in DRS.
    - Trattino lungo "—" in SEM e nell'avviso EPR, parentesi altrove.
    - "Light-on time is before first injection" manca dell'articolo ed è impreciso: l'avviso compare anche quando i due istanti coincidono.
