import type { PlasmoCSConfig } from "plasmo"
import { createDigitalPanelButton } from "~components/onpage/DigitalPanelButton"
import { showProcessingPopup } from "~components/onpage/ProcessingPopup"
import { updatePopupSuccess } from "~components/onpage/SuccessPopup"
import { updatePopupError } from "~components/onpage/ErrorPopup"
import { debounce, handleDigitalPanelButtonClick } from "~components/onpage/DigitalPanelUtils"

export const config: PlasmoCSConfig = {
  matches: ["*://*.motionarray.com/*"],
  all_frames: true
}

// Variabel global
let observers: { popup: MutationObserver | null } = { popup: null };
let intervals: { buttonCheck: number | null } = { buttonCheck: null };

// Fungsi untuk menambahkan tombol Digital Panel di bawah tombol Download
function enhanceDownloadButtons() {
  // Cari tombol download dengan class al-btn al-btn--primary
  const downloadContainers = document.querySelectorAll('.flex.items-center');
  
  downloadContainers.forEach((container) => {
    // Cek apakah container memiliki tombol download
    const downloadBtn = container.querySelector('.al-btn.al-btn--primary');
    
    // Pastikan tombol download ada dan belum ditambahkan tombol Digital Panel
    if (downloadBtn && 
        downloadBtn.textContent?.includes('Download') && 
        !container.closest('.mt-6')?.querySelector('.digital-panel-btn')) {
      
      // Cari parent container yang lebih tinggi (biasanya memiliki class mt-6)
      const parentContainer = container.closest('.mt-6');
      if (!parentContainer) return;
      
      // Buat wrapper div untuk tombol Digital Panel dengan style yang sama
      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'flex items-center mt-3'; // Tambahkan margin top
      
      // Buat tombol Digital Panel dengan komponen
      const digitalPanelBtn = createDigitalPanelButton(
        {
          className: 'al-btn al-btn--primary h-12 flex-1 cursor-pointer px-[25px] font-bold xl:flex-initial xl:px-[50px] digital-panel-btn',
          style: {
            backgroundColor: '#336aea', // Warna biru yang diminta
            color: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%' // Gunakan lebar penuh
          },
          text: 'By Digitalpanel',
          iconPosition: 'left'
        },
        handleDigitalPanelButtonClick
      );
      
      // Tambahkan tombol ke wrapper
      buttonWrapper.appendChild(digitalPanelBtn);
      
      // Tambahkan wrapper setelah container tombol download
      parentContainer.appendChild(buttonWrapper);
    }
  });
}

// Fungsi untuk memastikan tombol ditambahkan saat elemen muncul
function ensureButtonVisibility() {
  if (observers.popup) observers.popup.disconnect();
  observers.popup = new MutationObserver(debounce(() => {
    enhanceDownloadButtons();
  }, 200));

  observers.popup.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
}

// Inisialisasi ekstensi
function initializeExtension() {
  if (intervals.buttonCheck) clearInterval(intervals.buttonCheck);

  ensureButtonVisibility();

  intervals.buttonCheck = window.setInterval(() => {
    enhanceDownloadButtons();
  }, 1000);
}

// Jalankan inisialisasi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log("Digital Panel MotionArray content script loaded");
