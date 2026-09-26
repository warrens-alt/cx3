import { NAMING_VERSION } from './naming';
const LABELS: Record<string,string> = {
  lead_id:'Lead ID', consumer_id:'Consumer ID', capture_date:'Capture Date', source:'Lead Source', medium:'Traffic Medium',
  vendor:'Vendor', transaction_id:'Vendor Transaction ID', valid_lead:'Recorded Lead-Validity Flag', valid_idno:'Recorded ID-Validity Flag',
  phone_valid:'Recorded Phone-Validity Flag', grade:'Recorded Lead Grade', vetting:'Recorded Vetting Classification', vendor_count:'Distinct Vendors per Lead',
  total_transactions:'Distinct Transaction IDs per Lead', has_delivery:'Lead Has Delivery Evidence', has_call:'Lead Has Call Evidence',
  has_rpc:'Lead Has RPC Flag', has_sale:'Lead Has Sale Flag', has_activation:'Lead Has Activation Flag', total_revenue:'Recorded Revenue per Lead',
  attempted_delivery_timestamp:'Attempted Delivery Timestamp', delivery_timestamp:'Recorded Delivery Timestamp',
  first_call_timestamp:'First Recorded Call Timestamp', last_call_timestamp:'Last Recorded Call Timestamp', latest_dialer_status:'Latest Recorded Dialler Status',
  rpc:'Transaction-Row RPC Flag', sale:'Transaction-Row Sale Flag', activation:'Transaction-Row Activation Flag', revenue:'Transaction-Row Recorded Revenue',
  total_call_duration_seconds:'Recorded Total Call Duration (Seconds)',
};
export function exportColumnDefinitions(columns: string[], grain: string) {
  const recordUnit = grain === 'transaction' ? 'vendor_transaction_row' : 'lead';
  return { namingVersion: NAMING_VERSION, recordUnit,
    columns: columns.map(key=>({key, label:key==='total_calls' ? (recordUnit==='lead'?'Recorded Call Attempts per Lead':'Recorded Call Counter on Transaction Row') : LABELS[key] || key,
      status:'LEGACY_UNVERIFIED', note:key==='total_calls'?'Legacy joined call counters may overlap; this is not certified event-level counting.':null})) };
}
