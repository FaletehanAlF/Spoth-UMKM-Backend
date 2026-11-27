import type { Request, Response } from 'express';

import { sendPaginated, sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  checkAvailability,
  createPlace,
  deletePlace,
  getHostSummary,
  getPlaceDetail,
  listMyPlaces,
  listPlaces,
  updatePlace,
} from '../services/place.service.js';
import type {
  AvailabilityPayload,
  CreatePlacePayload,
  MyPlacePayload,
  SearchPlacePayload,
  UpdatePlacePayload,
} from '../validators/place.validation.js';

/**
 * GET /api/places
 * Pencarian & filter tempat untuk Tenant.
 */
export const searchPlaces = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as SearchPlacePayload;
    const result = await listPlaces(query);

    sendPaginated(res, 'Berhasil memuat daftar tempat', result);
  },
);

/**
 * GET /api/places/:id
 * Detail tempat: foto, aturan, lokasi, harga, dan ketersediaan.
 */
export const getPlace = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const place = await getPlaceDetail(paramString(req.params.id));

    sendSuccess(res, 200, 'Berhasil memuat detail tempat', { place });
  },
);

/**
 * GET /api/places/:id/availability
 * Mengecek apakah tanggal yang diminta bentrok dengan jadwal yang ada.
 */
export const getAvailability = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AvailabilityPayload;
    const result = await checkAvailability(
      paramString(req.params.id),
      query.tanggal_mulai,
      query.tipe_durasi,
      query.jumlah_durasi,
    );

    sendSuccess(res, 200, 'Berhasil memeriksa ketersediaan', { ketersediaan: result });
  },
);

/**
 * POST /api/places
 * Host menambah tempat baru.
 */
export const createNewPlace = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as CreatePlacePayload;
    const place = await createPlace(req.user!.id, payload);

    sendSuccess(res, 201, 'Tempat berhasil ditambahkan', { place });
  },
);

/**
 * GET /api/places/mine
 * Daftar tempat milik Host yang sedang login.
 */
export const getMyPlaces = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as MyPlacePayload;
    const result = await listMyPlaces(req.user!.id, query);

    sendPaginated(res, 'Berhasil memuat daftar tempat Anda', result);
  },
);

/**
 * GET /api/places/mine/summary
 * Ringkasan untuk dashboard Host.
 */
export const getSummary = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const summary = await getHostSummary(req.user!.id);

    sendSuccess(res, 200, 'Berhasil memuat ringkasan dashboard', { ringkasan: summary });
  },
);

/**
 * PATCH /api/places/:id
 * Host mengubah data tempat (termasuk harga normal dan harga promo).
 */
export const updateExistingPlace = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as UpdatePlacePayload;
    const place = await updatePlace(paramString(req.params.id), req.user!.id, payload);

    sendSuccess(res, 200, 'Tempat berhasil diperbarui', { place });
  },
);

/**
 * DELETE /api/places/:id
 * Host menghapus tempatnya.
 */
export const removePlace = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await deletePlace(paramString(req.params.id), req.user!.id);

    sendSuccess(res, 200, 'Tempat berhasil dihapus');
  },
);
