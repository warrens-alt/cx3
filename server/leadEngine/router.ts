import { Router } from 'express';
import type { Request, Response } from 'express';
import { bqLeadEngineService } from './bigqueryService';
import { leadEngineCache } from './cacheManager';
import { ALL_COLUMNS, HLC_18_COLUMNS } from './hlcExploder';
import { generateQualityScorecard, generateCleansingSimulation } from './qualityEngine';
import {
  calculateFinancialSimulation,
  simulateTrafficReallocation,
  VENDOR_YIELD_RANKING,
  DEFAULT_PRICING,
} from './commercialEngine';

export function createLeadEngineRouter(): Router {
  const router = Router();

  // 1. Projects Listing
  router.get('/projects', async (_req: Request, res: Response) => {
    try {
      const projects = await bqLeadEngineService.listProjects();
      res.json({ success: true, projects });
    } catch (err: any) {
      console.warn('[BigQuery Projects] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Datasets Listing with IAM Accessibility Flag
  router.get('/datasets', async (req: Request, res: Response) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasets = await bqLeadEngineService.listDatasets(projectId);
      res.json({ success: true, projectId, datasets });
    } catch (err: any) {
      console.warn('[BigQuery Datasets] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Tables Listing with isAccessible Flag & Sorting
  router.get('/tables', async (req: Request, res: Response) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const tables = await bqLeadEngineService.listTables(projectId, datasetId);
      res.json({ success: true, projectId, datasetId, tables });
    } catch (err: any) {
      console.warn('[BigQuery Tables] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Table Schema with 18 Exploded HLC Columns & Non-blocking IAM Notice
  router.get('/table-schema', async (req: Request, res: Response) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const tableId = (req.query.tableId as string) || 'clustered_lead_ledger';

      const schema = await bqLeadEngineService.getTableSchema(projectId, datasetId, tableId);
      res.json(schema);
    } catch (err: any) {
      console.warn('[BigQuery Schema] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Table Data (Preview & Server Deep Search with 18 Unpacked HLC Columns)
  router.get('/table-data', async (req: Request, res: Response) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const tableId = (req.query.tableId as string) || 'clustered_lead_ledger';
      const page = parseInt(req.query.page as string || '0', 10);
      const pageSize = parseInt(req.query.pageSize as string || '50', 10);
      const search = (req.query.search as string) || '';
      const mode = (req.query.mode as string) === 'deep_search' ? 'deep_search' : 'preview';
      const vendor = (req.query.vendor as string) || '';
      const grade = (req.query.grade as string) || '';
      const contactStatus = (req.query.contactStatus as string) || '';
      const validOnly = req.query.validOnly === 'true';

      const result = await bqLeadEngineService.getTableData({
        projectId,
        datasetId,
        tableId,
        page,
        pageSize,
        search,
        mode,
        vendor,
        grade,
        contactStatus,
        validOnly,
      });

      res.json(result);
    } catch (err: any) {
      console.warn('[BigQuery Data] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Data Quality Scorecard
  router.get('/quality/scorecard', async (_req: Request, res: Response) => {
    try {
      const scorecard = await generateQualityScorecard();
      res.json({ success: true, scorecard });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Data Cleansing & Optimization Simulation
  router.get('/quality/cleansing-simulation', async (_req: Request, res: Response) => {
    try {
      const simulation = await generateCleansingSimulation();
      res.json({ success: true, simulation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Commercial Simulator & Yield Model
  router.get('/commercial/simulator', (req: Request, res: Response) => {
    try {
      const shift = parseFloat(req.query.shift as string || '0');
      const financial = calculateFinancialSimulation();
      const reallocation = simulateTrafficReallocation(shift);
      res.json({
        success: true,
        financial,
        reallocation,
        vendorYieldRanking: VENDOR_YIELD_RANKING,
        defaultPricing: DEFAULT_PRICING,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/commercial/simulate', (req: Request, res: Response) => {
    try {
      const { rates, shiftPercentage } = req.body || {};
      const financial = calculateFinancialSimulation(rates);
      const reallocation = simulateTrafficReallocation(typeof shiftPercentage === 'number' ? shiftPercentage : 0);
      res.json({
        success: true,
        financial,
        reallocation,
        vendorYieldRanking: VENDOR_YIELD_RANKING,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Settings, Service Account & Cache Manager Status
  router.get('/settings/status', async (_req: Request, res: Response) => {
    try {
      const cacheStats = leadEngineCache.getStats();
      const saInfo = bqLeadEngineService.getServiceAccountInfo();

      // Test latency to BigQuery
      const start = Date.now();
      let pingStatus = 'OK';
      let latencyMs = 120;
      try {
        const bq = bqLeadEngineService.getClient('dashboards-422710');
        await bq.query({ query: 'SELECT 1 AS ping', maxResults: 1 });
        latencyMs = Date.now() - start;
      } catch (e: any) {
        pingStatus = 'Degraded';
        latencyMs = Date.now() - start;
      }

      res.json({
        success: true,
        serviceAccount: {
          ...saInfo,
          apiLatencyMs: latencyMs,
          pingStatus,
          lastVerifiedAt: new Date().toISOString(),
        },
        cache: cacheStats,
        hlcExploder: {
          status: 'ACTIVE',
          unpackedColumnsCount: HLC_18_COLUMNS.length,
          columnsList: HLC_18_COLUMNS.map(c => c.id),
          nestedRecordSource: 'hlc_details [REPEATED RECORD]',
          deliveryVerification: '100% Unpack Guarantee',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. Cache Purge / Invalidation Endpoint
  router.post('/cache/clear', (_req: Request, res: Response) => {
    try {
      const result = leadEngineCache.clear();
      res.json({
        success: true,
        message: 'In-memory analytics query cache purged successfully.',
        purgedEntries: result.purgedEntries,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. Data Dictionary Export
  router.get('/export/dictionary', (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
      if (format === 'csv') {
        const header = 'Column ID,Display Label,BigQuery Data Type,Category,Business Description\n';
        const rows = ALL_COLUMNS.map(
          c => `"${c.id}","${c.label}","${c.type}","${c.category}","${c.description.replace(/"/g, '""')}"`
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="lead_engine_data_dictionary.csv"');
        return res.send(header + rows);
      }

      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        totalColumns: ALL_COLUMNS.length,
        dictionary: ALL_COLUMNS,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 12. Lead Records Export (CSV/JSON with 18 Unpacked HLC Columns)
  router.get('/export/leads', async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
      const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 1000);

      const dataResult = await bqLeadEngineService.getTableData({
        projectId: 'dashboards-422710',
        datasetId: 'lead_ledger',
        tableId: 'clustered_lead_ledger',
        page: 0,
        pageSize: limit,
      });

      const rows = dataResult.rows || [];

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="lead_ledger_export.json"');
        return res.json({ success: true, count: rows.length, rows });
      }

      if (rows.length === 0) {
        return res.status(204).end();
      }

      const headers = Object.keys(rows[0]);
      const csvHeader = headers.map(h => `"${h}"`).join(',') + '\n';
      const csvRows = rows.map(r => {
        return headers.map(h => {
          const val = r[h] == null ? '' : String(r[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lead_ledger_export.csv"');
      res.send(csvHeader + csvRows);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
