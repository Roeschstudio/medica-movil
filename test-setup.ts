import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Next.js router
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock Supabase
vi.mock("@/lib/supabase", async () => {
  const mocks = await import("@tests/__mocks__/supabase");
  return {
    createSupabaseBrowserClient: mocks.createSupabaseBrowserClient,
    createSupabaseServerClient: mocks.createSupabaseServerClient,
  };
});

// Mock NextAuth
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "test-user-123",
        email: "test@example.com",
        name: "Test User",
      },
      expires: "2024-12-31",
    },
    status: "authenticated",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn().mockResolvedValue({
    user: {
      id: "test-user-123",
      email: "test@example.com",
      name: "Test User",
    },
    expires: "2024-12-31",
  }),
}));

// Mock notification service
vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
    createAppointmentNotification: vi.fn(),
    createSystemNotification: vi.fn(),
    markAsRead: vi.fn(),
    getUnreadCount: vi.fn().mockResolvedValue(0),
  },
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

// Mock global fetch
global.fetch = vi.fn();

// Mock performance object for Node.js environment
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
} as any;

// Mock File and FileReader for file upload tests
global.File = class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  
  constructor(bits: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename;
    this.size = bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.size || 0), 0);
    this.type = options?.type || '';
    this.lastModified = options?.lastModified || Date.now();
  }
} as any;

global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,dGVzdA==`;
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }
  
  readAsText(file: File) {
    setTimeout(() => {
      this.result = 'test content';
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }
} as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
global.URL.revokeObjectURL = vi.fn();

// Mock performance monitor
vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
    recordTiming: vi.fn(),
    startTiming: vi.fn(() => Date.now()),
    incrementCounter: vi.fn(),
    recordGauge: vi.fn(),
    getMetrics: vi.fn(() => []),
    getLatestMetric: vi.fn(() => null),
    getAverage: vi.fn(() => 0),
    getPercentile: vi.fn(() => 0),
    getSystemHealth: vi.fn(() => ({ status: 'healthy', score: 100 })),
    clear: vi.fn(),
    destroy: vi.fn(),
  },
  perf: {
    measure: vi.fn(async (name, fn) => await fn()),
    measureSync: vi.fn((name, fn) => fn()),
    timer: vi.fn(() => ({ stop: vi.fn() })),
  },
  usePerformanceMonitor: vi.fn(() => ({
    recordMetric: vi.fn(),
    recordTiming: vi.fn(),
    startTiming: vi.fn(() => Date.now()),
    incrementCounter: vi.fn(),
    recordGauge: vi.fn(),
    getMetrics: vi.fn(() => []),
    getLatestMetric: vi.fn(() => null),
    getAverage: vi.fn(() => 0),
    getPercentile: vi.fn(() => 0),
    getSystemHealth: vi.fn(() => ({ status: 'healthy', score: 100 })),
  })),
}));

// Mock database optimizer
vi.mock("@/lib/db-optimization", () => ({
  dbOptimizer: {
    getChatRoom: vi.fn().mockResolvedValue(null),
    getMessages: vi.fn().mockResolvedValue([]),
    invalidateCache: vi.fn(),
    executeQuery: vi.fn(),
    batchQuery: vi.fn(),
    getStats: vi.fn(() => ({ queries: 0, cacheHits: 0, cacheMisses: 0 })),
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      }))
    }
  }
}));
