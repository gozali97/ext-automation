import React, { useEffect, useState } from "react";

// Tipe data untuk redeem
export interface Redeem {
  prompt_balance: string;
  prompt_credit: string;
  quota: number;
  variant: {
    name: string;
  };
}

// Tipe data untuk layanan aktif
export interface ActiveService {
  id: number;
  service_id: number;
  name: string;
  slug: string;
  service_type_id: number;
  variant_name: string;
  active_until: string;
  active_due: number;
  active_due_str: string;
  active_period?: number; // Periode aktif dalam hari
  limit: number;
  quota: number;
  today_download: number;
  total_download: number;
  total_download_limit: string;
  total_download_quota: string;
  redeems?: Redeem[]; // Tambahkan properti redeems
}

interface ActiveServicesProps {
  services: ActiveService[];
  onUpdate?: () => void;
}

const ActiveServices: React.FC<ActiveServicesProps> = ({ services: initialServices, onUpdate }) => {
  const [services, setServices] = useState<ActiveService[]>(initialServices);
  const [openServiceId, setOpenServiceId] = useState<number | null>(null);

  useEffect(() => {
    setServices(initialServices);
    // Set service dengan service_id = 1 sebagai default yang terbuka
    const freepikService = initialServices.find(service => service.service_id === 1);
    if (freepikService) {
      setOpenServiceId(freepikService.id);
    }
  }, [initialServices]);

  useEffect(() => {
    // Listener untuk pesan dari background script
    const messageListener = (message: any) => {
      if (message.action === "updateActiveServices") {
        if (message.services) {
          // Update services dengan data baru
          setServices(message.services);
        } else if (onUpdate) {
          // Jika tidak ada data services, panggil onUpdate
          onUpdate();
        }
      }
    };

    // Daftarkan listener
    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener saat komponen unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [onUpdate]);

  // Format tanggal menjadi format yang lebih mudah dibaca
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  // Mengelompokkan services berdasarkan service ID
  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.id]) {
      acc[service.id] = [];
    }
    acc[service.id].push(service);
    return acc;
  }, {} as Record<number, ActiveService[]>);

  // Mengurutkan services agar Freepik (service_id = 1) selalu di atas
  const sortedServiceIds = Object.entries(groupedServices).sort(([, a], [, b]) => {
    return a[0].service_id === 1 ? -1 : b[0].service_id === 1 ? 1 : 0;
  });

  // Toggle dropdown
  const toggleService = (serviceId: number) => {
    setOpenServiceId(openServiceId === serviceId ? null : serviceId);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {sortedServiceIds.map(([serviceId, serviceGroup]) => (
        <div key={serviceId} className="flex flex-col gap-4">
          <div 
            className="flex items-center justify-between cursor-pointer select-none p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => toggleService(parseInt(serviceId))}
          >
            <h2 className="text-lg font-bold text-gray-900">
              {serviceGroup[0].name}
            </h2>
            <div className={`transform transition-transform duration-200 ${openServiceId === parseInt(serviceId) ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </div>
          
          {openServiceId === parseInt(serviceId) && serviceGroup.map((service, index) => (
            <div 
              key={`${service.id}-${index}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
            >
              <p className="text-sm font-semibold text-gray-800 mb-2">
                {service.variant_name}
              </p>
              
              <div className="text-sm mb-3 flex justify-between">
                <span>Layanan Aktif Hingga</span>
                <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded ml-2">
                  {formatDate(service.active_until)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-emerald-50 rounded-lg p-2 flex flex-col items-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {service.limit}
                  </div>
                  <div className="text-xs text-emerald-600">
                    {service.service_type_id === 5 ? "AI Limit" : "Limit"}
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-2 flex flex-col items-center">
                  <div className="text-xl font-bold text-blue-700">
                    {service.quota}
                  </div>
                  <div className="text-xs text-blue-600">
                    {service.service_type_id === 5 ? "AI Balance" : "Quota"}
                  </div>
                </div>
                
                <div className="bg-yellow-100 rounded-lg p-2 flex flex-col items-center col-span-2">
                  <div className="text-xl font-bold text-yellow-800">
                    {service.service_type_id === 5 ? service.total_download_quota : service.total_download_limit}
                  </div>
                  <div className="text-xs text-yellow-700">
                    {service.service_type_id === 5 ? "AI Usage" : "Limit Usage"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ActiveServices;
