import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';

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

export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  id: 'default_tenant',
  name: 'Primary Tenant',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  capabilities: {
    marketing: true,
    leads: true,
    calls: true,
    sales: true,
    activation: true,
    revenue: true,
  }
};

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isAdmin } = useAuth();
  const [clientConfig, setClientConfig] = useState<ClientConfig>(DEFAULT_CLIENT_CONFIG);
  const [clients, setClients] = useState<ClientListItem[]>([
    { id: 'default_tenant', name: 'Primary Tenant' },
    { id: 'mondo', name: 'Mondo' },
    { id: 'mtn', name: 'MTN Direct' },
    { id: 'ontact_blc', name: 'On Contact (BLC)' },
    { id: 'vodacom_bizvoip', name: 'Vodacom (Bizvoip)' },
    { id: 'real_promotions', name: 'Real Promotions' },
    { id: 'rewardsco', name: 'Rewards Co' },
    { id: 'oneplan', name: 'Oneplan' }
  ]);
  const [selectedClient, setSelectedClient] = useState<string>('default_tenant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);

  // Filter clients based on user's authorized scopes
  const visibleClients = clients.filter(c => {
    if (isAdmin) return true;
    const allowed = profile?.allowedTenants;
    if (!allowed || allowed.includes('*')) return true;
    return allowed.includes(c.id);
  });

  // Keep selectedClient within authorized visible clients
  useEffect(() => {
    if (visibleClients.length > 0 && !visibleClients.some(c => c.id === selectedClient)) {
      setSelectedClient(visibleClients[0].id);
    }
  }, [visibleClients, selectedClient]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/clients');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setClients(json.data);
        const match = json.data.find((c: any) => c.id === selectedClient) || json.data[0];
        setClientConfig(match);
      }
      setReady(true);
    } catch (err: any) {
      console.warn("Using default tenant config fallback:", err);
      setError(err?.message || 'Failed to load client config');
      setReady(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
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
      clients: visibleClients,
      reportAuthenticationFailure: () => {}
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
