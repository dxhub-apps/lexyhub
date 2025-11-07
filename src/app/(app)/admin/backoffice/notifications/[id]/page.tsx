'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { DateTimePicker } from '@/components/ui/date-time-picker';

type Notification = {
  id: string;
  kind: 'banner' | 'inapp' | 'email' | 'mixed';
  category: 'keyword' | 'watchlist' | 'ai' | 'account' | 'system' | 'collab';
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  priority: number;
  icon?: string;
  audience_scope: 'all' | 'plan' | 'user_ids' | 'segment' | 'workspace';
  audience_filter?: any;
  schedule_start_at?: string;
  schedule_end_at?: string;
  show_banner: boolean;
  create_inapp: boolean;
  send_email: boolean;
  email_template_key?: 'brief_ready' | 'keyword_highlights' | 'watchlist_digest' | 'billing_event' | 'system_announcement';
  status: 'draft' | 'scheduled' | 'live' | 'paused' | 'ended';
};

export default function EditNotificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const notificationId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [severity, setSeverity] = useState<'info' | 'success' | 'warning' | 'critical'>('info');
  const [priority, setPriority] = useState(50);
  const [icon, setIcon] = useState('');
  const [category, setCategory] = useState<'keyword' | 'watchlist' | 'ai' | 'account' | 'system' | 'collab'>('system');

  const [audienceScope, setAudienceScope] = useState<'all' | 'plan' | 'user_ids'>('all');
  const [planCodes, setPlanCodes] = useState('');
  const [userIds, setUserIds] = useState('');

  const [scheduleStartAt, setScheduleStartAt] = useState<Date | undefined>(undefined);
  const [scheduleEndAt, setScheduleEndAt] = useState<Date | undefined>(undefined);

  const [showBanner, setShowBanner] = useState(false);
  const [createInapp, setCreateInapp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTemplateKey, setEmailTemplateKey] = useState<'system_announcement' | 'brief_ready'>('system_announcement');

  // Fetch notification data
  useEffect(() => {
    async function fetchNotification() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/backoffice/notifications/${notificationId}`);
        if (response.ok) {
          const data = await response.json();
          const notif = data.notification;
          setNotification(notif);

          // Populate form fields
          setTitle(notif.title || '');
          setBody(notif.body || '');
          setCtaText(notif.cta_text || '');
          setCtaUrl(notif.cta_url || '');
          setSeverity(notif.severity || 'info');
          setPriority(notif.priority || 50);
          setIcon(notif.icon || '');
          setCategory(notif.category || 'system');

          setAudienceScope(notif.audience_scope || 'all');
          if (notif.audience_filter?.plan_codes) {
            setPlanCodes(notif.audience_filter.plan_codes.join(', '));
          }
          if (notif.audience_filter?.user_ids) {
            setUserIds(notif.audience_filter.user_ids.join(', '));
          }

          // Set schedule dates
          if (notif.schedule_start_at) {
            setScheduleStartAt(new Date(notif.schedule_start_at));
          }
          if (notif.schedule_end_at) {
            setScheduleEndAt(new Date(notif.schedule_end_at));
          }

          setShowBanner(notif.show_banner || false);
          setCreateInapp(notif.create_inapp !== undefined ? notif.create_inapp : true);
          setSendEmail(notif.send_email || false);
          setEmailTemplateKey(notif.email_template_key || 'system_announcement');
        } else {
          alert('Failed to load notification');
          router.push('/admin/backoffice/notifications');
        }
      } catch (error) {
        console.error('Failed to fetch notification:', error);
        alert('Failed to load notification');
        router.push('/admin/backoffice/notifications');
      } finally {
        setIsLoading(false);
      }
    }

    if (notificationId) {
      fetchNotification();
    }
  }, [notificationId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const audienceFilter: any = {};
      if (audienceScope === 'plan' && planCodes) {
        audienceFilter.plan_codes = planCodes.split(',').map(s => s.trim());
      }
      if (audienceScope === 'user_ids' && userIds) {
        audienceFilter.user_ids = userIds.split(',').map(s => s.trim());
      }

      // Convert Date to ISO string
      const scheduleStartAtISO = scheduleStartAt ? scheduleStartAt.toISOString() : undefined;
      const scheduleEndAtISO = scheduleEndAt ? scheduleEndAt.toISOString() : undefined;

      const payload = {
        kind: showBanner && createInapp && sendEmail ? 'mixed' as const :
              showBanner ? 'banner' as const :
              sendEmail ? 'email' as const : 'inapp' as const,
        category,
        title,
        body: body || undefined,
        cta_text: ctaText || undefined,
        cta_url: ctaUrl || undefined,
        severity,
        priority,
        icon: icon || undefined,
        audience_scope: audienceScope,
        audience_filter: audienceFilter,
        schedule_start_at: scheduleStartAtISO,
        schedule_end_at: scheduleEndAtISO,
        show_banner: showBanner,
        create_inapp: createInapp,
        send_email: sendEmail,
        email_template_key: sendEmail ? emailTemplateKey : undefined,
      };

      const response = await fetch(`/api/admin/backoffice/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push('/admin/backoffice/notifications');
      } else {
        const error = await response.json();
        alert(`Failed to update notification: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update notification:', error);
      alert('Failed to update notification');
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

  if (!notification) {
    return null;
  }

  // Don't allow editing live or ended notifications
  const isEditable = notification.status === 'draft' || notification.status === 'paused';

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Edit Notification</h1>
        <p className="text-muted-foreground">
          Update notification details
        </p>
        {!isEditable && (
          <div className="mt-4 rounded-md border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950/30">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This notification is {notification.status}. Only draft and paused notifications can be edited.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Content</CardTitle>
                <CardDescription>Define the message and presentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter notification title"
                    required
                    disabled={!isEditable}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Body</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Enter notification body (optional)"
                    rows={4}
                    disabled={!isEditable}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctaText">CTA Text</Label>
                    <Input
                      id="ctaText"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g., Learn More"
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ctaUrl">CTA URL</Label>
                    <Input
                      id="ctaUrl"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="e.g., /features"
                      disabled={!isEditable}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity</Label>
                    <Select value={severity} onValueChange={(v: any) => setSeverity(v)} disabled={!isEditable}>
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority (0-100)</Label>
                    <Input
                      id="priority"
                      type="number"
                      min={0}
                      max={100}
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value))}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="icon">Icon (emoji)</Label>
                    <Input
                      id="icon"
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      placeholder="e.g., 🎉"
                      disabled={!isEditable}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(v: any) => setCategory(v)} disabled={!isEditable}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Keywords & Trends</SelectItem>
                      <SelectItem value="watchlist">Watchlists</SelectItem>
                      <SelectItem value="ai">AI Insights</SelectItem>
                      <SelectItem value="account">Account & Billing</SelectItem>
                      <SelectItem value="system">System Updates</SelectItem>
                      <SelectItem value="collab">Collaboration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audience Tab */}
          <TabsContent value="audience" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Target Audience</CardTitle>
                <CardDescription>Define who should receive this notification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="audienceScope">Audience Scope</Label>
                  <Select value={audienceScope} onValueChange={(v: any) => setAudienceScope(v)} disabled={!isEditable}>
                    <SelectTrigger id="audienceScope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="plan">By Plan</SelectItem>
                      <SelectItem value="user_ids">Specific Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {audienceScope === 'plan' && (
                  <div className="space-y-2">
                    <Label htmlFor="planCodes">Plan Codes (comma-separated)</Label>
                    <Input
                      id="planCodes"
                      value={planCodes}
                      onChange={(e) => setPlanCodes(e.target.value)}
                      placeholder="e.g., growth, scale"
                      disabled={!isEditable}
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter plan codes separated by commas
                    </p>
                  </div>
                )}

                {audienceScope === 'user_ids' && (
                  <div className="space-y-2">
                    <Label htmlFor="userIds">User IDs (comma-separated)</Label>
                    <Textarea
                      id="userIds"
                      value={userIds}
                      onChange={(e) => setUserIds(e.target.value)}
                      placeholder="Enter user UUIDs, one per line or comma-separated"
                      rows={4}
                      disabled={!isEditable}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>Set when this notification should be active</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduleStartAt">Start Date & Time</Label>
                    <DateTimePicker
                      date={scheduleStartAt}
                      setDate={setScheduleStartAt}
                      placeholder="Pick start date and time"
                      disabled={!isEditable}
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave empty to start immediately
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduleEndAt">End Date & Time</Label>
                    <DateTimePicker
                      date={scheduleEndAt}
                      setDate={setScheduleEndAt}
                      placeholder="Pick end date and time"
                      disabled={!isEditable}
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave empty for no end date
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Channels</CardTitle>
                <CardDescription>Choose where to deliver this notification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showBanner">Top Banner</Label>
                    <p className="text-sm text-muted-foreground">
                      Show as top banner (for urgent/critical notifications)
                    </p>
                  </div>
                  <Switch
                    id="showBanner"
                    checked={showBanner}
                    onCheckedChange={setShowBanner}
                    disabled={!isEditable}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="createInapp">In-App Notification</Label>
                    <p className="text-sm text-muted-foreground">
                      Show in the notification bell menu
                    </p>
                  </div>
                  <Switch
                    id="createInapp"
                    checked={createInapp}
                    onCheckedChange={setCreateInapp}
                    disabled={!isEditable}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sendEmail">Email Notification</Label>
                    <p className="text-sm text-muted-foreground">
                      Send via email (respects user preferences)
                    </p>
                  </div>
                  <Switch
                    id="sendEmail"
                    checked={sendEmail}
                    onCheckedChange={setSendEmail}
                    disabled={!isEditable}
                  />
                </div>

                {sendEmail && (
                  <div className="space-y-2">
                    <Label htmlFor="emailTemplateKey">Email Template</Label>
                    <Select value={emailTemplateKey} onValueChange={(v: any) => setEmailTemplateKey(v)} disabled={!isEditable}>
                      <SelectTrigger id="emailTemplateKey">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system_announcement">System Announcement</SelectItem>
                        <SelectItem value="brief_ready">Brief Ready</SelectItem>
                        <SelectItem value="keyword_highlights">Keyword Highlights</SelectItem>
                        <SelectItem value="watchlist_digest">Watchlist Digest</SelectItem>
                        <SelectItem value="billing_event">Billing Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !title || !isEditable}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Notification
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
