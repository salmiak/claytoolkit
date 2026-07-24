/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#23221F',
        'ink-soft': '#6B665C',
        paper: '#F1EFEA',
        'paper-edge': '#E3DFD5',
        frame: '#24231F',
        'frame-2': '#2E2C27',
        teal: {
          DEFAULT: '#2F6F73',
          dark: '#28605f',
          soft: '#e2ecec',
        },
        line: '#cfcabd',
        field: '#FBFAF6',
        danger: '#9c4a2c',
      },
      fontFamily: {
        mono: ['ui-monospace', '"SF Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
}
