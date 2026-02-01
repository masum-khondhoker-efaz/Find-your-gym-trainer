export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginationResult {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface IPaginationResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ISearchAndFilterOptions extends IPaginationOptions {
  searchTerm?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
  offset?: number;

  categoryName?: string;
  latitude?: number;
  longitude?: number;
  distanceInKm?: number;
  priceMin?: number;
  priceMax?: number;
  discountPriceMin?: number;
  discountPriceMax?: number;
  rating?: number;
  isActive?: boolean | string;

  // User-related filters
  userStatus?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  week?: number;
  trainerName?: string;
  isProfileComplete?: boolean | string;

  // Trainer-related filters
  specialtyName?: string;
  experienceYears?: number;
  trainerServiceType?: string;
  serviceName?: string;
  trainerServiceTypes?: string;

  // Category-related filters
  name?: string;
  // Product-related filters
  productName?: string;
  description?: string;
  content?: string;
  priceRange?: 'low' | 'medium' | 'high';


  // Founding Team-related filters
  memberName?: string;
  position?: string;
  department?: string;
  linkedin?: string;
  instagram?: string;
  twitter?: string;

  // Order-related filters
  orderStatus?: string;
  paymentMethod?: string;
  transactionId?: string;
  orderDateStart?: string;
  orderDateEnd?: string;

  // Support-related filters
  status?: string;
  userEmail?: string;
  userPhone?: string;

  // order-related filters
  paymentStatus?: string;
}
