import React from "react"
import type { TokenData } from "~utils/storage"
import StatusIndicator from "./StatusIndicator"
import LoginSection from "./LoginSection"
import ConnectedSection from "./ConnectedSection"

interface StatusTabProps {
  status: string
  isLoggedIn: boolean
  isRefreshing: boolean
  tokenData: TokenData | null
  onRefresh: () => void
  onLogin: () => void
  onOpenDashboard: () => void
  onLogout: () => void
}

const StatusTab: React.FC<StatusTabProps> = ({
  status,
  isLoggedIn,
  isRefreshing,
  tokenData,
  onRefresh,
  onLogin,
  onOpenDashboard,
  onLogout
}) => {
  return (
    <>
      <StatusIndicator 
        status={status}
        isLoggedIn={isLoggedIn}
        isRefreshing={isRefreshing}
        tokenData={tokenData}
        onRefresh={onRefresh}
      />
      
      {!isLoggedIn ? (
        <LoginSection onLogin={onLogin} />
      ) : (
        tokenData && (
          <ConnectedSection 
            tokenData={tokenData}
            onOpenDashboard={onOpenDashboard}
            onLogout={onLogout}
          />
        )
      )}
    </>
  )
}

export default StatusTab
