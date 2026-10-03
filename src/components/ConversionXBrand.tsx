import './ConversionXBrand.css';

type BrandProps = {
  variant?: 'wordmark' | 'symbol' | 'full';
  /** Light ink for the graphite shell; dark ink for a light surface. */
  tone?: 'light' | 'dark' | 'auto';
  className?: string;
};

const asset = '/brand/conversionx-grey.png';

/** Frames the supplied, unmodified PNG. Navigation excludes its tagline. */
export default function ConversionXBrand({
  variant = 'wordmark',
  tone = 'light',
  className = '',
}: BrandProps) {
  if (variant === 'full') {
    return (
      <img
        className={`cx-conversionx-brand cx-brand-full ${className}`}
        src={asset}
        width={2684}
        height={624}
        alt="ConversionX — Every signal captured. Every conversion owned."
        data-tone={tone}
      />
    );
  }

  const isSymbol = variant === 'symbol';
  const viewBox = isSymbol ? '2085 81 515 380' : '84 81 2516 380';

  return (
    <svg
      className={`cx-conversionx-brand cx-brand-${variant} ${className}`}
      viewBox={viewBox}
      role="img"
      aria-label="ConversionX"
      focusable="false"
      data-tone={tone}
    >
      <image href={asset} xlinkHref={asset} width={2684} height={624} />
    </svg>
  );
}
