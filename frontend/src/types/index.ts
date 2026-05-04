export interface Room {
  room_id: string;
  name: string;
  capacity: number;
  building_name: string;
  floor_name: string;
}

export interface Birthday {
  id: string;
  name: string;
  receiveId: string;
  receiveIdType: string;
  month: number;
  day: number;
  message?: string;
}

export interface SyncResult {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ event: string; error: string }>;
}
