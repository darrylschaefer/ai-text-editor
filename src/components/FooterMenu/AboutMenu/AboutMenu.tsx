import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PopupModal from '@components/PopupModal';
import { Information, LogoGithub, FavoriteFilled } from '@carbon/icons-react';
import useStore from '@store/store';
import logoImage from './LogoImage';

const AboutMenu = () => {
  const { t } = useTranslation('main');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const firstVisit = useStore((state) => state.firstVisit);
  const setFirstVisit = useStore((state) => state.setFirstVisit);

  useEffect(() => {
    if (firstVisit === true) {
      setFirstVisit(false);
      setIsModalOpen(true);
    }
  }, [firstVisit, setFirstVisit]);

  function onGithubClick() {
    window.open('https://github.com/darrylschaefer/ai-text-editor', '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <a
        className='flex py-2 mb-1 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors duration-200 text-gray-900 dark:text-white cursor-pointer text-sm'
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        <div>
          <Information size={16} />
        </div>
        More Information
      </a>
      {isModalOpen && (
        <PopupModal
          title={logoImage()}
          setIsModalOpen={setIsModalOpen}
          cancelButton={false}
        >
          <div className='p-6'>
            <div className='text-gray-700 dark:text-gray-300 space-y-6'>
              {/* Introduction */}
              <div>
                <p className='text-sm leading-relaxed text-gray-600 dark:text-gray-400'>
                  {t('aboutTitle')}
                </p>
              </div>

              {/* Features */}
              <div>
                <h4 className='text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3'>
                  {t('aboutSectionCore')}
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm'>
                  <div className='flex items-start gap-2'>
                    <span className='text-gray-400 dark:text-gray-500 mt-0.5'>•</span>
                    <span>{t('aboutFeatureDocument')}</span>
                  </div>
                  <div className='flex items-start gap-2'>
                    <span className='text-gray-400 dark:text-gray-500 mt-0.5'>•</span>
                    <span>{t('aboutFeatureSearch')}</span>
                  </div>
                  <div className='flex items-start gap-2'>
                    <span className='text-gray-400 dark:text-gray-500 mt-0.5'>•</span>
                    <span>{t('aboutFeatureRevisions')}</span>
                  </div>
                  <div className='flex items-start gap-2'>
                    <span className='text-gray-400 dark:text-gray-500 mt-0.5'>•</span>
                    <span>{t('aboutFeatureAgents')}</span>
                  </div>
                  <div className='flex items-start gap-2'>
                    <span className='text-gray-400 dark:text-gray-500 mt-0.5'>•</span>
                    <span>{t('aboutFeatureMacros')}</span>
                  </div>
                </div>
              </div>

              {/* Privacy Statement */}
              <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
                <p className='text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                  {t('aboutPrivacy')}
                </p>
              </div>

              {/* GitHub Link */}
              <div className='pt-2'>
                <button
                  onClick={onGithubClick}
                  className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200'
                >
                  <LogoGithub size={16} />
                  <span>{t('aboutGithub')}</span>
                  <FavoriteFilled size={14} className='text-rose-500' />
                </button>
              </div>
            </div>
          </div>
        </PopupModal>
      )}
    </>
  );
};

export default AboutMenu;
