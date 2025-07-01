
// Utilidades específicas para el mercado mexicano

// Validación de teléfono mexicano (10 dígitos)
export function validateMexicanPhone(phone: string): {
  isValid: boolean;
  formatted: string;
  error?: string;
} {
  // Remover espacios, guiones y caracteres especiales
  const cleaned = phone.replace(/\D/g, '');
  
  // Verificar si tiene exactamente 10 dígitos
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      formatted: phone,
      error: 'El número debe tener exactamente 10 dígitos'
    };
  }
  
  // Verificar que no empiece con 0 o 1
  if (cleaned.startsWith('0') || cleaned.startsWith('1')) {
    return {
      isValid: false,
      formatted: phone,
      error: 'El número no puede empezar con 0 o 1'
    };
  }
  
  // Formatear como +52 XX XXXX XXXX
  const formatted = `+52 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
  
  return {
    isValid: true,
    formatted
  };
}

// Formatear moneda mexicana
export function formatMexicanCurrency(amountInCents: number): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// Convertir pesos a centavos
export function pesosTocents(pesos: number): number {
  return Math.round(pesos * 100);
}

// Convertir centavos a pesos
export function centsToPesos(cents: number): number {
  return cents / 100;
}

// Estados mexicanos ordenados alfabéticamente
export const MEXICAN_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'México',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas'
];

// Especialidades médicas mexicanas
export const MEXICAN_MEDICAL_SPECIALTIES = [
  'Medicina General',
  'Medicina Familiar',
  'Medicina Interna',
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Ginecología y Obstetricia',
  'Neurología',
  'Oftalmología',
  'Ortopedia y Traumatología',
  'Otorrinolaringología',
  'Pediatría',
  'Psiquiatría',
  'Psicología',
  'Radiología',
  'Urología',
  'Anestesiología',
  'Cirugía General',
  'Cirugía Plástica',
  'Neumología',
  'Oncología',
  'Reumatología',
  'Infectología',
  'Nefrología',
  'Hematología',
  'Geriatría',
  'Medicina del Deporte',
  'Medicina del Trabajo',
  'Patología',
  'Medicina Nuclear',
  'Genética Médica',
  'Medicina de Urgencias',
  'Medicina Crítica',
  'Nutriología'
];

// Duraciones disponibles para consultas (en minutos)
export const CONSULTATION_DURATIONS = [15, 30, 45, 60, 90, 120];

// Validar código postal mexicano
export function validateMexicanZipCode(zipCode: string): boolean {
  const cleaned = zipCode.replace(/\D/g, '');
  return cleaned.length === 5;
}

// Formatear código postal mexicano
export function formatMexicanZipCode(zipCode: string): string {
  const cleaned = zipCode.replace(/\D/g, '');
  return cleaned.slice(0, 5);
}

// Obtener saludo basado en la hora
export function getMexicanGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) {
    return 'Buenos días';
  } else if (hour < 18) {
    return 'Buenas tardes';
  } else {
    return 'Buenas noches';
  }
}

// Formatear fecha en español mexicano
export function formatMexicanDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

// Formatear hora en formato mexicano
export function formatMexicanTime(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

// Validar CURP (básico)
export function validateCURP(curp: string): boolean {
  const curpRegex = /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[HM]{1}(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}$/;
  return curpRegex.test(curp.toUpperCase());
}

// Rangos de precios predefinidos para filtros
export const PRICE_RANGES = [
  { label: 'Hasta $500', min: 0, max: 50000 },
  { label: '$500 - $1,000', min: 50000, max: 100000 },
  { label: '$1,000 - $1,500', min: 100000, max: 150000 },
  { label: '$1,500 - $2,000', min: 150000, max: 200000 },
  { label: '$2,000 - $3,000', min: 200000, max: 300000 },
  { label: 'Más de $3,000', min: 300000, max: 999999 }
];

// Días de la semana en español
export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

// Traducir tipos de consulta
export function translateConsultationType(type: string): string {
  const translations = {
    'IN_PERSON': 'Presencial',
    'VIRTUAL': 'Virtual',
    'HOME_VISIT': 'Domicilio'
  };
  return translations[type as keyof typeof translations] || type;
}

// Traducir estados de cita
export function translateAppointmentStatus(status: string): string {
  const translations = {
    'PENDING': 'Pendiente',
    'CONFIRMED': 'Confirmada',
    'COMPLETED': 'Completada',
    'CANCELLED': 'Cancelada',
    'NO_SHOW': 'No se presentó'
  };
  return translations[status as keyof typeof translations] || status;
}
