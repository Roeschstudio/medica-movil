import { Metadata } from 'next';
import DemoPageClient from './demo-page-client';

export const metadata: Metadata = {
  title: 'Demo - Cuentas de Prueba | Medica Móvil',
  description: 'Prueba nuestra plataforma con cuentas de demostración. Explora las funcionalidades como admin, doctor o paciente.',
};

export default function DemoPage() {
  return <DemoPageClient />;
} 