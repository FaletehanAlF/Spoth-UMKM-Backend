import type { Request, Response } from 'express';

import { sendSuccess } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { paramString } from '../utils/validators.js';
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
} from '../services/placeAvailability.service.js';
import type {
  CreateAvailabilityRulePayload,
  UpdateAvailabilityRulePayload,
} from '../validators/place.validation.js';

export const getAvailabilityRules = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const hostId = req.user?.id;
    const rules = await listRules(paramString(req.params.id), hostId);

    sendSuccess(res, 200, 'Berhasil memuat aturan ketersediaan', { rules });
  },
);

export const createAvailabilityRule = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rule = await createRule(
      paramString(req.params.id),
      req.user!.id,
      req.body as CreateAvailabilityRulePayload,
    );

    sendSuccess(res, 201, 'Aturan ketersediaan berhasil ditambahkan', { rule });
  },
);

export const updateAvailabilityRule = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rule = await updateRule(
      paramString(req.params.id),
      paramString(req.params.ruleId),
      req.user!.id,
      req.body as UpdateAvailabilityRulePayload,
    );

    sendSuccess(res, 200, 'Aturan ketersediaan berhasil diperbarui', { rule });
  },
);

export const removeAvailabilityRule = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await deleteRule(
      paramString(req.params.id),
      paramString(req.params.ruleId),
      req.user!.id,
    );

    sendSuccess(res, 200, 'Aturan ketersediaan berhasil dihapus');
  },
);