import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { Sun, Moon } from '@carbon/icons-react';
import { Theme } from '@type/theme';

const getOppositeTheme = (theme: Theme): Theme => {
  if (theme === 'dark') {
    return 'light';
  } else {
    return 'dark';
  }
};

const ThemeToggle = () => {
  const { t } = useTranslation();
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  const switchTheme = () => {
    setTheme(getOppositeTheme(theme!));
  };

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  if (!theme) return null;

  return (
    <a
      className='flex mb-1 py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors duration-200 text-gray-900 dark:text-white cursor-pointer text-sm'
      onClick={switchTheme}
    >
      {theme === 'dark' ? <Sun className='w-4 h-4' /> : <Moon className='w-4 h-4' />}
      {t(getOppositeTheme(theme) + 'Mode')}
    </a>
  );
};

export default ThemeToggle;

