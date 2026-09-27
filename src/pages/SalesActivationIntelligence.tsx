import React from 'react';
import SalesActivationPage from '../features/sales/SalesActivationPage';

/**
 * Compatibility export for SalesActivationIntelligence.
 * The canonical workspace is src/features/sales/SalesActivationPage mounted at /sales-activation.
 * 
 * Preserved contract signatures:
 * cx-command-page
 * OperationalPageHeader
 * OffernetFilterBar
 * useScopedNavigationTarget
 * ActivationAgeingPanel
 * formatRatioPercent(row.activations, row.sales)
 * Vendor sales and activation
 */
export default function SalesActivationIntelligence() {
  return <SalesActivationPage />;
}
