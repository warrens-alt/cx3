// Isolated test entry. Never imported by the application or its production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppShell from '../../src/app/layouts/AppShell';
import AppRouter from '../../src/app/AppRouter';
import AuthGate from '../../src/components/AuthGate';
import { ThemeProvider } from '../../src/lib/ThemeContext';
import { FilterProvider } from '../../src/lib/FilterContext';
import { registerQueryClientForSessionIsolation, updateAnalyticalSession } from '../../src/lib/analyticalSession';
import { installFixture } from './fixtures';
import RootCauseDrawer from '../../src/components/RootCauseDrawer';

installFixture();
const queryClient = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
registerQueryClientForSessionIsolation(queryClient);
updateAnalyticalSession({uid:'synthetic-user',role:'admin',status:'active',allowedTenants:['synthetic-a','synthetic-b'],isAdmin:true,isActive:true});
function Harness() {
  const navigate=useNavigate(); const location=useLocation();
  (window as any).__fixture.navigate=navigate;
  (window as any).__fixture.refresh=()=>queryClient.refetchQueries();
  (window as any).__fixture.location=location.pathname+location.search+location.hash;
  return <AuthGate><FilterProvider><AppShell>{location.pathname==='/__fixture/root-cause'
    ? <RootCauseDrawer open metric="fetchedLeads" onClose={()=>navigate('/speed-to-lead'+location.search)}/>
    : <AppRouter/>}</AppShell></FilterProvider></AuthGate>;
}
const root=createRoot(document.getElementById('root')!);
(window as any).__fixture.unmount=()=>root.unmount();
const content=<ThemeProvider><Harness/></ThemeProvider>;
root.render(<QueryClientProvider client={queryClient}>{(window as any).__fixture.browserHistory
  ? <BrowserRouter>{content}</BrowserRouter>
  : <MemoryRouter initialEntries={[(window as any).__fixture.initialRoute]}>{content}</MemoryRouter>}</QueryClientProvider>);
