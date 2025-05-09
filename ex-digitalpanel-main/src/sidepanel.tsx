import React from "react"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { clearDigitalPanelData, getTokenData } from "~utils/storage"
import type { TokenData } from "~utils/storage"
import { apiService } from "~utils/api"
import type { ActiveService } from "~components/ActiveServices"
import TabNavigation from "~components/TabNavigation"
import StatusTab from "~components/StatusTab"
import ServicesTab from "~components/ServicesTab"
import "./style.css"

export default function SidePanel() {
  const [status, setStatus] = useState<string>("Loading...")
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("status") // "status", "services"
  const [activeServices, setActiveServices] = useState<ActiveService[]>([])
  const [loadingServices, setLoadingServices] = useState<boolean>(false)

  // Referensi untuk melacak data token sebelumnya
  const prevTokenDataRef = useRef<TokenData | null>(null);
  
  // Fungsi debounce untuk mencegah pemanggilan berulang
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Fetch active services (memoized)
  const fetchServices = useCallback(async (token: string) => {
    if (!token) return;
    
    setLoadingServices(true);
    try {
      const services = await apiService.fetchActiveServices(token);
      setActiveServices(services);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  // Referensi untuk melacak waktu pemeriksaan terakhir
  const lastCheckTimeRef = useRef<number>(0);
  const CHECK_INTERVAL = 5000; // 5 detik interval minimum antara pemeriksaan

  // Referensi untuk melacak apakah komponen sudah di-mount
  const isMountedRef = useRef<boolean>(false);

  // Check if user is logged in to Digital Panel (memoized)
  const checkLoginStatus = useCallback(async () => {
    // Prevent concurrent checks
    if (isRefreshing) return;
    
    // Prevent too frequent checks
    const now = Date.now();
    if (now - lastCheckTimeRef.current < CHECK_INTERVAL) {
      console.log(`Pemeriksaan terlalu sering, melewati. Terakhir: ${now - lastCheckTimeRef.current}ms yang lalu`);
      // Pastikan isRefreshing diubah menjadi false untuk menghentikan animasi tombol refresh
      setIsRefreshing(false);
      return;
    }
    
    // Update last check time
    lastCheckTimeRef.current = now;
    
    setIsRefreshing(true);
    console.log("Mulai pemeriksaan status login");
    setStatus("Checking connection...");
    try {
      // HAPUS BAGIAN YANG MENCOBA MENDAPATKAN TOKEN DARI HALAMAN
      // Kita hanya akan menggunakan token dari storage Chrome untuk mencegah loop tak terbatas
      
      // Then check storage for token
      const tokenData = await getTokenData();
      console.log("Token data dari storage:", tokenData);
      
      // Hanya update state jika nilai berubah
      if (tokenData?.token) {
        const tokenChanged = !prevTokenDataRef.current || 
                            prevTokenDataRef.current.token !== tokenData.token;
        
        console.log("Token valid, tokenChanged:", tokenChanged, "isLoggedIn:", isLoggedIn);
        
        if (tokenChanged || !isLoggedIn) {
          setTokenData(tokenData);
          setIsLoggedIn(true);
          setStatus("Connected to Digital Panel");
          prevTokenDataRef.current = tokenData;
          
          // Fetch active services when logged in
          fetchServices(tokenData.token);
        } else {
          // Pastikan status diperbarui meskipun tidak ada perubahan token
          setStatus("Connected to Digital Panel");
        }
      } else {
        console.log("Token tidak valid, isLoggedIn:", isLoggedIn, "prevTokenDataRef.current:", !!prevTokenDataRef.current);
        
        // Selalu update status jika token tidak valid
        setTokenData(null);
        setIsLoggedIn(false);
        setStatus("Not connected to Digital Panel");
        prevTokenDataRef.current = null;
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      setStatus("Error checking connection");
    } finally {
      setIsRefreshing(false);
    }
  // Hapus isRefreshing dari dependency array untuk mencegah re-render berlebihan
  }, [isLoggedIn, fetchServices]);
  
  // Debounced version of checkLoginStatus
  // Gunakan useRef untuk menyimpan fungsi debounced agar tidak dibuat ulang setiap render
  const debouncedCheckLoginStatusRef = useRef<Function | null>(null);
  
  // Inisialisasi debouncedCheckLoginStatusRef pada mount
  useEffect(() => {
    debouncedCheckLoginStatusRef.current = debounce(checkLoginStatus, 300);
  }, [checkLoginStatus]);
  
  // Fungsi untuk memanggil debounced function
  const callDebouncedCheckLoginStatus = useCallback(() => {
    if (debouncedCheckLoginStatusRef.current) {
      debouncedCheckLoginStatusRef.current();
    }
  }, []);
  
  // Referensi untuk melacak apakah pemeriksaan status sedang berjalan
  const isCheckingRef = useRef<boolean>(false);

  // Check login status on component mount and listen for refresh messages
  useEffect(() => {
    // Fungsi untuk memeriksa status dengan timeout
    const checkLoginStatusWithTimeout = async () => {
      // Jika sudah ada pemeriksaan yang berjalan, jangan mulai yang baru
      if (isCheckingRef.current) {
        console.log("Pemeriksaan status sudah berjalan, melewati");
        return;
      }
      
      // Set flag bahwa pemeriksaan sedang berjalan
      isCheckingRef.current = true;
      
      // Set timeout untuk memastikan status diperbarui setelah beberapa waktu
      const timeoutId = setTimeout(() => {
        console.log("Timeout pemeriksaan status, memastikan status diperbarui");
        setIsRefreshing(false);
        if (status === "Checking connection...") {
          setStatus("Connection check timed out");
        }
        isCheckingRef.current = false;
      }, 5000); // 5 detik timeout
      
      try {
        // Jalankan pemeriksaan status
        await checkLoginStatus();
      } catch (error) {
        console.error("Error dalam pemeriksaan status:", error);
        setIsRefreshing(false);
        setStatus("Error checking connection");
      } finally {
        // Bersihkan timeout dan reset flag
        clearTimeout(timeoutId);
        isCheckingRef.current = false;
      }
    };
    
    // Initial check
    checkLoginStatusWithTimeout();
    
    // Listen for storage changes to detect token updates
    const handleStorageChange = (changes: {[key: string]: chrome.storage.StorageChange}, area: string) => {
      if (area === 'local' && changes.digitalPanelToken) {
        // Hanya refresh jika belum login atau token berubah
        const newToken = changes.digitalPanelToken.newValue?.token;
        const oldToken = changes.digitalPanelToken.oldValue?.token;
        
        if (!isLoggedIn || newToken !== oldToken) {
          console.log('Token changed in storage, refreshing status');
          // Gunakan fungsi dengan timeout
          checkLoginStatusWithTimeout();
        }
      }
    };
    
    // Add storage change listener
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    // Cleanup listener on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [checkLoginStatus, isLoggedIn, status]);

  // Handle login to Digital Panel (memoized)
  const handleLogin = useCallback(() => {
    // Save current tab before redirecting
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0]?.url) {
        chrome.runtime.sendMessage({
          action: 'saveOriginalTab',
          tabId: tabs[0].id,
          tabUrl: tabs[0].url
        });
      }
      
      // Open Digital Panel login page
      chrome.tabs.create({ url: 'https://app.digitalpanel.id/signin' });
    });
  }, []);

  // Handle logout from Digital Panel (memoized)
  const handleLogout = useCallback(async () => {
    // Clear token from extension storage
    await clearDigitalPanelData();
    setTokenData(null);
    setIsLoggedIn(false);
    setStatus("Not connected to Digital Panel");
    prevTokenDataRef.current = null;
    
    // Also clear token from digitalpanel.id website if tab is open
    if (chrome.tabs) {
      chrome.tabs.query({url: "https://app.digitalpanel.id/*"}, (tabs) => {
        if (tabs && tabs.length > 0) {
          // For each open digitalpanel tab
          tabs.forEach(tab => {
            if (tab.id) {
              console.log("Clearing token from digitalpanel.id website");
              // Execute script to clear localStorage tokens
              chrome.tabs.sendMessage(
                tab.id,
                { action: "clearTokensFromPage" }
              );
            }
          });
        }
      });
    }
  }, []);

  // Handle opening dashboard (memoized)
  const handleOpenDashboard = useCallback(() => {
    chrome.tabs.create({ url: 'https://app.digitalpanel.id/dashboard' });
  }, []);
  
  // Memoized handler for refreshing services
  const handleRefreshServices = useCallback(() => {
    if (tokenData?.token) {
      fetchServices(tokenData.token);
    }
  }, [fetchServices, tokenData]);

  // Simpan referensi ke checkLoginStatus terbaru
  const checkLoginStatusRef = useRef(checkLoginStatus);
  
  // Update referensi setiap kali checkLoginStatus berubah
  useEffect(() => {
    checkLoginStatusRef.current = checkLoginStatus;
  }, [checkLoginStatus]);
  
  // Stabilkan fungsi onRefresh agar tidak berubah setiap render
  const stableOnRefresh = useCallback(() => {
    // Jika sudah ada pemeriksaan yang berjalan, jangan mulai yang baru
    if (isCheckingRef.current) {
      console.log("Pemeriksaan status sudah berjalan, melewati refresh manual");
      return;
    }
    
    // Set flag bahwa pemeriksaan sedang berjalan
    isCheckingRef.current = true;
    
    // Set timeout untuk memastikan status diperbarui setelah beberapa waktu
    const timeoutId = setTimeout(() => {
      console.log("Timeout pemeriksaan status, memastikan status diperbarui");
      setIsRefreshing(false);
      if (status === "Checking connection...") {
        setStatus("Connection check timed out");
      }
      isCheckingRef.current = false;
    }, 5000); // 5 detik timeout
    
    // Gunakan referensi terbaru dari checkLoginStatus
    checkLoginStatusRef.current()
      .catch(error => {
        console.error("Error dalam pemeriksaan status:", error);
        setIsRefreshing(false);
        setStatus("Error checking connection");
      })
      .finally(() => {
        // Bersihkan timeout dan reset flag
        clearTimeout(timeoutId);
        isCheckingRef.current = false;
      });
  }, [status]); // Dependency array hanya berisi status
  
  return (
    <div style={{ padding: "16px", height: "100vh", overflow: "auto" }}>
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {activeTab === "status" ? (
        <StatusTab 
          status={status}
          isLoggedIn={isLoggedIn}
          isRefreshing={isRefreshing}
          tokenData={tokenData}
          onRefresh={stableOnRefresh} // Gunakan fungsi yang stabil
          onLogin={handleLogin}
          onOpenDashboard={handleOpenDashboard}
          onLogout={handleLogout}
        />
      ) : (
        <ServicesTab 
          isLoggedIn={isLoggedIn}
          loadingServices={loadingServices}
          activeServices={activeServices}
          onRefreshServices={handleRefreshServices}
        />
      )}
    </div>
  )
}
