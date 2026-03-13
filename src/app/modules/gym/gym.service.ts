import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import axios from 'axios';
import config from '../../../config';

type NearbyGymsParams = {
  lat: string;
  lng: string;
  radiusKm?: number;
  gymName?: string;
  avgRating?: number;
};

type NormalizedGym = {
  gymName: string;
  gymAddress: string | null;
  categoryName: string | null;
  googlePlaceId: string;
  latitude: number;
  longitude: number;
  description: string | null;
  website: string | null;
  phone: string | null;
  totalScore: number | null;
  reviewsCount: number | null;
  imageUrl: string | null;
  openingHours: Array<{
    day?: string;
    hours?: string;
  }>;
};

const NEARBY_GYM_CACHE_TTL_MS = Number(
  process.env.NEARBY_GYM_CACHE_TTL_MS || 5 * 60 * 1000,
);

const nearbyGymsCache = new Map<
  string,
  { expiresAt: number; gyms: NormalizedGym[] }
>();

const buildNearbyGymCacheKey = (lat: string, lng: string, radiusKm: number) => {
  const normalizedLat = Number(lat).toFixed(4);
  const normalizedLng = Number(lng).toFixed(4);
  const normalizedRadius = Number(radiusKm).toFixed(2);

  return `${normalizedLat}:${normalizedLng}:${normalizedRadius}`;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

type ApifyGymItem = {
  title?: string;
  name?: string;
  description?: string;
  placeId?: string;
  place_id?: string;
  googlePlaceId?: string;
  location?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  address?: string;
  categoryName?: string;
  categories?: string[];
  // website?: string;
  // phone?: string;
  totalScore?: number;
  reviewsCount?: number;
  imageUrl?: string;
  openingHours?: Array<{
    day?: string;
    hours?: string;
  }>;
};

const normalizeApifyGym = (item: ApifyGymItem) => {
  const placeId = item.placeId || item.place_id || item.googlePlaceId;
  const latitude =
    item.latitude ?? item.lat ?? item.location?.latitude ?? item.location?.lat;
  const longitude =
    item.longitude ??
    item.lng ??
    item.location?.longitude ??
    item.location?.lng;

  if (!placeId || latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    gymName: item.title || item.name || 'Unknown Gym',
    gymAddress: item.address || null,
    categoryName: item.categoryName || item.categories?.[0] || null,
    googlePlaceId: placeId,
    latitude,
    longitude,
    description: item.description || null,
    // website: item.website || null,
    // phone: item.phone || null,
    totalScore: item.totalScore ?? null,
    reviewsCount: item.reviewsCount ?? null,
    imageUrl: item.imageUrl || null,
    openingHours: item.openingHours || [],
  };
};

const fetchNearbyGymsFromApify = async ({
  lat,
  lng,
  radiusKm = 50,
}: NearbyGymsParams) => {
  const apifyToken = config.apify?.token;
  const apifyDatasetId =
   config.apify?.dataset_id;

  if (!apifyToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'APIFY_TOKEN is not configured.',
    );
  }

  const targetLat = Number(lat);
  const targetLng = Number(lng);

  if (Number.isNaN(targetLat) || Number.isNaN(targetLng)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'latitude and longitude must be valid numbers',
    );
  }

  // console.log('[nearby-gyms] Apify request input:', {
  //   lat: targetLat,
  //   lng: targetLng,
  //   radiusKm,
  //   datasetId: apifyDatasetId,
  // });

  const cacheKey = buildNearbyGymCacheKey(lat, lng, radiusKm);
  const cachedData = nearbyGymsCache.get(cacheKey);

  if (cachedData && cachedData.expiresAt > Date.now()) {
    console.log('[nearby-gyms] cache hit', {
      cacheKey,
      cachedGyms: cachedData.gyms.length,
    });
    return cachedData.gyms;
  }

  const url = `https://api.apify.com/v2/datasets/${apifyDatasetId}/items`;

  const { data } = await axios.get(url, {
    params: {
      token: apifyToken,
      clean: true,
    },
  });

  if (!Array.isArray(data)) {
    // console.log('[nearby-gyms] Apify response is not an array');
    return [];
  }

  const normalized = data
    .map((item: ApifyGymItem) => normalizeApifyGym(item))
    .filter(Boolean) as NormalizedGym[];

  const seen = new Set<string>();
  const uniqueGyms = normalized.filter(gym => {
    if (seen.has(gym.googlePlaceId)) {
      return false;
    }
    seen.add(gym.googlePlaceId);
    return true;
  });

  const nearbyGyms = uniqueGyms.filter(gym => {
    const dist = distanceInKm(targetLat, targetLng, gym.latitude, gym.longitude);
    return dist <= radiusKm;
  });

  // console.log('[nearby-gyms] Apify gyms fetched:', {
  //   totalRaw: data.length,
  //   totalNormalized: normalized.length,
  //   totalUnique: uniqueGyms.length,
  //   totalNearby: nearbyGyms.length,
  // });

  const gymsToCache = nearbyGyms.length === 0 ? uniqueGyms : nearbyGyms;
  nearbyGymsCache.set(cacheKey, {
    gyms: gymsToCache,
    expiresAt: Date.now() + NEARBY_GYM_CACHE_TTL_MS,
  });

  console.log('[nearby-gyms] cache miss', {
    cacheKey,
    cachedGyms: gymsToCache.length,
    ttlMs: NEARBY_GYM_CACHE_TTL_MS,
  });

  if (nearbyGyms.length === 0) {
    // console.log(
    //   '[nearby-gyms] No gyms in radius; returning unfiltered unique dataset gyms',
    // );
    return uniqueGyms;
  }

  return nearbyGyms;
};

const getNearbyGymsFromDbAndApify = async ({
  lat,
  lng,
  radiusKm,
  gymName,
  avgRating,
}: NearbyGymsParams) => {
  // if (Number.isNaN(lat) || Number.isNaN(lng)) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'lat and lng must be valid numbers',
  //   );
  // }

  const apifyGyms = await fetchNearbyGymsFromApify({
    lat,
    lng,
    radiusKm,
  });

  const normalizedGymName = gymName?.trim().toLowerCase();
  const filteredByName = normalizedGymName
    ? apifyGyms.filter(gym =>
        gym.gymName.toLowerCase().includes(normalizedGymName),
      )
    : apifyGyms;

  const filteredApifyGyms =
    avgRating !== undefined
      ? filteredByName.filter(
          gym => gym.totalScore !== null && gym.totalScore <= avgRating,
        )
      : filteredByName;
  // console.log('[nearby-gyms] Merge started:', {
    // apifyGymCount: apifyGyms.length,
  // });

  if (filteredApifyGyms.length === 0) {
    // console.log('[nearby-gyms] No gyms from Apify, returning empty list');
    return [];
  }

  const placeIds = filteredApifyGyms.map(g => g.googlePlaceId);

  const gymsInDb = await prisma.gym.findMany({
    where: {
      googlePlaceId: {
        in: placeIds,
      },
    },
    include: {
      trainers: {
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  // console.log('[nearby-gyms] DB gyms matched by googlePlaceId:', {
  //   matchedGymCount: gymsInDb.length,
  // });

  const trainersByPlaceId = new Map(
    gymsInDb.map(gym => [
      gym.googlePlaceId,
      gym.trainers.map(trainer => ({
        id: trainer.id,
        name: trainer.user?.fullName || null,
      })),
    ]),
  );

  const merged = filteredApifyGyms.map(gym => {
    const trainers = trainersByPlaceId.get(gym.googlePlaceId) || [];

    if (trainers.length > 0) {
      return {
        gymName: gym.gymName,
        gymAddress: gym.gymAddress,
        categoryName: gym.categoryName,
        googlePlaceId: gym.googlePlaceId,
        latitude: gym.latitude,
        longitude: gym.longitude,
        description: gym.description,
        website: gym.website,
        phone: gym.phone,
        totalScore: gym.totalScore,
        reviewsCount: gym.reviewsCount,
        imageUrl: gym.imageUrl,
        openingHours: gym.openingHours,
        trainers,
      };
    }

    return {
      gymName: gym.gymName,
      gymAddress: gym.gymAddress,
      categoryName: gym.categoryName,
      googlePlaceId: gym.googlePlaceId,
      latitude: gym.latitude,
      longitude: gym.longitude,
      description: gym.description,
      website: gym.website,
      phone: gym.phone,
      totalScore: gym.totalScore,
      reviewsCount: gym.reviewsCount,
      imageUrl: gym.imageUrl,
      openingHours: gym.openingHours,
    };
  });

  // const gymsWithTrainerCount = merged.filter(
  //   gym => 'trainers' in gym && Array.isArray(gym.trainers),
  // ).length;

  // console.log('[nearby-gyms] Merge completed:', {
  //   totalGymsReturned: merged.length,
  //   gymsWithTrainers: gymsWithTrainerCount,
  //   gymsWithoutTrainers: merged.length - gymsWithTrainerCount,
  // });

  return merged;
};

const getNearbyGymsForAuthFromDbAndApify = async (
  userId: string,
  params: NearbyGymsParams,
) => {
  // Reuses existing nearby flow, which already checks cache before Apify fetch.
  const gyms = await getNearbyGymsFromDbAndApify(params);

  if (gyms.length === 0) {
    return [];
  }

  const placeIds = gyms.map(gym => gym.googlePlaceId);
  const favoriteGyms = await prisma.favoriteGyms.findMany({
    where: {
      userId,
      googlePlaceId: {
        in: placeIds,
      },
    },
    select: {
      googlePlaceId: true,
    },
  });

  const favoritePlaceIds = new Set(favoriteGyms.map(gym => gym.googlePlaceId));

  return gyms.map(gym => ({
    ...gym,
    isFavorite: favoritePlaceIds.has(gym.googlePlaceId),
  }));
};

export const gymService = {
  getNearbyGymsFromDbAndApify,
  getNearbyGymsForAuthFromDbAndApify,
};
