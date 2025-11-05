'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function ExtensionAuthPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setLoading(false);

        // Try to communicate with extension
        notifyExtension(session.access_token, session.user);
      } else {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent('/auth/extension');
        router.push(`/login?returnUrl=${returnUrl}`);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setLoading(false);
        notifyExtension(session.access_token, session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const notifyExtension = (token: string, user: any) => {
    // Try to communicate with the extension via window.postMessage
    // This allows the extension to listen for auth success
    window.postMessage(
      {
        type: 'LEXYHUB_AUTH_SUCCESS',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email,
        },
      },
      window.location.origin
    );

    // Also store in localStorage as fallback
    try {
      localStorage.setItem('lexyhub_ext_token', token);
      localStorage.setItem('lexyhub_ext_user', JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email,
      }));
    } catch (err) {
      console.error('Failed to store auth data:', err);
    }
  };

  const copyToken = () => {
    if (session?.access_token) {
      navigator.clipboard.writeText(session.access_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <svg
                className="h-12 w-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Connected Successfully!
            </h1>
            <p className="mt-2 text-gray-600">
              Your LexyHub extension is now authenticated
            </p>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account:</span>
              <span className="text-sm font-medium text-gray-900">
                {user?.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
          </div>

          {/* Extension Boost Badge */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 text-white">
            <div className="flex items-center space-x-2">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <div className="flex-1">
                <div className="font-semibold text-sm">Extension Boost Active</div>
                <div className="text-xs text-indigo-100">
                  25 searches/month • 3 niches • 8 AI opportunities
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Next Steps:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Return to your browser</li>
                <li>Click the LexyHub extension icon</li>
                <li>Start browsing Etsy, Amazon, or Shopify!</li>
              </ol>
            </div>

            {/* Manual Token Copy (fallback) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium">
                Manual setup (if needed)
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-gray-600 text-xs">
                  If the extension didn't automatically connect, copy this token:
                </p>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={session?.access_token || ''}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 font-mono"
                  />
                  <button
                    onClick={copyToken}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* Close Button */}
          <button
            onClick={() => window.close()}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Close This Tab
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <a
            href="https://docs.lexyhub.com/extension"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
          >
            Extension Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
