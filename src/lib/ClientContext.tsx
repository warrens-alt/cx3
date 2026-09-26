import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

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
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClient, setSelectedClientState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReady(false);
    try {
      const res = await fetch('/api/analytics/clients', { credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error(json.error || `Workspace access failed with HTTP ${res.status}`);
      }

      const authorised = json.data as ClientListItem[];
      setClients(authorised);
      setSelectedClientState(previous => {
        const selected = authorised.some(client => client.id === previous) ? previous : authorised[0].id;
        const match = authorised.find(client => client.id === selected)!;
        setClientConfig(match as ClientConfig);
        return selected;
      });
      setReady(true);
    } catch (err: any) {
      setClients([]);
      setClientConfig(null);
      setError(err?.message || 'Failed to load authorised workspaces');
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const setSelectedClient = useCallback((id: string) => {
    const match = clients.find(client => client.id === id);
    if (!match) return;
    setSelectedClientState(id);
    setClientConfig(match as ClientConfig);
  }, [clients]);

  const reportAuthenticationFailure = useCallback((reason = 'Workspace authentication failed') => {
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
