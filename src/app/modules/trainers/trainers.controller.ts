import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { trainersService } from './trainers.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';


const getTrainersList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await trainersService.getTrainersListFromDb(/*user.id*/ req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainers list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getTrainersById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await trainersService.getTrainersByIdFromDb(/*user.id*/ req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Trainers details retrieved successfully',
    data: result,
  });
});



export const trainersController = {
  getTrainersList,
  getTrainersById,

};