import { useBrandVariation } from './brand-variations';

const Brand = ({ className = '' }: { className?: string }) => {
  const { appearance, variant } = useBrandVariation();
  return (
    <div className={`workspace-brand brand-${variant} ${className}`} aria-label="fthr">
      <img className="workspace-brand-mark" src={appearance.mark} alt="" width={32} height={32} />
      <span className="workspace-brand-name">fthr</span>
    </div>
  );
};

export default Brand;
