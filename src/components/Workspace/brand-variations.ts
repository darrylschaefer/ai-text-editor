import { useSearchParams } from 'react-router-dom';

export const BRAND_VARIATIONS = {
  original: { name: 'Original', mark: './fthr-mark.svg', icon: './fthr-icon.svg', color: '#08090b' },
  ink: { name: 'Ink', mark: './fthr-mark-ink.svg', icon: './fthr-icon-ink.svg', color: '#0a0a09' },
  prism: { name: 'Prism', mark: './fthr-mark-prism.svg', icon: './fthr-icon-prism.svg', color: '#090910' },
};

export type BrandVariation = keyof typeof BRAND_VARIATIONS;

export function useBrandVariation() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('brand');
  const variant: BrandVariation = requested === 'ink' || requested === 'prism' ? requested : 'original';
  const selectVariant = (next: BrandVariation | null) => {
    setParams(previous => {
      const updated = new URLSearchParams(previous);
      if (next) updated.set('brand', next);
      else updated.delete('brand');
      return updated;
    }, { replace: true });
  };
  return { variant, appearance: BRAND_VARIATIONS[variant], comparing: params.has('brand'), selectVariant };
}
