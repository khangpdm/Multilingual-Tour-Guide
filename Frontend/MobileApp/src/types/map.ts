export type CategoryId =
  'all' | 'landmark' | 'museum' | 'religious' | 'architecture' | 'park' | 'food';

export interface CategoryOption {
  id: CategoryId;
  label: string;
}

export interface PoiProperties {
  id: string;
  name: string;
  category: string;
  image?: string;
  description?: string;
  cluster?: boolean;
}
