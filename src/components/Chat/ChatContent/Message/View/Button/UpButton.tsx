import React from 'react';

import { ChevronDown } from '@carbon/icons-react';

import BaseButton from './BaseButton';

const UpButton = ({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  return (
    <BaseButton
      icon={<ChevronDown className='rotate-180' />}
      onClick={onClick}
    />
  );
};

export default UpButton;
