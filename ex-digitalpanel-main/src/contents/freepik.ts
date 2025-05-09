import type { PlasmoCSConfig } from "plasmo"
import { createDigitalPanelButton } from "~components/onpage/DigitalPanelButton"
import { showProcessingPopup } from "~components/onpage/ProcessingPopup"
import { updatePopupSuccess } from "~components/onpage/SuccessPopup"
import { updatePopupError } from "~components/onpage/ErrorPopup"
import { debounce, handleDigitalPanelButtonClick } from "~components/onpage/DigitalPanelUtils"

export const config: PlasmoCSConfig = {
  matches: ["*://*.freepik.com/*"],
  all_frames: true
}

// Variabel global
let observers: { popup: MutationObserver | null } = { popup: null };
let intervals: { buttonCheck: number | null } = { buttonCheck: null };

// Fungsi untuk menambahkan tombol biru di tiga lokasi dalam modal
function enhanceModalButtons() {
  const modal = document.querySelector('._btqskg4, ._btqskg3, [class*="preview"]');
  if (!modal) return;

  // add class hidden to data-cy="credits-pop-button"
  const hiddenItemLimitAi = modal.querySelector('[data-cy="credits-pop-button"]') as HTMLElement;
  if (hiddenItemLimitAi) {
    hiddenItemLimitAi.classList.add('hidden');
  }

  // hide user div
  const userDiv = document.getElementById('user') as HTMLElement;
  if (userDiv) {
    userDiv.classList.add('hidden');
  }

  // Remove title from generate button
  const generateButton = modal.querySelector('[data-cy="generate-img-button"]') as HTMLElement;
  if (generateButton) {
    generateButton.removeAttribute('title');
  }

  console.log("hiddenItemLimitAi", hiddenItemLimitAi);

  // 1. Tombol di sebelah download-thumbnail
  const downloadThumbnailBtn = modal.querySelector('[data-cy="download-thumbnail"]') as HTMLElement;
  if (downloadThumbnailBtn && !downloadThumbnailBtn.dataset.enhanced) {
    const containerDiv = document.createElement('div');
    containerDiv.className = '$flex $gap-1 $rounded-md $bg-blueCampu';
    
    const digitalPanelBtn = createDigitalPanelButton(
      {
        className: '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn',
        style: {
          backgroundColor: '#336aea',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        },
        text: 'By Digitalpanel',
        iconPosition: 'left'
      },
      handleDigitalPanelButtonClick
    );
    
    containerDiv.appendChild(digitalPanelBtn);
    downloadThumbnailBtn.parentElement!.insertBefore(containerDiv, downloadThumbnailBtn.nextSibling);
    downloadThumbnailBtn.dataset.enhanced = 'true';
  }

  // 2. Tombol di sebelah Go Premium
  const goPremiumBtn = modal.querySelector('button[class*="$bg-yellowPremium"]') as HTMLElement;
  if (goPremiumBtn && !goPremiumBtn.dataset.digitalPanelEnhanced) {
    const containerDiv = document.createElement('div');
    containerDiv.className = '$flex $gap-1 $rounded-md $bg-blueCampu';
    
    const digitalPanelBtn = createDigitalPanelButton(
      {
        className: '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn',
        style: {
          backgroundColor: '#336aea',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        },
        text: 'By Digitalpanel',
        iconPosition: 'left'
      },
      handleDigitalPanelButtonClick
    );
    
    // Tambahkan ID setelah tombol dibuat
    digitalPanelBtn.id = 'digital-panel-extra-btn';
    
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
      
      const digitalPanelBtn = createDigitalPanelButton(
        {
          className: '$transition-colors $duration-[300ms] $no-underline $py-[10px] $sprinkles-text-base $font-semibold $bg-blueFreepik $text-white hover:$bg-blueScience $inline-flex $items-center $justify-center $gap-10 $cursor-pointer $text-base $leading-tight $text-center $px-30 $rounded-md $whitespace-nowrap digital-panel-btn',
          style: {
            backgroundColor: '#336aea',
            color: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          },
          text: 'By Digitalpanel',
          iconPosition: 'left'
        },
        handleDigitalPanelButtonClick
      );
      
      // Tambahkan ID setelah tombol dibuat
      digitalPanelBtn.id = `digital-panel-topbar-btn-${index}`;
      
      containerDiv.appendChild(digitalPanelBtn);
      const downloadContainer = downloadButton.parentElement as HTMLElement;
      downloadContainer.parentElement!.insertBefore(containerDiv, downloadContainer.nextSibling);
      downloadButton.dataset.digitalPanelEnhanced = 'true';
    }
  });
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

// Fungsi untuk menghapus title dari tombol generate
function removeGenerateButtonTitle() {
  const generateButton = document.querySelector('[data-cy="generate-img-button"]');
  if (generateButton) {
    generateButton.removeAttribute('title');
  }
}

// Fungsi untuk setup observer title remover
function setupTitleRemover() {
  // Run immediately
  removeGenerateButtonTitle();
  
  // Create observer to handle dynamically added buttons
  const observer = new MutationObserver(() => {
    removeGenerateButtonTitle();
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Tambahkan CSS untuk animasi dan popup
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .digital-panel-btn.clicked {
      transform: scale(0.95);
      transition: transform 0.1s ease-in-out;
    }
    .digital-panel-btn {
      background-color: #336aea !important;
    }
    .digital-panel-btn:hover {
      background-color: #2857d6 !important;
    }
    [data-cy="credits-pop-button"], #user {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    #mystic, button[id="mystic"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    #ideogram, button[id="ideogram"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    /* Hide the specific tooltip span with coins icon */
    .flex.items-center.justify-center.gap-1:has(svg use[xlink\\:href="#icon-coins"]),
    span:has(> svg use[xlink\\:href="#icon-coins"]),
    [data-cy="generate-img-button"] span.flex {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    
    /* Remove title but keep the button visible */
    [data-cy="generate-img-button"] {
      font-size: 14px !important;
    }
    
    /* Hide any tooltip-like elements */
    [data-cy="generate-img-button"]::before,
    [data-cy="generate-img-button"]::after {
      display: none !important;
      content: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Tambahkan fungsi untuk menyembunyikan tombol secara programatik
function hideSpecificButtons() {
  const buttonSelectors = [
    'button[data-v-0e1e3030]:has(svg use[href="#icon-reimagine"])',
    'button[data-v-0e1e3030]:has(svg use[href="#icon-brush"])',
    'button[data-v-0e1e3030]:has(svg use[href="#icon-mockup"])'
  ];

  // Cari dan sembunyikan tombol berdasarkan teks
  const buttonTexts = ['Reimagine', 'Sketch', 'Mockup'];
  
  function hideButtons() {
    // Sembunyikan berdasarkan selector
    buttonSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        (button as HTMLElement).style.display = 'none';
      });
    });

    // Sembunyikan berdasarkan teks
    document.querySelectorAll('button[data-v-0e1e3030]').forEach(button => {
      const text = button.textContent?.trim().toLowerCase();
      if (text && buttonTexts.some(t => text.includes(t.toLowerCase()))) {
        (button as HTMLElement).style.display = 'none';
      }
    });
  }

  // Observer untuk memantau perubahan DOM
  const observer = new MutationObserver(hideButtons);
  
  // Mulai observasi
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Jalankan sekali saat inisialisasi
  hideButtons();
}

// Fungsi untuk menghapus konten remaining images
function clearRemainingImagesText() {
  // Approach 1: Direct text replacement using innerHTML
  document.querySelectorAll('span').forEach(span => {
    // Check if the span contains the text "images remaining"
    if (span.innerHTML.includes('images remaining')) {
      // Replace the specific text pattern with empty string
      span.innerHTML = span.innerHTML.replace(/\d+,\d+ images remaining/g, '');
    }
  });

  // Approach 2: Target the entire span containing icon and text
  document.querySelectorAll('span').forEach(span => {
    if (span.querySelector('svg use[xlink\\:href="#icon-coins"]')) {
      // Get the span's direct text content after the SVG
      const spanText = span.innerHTML.split('</svg>')[1];
      if (spanText && spanText.includes('images remaining')) {
        // Replace only the text part after the SVG
        span.innerHTML = span.innerHTML.split('</svg>')[0] + '</svg>';
      }
    }
  });

  // Approach 3: Target direct text nodes with walk recursion
  function walkNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent && /\d+,\d+ images remaining/.test(node.textContent)) {
        node.textContent = node.textContent.replace(/\d+,\d+ images remaining/g, '');
      }
    } else {
      node.childNodes.forEach(walkNode);
    }
  }
  walkNode(document.body);

  // Hapus title attribute dari tombol generate
  const generateButton = document.querySelector('[data-cy="generate-img-button"]');
  if (generateButton) {
    generateButton.removeAttribute('title');
  }
}

// Fungsi untuk setup observer text clearer
function setupTextClearer() {
  // Run immediately
  clearRemainingImagesText();
  
  // Create observer to handle dynamically added content
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        clearRemainingImagesText();
      }
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Modifikasi fungsi initializeExtension
function initializeExtension() {
  if (intervals.buttonCheck) clearInterval(intervals.buttonCheck);

  injectStyles(); // Tambahkan CSS
  ensureButtonVisibility();
  hideSpecificButtons();
  setupTextClearer(); // Tambahkan setup text clearer
  trackVoiceGeneratorCharacterCount(); // Tambahkan tracking untuk AI Voice Generator

  intervals.buttonCheck = window.setInterval(() => {
    const modalExists = !!document.querySelector('._btqskg4, ._btqskg3, [class*="preview"]');
    if (modalExists) {
      enhanceModalButtons();
      clearRemainingImagesText(); // Tambahkan clear text di sini juga
    }
  }, 1000);
}

// Jalankan inisialisasi
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log("Digital Panel Freepik content script loaded");

// Fungsi untuk memeriksa dan menyembunyikan tombol generate
function checkAndHideGenerateButton() {
  chrome.storage.local.get(['prompt_balance'], (result) => {
    const promptBalance = result.prompt_balance;
    const generateButton = document.querySelector('[data-cy="generate-img-button"]') as HTMLButtonElement;
    
    if (generateButton) {
      if (!promptBalance || parseInt(promptBalance) < 160) {
        // Sembunyikan tombol
        generateButton.style.display = 'none';
      } else {
        // Tampilkan kembali tombol jika prompt balance mencukupi
        generateButton.style.display = '';
      }
    }
  });
}

// Fungsi untuk melacak character count di AI Voice Generator
function trackVoiceGeneratorCharacterCount() {
  // Cek apakah kita berada di halaman AI Voice Generator
  if (!window.location.href.includes('/audio/ai-voice-generator')) {
    return;
  }
  
  console.log('[Voice Generator] Starting character count tracking');
  
  // Fungsi untuk mendapatkan character count dari DOM
  function getCharacterCount() {
    const lengthElement = document.getElementById('current-length');
    if (lengthElement) {
      const count = parseInt(lengthElement.textContent || '0', 10);
      return count;
    }
    return 0;
  }
  
  // Fungsi untuk menyimpan character count ke storage
  function saveCharacterCount(count) {
    chrome.storage.local.set({ 'voice_generator_character_count': count }, () => {
      console.log('[Voice Generator] Saved character count to storage:', count);
    });
  }
  
  // Fungsi untuk update character count
  function updateCharacterCount() {
    const count = getCharacterCount();
    if (count > 0) {
      saveCharacterCount(count);
    }
  }
  
  // Setup observer untuk memantau perubahan pada elemen character count
  const observer = new MutationObserver(() => {
    updateCharacterCount();
  });
  
  // Fungsi untuk memulai observasi
  function startObserving() {
    // Cek apakah elemen sudah ada
    const lengthElement = document.getElementById('current-length');
    if (lengthElement) {
      // Simpan nilai awal
      const initialCount = getCharacterCount();
      if (initialCount > 0) {
        saveCharacterCount(initialCount);
      }
      
      // Mulai observasi pada parent element untuk menangkap perubahan
      const parentElement = lengthElement.parentElement;
      if (parentElement) {
        observer.observe(parentElement, {
          childList: true,
          subtree: true,
          characterData: true
        });
        console.log('[Voice Generator] Started observing character count element');
      }
    } else {
      // Jika elemen belum ada, coba lagi setelah beberapa waktu
      setTimeout(startObserving, 1000);
    }
  }
  
  // Mulai observasi
  startObserving();
  
  // Tambahkan listener untuk generate button
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // Cek apakah yang diklik adalah tombol generate atau parent-nya
    if (target.closest('button[data-cy="generate-voice-button"]')) {
      console.log('[Voice Generator] Generate button clicked');
      // Ambil character count terakhir
      const count = getCharacterCount();
      if (count > 0) {
        saveCharacterCount(count);
      }
    }
  }, true);
}

// Tambahkan observer untuk memantau perubahan DOM
function setupGenerateButtonObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Tambahkan delay kecil untuk memastikan DOM sudah diupdate
        setTimeout(() => {
          checkAndHideGenerateButton();
        }, 100);
      }
    }
  });

  // Mulai observasi dengan opsi yang lebih spesifik
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']  // Pantau perubahan style dan class
  });

  // Periksa saat pertama kali dan setelah beberapa saat
  checkAndHideGenerateButton();
  setTimeout(checkAndHideGenerateButton, 1000); // Check lagi setelah 1 detik
}

// Tambahkan listener untuk perubahan storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.prompt_balance) {
    console.log('Prompt balance changed:', changes.prompt_balance);
    // Tambahkan delay kecil untuk memastikan DOM sudah diupdate
    setTimeout(() => {
      checkAndHideGenerateButton();
    }, 100);
  }
});

// Jalankan saat DOM sudah siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupGenerateButtonObserver();
    // Check setelah semua resource dimuat
    window.addEventListener('load', checkAndHideGenerateButton);
  });
} else {
  setupGenerateButtonObserver();
  // Check setelah semua resource dimuat
  window.addEventListener('load', checkAndHideGenerateButton);
}
