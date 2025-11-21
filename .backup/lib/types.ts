// Tipos personalizados para Medica Movil
import {
  AppointmentStatus,
  ConsultationType,
  PaymentMethod,
  PaymentStatus,
  Appointment as PrismaAppointment,
  Doctor as PrismaDoctor,
  Patient as PrismaPatient,
  User as PrismaUser,
  UserRole,
} from "@prisma/client";

// Tipos extendidos del usuario
export interface User extends PrismaUser {
  doctorProfile?: Doctor | null;
  patientProfile?: Patient | null;
}

export interface Doctor extends PrismaDoctor {
  user?: User;
  appointments?: Appointment[];
  reviews?: Review[];
}

export interface Patient extends PrismaPatient {
  user?: User;
}

export interface Appointment extends PrismaAppointment {
  patient?: User;
  doctor?: Doctor;
  payment?: Payment | null;
  review?: Review | null;
}

// Tipos para formularios
export interface DoctorRegistrationForm {
  // Datos básicos
  name: string;
  email: string;
  password: string;
  phone: string;

  // Datos profesionales
  specialty: string;
  licenseNumber?: string;
  bio?: string;

  // Ubicación
  address?: string;
  city: string;
  state: string;
  zipCode?: string;

  // Configuración de consultas
  acceptsInPerson: boolean;
  acceptsVirtual: boolean;
  acceptsHomeVisits: boolean;

  // Precios (en pesos mexicanos)
  priceInPerson?: number;
  priceVirtual?: number;
  priceHomeVisit?: number;

  // Configuración especial
  firstConsultationFree: boolean;
  videoCallLink?: string;

  // Duraciones
  durationInPerson: number;
  durationVirtual: number;
  durationHomeVisit: number;
}

export interface PatientRegistrationForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export interface AppointmentBookingForm {
  doctorId: string;
  type: ConsultationType;
  scheduledAt: Date;
  notes?: string;
  patientNotes?: string;
}

// Tipos para búsqueda y filtros
export interface DoctorSearchFilters {
  specialty?: string;
  state?: string;
  city?: string;
  consultationType?: ConsultationType;
  priceMin?: number;
  priceMax?: number;
  availability?: boolean;
  firstConsultationFree?: boolean;
}

export interface DoctorSearchResult {
  id: string;
  userId: string;
  name: string;
  specialty: string;
  city: string;
  state: string;
  profileImage?: string;
  averageRating: number;
  totalReviews: number;
  acceptsInPerson: boolean;
  acceptsVirtual: boolean;
  acceptsHomeVisits: boolean;
  priceInPerson?: number;
  priceVirtual?: number;
  priceHomeVisit?: number;
  firstConsultationFree: boolean;
  isVerified: boolean;
}

// Tipos para horarios de trabajo
export interface WorkingHoursSlot {
  from: string; // HH:mm format
  to: string; // HH:mm format
}

export interface WorkingHours {
  monday: WorkingHoursSlot[];
  tuesday: WorkingHoursSlot[];
  wednesday: WorkingHoursSlot[];
  thursday: WorkingHoursSlot[];
  friday: WorkingHoursSlot[];
  saturday: WorkingHoursSlot[];
  sunday: WorkingHoursSlot[];
}

// Tipos para disponibilidad
export interface AvailableSlot {
  datetime: Date;
  duration: number;
  type: ConsultationType;
  price: number;
}

// Tipos para reseñas
export interface Review {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  rating: number;
  comment?: string;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  patientName?: string;
}

// Tipos para pagos
export interface Payment {
  id: string;
  userId: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentId?: string;
  stripeSessionId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos para notificaciones
export interface Notification {
  id: string;
  userId: string;
  type: "EMAIL" | "SMS" | "WHATSAPP";
  title: string;
  message: string;
  isRead: boolean;
  sentAt?: Date;
  createdAt: Date;
}

// Tipos para datos mexicanos
export interface MexicanState {
  id: string;
  name: string;
  code: string;
  cities?: MexicanCity[];
}

export interface MexicanCity {
  id: string;
  name: string;
  stateId: string;
  state?: MexicanState;
}

export interface MedicalSpecialty {
  id: string;
  name: string;
}

export interface MexicanHoliday {
  id: string;
  name: string;
  date: Date;
  isNational: boolean;
  description?: string;
}

// Tipos para análisis y estadísticas
export interface DashboardStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  monthlyAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

// Tipos para respuestas de API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tipos para formularios de contacto
export interface ContactForm {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  formType: "general" | "doctor_inquiry" | "patient_support" | "technical";
}

// Tipos para configuración de doctor
export interface DoctorSettings {
  workingHours: WorkingHours;
  blockedDays: Date[];
  autoConfirmAppointments: boolean;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

// Tipos para formatos mexicanos
export interface MexicanPhoneNumber {
  number: string;
  isValid: boolean;
  formatted: string; // +52 XX XXXX XXXX
}

export interface MexicanCurrency {
  amount: number; // En centavos
  formatted: string; // $1,234.56 MXN
}

// Tipos para chat en tiempo real
export interface ChatRoom {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  isActive: boolean;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content?: string;
  messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  sentAt: Date;
}

export interface VideoSession {
  id: string;
  chatRoomId: string;
  recordingUrl?: string;
  duration: number;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
}

// Video Call Types for WebRTC
export interface VideoCall {
  id: string;
  room_id: string;
  caller_id: string;
  receiver_id: string;
  status: "calling" | "ringing" | "active" | "ended" | "declined" | "failed";
  call_type: "video" | "audio";
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
  metadata?: any;
  created_at: string;
}

export interface WebRTCSignal {
  id: string;
  call_id: string;
  sender_id: string;
  receiver_id: string;
  signal_type: "offer" | "answer" | "ice_candidate";
  signal_data: any;
  created_at: string;
}

export interface MediaStreamState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
}

export interface VideoCallConfig {
  iceServers: RTCIceServer[];
  mediaConstraints: MediaStreamConstraints;
}

export interface CallEventHandlers {
  onCallStatusChange?: (status: VideoCall["status"]) => void;
  onRemoteStreamReceived?: (stream: MediaStream) => void;
  onLocalStreamReceived?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface RealtimePresence {
  userId: string;
  userName: string;
  userRole: string;
  isOnline: boolean;
  lastSeen: Date;
  isTyping: boolean;
}

// Tipos para sesión de NextAuth extendida
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      phone?: string;
      image?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    phone?: string;
  }
}

// Exportar enums para uso en componentes
export {
  AppointmentStatus,
  ConsultationType,
  PaymentMethod,
  PaymentStatus,
  UserRole,
};
