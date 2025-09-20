// Request throttling utility to prevent excessive API calls

class RequestThrottle {
  constructor() {
    this.pendingRequests = new Map();
    this.requestHistory = new Map();
    this.throttleDelay = 500; // 500ms throttle (less aggressive)
  }

  // Throttle requests by URL and method
  async throttleRequest(url, options = {}, throttleKey = null) {
    const key = throttleKey || `${options.method || 'GET'}:${url}`;
    const now = Date.now();

    // Check if request was made recently
    const lastRequest = this.requestHistory.get(key);
    if (lastRequest && (now - lastRequest) < this.throttleDelay) {
      console.log(`🚫 Request throttled: ${key}`);
      return null; // Skip this request
    }

    // Check if same request is already pending
    if (this.pendingRequests.has(key)) {
      console.log(`⏳ Request already pending: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Create new request
    const requestPromise = this.executeRequest(url, options);
    this.pendingRequests.set(key, requestPromise);
    this.requestHistory.set(key, now);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  async executeRequest(url, options) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Clear throttling history
  clearHistory() {
    this.requestHistory.clear();
    this.pendingRequests.clear();
  }

  // Set custom throttle delay
  setThrottleDelay(delay) {
    this.throttleDelay = delay;
  }
}

// Create singleton instance
const requestThrottle = new RequestThrottle();

export default requestThrottle;
