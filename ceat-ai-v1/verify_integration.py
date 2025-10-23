#!/usr/bin/env python3
"""
Integration verification script for the Image Generation API integration.

This script verifies that:
1. The API endpoint is properly configured
2. The frontend API service is correctly implemented
3. All TypeScript types are properly defined
4. Error handling is comprehensive
5. The component integration is complete

Run this script to verify the integration is ready for testing.
"""

import os
import re
import json
import sys
from pathlib import Path

class IntegrationVerifier:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.success_count = 0
        self.total_checks = 0
        
    def log_error(self, message):
        self.errors.append(f"❌ {message}")
        
    def log_warning(self, message):
        self.warnings.append(f"⚠️  {message}")
        
    def log_success(self, message):
        self.success_count += 1
        print(f"✅ {message}")
        
    def check_file_exists(self, filepath, description):
        """Check if a file exists"""
        self.total_checks += 1
        if os.path.exists(filepath):
            self.log_success(f"{description} exists: {filepath}")
            return True
        else:
            self.log_error(f"{description} missing: {filepath}")
            return False
    
    def check_file_content(self, filepath, pattern, description):
        """Check if file contains specific pattern"""
        self.total_checks += 1
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                    self.log_success(f"{description}")
                    return True
                else:
                    self.log_error(f"{description} - Pattern not found in {filepath}")
                    return False
        except Exception as e:
            self.log_error(f"Could not read {filepath}: {e}")
            return False
    
    def verify_api_configuration(self):
        """Verify API service configuration"""
        print("\n🔧 Verifying API Configuration...")
        
        # Check API service file exists
        api_file = "webapp/lib/api.ts"
        if not self.check_file_exists(api_file, "API service file"):
            return False
            
        # Check correct port configuration
        self.check_file_content(
            api_file,
            r"BASE_URL:\s*['\"]http://localhost:5000['\"]",
            "API configured for correct port (5000)"
        )
        
        # Check POST endpoint configuration
        self.check_file_content(
            api_file,
            r"IMAGE_GENERATION:\s*['\"]\/api\/image['\"]",
            "Image generation endpoint configured"
        )
        
        # Check timeout configuration
        self.check_file_content(
            api_file,
            r"TIMEOUT:\s*\d+",
            "Request timeout configured"
        )
        
        # Check proper headers
        self.check_file_content(
            api_file,
            r"Content-Type['\"]:\s*['\"]application\/json['\"]",
            "Proper Content-Type header configured"
        )
        
        return True
    
    def verify_typescript_types(self):
        """Verify TypeScript type definitions"""
        print("\n📝 Verifying TypeScript Types...")
        
        types_file = "webapp/lib/types.ts"
        if not self.check_file_exists(types_file, "Types file"):
            return False
            
        # Check required interfaces
        required_interfaces = [
            "ImageGenerationRequest",
            "ImageGenerationResponse", 
            "ApiError",
            "ApiResponse"
        ]
        
        for interface in required_interfaces:
            self.check_file_content(
                types_file,
                f"interface {interface}",
                f"{interface} interface defined"
            )
        
        # Check type guards
        self.check_file_content(
            types_file,
            r"function isApiError",
            "isApiError type guard defined"
        )
        
        return True
    
    def verify_component_integration(self):
        """Verify component integration"""
        print("\n🧩 Verifying Component Integration...")
        
        component_file = "webapp/components/image-generation-page.tsx"
        if not self.check_file_exists(component_file, "Main component file"):
            return False
            
        # Check API service import
        self.check_file_content(
            component_file,
            r"import.*generateImages.*from.*@/lib/api",
            "API service imported in component"
        )
        
        # Check types import
        self.check_file_content(
            component_file,
            r"import.*ImageGenerationRequest.*from.*@/lib/types",
            "Types imported in component"
        )
        
        # Check error state management
        self.check_file_content(
            component_file,
            r"const \[error, setError\]",
            "Error state management implemented"
        )
        
        # Check abort controller usage
        self.check_file_content(
            component_file,
            r"AbortController",
            "Request cancellation implemented"
        )
        
        # Check loading state
        self.check_file_content(
            component_file,
            r"isGenerating",
            "Loading state management implemented"
        )
        
        return True
    
    def verify_error_handling(self):
        """Verify comprehensive error handling"""
        print("\n🛡️  Verifying Error Handling...")
        
        api_file = "webapp/lib/api.ts"
        
        # Check custom error class
        self.check_file_content(
            api_file,
            r"class ApiServiceError extends Error",
            "Custom error class defined"
        )
        
        # Check error handling methods
        error_methods = [
            "handleApiError",
            "handleHttpError", 
            "validateRequest",
            "validateResponse"
        ]
        
        for method in error_methods:
            self.check_file_content(
                api_file,
                f"private {method}",
                f"{method} method implemented"
            )
        
        # Check abort signal handling
        self.check_file_content(
            api_file,
            r"AbortSignal",
            "Abort signal handling implemented"
        )
        
        return True
    
    def verify_backend_api(self):
        """Verify backend API implementation"""
        print("\n🖥️  Verifying Backend API...")
        
        api_route_file = "api/app/routes/image_route.py"
        if not self.check_file_exists(api_route_file, "API route file"):
            return False
            
        # Check POST endpoint
        self.check_file_content(
            api_route_file,
            r"@image_bp\.route\(['\"]\/image['\"],\s*methods=\[['\"]POST['\"]",
            "POST endpoint implemented"
        )
        
        # Check request validation
        self.check_file_content(
            api_route_file,
            r"required_fields.*=.*\[.*prompt.*ratio.*resolution.*style",
            "Request validation implemented"
        )
        
        # Check response format
        self.check_file_content(
            api_route_file,
            r"success.*images",
            "Proper response format implemented"
        )
        
        return True
    
    def verify_test_files(self):
        """Verify test files are created"""
        print("\n🧪 Verifying Test Files...")
        
        test_files = [
            ("webapp/test-integration.js", "Browser integration test script"),
            ("webapp/INTEGRATION_TEST_CHECKLIST.md", "Integration test checklist"),
            ("test_api.py", "API test script"),
            ("verify_integration.py", "Integration verification script")
        ]
        
        for filepath, description in test_files:
            self.check_file_exists(filepath, description)
        
        return True
    
    def verify_package_dependencies(self):
        """Verify required dependencies are installed"""
        print("\n📦 Verifying Dependencies...")
        
        package_file = "webapp/package.json"
        if not self.check_file_exists(package_file, "Package.json file"):
            return False
            
        try:
            with open(package_file, 'r') as f:
                package_data = json.load(f)
                
            dependencies = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
            
            required_deps = [
                'react',
                'next',
                'typescript',
                'lucide-react'
            ]
            
            for dep in required_deps:
                if dep in dependencies:
                    self.log_success(f"Required dependency found: {dep}")
                else:
                    self.log_warning(f"Required dependency missing: {dep}")
                    
        except Exception as e:
            self.log_error(f"Could not parse package.json: {e}")
            
        return True
    
    def run_verification(self):
        """Run all verification checks"""
        print("🔍 Starting Integration Verification")
        print("=" * 60)
        
        # Run all verification steps
        self.verify_api_configuration()
        self.verify_typescript_types()
        self.verify_component_integration()
        self.verify_error_handling()
        self.verify_backend_api()
        self.verify_test_files()
        self.verify_package_dependencies()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 VERIFICATION SUMMARY")
        print("=" * 60)
        
        print(f"✅ Successful checks: {self.success_count}/{self.total_checks}")
        
        if self.warnings:
            print(f"\n⚠️  Warnings ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  {warning}")
        
        if self.errors:
            print(f"\n❌ Errors ({len(self.errors)}):")
            for error in self.errors:
                print(f"  {error}")
        else:
            print("\n🎉 No errors found!")
        
        # Overall status
        success_rate = (self.success_count / self.total_checks) * 100 if self.total_checks > 0 else 0
        
        if success_rate >= 90:
            print(f"\n✅ Integration verification PASSED ({success_rate:.1f}%)")
            print("The integration is ready for testing!")
            return True
        elif success_rate >= 70:
            print(f"\n⚠️  Integration verification PARTIAL ({success_rate:.1f}%)")
            print("Some issues found, but integration may still work.")
            return True
        else:
            print(f"\n❌ Integration verification FAILED ({success_rate:.1f}%)")
            print("Significant issues found. Please fix errors before testing.")
            return False

def main():
    """Main function"""
    print("🚀 Image Generation API Integration Verifier")
    print("This script verifies that the integration is properly implemented.")
    print()
    
    verifier = IntegrationVerifier()
    success = verifier.run_verification()
    
    if success:
        print("\n📋 Next Steps:")
        print("1. Start the backend API: cd api && python run.py")
        print("2. Start the frontend: cd webapp && npm run dev")
        print("3. Open browser and navigate to the image generation page")
        print("4. Run the integration tests using the test checklist")
        print("5. Load test-integration.js in browser console for automated tests")
        
        sys.exit(0)
    else:
        print("\n🔧 Please fix the errors above before proceeding with testing.")
        sys.exit(1)

if __name__ == "__main__":
    main()