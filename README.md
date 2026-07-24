# claytoolkit

Verktyg för keramikarbete. / Tools for working with clay.

**Live:** https://salmiak.github.io/claytoolkit/

## Konform

Mallgenerator för koniska keramikformer. Ange övre diameter, undre diameter och höjd —
verktyget vecklar ut manteln till en platt mall (cirkelringssektor) i skala 1:1.

- Krympmån: måtten tolkas som slutmått och mallen skalas upp
- Skarvmån längs fogen (räknas som våtmått, skalas ej)
- Export som SVG (1:1), utskrift, eller PDF uppdelad på flera A4-sidor med
  passmärken och monteringsordning
- Svenska och engelska

## Utveckling

Kräver Node 18+ (se `.nvmrc`).

```bash
nvm use && npm install && npm run dev
```

```bash
npm run build
```

Deploy sker automatiskt till GitHub Pages vid push till `main`.

## Lägga till ett språk

1. Kopiera `src/locales/sv.json` till `src/locales/<kod>.json` och översätt värdena.
2. Importera och registrera filen i `messages` i [src/main.js](src/main.js).

Alla strängar — inklusive texten som ritas in i SVG:en och PDF:en — går via i18n,
så inget behöver ändras i geometrikoden.
