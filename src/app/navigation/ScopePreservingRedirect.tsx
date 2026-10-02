import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export interface ScopePreservingRedirectProps {
  to: string;
  extraParams?: Record<string, string>;
  replace?: boolean;
}

// Universal operational reporting parameters:
// clientId, workspace, date bounds, structured filters object, and scalar dimension filters.
export const UNIVERSAL_SCOPE_PARAMS = new Set([
  'clientId',
  'workspace',
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

export const INVESTIGATION_SCOPE_PARAMS = new Set([
  'drill', 'drillValue', 'investigationMetric',
  'segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge',
]);

export const INVESTIGATION_PATHS = new Set([
  '/investigate', '/exceptions', '/lead-explorer', '/data-integrity', '/ai-insights', '/lead-ledger',
]);

// Explore / Lead drill down parameters (compatible report-local state)
export const EXPLORE_REPORT_PARAMS = new Set([
  'search',
  'drill',
  'drillValue',
  'page',
  'pageSize',
  'view',
  'preset',
  'sourceSearch',
  'sourceMode',
]);

// Vendor dispositions local parameters
export const DISPOSITION_REPORT_PARAMS = new Set([
  'mode',
  'group',
]);

// Fixed release scope parameters for /reports and /vendors
export const RELEASE_SCOPE_PARAMS = new Set([
  'clientId',
  'workspace',
  'release',
  'snapshot',
  'reportId',
  'manifest',
  'version',
]);

// Settings / Admin parameters
export const SETTINGS_SCOPE_PARAMS = new Set([
  'clientId',
  'workspace',
]);

/**
 * Returns the set of parameter keys allowed to be carried over to the given destination.
 * Uses explicit destination policies rather than substring heuristics.
 */
export function getAllowedParamsForTarget(targetPath: string, targetQuery?: string): Set<string> {
  // 1. Fixed evidence release reports
  if (targetPath === '/reports' || targetPath === '/vendors') {
    return RELEASE_SCOPE_PARAMS;
  }

  // 2. Settings / Access control / Visual workspace
  if (targetPath === '/admin' || targetPath === '/access-control' || targetPath === '/visuals') {
    return SETTINGS_SCOPE_PARAMS;
  }

  // 3. Lead Evidence and its source-ledger compatibility route. These view keys
  // remain report-local and never become operational dimension filters.
  if (targetPath === '/lead-explorer' || targetPath === '/lead-ledger') {
    return new Set([...UNIVERSAL_SCOPE_PARAMS, ...INVESTIGATION_SCOPE_PARAMS, ...EXPLORE_REPORT_PARAMS]);
  }

  if (INVESTIGATION_PATHS.has(targetPath)) {
    return new Set([...UNIVERSAL_SCOPE_PARAMS, ...INVESTIGATION_SCOPE_PARAMS]);
  }

  // 4. Contact strategy with vendor dispositions tab
  if (targetPath === '/contact-strategy') {
    const isVendorDispositions = targetQuery
      ? new URLSearchParams(targetQuery).get('tab') === 'vendor_dispositions'
      : false;
    if (isVendorDispositions) {
      return new Set([...UNIVERSAL_SCOPE_PARAMS, ...DISPOSITION_REPORT_PARAMS, 'tab']);
    }
    return UNIVERSAL_SCOPE_PARAMS;
  }

  // 5. Default operational reporting surfaces
  return UNIVERSAL_SCOPE_PARAMS;
}

/**
 * Builds the canonical destination URL with preserved analytical scope.
 * Pure function that handles:
 * - Rejecting external redirect targets
 * - Preserving repeated parameters without silent last-value sanitization
 * - Explicit destination policies for local vs global scope
 * - Applying destination query and extraParams overrides atomically
 */
export function buildPreservedDestination(
  to: string,
  sourceSearch: string,
  extraParams?: Record<string, string>
): string {
  const [rawTarget, targetQuery] = to.split('?');

  // Prevent external redirect targets or scheme-relative URLs
  if (
    !rawTarget.startsWith('/') ||
    rawTarget.startsWith('//') ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawTarget)
  ) {
    return '/overview';
  }

  const targetPath = rawTarget;
  const sourceParams = new URLSearchParams(sourceSearch);
  const nextParams = new URLSearchParams();

  const allowedParams = getAllowedParamsForTarget(targetPath, targetQuery);

  // Preserve allowed parameters from source, including repeated parameters
  const seenKeys = new Set<string>();
  for (const key of sourceParams.keys()) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (allowedParams.has(key)) {
      const values = sourceParams.getAll(key);
      for (const val of values) {
        nextParams.append(key, val);
      }
    }
  }

  // Explicit destination query overrides (e.g. tab=vendor_dispositions)
  if (targetQuery) {
    const targetParams = new URLSearchParams(targetQuery);
    const seenTargetKeys = new Set<string>();
    for (const key of targetParams.keys()) {
      if (seenTargetKeys.has(key)) continue;
      seenTargetKeys.add(key);
      nextParams.delete(key);
      for (const val of targetParams.getAll(key)) {
        nextParams.append(key, val);
      }
    }
  }

  // Explicit extraParams overrides
  if (extraParams) {
    for (const [key, val] of Object.entries(extraParams)) {
      nextParams.delete(key);
      nextParams.append(key, val);
    }
  }

  const searchStr = nextParams.toString() ? `?${nextParams.toString()}` : '';
  return `${targetPath}${searchStr}`;
}

/** The old source search remains local, with its meaning retained in Source mode. */
export function buildLeadLedgerDestination(sourceSearch: string): string {
  const legacy = new URLSearchParams(sourceSearch);
  if (!legacy.has('sourceSearch') && legacy.has('search')) {
    for (const value of legacy.getAll('search')) legacy.append('sourceSearch', value);
  }
  return buildPreservedDestination('/lead-explorer?view=source', legacy.toString());
}

/** Existing Ledger bookmarks open the canonical workspace, never a second UI. */
export function LeadLedgerCompatibilityRedirect() {
  const location = useLocation();
  return <Navigate to={buildLeadLedgerDestination(location.search)} replace />;
}

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
  const destination = buildPreservedDestination(to, location.search, extraParams);
  return <Navigate to={destination} replace={replace} />;
}
