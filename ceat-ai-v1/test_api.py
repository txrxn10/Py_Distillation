#!/usr/bin/env python3
"""
Simple test script to verify the image generation API endpoint works correctly.
"""

import requests
import json
import sys

def test_api_endpoint():
    """Test the image generation API endpoint"""
    
    # API configuration
    base_url = "http://localhost:5000"
    endpoint = "/api/image"
    url = f"{base_url}{endpoint}"
    
    # Test data
    test_request = {
        "prompt": "A beautiful sunset over mountains",
        "ratio": "16:9",
        "resolution": "1024x1024",
        "style": "realistic"
    }
    
    print("🧪 Testing Image Generation API")
    print("=" * 50)
    print(f"URL: {url}")
    print(f"Request: {json.dumps(test_request, indent=2)}")
    print()
    
    try:
        # Make POST request
        print("📡 Sending POST request...")
        response = requests.post(
            url,
            json=test_request,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print()
        
        # Parse response
        if response.headers.get('content-type', '').startswith('application/json'):
            data = response.json()
            print("📄 Response:")
            print(json.dumps(data, indent=2))
            
            # Validate response structure
            if response.status_code == 200:
                if data.get('success'):
                    images = data.get('images', [])
                    print(f"\n✅ Success! Generated {len(images)} images")
                    
                    # Check image format
                    for i, img in enumerate(images):
                        if img.startswith('data:image/'):
                            print(f"  Image {i+1}: Valid base64 data URL")
                        else:
                            print(f"  Image {i+1}: URL or path - {img[:50]}...")
                    
                    return True
                else:
                    print(f"\n❌ API returned error: {data.get('error', 'Unknown error')}")
                    return False
            else:
                print(f"\n❌ HTTP Error {response.status_code}")
                if 'error' in data:
                    print(f"Error: {data['error']}")
                return False
        else:
            print("❌ Response is not JSON")
            print(f"Content: {response.text[:200]}...")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to the API server")
        print("   Make sure the Flask server is running on http://localhost:5000")
        return False
    except requests.exceptions.Timeout:
        print("❌ Timeout: Request took too long")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request Error: {e}")
        return False
    except json.JSONDecodeError:
        print("❌ JSON Decode Error: Invalid JSON response")
        return False
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return False

def test_validation_errors():
    """Test API validation with invalid requests"""
    
    print("\n🔍 Testing Input Validation")
    print("=" * 50)
    
    base_url = "http://localhost:5000"
    endpoint = "/api/image"
    url = f"{base_url}{endpoint}"
    
    test_cases = [
        {
            "name": "Empty request",
            "data": {},
            "expected_status": 400
        },
        {
            "name": "Missing prompt",
            "data": {
                "ratio": "1:1",
                "resolution": "1024x1024", 
                "style": "realistic"
            },
            "expected_status": 400
        },
        {
            "name": "Invalid resolution format",
            "data": {
                "prompt": "test",
                "ratio": "1:1",
                "resolution": "invalid",
                "style": "realistic"
            },
            "expected_status": 400
        }
    ]
    
    all_passed = True
    
    for test_case in test_cases:
        print(f"\nTesting: {test_case['name']}")
        
        try:
            response = requests.post(
                url,
                json=test_case['data'],
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == test_case['expected_status']:
                print(f"✅ Correct status code: {response.status_code}")
            else:
                print(f"❌ Wrong status code: {response.status_code} (expected {test_case['expected_status']})")
                all_passed = False
                
            # Check error response format
            if response.status_code >= 400:
                data = response.json()
                if 'error' in data and 'success' in data and not data['success']:
                    print("✅ Proper error response format")
                else:
                    print("❌ Invalid error response format")
                    all_passed = False
                    
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            all_passed = False
    
    return all_passed

if __name__ == "__main__":
    print("🚀 Starting API Tests")
    print("Make sure the Flask server is running: python api/run.py")
    print()
    
    # Test main functionality
    success1 = test_api_endpoint()
    
    # Test validation
    success2 = test_validation_errors()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    if success1 and success2:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)