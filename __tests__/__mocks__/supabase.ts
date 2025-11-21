import { vi } from "vitest";

// Mock user data
const mockUser = {
  id: "test-user-123",
  email: "test@example.com",
  user_metadata: {},
  app_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
};

// Mock auth response
const mockAuthResponse = {
  data: { user: mockUser },
  error: null,
};

// Mock auth response with user
const mockAuthUserResponse = {
  data: { user: mockUser },
  error: null,
};

// Mock database query builder
const createMockQueryBuilder = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  containedBy: vi.fn().mockReturnThis(),
  rangeGt: vi.fn().mockReturnThis(),
  rangeGte: vi.fn().mockReturnThis(),
  rangeLt: vi.fn().mockReturnThis(),
  rangeLte: vi.fn().mockReturnThis(),
  rangeAdjacent: vi.fn().mockReturnThis(),
  overlaps: vi.fn().mockReturnThis(),
  textSearch: vi.fn().mockReturnThis(),
  match: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  abortSignal: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  csv: vi.fn().mockResolvedValue({ data: "", error: null }),
  geojson: vi.fn().mockResolvedValue({ data: null, error: null }),
  explain: vi.fn().mockResolvedValue({ data: null, error: null }),
  rollback: vi.fn().mockResolvedValue({ data: null, error: null }),
  returns: vi.fn().mockReturnThis(),
  then: vi.fn().mockResolvedValue({ data: [], error: null }),
});

// Mock realtime channel
const createMockChannel = (name: string) => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockResolvedValue("SUBSCRIBED"),
  unsubscribe: vi.fn().mockResolvedValue("UNSUBSCRIBED"),
  send: vi.fn().mockResolvedValue("ok"),
  track: vi.fn().mockResolvedValue("ok"),
  untrack: vi.fn().mockResolvedValue("ok"),
  state: "joined",
});

// Mock storage bucket
const createMockStorageBucket = (bucketName: string) => ({
  upload: vi.fn().mockResolvedValue({
    data: { path: `${bucketName}/test-file.jpg` },
    error: null,
  }),
  download: vi.fn().mockResolvedValue({
    data: new Blob(["test content"]),
    error: null,
  }),
  remove: vi.fn().mockResolvedValue({
    data: [{ name: "test-file.jpg" }],
    error: null,
  }),
  list: vi.fn().mockResolvedValue({
    data: [{ name: "test-file.jpg", id: "file-123" }],
    error: null,
  }),
  getPublicUrl: vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.com/file.jpg" },
  }),
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: `https://example.com/${bucketName}/signed-url` },
    error: null,
  }),
  createSignedUrls: vi.fn().mockResolvedValue({
    data: [{ path: "test-file.jpg", signedUrl: "https://example.com/signed" }],
    error: null,
  }),
  createSignedUploadUrl: vi.fn().mockResolvedValue({
    data: { path: "test-file.jpg", signedUrl: "https://example.com/upload" },
    error: null,
  }),
  updateFileOptions: vi.fn().mockResolvedValue({
    data: { message: "Successfully updated" },
    error: null,
  }),
  move: vi.fn().mockResolvedValue({
    data: { message: "Successfully moved" },
    error: null,
  }),
  copy: vi.fn().mockResolvedValue({
    data: { path: "copied-file.jpg" },
    error: null,
  }),
});

// Main Supabase client mock
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue(mockAuthUserResponse),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: mockUser, access_token: "mock-token" } },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue(mockAuthResponse),
    signUp: vi.fn().mockResolvedValue(mockAuthResponse),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn((table: string) => createMockQueryBuilder()),
  storage: {
    from: vi.fn((bucket: string) => createMockStorageBucket(bucket)),
    listBuckets: vi.fn().mockResolvedValue({
      data: [{ id: "chat-files", name: "chat-files" }],
      error: null,
    }),
    getBucket: vi.fn().mockResolvedValue({
      data: { id: "chat-files", name: "chat-files" },
      error: null,
    }),
    createBucket: vi.fn().mockResolvedValue({
      data: { name: "chat-files" },
      error: null,
    }),
    deleteBucket: vi.fn().mockResolvedValue({
      data: { message: "Successfully deleted" },
      error: null,
    }),
    emptyBucket: vi.fn().mockResolvedValue({
      data: { message: "Successfully emptied" },
      error: null,
    }),
  },
  channel: vi.fn((name: string) => createMockChannel(name)),
  removeChannel: vi.fn().mockReturnValue("ok"),
  removeAllChannels: vi.fn().mockReturnValue("ok"),
  getChannels: vi.fn().mockReturnValue([]),
  realtime: {
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    channel: vi.fn((name: string) => createMockChannel(name)),
    removeChannel: vi.fn(),
    removeAllChannels: vi.fn(),
    getChannels: vi.fn().mockReturnValue([]),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null })
};

// Export factory function
export const createSupabaseBrowserClient = vi.fn().mockReturnValue(mockSupabaseClient);
export const createSupabaseServerClient = vi.fn().mockReturnValue(mockSupabaseClient);

// Export mock user for tests
export { mockUser, mockAuthResponse };