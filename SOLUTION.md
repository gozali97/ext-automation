# Solution for Removing project.k24.co.id References and Using Test-specific URLs

This document provides a step-by-step solution to remove the project.k24.co.id specific code and make the automation system use test-specific URLs instead.

## 1. Create a New Form Filler Module

Create a new file named `form-filler-new.js` in the backend directory with the following content:

```javascript
/**
 * Form Filler Module - Handles form filling for the automation system
 */

// Helper function to get formatted date
function getFormattedDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

// Main form filling function
async function fillForm(page, url) {
  try {
    console.log(`Navigating to form URL: ${url}`);
    
    // Navigate to the form URL
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    console.log(`Successfully navigated to: ${await page.url()}`);
    
    // Wait to ensure page is fully loaded
    await page.waitForTimeout(3000);
    
    // Check for 404 error page
    const has404 = await page.evaluate(() => {
      // Check for 404 image or text
      const has404Image = !!document.querySelector('img[src*="404"]');
      const pageText = document.body.innerText;
      const has404Text = pageText.includes('404') && 
                         (pageText.includes('not found') || 
                          pageText.includes('tidak ditemukan'));
      
      // Check for error elements
      const errorElements = document.querySelectorAll('.error, .not-found, [class*="error"], [class*="404"]');
      
      return has404Image || has404Text || errorElements.length > 0;
    });
    
    // Generic handling for 404 pages
    if (has404) {
      console.log('Detected 404 page, trying alternative approach...');
      
      // Extract base URL and try navigating there
      const baseUrl = new URL(url).origin;
      console.log(`Navigating to base URL: ${baseUrl}`);
      
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });
      await page.waitForTimeout(2000);
      
      // Look for create/new buttons or links
      const foundCreateButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a, button'));
        const createButton = buttons.find(btn => 
          (btn.textContent.includes('Create') || 
           btn.textContent.includes('Buat') || 
           btn.textContent.includes('New') || 
           btn.textContent.includes('Baru') ||
           btn.textContent.includes('Add') ||
           btn.textContent.includes('Tambah')) && 
          (btn.href?.includes('/create') || 
           btn.href?.includes('/new') || 
           btn.href?.includes('/add') || 
           btn.onclick)
        );
        
        if (createButton) {
          createButton.click();
          return true;
        }
        return false;
      });
      
      if (foundCreateButton) {
        console.log('Found and clicked create/new button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    
    // Prevent form submission and navigation
    await page.evaluate(() => {
      // Override form submit
      const originalSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function() {
        console.log('Form submission prevented');
        // Don't call originalSubmit to prevent navigation
      };
      
      // Prevent button clicks
      document.addEventListener('click', function(e) {
        if (e.target.type === 'submit' || 
            e.target.tagName === 'BUTTON' || 
            e.target.classList.contains('btn') || 
            e.target.classList.contains('button')) {
          console.log('Button click prevented');
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
      
      // Prevent navigation
      const originalAssign = window.location.assign;
      const originalReplace = window.location.replace;
      const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');
      
      window.location.assign = function(url) {
        console.log('Navigation prevented:', url);
        return false;
      };
      
      window.location.replace = function(url) {
        console.log('Navigation replacement prevented:', url);
        return false;
      };
      
      if (originalHref && originalHref.set) {
        Object.defineProperty(window.location, 'href', {
          set: function(value) {
            console.log('Setting location.href prevented:', value);
            return false;
          },
          get: originalHref.get
        });
      }
      
      // Prevent page unload
      window.onbeforeunload = function(e) {
        console.log('Page unload prevented');
        e.preventDefault();
        e.returnValue = '';
        return '';
      };
      
      // Hide 404 elements if any
      const img404 = document.querySelector('img[src*="404"]');
      if (img404) {
        console.log('Removing 404 image');
        img404.style.display = 'none';
        
        // Try to hide parent elements that might be 404 containers
        let parent = img404.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          if (parent.classList.contains('error') || 
              parent.classList.contains('not-found') || 
              parent.innerHTML.includes('404')) {
            parent.style.display = 'none';
          }
          parent = parent.parentElement;
        }
      }
    });
    
    // Fill the form
    const formFillResult = await page.evaluate(() => {
      // Helper function to get default value based on input type and attributes
      const getDefaultValue = (input) => {
        const type = input.type?.toLowerCase() || '';
        const name = input.name || '';
        const id = input.id || '';
        const placeholder = input.placeholder || '';
        
        // Handle date fields
        if (type === 'date' || name.includes('date') || id.includes('date')) {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } 
        // Handle email fields
        else if (type === 'email' || name.includes('email') || id.includes('email')) {
          return 'test@example.com';
        } 
        // Handle password fields
        else if (type === 'password' || name.includes('pass') || id.includes('pass')) {
          return 'Password123!';
        } 
        // Handle name fields
        else if (name.includes('name') || id.includes('name')) {
          return 'Test User';
        } 
        // Handle phone fields
        else if (name.includes('phone') || id.includes('phone') || name.includes('telp') || id.includes('telp')) {
          return '08123456789';
        } 
        // Handle address fields
        else if (name.includes('address') || id.includes('address')) {
          return 'Test Address 123';
        } 
        // Handle summary/subject fields
        else if (name.includes('summary') || id.includes('summary') || name.includes('subject') || id.includes('subject')) {
          return 'Test Form - ' + new Date().toLocaleString();
        }
        // Default for text fields
        else {
          return 'Test Value ' + Math.floor(Math.random() * 1000);
        }
      };
      
      // Fill input fields
      const fillInputs = () => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"])'))
          .filter(input => {
            // Only visible inputs
            const style = window.getComputedStyle(input);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   input.offsetWidth > 0 &&
                   input.offsetHeight > 0;
          });
        
        console.log(`Found ${inputs.length} input fields`);
        
        const filledInputs = [];
        inputs.forEach(input => {
          try {
            const type = input.type?.toLowerCase() || '';
            const name = input.name || '';
            const id = input.id || '';
            
            // Determine the most appropriate value based on field type and name
            let value = '';
            
            // Check for common form fields by name/id patterns
            if (name.includes('Summary') || id.includes('Summary') || 
                name.includes('Title') || id.includes('Title') ||
                name.includes('Subject') || id.includes('Subject')) {
              value = 'Test Form - ' + new Date().toLocaleString();
            } else {
              // Use default value generator for other fields
              value = getDefaultValue(input);
            }
            
            // Set value based on input type
            if (type === 'checkbox' || type === 'radio') {
              if (!input.checked) {
                input.checked = true;
                input.click();
              }
            } else {
              input.value = value;
              // Trigger events for React/Vue
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            filledInputs.push({
              type: type,
              name: name || id,
              value: input.value || value
            });
          } catch (err) {
            console.error(`Error filling input: ${err.message}`);
          }
        });
        
        return filledInputs;
      };
      
      // Fill textarea fields
      const fillTextareas = () => {
        const textareas = Array.from(document.querySelectorAll('textarea'))
          .filter(textarea => {
            // Only visible textareas
            const style = window.getComputedStyle(textarea);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   textarea.offsetWidth > 0 &&
                   textarea.offsetHeight > 0;
          });
        
        console.log(`Found ${textareas.length} textarea fields`);
        
        const filledTextareas = [];
        textareas.forEach(textarea => {
          try {
            const name = textarea.name || '';
            const id = textarea.id || '';
            
            // Generate appropriate value based on field name/id
            let value;
            
            if (name.includes('Description') || id.includes('Description')) {
              value = 'Test Description - Created on ' + new Date().toLocaleString() + 
                    '\n\nThis is an automated test created by the Form Fill Test.\n' +
                    'Please ignore this as it is only for testing purposes.';
            } else {
              // Default value for textarea
              value = 'This is a test message generated by the Form Fill Test. Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
            }
            
            // Set value
            textarea.value = value;
            
            // Trigger events for React/Vue
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            
            filledTextareas.push({
              name: name || id,
              value: value
            });
          } catch (err) {
            console.error(`Error filling textarea: ${err.message}`);
          }
        });
        
        return filledTextareas;
      };
      
      // Fill select fields
      const fillSelects = () => {
        const selects = Array.from(document.querySelectorAll('select'))
          .filter(select => {
            // Only visible selects
            const style = window.getComputedStyle(select);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   select.offsetWidth > 0 &&
                   select.offsetHeight > 0;
          });
        
        console.log(`Found ${selects.length} select fields`);
        
        const filledSelects = [];
        selects.forEach(select => {
          try {
            const name = select.name || '';
            const id = select.id || '';
            
            // Skip if no options
            if (select.options.length <= 1) {
              console.log(`Select ${name || id} has no valid options`);
              return;
            }
            
            let selectedIndex = -1;
            let selectedOption = null;
            
            // Find appropriate option to select based on field name/id
            if (name.includes('Status') || id.includes('Status')) {
              // For Status field, try to select "Active" or similar value
              for (let i = 0; i < select.options.length; i++) {
                const option = select.options[i];
                const optionText = option.textContent.trim().toLowerCase();
                
                if (optionText.includes('active') || optionText.includes('aktif')) {
                  selectedIndex = i;
                  selectedOption = option;
                  break;
                }
              }
            }
            
            // If no index selected yet, select first valid option (skipping placeholders)
            if (selectedIndex === -1) {
              for (let i = 0; i < select.options.length; i++) {
                const option = select.options[i];
                const optionText = option.textContent.trim().toLowerCase();
                const optionValue = option.value;
                
                // Skip empty or placeholder options
                if (!optionValue || 
                    optionText.includes('pilih') || 
                    optionText.includes('select') || 
                    optionText === '' || 
                    optionValue === '0' || 
                    optionValue === '-1') {
                  continue;
                }
                
                selectedIndex = i;
                selectedOption = option;
                break;
              }
            }
            
            // If still no option found, just use the first one
            if (selectedIndex === -1 && select.options.length > 0) {
              selectedIndex = 0;
              selectedOption = select.options[0];
            }
            
            // Set the selected option
            if (selectedIndex !== -1) {
              select.selectedIndex = selectedIndex;
              
              // Trigger events
              select.dispatchEvent(new Event('change', { bubbles: true }));
              
              filledSelects.push({
                name: name || id,
                value: selectedOption ? selectedOption.textContent : '',
                valueAttr: selectedOption ? selectedOption.value : ''
              });
            }
          } catch (err) {
            console.error(`Error filling select: ${err.message}`);
          }
        });
        
        return filledSelects;
      };
      
      // Execute the fill functions
      const inputs = fillInputs();
      const textareas = fillTextareas();
      const selects = fillSelects();
      
      return {
        inputs,
        textareas,
        selects,
        total: inputs.length + textareas.length + selects.length
      };
    });
    
    console.log(`Form filled with ${formFillResult.total} fields`);
    console.log(`- Inputs: ${formFillResult.inputs.length}`);
    console.log(`- Textareas: ${formFillResult.textareas.length}`);
    console.log(`- Selects: ${formFillResult.selects.length}`);
    
    // Take a screenshot of the filled form
    await page.screenshot({
      path: `./results/form_filled_${getFormattedDate()}.png`,
      fullPage: true
    });
    
    return {
      success: true,
      formUrl: url,
      currentUrl: page.url(),
      filled: formFillResult
    };
  } catch (error) {
    console.error('Error in form filling:', error);
    
    // Try to take error screenshot
    try {
      await page.screenshot({
        path: `./results/form_error_${getFormattedDate()}.png`,
        fullPage: true
      });
    } catch (screenshotError) {
      console.error('Failed to take error screenshot:', screenshotError);
    }
    
    return {
      success: false,
      formUrl: url,
      currentUrl: page.url ? page.url() : null,
      error: error.message
    };
  }
}

module.exports = { fillForm };
```

## 2. Update Login Detection Logic in routes.js

For each login detection function in routes.js, follow these steps:

1. Find the `hasK24Elements` function
2. Replace it with a generic `hasDashboardElements` function (which is already there in most cases)
3. Remove `hasK24Elements` from the return statement

Example of a login success check to update:

```javascript
// Find this in routes.js (line 820, 1736, 2471, and 4398)
return (
  urlContainsDashboard ||
  hasLogoutElement ||
  hasK24Elements ||
  hasDashboardElements ||
  (urlChanged && !currentUrl.includes("login"))
);

// Replace with:
return (
  urlContainsDashboard ||
  hasLogoutElement ||
  hasDashboardElements ||
  (urlChanged && !currentUrl.includes("login"))
);
```

## 3. Update routes.js to Use the New Form Filler

Change the import statement at the top of routes.js:

```javascript
// From:
const { fillForm } = require("./form-filler");

// To:
const { fillForm } = require("./form-filler-new");
```

## 4. Remove K24-specific Code in Form Navigation

Find and replace sections like:

```javascript
// Khusus untuk project.k24.co.id - coba pendekatan lain jika masih menampilkan 404
if (test.config.formUrl.includes('project.k24.co.id')) {
  // ...specific K24 code...
  await page.goto('https://project.k24.co.id/Ticket', { waitUntil: 'networkidle0' });
  // ...more K24 code...
}
```

Replace with:

```javascript
// Generic handling for 404 pages
if (await page.evaluate(() => {
  return !!document.querySelector('img[src*="404"]') || 
         document.body.innerText.includes('404');
})) {
  console.log('Detected 404 page, trying alternative approach...');
  
  // Extract base URL and try navigating to root
  const baseUrl = new URL(test.config.targetUrl || test.config.formUrl).origin;
  console.log(`Navigating to base URL: ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000);
  
  // Look for generic create buttons
  // ... rest of the code finding create buttons ...
}
```

## 5. Consistently Use Test-Specific Target URLs

Ensure that all code in routes.js prioritizes using test.config.targetUrl:

```javascript
// Example for a login test
const targetUrl = loginTest.config?.targetUrl || websiteConfig.loginUrl || websiteConfig.url;

// Example for a form-fill test
const formUrl = test.config.targetUrl || test.config.formUrl || websiteConfig.url;
```

## 6. Testing the Changes

1. Rename form-filler.js to form-filler-old.js (for backup)
2. Rename form-filler-new.js to form-filler.js
3. Test the automation against different websites to ensure it now works generically without any specific K24 code
4. Ensure the targetUrl from test cases is being respected

## Conclusion

By implementing these changes, the backend automation system will now:

1. Be completely generic without specific domain handling for project.k24.co.id
2. Use the test case's targetUrl property whenever available
3. Have better fallback handling for 404 pages and common UI patterns
4. Properly detect login success and dashboards in a domain-agnostic way 