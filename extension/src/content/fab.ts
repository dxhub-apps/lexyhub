// extension/src/content/fab.ts
/**
 * Floating Action Button (FAB) for quick access to LexyHub features
 */

export class FAB {
  private fab: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private isOpen = false;

  constructor() {
    this.createFAB();
    this.setupKeyboardShortcut();
  }

  private createFAB(): void {
    // Create FAB button
    this.fab = document.createElement('button');
    this.fab.className = 'lexyhub-fab';
    this.fab.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    this.fab.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #3b82f6;
      color: #fff;
      border: none;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      cursor: pointer;
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    this.fab.addEventListener('mouseenter', () => {
      this.fab!.style.transform = 'scale(1.1)';
      this.fab!.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
    });

    this.fab.addEventListener('mouseleave', () => {
      this.fab!.style.transform = 'scale(1)';
      this.fab!.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
    });

    this.fab.addEventListener('click', () => this.toggle());

    // Create overlay panel
    this.panel = document.createElement('div');
    this.panel.className = 'lexyhub-fab-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 88px;
      right: 24px;
      width: 320px;
      max-height: 500px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      display: none;
      z-index: 999998;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.panel.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">LexyHub Quick Actions</h3>
      </div>
      <div style="padding: 12px;">
        <div class="lexyhub-fab-action" data-action="toggle-highlights" style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; background: #f3f4f6;">
          <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">Toggle Highlights</div>
          <div style="font-size: 12px; color: #6b7280;">Show/hide keyword highlights</div>
        </div>
        <div class="lexyhub-fab-action" data-action="view-session" style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; background: #f3f4f6;">
          <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">Current Session</div>
          <div style="font-size: 12px; color: #6b7280;">View research session stats</div>
        </div>
        <div class="lexyhub-fab-action" data-action="open-popup" style="padding: 12px; border-radius: 8px; cursor: pointer; background: #f3f4f6;">
          <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">Open Dashboard</div>
          <div style="font-size: 12px; color: #6b7280;">View all features</div>
        </div>
      </div>
    `;

    // Add click handlers for actions
    this.panel.querySelectorAll('.lexyhub-fab-action').forEach(action => {
      action.addEventListener('click', (e) => {
        const actionType = (e.currentTarget as HTMLElement).dataset.action;
        this.handleAction(actionType!);
      });

      action.addEventListener('mouseenter', (e) => {
        (e.currentTarget as HTMLElement).style.background = '#e5e7eb';
      });

      action.addEventListener('mouseleave', (e) => {
        (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
      });
    });

    document.body.appendChild(this.fab);
    document.body.appendChild(this.panel);

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen &&
          e.target !== this.fab &&
          e.target !== this.panel &&
          !this.panel?.contains(e.target as Node)) {
        this.close();
      }
    });
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    if (this.panel) {
      this.panel.style.display = 'block';
      this.isOpen = true;
    }
  }

  private close(): void {
    if (this.panel) {
      this.panel.style.display = 'none';
      this.isOpen = false;
    }
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'toggle-highlights':
        chrome.runtime.sendMessage({ type: 'TOGGLE_HIGHLIGHTS' });
        this.close();
        break;
      case 'view-session':
        chrome.runtime.sendMessage({ type: 'VIEW_SESSION' });
        this.close();
        break;
      case 'open-popup':
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        this.close();
        break;
    }
  }

  private setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + K
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  destroy(): void {
    this.fab?.remove();
    this.panel?.remove();
  }
}
