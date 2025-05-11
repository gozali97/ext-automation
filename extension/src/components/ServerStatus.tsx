import { useState, useEffect } from "react"
import { checkServerStatus } from "~lib/api-client"

const ServerStatus: React.FC = () => {
  const [status, setStatus] = useState<"online" | "offline" | "checking">("checking")
  const [message, setMessage] = useState<string>("Memeriksa koneksi ke server...")
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  useEffect(() => {
    checkServerConnection()
    
    // Periksa status server setiap 30 detik
    const interval = setInterval(checkServerConnection, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const checkServerConnection = async () => {
    setStatus("checking")
    setMessage("Memeriksa koneksi ke server...")
    
    try {
      const result = await checkServerStatus()
      
      if (result.status === "online") {
        setStatus("online")
        setMessage(result.message || "Server terhubung")
      } else {
        setStatus("offline")
        setMessage(result.message || "Server tidak terhubung")
      }
      
      setLastChecked(new Date().toLocaleTimeString())
    } catch (error) {
      setStatus("offline")
      setMessage(`Tidak dapat terhubung ke server: ${error.message}`)
      setLastChecked(new Date().toLocaleTimeString())
    }
  }

  return (
    <div className={`p-2 rounded-md text-sm flex items-center justify-between ${
      status === "online" 
        ? "bg-green-100 text-green-800" 
        : status === "offline" 
          ? "bg-red-100 text-red-800" 
          : "bg-yellow-100 text-yellow-800"
    }`}>
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          status === "online" 
            ? "bg-green-500" 
            : status === "offline" 
              ? "bg-red-500" 
              : "bg-yellow-500"
        }`}></div>
        <span>
          {message}
        </span>
      </div>
      
      {lastChecked && (
        <button 
          onClick={checkServerConnection}
          className="text-xs underline ml-2"
        >
          Refresh
        </button>
      )}
    </div>
  )
}

export default ServerStatus
