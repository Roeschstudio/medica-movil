# System Architecture Diagram

## Current System Architecture

```mermaid
graph TB
    %% User Layer
    subgraph "User Interface Layer"
        UI[Web Application - Next.js 14]
        Mobile[Mobile Interface]
    end

    %% Authentication Layer
    subgraph "Authentication Layer"
        NextAuth[NextAuth.js]
        SupaAuth[Supabase Auth]
        Middleware[Middleware.ts]
    end

    %% API Layer
    subgraph "API Layer"
        AdminAPI[Admin APIs]
        ChatAPI[Chat APIs]
        VideoAPI[Video APIs]
        PaymentAPI[Payment APIs]
        NotificationAPI[Notification APIs]
    end

    %% Real-time Layer
    subgraph "Real-time Communication"
        SocketIO[Socket.io Server]
        SupaRealtime[Supabase Realtime]
        WebRTC[WebRTC P2P]
    end

    %% Business Logic Layer
    subgraph "Business Logic Layer"
        ChatService[Chat Service]
        VideoService[Video Service]
        PaymentService[Payment Service]
        AdminService[Admin Service]
        NotificationService[Notification Service]
    end

    %% Database Layer
    subgraph "Database Layer"
        Prisma[Prisma ORM]
        SupaDB[(Supabase PostgreSQL)]
        RLS[Row Level Security]
    end

    %% External Services
    subgraph "External Payment Providers"
        Stripe[Stripe]
        PayPal[PayPal]
        MercadoPago[MercadoPago]
    end

    %% File Storage
    subgraph "File Storage"
        SupaStorage[Supabase Storage]
    end

    %% Connections
    UI --> Middleware
    Mobile --> Middleware

    Middleware --> NextAuth
    Middleware --> SupaAuth
    Middleware --> Prisma

    UI --> AdminAPI
    UI --> ChatAPI
    UI --> VideoAPI
    UI --> PaymentAPI
    UI --> NotificationAPI

    AdminAPI --> AdminService
    ChatAPI --> ChatService
    VideoAPI --> VideoService
    PaymentAPI --> PaymentService
    NotificationAPI --> NotificationService

    ChatService --> SocketIO
    ChatService --> SupaRealtime
    VideoService --> SocketIO
    VideoService --> WebRTC
    AdminService --> SocketIO
    NotificationService --> SocketIO

    PaymentService --> Stripe
    PaymentService --> PayPal
    PaymentService --> MercadoPago

    ChatService --> Prisma
    VideoService --> Prisma
    PaymentService --> Prisma
    AdminService --> Prisma
    NotificationService --> Prisma

    Prisma --> SupaDB
    SupaDB --> RLS

    ChatService --> SupaStorage
    VideoService --> SupaStorage
```

## Integration Flow Diagrams

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Middleware
    participant NextAuth
    participant Supabase
    participant Prisma
    participant Database

    User->>Middleware: Request with session
    Middleware->>Supabase: Verify auth token
    Supabase-->>Middleware: User data
    Middleware->>Prisma: Query user role
    Prisma->>Database: SELECT user
    Database-->>Prisma: User record
    Prisma-->>Middleware: User role
    Middleware-->>User: Authorized/Redirect
```

### Real-time Chat Flow

```mermaid
sequenceDiagram
    participant Doctor
    participant SocketIO
    participant ChatService
    participant Database
    participant Patient

    Doctor->>SocketIO: Send message
    SocketIO->>ChatService: Process message
    ChatService->>Database: Store message
    Database-->>ChatService: Confirm storage
    ChatService->>SocketIO: Broadcast message
    SocketIO->>Patient: Deliver message
    SocketIO->>Doctor: Confirm delivery
```

### Video Call Flow

```mermaid
sequenceDiagram
    participant Doctor
    participant SocketIO
    participant VideoService
    participant WebRTC
    participant Patient

    Doctor->>SocketIO: Initiate call
    SocketIO->>VideoService: Create session
    VideoService->>SocketIO: Session created
    SocketIO->>Patient: Call invitation
    Patient->>SocketIO: Accept call
    SocketIO->>Doctor: Call accepted
    Doctor->>WebRTC: Establish P2P
    WebRTC->>Patient: Direct connection
```

### Payment Processing Flow

```mermaid
sequenceDiagram
    participant Patient
    participant PaymentAPI
    participant PaymentService
    participant Provider
    participant Database

    Patient->>PaymentAPI: Select payment method
    PaymentAPI->>PaymentService: Create payment
    PaymentService->>Provider: Process payment
    Provider-->>PaymentService: Payment result
    PaymentService->>Database: Update payment status
    PaymentService-->>PaymentAPI: Payment confirmation
    PaymentAPI-->>Patient: Success/Failure
```

## Component Architecture

### Frontend Component Hierarchy

```
App (Next.js 14)
├── Layout Components
│   ├── MainNav
│   ├── Footer
│   └── Providers
├── Feature Components
│   ├── Admin Dashboard
│   │   ├── Chat Monitoring
│   │   ├── Video Analytics
│   │   ├── Payment Dashboard
│   │   └── Notification Bell
│   ├── Chat System
│   │   ├── Chat Interface
│   │   ├── Message List
│   │   ├── Message Input
│   │   └── File Upload
│   ├── Video Calls
│   │   ├── Video Interface
│   │   ├── Call Controls
│   │   └── Waiting Room
│   └── Payment System
│       ├── Method Selector
│       ├── Provider Forms
│       └── Success/Error Pages
└── Shared Components
    ├── UI Library (Radix + Tailwind)
    ├── Error Boundaries
    └── Loading States
```

### Backend Service Architecture

```
API Routes (Next.js App Router)
├── Authentication
│   ├── NextAuth Configuration
│   └── Registration Endpoints
├── Admin Services
│   ├── Monitoring APIs
│   ├── Analytics APIs
│   └── Management APIs
├── Chat Services
│   ├── Room Management
│   ├── Message APIs
│   └── File Upload
├── Video Services
│   ├── Session Management
│   └── Signaling APIs
├── Payment Services
│   ├── Multi-provider APIs
│   ├── Webhook Handlers
│   └── Status Tracking
└── Notification Services
    ├── Real-time Notifications
    └── Preference Management
```

## Database Schema Overview

### Core Entities

```mermaid
erDiagram
    User ||--o{ Appointment : has
    User ||--o{ Payment : makes
    User ||--o{ ChatMessage : sends
    User ||--o{ Notification : receives

    Doctor ||--|| User : extends
    Patient ||--|| User : extends

    Appointment ||--|| ChatRoom : has
    Appointment ||--o{ Payment : requires

    ChatRoom ||--o{ ChatMessage : contains
    ChatRoom ||--o{ VideoSession : hosts

    Payment ||--o{ PaymentDistribution : splits

    VideoSession ||--o{ VideoSessionParticipant : includes
```

### Integration Tables

- **AdminNotification**: Cross-system admin alerts
- **ChatAnalytics**: Chat system metrics
- **PaymentMetrics**: Payment provider analytics
- **SystemHealth**: Overall system monitoring
- **AdminAction**: Audit trail for admin actions

## Technology Stack Integration

### Frontend Stack

- **Framework**: Next.js 14 with App Router
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: Zustand + React Query
- **Real-time**: Socket.io Client + Supabase Realtime
- **Video**: WebRTC APIs

### Backend Stack

- **Runtime**: Node.js with Next.js API Routes
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js + Supabase Auth
- **Real-time**: Socket.io + Supabase Realtime
- **File Storage**: Supabase Storage

### External Integrations

- **Payment Providers**: Stripe, PayPal, MercadoPago
- **Communication**: WebRTC for video calls
- **Monitoring**: Custom analytics and health checks

## Security Architecture

### Authentication Security

- **Multi-layer Auth**: NextAuth + Supabase + Prisma
- **Session Management**: Secure cookie-based sessions
- **Role-based Access**: Middleware-enforced permissions

### Database Security

- **Row Level Security**: Comprehensive RLS policies
- **Data Encryption**: At-rest and in-transit encryption
- **Audit Logging**: Complete action tracking

### API Security

- **Authentication Required**: All protected endpoints
- **Rate Limiting**: Planned implementation
- **Input Validation**: Zod schema validation

## Performance Considerations

### Current Optimizations

- **Database Indexing**: Proper indexes on frequently queried fields
- **Connection Pooling**: Prisma connection management
- **Component Lazy Loading**: Dynamic imports for large components

### Areas for Improvement

- **Query Optimization**: Cross-system query consolidation
- **Caching Strategy**: Redis implementation planned
- **CDN Integration**: Static asset optimization

## Monitoring and Observability

### Current Monitoring

- **Admin Dashboard**: Real-time system monitoring
- **Health Checks**: API endpoint health monitoring
- **Error Tracking**: Error boundaries and logging

### Planned Enhancements

- **Performance Metrics**: Response time tracking
- **User Analytics**: Usage pattern analysis
- **Alert System**: Automated issue detection

This architecture diagram provides a comprehensive view of the current system integration and serves as the foundation for the upcoming consolidation and optimization tasks.
