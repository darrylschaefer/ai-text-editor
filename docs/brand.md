fthr

The name is always written in lowercase. The identity combines a quill and an italic serif wordmark with a restrained spectrum of cool colors. The interface is primarily black, with color reserved for the mark, active controls, and AI indicators.

| Token | Color |
| --- | --- |
| Chrome | #08090B |
| Pane surface | #0D0E11 |
| Writing surface | #101115 |
| Primary text | #E8E8EE |
| Secondary text | #9696A5 |
| Accent cyan | #63D8F5 |
| Accent blue | #7D99FF |
| Accent violet | #B08CFF |
| Accent pink | #E6ADE7 |

The accent runs from cyan through blue and violet into a small amount of pink. Keep large surfaces neutral and writing text solid for readability. Use a solid violet focus outline so keyboard focus stays visible.

The reusable mark is public/fthr-mark.svg. The application icon is public/fthr-icon.svg, with a black rounded tile for small sizes. The shared Brand component renders the quill with the lowercase wordmark. Both are editable vector artwork.

The wordmark uses Charis SIL italic, matching the app's existing literary typography. Interface labels retain IBM Plex Sans. Dark mode is the default; the existing light-mode preference remains available.

The product name, browser metadata, manifest, About mark, and desktop title/tray label use fthr. Internal storage keys, package name, repository links, and source credits retain their existing identifiers for compatibility and attribution.

Two alternative identities are available for comparison without replacing the original:

- Ink (`?brand=ink`): a fine ivory quill with a cool ink tip, an upright serif wordmark, warmer black surfaces, and restrained periwinkle highlights.
- Prism (`?brand=prism`): a faceted, saturated quill, a clean sans serif wordmark, cooler black surfaces, and more visible cyan/blue/violet accents.

The comparison dock switches between Original, Ink, and Prism. Its close button removes the preview parameter and restores the original identity. Pane state and document contents are shared across these views.
