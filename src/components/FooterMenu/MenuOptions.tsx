import useStore from '@store/store';
import Api from './Api/Api';
import AboutMenu from '@components/FooterMenu/AboutMenu';
import ImportExportChat from '@components/FooterMenu/ImportExportChat';
import SettingsMenu from '@components/FooterMenu/SettingsMenu/SettingsMenu';
import CollapseOptions from './CollapseOptions';
import GoogleSync from '@components/GoogleSync';
import { TotalTokenCostDisplay } from '@components/FooterMenu/SettingsMenu/TotalTokenCost';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

const MenuOptions = () => {
  const hideMenuOptions = useStore((state) => state.hideMenuOptions);
  const countTotalTokens = useStore((state) => state.countTotalTokens);
  return (
    <>
      <CollapseOptions />
      <div
        className={`${
          hideMenuOptions ? 'max-h-0' : 'max-h-full'
        } overflow-hidden transition-all pb-2`}
      >
        {countTotalTokens && <TotalTokenCostDisplay />}
        {googleClientId && <GoogleSync clientId={googleClientId} />}
        <AboutMenu />
        <ImportExportChat />
        <Api />
        <SettingsMenu />
      </div>
    </>
  );
};

export default MenuOptions;
