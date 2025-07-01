
'use client';

import { useState, useEffect } from 'react';
import { MainNav } from '@/components/main-nav';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  MapPin, 
  Star, 
  Clock,
  Video,
  Home,
  Stethoscope,
  ChevronDown,
  Users
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMexicanCurrency, translateConsultationType } from '@/lib/mexican-utils';
import { ConsultationType } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';

interface Doctor {
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

interface Specialty {
  id: string;
  name: string;
}

interface State {
  id: string;
  name: string;
  cities: { id: string; name: string; }[];
}

interface SearchPageClientProps {
  initialSpecialties: Specialty[];
  initialStates: State[];
}

export default function SearchPageClient({ initialSpecialties, initialStates }: SearchPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedConsultationType, setSelectedConsultationType] = useState('all');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Obtener ciudades del estado seleccionado
  const availableCities = selectedState === 'all' 
    ? [] 
    : initialStates.find(state => state.name === selectedState)?.cities || [];

  // Cargar doctores
  useEffect(() => {
    loadDoctors();
  }, [searchQuery, selectedSpecialty, selectedState, selectedCity, selectedConsultationType, page]);

  const loadDoctors = async () => {
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedSpecialty !== 'all') params.append('specialty', selectedSpecialty);
      if (selectedState !== 'all') params.append('state', selectedState);
      if (selectedCity !== 'all') params.append('city', selectedCity);
      if (selectedConsultationType !== 'all') params.append('consultationType', selectedConsultationType);
      params.append('page', page.toString());
      params.append('limit', '10');

      const response = await fetch(`/api/doctors?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar doctores');
      }
      
      const data = await response.json();
      setDoctors(data.doctors);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error loading doctors:', error);
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadDoctors();
  };

  const handleFilterChange = () => {
    setPage(1);
    setSelectedCity('all'); // Reset city when state changes
  };

  const getLowestPrice = (doctor: Doctor) => {
    const prices = [
      doctor.acceptsInPerson && doctor.priceInPerson,
      doctor.acceptsVirtual && doctor.priceVirtual,
      doctor.acceptsHomeVisits && doctor.priceHomeVisit
    ].filter(Boolean) as number[];
    
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  const getConsultationTypes = (doctor: Doctor) => {
    const types = [];
    if (doctor.acceptsInPerson) types.push({ type: 'IN_PERSON', price: doctor.priceInPerson });
    if (doctor.acceptsVirtual) types.push({ type: 'VIRTUAL', price: doctor.priceVirtual });
    if (doctor.acceptsHomeVisits) types.push({ type: 'HOME_VISIT', price: doctor.priceHomeVisit });
    return types;
  };

  const DoctorCard = ({ doctor }: { doctor: Doctor }) => {
    const consultationTypes = getConsultationTypes(doctor);
    const lowestPrice = getLowestPrice(doctor);

    return (
      <Card className="doctor-card">
        <CardHeader className="flex flex-row space-y-0 space-x-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted">
            {doctor.profileImage ? (
              <Image
                src="https://images.unsplash.com/photo-1622253694238-3b22139576c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1288&h=1288&q=80&crop=faces,top,right"
                alt={`Foto de ${doctor.name}`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Stethoscope className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">{doctor.name}</CardTitle>
              {doctor.isVerified && (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                  Verificado
                </Badge>
              )}
            </div>
            <CardDescription className="font-medium text-primary">
              {doctor.specialty}
            </CardDescription>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>{doctor.city}, {doctor.state}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                <span className="font-medium">{doctor.averageRating}</span>
                <span>({doctor.totalReviews} reseñas)</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Tipos de consulta disponibles */}
          <div className="flex flex-wrap gap-2">
            {consultationTypes.map(({ type, price }) => (
              <Badge
                key={type}
                variant="outline"
                className={
                  type === 'IN_PERSON' ? 'badge-in-person' :
                  type === 'VIRTUAL' ? 'badge-virtual' :
                  'badge-home-visit'
                }
              >
                <div className="flex items-center space-x-1">
                  {type === 'IN_PERSON' && <Stethoscope className="h-3 w-3" />}
                  {type === 'VIRTUAL' && <Video className="h-3 w-3" />}
                  {type === 'HOME_VISIT' && <Home className="h-3 w-3" />}
                  <span>{translateConsultationType(type)}</span>
                </div>
              </Badge>
            ))}
          </div>

          {/* Precio y disponibilidad */}
          <div className="flex items-center justify-between">
            <div>
              {doctor.firstConsultationFree ? (
                <div>
                  <span className="text-lg font-bold text-success">Primera consulta gratis</span>
                  <p className="text-sm text-muted-foreground">
                    Después desde {formatMexicanCurrency(lowestPrice)}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-sm text-muted-foreground">Desde</span>
                  <span className="text-lg font-bold text-primary ml-1">
                    {formatMexicanCurrency(lowestPrice)}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-xs text-success">
                <Clock className="h-3 w-3" />
                <span>Disponible hoy</span>
              </div>
              <Link href={`/doctor/${doctor.id}`}>
                <Button size="sm">
                  Ver Perfil
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />
      
      <div className="flex-1">
        {/* Barra de búsqueda */}
        <section className="bg-primary/5 border-b border-border py-8">
          <div className="max-width-container">
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-foreground">
                Encuentra tu doctor ideal
              </h1>
              
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o especialidad..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 h-12"
                  />
                </div>
                
                <Button
                  onClick={handleSearch}
                  className="h-12 px-6"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 h-12 lg:hidden"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="max-width-container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filtros */}
            <div className={`lg:col-span-1 space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Filter className="h-5 w-5" />
                    <span>Filtros</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Especialidad */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Especialidad</label>
                    <Select value={selectedSpecialty} onValueChange={(value) => {
                      setSelectedSpecialty(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las especialidades</SelectItem>
                        {initialSpecialties.map(specialty => (
                          <SelectItem key={specialty.id} value={specialty.name}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Estado</label>
                    <Select value={selectedState} onValueChange={(value) => {
                      setSelectedState(value);
                      setSelectedCity('all');
                      handleFilterChange();
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {initialStates.map(state => (
                          <SelectItem key={state.id} value={state.name}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ciudad */}
                  {selectedState !== 'all' && availableCities.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Ciudad</label>
                      <Select value={selectedCity} onValueChange={(value) => {
                        setSelectedCity(value);
                        handleFilterChange();
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las ciudades</SelectItem>
                          {availableCities.map(city => (
                            <SelectItem key={city.id} value={city.name}>
                              {city.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Tipo de consulta */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de consulta</label>
                    <Select value={selectedConsultationType} onValueChange={(value) => {
                      setSelectedConsultationType(value);
                      handleFilterChange();
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectItem value="IN_PERSON">Presencial</SelectItem>
                        <SelectItem value="VIRTUAL">Virtual</SelectItem>
                        <SelectItem value="HOME_VISIT">A domicilio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botón limpiar filtros */}
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedSpecialty('all');
                      setSelectedState('all');
                      setSelectedCity('all');
                      setSelectedConsultationType('all');
                      setPage(1);
                    }}
                    className="w-full"
                  >
                    Limpiar filtros
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Resultados */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {isLoading ? 'Cargando...' : `${doctors.length} doctores encontrados`}
                  </span>
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="flex space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/2" />
                            <div className="h-3 bg-muted rounded w-1/3" />
                            <div className="h-3 bg-muted rounded w-2/3" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : doctors.length > 0 ? (
                <div className="space-y-6">
                  {doctors.map(doctor => (
                    <DoctorCard key={doctor.id} doctor={doctor} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No se encontraron doctores
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Intenta ajustar tus filtros o buscar con términos diferentes
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSpecialty('all');
                        setSelectedState('all');
                        setSelectedCity('all');
                        setSelectedConsultationType('all');
                        setPage(1);
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
