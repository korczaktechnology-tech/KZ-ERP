import React from 'react';
import './F2MasterData.css';

type Session = { accessToken: string; refreshToken: string; user?: { role?: string } };
type Paginated<T> = { items: T[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } };
type Party = { _id: string; code: string; kind: 'person' | 'company'; roles: string[]; name: string; legalName?: string; document?: string; email?: string; phone?: string; active: boolean };
type Address = { _id: string; partyId: string; code: string; type: string; label?: string; postalCode: string; street: string; number: string; district: string; city: string; state: string; country: string; active: boolean };
type Unit = { _id: string; code: string; name: string; symbol: string; kind: string; decimalPlaces: number; active: boolean };
type PriceList = { _id: string; code: string; name: string; currency: string; validFrom?: string; validUntil?: string; active: boolean };
type Product = { _id: string; sku: string; name: string; description?: string; unit: string; price: number; active: boolean };
type ProductPrice = { _id: string; priceListId: string; productId: string; amount: string; minQuantity: number; active: boolean };
type Tab = 'parties' | 'products' | 'units' | 'prices';
