import { TrainerSpecialty } from './../../../node_modules/.prisma/client/index.d';
export interface IPaginationOptions {
  page?: number | string;
  limit?: number | string;
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
  postType?: 'all_trainers' | 'my_favorite_trainers';
  offset?: number | string;

  categoryName?: string;
  latitude?: number | string;
  longitude?: number | string;
  distanceInKm?: number | string;
  priceMin?: number | string;
  priceMax?: number | string;
  discountPriceMin?: number | string;
  discountPriceMax?: number | string;
  rating?: number | string;
  isActive?: boolean | string;
  startDate?: string;
  endDate?: string;
  subscriptionType?: string;
  duration?: string;

  // User-related filters
  userStatus?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  week?: number | string;
  trainerName?: string;
  isProfileComplete?: boolean | string;

  // Trainer-related filters
  specialtyName?: string;
  experienceYears?: number;
  trainerSpecialties?: string;
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
