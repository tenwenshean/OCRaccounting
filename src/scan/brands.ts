/**
 * Well-known Malaysian merchants. Patterns are tolerant of common OCR slips.
 * Matched against the lower-cased receipt text; the top lines are checked first.
 */
export interface Brand {
  name: string
  pattern: RegExp
  categoryId: string
}

const b = (name: string, pattern: RegExp, categoryId: string): Brand => ({ name, pattern, categoryId })

export const BRANDS: Brand[] = [
  // Petrol
  b('Petronas', /petr[o0]nas|mesra/, 'petrol'),
  b('Shell', /\bshe[l1i]{2}\b|shell select/, 'petrol'),
  b('Petron', /\bpetr[o0]n\b/, 'petrol'),
  b('Caltex', /ca[l1]tex/, 'petrol'),
  b('BHPetrol', /\bbhp(etrol)?\b/, 'petrol'),
  b('Setel', /\bsetel\b/, 'petrol'),
  // Food
  b("McDonald's", /mc\s?donald|\bmcd\b/, 'food'),
  b('KFC', /\bkfc\b|kentucky fried/, 'food'),
  b('Tealive', /tealive/, 'food'),
  b('ZUS Coffee', /\bzus\b/, 'food'),
  b('Starbucks', /starbucks/, 'food'),
  b('Secret Recipe', /secret recipe/, 'food'),
  b('Pizza Hut', /pizza hut/, 'food'),
  b("Domino's", /domino'?s/, 'food'),
  b('Subway', /\bsubway\b/, 'food'),
  b('OldTown', /old\s?town white coffee/, 'food'),
  b('Marrybrown', /marry\s?brown/, 'food'),
  b('Texas Chicken', /texas chicken/, 'food'),
  b('A&W', /\ba\s?&\s?w\b/, 'food'),
  b('Sushi King', /sushi king/, 'food'),
  b("Nando's", /nando'?s/, 'food'),
  b('GrabFood', /grab\s?food/, 'food'),
  b('foodpanda', /food\s?panda/, 'food'),
  b('Mixue', /mixue/, 'food'),
  b('Chagee', /chagee/, 'food'),
  // Groceries / convenience
  b("Lotus's", /\blotus'?s\b|\blotus\b/, 'groceries'),
  b('AEON', /\bae[o0]n\b/, 'groceries'),
  b('Mydin', /\bmydin\b/, 'groceries'),
  b('Jaya Grocer', /jaya grocer/, 'groceries'),
  b('99 Speedmart', /99\s?speed\s?mart/, 'groceries'),
  b('KK Mart', /\bkk\s?(super\s?)?mart\b/, 'groceries'),
  b('Giant', /\bgiant\b/, 'groceries'),
  b('Village Grocer', /village grocer/, 'groceries'),
  b('Econsave', /econsave/, 'groceries'),
  b('NSK', /\bnsk\b/, 'groceries'),
  b('7-Eleven', /7\s?-?\s?eleven/, 'groceries'),
  b('FamilyMart', /family\s?mart/, 'groceries'),
  b('myNEWS', /\bmynews\b/, 'groceries'),
  // Telco
  b('Maxis', /\bmaxis\b/, 'telco'),
  b('Hotlink', /hotlink/, 'telco'),
  b('CelcomDigi', /celcom\s?digi|\bcelcom\b|\bdigi\b/, 'telco'),
  b('U Mobile', /u\s?mobile/, 'telco'),
  b('Unifi', /\bunifi\b/, 'telco'),
  b('Telekom Malaysia', /telekom malaysia/, 'telco'),
  b('Yes', /\byes\s?(4g|5g)\b/, 'telco'),
  b('Tune Talk', /tune\s?talk/, 'telco'),
  b('redONE', /\bred\s?one\b/, 'telco'),
  // Entertainment
  b('GSC', /\bgsc\b|golden screen/, 'entertainment'),
  b('TGV', /\btgv\b/, 'entertainment'),
  b('MBO', /\bmbo\b/, 'entertainment'),
  b('Netflix', /netflix/, 'entertainment'),
  b('Spotify', /spotify/, 'entertainment'),
  b('Steam', /\bsteam\b/, 'entertainment'),
  b('Dadi Cinema', /dadi cinema/, 'entertainment'),
  // Transport
  b("Touch 'n Go", /touch\s?'?n\s?go|\btng\b/, 'transport'),
  b('Parking', /parking|letak kereta/, 'transport'),
  b('PLUS', /plus malaysia|plus highway/, 'transport'),
  b('Rapid KL', /rapid\s?kl/, 'transport'),
  // Utilities
  b('TNB', /tenaga nasional|\btnb\b/, 'utilities'),
  b('Air Selangor', /air selangor|syabas/, 'utilities'),
  b('Indah Water', /indah water/, 'utilities'),
  // Health
  b('Guardian', /guardian/, 'health'),
  b('Watsons', /watsons/, 'health'),
  b('Caring Pharmacy', /caring pharmacy/, 'health'),
  b('Alpro', /\balpro\b/, 'health'),
  b('BIG Pharmacy', /big pharmacy/, 'health'),
  // Shopping
  b('Mr DIY', /mr\.?\s?diy/, 'shopping'),
  b('Uniqlo', /uniqlo/, 'shopping'),
  b('H&M', /\bh\s?&\s?m\b/, 'shopping'),
  b('IKEA', /\bikea\b/, 'shopping'),
  b('Decathlon', /decathlon/, 'shopping'),
  b('Popular', /popular book/, 'shopping'),
  b('Daiso', /daiso/, 'shopping'),
  b('Shopee', /shopee/, 'shopping'),
  b('Lazada', /lazada/, 'shopping'),
  // Gift
  b('Florist', /florist/, 'gift'),
]

/** Find a known merchant. Lines near the top of the receipt win over lines further down. */
export function findBrand(lines: string[]): { brand: Brand; line: number } | null {
  const lower = lines.map((l) => l.toLowerCase())
  for (let i = 0; i < lower.length; i++) {
    for (const brand of BRANDS) {
      if (brand.pattern.test(lower[i])) return { brand, line: i }
    }
  }
  return null
}
