'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type WatchlistItem = {
  id: string;
  addedAt: string;
  keyword?: {
    id: string;
    term: string;
  } | null;
};

type Watchlist = {
  id: string;
  name: string;
  items: WatchlistItem[];
};

export function WatchlistIndicator() {
  const user = useUser();
  const router = useRouter();
  const [keywordCount, setKeywordCount] = useState(0);

  const fetchWatchlistCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/watchlists?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const watchlists: Watchlist[] = data.watchlists || [];

        // Count only keyword items (not listing items)
        const totalKeywords = watchlists.reduce((total, watchlist) => {
          const keywordItems = watchlist.items.filter(item => item.keyword !== null);
          return total + keywordItems.length;
        }, 0);

        setKeywordCount(totalKeywords);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist count:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Fetch watchlist count
    fetchWatchlistCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchWatchlistCount, 30000);

    return () => clearInterval(interval);
  }, [user?.id, fetchWatchlistCount]);

  const handleClick = () => {
    router.push('/watchlists');
  };

  if (!user?.id) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label="View watchlist"
            className="relative"
          >
            <Star className="h-5 w-5" />
            {keywordCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {keywordCount > 9 ? '9+' : keywordCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {keywordCount === 0
              ? 'No favourite keywords in watchlist'
              : keywordCount === 1
              ? '1 favourite keyword in watchlist'
              : `${keywordCount} favourite keywords in watchlist`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
