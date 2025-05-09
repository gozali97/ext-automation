/**
 * Konfigurasi untuk popup langganan
 */
export interface SubscriptionPopupConfig {
  title?: string;
  message?: string;
  closeButtonText?: string;
  contactButtonText?: string;
  contactUrl?: string;
}

// Variabel global untuk popup
let subscriptionPopup: HTMLElement | null = null;

/**
 * Menampilkan popup langganan
 * @param config Konfigurasi popup
 * @returns Elemen popup yang dibuat
 */
export function showSubscriptionPopup(config: SubscriptionPopupConfig = {}): HTMLElement {
  const {
    title = 'Anda memerlukan langganan AI Point',
    message = 'Untuk menikmati fitur AI yang luar biasa, Anda perlu berlangganan AI Point pada Digital Panel. Dapatkan akses penuh dan jelajahi potensi tak terbatas bersama kami!',
    closeButtonText = 'Tutup',
    contactButtonText = 'Hubungi Kami',
    contactUrl = 'https://wa.link/5n2ebp'
  } = config;

  // Hapus popup lama jika ada
  if (subscriptionPopup) {
    subscriptionPopup.remove();
    subscriptionPopup = null;
  }

  // Tambahkan style untuk animasi
  if (!document.getElementById('digital-panel-subscription-styles')) {
    const style = document.createElement('style');
    style.id = 'digital-panel-subscription-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -60%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
      }
      .digital-panel-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        animation: fadeIn 0.3s ease-out;
      }
      .digital-panel-subscription-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        text-align: center;
        min-width: 350px;
        font-family: 'Segoe UI', Arial, sans-serif;
        border: 1px solid #e5e7eb;
        animation: fadeIn 0.3s ease-out;
      }
      .digital-panel-button {
        margin-top: 10px;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .digital-panel-primary-button {
        background-color: #4F46E5;
        color: white;
        box-shadow: 0 2px 5px rgba(79, 70, 229, 0.3);
      }
      .digital-panel-primary-button:hover {
        background-color: #4338CA;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(79, 70, 229, 0.4);
      }
      .digital-panel-secondary-button {
        background-color: #F3F4F6;
        color: #111827;
        border: 1px solid #D1D5DB;
        margin-right: 10px;
      }
      .digital-panel-secondary-button:hover {
        background-color: #E5E7EB;
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }

  // Buat overlay
  const overlay = document.createElement('div');
  overlay.className = 'digital-panel-overlay';
  document.body.appendChild(overlay);

  // Buat popup
  subscriptionPopup = document.createElement('div');
  subscriptionPopup.className = 'digital-panel-subscription-popup';
  
  // Isi popup dengan konten
  subscriptionPopup.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #4F46E5; font-family: 'Segoe UI', Arial, sans-serif;">${title}</h2>
      
      <!-- Icon warning -->
      <div style="width: 100px; height: 100px; margin: 15px auto; position: relative; background-color: #FEF3C7; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      
      <p style="font-size: 18px; color: #4B5563; font-family: 'Segoe UI', Arial, sans-serif; margin: 20px 0; line-height: 1.5;">${message}</p>
      
      <div style="display: flex; justify-content: center; margin-top: 20px;">
        <button id="digital-panel-close-popup" class="digital-panel-button digital-panel-secondary-button">${closeButtonText}</button>
        <a id="digital-panel-contact-button" href="${contactUrl}" target="_blank" class="digital-panel-button digital-panel-primary-button" style="text-decoration: none;">${contactButtonText}</a>
      </div>
    </div>
  `;
  
  // Tambahkan popup ke DOM
  document.body.appendChild(subscriptionPopup);
  
  // Tambahkan event listener untuk tombol tutup
  const closeButton = subscriptionPopup.querySelector('#digital-panel-close-popup');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      if (subscriptionPopup) {
        subscriptionPopup.style.opacity = '0';
        subscriptionPopup.style.transition = 'opacity 0.3s ease-out';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (subscriptionPopup) {
            subscriptionPopup.remove();
            subscriptionPopup = null;
          }
          overlay.remove();
        }, 300);
      }
    });
  }
  
  return subscriptionPopup;
}

/**
 * Menghapus popup langganan
 */
export function removeSubscriptionPopup(): void {
  if (subscriptionPopup) {
    subscriptionPopup.remove();
    subscriptionPopup = null;
  }
  
  const overlay = document.querySelector('.digital-panel-overlay');
  if (overlay) {
    overlay.remove();
  }
}
