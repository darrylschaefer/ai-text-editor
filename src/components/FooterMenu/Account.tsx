import React from 'react';
import { Person } from '@carbon/icons-react';

const Account = () => {
  return (
    <a className='flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm'>
      <Person />
      My account
    </a>
  );
};

export default Account;
