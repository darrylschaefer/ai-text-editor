const Brand = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`workspace-brand ${className}`} aria-label="fthr">
      <img className="workspace-brand-mark" src="./fthr-mark.svg" alt="" width={32} height={32} />
      <span className="workspace-brand-name">fthr</span>
    </div>
  );
};

export default Brand;
