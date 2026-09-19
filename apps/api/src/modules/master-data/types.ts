import type { Decimal128 } from 'mongodb';

export type MasterUnit = {
  _id?: string;
  companyId: string;
  code: string;
  name: string;
  symbol: string;
  kind: 'unit' | 'weight' | 'volume' | 'length' | 'area' | 'time' | 'other';
  decimalPlaces: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PriceList = {
  _id?: string;
  companyId: string;
  code: string;
  name: string;
  currency: string;
  validFrom?: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductPrice = {
  _id?: string;
  companyId: string;
  priceListId: string;
  productId: string;
  amount: Decimal128;
  minQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
