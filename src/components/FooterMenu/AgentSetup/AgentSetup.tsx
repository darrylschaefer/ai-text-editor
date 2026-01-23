import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Chat } from '@carbon/icons-react';
import AgentSetupMenu from '@components/FooterMenu/AgentSetup/AgentSetupMenu';

const AgentSetup = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  return (
    <>
      <a
        className='flex mb-1 py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors duration-200 text-gray-900 dark:text-white cursor-pointer text-sm'
        id='agent-setup-menu'
        onClick={() => setIsModalOpen(true)}
      >
        <Chat className='w-4 h-4' />
        Agent Setup
      </a>
      {isModalOpen && <AgentSetupMenu setIsModalOpen={setIsModalOpen} />}
    </>
  );
};

export default AgentSetup;

