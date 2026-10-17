# fthr brand studies

On October 17, 2026, three identities were compared before selecting Original for the product.

| Study | Direction | Decision |
| --- | --- | --- |
| Original | Gradient quill, italic Charis SIL wordmark, neutral black surfaces, restrained cool accents | Selected |
| Ink | Fine ivory quill with a cool ink tip, upright serif wordmark, warmer black surfaces, periwinkle highlights | Rejected |
| Prism | Faceted saturated quill, sans serif wordmark, cooler black surfaces, stronger cyan/blue/violet accents | Considered; Original selected |

The comparison UI used a temporary `brand` query parameter. It was a design tool rather than an intended user preference. Original is now the only shipped identity; the query parameter has no effect on branding.

The preview implementation and all four Ink/Prism SVGs remain available in Git checkpoint `bf3a070` (`feat(workspace): unify panes and add fthr branding previews`). For example, `git show bf3a070:public/fthr-mark-prism.svg` retrieves the original Prism artwork. The comparison files were removed from the current source and public assets so they are not copied into the web build.

See [brand.md](brand.md) for the approved identity and tokens. Desktop/tray/installer artwork and install/touch icon coverage remain separate items in the [delivery plan](delivery-plan.md).
