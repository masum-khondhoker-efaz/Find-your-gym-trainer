import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { foundingTeamService } from './foundingTeam.service';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFoundingTeam = catchAsync(async (req, res) => {
  const user = req.user as any;

  const { file, body } = req;

  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Team member image is needed.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'team-member-images');
  const teamData = {
    ...body,
    image: fileUrl,
  };

  const result = await foundingTeamService.createFoundingTeamIntoDb(
    user.id,
    teamData,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Founding Team created successfully',
    data: result,
  });
});

const getFoundingTeamList = catchAsync(async (req, res) => {
  const result = await foundingTeamService.getFoundingTeamListFromDb(req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Founding Team list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getFoundingTeamById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await foundingTeamService.getFoundingTeamByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Founding Team details retrieved successfully',
    data: result,
  });
});

const updateFoundingTeam = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { file, body } = req;

  let teamData = { ...body };

  if (file) {
    // Upload to DigitalOcean
    const fileUrl = await uploadFileToS3(file, 'team-member-images');
    teamData.image = fileUrl;
  }
  const result = await foundingTeamService.updateFoundingTeamIntoDb(
    user.id,
    req.params.id,
    teamData,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Founding Team updated successfully',
    data: result,
  });
});

const deleteFoundingTeam = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await foundingTeamService.deleteFoundingTeamItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Founding Team deleted successfully',
    data: result,
  });
});

export const foundingTeamController = {
  createFoundingTeam,
  getFoundingTeamList,
  getFoundingTeamById,
  updateFoundingTeam,
  deleteFoundingTeam,
};
