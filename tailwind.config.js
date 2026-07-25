/** @type {import('tailwindcss').Config} */

// Palette inspired by clay firing. The six values below are the given palette;
// everything marked "derived" is a tint/shade the UI structurally needs
// (panel separation, borders, hover states, print legibility).
const clay = {
  kiln:      '#241F1C', // darkest — header, chrome, cut lines, text on paper
  fired:     '#6B4A36', // dark brown — secondary text, print sub-labels
  terracotta:'#B98D63', // mid tan — muted labels on dark, faint print rules
  sand:      '#E4D6C3', // light beige — body text on dark, paper edge
  bisque:    '#EFF1E8', // off-white — paper, brightest text
  sage:      '#7C9473', // accent — seams, dimensions, primary action
}

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        clay,

        // Paper side (the drawing)
        ink: clay.kiln,
        'ink-soft': clay.fired,
        paper: clay.bisque,
        'paper-edge': clay.sand,
        field: '#F6F7F1',        // derived: input fill, a hair above paper
        line: clay.sand,

        // Dark chrome (header + control panel)
        frame: clay.kiln,
        'frame-2': '#2E2622',    // derived: panel, one step up from kiln
        'frame-3': '#1A1613',    // derived: schematic well, one step down
        'frame-line': '#403026', // derived: border on dark
        'frame-rule': '#322821', // derived: hairline divider on dark

        // Accent
        sage: {
          DEFAULT: clay.sage,
          // Hover lightens rather than darkens: the accent carries dark ink
          // text, so a darker hover would drop it to 3.8:1.
          light: '#8CA383',      // derived: hover
          deep: '#5A6E52',       // derived: accent text — sage on white is
                                 // only 3.3:1, too low to read at small sizes
          soft: '#E3EADF',       // derived: light fill
        },

        warn: clay.terracotta,
      },
      fontFamily: {
        mono: ['ui-monospace', '"SF Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
}
