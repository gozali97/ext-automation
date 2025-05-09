import { getActivePopup } from './ProcessingPopup';

/**
 * Konfigurasi untuk popup error
 */
export interface ErrorPopupConfig {
  title?: string;
  closeButtonText?: string;
  autoCloseDelay?: number;
}

/**
 * Mengubah popup menjadi error
 * @param message Pesan error
 * @param config Konfigurasi popup
 */
export function updatePopupError(message: string, config: ErrorPopupConfig = {}): void {
  const popup = getActivePopup();
  if (!popup) return;
  
  const {
    title = 'Gagal!',
    closeButtonText = 'Tutup',
    autoCloseDelay = 5000
  } = config;
  
  // Ubah konten popup menjadi error
  popup.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #EF4444; font-family: 'Segoe UI', Arial, sans-serif;">${title}</h2>
      
      <!-- Icon error -->
      <div style="width: 100px; height: 100px; margin: 15px auto; position: relative; background-color: #EF4444; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
      
      <p style="font-size: 18px; color: #4B5563; font-family: 'Segoe UI', Arial, sans-serif; margin: 20px 0; line-height: 1.5;">${message}</p>
      <button id="digital-panel-close-popup" style="margin-top: 10px; padding: 12px 24px; background-color: #EF4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.2s ease; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.3);">${closeButtonText}</button>
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
      (closeButton as HTMLElement).style.backgroundColor = '#DC2626';
      (closeButton as HTMLElement).style.transform = 'translateY(-2px)';
      (closeButton as HTMLElement).style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.4)';
    });
    
    closeButton.addEventListener('mouseout', () => {
      (closeButton as HTMLElement).style.backgroundColor = '#EF4444';
      (closeButton as HTMLElement).style.transform = 'translateY(0)';
      (closeButton as HTMLElement).style.boxShadow = '0 2px 5px rgba(239, 68, 68, 0.3)';
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
