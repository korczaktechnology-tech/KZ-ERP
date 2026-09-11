import type { Decimal128 } from 'mongodb';
export type FinanceAccountType = 'cash' | 'bank' | 'wallet' | 'credit_card';
export type FinanceEntryType = 'receivable' | 'payable';
export type FinanceEntryStatus = 'open' | 'paid' | 'cancelled';
export type FinanceAccount = { _id:string; companyId:string; code:string; name:string; type:FinanceAccountType; currency:string; openingBalance:Decimal128; active:boolean; idempotencyKey?:string; operationHash?:string; createdAt:Date; updatedAt:Date };
export type FinanceCategory = { _id:string; companyId:string; code:string; name:string; direction:'income'|'expense'; active:boolean; createdAt:Date; updatedAt:Date };
export type FinancePayment = { _id:string; companyId:string; entryId:string; accountId:string; amount:Decimal128; paidAt:Date; method:'cash'|'bank_transfer'|'pix'|'card'|'other'; reference?:string; actorUserId:string; idempotencyKey?:string; operationHash?:string; createdAt:Date };
export type FinanceTransfer = { _id:string; companyId:string; fromAccountId:string; toAccountId:string; amount:Decimal128; transferredAt:Date; reference?:string; actorUserId:string; idempotencyKey?:string; operationHash?:string; createdAt:Date };
