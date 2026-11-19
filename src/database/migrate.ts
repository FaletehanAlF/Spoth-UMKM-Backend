import fs from 'node:fs/promises';
import path from 'node:path';

import { closeDatabasePool, pool } from '../config/database.js';

/**
 * Folder tempat file migrasi (.sql) disimpan.
 * Lokasi: database/migrations
 */
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database', 'migrations');

/**
 * Menjalankan seluruh file migrasi yang belum pernah dijalankan.
 *
 * Setiap file `.sql` dijalankan di dalam satu transaksi. Berkas yang sama
 * tidak akan dijalankan dua kali karena daftar file yang sudah dijalankan
 * dicatat pada tabel `app_meta.schema_migrations`.
 *
 * Catatan: tabel pencatat migrasi sengaja diletakkan pada schema terpisah
 * (`app_meta`) supaya schema `public` hanya berisi enam tabel sesuai
 * rancangan ERD pada SRS Subbab 4.2.1.
 *
 * Jalankan dengan: `npm run migrate`
 */
async function migrate(): Promise<void> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS app_meta');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_meta.schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] Tidak ada file migrasi yang ditemukan.');

    return;
  }

  let executed = 0;

  for (const file of files) {
    // Status "sudah dijalankan" dicek ulang untuk setiap berkas, bukan hanya
    // sekali di awal. Ini penting karena sebuah migrasi bisa menghapus riwayat
    // migrasi lain (contoh: 000_reset_legacy_schema.sql).
    const appliedResult = await pool.query<{ filename: string }>(
      'SELECT filename FROM app_meta.schema_migrations WHERE filename = $1',
      [file],
    );

    if (appliedResult.rows.length > 0) {
      console.log(`[migrate] Lewati (sudah dijalankan): ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Migrasi destruktif (mis. reset skema legacy) hanya boleh berjalan
      // bila operator mengaktifkannya secara eksplisit. Flag ini tidak
      // mengubah koneksi database; ia hanya men-set GUC sesi transaksi
      // sehingga berkas migrasi dapat memeriksanya dengan aman.
      if (process.env.ALLOW_DESTRUCTIVE_MIGRATION === 'true') {
        console.warn(
          '[migrate] ALLOW_DESTRUCTIVE_MIGRATION=true — migrasi destruktif diizinkan untuk sesi ini.',
        );
        await client.query("SELECT set_config('app.allow_destructive_reset', 'on', true)");
      }

      await client.query(sql);
      await client.query(
        'INSERT INTO app_meta.schema_migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');

      console.log(`[migrate] Berhasil menjalankan: ${file}`);
      executed += 1;
    } catch (error) {
      await client.query('ROLLBACK');

      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[migrate] Gagal menjalankan ${file}: ${message}`);

      throw error;
    } finally {
      client.release();
    }
  }

  console.log(`[migrate] Selesai. ${executed} migrasi baru dijalankan dari ${files.length} berkas.`);
}

migrate()
  .then(async () => {
    await closeDatabasePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[migrate] Migrasi dibatalkan karena terjadi error.');
    await closeDatabasePool();
    process.exit(1);
  });
