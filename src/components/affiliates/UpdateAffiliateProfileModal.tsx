"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type AffiliateSettings = {
  code: string;
  displayName: string;
  email: string;
  payoutMethod: string;
  payoutEmail: string;
  status: string;
  baseRate: number;
};

interface UpdateAffiliateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function UpdateAffiliateProfileModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
}: UpdateAffiliateProfileModalProps): JSX.Element {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadAffiliateData = useCallback(async () => {
    if (!userId || !isOpen) {
      return;
    }

    setInitialLoading(true);
    try {
      const response = await fetch(`/api/affiliate?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const json = await response.json();
        if (json.affiliate) {
          setAffiliate(json.affiliate);
        }
      } else {
        throw new Error("Failed to load affiliate data");
      }
    } catch (error) {
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  }, [userId, isOpen, toast]);

  useEffect(() => {
    if (isOpen) {
      void loadAffiliateData();
    }
  }, [isOpen, loadAffiliateData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast({
        title: "Affiliate settings unavailable",
        description: "You must be signed in to update affiliate settings.",
        variant: "destructive",
      });
      return;
    }
    if (!affiliate) {
      toast({
        title: "Affiliate settings unavailable",
        description: "No affiliate record found for your account.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/affiliate?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: affiliate.displayName,
          email: affiliate.email,
          payoutMethod: affiliate.payoutMethod,
          payoutEmail: affiliate.payoutEmail,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update affiliate settings");
      }
      toast({
        title: "Affiliate profile updated",
        description: "Your affiliate information has been saved successfully.",
        variant: "success",
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Update Affiliate Profile</DialogTitle>
              <DialogDescription>
                Manage your affiliate partner information and payout preferences. This is separate from
                your main application profile.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {initialLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading affiliate profile...
          </div>
        ) : affiliate ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Your Affiliate Code</Label>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-background px-3 py-2 font-mono text-sm font-semibold">
                    {affiliate.code}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(affiliate.code);
                      toast({
                        title: "Code copied",
                        description: "Affiliate code copied to clipboard",
                        variant: "success",
                      });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This code is unique and cannot be changed
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="affiliate-display-name">Partner Display Name</Label>
                <Input
                  id="affiliate-display-name"
                  value={affiliate.displayName}
                  onChange={(event) =>
                    setAffiliate((state) =>
                      state ? { ...state, displayName: event.target.value } : null
                    )
                  }
                  disabled={loading}
                  placeholder="Your partner name"
                />
                <p className="text-xs text-muted-foreground">
                  This can be different from your account name
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="affiliate-email">Partner Email</Label>
                <Input
                  id="affiliate-email"
                  type="email"
                  value={affiliate.email}
                  onChange={(event) =>
                    setAffiliate((state) => (state ? { ...state, email: event.target.value } : null))
                  }
                  disabled={loading}
                  placeholder="partner@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  This can be different from your account email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout-method">Payout Method</Label>
                <Select
                  value={affiliate.payoutMethod}
                  onValueChange={(value) =>
                    setAffiliate((state) => (state ? { ...state, payoutMethod: value } : null))
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="payout-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe_connect">Stripe Connect</SelectItem>
                    <SelectItem value="manual">Manual Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout-email">Payout Email/Account</Label>
                <Input
                  id="payout-email"
                  value={affiliate.payoutEmail}
                  onChange={(event) =>
                    setAffiliate((state) =>
                      state ? { ...state, payoutEmail: event.target.value } : null
                    )
                  }
                  disabled={loading}
                  placeholder="paypal@example.com"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Commission Rate</dt>
                  <dd className="font-medium">{(affiliate.baseRate * 100).toFixed(0)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge
                      variant={affiliate.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {affiliate.status}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No affiliate record found. Your affiliate record will be created automatically when you sign
            up.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
