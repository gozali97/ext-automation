// routes.js - Definisi route API untuk backend

import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import {
  ensureDirectoryExists,
  saveToJsonFile,
  getFilesInDirectory,
  sanitizeFilename,
  getFormattedDate,
} from "./utils.js";
import { saveErrorToFile } from "./test-utils.js";
import { executeLoginTest } from "./login-test.js";
import { executeFormFillTest } from "./form-fill-test.js";
import { executeLogoutTest } from "./logout-test.js";
import { executeGoogleLoginTest } from "./google-login-test.js";
import { executeSubmitFormTest } from "./submit-form-test.js";

// Setup ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori results ada
ensureDirectoryExists(path.join(__dirname, "results"));

const router = express.Router();

// Route untuk memeriksa status server
router.get("/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    message: "Server berjalan dengan baik",
  });
});

// Route untuk melakukan login ke website
router.post("/login", async (req, res) => {
  const { websiteConfig } = req.body;

  if (!websiteConfig || !websiteConfig.url || !websiteConfig.credentials) {
    return res.status(400).json({
      success: false,
      message: "Konfigurasi website tidak valid",
    });
  }

  let browser;
  const testResult = {
    id: "login",
    name: "Login Test",
    type: "login",
    status: "running",
    result: {
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
    },
  };

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Gunakan implementasi modular untuk login test
    const loginSuccess = await executeLoginTest(page, websiteConfig, testResult, __dirname);

    // Update test result
    testResult.status = loginSuccess ? "passed" : "failed";
    testResult.result.success = loginSuccess;

    // Ambil screenshot setelah login untuk debugging
    const afterScreenshotPath = path.join(
      __dirname,
      "results",
      `after_login_${getFormattedDate()}.png`
    );
    await page.screenshot({ path: afterScreenshotPath });
    console.log("Screenshot after login saved");

    // Store browser in global scope instead of closing it
    global.activeBrowser = browser;
    console.log("Browser instance saved to global scope for manual closing");

    // Return hasil
    return res.json({
      success: loginSuccess,
      message: loginSuccess
        ? "Login berhasil"
        : "Login gagal, cek screenshot untuk detail",
      result: testResult,
      screenshotPath: afterScreenshotPath,
    });
  } catch (error) {
    console.error("Login error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'login_error');
    if (browser) {
      global.activeBrowser = browser;
      console.log("Browser instance saved to global scope for manual closing");
    }
    return res.status(500).json({
      success: false,
      message: "Error saat melakukan login",
      error: error.message,
    });
  }
});

// Route untuk melakukan logout dari website
router.post("/logout", async (req, res) => {
  const { websiteConfig } = req.body;

  if (!websiteConfig || !websiteConfig.url) {
    return res.status(400).json({
      success: false,
      message: "Konfigurasi website tidak valid",
    });
  }

  let browser;
  const testResult = {
    id: "logout",
    name: "Logout Test",
    type: "logout",
    status: "running",
    result: {
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
    },
  };

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Navigasi ke halaman website
    console.log(`Navigasi ke URL: ${websiteConfig.url}`);
    await page.goto(websiteConfig.url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Ambil screenshot sebelum logout untuk debugging
    const beforeScreenshotPath = path.join(
      __dirname,
      "results",
      `before_logout_${getFormattedDate()}.png`
    );
    await page.screenshot({ path: beforeScreenshotPath });
    console.log("Screenshot before logout saved");

    // Gunakan implementasi modular untuk logout test
    const logoutSuccess = await executeLogoutTest(page, testResult, __dirname);

    // Ambil screenshot setelah logout untuk debugging
    const afterScreenshotPath = path.join(
      __dirname,
      "results",
      `after_logout_${getFormattedDate()}.png`
    );
    await page.screenshot({ path: afterScreenshotPath });
    console.log("Screenshot after logout saved");

    // Update test result
    testResult.status = logoutSuccess ? "passed" : "failed";
    testResult.result.success = logoutSuccess;

    // Store browser in global scope instead of closing it
    global.activeBrowser = browser;
    console.log("Browser instance saved to global scope for manual closing");

    // Return hasil
    return res.json({
      success: logoutSuccess,
      message: logoutSuccess
        ? "Logout berhasil"
        : "Logout gagal, cek screenshot untuk detail",
      result: testResult,
      beforeScreenshotPath,
      afterScreenshotPath,
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Simpan error ke file
    saveErrorToFile(error, 'logout_error');
    if (browser) {
      global.activeBrowser = browser;
      console.log("Browser instance saved to global scope for manual closing");
    }
    return res.status(500).json({
      success: false,
      message: "Error saat melakukan logout",
      error: error.message,
    });
  }
});

// Route untuk menjalankan semua test
router.post("/run-tests", async (req, res) => {
  const { websiteConfig, testCases } = req.body;

  if (!websiteConfig || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters",
    });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Tambahkan listener untuk error navigasi
    page.on("requestfailed", (request) => {
      console.log(`Request failed: ${request.url()}`);
      // Add null check to avoid TypeError
      const failure = request.failure();
      if (failure && failure.errorText) {
        console.log(`Reason: ${failure.errorText}`);
      } else {
        console.log("No error details available");
      }
    });

    // Cek apakah ada Basic Auth
    if (
      websiteConfig.hasBasicAuth &&
      websiteConfig.basicAuth &&
      websiteConfig.basicAuth.username &&
      websiteConfig.basicAuth.password
    ) {
      console.log("Menggunakan Basic Authentication untuk test");
      // Set Basic Authentication
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password,
        });
      } catch (authError) {
        console.error('Error saat setup basic authentication untuk test:', authError.message);
        saveErrorToFile(authError, 'run_tests_auth_setup_error');
      }
    }

    const results = [];

    try {
      // Check if there's a Google login test that's enabled
      const hasGoogleLoginTest = testCases.some(
        (test) => test.type === "google" && test.enabled
      );

      // Login with Google if necessary
      if (hasGoogleLoginTest) {
        const googleTest = testCases.find(
          (test) => test.type === "google" && test.enabled
        );
        
        // Create a result object for the Google login test
        const googleTestResult = {
          id: googleTest.id,
          name: googleTest.name,
          type: googleTest.type,
          status: "running",
          result: {
            timestamp: new Date().toISOString(),
            success: false,
            details: {},
          },
        };
        
        // Use the modular Google login implementation
        try {
          const loginSuccess = await executeGoogleLoginTest(page, websiteConfig, googleTestResult, __dirname);
          
          // Add the result to the results array
          googleTestResult.status = loginSuccess ? "passed" : "failed";
          googleTestResult.result.success = loginSuccess;
          results.push(googleTestResult);
          
          if (!loginSuccess) {
            console.log("Google login failed, aborting tests");
            throw new Error("Google login failed");
          }
        } catch (googleLoginError) {
          console.error("Google login error:", googleLoginError);
          googleTestResult.status = "failed";
          googleTestResult.result.success = false;
          googleTestResult.result.details.message = googleLoginError.message;
          results.push(googleTestResult);
          throw googleLoginError;
        }
      }

      // Process other test cases
      for (const test of testCases) {
        // Skip disabled tests and Google login test (already handled)
        if (!test.enabled || test.type === "google") continue;

        // Create a result object for the test
        const testResult = {
          id: test.id,
          name: test.name,
          type: test.type,
          status: "running",
          result: {
            timestamp: new Date().toISOString(),
            success: false,
            details: {},
          },
        };

        try {
          console.log(`Executing test: ${test.name} (${test.type})`);
          let testSuccess = false;

          // Execute the appropriate test based on type
          switch (test.type) {
            case "login":
              testSuccess = await executeLoginTest(page, websiteConfig, testResult, __dirname);
              break;
            case "logout":
              testSuccess = await executeLogoutTest(page, testResult, __dirname);
              break;
            case "formFill":
            case "form-fill":
              testSuccess = await executeFormFillTest(page, websiteConfig, test, testResult, __dirname);
              break;
            case "submitForm":
              testSuccess = await executeSubmitFormTest(page, websiteConfig, test, testResult, __dirname);
              break;
            default:
              console.log(`Unknown test type: ${test.type}`);
              testResult.result.details.message = `Unknown test type: ${test.type}`;
          }

          // Update the test result
          testResult.status = testSuccess ? "passed" : "failed";
          testResult.result.success = testSuccess;
          results.push(testResult);

        } catch (testError) {
          console.error(`Error executing test ${test.name}:`, testError);
          testResult.status = "failed";
          testResult.result.success = false;
          testResult.result.details.message = testError.message;
          results.push(testResult);
          
          // Take a screenshot for debugging
          try {
            await page.screenshot({
              path: path.join(__dirname, "results", `test_error_${test.id}_${getFormattedDate()}.png`),
            });
            console.log(`Screenshot saved for test error: ${test.id}`);
          } catch (screenshotError) {
            console.error("Error taking screenshot:", screenshotError);
          }
        }
      }
      
      // Return the results
      return res.json({
        success: true,
        results: results,
        browserOpen: global.activeBrowser !== null, // Selalu sertakan informasi status browser
      });
    } catch (error) {
      console.error("Error during test execution:", error);
      saveErrorToFile(error, 'run_tests_error');
      
      return res.status(500).json({
        success: false,
        message: "Error during test execution",
        error: error.message,
        results: results,
        browserOpen: global.activeBrowser !== null, // Selalu sertakan informasi status browser
      });
    }
  } finally {
    // Store the browser instance in global scope instead of closing it
    if (browser) {
      try {
        // Save browser to global scope so it can be closed manually via the Close Browser button
        global.activeBrowser = browser;
        console.log("Browser instance saved to global scope for manual closing");
      } catch (error) {
        console.error("Error saving browser instance:", error);
        // If there's an error, try to close the browser to prevent resource leaks
        try {
          await browser.close();
          console.log("Browser closed due to error");
        } catch (closeError) {
          console.error("Error closing browser:", closeError);
        }
      }
    }
  }
});

// Route untuk execute-test
router.post("/execute-test", async (req, res) => {
  const { websiteConfig, test } = req.body;

  if (!websiteConfig || !test) {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters",
    });
  }

  let browser;
  const testResult = {
    id: test.id,
    name: test.name,
    type: test.type,
    status: "running",
    result: {
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
    },
  };

  try {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: config.puppeteer.args,
      defaultViewport: config.puppeteer.defaultViewport,
    });

    const page = await browser.newPage();

    // Tambahkan listener untuk error navigasi
    page.on("requestfailed", (request) => {
      console.log(`Request failed: ${request.url()}`);
      const failure = request.failure();
      if (failure && failure.errorText) {
        console.log(`Reason: ${failure.errorText}`);
      } else {
        console.log("No error details available");
      }
    });

    // Cek apakah ada Basic Auth
    if (
      websiteConfig.hasBasicAuth &&
      websiteConfig.basicAuth &&
      websiteConfig.basicAuth.username &&
      websiteConfig.basicAuth.password
    ) {
      console.log("Menggunakan Basic Authentication");
      try {
        await page.authenticate({
          username: websiteConfig.basicAuth.username,
          password: websiteConfig.basicAuth.password,
        });
      } catch (authError) {
        console.error('Error saat setup basic authentication:', authError.message);
        saveErrorToFile(authError, 'execute_test_auth_setup_error');
      }
    }

    // Execute the appropriate test based on type
    let testSuccess = false;
    try {
      console.log(`Executing test: ${test.name} (${test.type})`);
      
      switch (test.type) {
        case "login":
          testSuccess = await executeLoginTest(page, websiteConfig, testResult, __dirname);
          break;
        case "logout":
          testSuccess = await executeLogoutTest(page, testResult, __dirname);
          break;
        case "formFill":
        case "form-fill":
          testSuccess = await executeFormFillTest(page, websiteConfig, test, testResult, __dirname);
          break;
        case "submitForm":
          testSuccess = await executeSubmitFormTest(page, websiteConfig, test, testResult, __dirname);
          break;
        case "google":
          testSuccess = await executeGoogleLoginTest(page, websiteConfig, testResult, __dirname);
          break;
        default:
          console.log(`Unknown test type: ${test.type}`);
          testResult.result.details.message = `Unknown test type: ${test.type}`;
      }

      // Update the test result
      testResult.status = testSuccess ? "passed" : "failed";
      testResult.result.success = testSuccess;
      
      // Return the result
      return res.json({
        success: true,
        result: testResult,
      });
    } catch (testError) {
      console.error(`Error executing test ${test.name}:`, testError);
      testResult.status = "failed";
      testResult.result.success = false;
      testResult.result.details.message = testError.message;
      
      // Take a screenshot for debugging
      try {
        await page.screenshot({
          path: path.join(__dirname, "results", `test_error_${test.id}_${getFormattedDate()}.png`),
        });
        console.log(`Screenshot saved for test error: ${test.id}`);
      } catch (screenshotError) {
        console.error("Error taking screenshot:", screenshotError);
      }
      
      return res.status(500).json({
        success: false,
        message: "Error executing test",
        error: testError.message,
        result: testResult,
      });
    }
  } catch (error) {
    console.error("Error during test execution:", error);
    saveErrorToFile(error, 'execute_test_error');
    
    return res.status(500).json({
      success: false,
      message: "Error during test execution",
      error: error.message,
      result: testResult,
    });
  } finally {
    // Store the browser instance in global scope instead of closing it
    if (browser) {
      try {
        // Save browser to global scope so it can be closed manually via the Close Browser button
        global.activeBrowser = browser;
        console.log("Browser instance saved to global scope for manual closing");
      } catch (error) {
        console.error("Error saving browser instance:", error);
        // If there's an error, try to close the browser to prevent resource leaks
        try {
          await browser.close();
          console.log("Browser closed due to error");
        } catch (closeError) {
          console.error("Error closing browser:", closeError);
        }
      }
    }
  }
});

// Route untuk close-browser
router.post("/close-browser", async (req, res) => {
  try {
    if (global.activeBrowser) {
      console.log("Menutup browser yang masih terbuka...");
      
      // Send a success response immediately to prevent the extension from hanging
      // This is important because the browser closing might terminate the connection
      res.json({
        success: true,
        message: "Browser sedang ditutup",
      });
      
      // Then proceed with browser cleanup and closing
      try {
        // Get all pages
        const pages = await global.activeBrowser.pages();
        
        // For each page, allow navigation before closing
        for (const page of pages) {
          try {
            // Execute allowNavigation function in page context to disable navigation prevention
            await page.evaluate(() => {
              if (window.allowNavigation) {
                window.allowNavigation();
              }
              // Also clear any beforeunload listeners
              window.onbeforeunload = null;
              // Remove all event listeners that might prevent navigation
              window.removeEventListener('beforeunload', () => {});
            });
            console.log("Navigation prevention disabled for page");
          } catch (pageError) {
            console.error("Error disabling navigation prevention:", pageError);
            // Continue with other pages even if this one fails
          }
        }
        
        // Now close the browser
        await global.activeBrowser.close();
        global.activeBrowser = null;
        console.log("Browser berhasil ditutup");
      } catch (innerError) {
        console.error("Error during browser cleanup:", innerError);
        // Even if there's an error, set the global browser to null
        global.activeBrowser = null;
      }
      
      // We've already sent the response, so we don't need to return anything here
    } else {
      return res.json({
        success: true,
        message: "Tidak ada browser yang perlu ditutup",
      });
    }
  } catch (error) {
    console.error("Error saat menutup browser:", error);
    return res.status(500).json({
      success: false,
      message: "Error saat menutup browser",
      error: error.message,
    });
  }
});

// Export the router
export default router;
