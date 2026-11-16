import React from 'react';
import logoLpcsImg from '../assets/images/logo_LPCS.jpg';

interface LpcsLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
}

export const LpcsLogo: React.FC<LpcsLogoProps> = ({
  className = 'h-14 w-auto',
}) => {
  return (
    <img
      src={logoLpcsImg}
      alt="Liga Portuguesa Contra a SIDA"
      className={`object-contain select-none ${className}`}
    />
  );
};
