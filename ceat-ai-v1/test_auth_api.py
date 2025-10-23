#!/usr/bin/env python3
"""
Test script for the authentication API endpoints
"""

import requests
import json

API_BASE_URL = "http://localhost:5000/api"

def test_register():
    """Test user registration"""
    print("Testing user registration...")
    
    user_data = {
        "firstName": "John",
        "lastName": "Doe", 
        "email": "john.doe@example.com",
        "password": "TestPassword123"
    }
    
    try:
        response = requests.post(f"{API_BASE_URL}/auth/register", json=user_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 201:
            return response.json().get('access_token')
        else:
            print("Registration failed")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_login():
    """Test user login"""
    print("\nTesting user login...")
    
    login_data = {
        "email": "john.doe@example.com",
        "password": "TestPassword123"
    }
    
    try:
        response = requests.post(f"{API_BASE_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            print("Login failed")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_profile(token):
    """Test getting user profile"""
    print("\nTesting get profile...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{API_BASE_URL}/auth/profile", headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")

def main():
    print("Starting authentication API tests...")
    print("Make sure the Flask API is running on http://localhost:5000")
    print("-" * 50)
    
    # Test registration
    token = test_register()
    
    if not token:
        # If registration fails (user might already exist), try login
        token = test_login()
    
    if token:
        # Test profile endpoint
        test_profile(token)
    else:
        print("Could not obtain access token")

if __name__ == "__main__":
    main()