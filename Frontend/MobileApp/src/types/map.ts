export type CategoryId = 'all' | 'Công viên' | 'Bảo tàng' | 'Tôn giáo';

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
