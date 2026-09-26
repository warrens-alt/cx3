import { Download } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { downloadAnalysisCsv, type AnalysisCell, type AnalysisExportScope } from '../lib/analysisExport';

type ExportRows = { rows: AnalysisCell[][]; rowCount?: never } | { rows: () => AnalysisCell[][]; rowCount: number };

export default function ExportAnalysisButton({ rows, rowCount, filename, label = 'Export analysis', definitions, validationStatus, dateBasis, truncated }: ExportRows & {
  filename: string;
  label?: string;
} & Pick<AnalysisExportScope, 'definitions' | 'validationStatus' | 'dateBasis' | 'truncated'>) {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const hasRows = typeof rows === 'function' ? rowCount > 0 : rows.length > 1;
  return <button type="button" className="cx-button-secondary" disabled={!hasRows}
    onClick={() => downloadAnalysisCsv(filename, typeof rows === 'function' ? rows() : rows, { clientId: selectedClient, startDate, endDate,
      filters, definitions, validationStatus, dateBasis, truncated })}>
    <Download size={14} aria-hidden="true" /> {label}
  </button>;
}
