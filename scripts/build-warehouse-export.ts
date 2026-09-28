import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWarehouseExportBundle,
  generateWarehouseSchemaCsv,
  generateWarehouseInventoryCsv,
  generateWarehouseDataCsv,
} from '../server/analytics/warehouse/warehouseExport';
import { ALL_WAREHOUSE_OBJECTS } from '../server/bigquery/warehouseRegistry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist', 'warehouse-export');

async function runWarehouseExport() {
  console.log('[build-export] Starting Google Cloud BigQuery warehouse export compilation...');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Build master JSON bundle
  const bundle = await buildWarehouseExportBundle({ clientId: 'default_tenant' });
  const jsonPath = path.join(outDir, 'google_warehouse_all_projects_datasets_tables_schemas.json');
  fs.writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), 'utf8');
  const jsonStat = fs.statSync(jsonPath);

  // 2. Build full Schema Catalog CSV (all 1,848 declared columns)
  const schemaCsv = generateWarehouseSchemaCsv(ALL_WAREHOUSE_OBJECTS);
  const schemaCsvPath = path.join(outDir, 'google_tables_schemas_complete_catalog.csv');
  fs.writeFileSync(schemaCsvPath, schemaCsv, 'utf8');
  const schemaCsvStat = fs.statSync(schemaCsvPath);

  // 3. Build Tables & Datasets Inventory CSV (all 65 tables/views)
  const inventoryCsv = generateWarehouseInventoryCsv(ALL_WAREHOUSE_OBJECTS);
  const inventoryCsvPath = path.join(outDir, 'google_projects_datasets_tables_inventory.csv');
  fs.writeFileSync(inventoryCsvPath, inventoryCsv, 'utf8');
  const inventoryCsvStat = fs.statSync(inventoryCsvPath);

  // 4. Build Data & Telemetry Summary CSV
  const dataCsv = generateWarehouseDataCsv(bundle);
  const dataCsvPath = path.join(outDir, 'google_warehouse_data_and_telemetry.csv');
  fs.writeFileSync(dataCsvPath, dataCsv, 'utf8');
  const dataCsvStat = fs.statSync(dataCsvPath);

  console.log('[build-export] Google Cloud Warehouse export successfully generated:');
  console.log(` - Master JSON Archive:     ${jsonPath} (${(jsonStat.size / 1024).toFixed(1)} KB)`);
  console.log(` - Schema Catalog (CSV):    ${schemaCsvPath} (${(schemaCsvStat.size / 1024).toFixed(1)} KB, 1848 declared columns)`);
  console.log(` - Table Inventory (CSV):   ${inventoryCsvPath} (${(inventoryCsvStat.size / 1024).toFixed(1)} KB, 65 tables/views)`);
  console.log(` - Data & Telemetry (CSV):  ${dataCsvPath} (${(dataCsvStat.size / 1024).toFixed(1)} KB)`);
  console.log(`[build-export] Projects: ${bundle.exportMetadata.totalProjects}, Datasets: ${bundle.exportMetadata.totalDatasets}, Tables: ${bundle.exportMetadata.totalTables}, Views: ${bundle.exportMetadata.totalViews}, Total Declared Columns: ${bundle.exportMetadata.totalDeclaredColumns}`);
}

runWarehouseExport().catch(err => {
  console.error('[build-export] Failed to generate warehouse export:', err);
  process.exit(1);
});
