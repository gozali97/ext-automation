import type { PlasmoCSConfig } from "plasmo"
import { createDigitalPanelButton } from "~components/onpage/DigitalPanelButton"
import { showProcessingPopup } from "~components/onpage/ProcessingPopup"
import { updatePopupSuccess } from "~components/onpage/SuccessPopup"
import { updatePopupError } from "~components/onpage/ErrorPopup"
import { debounce, handleDigitalPanelButtonClick } from "~components/onpage/DigitalPanelUtils"

export const config: PlasmoCSConfig = {
  matches: ["*://*.elements.envato.com/*"],
  all_frames: true
}

// Variabel global
let observers: { popup: MutationObserver | null } = { popup: null };
let intervals: { buttonCheck: number | null } = { buttonCheck: null };

// Fungsi untuk menambahkan tombol biru di bawah tombol "Subscribe to download"
function enhanceSubscribeButton() {
  const subscribeButtons = document.querySelectorAll('a.nr9DhCl_[data-testid="subscribe-cta-button"]');
  
  subscribeButtons.forEach((subscribeBtn) => {
    if (subscribeBtn && !(subscribeBtn as HTMLElement).dataset.enhanced) {
      const parentElement = subscribeBtn.parentElement;
      if (!parentElement) return;
      
      // Dapatkan lebar tombol subscribe untuk membuat tombol Digital Panel sama lebarnya
      const subscribeWidth = subscribeBtn.getBoundingClientRect().width;
      
      // Buat tombol Digital Panel dengan komponen
      const digitalPanelBtn = createDigitalPanelButton(
        {
          className: 'nr9DhCl_ McVQtipP vGSJYVYs Mvefxhtu',
          style: {
            marginTop: '10px',
            backgroundColor: '#336aea', // Warna biru yang diminta
            width: `${subscribeWidth}px`, // Lebar yang sama dengan tombol subscribe
            color: 'white', // Pastikan teks berwarna putih
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          },
          text: 'By Digitalpanel',
          iconPosition: 'left'
        },
        handleDigitalPanelButtonClick
      );
      
      // Tambahkan tombol ke dalam parent element
      parentElement.appendChild(digitalPanelBtn);
      
      // Tandai tombol subscribe asli sebagai sudah ditingkatkan
      (subscribeBtn as HTMLElement).dataset.enhanced = 'true';
    }
  });
}

// Fungsi untuk memastikan tombol ditambahkan saat elemen muncul
function ensureButtonVisibility() {
  if (observers.popup) observers.popup.disconnect();
  observers.popup = new MutationObserver(debounce(() => {
    const subscriptionElements = document.querySelectorAll('.ES35fwD6.XOPcX5VD');
    if (subscriptionElements.length > 0) {
      enhanceSubscribeButton();
    }
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
    const subscriptionElements = document.querySelectorAll('.ES35fwD6.XOPcX5VD');
    if (subscriptionElements.length > 0) {
      enhanceSubscribeButton();
    }
  }, 1000);
}

// Jalankan inisialisasi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log("Digital Panel Envato Elements content script loaded");
  const style = document.createElement('style');
