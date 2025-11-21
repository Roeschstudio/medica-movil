import SearchPageClient from './search-page-client';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

async function getSpecialties() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/specialties`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return [];
  }
}

async function getStates() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/states`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching states:', error);
    return [];
  }
}

export default async function SearchPage() {
  const [specialties, states] = await Promise.all([
    getSpecialties(),
    getStates()
  ]);

  return (
    <SearchPageClient 
      initialSpecialties={specialties} 
      initialStates={states}
    />
  );
}
