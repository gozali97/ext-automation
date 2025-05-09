import { getActivePopup } from './ProcessingPopup';

/**
 * Konfigurasi untuk popup sukses
 */
export interface SuccessPopupConfig {
  title?: string;
  closeButtonText?: string;
  autoCloseDelay?: number;
}

/**
 * Mengubah popup menjadi sukses
 * @param message Pesan sukses
 * @param config Konfigurasi popup
 */
export function updatePopupSuccess(message: string, config: SuccessPopupConfig = {}): void {
  const popup = getActivePopup();
  if (!popup) return;
  
  const {
    title = 'Berhasil!',
    closeButtonText = 'Tutup',
    autoCloseDelay = 5000
  } = config;
  
  // Ubah konten popup menjadi sukses
  popup.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #10B981; font-family: 'Segoe UI', Arial, sans-serif;">${title}</h2>
      
      <!-- Icon sukses dengan animasi -->
      <div style="width: 100px; height: 100px; margin: 15px auto; position: relative; background-color: #10B981; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); animation: pulse 0.5s ease-in-out;">
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: fadeIn 0.5s ease-out;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      
      <p style="font-size: 18px; color: #4B5563; font-family: 'Segoe UI', Arial, sans-serif; margin: 20px 0; line-height: 1.5;">${message}</p>
      <button id="digital-panel-close-popup" style="margin-top: 10px; padding: 12px 24px; background-color: #10B981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.2s ease; box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3);">${closeButtonText}</button>
    </div>
  `;
  
  // Tambahkan event listener untuk tombol tutup
  const closeButton = popup.querySelector('#digital-panel-close-popup');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      if (popup) {
        popup.style.opacity = '0';
        popup.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (popup) {
            popup.remove();
          }
        }, 300);
      }
    });
    
    // Tambahkan efek hover
    closeButton.addEventListener('mouseover', () => {
      (closeButton as HTMLElement).style.backgroundColor = '#0E9F6E';
      (closeButton as HTMLElement).style.transform = 'translateY(-2px)';
      (closeButton as HTMLElement).style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)';
    });
    
    closeButton.addEventListener('mouseout', () => {
      (closeButton as HTMLElement).style.backgroundColor = '#10B981';
      (closeButton as HTMLElement).style.transform = 'translateY(0)';
      (closeButton as HTMLElement).style.boxShadow = '0 2px 5px rgba(16, 185, 129, 0.3)';
    });
  }
  
  // Hapus popup setelah beberapa detik jika tidak ditutup
  if (autoCloseDelay > 0) {
    setTimeout(() => {
      if (popup && popup.parentElement) {
        popup.style.opacity = '0';
        popup.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (popup && popup.parentElement) {
            popup.remove();
          }
        }, 300);
      }
    }, autoCloseDelay);
  }
}
