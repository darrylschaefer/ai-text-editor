import React, { memo } from 'react';

import { TrashCan } from '@carbon/icons-react';

import BaseButton from './BaseButton';

const DeleteButton = memo(
  ({
    setIsDelete,
  }: {
    setIsDelete: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    return (
      <BaseButton icon={<TrashCan />} onClick={() => setIsDelete(true)} />
    );
  }
);

export default DeleteButton;
