import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import jwt from 'jsonwebtoken';

/**
 * Test HTTP hardening tanpa menyentuh database:
 * - token tanpa `ver` / algoritma salah ditolak 401
 * - rate limiter tidak 500 saat X-Forwarded-For ada dan TRUST_PROXY diatur
 * - origin CORS di luar allowlist tidak mendapat header izin
 * - payload SQL injection ditolak oleh validasi (400)
 *
 * Environment di-set SEBELUM modul aplikasi di-import agar `env` membaca
 * nilai uji ini. `dotenv` tidak menimpa environment yang sudah ada.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-minimal-32-karakter-untuk-pengujian';
process.env.CORS_ORIGINS = 'https://allowed.example.com';
process.env.TRUST_PROXY = '1';
// Test tidak menyentuh database; matikan SSL agar tidak memicu peringatan CA.
process.env.DB_SSL = 'false';

const { default: app } = await import('../../src/app.js');
const { getJwtSecret } = await import('../../src/config/env.js');
const { closeDatabasePool } = await import('../../src/config/database.js');

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await closeDatabasePool();
});

describe('autentikasi HTTP', () => {
  it('menolak request tanpa token dengan 401', async () => {
    const response = await fetch(`${baseUrl}/api/users/me`);

    assert.equal(response.status, 401);
  });

  it('menolak token lama tanpa klaim ver dengan 401', async () => {
    const token = jwt.sign(
      { sub: '1', email: 'lama@spoth.test', role: 'TENANT' },
      getJwtSecret(),
    );

    const response = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 401);
  });

  it('menolak token dengan algoritma none dengan 401', async () => {
    const encode = (value: object): string =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: '1',
      ver: 0,
    })}.`;

    const response = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 401);
  });
});

describe('rate limiter di belakang proxy', () => {
  it('tidak menghasilkan 500 saat X-Forwarded-For dikirim', async () => {
    const response = await fetch(`${baseUrl}/api/endpoint-tidak-ada`, {
      headers: { 'X-Forwarded-For': '203.0.113.10' },
    });

    // 404 dari notFoundHandler, bukan 500 dari error validasi rate limiter.
    assert.equal(response.status, 404);
  });
});

describe('CORS allowlist', () => {
  it('mengizinkan origin yang ada di allowlist', async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { Origin: 'https://allowed.example.com' },
    });

    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://allowed.example.com',
    );
  });

  it('tidak memberi header izin untuk origin di luar allowlist', async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { Origin: 'https://evil.example.com' },
    });

    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

describe('validasi payload HTTP', () => {
  it('login dengan SQL injection di email ditolak 400', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "' OR 1=1--", password: 'password123' }),
    });

    assert.equal(response.status, 400);
  });

  it('sort pencarian di luar whitelist ditolak 400', async () => {
    const response = await fetch(
      `${baseUrl}/api/places?sort=${encodeURIComponent('harga_asc; DROP TABLE users--')}`,
    );

    assert.equal(response.status, 400);
  });

  it('id tempat berisi ekspresi SQL ditolak 400', async () => {
    const response = await fetch(`${baseUrl}/api/places/${encodeURIComponent('1 OR 1=1')}`);

    assert.equal(response.status, 400);
  });
});
