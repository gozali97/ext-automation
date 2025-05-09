import React from "react"

interface TabNavigationProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "status", label: "Status" },
    { id: "services", label: "Layanan" }
  ]

  return (
    <div style={{
      display: "flex",
      borderBottom: "1px solid #E5E7EB",
      marginBottom: "16px"
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            padding: "12px 16px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: activeTab === tab.id ? "2px solid #2563EB" : "2px solid transparent",
            color: activeTab === tab.id ? "#2563EB" : "#6B7280",
            fontWeight: activeTab === tab.id ? 600 : 500,
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default TabNavigation
