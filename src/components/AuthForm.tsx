import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { ConfigData, AuthResponse } from "~types"

interface AuthFormProps {
  onLogout: () => void
}

const AuthForm: React.FC<AuthFormProps> = ({ onLogout }) => {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const storage = new Storage()

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const savedConfig = await storage.get<ConfigData>("config")
      setConfig(savedConfig)
    } catch (err) {
      console.error("Error loading config:", err)
      setMessage("Gagal memuat konfigurasi")
    }
  }

  const handleLogin = async () => {
    if (!config) return

    setStatus("loading")
    setMessage("")

    try {
      // Dapatkan tab aktif
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      // Kirim pesan ke content script untuk melakukan login
      const response = await chrome.tabs.sendMessage<any, AuthResponse>(tab.id, {
        type: "PERFORM_LOGIN",
        data: config
      })

      if (response.success) {
        setStatus("success")
        setMessage("Login berhasil!")
      } else {
        setStatus("error")
        setMessage(response.error || "Login gagal")
      }
    } catch (err) {
      console.error("Login error:", err)
      setStatus("error")
      setMessage("Terjadi kesalahan saat login")
    }
  }

  const handleLogout = async () => {
    try {
      // Hapus cookie autentikasi
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.cookies.remove({
        url: tab.url,
        name: "session" // sesuaikan dengan nama cookie yang digunakan
      })
      
      onLogout()
    } catch (err) {
      console.error("Logout error:", err)
      setMessage("Gagal melakukan logout")
    }
  }

  if (!config) {
    return <div className="text-red-500">Konfigurasi tidak ditemukan</div>
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Konfigurasi Saat Ini:</h3>
        <p>Website: {config.websiteUrl}</p>
        <p>{config.authType === "email" ? "Email" : "Username"}: {config.identifier}</p>
      </div>

      {message && (
        <div className={`text-sm ${status === "success" ? "text-green-500" : "text-red-500"}`}>
          {message}
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={handleLogin}
          disabled={status === "loading"}
          className={`px-4 py-2 rounded text-white ${
            status === "loading"
              ? "bg-blue-300"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {status === "loading" ? "Sedang Login..." : "Login"}
        </button>
        
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default AuthForm 