import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { StorageLocation } from '../types';

export default function StoragePage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);

  useEffect(() => {
    apiFetch<StorageLocation[]>('/storage/overview').then((data) => {
      setLocations(
        data.map((item) => ({
          id: item.id,
          name: item.name,
          location_type: item.location_type,
          capacity: item.capacity,
          utilization: item.utilization,
          is_active: item.is_active,
        })),
      );
    }).catch(() => setLocations([]));
  }, []);

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="chip">Storage management</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Warehouse and shop locations</h3>
        </div>
        <div className="text-sm text-slate-400">Utilization and inventory counts are tracked per location</div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => (
          <div key={location.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h4 className="text-lg font-semibold text-white">{location.name}</h4>
            <p className="mt-2 text-sm text-slate-400">{location.location_type}</p>
            <div className="mt-4 text-sm text-slate-300">
              <div>Capacity: {location.capacity}</div>
              <div>Utilization: {location.utilization}</div>
              <div>Status: {location.is_active ? 'Active' : 'Inactive'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
