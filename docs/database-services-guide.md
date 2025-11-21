# Guía de Servicios de Base de Datos

## Resumen

Este documento describe los servicios de base de datos consolidados en el sistema MedicoMobile y cómo utilizarlos correctamente.

## Servicios Disponibles

### 1. Prisma Client (`lib/db.ts`) - **RECOMENDADO**

**Propósito**: Cliente principal de Prisma con configuración optimizada y manejo de conexiones.

**Cuándo usar**:
- Para todas las operaciones de base de datos en el backend
- Operaciones CRUD con el ORM
- Transacciones complejas
- Consultas con relaciones

**Ejemplo de uso**:
```typescript
import { prisma } from '@/lib/db';

// Crear un usuario
const user = await prisma.user.create({
  data: {
    email: 'usuario@ejemplo.com',
    name: 'Usuario Ejemplo',
    role: 'PATIENT'
  }
});

// Consulta con relaciones
const appointment = await prisma.appointment.findUnique({
  where: { id: appointmentId },
  include: {
    patient: true,
    doctor: { include: { user: true } },
    chatRoom: true
  }
});
```

**Características**:
- Logging configurado por ambiente
- Manejo automático de desconexión
- Singleton pattern para evitar múltiples instancias
- Cleanup automático en terminación del proceso

### 2. Prisma Legacy (`lib/prisma.ts`) - **DEPRECADO**

**Estado**: Este archivo está marcado para eliminación en futuras versiones.

**Migración**: Reemplazar todas las importaciones de `@/lib/prisma` por `@/lib/db`.

```typescript
// ❌ Evitar
import { prisma } from '@/lib/prisma';

// ✅ Usar en su lugar
import { prisma } from '@/lib/db';
```

### 3. Supabase Client (`lib/supabase-client.ts`)

**Propósito**: Cliente de Supabase para operaciones en el frontend y autenticación.

**Cuándo usar**:
- Autenticación de usuarios
- Operaciones en tiempo real (Realtime subscriptions)
- Storage de archivos
- Operaciones desde el frontend

**Ejemplo de uso**:
```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

const supabase = createSupabaseBrowserClient();

// Autenticación
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@ejemplo.com',
  password: 'contraseña'
});

// Suscripción en tiempo real
const channel = supabase
  .channel(`chat-room-${roomId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `chatRoomId=eq.${roomId}`
  }, (payload) => {
    console.log('Nuevo mensaje:', payload.new);
  })
  .subscribe();
```

## Mejores Prácticas

### 1. Selección del Cliente Correcto

```typescript
// Backend/API Routes - Usar Prisma
import { prisma } from '@/lib/db';

// Frontend/Componentes - Usar Supabase para auth y realtime
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
```

### 2. Manejo de Errores

```typescript
try {
  const result = await prisma.user.create({ data: userData });
  return result;
} catch (error) {
  console.error('Error creating user:', error);
  throw new Error('Failed to create user');
}
```

### 3. Transacciones

```typescript
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const profile = await tx.doctorProfile.create({
    data: { userId: user.id, ...profileData }
  });
  return { user, profile };
});
```

### 4. Optimización de Consultas

```typescript
// ✅ Incluir solo los campos necesarios
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true,
    role: true
  }
});

// ✅ Usar include para relaciones necesarias
const appointment = await prisma.appointment.findMany({
  include: {
    patient: { select: { name: true, email: true } },
    doctor: { 
      select: { 
        specialty: true,
        user: { select: { name: true } }
      }
    }
  }
});
```

## Migración y Consolidación

### Estado Actual
- ✅ `lib/db.ts` - Servicio principal consolidado
- ⚠️ `lib/prisma.ts` - Marcado para eliminación
- ✅ `lib/supabase-client.ts` - Servicio especializado para frontend

### Acciones Requeridas
1. Migrar todas las importaciones de `@/lib/prisma` a `@/lib/db`
2. Verificar que no hay conflictos de instancias de Prisma
3. Eliminar `lib/prisma.ts` una vez completada la migración

### Script de Migración
```bash
# Buscar y reemplazar importaciones
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@\/lib\/prisma/@\/lib\/db/g'
```

## Troubleshooting

### Problema: Múltiples instancias de Prisma
**Solución**: Asegurar que solo se usa `@/lib/db` en todo el proyecto.

### Problema: Conexiones no cerradas
**Solución**: El cliente en `lib/db.ts` maneja automáticamente la desconexión.

### Problema: Errores de autenticación en Supabase
**Solución**: Verificar variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

**Última actualización**: Fase 3 del Plan de Reparación
**Responsable**: Sistema de Consolidación Backend