import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  availabilitySchema,
  createAvailabilityRuleSchema,
} from '../../src/validators/place.validation.js';
import {
  createBookingSchema,
  pricePreviewSchema,
} from '../../src/validators/booking.validation.js';
import { dateOnlySchema } from '../../src/utils/validators.js';

/**
 * Regression test: tanggal yang tidak ada (kalender) harus ditolak oleh
 * seluruh schema yang memakai `dateOnlySchema`, termasuk:
 *   - createBookingSchema (Pemesanan)
 *   - pricePreviewSchema (Pratinjau Biaya)
 *   - availabilitySchema (Cek Ketersediaan)
 *   - createAvailabilityRuleSchema (Aturan Ketersediaan)
 */

describe('dateOnlySchema — validasi kalender', () => {
  it('menerima tanggal kalender yang valid', () => {
    for (const valid of ['2026-12-01', '2026-11-30', '2024-02-29', '2026-01-31']) {
      assert.equal(
        dateOnlySchema.safeParse(valid).success,
        true,
        `Harus valid: ${valid}`,
      );
    }
  });

  it('menolak tanggal yang tidak ada', () => {
    for (const invalid of [
      '2026-02-30',
      '2026-04-31',
      '2026-02-29',
      '2026-13-01',
      '2026-01-00',
      '2026-00-15',
      '2027-02-29',
    ]) {
      assert.equal(
        dateOnlySchema.safeParse(invalid).success,
        false,
        `Harus ditolak: ${invalid}`,
      );
    }
  });
});

describe('createBookingSchema — tanggal_mulai kalender', () => {
  it('menerima tanggal kalender yang valid', () => {
    const result = createBookingSchema.safeParse({
      place_id: 1,
      tanggal_mulai: '2026-12-01',
      jumlah_durasi: 2,
      jenis_usaha: 'Kedai',
    });

    assert.equal(result.success, true);
  });

  it('menolak tanggal yang tidak ada (2026-02-30)', () => {
    const result = createBookingSchema.safeParse({
      place_id: 1,
      tanggal_mulai: '2026-02-30',
      jumlah_durasi: 2,
      jenis_usaha: 'Kedai',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
      assert.equal(
        result.error.issues.some((issue) => issue.path[0] === 'tanggal_mulai'),
        true,
      );
    }
  });
});

describe('pricePreviewSchema — tanggal_mulai kalender', () => {
  it('menerima tanggal kalender yang valid', () => {
    const result = pricePreviewSchema.safeParse({
      place_id: 1,
      tanggal_mulai: '2026-12-01',
      jumlah_durasi: 3,
    });

    assert.equal(result.success, true);
  });

  it('menolak tanggal yang tidak ada (2026-02-30)', () => {
    const result = pricePreviewSchema.safeParse({
      place_id: 1,
      tanggal_mulai: '2026-02-30',
      jumlah_durasi: 3,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.error.issues.some((issue) => issue.path[0] === 'tanggal_mulai'),
      );
    }
  });
});

describe('availabilitySchema — tanggal_mulai kalender', () => {
  it('menerima tanggal kalender yang valid', () => {
    const result = availabilitySchema.safeParse({
      tanggal_mulai: '2026-12-01',
      jumlah_durasi: 2,
    });

    assert.equal(result.success, true);
  });

  it('menolak tanggal yang tidak ada (2026-02-30)', () => {
    const result = availabilitySchema.safeParse({
      tanggal_mulai: '2026-02-30',
      jumlah_durasi: 2,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.error.issues.some((issue) => issue.path[0] === 'tanggal_mulai'),
      );
    }
  });
});

describe('createAvailabilityRuleSchema — tanggal kalender', () => {
  it('menerima tanggal kalender yang valid', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-10',
    });

    assert.equal(result.success, true);
  });

  it('menolak tanggal_mulai yang tidak ada (2026-02-30)', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-02-30',
      tanggal_selesai: '2026-03-10',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(
        result.error.issues.some((issue) => issue.path[0] === 'tanggal_mulai'),
      );
    }
  });
});

describe('Uji konsistensi tanggal antar schema', () => {
  it('semua schema terkait tanggal menolak 2026-02-30', () => {
    const cases: Array<[
      { safeParse: (v: unknown) => { success: boolean } },
      Record<string, unknown>,
    ]> = [
      [
        createBookingSchema,
        {
          place_id: 1,
          tanggal_mulai: '2026-02-30',
          jumlah_durasi: 2,
          jenis_usaha: 'Kedai',
        },
      ],
      [
        pricePreviewSchema,
        {
          place_id: 1,
          tanggal_mulai: '2026-02-30',
          jumlah_durasi: 2,
        },
      ],
      [
        availabilitySchema,
        {
          tanggal_mulai: '2026-02-30',
          jumlah_durasi: 2,
        },
      ],
    ];

    for (const [schema, value] of cases) {
      assert.equal(schema.safeParse(value).success, false, 'Harus menolak 2026-02-30');
    }
  });
});
