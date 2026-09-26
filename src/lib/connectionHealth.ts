export interface ConnectionHealth {
  status: string;
  latestData?: string | null;
  datasetAvailable?: boolean;
  checkedAt?: string;
  message?: string;
}

export function connectionHealth(data: any): ConnectionHealth {
  if (!data || typeof data !== 'object') {
    return {
      status: 'Connected',
      latestData: null,
      datasetAvailable: true,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    status: data.status || 'Connected',
    latestData: data.latestData || data.latestRecordDate || data.latestTimestamp || null,
    datasetAvailable: data.datasetAvailable !== false,
    checkedAt: data.checkedAt || new Date().toISOString(),
    message: data.message,
  };
}
