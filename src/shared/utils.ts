import type { Msg, Reply } from "./messages.js";

export function sendToBackground<T = unknown>(msg: Msg): Promise<Reply<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message ?? "sendMessage failed",
        });
        return;
      }
      resolve(
        response ?? {
          ok: false,
          error: "No response from background",
        },
      );
    });
  });
}

export const WaitKit = {
  /**
   * Waits for an element to appear in the DOM and match a state.
   * Mirrors Playwright's page.waitForSelector()
   */
  async waitForSelector(
    selector: string,
    options: {
      timeout?: number;
      state?: "visible" | "hidden" | "attached" | "detached";
      root?: Document | HTMLElement;
    } = {},
  ) {
    const { timeout = 30000, state = "visible", root = document } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Check immediately
      const check = () => {
        const element = root.querySelector(selector);

        if (state === "attached" && element) return resolve(element);
        if (state === "detached" && !element) return resolve(true);

        if (element) {
          const rect = element.getBoundingClientRect();
          const isVisible =
            !!(rect.width || rect.height || element.getClientRects().length) &&
            window.getComputedStyle(element).visibility !== "hidden" &&
            window.getComputedStyle(element).display !== "none";

          if (state === "visible" && isVisible) return resolve(element);
          if (state === "hidden" && !isVisible) return resolve(element);
        } else if (state === "hidden") {
          return resolve(true); // Treat missing as hidden
        }
        return null;
      };

      if (check()) return;

      // Use MutationObserver for performance instead of interval thrashing
      const observer = new MutationObserver(() => {
        if (check()) {
          observer.disconnect();
          clearTimeout(timer);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          clearTimeout(timer);
          reject(
            new Error(
              `Timeout exceeding ${timeout}ms waiting for selector: "${selector}"`,
            ),
          );
        }
      });

      observer.observe(root === document ? document.body : root, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            `Timeout exceeding ${timeout}ms waiting for selector: "${selector}"`,
          ),
        );
      }, timeout);
    });
  },

  /**
   * Waits for a custom truthy condition evaluation.
   * Mirrors Playwright's page.waitForFunction()
   */
  async waitForFunction(
    fn: () => unknown,
    options: { timeout?: number; polling?: number } = {},
  ) {
    const { timeout = 30000, polling = 100 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        try {
          const result = fn();
          if (result) {
            clearInterval(interval);
            resolve(result);
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(
            new Error(
              `Timeout exceeding ${timeout}ms waiting for custom function.`,
            ),
          );
        }
      }, polling);
    });
  },

  /**
   * Basic sleep / delay function
   */
  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  syncWait(milliseconds: number) {
    const start = Date.now();
    while (Date.now() - start < milliseconds) {
      // Do nothing, just loop and block the thread
    }
  },
};

export const NetworkTracker = {
  inflightCount: 0,
  idleCallbacks: [],
  idleTimeoutMs: 500, // Time to wait with 0 requests to consider "idle"
  timerId: null,

  init() {
    const self = this;

    // 1. Patch Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      self.requestStarted();
      try {
        return await originalFetch(...args);
      } finally {
        self.requestFinished();
      }
    };

    // 2. Patch XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _hasTracked?: boolean },
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      this._hasTracked = false;
      return originalOpen.call(
        this,
        method,
        url,
        async ?? true,
        username,
        password,
      );
    } as typeof XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _hasTracked: boolean },
      ...args: Parameters<XMLHttpRequest["send"]>
    ) {
      if (!this._hasTracked) {
        self.requestStarted();
        this._hasTracked = true;

        this.addEventListener("loadend", () => {
          self.requestFinished();
        });
      }
      return originalSend.apply(this, args);
    };
  },

  requestStarted() {
    this.inflightCount++;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  },

  requestFinished() {
    this.inflightCount = Math.max(0, this.inflightCount - 1);
    if (this.inflightCount === 0) {
      this.startIdleTimer();
    }
  },

  startIdleTimer() {
    if (this.timerId) clearTimeout(this.timerId);

    this.timerId = setTimeout(() => {
      // Dequeue all pending wait promises
      const callbacks = [...this.idleCallbacks];
      this.idleCallbacks = [];
      callbacks.forEach((resolve) => resolve());
    }, this.idleTimeoutMs);
  },

  /**
   * Recreates Playwright's page.waitForLoadState('networkidle')
   */
  async waitForNetworkIdle(timeout = 30000) {
    // If it's already idle, resolve instantly
    if (this.inflightCount === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const failTimer = setTimeout(() => {
        reject(new Error(`Network idle timeout exceeded ${timeout}ms`));
      }, timeout);

      this.idleCallbacks.push(() => {
        clearTimeout(failTimer);
        resolve();
      });
    });
  },
} as {
  timerId: ReturnType<typeof setTimeout> | null;
  inflightCount: number;
  idleCallbacks: Array<() => void>;
  idleTimeoutMs: number;
  requestStarted: () => void;
  requestFinished: () => void;
  startIdleTimer: () => void;
  init: () => void;
  waitForNetworkIdle: (timeout?: number) => Promise<void>;
};
