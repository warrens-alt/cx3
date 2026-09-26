import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  type: DeviceType;
  orientation: Orientation;
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallMobile: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      type: 'desktop',
      orientation: 'landscape',
      isTouch: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSmallMobile: false,
      isLandscape: true,
      isPortrait: false,
      width: 1280,
      height: 800,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch = 
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
  
  let type: DeviceType = 'desktop';
  if (width < 768) {
    type = 'mobile';
  } else if (width < 1024) {
    type = 'tablet';
  } else {
    type = 'desktop';
  }

  const orientation: Orientation = width >= height ? 'landscape' : 'portrait';

  return {
    type,
    orientation,
    isTouch,
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    isSmallMobile: width < 420,
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
    width,
    height,
  };
}

/**
 * React hook providing dynamic device metrics, form-factor classification,
 * touch capabilities, and real-time orientation updates.
 */
export function useDevice(): DeviceInfo {
  const [device, setDevice] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    let timeoutId: number | undefined;

    const handleResize = () => {
      // Throttle slightly with requestAnimationFrame for smooth fluid responsiveness
      window.cancelAnimationFrame(timeoutId!);
      timeoutId = window.requestAnimationFrame(() => {
        setDevice(getDeviceInfo());
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId) window.cancelAnimationFrame(timeoutId);
    };
  }, []);

  return device;
}
