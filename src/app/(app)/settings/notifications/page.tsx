'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NotificationPreferencesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile page where notification preferences now live
    router.replace('/profile');
  }, [router]);

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
