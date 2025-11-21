# Chat Endpoints Documentation

## Estructura de Endpoints de Chat

### 1. `/api/chat/messages` - Gestión Principal de Mensajes

#### GET - Obtener Mensajes
```typescript
GET /api/chat/messages?roomId={roomId}&page={page}&limit={limit}&type={type}&senderId={senderId}&unreadOnly={boolean}
```

**Parámetros Query:**
- `roomId` (requerido): ID de la sala de chat
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Mensajes por página (default: 50, max: 100)
- `type` (opcional): Filtrar por tipo de mensaje
- `senderId` (opcional): Filtrar por remitente específico
- `unreadOnly` (opcional): Solo mensajes no leídos

**Respuesta:**
```json
{
  "messages": [
    {
      "id": "string",
      "content": "string",
      "senderId": "string",
      "senderName": "string",
      "senderRole": "DOCTOR|PATIENT",
      "timestamp": "ISO8601",
      "type": "TEXT|FILE|IMAGE",
      "isRead": boolean,
      "fileUrl": "string?",
      "fileName": "string?"
    }
  ],
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "totalPages": number
  }
}
```

#### POST - Enviar Mensaje
```typescript
POST /api/chat/messages
```

**Body:**
```json
{
  "roomId": "string",
  "content": "string",
  "type": "TEXT|FILE|IMAGE",
  "fileUrl": "string?",
  "fileName": "string?"
}
```

**Validaciones:**
- Contenido requerido para mensajes de texto
- fileUrl requerido para mensajes de archivo/imagen
- Límite de 1000 caracteres para contenido
- Rate limiting: 30 mensajes por minuto por usuario

---

### 2. `/api/chat/[roomId]` - Gestión de Salas

#### GET - Obtener Información de Sala
```typescript
GET /api/chat/[roomId]
```

**Respuesta:**
```json
{
  "room": {
    "id": "string",
    "appointmentId": "string",
    "doctorId": "string",
    "patientId": "string",
    "status": "ACTIVE|CLOSED|ARCHIVED",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "appointment": {
      "id": "string",
      "date": "ISO8601",
      "specialty": "string",
      "status": "string"
    },
    "doctor": {
      "id": "string",
      "name": "string",
      "specialty": "string"
    },
    "patient": {
      "id": "string",
      "name": "string"
    }
  },
  "stats": {
    "totalMessages": number,
    "unreadCount": number,
    "lastActivity": "ISO8601"
  },
  "recentMessages": [
    // Últimos 10 mensajes
  ]
}
```

#### PATCH - Actualizar Estado de Sala (Solo Doctores)
```typescript
PATCH /api/chat/[roomId]
```

**Body:**
```json
{
  "status": "ACTIVE|CLOSED|ARCHIVED"
}
```

#### DELETE - Eliminar Sala (Solo Doctores)
```typescript
DELETE /api/chat/[roomId]
```

**Efecto:**
- Elimina la sala y todos sus mensajes
- Acción irreversible
- Solo disponible para doctores

---

### 3. `/api/chat/messages/secure` - Mensajes con Seguridad Avanzada

#### GET - Obtener Mensajes con Auditoría
```typescript
GET /api/chat/messages/secure?roomId={roomId}&auditLevel={level}
```

**Parámetros Adicionales:**
- `auditLevel`: Nivel de auditoría (BASIC|DETAILED|FULL)

**Características Especiales:**
- Logging automático de accesos
- Sanitización avanzada de contenido
- Rate limiting específico: 20 requests por minuto
- Auditoría de eventos de seguridad

#### POST - Enviar Mensaje Seguro
```typescript
POST /api/chat/messages/secure
```

**Validaciones Adicionales:**
- Sanitización avanzada de contenido
- Detección de contenido sensible
- Límites por rol:
  - Doctores: 50 mensajes/hora
  - Pacientes: 30 mensajes/hora
- Logging de eventos de seguridad

---

### 4. `/api/chat/messages/read` - Control de Estado de Lectura

#### PUT - Marcar Mensajes como Leídos
```typescript
PUT /api/chat/messages/read
```

**Body:**
```json
{
  "roomId": "string",
  "messageIds": ["string"] // Opcional: IDs específicos
}
```

**Comportamiento:**
- Si `messageIds` no se proporciona: marca todos los mensajes no leídos de la sala
- Excluye automáticamente mensajes enviados por el usuario actual
- Actualiza timestamp de lectura

**Respuesta:**
```json
{
  "markedAsRead": number,
  "updatedMessages": ["string"]
}
```

---

## Flujo de Uso Típico

### 1. Acceder a una Sala de Chat
```typescript
// 1. Obtener información de la sala
GET /api/chat/room123

// 2. Obtener mensajes recientes
GET /api/chat/messages?roomId=room123&page=1&limit=20

// 3. Marcar mensajes como leídos
PUT /api/chat/messages/read
Body: { "roomId": "room123" }
```

### 2. Enviar un Mensaje
```typescript
// 1. Enviar mensaje de texto
POST /api/chat/messages
Body: {
  "roomId": "room123",
  "content": "Hola, ¿cómo se encuentra?",
  "type": "TEXT"
}

// 2. Para mensajes sensibles, usar endpoint seguro
POST /api/chat/messages/secure
Body: {
  "roomId": "room123",
  "content": "Información médica confidencial",
  "type": "TEXT"
}
```

### 3. Gestión de Sala (Solo Doctores)
```typescript
// 1. Cerrar sala después de consulta
PATCH /api/chat/room123
Body: { "status": "CLOSED" }

// 2. Archivar sala antigua
PATCH /api/chat/room123
Body: { "status": "ARCHIVED" }
```

---

## Rate Limiting

| Endpoint | Límite | Ventana |
|----------|--------|----------|
| `/messages` GET | 100 requests | 1 minuto |
| `/messages` POST | 30 mensajes | 1 minuto |
| `/messages/secure` GET | 20 requests | 1 minuto |
| `/messages/secure` POST | 50 (doctor) / 30 (paciente) | 1 hora |
| `/[roomId]` GET | 60 requests | 1 minuto |
| `/[roomId]` PATCH/DELETE | 10 requests | 1 minuto |
| `/messages/read` PUT | 30 requests | 1 minuto |

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Datos de entrada inválidos |
| 401 | No autenticado |
| 403 | Sin permisos para acceder a la sala |
| 404 | Sala o mensaje no encontrado |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

---

## Seguridad

### Autenticación
- Todos los endpoints requieren autenticación JWT
- Validación de sesión activa

### Autorización
- Acceso a sala validado por participación (doctor/paciente)
- Operaciones de gestión de sala restringidas a doctores
- Rate limiting por usuario y rol

### Sanitización
- Contenido de mensajes sanitizado automáticamente
- Detección de contenido malicioso
- Validación de tipos de archivo permitidos

---

**Última Actualización**: 2024-01-15
**Versión API**: 1.0
**Mantenedor**: Sistema MedicaMóvil