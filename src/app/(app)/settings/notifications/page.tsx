'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { Bell, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type NotificationCategory = 'keyword' | 'watchlist' | 'ai' | 'account' | 'system' | 'collab';
type EmailFrequency = 'instant' | 'daily' | 'weekly' | 'disabled';

type PreferenceSettings = {
  category: NotificationCategory;
  inapp_enabled: boolean;
  email_enabled: boolean;
  email_frequency: EmailFrequency;
};

const categoryLabels: Record<NotificationCategory, { label: string; description: string }> = {
  keyword: {
    label: 'Keywords & Trends',
    description: 'Momentum surges, demand drops, and freshness alerts',
  },
  watchlist: {
    label: 'Watchlists',
    description: 'Ranking changes, new listings, and session briefs',
  },
  ai: {
    label: 'AI Insights',
    description: 'Brief completions, difficulty recalculations, and recommendations',
  },
  account: {
    label: 'Account & Billing',
    description: 'Quota alerts, payment updates, and renewal notices',
  },
  system: {
    label: 'System Updates',
    description: 'Maintenance, incidents, features, and policy changes',
  },
  collab: {
    label: 'Collaboration',
    description: 'Shared watchlist updates, comments, and invitations',
  },
};

export default function NotificationPreferencesPage() {
  const user = useUser();
  const [preferences, setPreferences] = useState<PreferenceSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/prefs?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || []);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchPreferences();
  }, [user?.id, fetchPreferences]);

  async function updatePreference(
    category: NotificationCategory,
    updates: Partial<Omit<PreferenceSettings, 'category'>>
  ) {
    const updatedPrefs = preferences.map((pref) =>
      pref.category === category ? { ...pref, ...updates } : pref
    );
    setPreferences(updatedPrefs);
  }

  async function handleSave() {
    if (!user?.id) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Update each preference
      for (const pref of preferences) {
        const response = await fetch(`/api/notifications/prefs?userId=${user.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: pref.category,
            inapp_enabled: pref.inapp_enabled,
            email_enabled: pref.email_enabled,
            email_frequency: pref.email_frequency,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update ${pref.category} preferences`);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isCriticalCategory = (category: NotificationCategory) =>
    category === 'account' || category === 'system';

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Notification Preferences
        </h1>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications from Lexyhub
        </p>
      </div>

      {/* Preferences Grid */}
      <div className="space-y-4 mb-6">
        {preferences.map((pref) => {
          const config = categoryLabels[pref.category];
          const isCritical = isCriticalCategory(pref.category);

          return (
            <Card key={pref.category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {config.label}
                </CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* In-App Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={`${pref.category}-inapp`}>In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications in the notification center
                    </p>
                  </div>
                  <Switch
                    id={`${pref.category}-inapp`}
                    checked={pref.inapp_enabled}
                    onCheckedChange={(checked) =>
                      updatePreference(pref.category, { inapp_enabled: checked })
                    }
                  />
                </div>

                {/* Email Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={`${pref.category}-email`}>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      {isCritical
                        ? 'Critical notifications are always sent via email'
                        : 'Receive notifications via email'}
                    </p>
                  </div>
                  <Switch
                    id={`${pref.category}-email`}
                    checked={pref.email_enabled}
                    onCheckedChange={(checked) =>
                      !isCritical && updatePreference(pref.category, { email_enabled: checked })
                    }
                    disabled={isCritical}
                  />
                </div>

                {/* Email Frequency */}
                {pref.email_enabled && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={`${pref.category}-frequency`}>Email Frequency</Label>
                      <p className="text-sm text-muted-foreground">
                        {isCritical
                          ? 'Critical notifications are sent immediately'
                          : 'How often to receive email notifications'}
                      </p>
                    </div>
                    <Select
                      value={pref.email_frequency}
                      onValueChange={(value: EmailFrequency) =>
                        !isCritical &&
                        updatePreference(pref.category, { email_frequency: value })
                      }
                      disabled={isCritical}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">Instant</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                        <SelectItem value="weekly">Weekly Digest</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="text-sm text-muted-foreground">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Preferences saved successfully
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
