import React from "react"

interface LoginSectionProps {
  onLogin: () => void
}

const LoginSection: React.FC<LoginSectionProps> = ({ onLogin }) => {
  return (
    <div>
      <div style={{ 
        padding: "12px",
        backgroundColor: "#F3F4F6",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #E5E7EB"
      }}>
        <h3 style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 8px 0",
          color: "#111827",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Anda belum terhubung
        </h3>
        <p style={{ 
          fontSize: "0.85rem", 
          margin: "0 0 8px 0",
          color: "#4B5563",
          lineHeight: "1.4"
        }}>
          Untuk menggunakan ekstensi ini, Anda perlu login ke akun Digital Panel terlebih dahulu.
        </p>
        <p style={{ 
          fontSize: "0.8rem", 
          margin: 0,
          color: "#991B1B",
          backgroundColor: "#FEF2F2",
          padding: "6px 8px",
          borderRadius: "4px",
          border: "1px solid #FEE2E2"
        }}>
          Jika Anda sudah login di website Digital Panel tapi masih muncul "Not connected", silakan klik tombol Refresh di atas atau gunakan tombol Login di bawah.
        </p>
      </div>
    
      <button
        onClick={onLogin}
        style={{
          backgroundColor: "#2563EB",
          color: "white",
          border: "none",
          borderRadius: "6px",
          padding: "10px 16px",
          width: "100%",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#1D4ED8"}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#2563EB"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        Login to Digital Panel
      </button>
    </div>
  )
}

export default LoginSection
