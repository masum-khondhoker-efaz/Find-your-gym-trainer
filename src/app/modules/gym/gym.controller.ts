import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { gymService } from './gym.service';

const getNearbyGyms = catchAsync(async (req, res) => {
  const lat = Array.isArray(req.query.latitude)
    ? String(req.query.latitude[0])
    : String(req.query.latitude);
  const lng = Array.isArray(req.query.longitude)
    ? String(req.query.longitude[0])
    : String(req.query.longitude);
  const radiusKm = req.query.radiusKm
    ? Number(req.query.radiusKm)
    : undefined;
  const gymName = Array.isArray(req.query.gymName)
    ? String(req.query.gymName[0])
    : req.query.gymName
      ? String(req.query.gymName)
      : undefined;
  const avgRating = req.query.avgRating
    ? Number(req.query.avgRating)
    : undefined;

  const result = await gymService.getNearbyGymsFromDbAndApify({
    lat,
    lng,
    radiusKm,
    gymName,
    avgRating,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Nearby gyms retrieved successfully',
    data: result,
  });
});

const getNearbyGymsAuth = catchAsync(async (req, res) => {
  const user = req.user as any;
  const lat = Array.isArray(req.query.latitude)
    ? String(req.query.latitude[0])
    : String(req.query.latitude);
  const lng = Array.isArray(req.query.longitude)
    ? String(req.query.longitude[0])
    : String(req.query.longitude);
  const radiusKm = req.query.radiusKm
    ? Number(req.query.radiusKm)
    : undefined;
  const gymName = Array.isArray(req.query.gymName)
    ? String(req.query.gymName[0])
    : req.query.gymName
      ? String(req.query.gymName)
      : undefined;
  const avgRating = req.query.avgRating
    ? Number(req.query.avgRating)
    : undefined;

  const result = await gymService.getNearbyGymsForAuthFromDbAndApify(user.id, {
    lat,
    lng,
    radiusKm,
    gymName,
    avgRating,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Nearby gyms retrieved successfully',
    data: result,
  });
});

export const gymController = {
  getNearbyGyms,
  getNearbyGymsAuth,
};