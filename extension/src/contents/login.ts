import type { ConfigData, AuthResponse } from "~types"

// Fungsi untuk menemukan dan mengisi form login
const fillLoginForm = (config: ConfigData): boolean => {
  try {
    // Cari input fields berdasarkan atribut umum
    const identifierField = document.querySelector<HTMLInputElement>(
      `input[type="${config.authType}"], input[name="${config.authType}"], input[id="${config.authType}"]`
    )
    const passwordField = document.querySelector<HTMLInputElement>(
      'input[type="password"]'
    )
    const submitButton = document.querySelector<HTMLButtonElement>(
      'button[type="submit"], input[type="submit"]'
    )

    if (!identifierField || !passwordField || !submitButton) {
      console.error("Form login tidak ditemukan")
      return false
    }

    // Isi form
    identifierField.value = config.identifier
    passwordField.value = config.password

    return true
  } catch (err) {
    console.error("Error saat mengisi form:", err)
    return false
  }
}

// Fungsi untuk mengirim form login
const submitLoginForm = (): boolean => {
  try {
    const form = document.querySelector<HTMLFormElement>("form")
    const submitButton = document.querySelector<HTMLButtonElement>(
      'button[type="submit"], input[type="submit"]'
    )

    if (form) {
      form.submit()
      return true
    } else if (submitButton) {
      submitButton.click()
      return true
    }

    return false
  } catch (err) {
    console.error("Error saat submit form:", err)
    return false
  }
}

// Listener untuk pesan dari extension
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; data: ConfigData },
    sender,
    sendResponse: (response: AuthResponse) => void
  ) => {
    if (message.type === "PERFORM_LOGIN") {
      const formFilled = fillLoginForm(message.data)
      
      if (!formFilled) {
        sendResponse({
          success: false,
          message: "Gagal mengisi form login",
          error: "Form login tidak ditemukan"
        })
        return
      }

      const submitted = submitLoginForm()
      
      if (!submitted) {
        sendResponse({
          success: false,
          message: "Gagal mengirim form login",
          error: "Tombol submit tidak ditemukan"
        })
        return
      }

      sendResponse({
        success: true,
        message: "Login berhasil"
      })
    }
  }
) 