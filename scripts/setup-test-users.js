const { createClient } = require("@supabase/supabase-js");

// Configuración de Supabase
const supabaseUrl = "https://qnoeopnqffjhhbowepdj.supabase.co";
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFub2VvcG5xZmZqaGhib3dlcGRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MzIxNSwiZXhwIjoyMDczMDM5MjE1fQ.Q5SRn1NdBq7VF6GV6UBIEcmja0GTFi28ooWDRFKOabA";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Usuarios de prueba
const testUsers = [
  {
    email: "admin@medicamovil.mx",
    password: "admin123",
    name: "Administrador Sistema",
    role: "ADMIN",
  },
  {
    email: "maria.garcia@email.com",
    password: "paciente123",
    name: "María García López",
    role: "PATIENT",
  },
  {
    email: "dra.sofia.martinez@medico.com",
    password: "doctor123",
    name: "Dra. Sofía Martínez",
    role: "DOCTOR",
  },
  {
    email: "john@doe.com",
    password: "johndoe123",
    name: "John Doe",
    role: "ADMIN",
  },
];

async function setupTestUsers() {
  console.log("🚀 Configurando usuarios de prueba...");

  try {
    // Verificar conexión
    console.log("📡 Verificando conexión a Supabase...");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("✅ Conexión a Supabase exitosa");

    // Verificar si existe la tabla users
    console.log("🔍 Verificando estructura de base de datos...");
    const { data: tables, error: tablesError } = await supabase
      .from("users")
      .select("count")
      .limit(1);

    if (tablesError) {
      console.log(
        "⚠️ La tabla users no existe o no es accesible:",
        tablesError.message
      );
      console.log("📋 Necesitas ejecutar las migraciones de Prisma primero");
      return;
    }

    console.log("✅ Tabla users encontrada");

    // Crear usuarios de prueba
    for (const testUser of testUsers) {
      console.log(`👤 Creando usuario: ${testUser.email}`);

      try {
        // Crear usuario en auth
        const { data: authData, error: signUpError } =
          await supabase.auth.admin.createUser({
            email: testUser.email,
            password: testUser.password,
            email_confirm: true,
            user_metadata: {
              full_name: testUser.name,
              role: testUser.role,
            },
          });

        if (signUpError) {
          console.log(
            `❌ Error creando auth para ${testUser.email}:`,
            signUpError.message
          );
          continue;
        }

        // Crear perfil en la tabla users
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .upsert({
            id: authData.user.id,
            email: testUser.email,
            name: testUser.name,
            role: testUser.role,
            email_verified: new Date().toISOString(),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.log(
            `❌ Error creando perfil para ${testUser.email}:`,
            profileError.message
          );
        } else {
          console.log(`✅ Usuario ${testUser.email} creado exitosamente`);
        }
      } catch (error) {
        console.log(
          `❌ Error general creando ${testUser.email}:`,
          error.message
        );
      }
    }

    console.log("\n🎉 Configuración completada!");
    console.log("\n📋 Usuarios de prueba disponibles:");
    testUsers.forEach((user) => {
      console.log(`   ${user.role}: ${user.email} / ${user.password}`);
    });
  } catch (error) {
    console.error("❌ Error general:", error);
  }
}

// Función para verificar usuarios existentes
async function checkExistingUsers() {
  console.log("🔍 Verificando usuarios existentes...");

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("email, name, role, created_at");

    if (error) {
      console.log("❌ Error consultando usuarios:", error.message);
      return;
    }

    if (users && users.length > 0) {
      console.log("👥 Usuarios encontrados:");
      users.forEach((user) => {
        console.log(`   ${user.role}: ${user.email} - ${user.name}`);
      });
    } else {
      console.log("📭 No se encontraron usuarios");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Ejecutar según el argumento
const action = process.argv[2];

if (action === "check") {
  checkExistingUsers();
} else {
  setupTestUsers();
}
