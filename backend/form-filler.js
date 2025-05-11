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
    
    // Special handling for project.k24.co.id
    if (url.includes('project.k24.co.id')) {
      // Try navigating to the main ticket page first
      await page.goto('https://project.k24.co.id/Ticket', { waitUntil: 'networkidle0' });
      await page.waitForTimeout(2000);
      
      // Look for create ticket button
      const foundCreateButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a, button'));
        const createButton = buttons.find(btn => 
          (btn.textContent.includes('Create') || 
           btn.textContent.includes('Buat') || 
           btn.textContent.includes('New') || 
           btn.textContent.includes('Baru')) && 
          (btn.href?.includes('/create') || btn.onclick)
        );
        
        if (createButton) {
          createButton.click();
          return true;
        }
        return false;
      });
      
      if (foundCreateButton) {
        console.log('Found and clicked create button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        await page.waitForTimeout(3000);
      }
    }
    
    // Generic handling for 404 pages
    if (has404) {
      console.log('Detected 404 page, trying alternative approach...');
      
      // Extract base URL and try navigating there
      const baseUrl = new URL(url).origin;
      console.log(`Navigating to base URL: ${baseUrl}`);
      
      // Try navigating to the site root
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
          return 'Test Ticket - ' + new Date().toLocaleString();
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
            
            // Special handling for project.k24.co.id
            let value = '';
            if (window.location.href.includes('project.k24.co.id')) {
              if (name.includes('Summary') || id.includes('Summary')) {
                value = 'Test Ticket - ' + new Date().toLocaleString();
              }
            }
            
            // If no special value set, use default
            if (!value) {
              value = getDefaultValue(input);
            }

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
            
            // Generate appropriate value based on field
            let value;
            
            // Check for common form fields by name/id patterns
            if (name.includes('Summary') || id.includes('Summary') ||
                name.includes('Title') || id.includes('Title') ||
                name.includes('Subject') || id.includes('Subject')) {
              value = 'Test Form - ' + new Date().toLocaleString();
            } else {
              // Use default value generator
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
            
            // Default value for textarea
            let value = 'This is a test message generated by the Form Fill Test. Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
            
            // Special handling for project.k24.co.id
            if (window.location.href.includes('project.k24.co.id')) {
              if (name.includes('Description') || id.includes('Description')) {
                value = 'Test Ticket Description - Created on ' + new Date().toLocaleString() + 
                      '\n\nThis is an automated test ticket created by the Form Fill Test.\n' +
                      'Please ignore this ticket as it is only for testing purposes.';
              }
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
            
            // Special handling for project.k24.co.id
            if (window.location.href.includes('project.k24.co.id')) {
              if (name.includes('Project') || id.includes('Project')) {
                // For Project field, select first valid option (not placeholder)
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
                  break;
                }
              } else if (name.includes('Status') || id.includes('Status')) {
                // For Status field, select "Active" or first valid status
                for (let i = 0; i < select.options.length; i++) {
                  const option = select.options[i];
                  const optionText = option.textContent.trim().toLowerCase();
                  
                  if (optionText.includes('active') || optionText.includes('aktif')) {
                    selectedIndex = i;
                    break;
                  }
                  
                  // If no "active", select first valid option
                  if (option.value && 
                      !optionText.includes('pilih') && 
                      !optionText.includes('select') && 
                      optionText !== '' && 
                      option.value !== '0' && 
                      option.value !== '-1' && 
                      selectedIndex === -1) {
                    selectedIndex = i;
                  }
                }
              }
            }
            
            // If no index selected yet, select first valid option
            if (selectedIndex === -1) {
              // Skip first option if it's a placeholder
              for (let i = 0; i < select.options.length; i++) {
                const option = select.options[i];
                const optionText = option.textContent.trim().toLowerCase();
                const optionValue = option.value;
                
                if (optionValue && 
                    !optionText.includes('pilih') && 
                    !optionText.includes('select') && 
                    optionText !== '' && 
                    optionValue !== '0' && 
                    optionValue !== '-1') {
                  selectedIndex = i;
                  break;
                }
              }
              
              // If still no valid option found, use second option if available
              if (selectedIndex === -1 && select.options.length > 1) {
                selectedIndex = 1;
              }
            }
            
            // Set selected option
            if (selectedIndex !== -1 && selectedIndex < select.options.length) {
              select.selectedIndex = selectedIndex;
              
              // Trigger change event
              select.dispatchEvent(new Event('change', { bubbles: true }));
              
              filledSelects.push({
                name: name || id,
                value: select.value,
                text: select.options[selectedIndex].textContent
              });
            }
          } catch (err) {
            console.error(`Error filling select: ${err.message}`);
          }
        });
        
        return filledSelects;
      };
      
      // Fill all form elements
      const inputResults = fillInputs();
      const textareaResults = fillTextareas();
      const selectResults = fillSelects();
      
      // Disable submit buttons
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], .btn-primary, .btn-submit, [class*="submit"], [class*="save"]');
      submitButtons.forEach(button => {
        button.disabled = true;
        button.setAttribute('data-test-mode', 'true');
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
      });
      
      return {
        inputs: inputResults,
        textareas: textareaResults,
        selects: selectResults,
        total: inputResults.length + textareaResults.length + selectResults.length
      };
    });
    
    return formFillResult;
  } catch (error) {
    console.error('Error in fillForm:', error);
    throw error;
  }
}

module.exports = {
  fillForm
};
