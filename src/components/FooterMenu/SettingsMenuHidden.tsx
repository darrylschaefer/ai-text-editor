import React, { lazy, Suspense } from 'react';

// Lazy load SettingsMenu to avoid circular dependencies
const SettingsMenu = lazy(() => import('./SettingsMenu/SettingsMenu'));

const SettingsMenuHidden = () => {
  return (
    <Suspense fallback={null}>
      <SettingsMenu />
    </Suspense>
  );
};

export default SettingsMenuHidden;
