import React from "react"
import type { ActiveService } from "./ActiveServices"
import ActiveServices from "./ActiveServices"

interface ServicesTabProps {
  isLoggedIn: boolean
  loadingServices: boolean
  activeServices: ActiveService[]
  onRefreshServices: () => void
}

const ServicesTab: React.FC<ServicesTabProps> = ({
  isLoggedIn,
  loadingServices,
  activeServices,
  onRefreshServices
}) => {
  if (!isLoggedIn) {
    return (
      <div style={{
        padding: "16px",
        backgroundColor: "#FEF2F2",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #FEE2E2"
      }}>
        <h3 style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 8px 0",
          color: "#991B1B",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Login Diperlukan
        </h3>
        <p style={{ 
          fontSize: "0.85rem", 
          margin: 0,
          color: "#991B1B",
          lineHeight: "1.4"
        }}>
          Silakan login terlebih dahulu untuk melihat layanan aktif Anda.
        </p>
      </div>
    )
  }

  if (loadingServices) {
    return (
      <div style={{
        padding: "16px",
        backgroundColor: "#F9FAFB",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #E5E7EB",
        textAlign: "center"
      }}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#2563EB" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{
            animation: "spin 1s linear infinite",
            margin: "8px auto"
          }}
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        <p style={{ 
          fontSize: "0.9rem", 
          margin: "8px 0 0 0",
          color: "#4B5563"
        }}>
          Memuat layanan aktif...
        </p>
      </div>
    )
  }

  if (activeServices.length === 0) {
    return (
      <div style={{
        padding: "16px",
        backgroundColor: "#F9FAFB",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #E5E7EB",
        textAlign: "center"
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 15h8M9.5 9h.01M14.5 9h.01"></path>
        </svg>
        <p style={{ 
          fontSize: "0.9rem", 
          margin: "8px 0 0 0",
          color: "#4B5563"
        }}>
          Tidak ada layanan aktif yang ditemukan
        </p>
      </div>
    )
  }

  return (
    <div style={{
      padding: "12px",
      backgroundColor: "#F9FAFB",
      borderRadius: "8px",
      marginBottom: "16px",
      border: "1px solid #E5E7EB"
    }}>
      <h3 style={{
        fontSize: "1rem",
        fontWeight: 600,
        margin: "0 0 12px 0",
        color: "#111827"
      }}>Layanan Aktif</h3>
      
      <ActiveServices services={activeServices} />
      
      <div style={{
        marginTop: "12px",
        textAlign: "center"
      }}>
        <button
          onClick={onRefreshServices}
          disabled={loadingServices}
          style={{
            backgroundColor: "#F3F4F6",
            color: "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: loadingServices ? "default" : "pointer",
            transition: "all 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              animation: loadingServices ? "spin 1s linear infinite" : "none"
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          {loadingServices ? "Memuat..." : "Refresh"}
        </button>
      </div>
    </div>
  )
}

export default ServicesTab
