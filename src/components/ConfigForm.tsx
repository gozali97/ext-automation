import { useState } from "react"
import { Storage } from "@plasmohq/storage"
import type { ConfigData } from "~types"

interface ConfigFormProps {
  onSuccess: () => void
}

const ConfigForm: React.FC<ConfigFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<ConfigData>({
    websiteUrl: "",
    authType: "email",
    identifier: "",
    password: ""
  })
  const [error, setError] = useState("")
  const storage = new Storage()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      // Validasi form
      if (!formData.websiteUrl || !formData.identifier || !formData.password) {
        setError("Semua field harus diisi")
        return
      }

      // Simpan ke storage
      await storage.set("config", formData)
      onSuccess()
    } catch (err) {
      setError("Gagal menyimpan konfigurasi")
      console.error(err)
    }
  }

  const handleClear = async () => {
    try {
      await storage.remove("config")
      setFormData({
        websiteUrl: "",
        authType: "email",
        identifier: "",
        password: ""
      })
    } catch (err) {
      setError("Gagal menghapus konfigurasi")
      console.error(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">Website URL</label>
        <input
          type="url"
          name="websiteUrl"
          value={formData.websiteUrl}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          placeholder="https://example.com"
        />
      </div>

      <div>
        <label className="block mb-1">Tipe Autentikasi</label>
        <select
          name="authType"
          value={formData.authType}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        >
          <option value="email">Email</option>
          <option value="username">Username</option>
        </select>
      </div>

      <div>
        <label className="block mb-1">
          {formData.authType === "email" ? "Email" : "Username"}
        </label>
        <input
          type={formData.authType === "email" ? "email" : "text"}
          name="identifier"
          value={formData.identifier}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label className="block mb-1">Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Simpan
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Hapus
        </button>
      </div>
    </form>
  )
}

export default ConfigForm 