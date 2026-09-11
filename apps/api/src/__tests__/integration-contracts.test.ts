import test from 'node:test';
import assert from 'node:assert/strict';
import { F0_F7_INTEGRATION_FLOWS, F0_F7_PHASE_STATUS, INTEGRATION_CONTRACT_VERSION } from '../core/integration.js';

test('F0-F7 integration registry is complete and uniquely identified', () => {
  assert.equal(INTEGRATION_CONTRACT_VERSION, 1);
  assert.deepEqual(Object.keys(F0_F7_PHASE_STATUS), ['F0','F1','F2','F3','F4','F5','F6','F7']);
  assert.equal(F0_F7_INTEGRATION_FLOWS.length, 10);
  assert.equal(new Set(F0_F7_INTEGRATION_FLOWS.map(flow => flow.id)).size, F0_F7_INTEGRATION_FLOWS.length);
  for (const flow of F0_F7_INTEGRATION_FLOWS) {
    assert.ok(flow.id);
    assert.match(flow.namespace, /^[A-Z][A-Z0-9_-]*$/);
    assert.ok(flow.contract.length > 0);
    assert.ok(['connected','contract-ready','boundary'].includes(flow.status));
  }
});

test('F0-F7 registry keeps not-yet-wired business automations explicit', () => {
  const contractReady = F0_F7_INTEGRATION_FLOWS.filter(flow => flow.status === 'contract-ready');
  assert.ok(contractReady.some(flow => flow.id === 'sales-finance'));
  assert.ok(contractReady.some(flow => flow.id === 'stock-finance'));
  assert.ok(contractReady.some(flow => flow.id === 'finance-logistics'));
});
