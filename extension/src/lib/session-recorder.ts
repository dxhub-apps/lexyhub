// extension/src/lib/session-recorder.ts
/**
 * Session recorder for tracking keyword research sessions
 */

export interface SessionData {
  session_id: string;
  market: string;
  started_at: string;
  ended_at?: string;
  search_queries: string[];
  clicked_listings: Array<{
    title: string;
    url: string;
    position: number;
  }>;
  terms_discovered: string[];
}

export class SessionRecorder {
  private currentSession: SessionData | null = null;
  private inactivityTimeout: number | null = null;
  private readonly INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

  constructor(private market: string) {}

  /**
   * Start a new session
   */
  start(): void {
    if (this.currentSession) {
      this.end();
    }

    this.currentSession = {
      session_id: this.generateSessionId(),
      market: this.market,
      started_at: new Date().toISOString(),
      search_queries: [],
      clicked_listings: [],
      terms_discovered: [],
    };

    this.resetInactivityTimer();
    console.log('[SessionRecorder] Session started:', this.currentSession.session_id);
  }

  /**
   * Track search query
   */
  trackSearch(query: string): void {
    if (!this.currentSession) {
      this.start();
    }

    if (query && !this.currentSession!.search_queries.includes(query)) {
      this.currentSession!.search_queries.push(query);
    }

    this.resetInactivityTimer();
  }

  /**
   * Track clicked listing
   */
  trackClick(title: string, url: string, position: number): void {
    if (!this.currentSession) {
      this.start();
    }

    this.currentSession!.clicked_listings.push({ title, url, position });
    this.resetInactivityTimer();
  }

  /**
   * Add discovered term
   */
  addTerm(term: string): void {
    if (!this.currentSession) {
      this.start();
    }

    if (term && !this.currentSession!.terms_discovered.includes(term)) {
      this.currentSession!.terms_discovered.push(term);
    }

    this.resetInactivityTimer();
  }

  /**
   * End current session
   */
  end(): void {
    if (!this.currentSession) return;

    this.currentSession.ended_at = new Date().toISOString();

    // Send to background for persistence
    chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      payload: this.currentSession,
    });

    console.log('[SessionRecorder] Session ended:', this.currentSession.session_id);
    this.currentSession = null;

    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
  }

  /**
   * Get current session data
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Reset inactivity timer
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    this.inactivityTimeout = window.setTimeout(() => {
      console.log('[SessionRecorder] Inactivity timeout reached');
      this.end();
    }, this.INACTIVITY_MS);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }
}
