import React from 'react';
import MobileDetect from 'mobile-detect';
import DesktopLanding from '../landing/DesktopLanding';
import MobileLanding from '../landing/MobileLanding';

function LandingResolver() {
  const isMobile = new MobileDetect(window.navigator.userAgent).mobile() !== null;
  return isMobile ? <MobileLanding /> : <DesktopLanding />;
}

export default LandingResolver;
