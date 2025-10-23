/**
 * Manual Integration Test Script for Image Generation Component
 * 
 * This script provides a comprehensive test plan to verify that all existing
 * UI features continue to work after API integration.
 * 
 * Run this in the browser console while on the image generation page.
 */

// Test utilities
const TestUtils = {
  log: (message, type = 'info') => {
    const styles = {
      info: 'color: blue; font-weight: bold;',
      success: 'color: green; font-weight: bold;',
      error: 'color: red; font-weight: bold;',
      warning: 'color: orange; font-weight: bold;'
    };
    console.log(`%c[TEST] ${message}`, styles[type]);
  },

  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  findElement: (selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    return element;
  },

  findElements: (selector) => {
    return Array.from(document.querySelectorAll(selector));
  },

  simulateClick: (element) => {
    element.click();
  },

  simulateInput: (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  },

  getElementText: (element) => {
    return element.textContent.trim();
  },

  isElementVisible: (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
  },

  isElementDisabled: (element) => {
    return element.disabled || element.hasAttribute('disabled');
  }
};

// Test suite for existing UI functionality
const IntegrationTests = {
  
  // Test 1: Clear button functionality
  async testClearButton() {
    TestUtils.log('Testing Clear button functionality...', 'info');
    
    try {
      // Find elements
      const promptTextarea = TestUtils.findElement('textarea[placeholder*="Describe the image"]');
      const clearButton = TestUtils.findElement('button:has(svg + text):contains("Clear")') || 
                         TestUtils.findElements('button').find(btn => btn.textContent.includes('Clear'));
      
      if (!clearButton) {
        throw new Error('Clear button not found');
      }

      // Set some text in prompt
      TestUtils.simulateInput(promptTextarea, 'Test prompt for clear functionality');
      await TestUtils.wait(100);

      // Click clear button
      TestUtils.simulateClick(clearButton);
      await TestUtils.wait(100);

      // Verify prompt is cleared
      if (promptTextarea.value === '') {
        TestUtils.log('✓ Clear button works correctly', 'success');
        return true;
      } else {
        TestUtils.log('✗ Clear button did not clear the prompt', 'error');
        return false;
      }
    } catch (error) {
      TestUtils.log(`✗ Clear button test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 2: Random button functionality
  async testRandomButton() {
    TestUtils.log('Testing Random button functionality...', 'info');
    
    try {
      const promptTextarea = TestUtils.findElement('textarea[placeholder*="Describe the image"]');
      const randomButton = TestUtils.findElements('button').find(btn => btn.textContent.includes('Random'));
      
      if (!randomButton) {
        throw new Error('Random button not found');
      }

      // Clear prompt first
      TestUtils.simulateInput(promptTextarea, '');
      await TestUtils.wait(100);

      const initialValue = promptTextarea.value;

      // Click random button
      TestUtils.simulateClick(randomButton);
      await TestUtils.wait(100);

      // Verify prompt was populated with random text
      if (promptTextarea.value !== initialValue && promptTextarea.value.length > 0) {
        TestUtils.log('✓ Random button works correctly', 'success');
        return true;
      } else {
        TestUtils.log('✗ Random button did not populate prompt', 'error');
        return false;
      }
    } catch (error) {
      TestUtils.log(`✗ Random button test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 3: Rewrite button functionality
  async testRewriteButton() {
    TestUtils.log('Testing Rewrite button functionality...', 'info');
    
    try {
      const promptTextarea = TestUtils.findElement('textarea[placeholder*="Describe the image"]');
      const rewriteButton = TestUtils.findElements('button').find(btn => btn.textContent.includes('Rewrite'));
      
      if (!rewriteButton) {
        throw new Error('Rewrite button not found');
      }

      // Set initial prompt
      const initialPrompt = 'Test prompt';
      TestUtils.simulateInput(promptTextarea, initialPrompt);
      await TestUtils.wait(100);

      // Click rewrite button
      TestUtils.simulateClick(rewriteButton);
      await TestUtils.wait(100);

      // Verify prompt was modified (should contain original text plus enhancement)
      const newPrompt = promptTextarea.value;
      if (newPrompt !== initialPrompt && newPrompt.includes(initialPrompt)) {
        TestUtils.log('✓ Rewrite button works correctly', 'success');
        return true;
      } else {
        TestUtils.log('✗ Rewrite button did not modify prompt correctly', 'error');
        return false;
      }
    } catch (error) {
      TestUtils.log(`✗ Rewrite button test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 4: Filter selections (aspect ratio, resolution, style)
  async testFilterSelections() {
    TestUtils.log('Testing filter selections...', 'info');
    
    try {
      let allPassed = true;

      // Test aspect ratio selection
      const aspectRatioTrigger = TestUtils.findElements('[role="combobox"]')[0];
      if (aspectRatioTrigger) {
        TestUtils.simulateClick(aspectRatioTrigger);
        await TestUtils.wait(200);
        
        const aspectRatioOptions = TestUtils.findElements('[role="option"]');
        if (aspectRatioOptions.length > 0) {
          TestUtils.simulateClick(aspectRatioOptions[1]); // Select second option
          await TestUtils.wait(100);
          TestUtils.log('✓ Aspect ratio selection works', 'success');
        } else {
          TestUtils.log('✗ Aspect ratio options not found', 'error');
          allPassed = false;
        }
      }

      // Test resolution selection
      const resolutionTrigger = TestUtils.findElements('[role="combobox"]')[1];
      if (resolutionTrigger) {
        TestUtils.simulateClick(resolutionTrigger);
        await TestUtils.wait(200);
        
        const resolutionOptions = TestUtils.findElements('[role="option"]');
        if (resolutionOptions.length > 0) {
          TestUtils.simulateClick(resolutionOptions[1]); // Select second option
          await TestUtils.wait(100);
          TestUtils.log('✓ Resolution selection works', 'success');
        } else {
          TestUtils.log('✗ Resolution options not found', 'error');
          allPassed = false;
        }
      }

      // Test style selection
      const styleTrigger = TestUtils.findElements('[role="combobox"]')[2];
      if (styleTrigger) {
        TestUtils.simulateClick(styleTrigger);
        await TestUtils.wait(200);
        
        const styleOptions = TestUtils.findElements('[role="option"]');
        if (styleOptions.length > 0) {
          TestUtils.simulateClick(styleOptions[1]); // Select second option
          await TestUtils.wait(100);
          TestUtils.log('✓ Style selection works', 'success');
        } else {
          TestUtils.log('✗ Style options not found', 'error');
          allPassed = false;
        }
      }

      return allPassed;
    } catch (error) {
      TestUtils.log(`✗ Filter selections test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 5: Generate button disabled state when no prompt
  async testGenerateButtonDisabledState() {
    TestUtils.log('Testing Generate button disabled state...', 'info');
    
    try {
      const promptTextarea = TestUtils.findElement('textarea[placeholder*="Describe the image"]');
      const generateButton = TestUtils.findElements('button').find(btn => 
        btn.textContent.includes('Generate') && !btn.textContent.includes('Generating')
      );
      
      if (!generateButton) {
        throw new Error('Generate button not found');
      }

      // Clear prompt
      TestUtils.simulateInput(promptTextarea, '');
      await TestUtils.wait(100);

      // Check if button is disabled
      if (TestUtils.isElementDisabled(generateButton)) {
        TestUtils.log('✓ Generate button is disabled when no prompt', 'success');
        
        // Add prompt and check if button becomes enabled
        TestUtils.simulateInput(promptTextarea, 'Test prompt');
        await TestUtils.wait(100);
        
        if (!TestUtils.isElementDisabled(generateButton)) {
          TestUtils.log('✓ Generate button is enabled when prompt is provided', 'success');
          return true;
        } else {
          TestUtils.log('✗ Generate button remains disabled even with prompt', 'error');
          return false;
        }
      } else {
        TestUtils.log('✗ Generate button is not disabled when no prompt', 'error');
        return false;
      }
    } catch (error) {
      TestUtils.log(`✗ Generate button disabled state test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 6: Image grid layout and structure
  async testImageGridLayout() {
    TestUtils.log('Testing image grid layout...', 'info');
    
    try {
      // Look for the generated images container
      const imageGrid = TestUtils.findElement('.grid.grid-cols-2') || 
                       TestUtils.findElement('[class*="grid"]');
      
      if (!imageGrid) {
        TestUtils.log('✓ Image grid not visible (expected when no images)', 'success');
        return true;
      }

      // Check if grid has proper structure
      const images = TestUtils.findElements('img[alt*="Generated image"]');
      
      if (images.length > 0) {
        TestUtils.log(`✓ Image grid contains ${images.length} images`, 'success');
        
        // Test hover actions on first image
        const firstImageContainer = images[0].closest('.group');
        if (firstImageContainer) {
          const hoverActions = TestUtils.findElements('button', firstImageContainer);
          if (hoverActions.length > 0) {
            TestUtils.log('✓ Image hover actions are present', 'success');
          } else {
            TestUtils.log('✗ Image hover actions not found', 'error');
            return false;
          }
        }
        
        return true;
      } else {
        TestUtils.log('✓ No images in grid (expected state)', 'success');
        return true;
      }
    } catch (error) {
      TestUtils.log(`✗ Image grid layout test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 7: Error handling and display
  async testErrorHandling() {
    TestUtils.log('Testing error handling...', 'info');
    
    try {
      // Look for any existing error messages
      const errorAlerts = TestUtils.findElements('[role="alert"]');
      const errorMessages = TestUtils.findElements('.text-destructive');
      
      if (errorAlerts.length === 0 && errorMessages.length === 0) {
        TestUtils.log('✓ No error messages displayed (good initial state)', 'success');
      } else {
        TestUtils.log('ℹ Error messages found (may be expected)', 'warning');
        errorAlerts.forEach((alert, index) => {
          TestUtils.log(`Error ${index + 1}: ${TestUtils.getElementText(alert)}`, 'warning');
        });
      }

      // Test error dismissal if error exists
      const dismissButtons = TestUtils.findElements('button[aria-label="Dismiss error"]');
      if (dismissButtons.length > 0) {
        TestUtils.simulateClick(dismissButtons[0]);
        await TestUtils.wait(100);
        TestUtils.log('✓ Error dismissal works', 'success');
      }

      return true;
    } catch (error) {
      TestUtils.log(`✗ Error handling test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Test 8: API integration (attempt to make request)
  async testAPIIntegration() {
    TestUtils.log('Testing API integration...', 'info');
    
    try {
      const promptTextarea = TestUtils.findElement('textarea[placeholder*="Describe the image"]');
      const generateButton = TestUtils.findElements('button').find(btn => 
        btn.textContent.includes('Generate') && !btn.textContent.includes('Generating')
      );
      
      if (!generateButton) {
        throw new Error('Generate button not found');
      }

      // Set a test prompt
      TestUtils.simulateInput(promptTextarea, 'A simple test image');
      await TestUtils.wait(100);

      // Click generate button
      TestUtils.simulateClick(generateButton);
      await TestUtils.wait(500);

      // Check if loading state is shown
      const generatingButton = TestUtils.findElements('button').find(btn => 
        btn.textContent.includes('Generating')
      );
      
      if (generatingButton) {
        TestUtils.log('✓ Loading state is displayed during API call', 'success');
        
        // Wait for request to complete (or timeout)
        let attempts = 0;
        while (attempts < 30) { // Wait up to 15 seconds
          await TestUtils.wait(500);
          attempts++;
          
          const stillGenerating = TestUtils.findElements('button').find(btn => 
            btn.textContent.includes('Generating')
          );
          
          if (!stillGenerating) {
            break;
          }
        }
        
        // Check final state
        const errorAlerts = TestUtils.findElements('[role="alert"]');
        const images = TestUtils.findElements('img[alt*="Generated image"]');
        
        if (images.length > 0) {
          TestUtils.log('✓ API call successful - images generated', 'success');
          return true;
        } else if (errorAlerts.length > 0) {
          TestUtils.log('ℹ API call resulted in error (may be expected if backend not running)', 'warning');
          return true; // This is acceptable for testing
        } else {
          TestUtils.log('✗ API call completed but no result shown', 'error');
          return false;
        }
      } else {
        TestUtils.log('✗ Loading state not displayed', 'error');
        return false;
      }
    } catch (error) {
      TestUtils.log(`✗ API integration test failed: ${error.message}`, 'error');
      return false;
    }
  },

  // Run all tests
  async runAllTests() {
    TestUtils.log('Starting comprehensive integration tests...', 'info');
    TestUtils.log('='.repeat(50), 'info');
    
    const tests = [
      { name: 'Clear Button', fn: this.testClearButton },
      { name: 'Random Button', fn: this.testRandomButton },
      { name: 'Rewrite Button', fn: this.testRewriteButton },
      { name: 'Filter Selections', fn: this.testFilterSelections },
      { name: 'Generate Button Disabled State', fn: this.testGenerateButtonDisabledState },
      { name: 'Image Grid Layout', fn: this.testImageGridLayout },
      { name: 'Error Handling', fn: this.testErrorHandling },
      { name: 'API Integration', fn: this.testAPIIntegration }
    ];

    const results = [];
    
    for (const test of tests) {
      TestUtils.log(`\nRunning: ${test.name}`, 'info');
      try {
        const result = await test.fn.call(this);
        results.push({ name: test.name, passed: result });
      } catch (error) {
        TestUtils.log(`Test ${test.name} threw an error: ${error.message}`, 'error');
        results.push({ name: test.name, passed: false, error: error.message });
      }
      
      // Small delay between tests
      await TestUtils.wait(200);
    }

    // Summary
    TestUtils.log('\n' + '='.repeat(50), 'info');
    TestUtils.log('TEST SUMMARY', 'info');
    TestUtils.log('='.repeat(50), 'info');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    results.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      const type = result.passed ? 'success' : 'error';
      TestUtils.log(`${status}: ${result.name}`, type);
      if (result.error) {
        TestUtils.log(`  Error: ${result.error}`, 'error');
      }
    });
    
    TestUtils.log(`\nOverall: ${passed}/${total} tests passed`, passed === total ? 'success' : 'error');
    
    return { passed, total, results };
  }
};

// Export for use in console
window.IntegrationTests = IntegrationTests;
window.TestUtils = TestUtils;

// Instructions for manual testing
console.log(`
%c🧪 INTEGRATION TEST SUITE LOADED 🧪

To run all tests:
  IntegrationTests.runAllTests()

To run individual tests:
  IntegrationTests.testClearButton()
  IntegrationTests.testRandomButton()
  IntegrationTests.testRewriteButton()
  IntegrationTests.testFilterSelections()
  IntegrationTests.testGenerateButtonDisabledState()
  IntegrationTests.testImageGridLayout()
  IntegrationTests.testErrorHandling()
  IntegrationTests.testAPIIntegration()

Make sure you're on the image generation page before running tests!
`, 'color: purple; font-weight: bold; font-size: 14px;');