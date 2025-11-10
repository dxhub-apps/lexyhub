'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Loader2, CheckCircle2 } from 'lucide-react';
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

type NotificationPreferencesProps = {
  userId: string | null;
  onSaveSuccess?: () => void;
};

export function NotificationPreferences({ userId, onSaveSuccess }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<PreferenceSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/notifications/prefs?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || []);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchPreferences();
  }, [userId, fetchPreferences]);

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
    if (!userId) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Update each preference
      for (const pref of preferences) {
        const response = await fetch(`/api/notifications/prefs?userId=${userId}`, {
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
      onSaveSuccess?.();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isCriticalCategory = (category: NotificationCategory) =>
    category === 'account' || category === 'system';

  return (
    <div className="space-y-6">
      {/* Preferences Grid */}
      <div className="space-y-4">
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
      </div>
    </div>
  );
}
