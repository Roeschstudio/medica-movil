# Cómo obtener la contraseña de la base de datos de Supabase

Para resolver el error P1000 (credenciales inválidas), necesitas obtener la contraseña correcta de la base de datos:

## Pasos para resetear/obtener la contraseña:

1. **Ir al Dashboard de Supabase:**
   - Ve a https://supabase.com/dashboard
   - Inicia sesión en tu cuenta
   - Selecciona tu proyecto

2. **Navegar a Database Settings:**
   - En el menú lateral izquierdo, haz clic en "Project Settings" (ícono de engranaje)
   - En la sección "Configuration", haz clic en "Database"

3. **Resetear la contraseña:**
   - Busca la sección "Database password"
   - Haz clic en "Reset database password"
   - Genera una nueva contraseña segura
   - Guarda la nueva contraseña

4. **Actualizar el archivo .env:**
   - Reemplaza `[YOUR-PASSWORD]` en DATABASE_URL con la nueva contraseña
   - Si la contraseña contiene caracteres especiales, codifícalos en URL

## Formato de conexión recomendado para Prisma:

```
# Para Prisma, usar transaction pooler
DATABASE_URL="postgresql://postgres.jzjmnyxtrdmfmfqeuaeb:NUEVA_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

## Caracteres especiales en contraseñas:

Si tu contraseña contiene caracteres especiales, debes codificarlos:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

## Verificar la conexión:

Después de actualizar la contraseña, ejecuta:
```bash
node test-connection.js
```

Si la conexión es exitosa, continúa con:
```bash
npx prisma generate
npx prisma db push
```