import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { TGenericErrorResponse } from '../interface/error';

// Parse Prisma validation error message to extract field details
const parsePrismaValidationError = (
  errorMessage: string,
): { field?: string; reason: string }[] => {
  const issues = [];

  // Common Prisma validation error patterns
  const patterns = [
    /Argument `(\w+)` of type `([^`]+)` needs at least (\d+) items/,
    /Argument `(\w+)` of type `([^`]+)` is not assignable to parameter/,
    /Unknown argument `(\w+)`/,
    /Argument `(\w+)`: Got invalid value (.*?)\./,
    /Type (\w+) does not have field `(\w+)`/,
  ];

  patterns.forEach(pattern => {
    const match = errorMessage.match(pattern);
    if (match) {
      issues.push({
        field: match[1] || match[2],
        reason: match[0],
      });
    }
  });

  // If no patterns matched, return the full error message
  if (issues.length === 0) {
    issues.push({
      reason: errorMessage,
    });
  }

  return issues;
};

export const handlePrismaError = (
  err: any,
): TGenericErrorResponse => {
  let statusCode = 400;
  let message = 'Validation error in database operation';
  let errorDetails: any = {};

  // Handle Prisma Validation Error
  if (err instanceof PrismaClientValidationError) {
    const issues = parsePrismaValidationError(err.message);
    message = 'Invalid data provided for database operation';
    errorDetails = {
      issues: issues.map(issue => ({
        field: issue.field || 'unknown',
        message: issue.reason,
      })),
    };
    return { statusCode, message, errorDetails };
  }

  // Handle Prisma Known Request Errors (specific error codes)
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2000':
        statusCode = 400;
        message = 'The provided value is too long for the column';
        errorDetails = { code: err.code, field: err.meta?.field_name };
        break;

      case 'P2001':
        statusCode = 404;
        message = `Record not found for ${err.meta?.model}`;
        errorDetails = { code: err.code, model: err.meta?.model };
        break;

      case 'P2002':
        statusCode = 409;
        message = `A record with the same ${(err.meta?.target as string[])?.join(', ') || 'field'} already exists`;
        errorDetails = { code: err.code, target: err.meta?.target };
        break;

      case 'P2003':
        statusCode = 400;
        message = `Foreign key constraint failed on field ${err.meta?.field_name}`;
        errorDetails = {
          code: err.code,
          field: err.meta?.field_name,
          model: err.meta?.modelName,
        };
        break;

      case 'P2004':
        statusCode = 400;
        message =
          'A constraint violation occurred that is not covered by the other message error codes';
        errorDetails = { code: err.code };
        break;

      case 'P2005':
        statusCode = 400;
        message = `The value ${err.meta?.value} is invalid for the field ${err.meta?.field_name}`;
        errorDetails = {
          code: err.code,
          field: err.meta?.field_name,
          value: err.meta?.value,
        };
        break;

      case 'P2006':
        statusCode = 400;
        message = `The provided value for the field ${err.meta?.field_name} is not valid`;
        errorDetails = { code: err.code, field: err.meta?.field_name };
        break;

      case 'P2007':
        statusCode = 400;
        message = `Data validation error on field ${err.meta?.field_name}: ${err.meta?.reason}`;
        errorDetails = {
          code: err.code,
          field: err.meta?.field_name,
          reason: err.meta?.reason,
        };
        break;

      case 'P2008':
        statusCode = 400;
        message = `Failed to parse the query at runtime`;
        errorDetails = { code: err.code };
        break;

      case 'P2009':
        statusCode = 400;
        message = `Failed to validate the query at runtime`;
        errorDetails = { code: err.code };
        break;

      case 'P2010':
        statusCode = 400;
        message = `Raw query failed`;
        errorDetails = { code: err.code, message: err.meta?.message };
        break;

      case 'P2011':
        statusCode = 400;
        message = `Null constraint violation on field ${err.meta?.field_name}`;
        errorDetails = { code: err.code, field: err.meta?.field_name };
        break;

      case 'P2012':
        statusCode = 400;
        message = `Missing a required value at ${(err.meta?.path as string[])?.join('.') || 'unknown'}`;
        errorDetails = { code: err.code, path: err.meta?.path };
        break;

      case 'P2013':
        statusCode = 400;
        message = `Missing the required argument ${err.meta?.argument}`;
        errorDetails = { code: err.code, argument: err.meta?.argument };
        break;

      case 'P2014':
        statusCode = 400;
        message = `The change you are trying to make violates a required relation`;
        errorDetails = { code: err.code, relation: err.meta?.relation_name };
        break;

      case 'P2015':
        statusCode = 404;
        message = `Related record not found for ${err.meta?.model}`;
        errorDetails = { code: err.code, model: err.meta?.model };
        break;

      case 'P2016':
        statusCode = 400;
        message = `Query interpretation error`;
        errorDetails = { code: err.code };
        break;

      case 'P2017':
        statusCode = 400;
        message = `The records for the relation between ${err.meta?.relation} are not connected`;
        errorDetails = { code: err.code, relation: err.meta?.relation };
        break;

      case 'P2018':
        statusCode = 400;
        message = `Required relation violation`;
        errorDetails = { code: err.code };
        break;

      case 'P2019':
        statusCode = 400;
        message = `Input error`;
        errorDetails = { code: err.code };
        break;

      case 'P2020':
        statusCode = 400;
        message = `Value out of range for the type`;
        errorDetails = { code: err.code };
        break;

      case 'P2021':
        statusCode = 404;
        message = `The table ${err.meta?.table} does not exist`;
        errorDetails = { code: err.code, table: err.meta?.table };
        break;

      case 'P2022':
        statusCode = 404;
        message = `The column ${err.meta?.column} does not exist`;
        errorDetails = { code: err.code, column: err.meta?.column };
        break;

      case 'P2025':
        statusCode = 404;
        message = `Record not found`;
        errorDetails = { code: err.code, cause: err.meta?.cause };
        break;

      default:
        statusCode = 400;
        message = err.message || 'Database operation failed';
        errorDetails = { code: err.code };
    }

    return { statusCode, message, errorDetails };
  }

  return { statusCode, message, errorDetails };
};

export default handlePrismaError;
