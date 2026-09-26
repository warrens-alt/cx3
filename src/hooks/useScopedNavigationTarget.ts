import { useLocation } from 'react-router-dom';
import { navigationTarget } from '../lib/presentation';

export function useScopedNavigationTarget() {
  const location = useLocation();
  return (target: string) => navigationTarget(target, location.pathname, location.search);
}
