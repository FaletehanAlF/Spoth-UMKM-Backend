/** Baris tabel `categories` (master kategori tempat). */
export interface CategoryRow {
  id: string;
  nama: string;
  is_preset: boolean;
}

/** Bentuk kategori yang dikirim ke frontend (dropdown). */
export interface CategoryResponse {
  id: string;
  nama: string;
  is_preset: boolean;
}
