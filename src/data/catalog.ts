import type { District, CrimeCategory } from '../types';

// 31 Karnataka districts with real coordinates & approximate populations
export const DISTRICTS: District[] = [
  { id: 'BLR', name: 'Bengaluru Urban', region: 'Bengaluru', lat: 12.9716, lng: 77.5946, population: 13193000 },
  { id: 'BLR-R', name: 'Bengaluru Rural', region: 'Bengaluru', lat: 12.8004, lng: 77.7497, population: 1090000 },
  { id: 'MYS', name: 'Mysuru', region: 'Mysuru', lat: 12.2958, lng: 76.6394, population: 3200000 },
  { id: 'MND', name: 'Mandya', region: 'Mysuru', lat: 12.5218, lng: 76.8951, population: 1820000 },
  { id: 'CHM', name: 'Chamarajanagar', region: 'Mysuru', lat: 11.9239, lng: 76.9392, population: 1020000 },
  { id: 'TUM', name: 'Tumakuru', region: 'Bengaluru', lat: 13.3399, lng: 77.1081, population: 2700000 },
  { id: 'KOL', name: 'Kolar', region: 'Bengaluru', lat: 13.1376, lng: 78.1295, population: 1540000 },
  { id: 'CTA', name: 'Chikkaballapura', region: 'Bengaluru', lat: 13.4325, lng: 77.7133, population: 1260000 },
  { id: 'RAM', name: 'Ramanagara', region: 'Bengaluru', lat: 12.7099, lng: 77.2773, population: 1100000 },
  { id: 'HVN', name: 'Hassan', region: 'Mysuru', lat: 13.0977, lng: 76.0994, population: 1770000 },
  { id: 'CHK', name: 'Chikmagalur', region: 'Mysuru', lat: 13.3182, lng: 75.6218, population: 1130000 },
  { id: 'SHM', name: 'Shivamogga', region: 'Mysuru', lat: 13.9299, lng: 75.5681, population: 1750000 },
  { id: 'DAV', name: 'Davanagere', region: 'Central', lat: 14.4644, lng: 75.9218, population: 1950000 },
  { id: 'CHT', name: 'Chitradurga', region: 'Central', lat: 14.2251, lng: 76.3958, population: 1670000 },
  { id: 'BLG', name: 'Belagavi', region: 'Belagavi', lat: 15.8497, lng: 74.4977, population: 4779000 },
  { id: 'BJP', name: 'Vijayapura', region: 'Belagavi', lat: 16.8302, lng: 75.7100, population: 2210000 },
  { id: 'BGP', name: 'Bagalkot', region: 'Belagavi', lat: 16.1812, lng: 75.6960, population: 1890000 },
  { id: 'DHV', name: 'Dharwad', region: 'Hubballi', lat: 15.4589, lng: 75.0078, population: 1910000 },
  { id: 'GDG', name: 'Gadag', region: 'Hubballi', lat: 15.4286, lng: 75.6257, population: 1060000 },
  { id: 'HVR', name: 'Haveri', region: 'Hubballi', lat: 14.7564, lng: 75.3999, population: 1580000 },
  { id: 'UTT', name: 'Uttara Kannada', region: 'Coastal', lat: 14.5723, lng: 74.3197, population: 1440000 },
  { id: 'DWD', name: 'Dakshina Kannada', region: 'Dakshina Kannada', lat: 12.8470, lng: 75.2447, population: 2080000 },
  { id: 'UDI', name: 'Udupi', region: 'Dakshina Kannada', lat: 13.3409, lng: 74.7421, population: 1200000 },
  { id: 'KGP', name: 'Kodagu', region: 'Mysuru', lat: 12.3375, lng: 75.8069, population: 560000 },
  { id: 'KOP', name: 'Koppal', region: 'Kalaburagi', lat: 15.3484, lng: 76.1548, population: 1390000 },
  { id: 'GLB', name: 'Gadag-Dharwad', region: 'Hubballi', lat: 15.4432, lng: 75.0167, population: 1320000 },
  { id: 'KLB', name: 'Kalaburagi', region: 'Kalaburagi', lat: 17.3297, lng: 76.8340, population: 2560000 },
  { id: 'BDR', name: 'Bidar', region: 'Kalaburagi', lat: 17.9113, lng: 77.5191, population: 1700000 },
  { id: 'RYC', name: 'Raichur', region: 'Kalaburagi', lat: 16.2076, lng: 77.3463, population: 1930000 },
  { id: 'YDB', name: 'Yadgir', region: 'Kalaburagi', lat: 16.7665, lng: 77.1370, population: 1170000 },
  { id: 'BLL', name: 'Ballari', region: 'Kalaburagi', lat: 15.1394, lng: 76.9214, population: 3020000 },
];

// 31 districts (one per district for clarity); count validated at runtime

export const CRIME_CATEGORIES: CrimeCategory[] = [
  'Violent',
  'Property',
  'Cyber',
  'Economic',
  'Narcotics',
  'Against Women',
  'Against Children',
  'Public Order',
];

// Crime type -> category mapping (IPC sections included)
export interface CrimeTypeDef {
  type: string;
  category: CrimeCategory;
  ipc: string[];
  baseSeverity: number;
  weaponLikelihood: number;
  baseValueLoss: number;
  kn: string; // Kannada name
}

export const CRIME_TYPES: CrimeTypeDef[] = [
  { type: 'Murder', category: 'Violent', ipc: ['302', '120B'], baseSeverity: 10, weaponLikelihood: 0.85, baseValueLoss: 0, kn: 'ಹತ್ಯೆ' },
  { type: 'Attempt to Murder', category: 'Violent', ipc: ['307'], baseSeverity: 8, weaponLikelihood: 0.7, baseValueLoss: 0, kn: 'ಹತ್ಯೆ ಪ್ರಯತ್ನ' },
  { type: 'Culpable Homicide', category: 'Violent', ipc: ['304'], baseSeverity: 8, weaponLikelihood: 0.6, baseValueLoss: 0, kn: 'ಆಕಸ್ಮಿಕ ಹತ್ಯೆ' },
  { type: 'Grievous Hurt', category: 'Violent', ipc: ['326', '325'], baseSeverity: 6, weaponLikelihood: 0.65, baseValueLoss: 0, kn: 'ಗಂಭೀರ ಗಾಯ' },
  { type: 'Rioting', category: 'Public Order', ipc: ['147', '148', '149'], baseSeverity: 5, weaponLikelihood: 0.4, baseValueLoss: 50000, kn: 'ಗಲಭೆ' },
  { type: 'Kidnapping', category: 'Violent', ipc: ['363', '364A'], baseSeverity: 8, weaponLikelihood: 0.3, baseValueLoss: 0, kn: 'ಅಪಹರಣ' },
  { type: 'Robbery', category: 'Property', ipc: ['392', '397'], baseSeverity: 7, weaponLikelihood: 0.6, baseValueLoss: 85000, kn: 'ದರೋಡೆ' },
  { type: 'Dacoity', category: 'Property', ipc: ['395', '396'], baseSeverity: 9, weaponLikelihood: 0.85, baseValueLoss: 250000, kn: 'ದರೋಡೆ (ಗುಂಪು)' },
  { type: 'Theft', category: 'Property', ipc: ['379'], baseSeverity: 3, weaponLikelihood: 0.05, baseValueLoss: 35000, kn: 'ಕಳ್ಳತನ' },
  { type: 'Burglary', category: 'Property', ipc: ['457', '380'], baseSeverity: 4, weaponLikelihood: 0.15, baseValueLoss: 70000, kn: 'ಒಳನುಗ್ಗುವಿಕೆ' },
  { type: 'Cattle Theft', category: 'Property', ipc: ['379'], baseSeverity: 2, weaponLikelihood: 0, baseValueLoss: 40000, kn: 'ಜಾನುವಾರು ಕಳ್ಳತನ' },
  { type: 'Motor Vehicle Theft', category: 'Property', ipc: ['379'], baseSeverity: 3, weaponLikelihood: 0.1, baseValueLoss: 120000, kn: 'ವಾಹನ ಕಳ್ಳತನ' },
  { type: 'Chain Snatching', category: 'Property', ipc: ['379', '356'], baseSeverity: 4, weaponLikelihood: 0.2, baseValueLoss: 60000, kn: 'ಸರ ಕಿತ್ತುಕೊಳ್ಳುವುದು' },
  { type: 'Cheating', category: 'Economic', ipc: ['420'], baseSeverity: 4, weaponLikelihood: 0, baseValueLoss: 200000, kn: 'ವಂಚನೆ' },
  { type: 'Criminal Breach of Trust', category: 'Economic', ipc: ['406', '408'], baseSeverity: 4, weaponLikelihood: 0, baseValueLoss: 350000, kn: 'ನಂಬಿಕೆದ್ರೋಹ' },
  { type: 'Forgery', category: 'Economic', ipc: ['463', '467', '471'], baseSeverity: 3, weaponLikelihood: 0, baseValueLoss: 150000, kn: 'ಸುಳ್ಳು ದಾಖಲೆ' },
  { type: 'Online Fraud', category: 'Cyber', ipc: ['420', '66D IT Act'], baseSeverity: 4, weaponLikelihood: 0, baseValueLoss: 180000, kn: 'ಆನ್‌ಲೈನ್ ವಂಚನೆ' },
  { type: 'Phishing', category: 'Cyber', ipc: ['420', '66C IT Act'], baseSeverity: 3, weaponLikelihood: 0, baseValueLoss: 90000, kn: 'ಫಿಶಿಂಗ್' },
  { type: 'Ransomware', category: 'Cyber', ipc: ['420', '66F IT Act'], baseSeverity: 6, weaponLikelihood: 0, baseValueLoss: 500000, kn: 'ರ್ಯಾನ್ಸಮ್‌ವೇರ್' },
  { type: 'UPI Fraud', category: 'Cyber', ipc: ['420', '66D IT Act'], baseSeverity: 3, weaponLikelihood: 0, baseValueLoss: 45000, kn: 'UPI ವಂಚನೆ' },
  { type: 'Rape', category: 'Against Women', ipc: ['376'], baseSeverity: 10, weaponLikelihood: 0.25, baseValueLoss: 0, kn: 'ಅತ್ಯಾಚಾರ' },
  { type: 'Dowry Death', category: 'Against Women', ipc: ['304B'], baseSeverity: 9, weaponLikelihood: 0.1, baseValueLoss: 0, kn: 'ಹೆಣ್ಣು ಮರಣ' },
  { type: 'Cruelty by Husband', category: 'Against Women', ipc: ['498A'], baseSeverity: 5, weaponLikelihood: 0.15, baseValueLoss: 0, kn: 'ಪತಿಯ ಕ್ರೌರ್ಯ' },
  { type: 'Outraging Modesty', category: 'Against Women', ipc: ['354'], baseSeverity: 6, weaponLikelihood: 0.2, baseValueLoss: 0, kn: 'ಗಾಂಭೀರ್ಯ ಭಂಗ' },
  { type: 'POCSO', category: 'Against Children', ipc: ['POCSO 4'], baseSeverity: 10, weaponLikelihood: 0.1, baseValueLoss: 0, kn: 'POCSO' },
  { type: 'Child Labour', category: 'Against Children', ipc: ['Child Labour Act'], baseSeverity: 3, weaponLikelihood: 0, baseValueLoss: 0, kn: 'ಬಾಲ ಕಾರ್ಮಿಕ' },
  { type: 'NDPS Possession', category: 'Narcotics', ipc: ['NDPS 20'], baseSeverity: 6, weaponLikelihood: 0.2, baseValueLoss: 0, kn: 'ಮಾದಕ ದ್ರವ್ಯ' },
  { type: 'NDPS Trafficking', category: 'Narcotics', ipc: ['NDPS 21'], baseSeverity: 8, weaponLikelihood: 0.3, baseValueLoss: 0, kn: 'ಮಾದಕ ದ್ರವ್ಯ ಸಾಗಣೆ' },
  { type: 'Ganja Cultivation', category: 'Narcotics', ipc: ['NDPS 20'], baseSeverity: 5, weaponLikelihood: 0, baseValueLoss: 0, kn: 'ಗಂಜಾ ಸಾಗು' },
];

export const WEAPONS = ['Knife', 'Iron Rod', 'Firearm', 'Stick', 'Stone', 'Blunt Object', 'Acid', 'Rope'];
export const LOCATION_TYPES = ['Residence', 'Street', 'Market', 'Highway', 'Bank', 'Shop', 'Park', 'Office', 'Farm', 'School Vicinity', 'Bus Stand', 'ATM', 'Temple'];

export const GANG_NAMES = [
  'Dandupalya',
  'Narayan Reddy Gang',
  'Bannanje Gang',
  'Kolar Gang',
  'Mysuru Heist Crew',
  'Cyber Syndicate',
  'Narcotics Ring South',
  'Eastside Robbers',
  'Forest Brigands',
  'Bellary Mining Cartel',
];

export const OCCUPATIONS = ['Daily Wage', 'Farmer', 'Driver', 'Trader', 'Unemployed', 'Construction Worker', 'IT Employee', 'Mechanic', 'Salesman', 'Domestic Worker'];

export const KANNADA_DISTRICTS: Record<string, string> = {
  'Bengaluru Urban': 'ಬೆಂಗಳೂರು ನಗರ',
  Mysuru: 'ಮೈಸೂರು',
  'Dakshina Kannada': 'ದಕ್ಷಿಣ ಕನ್ನಡ',
  Belagavi: 'ಬೆಳಗಾವಿ',
  Kalaburagi: 'ಕಲಬುರಗಿ',
  Hubballi: 'ಹುಬ್ಬಳ್ಳಿ',
};

export const RANKS = ['Director General', 'IGP', 'SP', 'DySP', 'Inspector', 'Sub-Inspector', 'ASI', 'Head Constable', 'Constable'];

export const TIME_OF_DAY: ('Morning' | 'Afternoon' | 'Evening' | 'Night')[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

// Helper to look up a crime type definition
export const crimeDefByType = (type: string): CrimeTypeDef =>
  CRIME_TYPES.find((c) => c.type === type) ?? CRIME_TYPES[0];

export const districtById = (id: string): District | undefined =>
  DISTRICTS.find((d) => d.id === id);
