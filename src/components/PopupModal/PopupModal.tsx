import React from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Close } from '@carbon/icons-react';

const PopupModal = ({
  title = 'Information',
  message,
  setIsModalOpen,
  handleConfirm,
  handleClose,
  handleClickBackdrop,
  cancelButton = true,
  children,
  fullWidth = false,
}: {
  title?: string | React.ReactElement;
  message?: string;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleConfirm?: () => void;
  handleClose?: () => void;
  handleClickBackdrop?: () => void;
  cancelButton?: boolean;
  children?: React.ReactElement;
  fullWidth?: boolean;
}) => {
  const modalRoot = document.getElementById('modal-root');
  const { t } = useTranslation();

  const _handleClose = () => {
    handleClose && handleClose();
    setIsModalOpen(false);
  };

  const _handleBackdropClose = () => {
    if (handleClickBackdrop) handleClickBackdrop();
    else _handleClose();
  };

  if (modalRoot) {
    return ReactDOM.createPortal(
      <div className='fixed top-0 left-0 z-[999] w-full p-4 overflow-x-hidden overflow-y-auto h-full flex justify-center items-center animate-fade-in'>
        <div className={`relative z-2 max-w-2xl flex justify-center max-h-full w-full ${fullWidth ? 'w-full' : ''}`}>
          <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-h-full overflow-y-auto border border-gray-200 dark:border-gray-800/40 animate-scale-in ${fullWidth ? 'w-full' : ''}`}>
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800/30'>
              <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
                {title}
              </h3>
              <button
                type='button'
                className='text-gray-400 dark:text-gray-500 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg text-sm p-2 ml-auto inline-flex items-center transition-colors duration-200'
                onClick={_handleClose}
                aria-label='Close'
              >
                <Close size={20} />
              </button>
            </div>

            {message && (
              <div className='px-6 py-5 border-b border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-850/50'>
                <div className='min-w-fit text-gray-700 dark:text-gray-300 text-sm leading-relaxed'>
                  {message}
                </div>
              </div>
            )}

            <div className='overflow-y-auto max-h-[calc(100vh-200px)]'>
              {children}
            </div>

            <div className='flex items-center justify-end px-6 py-4 gap-3 border-t border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-850/30'>
              {cancelButton && (
                <button
                  type='button'
                  className='btn btn-neutral'
                  onClick={_handleClose}
                >
                  Close
                </button>
              )}
              {handleConfirm && (
                <button
                  type='button'
                  className='btn btn-primary'
                  onClick={handleConfirm}
                >
                  {t('confirm')}
                </button>
              )}
            </div>
          </div>
        </div>
        <div
          className='bg-black/60 dark:bg-black/70 backdrop-blur-sm absolute top-0 left-0 h-full w-full z-[-1] animate-fade-in'
          onClick={_handleBackdropClose}
        />
      </div>,
      modalRoot
    );
  } else {
    return null;
  }
};

export default PopupModal;
