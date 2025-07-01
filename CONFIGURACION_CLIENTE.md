# 🔧 Configuración Técnica - Medica Movil

## 📋 Checklist de Datos del Cliente

### ✅ **DATOS CRÍTICOS PARA COMPLETAR EL PROYECTO**

#### 🏢 **1. INFORMACIÓN DE LA EMPRESA**
```
□ Nombre Legal: ________________________________
□ RFC: _________________________________________
□ Dirección Fiscal: ____________________________
□ Ciudad/Estado: _______________________________
□ Código Postal: _______________________________
□ Teléfono Principal: ___________________________
□ Email Corporativo: ____________________________
□ Sitio Web Actual: _____________________________
```

#### 👨‍⚕️ **2. INFORMACIÓN MÉDICA**
```
□ Licencia Sanitaria: ___________________________
□ Registro COFEPRIS: ____________________________
□ Número CONAMED: _______________________________
□ Póliza de Seguro Médico: ______________________
□ Vigencia de Certificaciones: __________________
```

#### 💳 **3. SISTEMA DE PAGOS**
```
□ ¿Tienen cuenta Stripe? [ ] Sí [ ] No
□ Email de cuenta Stripe: _______________________
□ ¿Necesitan ayuda configurando Stripe? [ ] Sí [ ] No
□ Cuenta bancaria para recibir pagos: _____________
□ CLABE interbancaria: ___________________________
```

#### 🎨 **4. RECURSOS VISUALES**
```
□ Logo en PNG/SVG (alta resolución): [ ] Enviado
□ Colores corporativos específicos: _______________
□ Fotos del equipo médico: [ ] Enviadas
□ Imágenes de instalaciones: [ ] Enviadas
```

#### 🌐 **5. DOMINIO Y HOSTING**
```
□ Dominio deseado: ______________________________
□ ¿Ya tienen el dominio? [ ] Sí [ ] No
□ Proveedor actual: _____________________________
□ Acceso a configuración DNS: [ ] Sí [ ] No
```

---

## 🔐 **Variables de Entorno para Producción**

### **Archivo .env.production (Cliente debe proporcionar)**
```env
# Base de datos de producción
DATABASE_URL="postgresql://usuario:contraseña@host:puerto/database"

# Autenticación (generar nuevo secreto)
NEXTAUTH_SECRET="[GENERAR_SECRETO_UNICO_64_CARACTERES]"
NEXTAUTH_URL="https://su-dominio.com.mx"

# Stripe (datos reales del cliente)
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Emails (configurar servicio)
EMAIL_SERVER_HOST="smtp.sendgrid.net"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="apikey"
EMAIL_SERVER_PASSWORD="[API_KEY_SENDGRID]"
EMAIL_FROM="noreply@su-dominio.com.mx"

# URLs de la aplicación
NEXT_PUBLIC_APP_URL="https://su-dominio.com.mx"
NEXT_PUBLIC_API_URL="https://su-dominio.com.mx/api"
```

---

## 🏥 **Datos Médicos Reales Necesarios**

### **Doctores Reales**
Por cada doctor necesitamos:
```
□ Nombre completo: _____________________________
□ Especialidad principal: ______________________
□ Cédula profesional: ___________________________
□ Universidad de egreso: ________________________
□ Años de experiencia: __________________________
□ Foto profesional: [ ] Enviada
□ Biografía (200 palabras): _____________________
□ Consultorios donde atiende: ___________________
□ Horarios de disponibilidad: ___________________
□ Precio de consulta: ___________________________
□ Email personal: _______________________________
□ Teléfono: ____________________________________
```

### **Especialidades Ofrecidas**
```
□ Lista completa de especialidades que ofrecen
□ Precios por especialidad
□ Disponibilidad (presencial/virtual/domicilio)
□ Requisitos especiales por especialidad
```

---

## 📧 **Configuración de Emails**

### **Cuentas de Email Necesarias**
```
□ info@su-dominio.com.mx (información general)
□ citas@su-dominio.com.mx (confirmaciones de citas)
□ soporte@su-dominio.com.mx (soporte técnico)
□ admin@su-dominio.com.mx (administración)
□ noreply@su-dominio.com.mx (emails automáticos)
```

### **Templates de Email a Personalizar**
- ✉️ Confirmación de registro
- ✉️ Confirmación de cita agendada
- ✉️ Recordatorio de cita (24h antes)
- ✉️ Cancelación de cita
- ✉️ Reagendamiento de cita
- ✉️ Solicitud de reseña post-consulta
- ✉️ Recuperación de contraseña

---

## 🗄️ **Base de Datos de Producción**

### **Opción 1: Railway (Recomendada)**
```
□ Crear cuenta en railway.app
□ Crear proyecto PostgreSQL
□ Obtener DATABASE_URL
□ Configurar backups automáticos
□ Costo: ~$5-10 USD/mes
```

### **Opción 2: Supabase**
```
□ Crear cuenta en supabase.com
□ Crear proyecto
□ Obtener DATABASE_URL
□ Configurar Row Level Security
□ Costo: Gratis hasta 500MB
```

### **Migración de Datos**
Una vez configurada la base de producción:
1. Ejecutar `npx prisma db push`
2. Ejecutar seed con datos reales
3. Migrar usuarios de prueba a reales

---

## 📱 **Configuración de WhatsApp Business**

### **Datos Necesarios**
```
□ Número de WhatsApp Business: __________________
□ Token de API (si tienen): _____________________
□ ¿Quieren integración automática? [ ] Sí [ ] No
□ Horarios de atención por WhatsApp: ____________
```

---

## 🔍 **SEO y Analytics**

### **Google Analytics**
```
□ Crear cuenta Google Analytics
□ Obtener Tracking ID
□ Configurar objetivos de conversión
□ Tracking ID: GA-________________
```

### **Google Search Console**
```
□ Verificar propiedad del dominio
□ Enviar sitemap
□ Configurar alertas
```

### **Datos para SEO**
```
□ Palabras clave principales: ____________________
□ Descripción del negocio (160 caracteres): _______
□ Ciudad/región principal de operación: __________
□ Competidores directos: _________________________
```

---

## 📞 **Números de Teléfono**

### **Números Reales Necesarios**
```
□ Línea principal: ______________________________
□ Emergencias médicas: __________________________
□ Soporte técnico: ______________________________
□ WhatsApp: ____________________________________
□ ¿Tienen call center? [ ] Sí [ ] No
□ Horarios de atención telefónica: ______________
```

---

## 🛡️ **Certificaciones y Licencias**

### **Documentos Legales**
```
□ Aviso de privacidad actualizado
□ Términos y condiciones médicos
□ Políticas de cancelación
□ Consentimiento informado para telemedicina
□ Certificado SSL (si tienen)
□ Registro ante PROFECO (si aplica)
```

---

## 🚀 **Plan de Lanzamiento**

### **Fase 1: Configuración (Semana 1)**
- [ ] Cliente proporciona todos los datos
- [ ] Configuración de base de datos de producción
- [ ] Configuración de dominio personalizado
- [ ] Integración de Stripe con datos reales

### **Fase 2: Contenido Real (Semana 2)**
- [ ] Carga de doctores reales
- [ ] Configuración de especialidades y precios
- [ ] Personalización de emails
- [ ] Pruebas con datos reales

### **Fase 3: Testing (Semana 3)**
- [ ] Pruebas de funcionalidad completa
- [ ] Testing de pagos reales
- [ ] Verificación de emails
- [ ] Optimización de performance

### **Fase 4: Lanzamiento (Semana 4)**
- [ ] Deploy a producción
- [ ] Configuración de monitoreo
- [ ] Capacitación al equipo del cliente
- [ ] Go-live oficial

---

## 📋 **Checklist Final Pre-Lanzamiento**

### **Técnico**
- [ ] Todas las variables de entorno configuradas
- [ ] Base de datos de producción funcionando
- [ ] Pagos con Stripe probados
- [ ] Emails enviándose correctamente
- [ ] SSL configurado y funcionando
- [ ] Dominio personalizado activo
- [ ] Analytics configurado
- [ ] Backups automáticos activos

### **Contenido**
- [ ] Todos los doctores reales cargados
- [ ] Especialidades y precios actualizados
- [ ] Información de contacto real
- [ ] Términos y condiciones actualizados
- [ ] Política de privacidad actualizada
- [ ] Certificaciones verificadas

### **Testing**
- [ ] Registro de usuarios probado
- [ ] Agendado de citas probado
- [ ] Pagos probados con tarjetas reales
- [ ] Emails de confirmación probados
- [ ] Cancelación de citas probada
- [ ] Panel de administración probado

---

## 📞 **Contacto para Dudas**

**¿Necesitas ayuda con algún punto?**
- 🔧 Configuración técnica
- 💳 Setup de Stripe
- 📧 Configuración de emails
- 🌐 Configuración de dominio
- 📊 Analytics y SEO

**Estado Actual**: ⏳ **ESPERANDO DATOS DEL CLIENTE**
**Tiempo Estimado para Completar**: 2-4 semanas después de recibir todos los datos

---

*Una vez que proporciones todos estos datos, podremos completar el proyecto y tenerlo listo para producción en tiempo récord.* 