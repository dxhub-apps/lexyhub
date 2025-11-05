// extension/src/lib/storage.ts
/**
 * Storage manager using chrome.storage.sync and IndexedDB
 */

export class StorageManager {
  /**
   * Get value from chrome.storage.sync
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.sync.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error(`[Storage] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in chrome.storage.sync
   */
  async set(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error(`[Storage] Error setting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove key from chrome.storage.sync
   */
  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.sync.remove(key);
    } catch (error) {
      console.error(`[Storage] Error removing key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get value from chrome.storage.local (for larger data)
   */
  async getLocal<T = any>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error(`[Storage] Error getting local key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in chrome.storage.local
   */
  async setLocal(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`[Storage] Error setting local key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove key from chrome.storage.local
   */
  async removeLocal(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error(`[Storage] Error removing local key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    } catch (error) {
      console.error("[Storage] Error clearing storage:", error);
      throw error;
    }
  }
}
