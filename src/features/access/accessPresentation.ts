export type SubscriptionState = 'loading' | 'loaded' | 'error';

export const AVAILABLE_TENANTS = [
  { id: 'default_tenant', name: 'Primary Tenant' },
  { id: 'mondo', name: 'Mondo' },
  { id: 'mtn', name: 'MTN Direct' },
  { id: 'ontact_blc', name: 'On Contact (BLC)' },
  { id: 'vodacom_bizvoip', name: 'Vodacom (Bizvoip)' },
  { id: 'real_promotions', name: 'Real Promotions' },
  { id: 'rewardsco', name: 'Rewards Co' },
  { id: 'oneplan', name: 'Oneplan' }
];
