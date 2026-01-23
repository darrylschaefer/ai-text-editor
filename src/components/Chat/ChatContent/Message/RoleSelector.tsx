import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { ChevronDown } from '@carbon/icons-react';

import { DocumentInterface, Role, roles } from '@type/document';

import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';

const RoleSelector = React.memo(
  ({
    role,
    messageIndex,
    sticky,
  }: {
    role: Role;
    messageIndex: number;
    sticky?: boolean;
  }) => {
    const { t } = useTranslation();
    const setInputRole = useStore((state) => state.setInputRole);
    const setChats = useStore((state) => state.setChats);
    const currentChatIndex = useStore((state) => state.currentChatIndex);

    const [dropDown, setDropDown, dropDownRef] = useHideOnOutsideClick();

    return (
      <div className='prose dark:prose-invert relative'>
        <button
          className='btn btn-neutral btn-small flex gap-1'
          type='button'
          onClick={() => setDropDown((prev) => !prev)}
        >
          {t(role)}
          <ChevronDown />
        </button>
        <div
          ref={dropDownRef}
          id='dropdown'
          className={`${
            dropDown ? '' : 'hidden'
          } absolute top-full mt-1.5 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-800/30 text-gray-800 dark:text-gray-100 w-full min-w-[120px] animate-scale-in overflow-hidden`}
        >
          <ul
            className='text-sm p-1 m-0 max-h-64 overflow-y-auto'
            aria-labelledby='dropdownDefaultButton'
          >
            {roles.map((r) => (
              <li
                className={`px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer transition-colors duration-150 rounded-md mx-1 ${
                  role === r ? 'bg-gray-100 dark:bg-gray-750 font-medium' : ''
                }`}
                onClick={() => {
                  if (!sticky) {
                    const updatedChats: DocumentInterface[] = JSON.parse(
                      JSON.stringify(useStore.getState().chats)
                    );
                    updatedChats[currentChatIndex].messageCurrent.messages[messageIndex].role =
                      r;
                    setChats(updatedChats);
                  } else {
                    setInputRole(r);
                  }
                  setDropDown(false);
                }}
                key={r}
              >
                {t(r)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
);
export default RoleSelector;
