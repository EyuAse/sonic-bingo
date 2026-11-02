import React from 'react';
import { SonicLogo } from './SonicLogo';

export interface LomiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showSubdots?: boolean;
}

/**
 * Legacy LomiLogo component re-routed directly to the official SonicLogo
 * to ensure 100% brand consistency across the entire application.
 */
export const LomiLogo: React.FC<LomiLogoProps> = (props) => {
  return <SonicLogo {...props} />;
};

export { SonicLogo };
export default LomiLogo;
