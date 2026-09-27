import './styles/tokens.css';
import './styles/globals.css';
import './styles/charts.css';
import './styles/reportBrowsing.css';
import './styles/operations.css';
import './styles/navigation.css';
import './styles/theme.css';
import React, { Suspense } from 'react';
import { applicationMode } from './lib/applicationMode';
import { ThemeProvider } from './lib/ThemeContext';
import AppProviders from './app/AppProviders';
import AppShell from './app/layouts/AppShell';
import AppRouter from './app/AppRouter';

const DemoWorkspace = React.lazy(() => import('./pages/DemoWorkspace'));

export default function App() {
  // Select before mounting any live provider. Isolated demo workspace never queries live endpoints.
  const mode = applicationMode(typeof window === 'undefined' ? '' : window.location.search);
  if (mode === 'demo') {
    return (
      <ThemeProvider>
        <Suspense fallback={<p className="p-8" role="status">Loading synthetic demo data… No live connection.</p>}>
          <DemoWorkspace />
        </Suspense>
      </ThemeProvider>
    );
  }

  return (
    <AppProviders>
      <AppShell>
        <AppRouter />
      </AppShell>
    </AppProviders>
  );
}
