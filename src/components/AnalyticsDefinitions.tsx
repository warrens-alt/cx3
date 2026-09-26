import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { definitionsForDomain } from '../../contracts/analyticsLineage';
import MetricLineageDrawer from './MetricLineageDrawer';

export default function AnalyticsDefinitions() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const definitions = definitionsForDomain(pathname.split('/')[1] || 'overview');
  const [selected, setSelected] = useState('leadToSaleRate');
  const definition = definitions.find(metric => metric.id === selected) || definitions[0];
  return <>
    <button type="button" className="cx-button-secondary" onClick={() => setOpen(true)}><BookOpen size={14} aria-hidden="true" /> Metric definitions</button>
    {open && <MetricLineageDrawer isOpen onClose={() => setOpen(false)} title={definition.label}
      lineage={{ definition: definition.population, numerator: definition.numerator,
        denominator: definition.denominator || 'Count or sum; no denominator', source: definition.source,
        grain: definition.grain, dateBasis: definition.dateBasis, nullMeaning: definition.nullMeaning,
        filterCompatibility: definition.filterCompatibility }} metadata={{ validationStatus: definition.validationState }}
      additionalContent={<label className="block text-sm">Choose a metric<select className="block w-full mt-2 p-2 border rounded" value={definition.id} onChange={event => setSelected(event.target.value)}>{definitions.map(metric => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select>
        <dl className="mt-4 space-y-3"><div><dt className="font-semibold">Grain</dt><dd>{definition.grain}</dd></div><div><dt className="font-semibold">Date basis</dt><dd>{definition.dateBasis}</dd></div><div><dt className="font-semibold">Filter compatibility</dt><dd>{definition.filterCompatibility}</dd></div><div><dt className="font-semibold">Unavailable values</dt><dd>{definition.nullMeaning}</dd></div></dl></label>} />}
  </>;
}
