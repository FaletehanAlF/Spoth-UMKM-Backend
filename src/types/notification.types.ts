export interface NotificationRow {
  id: string;
  user_id: string;
  judul: string;
  pesan: string;
  jenis: string | null;
  dibaca: boolean;
  created_at: Date;
  /** Data tambahan dalam bentuk JSON (mis. id pemesanan). */
  metadata: Record<string, unknown> | null;
}

export interface NotificationResponse {
  id: string;
  judul: string;
  pesan: string;
  jenis: string | null;
  dibaca: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface NotificationQuery {
  unread_only?: boolean;
  page: number;
  limit: number;
}

export interface NotificationSummary {
  total: number;
  belum_dibaca: number;
}

export interface BookingNotificationMetadata {
  booking_id: string;
  tipe: string;
}
