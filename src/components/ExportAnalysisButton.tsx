import { Download } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { downloadAnalysisCsv, type AnalysisCell, type AnalysisExportScope } from '../lib/analysisExport';

export default function ExportAnalysisButton({ rows, filename, definitions, validationStatus, dateBasis, truncated }: {
  rows: AnalysisCell[][];
  filename: string;
} & Pick<AnalysisExportScope, 'definitions' | 'validationStatus' | 'dateBasis' | 'truncated'>) {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  return <button type="button" className="cx-button-secondary" disabled={rows.length < 2}
    onClick={() => downloadAnalysisCsv(filename, rows, { clientId: selectedClient, startDate, endDate,
      filters, definitions, validationStatus, dateBasis, truncated })}>
    <Download size={14} aria-hidden="true" /> Export analysis
  </button>;
}
