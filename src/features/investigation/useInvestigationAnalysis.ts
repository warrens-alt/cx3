import { useCallback, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useClient } from '../../lib/ClientContext';
import { useFilters } from '../../lib/FilterContext';
import { getAnalyticalSessionKey, subscribeToAnalyticalSession } from '../../lib/analyticalSession';

/** Presentation of the existing driver's response, never an additional analytical request. */
export interface InvestigationAnalysisSummary {
  scopeKey: string;
  state: 'loading' | 'available' | 'unavailable';
  detail: string;
  current: string;
  previous: string;
  change: string;
  validationStatus: string;
  dimension?: string;
  severity?: string;
}

export function useInvestigationAnalysis() {
  const { selectedClient } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [params] = useSearchParams();
  const sessionKey = useSyncExternalStore(subscribeToAnalyticalSession, getAnalyticalSessionKey, getAnalyticalSessionKey);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken(previous => previous + 1), []);
  const scopeKey = JSON.stringify([sessionKey, isAdmin, selectedClient, startDate, endDate, filters, params.toString(), refreshToken]);
  const [reported, onSummary] = useState<InvestigationAnalysisSummary | null>(null);
  return { scopeKey, sessionKey, refreshToken, refresh, onSummary, summary: reported?.scopeKey === scopeKey ? reported : null };
}
