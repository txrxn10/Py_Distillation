'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useNavigation } from '@/contexts/NavigationContext';
import React from 'react';

interface LoadingLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LoadingLink({ href, children, className, onClick }: LoadingLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setIsNavigating } = useNavigation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Don't show loading if we're already on the target page
    if (pathname === href) {
      return;
    }

    // Show loading state
    setIsNavigating(true);
    
    // Call custom onClick if provided
    if (onClick) {
      onClick();
    }

    // Prevent default link behavior
    e.preventDefault();
    
    // Navigate programmatically
    router.push(href);
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}