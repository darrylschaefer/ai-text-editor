import React from 'react';
import { useTranslation } from 'react-i18next';

const SearchBar = ({
  value,
  handleChange,
  className,
  disabled,
}: {
  value: string;
  handleChange: React.ChangeEventHandler<HTMLInputElement>;
  className?: React.HTMLAttributes<HTMLDivElement>['className'];
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <input
        disabled={disabled}
        type='text'
        className='text-gray-800 dark:text-white p-3 text-sm bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-opacity m-0 w-full h-full focus:outline-none border border-white/10'
        placeholder={"Search Documents"}
        value={value}
        onChange={(e) => {
          handleChange(e);
        }}
      />
    </div>
  );
};

export default SearchBar;
