/** @type {import('tailwindcss').Config} */

function parentSiblingHoverPlugin({ addVariant, e }) {
  addVariant('parent-sibling-hover', ({ modifySelectors, separator }) => {
    modifySelectors(({ className }) => {
      return `.parent-sibling:hover ~ .parent .${e(
        `parent-sibling-hover${separator}${className}`
      )}`;
    });
  });
}

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: [
        'Söhne',
        'Roboto',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'Ubuntu',
        'Cantarell',
        'Noto Sans',
        'sans-serif',
        'Helvetica Neue',
        'Arial',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji',
      ],
      mono: [
        'Söhne Mono',
        'Monaco',
        'Andale Mono',
        'Ubuntu Mono',
        'Consolas',
        'monospace',
      ],
    },
    extend: {
      typography: {
        DEFAULT: {
          css: {
            pre: { padding: 0, margin: 0 },
            ul: {
              'list-style-type': 'none',
            },
          },
        },
      },
      colors: {
        gray: {
          100: 'rgb(245, 245, 245)', // lightest gray
          200: 'rgb(229, 229, 229)',
          300: 'rgb(214, 214, 214)',
          400: 'rgb(168, 168, 168)',
          500: 'rgb(121, 121, 121)', // medium gray
          600: 'rgb(110, 110, 110)',
          700: 'rgb(80, 80, 80)',
          750: 'rgb(65, 65, 65)', // elevated from 800
          800: 'rgb(50, 50, 50)', // elevated from 850
          850: 'rgb(40, 40, 40)', // elevated from 900
          900: 'rgb(35, 35, 35)', // elevated darkest - lighter than before
          950: 'rgb(28, 28, 28)', // new ultra dark for deepest elements
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), parentSiblingHoverPlugin],
  darkMode: 'class',
};
