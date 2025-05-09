// API service for Digital Panel
import type { ActiveService } from "../components/ActiveServices";

const API_BASE_URL = 'https://api.digitalpanel.id';

type ApiHeaders = Record<string, string>;

class ApiService {
  private getHeaders(token: string): ApiHeaders {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Origin': 'https://app.digitalpanel.id',
      'x-host-origin': 'https://app.digitalpanel.id'
    };
  }

  public async fetchUserProfile(token: string): Promise<any> {
    try {
      console.log('Fetching user profile...');
      const response = await fetch(`${API_BASE_URL}/api/v2/profile`, {
        method: 'GET',
        headers: this.getHeaders(token)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('User profile fetched:', {
        id: data.data.id,
        name: data.data.name,
        email: data.data.email
      });
      return data.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  public async sendDownloadRequest(token: string, pageUrl: string): Promise<any> {
    try {
      console.log('Sending download request:', {
        url: `${API_BASE_URL}/api/v2/downloads`,
        pageUrl
      });

      const response = await fetch(`${API_BASE_URL}/api/v2/downloads`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          page_url: pageUrl,
          source: 'extension'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Download request response:', data);
      return data;
    } catch (error) {
      console.error('Error sending download request:', error);
      throw error;
    }
  }

  public async fetchActiveServices(token: string): Promise<ActiveService[]> {
    try {
      console.log('Fetching active services...');
      const response = await fetch(`${API_BASE_URL}/api/v2/services/active`, {
        method: 'GET',
        headers: this.getHeaders(token)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Active services fetched:', data.data.length);
      
      // Array untuk menyimpan semua active services
      let allActiveServices: ActiveService[] = [];
      
      // Transform API response to ActiveService format
      data.data.forEach((service: any) => {
        if (service.active_services && service.active_services.length > 0) {
          // Loop through all active services
          service.active_services.forEach((activeService: any) => {
            if (activeService.redeems && activeService.redeems.length > 0) {
              const redeem = activeService.redeems[0];
              const serviceTypeId = activeService.service_type_id;

              const promptBalance = parseInt(activeService.redeems[0].prompt_balance) || 0;
              const promptCredit = parseInt(activeService.redeems[0].prompt_credit) || 0;
              
              // Transform data sesuai dengan service type
              const transformedService: ActiveService = {
                id: service.id,
                service_id: service.service_id,
                service_type_id: serviceTypeId,
                name: service.name,
                slug: service.slug,
                variant_name: redeem.variant.name,
                active_until: activeService.active_until,
                active_due: activeService.active_due,
                active_due_str: activeService.active_due_str,
                limit: serviceTypeId === 5 ? redeem.quota : activeService.limit,
                quota: serviceTypeId === 5 ? promptBalance : activeService.quota,
                today_download: activeService.today_download || 0,
                total_download: activeService.total_download || 0,
                total_download_limit: serviceTypeId === 5 ? 
                  redeem.total_download_limit : 
                  activeService.total_download_limit || `0/${activeService.limit}`,
                total_download_quota: serviceTypeId === 5 ? 
                  `${promptCredit}/${redeem.quota}` : 
                  activeService.total_download_quota || `0/${activeService.quota}`,
                redeems: activeService.redeems
              };
              
              allActiveServices.push(transformedService);
            }
          });
        } else {
          // Handle services without active_services array
          const transformedService: ActiveService = {
            id: service.id,
            service_id: service.service_id,
            service_type_id: service.variant?.service_type_id || 0,
            name: service.name,
            slug: service.slug,
            variant_name: service.variant?.name || "",
            active_until: service.active_until,
            active_due: service.active_due,
            active_due_str: service.active_due_str,
            limit: service.limit,
            quota: service.quota,
            today_download: service.today_download || 0,
            total_download: service.total_download || 0,
            total_download_limit: service.total_download_limit || `0/${service.limit}`,
            total_download_quota: service.total_download_quota || `0/${service.quota}`
          };
          
          allActiveServices.push(transformedService);
        }
      });

      return allActiveServices;
    } catch (error) {
      console.error('Error fetching active services:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();