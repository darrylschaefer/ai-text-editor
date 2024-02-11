import React from 'react';

import { Renew } from '@carbon/icons-react';
import BaseButton from './BaseButton';

const RefreshButton = ({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  return <BaseButton icon={<Renew />} onClick={onClick} />;
};

export default RefreshButton;
