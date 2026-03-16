export type TErrorDetails = {
  issues: {
    path: string | number;
    message: string;
  }[];
};

export type TGenericErrorResponse = {
  errorDetails: Record<string, any>;
  statusCode: number;
  message: string;
  // errorDetails: TErrorDetails;
};
