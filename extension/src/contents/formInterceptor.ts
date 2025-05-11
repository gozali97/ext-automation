import type { WebsiteConfig } from "../types"
import { Storage } from "@plasmohq/storage"

// Store credentials in memory for this session
let currentCredentials: WebsiteConfig | null = null

// Function to capture form data
function captureFormData(form: HTMLFormElement): Record<string, any> {
  const formData = new FormData(form)
  const data: Record<string, any> = {}
  formData.forEach((value, key) => {
    data[key] = value
  })
  return data
}

// Function to intercept form submissions
function interceptForm(form: HTMLFormElement) {
  form.addEventListener('submit', async (event) => {
    console.log("Form submission intercepted")
    
    // Capture form data
    const data = captureFormData(form)
    console.log("Captured form data:", data)
    
    // Send data to background script
    try {
      chrome.runtime.sendMessage({
        type: 'FORM_SUBMIT',
        data: {
          url: window.location.href,
          method: form.method || 'GET',
          action: form.action || window.location.href,
          formData: data,
          timestamp: Date.now()
        }
      }, response => {
        console.log("Background script response:", response)
      })
    } catch (error) {
      console.error("Error sending form data:", error)
    }
  }, true) // Use capture phase to ensure we get the data before submission
}

// Function to observe DOM changes for dynamically added forms
function observeDOM() {
  console.log("Starting DOM observation")
  
  // First handle existing forms
  const existingForms = document.querySelectorAll('form')
  console.log("Found existing forms:", existingForms.length)
  existingForms.forEach(form => {
    interceptForm(form as HTMLFormElement)
  })

  // Then observe for new forms
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) {
          const forms = node.querySelectorAll('form')
          if (forms.length > 0) {
            console.log("Found new forms:", forms.length)
            forms.forEach(form => {
              interceptForm(form as HTMLFormElement)
            })
          }
        }
      })
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  console.log("DOM observer initialized")
}

// Start observing when the script loads
console.log("Form interceptor script loaded")
observeDOM()

// Single message listener for all message types
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message)
  
  switch (message.type) {
    case 'FILL_LOGIN_FORM':
      try {
        console.log("Attempting to fill login form")
        const form = document.querySelector('form')
        if (!form) throw new Error('Login form not found')

        // Get the absolute form action URL
        const formAction = (form as HTMLFormElement).action || window.location.href
        let absoluteFormAction = formAction
        
        // Special handling for project.k24.co.id
        if (window.location.hostname.includes('project.k24.co.id')) {
          // If form action is relative (e.g., "/scp"), make it absolute
          if (formAction.startsWith('/')) {
            absoluteFormAction = `${window.location.origin}${formAction}`
          } else if (!formAction.startsWith('http')) {
            absoluteFormAction = `${window.location.origin}/${formAction}`
          }
          console.log("Using form action for k24:", absoluteFormAction)
        } else {
          // For other sites
          absoluteFormAction = new URL(formAction, window.location.href).href
        }

        // Update the config with the correct login URL
        message.config.loginUrl = absoluteFormAction
        message.config.url = window.location.origin
        
        // For k24.co.id, look for specific form fields
        let usernameInput, passwordInput
        
        if (window.location.hostname.includes('project.k24.co.id')) {
          // Specific selectors for k24.co.id
          usernameInput = form.querySelector('input[name="LoginForm[username]"]') as HTMLInputElement
          passwordInput = form.querySelector('input[name="LoginForm[password]"]') as HTMLInputElement
        } else {
          // General selectors for other sites
          usernameInput = form.querySelector('input[type="text"], input[type="email"], input[name*="username"], input[name*="email"], input[name*="LoginForm"]') as HTMLInputElement
          passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement
        }
        
        if (!usernameInput) throw new Error('Username/email field not found')
        console.log("Found username input:", usernameInput)
        usernameInput.value = message.config.credentials.identifier
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }))

        if (!passwordInput) throw new Error('Password field not found')
        console.log("Found password input:", passwordInput)
        passwordInput.value = message.config.credentials.password
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }))

        // Find submit button (k24.co.id uses name="yt0" for submit button)
        const submitSelectors = [
          'button[type="submit"]', 
          'input[type="submit"]', 
          'input[name="yt0"]',
          'button:contains("Login")',
          'button:contains("Sign in")'
        ]
        
        let submitButton = null
        for (const selector of submitSelectors) {
          submitButton = form.querySelector(selector) as HTMLElement
          if (submitButton) break
        }
        
        if (!submitButton) throw new Error('Submit button not found')
        console.log("Found submit button:", submitButton)

        // Store form data before submission
        const formData = captureFormData(form as HTMLFormElement)
        
        // Send the form data and action URL back to background script
        chrome.runtime.sendMessage({
          type: 'FORM_SUBMIT',
          data: {
            url: window.location.href,
            action: absoluteFormAction,
            method: (form as HTMLFormElement).method || 'POST',
            formData
          }
        })

        // Save config to storage for future use
        const storage = new Storage()
        const updatedConfig = {
          ...message.config,
          loginUrl: absoluteFormAction,
          url: window.location.origin
        }
        storage.set("config", updatedConfig).then(() => {
          console.log("Saved updated config with correct URLs:", updatedConfig)
        })

        // Submit the form
        submitButton.click()
        console.log("Form submitted")

        sendResponse({ 
          success: true, 
          formAction: absoluteFormAction,
          url: window.location.origin
        })
      } catch (error) {
        console.error("Error filling login form:", error)
        sendResponse({ success: false, error: error.message })
      }
      break

    case 'SET_CREDENTIALS':
      currentCredentials = message.config
      sendResponse({ success: true })
      break

    default:
      console.log("Unknown message type:", message.type)
      sendResponse({ success: false, error: "Unknown message type" })
  }
  
  return true // Keep the message channel open for async response
}) 