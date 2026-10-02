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
import InspectorHost from '../../src/shared/evidence/InspectorHost';
import RootCauseDrawer from '../../src/components/RootCauseDrawer';

installFixture();
const queryClient = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
registerQueryClientForSessionIsolation(queryClient);
updateAnalyticalSession({uid:'synthetic-user',role:(window as any).__fixture.nonAdmin?'analyst':'admin',status:'active',allowedTenants:['synthetic-a','synthetic-b'],isAdmin:!(window as any).__fixture.nonAdmin,isActive:true});
function Harness() {
  const navigate=useNavigate(); const location=useLocation();
  const [, refreshAccess] = React.useReducer(value => value + 1, 0);
  (window as any).__fixture.setAccess=(access: { nonAdmin?: boolean; uid?: string; active?: boolean }) => {
    const fixture = (window as any).__fixture;
    if (access.nonAdmin !== undefined) fixture.nonAdmin = access.nonAdmin;
    updateAnalyticalSession({uid:access.uid || 'synthetic-user',role:fixture.nonAdmin?'analyst':'admin',status:access.active === false?'suspended':'active',allowedTenants:['synthetic-a','synthetic-b'],isAdmin:!fixture.nonAdmin,isActive:access.active !== false});
    refreshAccess();
  };
  (window as any).__fixture.navigate=navigate;
  (window as any).__fixture.refresh=()=>queryClient.refetchQueries();
  (window as any).__fixture.location=location.pathname+location.search+location.hash;
  return <AuthGate><FilterProvider><AppShell>{location.pathname==='/__fixture/root-cause'
    ? <RootCauseDrawer open metric="fetchedLeads" onClose={()=>navigate('/speed-to-lead'+location.search)}/>
    : location.pathname === '/__fixture/audit' ? <InspectorHost open content={(window as any).__fixture.auditContent} onClose={()=>navigate('/overview'+location.search)} />
    : <AppRouter/>}</AppShell></FilterProvider></AuthGate>;
}
const root=createRoot(document.getElementById('root')!);
(window as any).__fixture.unmount=()=>root.unmount();
const content=<ThemeProvider><Harness/></ThemeProvider>;
root.render(<QueryClientProvider client={queryClient}>{(window as any).__fixture.browserHistory
  ? <BrowserRouter>{content}</BrowserRouter>
  : <MemoryRouter initialEntries={[(window as any).__fixture.initialRoute]}>{content}</MemoryRouter>}</QueryClientProvider>);
