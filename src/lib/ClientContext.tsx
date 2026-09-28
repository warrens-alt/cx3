import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { selectAuthorizedClient } from './clientSelection';
import { subscribeToAnalyticalSession, getAnalyticalSessionKey } from './analyticalSession';

export interface ClientConfig {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  capabilities: {
    marketing: boolean;
    leads: boolean;
    calls: boolean;
    sales: boolean;
    activation: boolean;
    revenue: boolean;
  };
}

export interface ClientListItem {
  id: string;
  name: string;
  currency?: string;
  timezone?: string;
  capabilities?: Record<string, boolean>;
}

export interface ClientContextType {
  clientConfig: ClientConfig | null;
  selectedClient: string;
  clientId: string;
  setSelectedClient: (id: string) => void;
  loading: boolean;
  error?: string | null;
  ready: boolean;
  retry: () => void;
  clients: ClientListItem[];
  reportAuthenticationFailure: (reason?: string) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [previousClient, setPreviousClient] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('clientId') || ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const activeLoad = useRef<AbortController | null>(null);
  const resolvedClientRef = useRef<string | null>(null);
  const clientConfig = selectAuthorizedClient(clients, searchParams.get('clientId'), previousClient) as ClientConfig | null;
  const selectedClient = clientConfig?.id || '';

  const loadConfig = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setLoading(true);
    setError(null);
    setReady(false);
    try {
      const res = await fetch('/api/analytics/clients', { credentials: 'same-origin', signal: controller.signal });
      const json = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!res.ok || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error(json.error || `Workspace access failed with HTTP ${res.status}`);
      }

      setClients(json.data as ClientListItem[]);
      setReady(true);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setClients([]);
      setError(err?.message || 'Failed to load authorised workspaces');
      setReady(false);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    return () => activeLoad.current?.abort();
  }, [loadConfig]);

  useEffect(() => {
    return subscribeToAnalyticalSession((_newKey, _oldKey) => {
      activeLoad.current?.abort();
      setClients([]);
      setReady(false);
      setPreviousClient('');
      resolvedClientRef.current = null;
      void loadConfig();
    });
  }, [loadConfig]);

  const setSelectedClient = useCallback((id: string) => {
    const match = clients.find(client => client.id === id);
    if (!match) return;
    setPreviousClient(id);
    resolvedClientRef.current = id;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('clientId', id);
      next.delete('inspectVendor');
      next.delete('inspectGroup');
      next.delete('search');
      next.delete('leadId');
      next.delete('page');
      next.delete('drill');
      next.delete('drillValue');
      return next;
    }, { replace: true });
  }, [clients, setSearchParams]);

  useEffect(() => {
    if (!ready || !selectedClient) return;
    const isClientTransition = resolvedClientRef.current !== null && resolvedClientRef.current !== selectedClient;
    resolvedClientRef.current = selectedClient;
    setPreviousClient(selectedClient);

    const currentUrlClient = searchParams.get('clientId');
    if (currentUrlClient === selectedClient && !isClientTransition) return;

    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('clientId', selectedClient);
      if (isClientTransition) {
        next.delete('inspectVendor');
        next.delete('inspectGroup');
        next.delete('search');
        next.delete('leadId');
        next.delete('page');
        next.delete('drill');
        next.delete('drillValue');
      }
      return next;
    }, { replace: true });
  }, [ready, selectedClient, searchParams, setSearchParams]);

  const reportAuthenticationFailure = useCallback((reason = 'Workspace authentication failed') => {
    activeLoad.current?.abort();
    setLoading(false);
    setError(reason);
    setReady(false);
  }, []);

  return (
    <ClientContext.Provider value={{
      clientConfig,
      selectedClient,
      clientId: selectedClient,
      setSelectedClient,
      loading,
      error,
      ready,
      retry: loadConfig,
      clients,
      reportAuthenticationFailure,
    }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClient must be used within a ClientProvider');
  return context;
};
