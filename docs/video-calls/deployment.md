# Video Call System Deployment Guide

## Production Deployment Checklist

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] Supabase project configured
- [ ] SSL certificate for HTTPS
- [ ] Domain name configured
- [ ] Environment variables set
- [ ] Database migrations applied

### Environment Configuration

#### Required Environment Variables

```bash
# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-domain.com

# Optional: Custom STUN/TURN servers
NEXT_PUBLIC_STUN_SERVERS=stun:your-stun-server.com:3478
NEXT_PUBLIC_TURN_SERVERS=turn:your-turn-server.com:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_PASSWORD=password
```

#### Security Environment Variables

```bash
# Rate limiting
VIDEO_CALL_RATE_LIMIT_CALLS_PER_HOUR=10
VIDEO_CALL_RATE_LIMIT_SIGNALS_PER_MINUTE=100

# Session management
VIDEO_CALL_SESSION_TIMEOUT_MINUTES=60
VIDEO_CALL_MAX_CONCURRENT_CALLS=1

# Monitoring
ENABLE_VIDEO_CALL_MONITORING=true
MONITORING_RETENTION_DAYS=30
```

### Database Setup

#### 1. Apply Migrations

```bash
# Apply all video call migrations
npx supabase db push

# Or apply specific migrations
npx supabase migration up 20241211000001_video_calls_schema.sql
npx supabase migration up 20241211000002_video_call_security.sql
npx supabase migration up 20241211000003_video_call_monitoring.sql
```

#### 2. Verify Schema

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'video_%';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'video_%';
```

#### 3. Configure Realtime

```sql
-- Enable realtime for video call tables
ALTER PUBLICATION supabase_realtime ADD TABLE video_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;
```

#### 4. Set Up Monitoring Cleanup

```sql
-- Create cleanup job (run daily)
SELECT cron.schedule(
  'video-call-cleanup',
  '0 2 * * *', -- 2 AM daily
  'SELECT cleanup_old_monitoring_data();'
);
```

### Application Deployment

#### 1. Build Application

```bash
# Install dependencies
npm ci --production

# Build application
npm run build

# Verify build
npm run start
```

#### 2. Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Build application
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 3. Vercel Deployment

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### SSL/HTTPS Configuration

#### 1. SSL Certificate

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d your-domain.com

# Or using Cloudflare
# Configure Cloudflare SSL/TLS settings to "Full (strict)"
```

#### 2. HTTPS Redirect

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Network Configuration

#### 1. Firewall Rules

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Allow WebRTC UDP traffic
sudo ufw allow 1024:65535/udp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

#### 2. STUN/TURN Server Setup (Optional)

```bash
# Install coturn TURN server
sudo apt-get install coturn

# Configure coturn
sudo nano /etc/turnserver.conf
```

```conf
# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP

realm=your-domain.com
server-name=your-domain.com

# Authentication
use-auth-secret
static-auth-secret=your-secret-key

# SSL certificates
cert=/path/to/certificate.crt
pkey=/path/to/private.key

# Logging
log-file=/var/log/turnserver.log
verbose
```

### Monitoring and Logging

#### 1. Application Monitoring

```typescript
// lib/monitoring-setup.ts
import { VideoCallMonitoring } from "@/lib/video-call-monitoring";

// Initialize monitoring in production
if (process.env.NODE_ENV === "production") {
  const monitoring = new VideoCallMonitoring(supabase);

  // Set up error tracking
  window.addEventListener("error", (event) => {
    monitoring.trackError({
      userId: getCurrentUserId(),
      errorType: "browser",
      errorMessage: event.message,
      errorStack: event.error?.stack,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
```

#### 2. Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    // Test database connection
    const { data, error } = await supabase
      .from("video_calls")
      .select("count")
      .limit(1);

    if (error) throw error;

    // Test WebRTC support detection
    const webrtcSupported = typeof RTCPeerConnection !== "undefined";

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      webrtc: webrtcSupported ? "supported" : "not supported",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

#### 3. Logging Configuration

```typescript
// lib/logger.ts
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

export default logger;
```

### Performance Optimization

#### 1. CDN Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["your-cdn-domain.com"],
  },
  async headers() {
    return [
      {
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  compress: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
```

#### 2. Resource Optimization

```typescript
// lib/performance-config.ts
export const PERFORMANCE_CONFIG = {
  // Lazy loading thresholds
  lazyLoadThreshold: 0.1,

  // Connection pooling
  maxConnectionPoolSize: 10,
  connectionPoolTimeout: 30000,

  // Signal batching
  signalBatchSize: 10,
  signalBatchTimeout: 100,

  // Quality adaptation
  adaptiveQualityEnabled: true,
  qualityCheckInterval: 5000,

  // Monitoring
  metricsFlushInterval: 30000,
  errorReportingEnabled: true,
};
```

### Security Hardening

#### 1. Content Security Policy

```typescript
// middleware.ts
import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const response = NextResponse.next();

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' wss: https:",
      "font-src 'self'",
      "frame-src 'none'",
    ].join("; ")
  );

  return response;
}
```

#### 2. Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 calls per hour
  analytics: true,
});
```

### Backup and Recovery

#### 1. Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/video-calls"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup video call tables
pg_dump -h your-db-host -U postgres -t video_calls -t webrtc_signals \
  -t video_call_quality_metrics -t video_call_usage_analytics \
  -t video_call_error_events > $BACKUP_DIR/video_calls_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/video_calls_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### 2. Disaster Recovery Plan

1. **Database Recovery:**

   ```bash
   # Restore from backup
   gunzip -c backup_file.sql.gz | psql -h your-db-host -U postgres -d your-db
   ```

2. **Application Recovery:**

   ```bash
   # Redeploy application
   docker-compose down
   docker-compose pull
   docker-compose up -d
   ```

3. **Monitoring Recovery:**

   ```bash
   # Check application health
   curl -f https://your-domain.com/api/health

   # Verify video call functionality
   npm run test:e2e:video-calls
   ```

### Post-Deployment Verification

#### 1. Functional Testing

```bash
# Run production tests
npm run test:production

# Test video call functionality
npm run test:video-calls

# Load testing
npm run test:load
```

#### 2. Monitoring Setup

```typescript
// Set up monitoring alerts
const monitoringConfig = {
  errorRate: { threshold: 0.05, window: "5m" },
  responseTime: { threshold: 2000, window: "1m" },
  connectionFailures: { threshold: 0.1, window: "5m" },
  activeConnections: { threshold: 1000, window: "1m" },
};
```

#### 3. Performance Baseline

```typescript
// Establish performance baselines
const performanceBaselines = {
  connectionTime: 2000, // ms
  iceGatheringTime: 1000, // ms
  signalLatency: 100, // ms
  videoQuality: 0.8, // 0-1 scale
  audioQuality: 0.9, // 0-1 scale
};
```

### Maintenance

#### 1. Regular Updates

```bash
# Update dependencies monthly
npm audit
npm update

# Update Docker images
docker-compose pull
docker-compose up -d
```

#### 2. Database Maintenance

```sql
-- Run monthly maintenance
VACUUM ANALYZE video_calls;
VACUUM ANALYZE webrtc_signals;
VACUUM ANALYZE video_call_quality_metrics;

-- Update statistics
ANALYZE;

-- Check for unused indexes
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

#### 3. Log Rotation

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/video-calls
```

```conf
/var/log/video-calls/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
```

This deployment guide ensures a secure, performant, and maintainable production deployment of the video call system.
