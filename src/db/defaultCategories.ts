import type { Category } from './types'

export const UNCATEGORISED_ID = 'others'

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'petrol', name: 'Petrol', color: '#ea580c', icon: '⛽', order: 1,
    keywords: ['petronas', 'shell', 'petron', 'caltex', 'bhpetrol', 'setel', 'ron95', 'ron97', 'diesel', 'litre', 'pump'],
  },
  {
    id: 'food', name: 'Food', color: '#16a34a', icon: '🍜', order: 2,
    keywords: ['mcdonald', 'kfc', 'tealive', 'zus', 'starbucks', 'secret recipe', 'grabfood', 'foodpanda', 'nasi', 'teh', 'kopi', 'mee', 'meal', 'dine in', 'takeaway', 'restoran', 'restaurant'],
  },
  {
    id: 'groceries', name: 'Groceries', color: '#65a30d', icon: '🛒', order: 3,
    keywords: ["lotus's", 'lotus', 'aeon', 'mydin', 'jaya grocer', '99 speedmart', 'kk mart', 'giant', 'village grocer'],
  },
  {
    id: 'entertainment', name: 'Entertainment', color: '#9333ea', icon: '🎬', order: 4,
    keywords: ['gsc', 'tgv', 'mbo', 'netflix', 'spotify', 'steam', 'cinema', 'karaoke', 'bowling'],
  },
  {
    id: 'gift', name: 'Gift', color: '#db2777', icon: '🎁', order: 5,
    keywords: ['gift card', 'hamper', 'gift wrap', 'florist', 'flower'],
  },
  {
    id: 'telco', name: 'Telco', color: '#2563eb', icon: '📱', order: 6,
    keywords: ['maxis', 'hotlink', 'celcomdigi', 'celcom', 'digi', 'u mobile', 'unifi', 'yes', 'tm', 'prepaid', 'postpaid', 'reload', 'topup'],
  },
  {
    id: 'transport', name: 'Transport', color: '#0891b2', icon: '🚗', order: 7,
    keywords: ['toll', 'parking', 'touch n go', 'grab', 'lrt', 'mrt', 'plus'],
  },
  {
    id: 'utilities', name: 'Utilities', color: '#ca8a04', icon: '💡', order: 8,
    keywords: ['tnb', 'tenaga', 'syabas', 'air selangor', 'indah water'],
  },
  {
    id: 'health', name: 'Health', color: '#dc2626', icon: '💊', order: 9,
    keywords: ['guardian', 'watsons', 'clinic', 'klinik', 'pharmacy', 'farmasi', 'hospital'],
  },
  {
    id: UNCATEGORISED_ID, name: 'Others', color: '#64748b', icon: '📄', order: 99,
    keywords: [],
  },
]
