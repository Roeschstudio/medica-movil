
import SearchPageClient from './search-page-client';

async function getSpecialties() {
  // Durante el build, retornamos datos vacíos
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('http')) {
    return [];
  }
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/specialties`, {
      cache: 'no-store',
      next: { revalidate: 0 }
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
  // Durante el build, retornamos datos vacíos
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.startsWith('http')) {
    return [];
  }
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/states`, {
      cache: 'no-store',
      next: { revalidate: 0 }
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
