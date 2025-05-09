// Content script untuk website freepik.com
// Versi 2.16 - Hanya ambil URL, tanpa localStorage, dengan ikon baru, animasi, dan popup

export {}

// Variabel global
let observers: { popup: MutationObserver | null } = { popup: null };
let intervals: { buttonCheck: number | null } = { buttonCheck: null };

// Fungsi utilitas
const debounce = (func: Function, wait: number) => {
  let timeout: number | null = null;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
};

// Fungsi untuk menambahkan tombol biru di tiga lokasi dalam modal
function enhanceModalButtons() {
  const modal = document.querySelector('._btqskg4, ._btqskg3, [class*="preview"]');
  if (!modal) return;

  // 1. Tombol di sebelah download-thumbnail
  const downloadThumbnailBtn = modal.querySelector('[data-cy="download-thumbnail"]') as HTMLElement;
  if (downloadThumbnailBtn && !downloadThumbnailBtn.dataset.enhanced) {
    const containerDiv = document.createElement('div');
    containerDiv.className = '$flex $gap-1 $rounded-md $bg-blueCampu';
    
    const digitalPanelBtn = document.createElement('button');
    digitalPanelBtn.className = '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn';
    digitalPanelBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-49 141 512 512" width="16" height="16" aria-hidden="true" class="$w-[1em] $h-[1em] $fill-current $text-base $mr-0">
        <path d="M438 403c-13.808 0-25 11.193-25 25v134c0 19.299-15.701 35-35 35H36c-19.299 0-35-15.701-35-35V428c0-13.807-11.193-25-25-25s-25 11.193-25 25v134c0 46.869 38.131 85 85 85h342c46.869 0 85-38.131 85-85V428c0-13.807-11.192-25-25-25"></path>
        <path d="M189.322 530.678a25.004 25.004 0 0 0 35.356 0l84.853-84.853c9.763-9.763 9.763-25.592 0-35.355s-25.592-9.763-35.355 0L232 452.645V172c0-13.807-11.193-25-25-25s-25 11.193-25 25v280.645l-42.175-42.175c-9.764-9.763-25.592-9.763-35.355 0s-9.763 25.592 0 35.355z"></path>
      </svg>
      By Digitalpanel
    `;
    digitalPanelBtn.addEventListener('click', handleDownloadClick);
    
    containerDiv.appendChild(digitalPanelBtn);
    downloadThumbnailBtn.parentElement!.insertBefore(containerDiv, downloadThumbnailBtn.nextSibling);
    downloadThumbnailBtn.dataset.enhanced = 'true';
  }

  // 2. Tombol di sebelah Go Premium
  const goPremiumBtn = modal.querySelector('button[class*="$bg-yellowPremium"]') as HTMLElement;
  if (goPremiumBtn && !goPremiumBtn.dataset.digitalPanelEnhanced) {
    const containerDiv = document.createElement('div');
    containerDiv.className = '$flex $gap-1 $rounded-md $bg-blueCampu';
    
    const digitalPanelBtn = document.createElement('button');
    digitalPanelBtn.id = 'digital-panel-extra-btn';
    digitalPanelBtn.className = '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn';
    digitalPanelBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-49 141 512 512" width="16" height="16" aria-hidden="true" class="$w-[1em] $h-[1em] $fill-current $text-base $mr-0">
        <path d="M438 403c-13.808 0-25 11.193-25 25v134c0 19.299-15.701 35-35 35H36c-19.299 0-35-15.701-35-35V428c0-13.807-11.193-25-25-25s-25 11.193-25 25v134c0 46.869 38.131 85 85 85h342c46.869 0 85-38.131 85-85V428c0-13.807-11.192-25-25-25"></path>
        <path d="M189.322 530.678a25.004 25.004 0 0 0 35.356 0l84.853-84.853c9.763-9.763 9.763-25.592 0-35.355s-25.592-9.763-35.355 0L232 452.645V172c0-13.807-11.193-25-25-25s-25 11.193-25 25v280.645l-42.175-42.175c-9.764-9.763-25.592-9.763-35.355 0s-9.763 25.592 0 35.355z"></path>
      </svg>
      By Digitalpanel
    `;
    digitalPanelBtn.addEventListener('click', handleDownloadClick);
    
    containerDiv.appendChild(digitalPanelBtn);
    goPremiumBtn.parentElement!.insertBefore(containerDiv, goPremiumBtn.nextSibling);
    goPremiumBtn.dataset.digitalPanelEnhanced = 'true';
  }

  // 3. Tombol di topbar dalam modal di sebelah download-button
  const topbars = modal.querySelectorAll('div[class="$min-h-45 [grid-area:topbar]"]');
  topbars.forEach((topbar, index) => {
    const downloadButton = topbar.querySelector('[data-cy="download-button"]') as HTMLElement;
    if (downloadButton && !downloadButton.dataset.digitalPanelEnhanced) {
      const containerDiv = document.createElement('div');
      containerDiv.className = '$flex $gap-1 $rounded-md $bg-blueCampu';
      
      const digitalPanelBtn = document.createElement('button');
      digitalPanelBtn.id = `digital-panel-topbar-btn-${index}`;
      digitalPanelBtn.className = '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn';
      digitalPanelBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-49 141 512 512" width="16" height="16" aria-hidden="true" class="$w-[1em] $h-[1em] $fill-current $text-base $mr-0">
          <path d="M438 403c-13.808 0-25 11.193-25 25v134c0 19.299-15.701 35-35 35H36c-19.299 0-35-15.701-35-35V428c0-13.807-11.193-25-25-25s-25 11.193-25 25v134c0 46.869 38.131 85 85 85h342c46.869 0 85-38.131 85-85V428c0-13.807-11.192-25-25-25"></path>
          <path d="M189.322 530.678a25.004 25.004 0 0 0 35.356 0l84.853-84.853c9.763-9.763 9.763-25.592 0-35.355s-25.592-9.763-35.355 0L232 452.645V172c0-13.807-11.193-25-25-25s-25 11.193-25 25v280.645l-42.175-42.175c-9.764-9.763-25.592-9.763-35.355 0s-9.763 25.592 0 35.355z"></path>
        </svg>
        By Digitalpanel
      `;
      digitalPanelBtn.addEventListener('click', handleDownloadClick);
      
      containerDiv.appendChild(digitalPanelBtn);
      const downloadContainer = downloadButton.parentElement as HTMLElement;
      downloadContainer.parentElement!.insertBefore(containerDiv, downloadContainer.nextSibling);
      downloadButton.dataset.digitalPanelEnhanced = 'true';
    }
  });
}

// Fungsi untuk menampilkan popup
function showProcessingPopup() {
  let popup = document.getElementById('digital-panel-processing-popup');
  if (popup) popup.remove();

  // Tambahkan style untuk animasi
  const animationStyle = document.createElement('style');
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
  `;
  document.head.appendChild(animationStyle);

  popup = document.createElement('div');
  popup.id = 'digital-panel-processing-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    text-align: center;
    min-width: 320px;
    font-family: 'Segoe UI', Arial, sans-serif;
    border: 1px solid #e5e7eb;
    animation: fadeIn 0.3s ease-out;
  `;
  
  popup.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center;">
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #2563EB; font-family: 'Segoe UI', Arial, sans-serif;">File anda sedang kami proses</h2>
      
      <!-- Loader animasi CSS sebagai pengganti gambar -->
      <div style="width: 80px; height: 80px; margin: 20px auto; position: relative;">
        <div style="position: absolute; width: 64px; height: 64px; border: 8px solid #f3f3f3; border-radius: 50%; border-top: 8px solid #2563EB; animation: spin 1.5s linear infinite;"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background-color: #3B82F6; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite;"></div>
      </div>
      
      <div style="width: 100%; height: 4px; background: #f0f0f0; margin: 10px 0; border-radius: 2px; overflow: hidden;">
        <div style="width: 30%; height: 100%; background: linear-gradient(to right, #2563EB, #3B82F6); animation: progress 2s infinite linear;"></div>
      </div>
      <p style="font-size: 14px; color: #4B5563; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 10px;">Happy working! 😊</p>
    </div>
  `;
  
  document.body.appendChild(popup);

  setTimeout(() => {
    if (popup) {
      popup.style.opacity = '0';
      popup.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => popup.remove(), 300);
    }
  }, 5000); // Popup hilang setelah 5 detik
}

// Fungsi untuk memastikan tombol ditambahkan saat modal muncul
function ensureButtonVisibility() {
  if (observers.popup) observers.popup.disconnect();
  observers.popup = new MutationObserver(debounce(() => {
    const modalExists = document.querySelector('._btqskg4, ._btqskg3, [class*="preview"]');
    if (modalExists) {
      enhanceModalButtons();
    }
  }, 200));

  observers.popup.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
}

// Fungsi untuk mengirim data ke Digital Panel
function sendDataToDigitalPanel() {
  showNotification('Mengirim data...', 'info');

  const payload = { 
    page_url: window.location.href
  };

  console.log('Mengirim data ke Digital Panel:', payload);

  chrome.runtime.sendMessage({ 
    action: 'sendDataToDigitalPanel',
    payload 
  }, (response) => {
    console.log('Response dari Digital Panel:', response);
    
    if (!response) {
      showNotification('Gagal mengirim: Tidak ada respon dari extension', 'error');
      return;
    }

    showNotification(
      response.success 
        ? 'Data berhasil dikirim!' 
        : `Gagal mengirim: ${response.error || 'Unknown error'}`,
      response.success ? 'success' : 'error'
    );
  });
}

// Fungsi untuk menangani klik tombol download
function handleDownloadClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();

  console.log('Download button clicked');

  // Tambahkan animasi klik
  const button = (e.target as HTMLElement).closest('.digital-panel-btn');
  if (button) {
    button.classList.add('clicked');
    setTimeout(() => button.classList.remove('clicked'), 300);
  }

  showProcessingPopup(); // Tampilkan popup
  sendDataToDigitalPanel();
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
  let notification = document.getElementById('digital-panel-notification');
  if (!notification) {
    notification = Object.assign(document.createElement('div'), {
      id: 'digital-panel-notification',
      className: 'digital-panel-notification'
    });
    document.body.appendChild(notification);
  }

  Object.assign(notification, {
    className: `digital-panel-notification ${type}`,
    textContent: message,
    style: { display: 'block' }
  });

  setTimeout(() => notification.style.display = 'none', 3000);
}

// Tambahkan CSS untuk animasi dan popup
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
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
  document.head.appendChild(style);
}

// Inisialisasi ekstensi
function initializeExtension() {
  if (intervals.buttonCheck) clearInterval(intervals.buttonCheck);

  injectStyles(); // Tambahkan CSS
  ensureButtonVisibility();

  intervals.buttonCheck = window.setInterval(() => {
    const modalExists = !!document.querySelector('._btqskg4, ._btqskg3, [class*="preview"]');
    if (modalExists) {
      enhanceModalButtons();
    }
  }, 1000);

  // Hapus event listener lama dan tambahkan yang baru
  document.removeEventListener('click', handleDownloadClick, true);
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const isDigitalPanelBtn = target.closest('.digital-panel-btn');
    const isDownloadBtn = target.closest('[data-cy="download-thumbnail"], [data-cy="download-button"]');
    
    if (isDigitalPanelBtn || isDownloadBtn) {
      console.log('Click detected on:', isDigitalPanelBtn ? 'Digital Panel button' : 'Download button');
      handleDownloadClick(e);
    }
  }, true);
}

// Jalankan inisialisasi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 