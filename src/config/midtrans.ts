import { env } from './env.js';
import { AppError } from '../utils/app-error.js';

/**
 * Alamat API Midtrans, berbeda antara mode sandbox dan production.
 */
function baseUrl(): string {
  return env.midtrans.isProduction
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';
}

function apiUrl(): string {
  return env.midtrans.isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';
}

function modeMidtrans(): 'sandbox' | 'production' {
  return env.midtrans.isProduction ? 'production' : 'sandbox';
}

/**
 * Menampilkan bentuk key tanpa membocorkan bagian rahasianya.
 *
 * Dipakai di log dan endpoint diagnostik supaya bisa memastikan key mana yang
 * sedang dipakai tanpa menulis key lengkap ke terminal.
 */
export function petunjukKunci(kunci: string): string {
  if (!kunci) {
    return '(kosong)';
  }

  const awalan = [
    'SB-Mid-server-',
    'SB-Mid-client-',
    'Mid-server-',
    'Mid-client-',
  ].find((prefix) => kunci.startsWith(prefix));

  return `${awalan ?? kunci.slice(0, 6)}... (${kunci.length} karakter)`;
}

/**
 * Memastikan server key sudah diisi di .env sebelum memanggil Midtrans.
 */
function pastikanServerKey(): string {
  if (!env.midtrans.serverKey) {
    throw new AppError(
      'MIDTRANS_SERVER_KEY belum diatur di .env. Pembayaran belum bisa diproses.',
      500,
    );
  }

  return env.midtrans.serverKey;
}

/**
 * Header otentikasi Midtrans: Basic base64(serverKey + ":").
 */
function headerOtentikasi(): Record<string, string> {
  const kunci = Buffer.from(`${pastikanServerKey()}:`).toString('base64');

  return {
    Authorization: `Basic ${kunci}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Menerjemahkan penolakan Midtrans menjadi pesan yang mudah ditindaklanjuti.
 *
 * 401 berarti server key tidak dikenali atau sudah tidak aktif pada mode yang
 * dipakai (sandbox/production).
 */
function pesanPenolakan(
  status: number,
  hasil: {
    error_messages?: string[];
    status_message?: string;
  },
): string {
  const mode = modeMidtrans();
  const kunci = petunjukKunci(env.midtrans.serverKey);
  const dashboard = mode === 'sandbox' ? 'Sandbox' : 'Production';

  if (status === 401) {
    return (
      `Server key Midtrans ditolak (401) pada mode ${mode}. ` +
      `Key yang dipakai: ${kunci}. Pastikan key dibuat di dashboard ${dashboard} ` +
      'dengan izin "Snap Checkout: Write", belum di-revoke, dan belum ' +
      'kedaluwarsa.'
    );
  }

  if (status === 403) {
    return (
      `Server key Midtrans tidak punya izin membuat transaksi (403) pada mode ` +
      `${mode}. Buka Settings > Access Keys, lalu beri izin ` +
      '"Snap Checkout: Write".'
    );
  }

  if (status === 404) {
    return 'Endpoint Midtrans tidak ditemukan (404). Periksa konfigurasi URL Midtrans.';
  }

  return (
    hasil.error_messages?.join(', ') ??
    hasil.status_message ??
    `Midtrans menolak permintaan (HTTP ${status})`
  );
}

export interface SnapTransactionInput {
  orderId: string;
  grossAmount: number;
  namaTenant: string;
  namaTempat: string;
  namaHost: string;
  adminFee: number;
  totalSewa: number;
}

/** Masa berlaku halaman pembayaran Snap, dalam jam. */
export const MASA_BERLAKU_SNAP_JAM = 24;

export interface SnapTransactionResult {
  token: string;
  redirectUrl: string;
}

/**
 * Membuat transaksi Snap di Midtrans dan mengembalikan token serta
 * link halaman pembayaran yang dibuka pengguna.
 */
export async function buatTransaksiSnap(
  input: SnapTransactionInput,
): Promise<SnapTransactionResult> {
  const body = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
    item_details: [
      {
        id: 'sewa',
        name: `Sewa ${input.namaTempat}`.slice(0, 50),
        price: input.totalSewa,
        quantity: 1,
      },
      {
        id: 'admin',
        name: 'Biaya admin',
        price: input.adminFee,
        quantity: 1,
      },
    ],
    customer_details: {
      first_name: input.namaTenant.slice(0, 50),
    },
    // Batas waktu pembayaran dibuat eksplisit agar sama dengan yang disimpan
    // di database. Tanpa ini, masa berlaku mengikuti setelan dashboard.
    expiry: {
      unit: 'hours',
      duration: MASA_BERLAKU_SNAP_JAM,
    },
    // Nama pemilik ikut dikirim sebagai catatan pesanan.
    custom_field1: input.namaHost.slice(0, 60),
  };

  const respon = await fetch(`${baseUrl()}/snap/v1/transactions`, {
    method: 'POST',
    headers: headerOtentikasi(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const hasil = (await respon.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
    status_message?: string;
  };

  if (!respon.ok || !hasil.token || !hasil.redirect_url) {
    throw new AppError(
      `Gagal membuat transaksi Midtrans: ${pesanPenolakan(respon.status, hasil)}`,
      502,
    );
  }

  return {
    token: hasil.token,
    redirectUrl: hasil.redirect_url,
  };
}

export interface MidtransKeyCheck {
  ok: boolean;
  httpStatus: number;
  mode: 'sandbox' | 'production';
  message: string;
}

/**
 * Menguji apakah server key benar-benar diterima Midtrans.
 *
 * Memakai token Snap palsu. Midtrans membalas 404 bila autentikasi berhasil,
 * 401 bila key ditolak, dan 403 bila izin Snap belum aktif. Tidak ada
 * transaksi yang dibuat.
 */
export async function cekKunciMidtrans(): Promise<MidtransKeyCheck> {
  const mode = modeMidtrans();

  if (!env.midtrans.serverKey) {
    return {
      ok: false,
      httpStatus: 0,
      mode,
      message: 'MIDTRANS_SERVER_KEY belum diisi di .env.',
    };
  }

  try {
    // Endpoint status Snap memakai izin yang sama dengan pembuatan transaksi,
    // jadi hasil cek ini mewakili seluruh kebutuhan aplikasi.
    const respon = await fetch(
      `${baseUrl()}/snap/v1/transactions/SPOTH-KEY-CHECK/status`,
      {
        method: 'GET',
        headers: headerOtentikasi(),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (respon.status === 404) {
      return {
        ok: true,
        httpStatus: 404,
        mode,
        message:
          `Server key diterima oleh Midtrans ${mode} dan izin ` +
          '"Snap Checkout" aktif.',
      };
    }

    if (respon.status === 401) {
      return {
        ok: false,
        httpStatus: 401,
        mode,
        message:
          `Server key ditolak oleh Midtrans ${mode} (401). ` +
          `Key ${petunjukKunci(env.midtrans.serverKey)} tidak valid, ` +
          'sudah di-revoke, atau kedaluwarsa.',
      };
    }

    if (respon.status === 403) {
      return {
        ok: false,
        httpStatus: 403,
        mode,
        message:
          `Server key dikenali, tetapi izin "Snap Checkout" belum aktif ` +
          `(403) pada mode ${mode}. Buka Settings > Access Keys, lalu beri ` +
          'izin "Snap Checkout" pada key tersebut.',
      };
    }

    return {
      ok: false,
      httpStatus: respon.status,
      mode,
      message: `Midtrans membalas HTTP ${respon.status} pada mode ${mode}.`,
    };
  } catch (error) {
    const pesan = error instanceof Error ? error.message : 'unknown error';

    return {
      ok: false,
      httpStatus: 0,
      mode,
      message: `Tidak bisa menghubungi Midtrans ${mode}: ${pesan}`,
    };
  }
}

export interface MidtransStatus {
  orderId: string;
  transactionStatus: string;
  fraudStatus: string | null;
  paymentType: string | null;
  grossAmount: string | null;
  transactionId: string | null;
  raw: Record<string, unknown>;
}

/**
 * Menanyakan status transaksi lewat API Snap.
 *
 * Izin "Snap Checkout" sudah mencakup pembacaan status, jadi endpoint ini
 * tidak membutuhkan izin "Core API: Read" tambahan.
 *
 * Mengembalikan null bila token tidak dikenal agar pemanggil bisa memakai
 * API Core sebagai cadangan (misalnya untuk pembayaran lama).
 */
export async function ambilStatusTransaksiSnap(
  snapToken: string,
  orderId: string,
): Promise<MidtransStatus | null> {
  const respon = await fetch(
    `${baseUrl()}/snap/v1/transactions/${encodeURIComponent(snapToken)}/status`,
    {
      method: 'GET',
      headers: headerOtentikasi(),
      signal: AbortSignal.timeout(20000),
    },
  );

  const hasil = (await respon.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const statusTransaksi = String(hasil.transaction_status ?? '');

  // Pengguna belum memilih metode pembayaran. Midtrans membalas
  // "Payment has not been made" tanpa transaction_status.
  if (respon.status === 201 && statusTransaksi === '') {
    return {
      orderId: String(hasil.order_id ?? orderId),
      transactionStatus: 'pending',
      fraudStatus: null,
      paymentType: null,
      grossAmount: (hasil.gross_amount as string | undefined) ?? null,
      transactionId: null,
      raw: hasil,
    };
  }

  if (respon.ok && statusTransaksi !== '') {
    return {
      orderId: String(hasil.order_id ?? orderId),
      transactionStatus: statusTransaksi,
      fraudStatus: (hasil.fraud_status as string | undefined) ?? null,
      paymentType: (hasil.payment_type as string | undefined) ?? null,
      grossAmount: (hasil.gross_amount as string | undefined) ?? null,
      transactionId: (hasil.transaction_id as string | undefined) ?? null,
      raw: hasil,
    };
  }

  if (respon.status === 404) {
    return null;
  }

  const alasan =
    respon.status === 403
      ? 'Server key belum punya izin membaca status transaksi Snap (403). ' +
        'Buka Settings > Access Keys, lalu pastikan izin "Snap Checkout" aktif.'
      : pesanPenolakan(respon.status, hasil as {
          error_messages?: string[];
          status_message?: string;
        });

  throw new AppError(
    `Gagal mengambil status pembayaran dari Midtrans: ${alasan}`,
    502,
  );
}

/**
 * Menanyakan status transaksi lewat API Core.
 *
 * Hanya dipakai sebagai cadangan untuk pembayaran lama yang belum punya
 * token Snap. Pembayaran baru selalu memakai [ambilStatusTransaksiSnap].
 */
export async function ambilStatusTransaksi(
  orderId: string,
): Promise<MidtransStatus> {
  const respon = await fetch(
    `${apiUrl()}/v2/${encodeURIComponent(orderId)}/status`,
    {
      method: 'GET',
      headers: headerOtentikasi(),
      signal: AbortSignal.timeout(20000),
    },
  );

  const hasil = (await respon.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const statusTransaksi = String(hasil.transaction_status ?? '');

  if (!respon.ok && statusTransaksi === '') {
    const alasan =
      respon.status === 403
        ? 'Server key belum punya izin baca status transaksi (403). ' +
          'Buka dashboard Sandbox > Settings > Access Keys, lalu buat server ' +
          'key baru dengan izin "Core API: Read".'
        : pesanPenolakan(
            respon.status,
            hasil as {
              error_messages?: string[];
              status_message?: string;
            },
          );

    throw new AppError(
      `Gagal mengambil status pembayaran dari Midtrans: ${alasan}`,
      502,
    );
  }

  return {
    orderId: String(hasil.order_id ?? orderId),
    transactionStatus: statusTransaksi,
    fraudStatus: (hasil.fraud_status as string | undefined) ?? null,
    paymentType: (hasil.payment_type as string | undefined) ?? null,
    grossAmount: (hasil.gross_amount as string | undefined) ?? null,
    transactionId: (hasil.transaction_id as string | undefined) ?? null,
    raw: hasil,
  };
}
