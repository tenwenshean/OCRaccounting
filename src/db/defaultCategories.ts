import type { Category } from './types'

export const UNCATEGORISED_ID = 'others'

/**
 * Keywords are generic words found on receipts. Well-known shop names live in
 * src/scan/brands.ts. You can add your own keywords per category.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'petrol', name: 'Petrol', color: '#ea580c', icon: '⛽', order: 1,
    keywords: ['ron95', 'ron 95', 'ron97', 'ron 97', 'diesel', 'litre', 'liter', 'ltr', 'pump', 'petrol', 'fuel', 'primax', 'v-power', 'euro 5'],
  },
  {
    id: 'food', name: 'Food', color: '#16a34a', icon: '🍜', order: 2,
    keywords: ['nasi', 'teh', 'kopi', 'mee', 'meal', 'dine in', 'take away', 'takeaway', 'restoran', 'restaurant', 'cafe', 'roti', 'ayam', 'chicken', 'burger', 'rice', 'noodle', 'latte', 'coffee', 'tarik', 'ais', 'kedai makan', 'set'],
  },
  {
    id: 'groceries', name: 'Groceries', color: '#65a30d', icon: '🛒', order: 3,
    keywords: ['grocer', 'supermarket', 'hypermarket', 'mart', 'sayur', 'susu', 'telur', 'beras', 'bread', 'milk', 'eggs', 'minyak masak'],
  },
  {
    id: 'entertainment', name: 'Entertainment', color: '#9333ea', icon: '🎬', order: 4,
    keywords: ['cinema', 'movie', 'ticket', 'karaoke', 'bowling', 'hall', 'seat', 'arcade', 'concert', 'subscription'],
  },
  {
    id: 'gift', name: 'Gift', color: '#db2777', icon: '🎁', order: 5,
    keywords: ['gift', 'hamper', 'flower', 'bouquet', 'gift wrap', 'present', 'hadiah'],
  },
  {
    id: 'telco', name: 'Telco', color: '#2563eb', icon: '📱', order: 6,
    keywords: ['prepaid', 'postpaid', 'reload', 'top up', 'topup', 'broadband', 'fibre', 'mobile plan', 'data plan', 'airtime'],
  },
  {
    id: 'transport', name: 'Transport', color: '#0891b2', icon: '🚗', order: 7,
    keywords: ['toll', 'tol', 'parking', 'fare', 'e-hailing', 'car wash', 'tyre', 'workshop', 'service centre'],
  },
  {
    id: 'utilities', name: 'Utilities', color: '#ca8a04', icon: '💡', order: 8,
    keywords: ['electricity', 'elektrik', 'bil air', 'water bill', 'sewerage', 'kwh', 'meter reading'],
  },
  {
    id: 'health', name: 'Health', color: '#dc2626', icon: '💊', order: 9,
    keywords: ['pharmacy', 'farmasi', 'clinic', 'klinik', 'medicine', 'ubat', 'panadol', 'consultation', 'vitamin', 'doctor'],
  },
  {
    id: 'shopping', name: 'Shopping', color: '#7c3aed', icon: '🛍️', order: 10,
    keywords: ['apparel', 'clothing', 'shirt', 'shoes', 'hardware', 'electronics', 'stationery'],
  },
  {
    id: UNCATEGORISED_ID, name: 'Others', color: '#64748b', icon: '📄', order: 99,
    keywords: [],
  },
]
