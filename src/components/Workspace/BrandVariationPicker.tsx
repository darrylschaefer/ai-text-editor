import { Close } from '@carbon/icons-react';
import { BRAND_VARIATIONS, BrandVariation, useBrandVariation } from './brand-variations';

const BrandVariationPicker = () => {
  const { variant, comparing, selectVariant } = useBrandVariation();
  if (!comparing) return null;
  return (
    <div className="brand-study" role="group" aria-label="Brand variations">
      <span className="brand-study-label">Brand study</span>
      {(Object.keys(BRAND_VARIATIONS) as BrandVariation[]).map(key => (
        <button key={key} type="button" aria-pressed={variant === key} onClick={() => selectVariant(key)}>
          {BRAND_VARIATIONS[key].name}
        </button>
      ))}
      <button type="button" className="brand-study-close" aria-label="Return to original branding" title="Return to original branding" onClick={() => selectVariant(null)}>
        <Close size={15} />
      </button>
    </div>
  );
};

export default BrandVariationPicker;
