import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loginSchema } from '../../src/validators/auth.validation.js';
import {
  availabilityRuleParamsSchema,
  createPlaceSchema,
  searchPlaceSchema,
} from '../../src/validators/place.validation.js';
import { idParamSchema } from '../../src/utils/validators.js';
import {
  canAccessPayment,
  canViewPlace,
} from '../../src/utils/access-control.js';
import {
  detectImageMime,
  isImageMimeCompatible,
  normalizeImageMime,
} from '../../src/utils/image-signature.js';

/**
 * Regression test hardening keamanan:
 * - otorisasi default-deny (pembayaran & detail tempat NONAKTIF)
 * - deteksi isi gambar dari magic bytes
 * - validasi menolak payload yang menyerupai SQL injection
 */

describe('canAccessPayment - default-deny', () => {
  const tenantId = '10';
  const hostId = '20';

  it('mengizinkan TENANT pemilik pemesanan', () => {
    assert.equal(
      canAccessPayment({ id: tenantId, role: 'TENANT' }, tenantId, hostId),
      true,
    );
  });

  it('menolak TENANT lain', () => {
    assert.equal(
      canAccessPayment({ id: '11', role: 'TENANT' }, tenantId, hostId),
      false,
    );
  });

  it('mengizinkan HOST pemilik tempat', () => {
    assert.equal(
      canAccessPayment({ id: hostId, role: 'HOST' }, tenantId, hostId),
      true,
    );
  });

  it('menolak HOST lain', () => {
    assert.equal(
      canAccessPayment({ id: '21', role: 'HOST' }, tenantId, hostId),
      false,
    );
  });

  it('menolak TENANT yang mencoba memakai id host', () => {
    assert.equal(
      canAccessPayment({ id: hostId, role: 'TENANT' }, tenantId, hostId),
      false,
    );
  });
});

describe('canViewPlace - tempat NONAKTIF tidak publik', () => {
  const hostId = '20';

  it('tempat AKTIF boleh dilihat siapa saja', () => {
    assert.equal(canViewPlace('AKTIF', hostId), true);
    assert.equal(canViewPlace('AKTIF', hostId, { id: '99', role: 'TENANT' }), true);
  });

  it('tempat NONAKTIF ditolak untuk tamu', () => {
    assert.equal(canViewPlace('NONAKTIF', hostId), false);
  });

  it('tempat NONAKTIF ditolak untuk tenant', () => {
    assert.equal(
      canViewPlace('NONAKTIF', hostId, { id: '30', role: 'TENANT' }),
      false,
    );
  });

  it('tempat NONAKTIF ditolak untuk host lain', () => {
    assert.equal(
      canViewPlace('NONAKTIF', hostId, { id: '21', role: 'HOST' }),
      false,
    );
  });

  it('tempat NONAKTIF boleh dilihat host pemiliknya', () => {
    assert.equal(
      canViewPlace('NONAKTIF', hostId, { id: hostId, role: 'HOST' }),
      true,
    );
  });
});

describe('detectImageMime - magic bytes', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('WEBP')]);
  const avi = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 0), Buffer.from('AVI ')]);

  it('mendeteksi JPEG', () => {
    assert.equal(detectImageMime(jpeg), 'image/jpeg');
  });

  it('mendeteksi PNG', () => {
    assert.equal(detectImageMime(png), 'image/png');
  });

  it('mendeteksi WEBP', () => {
    assert.equal(detectImageMime(webp), 'image/webp');
  });

  it('menolak file non-gambar', () => {
    assert.equal(detectImageMime(Buffer.from('hello world!')), null);
  });

  it('menolak RIFF yang bukan WEBP (mis. AVI)', () => {
    assert.equal(detectImageMime(avi), null);
  });

  it('menolak buffer terlalu pendek', () => {
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff])), null);
  });

  it('menyamakan image/jpg dengan image/jpeg', () => {
    assert.equal(normalizeImageMime('image/jpg'), 'image/jpeg');
    assert.equal(isImageMimeCompatible('image/jpg', 'image/jpeg'), true);
    assert.equal(isImageMimeCompatible('image/png', 'image/jpeg'), false);
  });
});

describe('validasi menolak payload SQL injection', () => {
  it('login menolak email berisi SQL injection', () => {
    const result = loginSchema.safeParse({
      email: "' OR 1=1--",
      password: 'password123',
    });

    assert.equal(result.success, false);
  });

  it('login tetap menerima email valid yang mengandung tanda plus', () => {
    const result = loginSchema.safeParse({
      email: 'tenant+ujian@spoth.test',
      password: 'password123',
    });

    assert.equal(result.success, true);
  });

  it('pencarian menolak nilai sort di luar whitelist', () => {
    const result = searchPlaceSchema.safeParse({
      sort: 'harga_asc; DROP TABLE users--',
    });

    assert.equal(result.success, false);
  });

  it('parameter id menolak ekspresi SQL', () => {
    const result = idParamSchema.safeParse({ id: '1 OR 1=1' });

    assert.equal(result.success, false);
  });

  it('parameter rule id menolak ekspresi SQL', () => {
    const result = availabilityRuleParamsSchema.safeParse({
      id: '1',
      ruleId: '1 UNION SELECT password_hash FROM users',
    });

    assert.equal(result.success, false);
  });

  it('keyword pencarian berisi UNION diperlakukan sebagai teks biasa', () => {
    // Nilai ini aman karena selalu dikirim sebagai parameter SQL ($n),
    // bukan disisipkan ke string query.
    const result = searchPlaceSchema.safeParse({
      keyword: "' UNION SELECT password_hash FROM users--",
    });

    assert.equal(result.success, true);
  });

  it('filter harga menolak nilai di atas batas', () => {
    const result = searchPlaceSchema.safeParse({
      max_harga: '999999999999999999999',
    });

    assert.equal(result.success, false);
  });
});

describe('validasi konten tempat', () => {
  const base = {
    nama_tempat: 'Lapak Uji',
    kategori: 'LAPAK_USAHA',
    alamat: 'Jl. Uji No. 1',
    kota: 'Bandung',
    harga_normal: 100000,
    tipe_durasi: 'HARIAN',
  };

  it('menolak URL foto dengan skema javascript:', () => {
    const result = createPlaceSchema.safeParse({
      ...base,
      foto: ['javascript:alert(1)'],
    });

    assert.equal(result.success, false);
  });

  it('menolak URL foto dengan skema data:', () => {
    const result = createPlaceSchema.safeParse({
      ...base,
      foto: ['data:image/png;base64,AAAA'],
    });

    assert.equal(result.success, false);
  });

  it('menerima URL foto https dan path relatif', () => {
    const result = createPlaceSchema.safeParse({
      ...base,
      foto: ['https://res.cloudinary.com/demo/image.jpg', '/uploads/foto.jpg'],
    });

    assert.equal(result.success, true);
  });

  it('menolak fasilitas lebih dari 500 karakter', () => {
    const result = createPlaceSchema.safeParse({
      ...base,
      fasilitas: 'a'.repeat(501),
    });

    assert.equal(result.success, false);
  });
});
