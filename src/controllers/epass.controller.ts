import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import { formatEPassText, getEPass } from '../services/epass.service.js';

/**
 * GET /api/epass/:bookingId
 * Menampilkan E-Pass (kode booking + rincian pemesanan).
 */
export const showEPass = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const epass = await getEPass(paramString(req.params.id), req.user!.id, req.user!.role);

    sendSuccess(res, 200, 'Berhasil memuat E-Pass', {
      epass,
      teks_epass: formatEPassText(epass),
    });
  },
);
