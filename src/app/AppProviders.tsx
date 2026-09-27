import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../lib/ThemeContext';
import { AuthProvider } from '../lib/AuthContext';
import AuthGate from '../components/AuthGate';
import { ClientProvider } from '../lib/ClientContext';
import { FilterProvider } from '../lib/FilterContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <ClientProvider>
              <FilterProvider>
                {children}
              </FilterProvider>
            </ClientProvider>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
