#!/usr/bin/env python3
"""
Simple test to check if the API is accessible
"""

import requests
import time

def test_api_health():
    """Test if the API is running and accessible"""
    api_url = "http://localhost:5000/api/health"
    
    print("Testing API health...")
    print(f"URL: {api_url}")
    
    try:
        response = requests.get(api_url, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ API is healthy!")
            return True
        else:
            print("❌ API returned non-200 status")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection refused - API might not be running")
        return False
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_cors():
    """Test CORS configuration"""
    api_url = "http://localhost:5000/api/test-cors"
    
    print("\nTesting CORS...")
    print(f"URL: {api_url}")
    
    headers = {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test OPTIONS request (preflight)
        response = requests.options(api_url, headers=headers, timeout=10)
        print(f"OPTIONS Status Code: {response.status_code}")
        print(f"CORS Headers: {dict(response.headers)}")
        
        # Test POST request
        response = requests.post(api_url, headers=headers, json={}, timeout=10)
        print(f"POST Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        return True
        
    except Exception as e:
        print(f"❌ CORS test error: {e}")
        return False

def main():
    print("API Health Check")
    print("=" * 30)
    
    # Wait a moment for API to start
    print("Waiting for API to start...")
    time.sleep(2)
    
    # Test basic health
    health_ok = test_api_health()
    
    if health_ok:
        # Test CORS
        test_cors()
    else:
        print("\n❌ API is not accessible. Check if Docker containers are running:")
        print("   docker compose ps")
        print("   docker compose logs api")

if __name__ == "__main__":
    main()