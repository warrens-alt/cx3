export interface ExceptionPopulation {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
  previousCount: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  detail: string;
  byVendor: Array<{ name: string; count: number }>;
  bySource: Array<{ name: string; count: number }>;
}

export interface ExceptionAnalyticsData {
  validationStatus: string;
  generatedAt: string;
  comparison: { current: { startDate: string; endDate: string }; previous: { startDate: string; endDate: string }; days: number } | null;
  comparisonReason: string;
  exceptions: ExceptionPopulation[];
  populationNote: string;
}
