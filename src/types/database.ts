import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Interface minimal untuk Database yang bisa menjalankan query.
 *
 * Dipakai agar service bisa dijalankan memakai `pool` (query biasa) maupun
 * `client` dari transaksi tanpa menulis tipe yang berbeda dua kali.
 */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}
