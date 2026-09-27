import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ScopePreservingRedirectProps {
  to: string;
  extraParams?: Record<string, string>;
  replace?: boolean;
}

const UNIVERSAL_SCOPE_PARAMS = new Set([
  'clientId',
  'startDate',
  'endDate',
  'filters',
  'source',
  'vendor',
  'medium',
  'grade',
  'cli',
  'campaign',
  'channel',
  'adset',
  'agent',
]);

/**
 * Redirects to a canonical URL while preserving compatible analytical context
 * (clientId, reporting dates, structured filters, dimension parameters)
 * without leaking unrelated transient page state across report families.
 */
export default function ScopePreservingRedirect({
  to,
  extraParams,
  replace = true,
}: ScopePreservingRedirectProps) {
  const location = useLocation();

  const [targetPath, targetQuery] = to.split('?');
  const sourceParams = new URLSearchParams(location.search);
  const nextParams = new URLSearchParams();

  // 1. Copy universal reporting scope parameters from source
  sourceParams.forEach((val, key) => {
    if (UNIVERSAL_SCOPE_PARAMS.has(key)) {
      nextParams.set(key, val);
    }
  });

  // 2. Preserve search / pagination / drill context when landing on explore destinations
  if (targetPath.includes('explore') || targetPath.includes('lead')) {
    ['search', 'drill', 'drillValue', 'page', 'pageSize'].forEach(key => {
      const val = sourceParams.get(key);
      if (val) nextParams.set(key, val);
    });
  }

  // 3. Atomically apply explicit destination query overrides
  if (targetQuery) {
    const targetParams = new URLSearchParams(targetQuery);
    targetParams.forEach((val, key) => {
      nextParams.set(key, val);
    });
  }

  // 4. Apply explicit extraParams overrides
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, val]) => {
      nextParams.set(key, val);
    });
  }

  const searchStr = nextParams.toString() ? `?${nextParams.toString()}` : '';
  const finalDestination = `${targetPath}${searchStr}`;

  return <Navigate to={finalDestination} replace={replace} />;
}
