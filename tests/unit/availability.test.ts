import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collectAvailabilityRuleIssues,
  createAvailabilityRuleSchema,
  updateAvailabilityRuleSchema,
} from '../../src/validators/place.validation.js';
import {
  CONFLICT_STATUS_ATURAN,
  CONFLICT_STATUS_PERIODE,
  CONFLICT_STATUS_TIDAK_AKTIF,
  evaluateAvailabilityRules,
  getAvailabilityPeriodConflicts,
  getPlaceStatusConflict,
  isRuleApplicable,
} from '../../src/services/availability.logic.js';
import { dateOnlySchema } from '../../src/utils/validators.js';
import type { AvailabilityRuleRow } from '../../src/types/place.types.js';

/** Membuat baris aturan ketersediaan untuk pengujian. */
function rule(overrides: Partial<AvailabilityRuleRow> = {}): AvailabilityRuleRow {
  return {
    id: '1',
    place_id: '1',
    tipe_aturan: 'TANGGAL',
    tanggal_mulai: '2026-12-01',
    tanggal_selesai: '2026-12-31',
    hari: null,
    bulan: null,
    tersedia: false,
    created_at: new Date('2026-11-01T00:00:00.000Z'),
    updated_at: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('evaluateAvailabilityRules', () => {
  it('aturan tersedia=false memblokir booking pada rentang yang berlaku', () => {
    const conflicts = evaluateAvailabilityRules(
      [
        rule({
          tipe_aturan: 'TANGGAL',
          tanggal_mulai: '2026-12-01',
          tanggal_selesai: '2026-12-05',
          tersedia: false,
        }),
      ],
      '2026-12-01',
      '2026-12-05',
    );

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, CONFLICT_STATUS_ATURAN);
  });

  it('aturan tersedia=true tidak membatalkan aturan tersedia=false pada tanggal yang sama', () => {
    const conflicts = evaluateAvailabilityRules(
      [
        rule({
          id: '10',
          tipe_aturan: 'TANGGAL',
          tanggal_mulai: '2026-12-01',
          tanggal_selesai: '2026-12-31',
          tersedia: true,
        }),
        rule({
          id: '11',
          tipe_aturan: 'HARI',
          tanggal_mulai: '2026-12-01',
          tanggal_selesai: '2026-12-31',
          hari: 2, // Selasa
          tersedia: false,
        }),
      ],
      '2026-12-01', // Selasa
      '2026-12-01',
    );

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, CONFLICT_STATUS_ATURAN);
  });

  it('aturan berlaku di luar rentang tanggalnya tidak memblokir', () => {
    const conflicts = evaluateAvailabilityRules(
      [rule({ tanggal_mulai: '2026-12-10', tanggal_selesai: '2026-12-20', tersedia: false })],
      '2026-12-01',
      '2026-12-05',
    );

    assert.deepEqual(conflicts, []);
  });

  it('aturan HARI mencocokkan hari dengan benar (0=Minggu, 2=Selasa)', () => {
    const selasa = new Date('2026-12-01T00:00:00.000Z'); // Selasa
    const rabu = new Date('2026-12-02T00:00:00.000Z'); // Rabu

    assert.equal(
      isRuleApplicable(
        rule({ tipe_aturan: 'HARI', hari: 2, tanggal_mulai: '2026-12-01', tanggal_selesai: '2026-12-31' }),
        '2026-12-01',
        selasa,
      ),
      true,
    );
    assert.equal(
      isRuleApplicable(
        rule({ tipe_aturan: 'HARI', hari: 2, tanggal_mulai: '2026-12-01', tanggal_selesai: '2026-12-31' }),
        '2026-12-02',
        rabu,
      ),
      false,
    );
  });

  it('aturan BULAN mencocokkan bulan dengan benar', () => {
    const desember = new Date('2026-12-15T00:00:00.000Z');

    assert.equal(
      isRuleApplicable(
        rule({ tipe_aturan: 'BULAN', bulan: 12, tanggal_mulai: '2026-01-01', tanggal_selesai: '2026-12-31' }),
        '2026-12-15',
        desember,
      ),
      true,
    );
    assert.equal(
      isRuleApplicable(
        rule({ tipe_aturan: 'BULAN', bulan: 11, tanggal_mulai: '2026-01-01', tanggal_selesai: '2026-12-31' }),
        '2026-12-15',
        desember,
      ),
      false,
    );
  });
});

describe('getPlaceStatusConflict', () => {
  it('tempat NONAKTIF tidak dinyatakan tersedia', () => {
    const conflict = getPlaceStatusConflict('NONAKTIF', '2026-12-01', '2026-12-03');

    assert.ok(conflict);
    assert.equal(conflict?.status, CONFLICT_STATUS_TIDAK_AKTIF);
  });

  it('tempat AKTIF tidak menghasilkan konflik status', () => {
    assert.equal(getPlaceStatusConflict('AKTIF', '2026-12-01', '2026-12-03'), null);
  });
});

describe('getAvailabilityPeriodConflicts', () => {
  const place = {
    tanggal_mulai_tersedia: '2026-12-10',
    tanggal_selesai_tersedia: '2026-12-20',
  };

  it('menolak tanggal mulai sebelum periode', () => {
    const conflicts = getAvailabilityPeriodConflicts(place, '2026-12-01', '2026-12-05');

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, CONFLICT_STATUS_PERIODE);
  });

  it('menolak tanggal selesai setelah periode', () => {
    const conflicts = getAvailabilityPeriodConflicts(place, '2026-12-18', '2026-12-25');

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, CONFLICT_STATUS_PERIODE);
  });

  it('menerima rentang di dalam periode', () => {
    assert.deepEqual(getAvailabilityPeriodConflicts(place, '2026-12-11', '2026-12-15'), []);
  });

  it('periode kosong tidak membatasi', () => {
    assert.deepEqual(
      getAvailabilityPeriodConflicts(
        { tanggal_mulai_tersedia: null, tanggal_selesai_tersedia: null },
        '2026-12-11',
        '2026-12-15',
      ),
      [],
    );
  });
});

describe('dateOnlySchema (validasi kalender)', () => {
  it('menerima tanggal kalender yang valid', () => {
    assert.equal(dateOnlySchema.safeParse('2026-12-01').success, true);
    assert.equal(dateOnlySchema.safeParse('2024-02-29').success, true);
  });

  it('menolak tanggal kalender yang tidak ada', () => {
    assert.equal(dateOnlySchema.safeParse('2026-02-30').success, false);
    assert.equal(dateOnlySchema.safeParse('2026-04-31').success, false);
    assert.equal(dateOnlySchema.safeParse('2026-02-29').success, false);
    assert.equal(dateOnlySchema.safeParse('2026-13-01').success, false);
  });

  it('menolak format selain YYYY-MM-DD', () => {
    assert.equal(dateOnlySchema.safeParse('01-12-2026').success, false);
    assert.equal(dateOnlySchema.safeParse('2026-12-1').success, false);
  });

  it('dipakai oleh skema aturan ketersediaan', () => {
    const invalid = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-02-30',
      tanggal_selesai: '2026-03-05',
    });

    assert.equal(invalid.success, false);
  });
});

describe('createAvailabilityRuleSchema', () => {
  it('default tersedia = false (aturan baru berarti Tidak tersedia)', () => {
    const parsed = createAvailabilityRuleSchema.parse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-05',
    });

    assert.equal(parsed.tersedia, false);
  });

  it('menerima tersedia=true bila dikirim eksplisit', () => {
    const parsed = createAvailabilityRuleSchema.parse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-05',
      tersedia: true,
    });

    assert.equal(parsed.tersedia, true);
  });

  it('menolak tipe HARI tanpa hari', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'HARI',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-31',
    });

    assert.equal(result.success, false);
  });

  it('menolak tipe BULAN tanpa bulan', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'BULAN',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-31',
    });

    assert.equal(result.success, false);
  });

  it('menolak tipe TANGGAL yang membawa hari/bulan', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-31',
      hari: 2,
    });

    assert.equal(result.success, false);
  });

  it('menolak tanggal selesai lebih awal dari tanggal mulai', () => {
    const result = createAvailabilityRuleSchema.safeParse({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-10',
      tanggal_selesai: '2026-12-01',
    });

    assert.equal(result.success, false);
  });
});

describe('updateAvailabilityRuleSchema + validasi gabungan (lama + baru)', () => {
  it('menolak kedua tanggal bila selesai lebih awal dari mulai', () => {
    const result = updateAvailabilityRuleSchema.safeParse({
      tanggal_mulai: '2026-12-10',
      tanggal_selesai: '2026-12-01',
    });

    assert.equal(result.success, false);
  });

  it('menolak hasil gabungan: ubah HARI -> BULAN tanpa bulan', () => {
    const existing = rule({
      tipe_aturan: 'HARI',
      hari: 2,
      bulan: null,
      tersedia: true,
    });

    const merged = {
      tipe_aturan: 'BULAN' as const,
      tanggal_mulai: existing.tanggal_mulai,
      tanggal_selesai: existing.tanggal_selesai,
      hari: existing.hari,
      bulan: existing.bulan,
      tersedia: existing.tersedia,
    };

    const issues = collectAvailabilityRuleIssues(merged);
    assert.ok(issues.length > 0);
  });

  it('menolak hasil gabungan: ubah tanggal_mulai melewati tanggal_selesai lama', () => {
    const existing = rule({
      tipe_aturan: 'TANGGAL',
      tanggal_mulai: '2026-12-01',
      tanggal_selesai: '2026-12-05',
      tersedia: false,
    });

    const merged = {
      ...existing,
      tanggal_mulai: '2026-12-10',
    };

    const issues = collectAvailabilityRuleIssues(merged);
    assert.ok(issues.some((issue) => issue.field === 'tanggal_selesai'));
  });

  it('menerima hasil gabungan yang konsisten', () => {
    const existing = rule({
      tipe_aturan: 'HARI',
      hari: 2,
      bulan: null,
      tersedia: false,
    });

    const merged = {
      tipe_aturan: 'HARI' as const,
      tanggal_mulai: existing.tanggal_mulai,
      tanggal_selesai: existing.tanggal_selesai,
      hari: 5,
      bulan: existing.bulan,
      tersedia: true,
    };

    assert.deepEqual(collectAvailabilityRuleIssues(merged), []);
  });
});
