/**
 * Konfigurasi untuk popup processing
 */
export interface ProcessingPopupConfig {
  title?: string;
  message?: string;
  duration?: number; // Durasi tampilan popup dalam milidetik
}

// Variabel global untuk popup dan timer
let processingPopup: HTMLElement | null = null;
let popupTimer: number | null = null;

/**
 * Menambahkan style untuk animasi
 */
function injectAnimationStyles(): void {
  // Periksa apakah style sudah ada
  if (document.getElementById('digital-panel-animation-styles')) return;

  const animationStyle = document.createElement('style');
  animationStyle.id = 'digital-panel-animation-styles';
  animationStyle.textContent = `
    @keyframes progress {
      0% { width: 0%; margin-left: 0; }
      50% { width: 30%; margin-left: 70%; }
      100% { width: 0%; margin-left: 100%; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -60%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.8); opacity: 0.5; }
    }
    .digital-panel-btn.clicked {
      transform: scale(0.95);
      transition: transform 0.1s ease-in-out;
    }
    .digital-panel-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 4px;
      color: white;
      z-index: 9999;
    }
    .digital-panel-notification.info { background: #3498db; }
    .digital-panel-notification.success { background: #2ecc71; }
    .digital-panel-notification.error { background: #e74c3c; }
  `;
  document.head.appendChild(animationStyle);
}

/**
 * Menampilkan popup processing
 * @param config Konfigurasi popup
 * @returns Elemen popup yang dibuat
 */
export function showProcessingPopup(config: ProcessingPopupConfig = {}): HTMLElement {
  const {
    title = 'File anda sedang kami proses',
    message = 'Mohon tunggu sebentar, file anda sedang diproses.<br>Happy working! 😊',
    duration = 2000 // Default 2 detik
  } = config;

  // Hapus popup lama dan timer jika ada
  if (processingPopup) {
    processingPopup.remove();
    processingPopup = null;
  }
  
  if (popupTimer !== null) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }

  // Tambahkan style untuk animasi
  injectAnimationStyles();

  // Buat popup baru
  processingPopup = document.createElement('div');
  processingPopup.id = 'digital-panel-processing-popup';
  processingPopup.style.cssText = `
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
  `;
  
  // Isi popup dengan konten
  processingPopup.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #2563EB; font-family: 'Segoe UI', Arial, sans-serif;">${title}</h2>
      
      <!-- Loader animasi CSS yang lebih menarik -->
      <div style="width: 100px; height: 100px; margin: 20px auto; position: relative;">
        <div style="position: absolute; width: 80px; height: 80px; border: 8px solid #f3f3f3; border-radius: 50%; border-top: 8px solid #2563EB; animation: spin 1.2s linear infinite; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background-color: #3B82F6; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);"></div>
      </div>
      
      <div style="width: 100%; height: 6px; background: #f0f0f0; margin: 20px 0; border-radius: 3px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
        <div style="width: 30%; height: 100%; background: linear-gradient(to right, #2563EB, #3B82F6); animation: progress 2s infinite linear; border-radius: 3px;"></div>
      </div>
      <p style="font-size: 16px; color: #4B5563; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 15px; line-height: 1.5;">${message}</p>
    </div>
  `;
  
  // Tambahkan popup ke DOM
  document.body.appendChild(processingPopup);
  
  // Set timer untuk memastikan popup ditampilkan minimal selama durasi yang ditentukan
  popupTimer = window.setTimeout(() => {
    popupTimer = null;
  }, duration);
  
  return processingPopup;
}

/**
 * Mendapatkan popup yang sedang aktif
 * @returns Elemen popup yang sedang aktif atau null jika tidak ada
 */
export function getActivePopup(): HTMLElement | null {
  return processingPopup;
}

/**
 * Menghapus popup yang sedang aktif
 * @param force Jika true, popup akan dihapus segera tanpa memperhatikan durasi minimum
 */
export function removeActivePopup(force: boolean = false): void {
  // Jika ada timer yang berjalan dan tidak dipaksa, tunggu sampai timer selesai
  if (popupTimer !== null && !force) {
    // Tunggu sampai timer selesai baru hapus popup
    const currentPopup = processingPopup;
    const removeAfterTimer = () => {
      if (processingPopup === currentPopup && processingPopup) {
        processingPopup.remove();
        processingPopup = null;
      }
    };
    
    window.setTimeout(removeAfterTimer, 0);
    return;
  }
  
  // Jika dipaksa atau tidak ada timer, hapus segera
  if (popupTimer !== null) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }
  
  if (processingPopup) {
    processingPopup.remove();
    processingPopup = null;
  }
}
