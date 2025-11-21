import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
// Temporarily disable PrismaAdapter to test
// import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

// Debug: verificar variables de entorno
// console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
// console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

export const authOptions: NextAuthOptions = {
  // Temporarily disable PrismaAdapter to test
  // adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        try {
          // Buscar usuario por email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              doctorProfile: true,
              patientProfile: true,
            },
          });

          if (!user) {
            throw new Error("Usuario no encontrado");
          }

          // Verificar que el usuario esté activo
          if (!user.isActive) {
            throw new Error("Cuenta desactivada. Contacte al administrador");
          }

          // Verificar contraseña
          if (!user.password) {
            throw new Error("Error de autenticación");
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );
          if (!isPasswordValid) {
            throw new Error("Contraseña incorrecta");
          }

          // Retornar datos del usuario para la sesión
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone || undefined,
            image: user.doctorProfile?.profileImage || undefined,
          };
        } catch (error) {
          console.error("Error en autenticación:", error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 días
  },
  callbacks: {
    async jwt({ token, user }) {
      // Incluir datos adicionales en el token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      // Incluir datos del token en la sesión
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.phone = token.phone as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Redirección personalizada después del login
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/iniciar-sesion",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

// Alias for compatibility
export const authConfig = authOptions;