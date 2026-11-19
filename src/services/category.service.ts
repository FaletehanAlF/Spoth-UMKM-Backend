import { pool } from '../config/database.js';
import type { Queryable } from '../types/database.js';
import type { CategoryResponse, CategoryRow } from '../types/category.types.js';

const CATEGORY_COLUMNS = `
  id::text AS id,
  nama     AS nama,
  is_preset AS is_preset
`;

/**
 * Daftar kategori untuk dropdown (preset dulu, lalu preset + custom
 * diurutkan alfabetis). Publik — tidak berisi data sensitif.
 */
export async function listCategories(): Promise<CategoryResponse[]> {
  const result = await pool.query<CategoryRow>(
    `SELECT ${CATEGORY_COLUMNS}
     FROM categories
     ORDER BY is_preset DESC, nama ASC`,
  );

  return result.rows;
}

/**
 * Mendaftarkan kategori custom ke master `categories` bila belum ada.
 *
 * Dipanggil saat Host membuat/mengubah tempat dengan kategori custom, agar
 * kategori tersebut otomatis tampil pada dropdown Host berikutnya.
 * Kategori yang gagal terdaftar (mis. sudah ada) tidak menggagalkan proses.
 */
export async function ensureCategory(
  nama: string,
  createdBy: string,
  client: Queryable = pool,
): Promise<void> {
  const trimmed = nama.trim();

  if (!trimmed) {
    return;
  }

  await client.query(
    `INSERT INTO categories (nama, is_preset, created_by)
     VALUES ($1, FALSE, $2::integer)
     ON CONFLICT (nama) DO NOTHING`,
    [trimmed, createdBy],
  );
}
