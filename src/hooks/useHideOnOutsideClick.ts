import React, { useEffect, useRef, useState } from 'react';

const useHideOnOutsideClick = (): [
  boolean,
  React.Dispatch<React.SetStateAction<boolean>>,
  React.RefObject<HTMLDivElement>
] => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [showElement, setShowElement] = useState<boolean>(false);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      elementRef.current &&
      !elementRef.current.contains(event.target as Node)
    ) {
      setShowElement(false);
    }
  };

  useEffect(() => {
    if (!showElement) return;
    const element = elementRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setShowElement(false);
      if (opener?.isConnected) opener.focus();
    };
    document.addEventListener('mousedown', handleClickOutside);
    element?.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      element?.removeEventListener('keydown', handleEscape);
    };
  }, [showElement, elementRef]);

  return [showElement, setShowElement, elementRef];
};

export default useHideOnOutsideClick;
