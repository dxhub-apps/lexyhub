"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useToast } from "@/components/ui/ToastProvider";

type WatchlistItem = {
  id: string;
  addedAt: string;
  label: string;
  context?: string;
  type: "keyword" | "listing";
  url?: string | null;
};

type Watchlist = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  items: WatchlistItem[];
};

export default function WatchlistsPage(): JSX.Element {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  const loadWatchlists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/watchlists");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Unable to load watchlists (${response.status})`);
      }

      const payload = (await response.json()) as { watchlists?: any[] };
      const normalized = (payload.watchlists ?? []).map((watchlist) => {
        const items = (watchlist.items ?? []).map((item: any) => {
          const isKeyword = Boolean(item.keyword?.term);
          const label = isKeyword
            ? String(item.keyword.term ?? "")
            : String(item.listing?.title ?? item.listing?.id ?? "Listing");
          const context = isKeyword
            ? String(item.keyword.market ?? "").toUpperCase()
            : item.listing?.id
              ? String(item.listing.id)
              : "Listing";

          return {
            id: String(item.id ?? ""),
            addedAt: String(item.addedAt ?? item.added_at ?? ""),
            label,
            context,
            type: isKeyword ? "keyword" : "listing",
            url: item.listing?.url ?? null,
          } satisfies WatchlistItem;
        });

        return {
          id: String(watchlist.id ?? ""),
          name: String(watchlist.name ?? ""),
          description: watchlist.description ?? null,
          capacity: Number(watchlist.capacity ?? 0),
          items,
        } satisfies Watchlist;
      });

      setWatchlists(normalized);
    } catch (err) {
      console.error("Failed to load watchlists", err);
      setError(err instanceof Error ? err.message : "Unexpected error while loading watchlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlists();
  }, [loadWatchlists]);

  const totalItems = useMemo(() => {
    return watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0);
  }, [watchlists]);

  const handleRemove = useCallback(
    async (item: WatchlistItem) => {
      try {
        const response = await fetch(`/api/watchlists/items/${item.id}`, { method: "DELETE" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Unable to remove item (${response.status})`);
        }
        push({
          title: "Removed from watchlist",
          description: `"${item.label}" will no longer be tracked.`,
          tone: "success",
        });
        await loadWatchlists();
      } catch (err) {
        console.error("Failed to remove watchlist item", err);
        push({
          title: "Watchlist error",
          description: err instanceof Error ? err.message : "Unexpected error",
          tone: "error",
        });
      }
    },
    [loadWatchlists, push],
  );

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Watchlists"
          subheader="Every new account receives an Operational Watchlist automatically."
        />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Populate it from the <Link href="/keywords">keyword explorer</Link> or by calling the
            <code style={{ marginLeft: 6, marginRight: 6 }}>/api/watchlists/add</code> endpoint.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">
                Total watchlists
              </Typography>
              <Chip label={watchlists.length} color="primary" variant="outlined" />
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">
                Tracked items
              </Typography>
              <Chip label={totalItems} color="primary" variant="outlined" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {loading ? <Alert severity="info">Loading watchlists…</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error && watchlists.length === 0 ? (
        <Alert severity="info">
          No watchlists found. They will be provisioned automatically when a user profile is created.
        </Alert>
      ) : null}

      <Stack spacing={3}>
        {watchlists.map((watchlist) => {
          const remaining = Math.max(watchlist.capacity - watchlist.items.length, 0);
          return (
            <Card key={watchlist.id}>
              <CardHeader
                title={watchlist.name}
                subheader={watchlist.description ?? "Auto-created starter watchlist."}
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {watchlist.items.length} of {watchlist.capacity} slots used · {remaining} remaining
                </Typography>
                {watchlist.items.length === 0 ? (
                  <Alert severity="info">This watchlist is empty. Add items from the keyword explorer.</Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>Context</TableCell>
                          <TableCell>Added</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {watchlist.items.map((item) => {
                          const addedAt = new Date(item.addedAt);
                          const formatted = Number.isNaN(addedAt.getTime())
                            ? "Unknown"
                            : addedAt.toLocaleString();
                          return (
                            <TableRow key={item.id} hover>
                              <TableCell>
                                {item.url ? (
                                  <Link href={item.url} target="_blank" rel="noreferrer">
                                    {item.label}
                                  </Link>
                                ) : (
                                  item.label
                                )}
                              </TableCell>
                              <TableCell>{item.context ?? ""}</TableCell>
                              <TableCell>{formatted}</TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleRemove(item)}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
