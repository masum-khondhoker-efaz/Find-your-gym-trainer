import { Response } from 'express';

type TMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type TResponse<T> = {
  statusCode: number;
  success?: boolean;
  message?: string;
  meta?: TMeta;
  stats?: any;
  data: T;
};

const sendResponse = <T>(res: Response, data: TResponse<T>) => {
  res.status(data?.statusCode).json({
    success: data?.success || data?.statusCode < 400 ? true : false,
    statusCode: data?.statusCode,
    message: data.message,
    ...(data.stats && { stats: data.stats }),
    data: data.data,
    meta: data.meta,
  });
};

export default sendResponse;
