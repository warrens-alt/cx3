import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ScopePreservingRedirectProps {
  to: string;
  extraParams?: Record<string, string>;
  replace?: boolean;
}

/**
 * Redirects to a canonical URL while preserving all applied reporting query parameters
 * (clientId, dates, filters, mode) from the source request.
 */
export default function ScopePreservingRedirect({
  to,
  extraParams,
  replace = true,
}: ScopePreservingRedirectProps) {
  const location = useLocation();

  const [targetPath, targetQuery] = to.split('?');
  const params = new URLSearchParams(location.search);

  if (targetQuery) {
    const targetParams = new URLSearchParams(targetQuery);
    targetParams.forEach((val, key) => {
      params.set(key, val);
    });
  }

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, val]) => {
      params.set(key, val);
    });
  }

  const searchStr = params.toString() ? `?${params.toString()}` : '';
  const finalDestination = `${targetPath}${searchStr}`;

  return <Navigate to={finalDestination} replace={replace} />;
}
