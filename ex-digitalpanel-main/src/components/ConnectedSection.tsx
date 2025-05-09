import React from "react"
import type { TokenData } from "~utils/storage"

interface ConnectedSectionProps {
  tokenData: TokenData
  onOpenDashboard: () => void
  onLogout: () => void
}

const ConnectedSection: React.FC<ConnectedSectionProps> = ({
  tokenData,
  onOpenDashboard,
  onLogout
}) => {
  return (
    <div>
      <div style={{ 
        padding: "12px",
        backgroundColor: "#F0F9FF",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #BFDBFE"
      }}>
        <h3 style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 8px 0",
          color: "#1E40AF",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Siap Digunakan
        </h3>
        <p style={{ 
          fontSize: "0.85rem", 
          margin: 0,
          color: "#1E3A8A",
          lineHeight: "1.4"
        }}>
          Ekstensi sudah terhubung dengan Digital Panel. Anda dapat menggunakan tombol "By Digitalpanel" di website Freepik untuk mendownload resource.
        </p>
      </div>
      
      {/* Informasi tentang AI Suite Freepik */}
      <div style={{ 
        padding: "12px",
        backgroundColor: "#F0FDF4",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #BBF7D0"
      }}>
        <h3 style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 8px 0",
          color: "#166534",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          AI Suite Freepik
        </h3>
        <p style={{ 
          fontSize: "0.85rem", 
          margin: "0 0 8px 0",
          color: "#14532D",
          lineHeight: "1.4"
        }}>
          Jika Anda membeli langganan yang sudah include AI Suite Freepik, Anda dapat mengakses:
        </p>
        <a 
          href="https://www.freepik.com/pikaso/explore" 
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            fontSize: "0.85rem",
            color: "#166534",
            textDecoration: "none",
            fontWeight: 500,
            padding: "6px 10px",
            backgroundColor: "#DCFCE7",
            borderRadius: "6px",
            transition: "all 0.2s ease",
            textAlign: "center"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#BBF7D0"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#DCFCE7"}
        >
          https://www.freepik.com/pikaso/explore
        </a>
      </div>
      
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onOpenDashboard}
          style={{
            backgroundColor: "#2563EB",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "10px 16px",
            flex: 1,
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#1D4ED8"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#2563EB"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          Dashboard
        </button>
        <button
          onClick={onLogout}
          style={{
            backgroundColor: "#F3F4F6",
            color: "#111827",
            border: "1px solid #D1D5DB",
            borderRadius: "6px",
            padding: "10px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#E5E7EB"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#F3F4F6"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </div>
  )
}

export default ConnectedSection
