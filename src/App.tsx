import React from 'react';
import './styles/globals.css';
import AppProviders from './app/AppProviders';
import AppShell from './app/layouts/AppShell';
import AppRouter from './app/AppRouter';

export default function App() {
  return (
    <AppProviders>
      <AppShell>
        <AppRouter />
      </AppShell>
    </AppProviders>
  );
}
