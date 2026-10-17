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
          700: '#383843',
          750: '#282831',
          800: '#1c1c24',
          850: '#15151b',
          900: '#101014',
          950: '#0d0e11',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), parentSiblingHoverPlugin],
  darkMode: 'class',
};
