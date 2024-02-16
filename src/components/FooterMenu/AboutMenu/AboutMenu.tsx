import { useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import PopupModal from '@components/PopupModal';
import { Information, LogoGithub, FavoriteFilled } from '@carbon/icons-react';
import useStore from '@store/store';
import { set } from 'lodash';
import logoImage from './LogoImage';

const AboutMenu = () => {
  const { t } = useTranslation(['main', 'about']);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const firstVisit = useStore((state) => state.firstVisit);
  const setFirstVisit = useStore((state) => state.setFirstVisit);

// check if firstVisit is true, if so, set it to false and open the modal
  useEffect(() => {
    if(firstVisit == true){
      setFirstVisit(false);
      setIsModalOpen(true);
    }
  }, [firstVisit]);

  function onGithubClick(){
    window.location.href = "https://github.com/darrylschaefer/fthr-write";
  }

  return (
    <>
      <a
        className='flex py-2 mb-1 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm'
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
          <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
            <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm flex flex-col gap-3 leading-relaxed'>
              <h3 className="pb-2 text-lg font-bold leading-6">{t('aboutTitle')}</h3>
              <ul className="list-disc list-inside text-sm md:columns-2 leading-6 pb-2">
                <li>{t('aboutBulletOne')}</li>
                <li className="hidden md:list-item">{t('aboutBulletTwo')}</li>
                <li className="hidden md:list-item">{t('aboutBulletThree')}</li>
                <li>{t('aboutBulletFour')}</li>
                <li>{t('aboutBulletFive')}</li>
                <li>{t('aboutBulletSix')}</li>
              </ul>
              <div>
                <button onClick={onGithubClick} className="btn btn-neutral w-fit px-4 mt-1 mb-1">
                  <LogoGithub size={16} /> <span className="pl-2 flex items-center justify-center">{t('aboutGithub')} <span className="pl-1 text-rose-500"><FavoriteFilled size={16}/></span></span>
                </button>
              </div>
              <div>
                <p>This application does not collect any data from the user, nor does it store any data on our servers. All data is stored locally on your computer.</p>
              </div>
            </div>
          </div>
        </PopupModal>
      )}
    </>
  );
};

export default AboutMenu;
