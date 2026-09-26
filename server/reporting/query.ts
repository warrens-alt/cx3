import type { Scalar } from '../bigquery/filters';

export interface CompiledQuery {
  query: string;
  params: Record<string, Scalar>;
}
