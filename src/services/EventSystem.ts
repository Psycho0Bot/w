type EventCallback = (data: any) => void | Promise<void>;

class EventSystem {
  private listeners: Record<string, EventCallback[]> = {};

  public subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  public async publish(event: string, data: any): Promise<void> {
    if (!this.listeners[event]) return;
    
    // Execute all callbacks concurrently
    const promises = this.listeners[event].map(async (callback) => {
      try {
        await callback(data);
      } catch (err) {
        console.error(`[EventSystem] Error executing subscriber callback for event "${event}":`, err);
      }
    });
    
    await Promise.all(promises);
  }
}

export const eventSystem = new EventSystem();
export default EventSystem;
