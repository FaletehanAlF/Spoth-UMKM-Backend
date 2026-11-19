import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { closeDatabasePool, pool } from '../../src/config/database.js';
import { findScheduleConflicts } from '../../src/services/place.service.js';

/**
 * Uji integrasi READ-ONLY terhadap database.
 *
 * Sengaja tidak membuat/mengubah data apa pun: hanya membaca pemesanan yang
 * sudah ada, lalu memastikan pengecekan jadwal menganggap rentang tersebut
 * sebagai konflik.
 *
 * Jalankan dengan:
 *   RUN_DB_TESTS=1 npm test
 *
 * Tanpa flag tersebut, seluruh test pada berkas ini dilewati agar tidak
 * bergantung pada database pada lingkungan pengujian biasa.
 */
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';

describe('findScheduleConflicts (integrasi read-only)', { skip: !RUN_DB_TESTS }, () => {
  after(async () => {
    await closeDatabasePool();
  });

  it('booking lama dengan status aktif tetap terdeteksi sebagai konflik', async () => {
    const existing = await pool.query<{
      place_id: string;
      tanggal_mulai: string;
      tanggal_selesai: string;
    }>(
      `SELECT place_id::text AS place_id,
              tanggal_mulai::text AS tanggal_mulai,
              tanggal_selesai::text AS tanggal_selesai
       FROM bookings
       WHERE status = ANY($1::varchar[])
       ORDER BY id ASC
       LIMIT 1`,
      [['MENUNGGU_PEMBAYARAN', 'LUNAS']],
    );

    const booking = existing.rows[0];

    if (!booking) {
      console.warn('[test] Tidak ada booking aktif di database; uji dilewati.');
      return;
    }

    const conflicts = await findScheduleConflicts(
      booking.place_id,
      booking.tanggal_mulai,
      booking.tanggal_selesai,
    );

    assert.ok(conflicts.length > 0, 'Rentang booking lama harus terdeteksi sebagai konflik');
  });
});
