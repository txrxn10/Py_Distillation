'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/login-form';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is already logged in, redirect to image generation
  if (user) {
    router.push('/image');
    return null;
  }

  // Show login form for unauthenticated users
  return <LoginForm />;
}
