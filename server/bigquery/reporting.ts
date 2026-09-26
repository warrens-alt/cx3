export {
  getOverviewStats,
  getQualityStats,
  getCohortStats,
  getLeadTimeline,
} from './queries';

export function validationUnavailable() {
  return {
    status: 'NOT_VERIFIED',
    message: 'Admin validation not independently verified',
    verifiedAt: null,
  };
}
