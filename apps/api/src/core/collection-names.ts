import type { Db } from 'mongodb';

/** Logical names stay in code; MongoDB stores contextual Portuguese names. */
export const COLLECTION_NAMES = {
  companies: 'empresas', users: 'usuarios', audit_logs: 'registros_auditoria', auth_sessions: 'sessoes_autenticacao', api_rate_limits: 'limites_requisicoes_api', branches: 'filiais', tenants: 'contextos_empresa', permissions: 'permissoes', role_permissions: 'permissoes_papeis', access_scopes: 'escopos_acesso', access_policies: 'politicas_acesso', org_units: 'unidades_organizacionais', departments: 'departamentos', cost_centers: 'centros_custo', teams: 'equipes', core_configurations: 'configuracoes_sistema', products: 'produtos', warehouses: 'armazens', sales_orders: 'pedidos_venda', financial_entries: 'lancamentos_financeiros', fiscal_documents: 'documentos_fiscais', parties: 'parceiros', addresses: 'enderecos', units: 'unidades_medida', price_lists: 'listas_precos', prices: 'precos', stock_balances: 'saldos_estoque', stock_movements: 'movimentacoes_estoque', stock_reservations: 'reservas_estoque', finance_accounts: 'contas_financeiras', finance_categories: 'categorias_financeiras', finance_payments: 'pagamentos_financeiros', finance_transfers: 'transferencias_financeiras', finance_outbox_events: 'eventos_saida_financeiros', integration_events: 'eventos_integracao', scm_purchase_requests: 'solicitacoes_compra', scm_purchase_quotes: 'cotacoes_compra', scm_purchase_orders: 'pedidos_compra', scm_purchase_receipts: 'recebimentos_compra', scm_outbox_events: 'eventos_saida_compras', logistics_shipments: 'remessas_logistica', logistics_events: 'eventos_logistica', logistics_outbox_events: 'eventos_saida_logistica'
} as const;

type LogicalCollectionName = keyof typeof COLLECTION_NAMES;
const PHYSICAL_TO_LOGICAL = Object.fromEntries(Object.entries(COLLECTION_NAMES).map(([logical, physical]) => [physical, logical])) as Record<string, LogicalCollectionName>;
export function physicalCollectionName(name: string): string { return COLLECTION_NAMES[name as LogicalCollectionName] ?? name; }
export function logicalCollectionName(name: string): string { return PHYSICAL_TO_LOGICAL[name] ?? name; }

export async function migrateCollectionNames(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  for (const [logical, physical] of Object.entries(COLLECTION_NAMES) as Array<[LogicalCollectionName, string]>) {
    if (!existing.has(logical) || existing.has(physical)) continue;
    await db.collection(logical).rename(physical);
    existing.delete(logical); existing.add(physical);
  }
}

export function localizeDatabase(db: Db): Db {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'collection') return (name: string, options?: unknown) => options === undefined ? target.collection(physicalCollectionName(name)) : target.collection(physicalCollectionName(name), options as never);
      if (property === 'createCollection') return (name: string, options?: unknown) => options === undefined ? target.createCollection(physicalCollectionName(name)) : target.createCollection(physicalCollectionName(name), options as never);
      if (property === 'listCollections') return (filter?: unknown, options?: unknown) => {
        const cursor = options === undefined ? target.listCollections(filter as never) : target.listCollections(filter as never, options as never);
        const originalToArray = cursor.toArray.bind(cursor);
        cursor.toArray = async () => (await originalToArray()).map(item => ({ ...item, name: logicalCollectionName(item.name) }));
        return cursor;
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
