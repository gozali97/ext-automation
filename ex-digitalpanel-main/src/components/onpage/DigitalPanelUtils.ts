import { showProcessingPopup } from './ProcessingPopup';
import { updatePopupSuccess } from './SuccessPopup';
import { updatePopupError } from './ErrorPopup';
import { addButtonClickAnimation } from './DigitalPanelButton';

/**
 * Fungsi untuk mengirim data ke Digital Panel
 * @param payload Data yang akan dikirim
 * @param onSuccess Callback jika berhasil
 * @param onError Callback jika gagal
 */
export function sendDataToDigitalPanel(
  payload: any,
  onSuccess: (response: any) => void,
  onError: (error: string) => void
): void {
  console.log('Mengirim data ke Digital Panel:', payload);

  // Tambahkan timeout untuk permintaan API
  const timeoutId = setTimeout(() => {
    onError('Permintaan timeout, silakan coba lagi');
  }, 10000); // 10 detik timeout

  chrome.runtime.sendMessage({ 
    action: 'sendDataToDigitalPanel',
    payload 
  }, (response) => {
    // Hapus timeout karena respons sudah diterima
    clearTimeout(timeoutId);
    
    console.log('Response dari Digital Panel:', response);
    
    if (!response) {
      onError('Tidak ada respon dari extension');
      return;
    }

    if (response.success) {
      // Periksa apakah ada data dan download_file tidak null
      const data = response.data?.data;
      if (data && data.download_file && data.download_status_id == 4) {
        console.log('Download file tersedia dan status selesai, membuka tab baru untuk download:', data.download_file);
        
        // Delegasikan ke background script untuk memainkan suara dan membuka tab
        // Ini memastikan konsistensi dengan cara websocket menangani download
        chrome.runtime.sendMessage({
          action: 'processDownload',
          downloadData: data
        }, (downloadResponse) => {
          console.log('Download processed:', downloadResponse);
          
          // Update popup dengan pesan sukses
          updatePopupSuccess('File berhasil diunduh!', { autoCloseDelay: 3000 });
        });
      } else {
        console.log('Download file belum tersedia atau belum selesai, menunggu dari websocket');
        // Update popup dengan pesan sukses yang lebih informatif
        updatePopupSuccess('Permintaan diterima! File sedang diproses dan akan segera tersedia.', { 
          title: 'Sedang Diproses',
          autoCloseDelay: 3000
        });
      }
    } else {
      onError(response.error || 'Unknown error');
    }
  });
}

/**
 * Fungsi untuk menangani klik tombol Digital Panel
 * @param e Event mouse
 */
export function handleDigitalPanelButtonClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();

  console.log('Digital Panel button clicked');

  // Tambahkan animasi klik
  addButtonClickAnimation(e);

  // Tampilkan popup dengan durasi lebih pendek (1 detik)
  showProcessingPopup({ duration: 1000 });
  
  // Kirim data ke Digital Panel
  sendDataToDigitalPanel(
    { page_url: window.location.href },
    // Callback ini tidak akan dipanggil lagi karena kita sudah menangani pesan sukses langsung
    (response) => {
      console.log('Callback onSuccess dipanggil (tidak digunakan)');
    },
    // Callback error masih diperlukan untuk menampilkan pesan error
    (error) => updatePopupError(`Gagal mengirim: ${error}`, { autoCloseDelay: 3000 })
  );
}

/**
 * Fungsi utilitas untuk debounce
 * @param func Fungsi yang akan di-debounce
 * @param wait Waktu tunggu dalam milidetik
 * @returns Fungsi yang sudah di-debounce
 */
export function debounce(func: Function, wait: number): (...args: any[]) => void {
  let timeout: number | null = null;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}
