import React, { useState } from "react"
import type { TokenData } from "~utils/storage"

interface TokenDisplayProps {
  tokenData: TokenData
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({ tokenData }) => {
  const [copied, setCopied] = useState<boolean>(false)

  // Copy token to clipboard
  const copyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => console.error('Failed to copy token:', err))
    }
  }

  return (
    <div style={{
      backgroundColor: "#F9FAFB",
      borderRadius: "8px",
      padding: "12px",
      marginBottom: "16px",
      fontSize: "0.8rem",
      border: "1px solid #E5E7EB"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between",
        marginBottom: "6px",
        alignItems: "center",
        padding: "4px 0"
      }}>
        <span style={{ fontWeight: 500, color: "#4B5563" }}>Token:</span>
      </div>
      
      <div style={{
        position: "relative",
        marginTop: "4px"
      }}>
        <textarea
          readOnly
          value={tokenData.token}
          style={{
            width: "100%",
            padding: "6px",
            borderRadius: "6px",
            border: "1px solid #D1D5DB",
            fontSize: "0.75rem",
            height: "60px",
            resize: "none",
            backgroundColor: "#F9FAFB"
          }}
        />
        <button
          onClick={copyToken}
          style={{
            position: "absolute",
            right: "4px",
            top: "4px",
            backgroundColor: copied ? "#10B981" : "#2563EB",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "0.7rem",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => {
            if (!copied) e.currentTarget.style.backgroundColor = "#1D4ED8"
          }}
          onMouseOut={(e) => {
            if (!copied) e.currentTarget.style.backgroundColor = "#2563EB"
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  )
}

export default TokenDisplay
