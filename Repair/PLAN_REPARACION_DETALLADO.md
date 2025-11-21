# Plan Detallado de Reparación del Sistema MedicoMobile

## Resumen Ejecutivo
Este documento detalla el plan específico de reparación del sistema, con acciones concretas, secuencia de pasos y criterios de decisión para cada área del sistema que requiere intervención.

---

## FASE 1: PREPARACIÓN Y BACKUP

### 1.1 Creación de Estructura de Backup
**Acción:** Crear carpeta `.backup` y subcarpetas organizadas

```bash
# Crear estructura de backup
mkdir -p .backup/components-duplicados
mkdir -p .backup/lib-duplicados
mkdir -p .backup/api-routes-duplicadas
mkdir -p .backup/temporales
mkdir -p .backup/archivos-eliminados-$(date +%Y%m%d)
```

### 1.2 Documentación Inicial
**Acción:** Crear archivo de registro de cambios

```bash
# Crear archivo de log
echo "=== INICIO DE REPARACIÓN - $(date) ===" > REPARACION_LOG.md
echo "Commit inicial: $(git rev-parse HEAD)" >> REPARACION_LOG.md
```

---

## FASE 2: CONSOLIDACIÓN DE FRONTEND

### 2.1 Componentes de Chat - Decisión y Consolidación

#### Análisis de Archivos Duplicados:
1. **`components/chat-room.tsx`** vs **`components/optimized-chat-room.tsx`**
2. **`components/chat-interface.tsx`** vs **`components/chat/chat-interface.tsx`**

#### Criterios de Selección:
- **Funcionalidad completa:** Verificar cuál tiene más características
- **Performance:** `optimized-chat-room.tsx` sugiere mejor optimización
- **Mantenimiento:** Estructura y comentarios del código

#### Acción 2.1.1: Análisis de Componentes de Chat
```bash
# Leer y comparar archivos
cat components/chat-room.tsx | head -20
cat components/optimized-chat-room.tsx | head -20
cat components/chat-interface.tsx | head -20
cat components/chat/chat-interface.tsx | head -20
```

#### Decisión Recomendada:
- **Mantener:** `components/optimized-chat-room.tsx` (versión optimizada)
- **Mantener:** `components/chat/chat-interface.tsx` (estructura organizada)
- **Mover a backup:** `components/chat-room.tsx`, `components/chat-interface.tsx`

#### Acción 2.1.2: Ejecución de Consolidación
```bash
# Mover archivos a backup
mv components/chat-room.tsx .backup/components-duplicados/
mv components/chat-interface.tsx .backup/components-duplicados/

# Actualizar imports en archivos que referencian los archivos movidos
# (Necesita búsqueda y reemplazo global)
```

### 2.2 Componentes de Video Llamadas - Consolidación

#### Archivos Duplicados Identificados:
1. **`components/video-call-interface.tsx`** vs **`components/video-call/VideoCallInterface.tsx`**
2. **`components/video-call-page.tsx`** vs **`components/video-call/VideoCallPage.tsx`**

#### Criterios de Selección:
- **Organización:** Los archivos en subcarpeta están mejor organizados
- **Funcionalidad:** Verificar características adicionales
- **Consistencia:** Mantener estructura de subcarpetas

#### Decisión Recomendada:
- **Mantener:** `components/video-call/VideoCallInterface.tsx`
- **Mantener:** `components/video-call/VideoCallPage.tsx`
- **Mover a backup:** `components/video-call-interface.tsx`, `components/video-call-page.tsx`

#### Acción 2.2.1: Ejecución de Consolidación
```bash
# Mover archivos a backup
mv components/video-call-interface.tsx .backup/components-duplicados/
mv components/video-call-page.tsx .backup/components-duplicados/

# Actualizar imports en toda la aplicación
```

### 2.3 Componentes de Administración - Consolidación

#### Archivos Duplicados:
1. **`components/admin-dashboard.tsx`** vs **`components/admin/payment-dashboard.tsx`**
2. **`components/connection-status.tsx`** vs **`components/admin/connection-status.tsx`**

#### Análisis Requerido:
- Verificar si son funcionalidades diferentes o duplicadas
- Evaluar integración con sistema principal

#### Decisión Recomendada:
- **Mantener ambos:** Parecen ser funcionalidades diferentes (dashboard general vs dashboard de pagos)
- **Renombrar para claridad:** 
  - `components/admin-dashboard.tsx` → `components/admin/main-dashboard.tsx`
  - `components/admin/payment-dashboard.tsx` → mantener como está

#### Acción 2.3.1: Renombrar para Claridad
```bash
# Renombrar archivo para mayor claridad
mv components/admin-dashboard.tsx components/admin/main-dashboard.tsx

# Actualizar imports
```

### 2.4 Componentes de File Upload - Consolidación

#### Archivos Duplicados:
- **`components/file-upload.tsx`** vs **`components/chat/file-upload.tsx`**

#### Análisis:
- Verificar si son genéricos vs específicos para chat
- Evaluar reutilización

#### Decisión Recomendada:
- **Mantener:** `components/file-upload.tsx` (versión genérica)
- **Mover a backup:** `components/chat/file-upload.tsx`
- **Actualizar:** Componente de chat para usar versión genérica

#### Acción 2.4.1: Consolidación
```bash
# Mover archivo específico a backup
mv components/chat/file-upload.tsx .backup/components-duplicados/

# Actualizar componente de chat para usar versión genérica
```

---

## FASE 3: CONSOLIDACIÓN DE BACKEND

### 3.1 Servicios de Autenticación - Consolidación

#### Archivos Duplicados Identificados:
1. **`lib/auth.ts`** vs **`lib/unified-auth.ts`** vs **`lib/supabase-auth.ts`**
2. **`lib/temp-auth-for-testing.ts`** (archivo temporal)

#### Análisis Requerido:
- Comparar funcionalidades de cada archivo
- Identificar cuál es el más completo y actualizado
- Verificar dependencias y compatibilidad

#### Criterios de Selección:
- **Completeness:** `unified-auth.ts` sugiere ser la versión más completa
- **Actualización:** Fechas de modificación
- **Dependencias:** Integración con sistema actual

#### Decisión Recomendada:
- **Mantener:** `lib/unified-auth.ts` (versión unificada)
- **Mover a backup:** `lib/auth.ts`, `lib/supabase-auth.ts`
- **Eliminar:** `lib/temp-auth-for-testing.ts` (archivo temporal)

#### Acción 3.1.1: Consolidación de Autenticación
```bash
# Mover archivos a backup
mv lib/auth.ts .backup/lib-duplicados/
mv lib/supabase-auth.ts .backup/lib-duplicados/
mv lib/temp-auth-for-testing.ts .backup/temporales/

# Actualizar todos los imports en el sistema
```

### 3.2 Servicios de Chat - Consolidación

#### Archivos Duplicados:
- **`lib/chat-service.ts`** vs **`lib/chat-api.ts`**

#### Análisis:
- Comparar responsabilidades y funcionalidades
- Verificar si son complementarios o duplicados

#### Decisión Recomendada:
- **Mantener ambos:** Parecen ser capas diferentes (service vs API)
- **Renombrar para claridad:**
  - `lib/chat-service.ts` → `lib/chat/chat-service.ts`
  - `lib/chat-api.ts` → `lib/chat/chat-api.ts`

#### Acción 3.2.1: Reorganización
```bash
# Crear estructura organizada
mkdir -p lib/chat

# Mover archivos a nueva estructura
mv lib/chat-service.ts lib/chat/
mv lib/chat-api.ts lib/chat/

# Actualizar imports
```

### 3.3 Servicios de Base de Datos - Consolidación

#### Archivos Duplicados:
- **`lib/db.ts`** vs **`lib/prisma.ts`** vs **`lib/supabase-client.ts`**

#### Análisis:
- Verificar si son para diferentes propósitos
- Evaluar cuál es el principal

#### Decisión Recomendada:
- **Mantener todos:** Parecen ser para diferentes propósitos
  - `lib/db.ts` - Conexión general
  - `lib/prisma.ts` - Cliente Prisma
  - `lib/supabase-client.ts` - Cliente Supabase
- **Documentar:** Crear documentación clara de cuándo usar cada uno

#### Acción 3.3.1: Documentación
```bash
# Crear documentación de uso
cat > lib/DATABASE_README.md << EOF
# Guía de Conexión a Base de Datos

## Archivos Disponibles:
- db.ts: Conexión general a la base de datos
- prisma.ts: Cliente Prisma para ORM
- supabase-client.ts: Cliente Supabase para operaciones específicas

## Cuándo usar cada uno:
- db.ts: Operaciones genéricas de base de datos
- prisma.ts: Operaciones con modelos Prisma
- supabase-client.ts: Operaciones específicas de Supabase
EOF
```

---

## FASE 4: CONSOLIDACIÓN DE API ROUTES

### 4.1 Rutas de Admin - Consolidación

#### Rutas Potencialmente Duplicadas:
- `/api/admin/analytics/` (múltiples endpoints)
- `/api/admin/reports/route.ts` vs `/api/admin/stats/route.ts`

#### Análisis:
- Verificar si se pueden consolidar endpoints de analíticas
- Evaluar diferencia entre reports y stats

#### Decisión Recomendada:
- **Consolidar analíticas:** Crear endpoint unificado con parámetros
- **Mantener separados:** reports y stats parecen ser propósitos diferentes

#### Acción 4.1.1: Consolidación de Analíticas
```bash
# Crear endpoint unificado de analíticas
# Mantener estructura existente pero agregar endpoint consolidado
cat > app/api/admin/analytics/consolidated/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // overview, performance, trends, usage
  
  // Lógica consolidada para diferentes tipos de analíticas
  switch (type) {
    case 'overview':
      // Importar y ejecutar lógica de overview
      break;
    case 'performance':
      // Importar y ejecutar lógica de performance
      break;
    // ... otros tipos
  }
}
EOF
```

### 4.2 Rutas de Chat - Consolidación

#### Rutas con Funcionalidad Superpuesta:
- `/api/chat/messages/route.ts` vs `/api/chat/[roomId]/route.ts`

#### Análisis:
- Verificar responsabilidades de cada ruta
- Evaluar si pueden consolidarse

#### Decisión Recomendada:
- **Mantener separados:** Sirven propósitos diferentes
  - `/api/chat/messages/route.ts` - Operaciones generales de mensajes
  - `/api/chat/[roomId]/route.ts` - Operaciones específicas de sala

#### Acción 4.2.1: Documentación Clara
```bash
# Crear documentación de rutas de chat
cat > app/api/chat/ROUTES_README.md << 'EOF'
# Rutas de Chat API

## Endpoints Disponibles:

### Mensajes:
- GET/POST /api/chat/messages - Operaciones generales de mensajes
- GET/POST /api/chat/[roomId]/route - Operaciones específicas de sala

### Salas:
- GET/POST /api/chat/rooms - Gestión de salas
- GET/POST /api/chat/status/[id] - Estado de salas

### Archivos:
- POST /api/chat/upload - Upload de archivos de chat
EOF
```

---

## FASE 5: ACTUALIZACIÓN DE IMPORTS Y REFERENCIAS

### 5.1 Búsqueda Global de Imports

#### Acción 5.1.1: Encontrar todos los archivos que importan los archivos movidos
```bash
# Buscar imports de archivos movidos
grep -r "from.*chat-room" app/ components/ lib/ --include="*.ts" --include="*.tsx"
grep -r "from.*chat-interface" app/ components/ lib/ --include="*.ts" --include="*.tsx"
grep -r "from.*video-call-interface" app/ components/ lib/ --include="*.ts" --include="*.tsx"
grep -r "from.*auth" app/ components/ lib/ --include="*.ts" --include="*.tsx"
```

### 5.2 Actualización Sistemática de Imports

#### Acción 5.2.1: Crear script de actualización
```bash
# Crear script para actualizar imports
cat > update_imports.sh << 'EOF'
#!/bin/bash

# Actualizar imports de chat-room
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|from.*chat-room|from ./optimized-chat-room|g'

# Actualizar imports de video-call-interface
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|from.*video-call-interface|from ./video-call/VideoCallInterface|g'

# Actualizar imports de auth
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|from.*auth|from ./unified-auth|g'

echo "Imports actualizados"
EOF

chmod +x update_imports.sh
```

---

## FASE 6: VALIDACIÓN Y TESTING

### 6.1 Verificación de Estructura

#### Acción 6.1.1: Verificar que no queden referencias rotas
```bash
# Verificar imports rotos
npm run build 2>&1 | grep "Cannot find module" > broken_imports.log

# Revisar log de imports rotos
if [ -s broken_imports.log ]; then
    echo "Se encontraron imports rotos:"
    cat broken_imports.log
else
    echo "No se encontraron imports rotos"
fi
```

### 6.2 Testing Funcional

#### Acción 6.2.1: Ejecutar suite de tests
```bash
# Ejecutar tests existentes
npm test

# Verificar cobertura
npm run test:coverage
```

### 6.3 Validación Manual

#### Checklist de Validación:
- [ ] La aplicación inicia sin errores
- [ ] Sistema de autenticación funciona
- [ ] Páginas principales cargan correctamente
- [ ] Componentes de chat funcionan
- [ ] Sistema de video llamadas operativo
- [ ] Dashboard de admin funcional
- [ ] Sistema de pagos operativo

---

## FASE 7: DOCUMENTACIÓN FINAL

### 7.1 Actualización de Roadmap

#### Acción 7.1.1: Documentar cambios realizados
```bash
# Actualizar roadmap con cambios realizados
cat >> ROADMAP_REPARACION_SISTEMA.md << 'EOF'

## CAMBIOS REALIZADOS - $(date)

### Componentes Consolidados:
- chat-room.tsx → optimized-chat-room.tsx
- chat-interface.tsx → chat/chat-interface.tsx
- video-call-interface.tsx → video-call/VideoCallInterface.tsx
- video-call-page.tsx → video-call/VideoCallPage.tsx

### Servicios Consolidados:
- auth.ts → unified-auth.ts
- chat-service.ts → chat/chat-service.ts
- chat-api.ts → chat/chat-api.ts

### Archivos Eliminados:
- temp-auth-for-testing.ts
- Componentes duplicados movidos a .backup/

### Próximos Pasos:
- [ ] Validar funcionamiento completo
- [ ] Optimizar performance
- [ ] Actualizar documentación de API
EOF
```

### 7.2 Creación de Documentación de Arquitectura

#### Acción 7.2.1: Documentar nueva estructura
```bash
# Crear documentación de arquitectura actualizada
cat > ARQUITECTURA_ACTUALIZADA.md << 'EOF'
# Arquitectura del Sistema MedicoMobile - Actualizada

## Estructura de Componentes

### Componentes Principales:
- components/optimized-chat-room.tsx - Sala de chat optimizada
- components/video-call/ - Componentes de video llamadas
- components/admin/ - Componentes de administración
- components/ui/ - Componentes UI reutilizables

## Servicios Backend

### Servicios Principales:
- lib/unified-auth.ts - Autenticación unificada
- lib/chat/ - Servicios de chat
- lib/payments/ - Sistema de pagos
- lib/integrations/ - Integraciones externas

## API Routes

### Estructura Organizada:
- app/api/auth/ - Autenticación
- app/api/admin/ - Administración
- app/api/chat/ - Chat y mensajería
- app/api/payments/ - Pagos
- app/api/video/ - Video llamadas

## Convenciones Establecidas

### Nomenclatura:
- Componentes: PascalCase.tsx
- Servicios: kebab-case.ts
- API routes: kebab-case/route.ts

### Organización:
- Componentes específicos en subcarpetas
- Servicios relacionados en subcarpetas
- Documentación en README.md local
EOF
```

---

## FASE 8: MONITOREO POST-REPARACIÓN

### 8.1 Monitoreo de Errores

#### Acción 8.1.1: Configurar monitoreo
```bash
# Verificar logs de errores en producción
tail -f logs/error.log

# Monitorear performance
npm run perf:monitor
```

### 8.2 Checklist de Verificación Final

#### Verificación Final:
- [ ] No hay errores en consola
- [ ] Todas las funcionalidades principales operativas
- [ ] Performance aceptable
- [ ] Documentación actualizada
- [ ] Tests pasando
- [ ] Backup completo realizado
- [ ] Registro de cambios documentado

---

## CRONOGRAMA EJECUTIVO

### Día 1: Preparación y Backup
- Mañana: Crear estructura de backup
- Tarde: Documentación inicial y análisis

### Día 2: Consolidación Frontend
- Mañana: Componentes de chat y video
- Tarde: Componentes de admin y utilidades

### Día 3: Consolidación Backend
- Mañana: Servicios de autenticación y chat
- Tarde: Servicios de base de datos y API routes

### Día 4: Actualización y Testing
- Mañana: Actualización de imports y referencias
- Tarde: Testing y validación

### Día 5: Documentación y Finalización
- Mañana: Documentación final
- Tarde: Verificación final y monitoreo

---

*Este plan debe ejecutarse secuencialmente, verificando cada paso antes de continuar con el siguiente.*
