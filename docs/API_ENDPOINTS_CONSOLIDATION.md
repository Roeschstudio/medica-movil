# API Endpoints Consolidation - FASE 4

## Analytics Endpoints Consolidation

### Endpoint Unificado: `/api/admin/analytics/consolidated`

**Antes (Endpoints Duplicados):**
- `/api/admin/analytics/overview` - Métricas generales
- `/api/admin/analytics/performance` - Métricas de rendimiento
- `/api/admin/analytics/trends` - Tendencias temporales
- `/api/admin/analytics/usage` - Métricas de uso
- `/api/admin/analytics/report` - Generación de reportes

**Después (Endpoint Consolidado):**
- `/api/admin/analytics/consolidated?type={type}&timeframe={timeframe}`

#### Parámetros del Endpoint Consolidado:

**Query Parameters:**
- `type`: Tipo de analytics a obtener
  - `overview` - Métricas generales (sesiones, mensajes, usuarios)
  - `performance` - Métricas de rendimiento (tiempo de respuesta, uptime, errores)
  - `trends` - Tendencias temporales (volumen de mensajes, actividad de usuarios)
  - `usage` - Métricas de uso (usuarios activos, archivos subidos, especialidades)
- `timeframe`: Período de tiempo
  - `1h` - Última hora
  - `24h` - Últimas 24 horas (por defecto)
  - `7d` - Últimos 7 días
  - `30d` - Últimos 30 días

#### Métodos HTTP:

**GET** - Obtener analytics en tiempo real
```
GET /api/admin/analytics/consolidated?type=overview&timeframe=24h
```

**POST** - Generar reportes personalizados
```
POST /api/admin/analytics/consolidated
Body: {
  "type": "custom",
  "timeframe": "custom",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "format": "json"
}
```

#### Diferencias entre Reports y Stats:

**Stats (GET):**
- Datos en tiempo real
- Respuesta inmediata
- Formato JSON estructurado
- Ideal para dashboards
- Datos agregados y calculados

**Reports (POST):**
- Datos históricos personalizados
- Procesamiento más lento
- Formato exportable (JSON)
- Ideal para análisis detallado
- Datos completos con metadatos
- Incluye información del generador
- Timestamps de generación

### Beneficios de la Consolidación:

1. **Reducción de Duplicación**: Eliminación de 5 endpoints separados
2. **Mantenimiento Simplificado**: Un solo archivo para todas las funcionalidades
3. **Consistencia**: Misma estructura de autenticación y validación
4. **Flexibilidad**: Parámetros permiten diferentes tipos de consultas
5. **Escalabilidad**: Fácil agregar nuevos tipos de analytics

---

## Chat Endpoints Analysis

### Estructura Actual (No Duplicada - Funcionalidades Complementarias):

#### `/api/chat/messages` - Gestión de Mensajes
**Propósito**: CRUD operations para mensajes de chat
- **GET**: Obtener mensajes de una sala con filtros y paginación
- **POST**: Enviar nuevo mensaje
- **Funcionalidades**:
  - Filtros por tipo de mensaje, remitente, estado de lectura
  - Paginación avanzada
  - Sanitización de contenido
  - Rate limiting por usuario
  - Validación de acceso a sala

#### `/api/chat/[roomId]` - Gestión de Salas
**Propósito**: CRUD operations para salas de chat
- **GET**: Obtener información completa de la sala
- **PATCH**: Actualizar estado de la sala (solo doctores)
- **DELETE**: Eliminar sala y todos sus mensajes (solo doctores)
- **Funcionalidades**:
  - Información de cita asociada
  - Conteo de mensajes no leídos
  - Últimos 10 mensajes
  - Estadísticas de la sala
  - Control de acceso por rol

#### `/api/chat/messages/secure` - Mensajes con Seguridad Avanzada
**Propósito**: Versión segura para mensajes sensibles
- **GET**: Obtener mensajes con auditoría de seguridad
- **POST**: Enviar mensajes con validación avanzada
- **Funcionalidades**:
  - Logging de eventos de seguridad
  - Sanitización avanzada de contenido
  - Rate limiting específico para chat
  - Auditoría de accesos
  - Límites por rol de usuario

#### `/api/chat/messages/read` - Control de Lectura
**Propósito**: Marcar mensajes como leídos
- **PUT**: Actualizar estado de lectura de mensajes
- **Funcionalidades**:
  - Marcar mensajes específicos o todos los no leídos
  - Excluir mensajes propios
  - Validación de acceso a sala

### Conclusión sobre Chat Endpoints:

**NO HAY DUPLICACIÓN** - Cada endpoint tiene un propósito específico:
- `/messages` - Operaciones básicas de mensajes
- `/[roomId]` - Operaciones de sala
- `/messages/secure` - Versión con seguridad avanzada
- `/messages/read` - Control de estado de lectura

Estos endpoints son **complementarios** y no duplicados. Mantener la estructura actual es la decisión correcta.

---

## Archivos Movidos a Backup:

### Analytics (Consolidados):
- `.backup/app/api/admin/analytics/overview-old/`
- `.backup/app/api/admin/analytics/performance-old/`
- `.backup/app/api/admin/analytics/report-old/`
- `.backup/app/api/admin/analytics/trends-old/`
- `.backup/app/api/admin/analytics/usage-old/`

### Chat (Mantenidos):
- No se movieron archivos - estructura correcta mantenida

---

## Próximos Pasos:

1. ✅ Consolidar endpoints de analytics
2. ✅ Analizar estructura de chat
3. ✅ Documentar diferencias entre reports y stats
4. ⏳ Actualizar referencias en frontend
5. ⏳ Actualizar tests
6. ⏳ Validar funcionalidad consolidada

---

**Fecha de Consolidación**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Fase**: 4 - Consolidación de API Routes
**Estado**: En Progreso