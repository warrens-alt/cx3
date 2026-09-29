import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App.tsx';
import { isChunkLoadError, attemptChunkRecovery } from './lib/chunkRecovery';
import { installAuthenticatedApiFetch } from './lib/apiFetch';
import { registerQueryClientForSessionIsolation } from './lib/analyticalSession';
import './index.css';
import './styles/product.css';
import './styles/analyticsVisuals.css';
import './styles/visualRefinement.css';
import './styles/salesCommercialVisuals.css';
import './styles/timeAgentCampaignVisuals.css';

installAuthenticatedApiFetch();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

registerQueryClientForSessionIsolation(queryClient);

// Route imports own recovery through safeImport. A global preload reload would
// discard a healthy report when an optional widget chunk fails to load.

function Fallback({ error, resetErrorBoundary }: any) {
  const chunkError = isChunkLoadError(error);
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-app-bg">
      <div className="enterprise-card p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-semantic-neg mb-4">
          {chunkError ? 'Application Update' : 'Application Error'}
        </h2>
        <p className="text-text-sec text-sm mb-6">
          {chunkError
            ? 'A newer version of ConversionX is available. Reloading will fetch the latest update.'
            : (error?.message || 'An unexpected error occurred.')}
        </p>
        <button 
          type="button"
          onClick={chunkError ? () => { if (!attemptChunkRecovery(0)) window.location.reload(); } : resetErrorBoundary}
          className="bg-primary-blue text-white px-4 py-2 rounded-md font-medium hover:bg-primary-blue-dark transition-colors whitespace-nowrap cursor-pointer"
        >
          {chunkError ? 'Reload Application' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={Fallback}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
