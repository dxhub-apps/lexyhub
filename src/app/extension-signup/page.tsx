'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Extension Signup Redirect Page
 *
 * This page redirects to /auth/extension with proper query parameters
 * It's used by the Chrome Extension v4 as the signup entry point
 *
 * URL: https://lexyhub.com/extension-signup?ref=chrome
 */
function RedirectComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve any query parameters
    const params = new URLSearchParams(searchParams.toString());
    const queryString = params.toString();

    // Redirect to auth/extension
    const targetUrl = queryString
      ? `/auth/extension?${queryString}`
      : '/auth/extension';

    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Setting up your extension...</p>
      </div>
    </div>
  );
}

export default function ExtensionSignupRedirect() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <RedirectComponent />
    </Suspense>
  );
}
