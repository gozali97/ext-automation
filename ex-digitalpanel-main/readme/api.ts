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
}

export const apiService = new ApiService(); 