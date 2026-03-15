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
  categories: string[];
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

const APIFY_ACTOR_TIMEOUT_MS = Number(
  process.env.APIFY_ACTOR_TIMEOUT_MS || 5 * 60 * 1000, // 5 minutes
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

const runApifyActor = async ({
  lat,
  lng,
  radiusKm = 50,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
}) => {
  const apifyToken = config.apify?.token;
  const apifyActorId = config.apify?.actor_id;
  const maxResults = config.apify?.max_results || 50;

  if (!apifyToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'APIFY_TOKEN is not configured.',
    );
  }

  if (!apifyActorId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'APIFY_ACTOR_ID is not configured.',
    );
  }

  const actorInput = {
    customGeolocation: {
      type: 'Point',
      coordinates: [lng.toString(), lat.toString()],
      radiusKm,
      maxResults,
    },
    includeWebResults: false,
    language: 'en',
    locationQuery: 'usa',
    maxCrawledPlacesPerSearch: 20,
    maxImages: 0,
    maxQuestions: 0,
    maxReviews: 0,
    maximumLeadsEnrichmentRecords: 0,
    reviewsOrigin: 'all',
    reviewsSort: 'newest',
    scrapeContacts: false,
    scrapeDirectories: false,
    scrapeImageAuthors: false,
    scrapePlaceDetailPage: false,
    scrapeReviewsPersonalData: true,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      tiktoks: false,
      twitters: false,
      youtubes: false,
    },
    scrapeTableReservationProvider: false,
    searchMatching: 'all',
    searchStringsArray: ['gym', 'fitness center'],
    skipClosedPlaces: false,
    website: 'allPlaces',
    placeMinimumStars: '',
    reviewsFilterString: '',
    allPlacesNoSearchAction: '',
  };

  console.log('[nearby-gyms] Starting Apify actor run with input:', actorInput);

  // Start the actor run
  const runUrl = `https://api.apify.com/v2/acts/${apifyActorId}/runs`;
  const { data: runData } = await axios.post(runUrl, actorInput, {
    headers: {
      Authorization: `Bearer ${apifyToken}`,
    },
  });

  const runId = runData.data.id;
  console.log('[nearby-gyms] Actor run started with ID:', runId);

  // Wait for the run to complete
  let runStatus = runData.data.status;
  let attempts = 0;
  const maxAttempts = Math.ceil(APIFY_ACTOR_TIMEOUT_MS / 5000); // Check every 5 seconds

  while (runStatus !== 'SUCCEEDED' && runStatus !== 'FAILED' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again

    const statusUrl = `https://api.apify.com/v2/acts/${apifyActorId}/runs/${runId}`;
    const { data: statusData } = await axios.get(statusUrl, {
      headers: {
        Authorization: `Bearer ${apifyToken}`,
      },
    });

    runStatus = statusData.data.status;
    attempts++;
    console.log(`[nearby-gyms] Actor run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
  }

  if (runStatus !== 'SUCCEEDED') {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Apify actor run failed or timed out. Status: ${runStatus}`,
    );
  }

  console.log('[nearby-gyms] Actor run completed successfully');

  // Get the dataset ID from the run
  const statusUrl = `https://api.apify.com/v2/acts/${apifyActorId}/runs/${runId}`;
  const { data: finalRunData } = await axios.get(statusUrl, {
    headers: {
      Authorization: `Bearer ${apifyToken}`,
    },
  });

  const datasetId = finalRunData.data.defaultDatasetId;

  if (!datasetId) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'No dataset returned from Apify actor run.',
    );
  }

  console.log('[nearby-gyms] Dataset ID from actor run:', datasetId);

  return datasetId;
};

const fetchGymsFromApifyDataset = async (datasetId: string) => {
  const apifyToken = config.apify?.token;

  if (!apifyToken) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'APIFY_TOKEN is not configured.',
    );
  }

  const url = `https://api.apify.com/v2/datasets/${datasetId}/items`;

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${apifyToken}`,
    },
    params: {
      clean: true,
    },
  });

  if (!Array.isArray(data)) {
    return [];
  }

  return data;
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
    categoryName: item.categoryName || null,
    categories: item.categories || [],
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
  const targetLat = Number(lat);
  const targetLng = Number(lng);

  if (Number.isNaN(targetLat) || Number.isNaN(targetLng)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'latitude and longitude must be valid numbers',
    );
  }

  const cacheKey = buildNearbyGymCacheKey(lat, lng, radiusKm);
  const cachedData = nearbyGymsCache.get(cacheKey);

  if (cachedData && cachedData.expiresAt > Date.now()) {
    console.log('[nearby-gyms] cache hit', {
      cacheKey,
      cachedGyms: cachedData.gyms.length,
    });
    return cachedData.gyms;
  }

  console.log('[nearby-gyms] cache miss, running actor', {
    cacheKey,
  });

  // Run the actor to fetch fresh data for the user's location
  const datasetId = await runApifyActor({
    lat: targetLat,
    lng: targetLng,
    radiusKm,
  });

  // Fetch data from the dataset generated by the actor
  const data = await fetchGymsFromApifyDataset(datasetId);

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

  console.log('[nearby-gyms] Actor data fetched:', {
    totalRaw: data.length,
    totalNormalized: normalized.length,
    totalUnique: uniqueGyms.length,
  });

  nearbyGymsCache.set(cacheKey, {
    gyms: uniqueGyms,
    expiresAt: Date.now() + NEARBY_GYM_CACHE_TTL_MS,
  });

  console.log('[nearby-gyms] cache updated', {
    cacheKey,
    cachedGyms: uniqueGyms.length,
    ttlMs: NEARBY_GYM_CACHE_TTL_MS,
  });

  return uniqueGyms;
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
              image: true,
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
        image: trainer.user?.image || null,
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
        categories: gym.categories,
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
      categories: gym.categories,
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
