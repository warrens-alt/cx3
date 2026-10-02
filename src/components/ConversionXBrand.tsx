import { useId, type CSSProperties } from 'react';
import './ConversionXBrand.css';

type BrandProps = {
  variant?: 'wordmark' | 'symbol' | 'full';
  /** Light ink for the graphite shell; dark ink for a light surface. */
  tone?: 'light' | 'dark' | 'auto';
  className?: string;
};

const asset = '/brand/conversionx-grey.png';

/** Frames the supplied, unmodified PNG. Navigation excludes its tagline. */
export default function ConversionXBrand({ variant = 'wordmark', tone = 'light', className = '' }: BrandProps) {
  const filterId = `cx-brand-${useId().replace(/:/g, '')}`;
  const symbolFilterId = `${filterId}-silver`;
  if (variant === 'full') {
    return <img className={`cx-conversionx-brand cx-brand-full ${className}`} src={asset} width={2684} height={624}
      alt="ConversionX — Every signal captured. Every conversion owned." data-tone={tone} />;
  }
  const symbol = variant === 'symbol';
  return <svg className={`cx-conversionx-brand cx-brand-${variant} ${className}`} viewBox={symbol ? '2085 81 515 380' : '84 81 2516 380'}
    role="img" aria-label="ConversionX" focusable="false" data-tone={tone}
    style={{ '--cx-brand-symbol-filter': `url(#${symbolFilterId})`, '--cx-brand-wordmark-filter': `url(#${filterId})` } as CSSProperties}>
    <defs>
      <filter id={filterId} colorInterpolationFilters="sRGB"><feFlood floodColor="#D5D8DF" /><feComposite in2="SourceAlpha" operator="in" /></filter>
      <filter id={symbolFilterId} colorInterpolationFilters="sRGB"><feComponentTransfer>
        <feFuncR type="linear" slope={0.55} intercept={0.38} />
        <feFuncG type="linear" slope={0.55} intercept={0.38} />
        <feFuncB type="linear" slope={0.55} intercept={0.38} />
      </feComponentTransfer></filter>
    </defs>
    {!symbol && <>
      <svg x={84} y={143} width={1945} height={243} viewBox="84 143 1945 243" overflow="hidden">
        <image className="cx-brand-wordmark-image" href={asset} width={2684} height={624} filter={tone === 'light' ? `url(#${filterId})` : undefined} />
      </svg>
    </>}
    <svg x={2085} y={81} width={515} height={380} viewBox="2085 81 515 380" overflow="hidden">
      <image className="cx-brand-symbol-image" href={asset} width={2684} height={624} filter={tone === 'light' ? `url(#${symbolFilterId})` : undefined} />
    </svg>
  </svg>;
}
