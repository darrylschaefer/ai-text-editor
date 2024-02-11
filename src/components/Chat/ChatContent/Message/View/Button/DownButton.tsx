import React from 'react';

import { ChevronDown } from '@carbon/icons-react';

import BaseButton from './BaseButton';

const DownButton = ({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  return <BaseButton icon={<ChevronDown />} onClick={onClick} />;
};

export default DownButton;
