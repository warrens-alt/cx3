import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App.tsx';
import './index.css';
import './styles/product.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function Fallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-app-bg">
      <div className="enterprise-card p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold text-semantic-neg mb-4">Application Error</h2>
        <p className="text-text-sec text-sm mb-6">{error.message}</p>
        <button 
          onClick={resetErrorBoundary}
          className="bg-[#3562B3] text-white px-4 py-2 rounded-md font-medium hover:bg-[#294F95] transition-colors"
        >
          Try Again
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
