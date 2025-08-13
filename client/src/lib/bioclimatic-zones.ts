// Brazilian Bioclimatic Zone Mapping according to NBR 15220-3

export interface BioclimaticZoneInfo {
  zone: string;
  description: string;
  characteristics: string[];
  recommendations: string[];
  thermalLimits: {
    wallTransmittance: number; // W/m²K
    roofTransmittance: number; // W/m²K
  };
  designStrategies: string[];
}

export const BIOCLIMATIC_ZONES: Record<string, BioclimaticZoneInfo> = {
  'ZB1': {
    zone: 'ZB1',
    description: 'Zona Bioclimática 1 - Clima Frio',
    characteristics: [
      'Inverno rigoroso',
      'Temperatura mínima menor que 15°C',
      'Amplitude térmica alta',
      'Necessidade de aquecimento'
    ],
    recommendations: [
      'Vedações internas pesadas (inércia térmica)',
      'Cobertura isolada termicamente',
      'Aquecimento solar passivo',
      'Proteção dos ventos frios'
    ],
    thermalLimits: {
      wallTransmittance: 2.5,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Aquecimento solar passivo',
      'Vedações internas pesadas'
    ]
  },
  'ZB2': {
    zone: 'ZB2',
    description: 'Zona Bioclimática 2 - Clima Temperado',
    characteristics: [
      'Inverno frio',
      'Verão ameno',
      'Amplitude térmica moderada',
      'Necessidade de aquecimento no inverno'
    ],
    recommendations: [
      'Vedações internas pesadas',
      'Cobertura isolada',
      'Aquecimento solar passivo',
      'Ventilação no verão'
    ],
    thermalLimits: {
      wallTransmittance: 2.5,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Aquecimento solar passivo',
      'Vedações internas pesadas',
      'Ventilação seletiva'
    ]
  },
  'ZB3': {
    zone: 'ZB3',
    description: 'Zona Bioclimática 3 - Clima Ameno',
    characteristics: [
      'Inverno ameno',
      'Verão quente',
      'Amplitude térmica moderada',
      'Conforto na maior parte do ano'
    ],
    recommendations: [
      'Vedações internas pesadas',
      'Cobertura isolada e leve',
      'Ventilação seletiva',
      'Sombreamento das aberturas'
    ],
    thermalLimits: {
      wallTransmittance: 3.7,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Vedações internas pesadas',
      'Ventilação seletiva',
      'Sombreamento das aberturas'
    ]
  },
  'ZB4': {
    zone: 'ZB4',
    description: 'Zona Bioclimática 4 - Clima Quente e Seco',
    characteristics: [
      'Inverno seco',
      'Verão quente e seco',
      'Amplitude térmica alta',
      'Baixa umidade relativa'
    ],
    recommendations: [
      'Vedações internas pesadas',
      'Cobertura isolada e leve',
      'Resfriamento evaporativo',
      'Massa térmica para inércia'
    ],
    thermalLimits: {
      wallTransmittance: 3.7,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Vedações internas pesadas',
      'Resfriamento evaporativo',
      'Massa térmica para inércia'
    ]
  },
  'ZB5': {
    zone: 'ZB5',
    description: 'Zona Bioclimática 5 - Clima Quente e Úmido',
    characteristics: [
      'Inverno ameno',
      'Verão quente e úmido',
      'Alta umidade relativa',
      'Necessidade de ventilação'
    ],
    recommendations: [
      'Vedações leves e refletoras',
      'Cobertura isolada e ventilada',
      'Ventilação cruzada',
      'Sombreamento eficiente'
    ],
    thermalLimits: {
      wallTransmittance: 3.7,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Ventilação cruzada',
      'Sombreamento das aberturas',
      'Vedações internas leves'
    ]
  },
  'ZB6': {
    zone: 'ZB6',
    description: 'Zona Bioclimática 6 - Clima Quente e Seco',
    characteristics: [
      'Inverno seco',
      'Verão muito quente e seco',
      'Amplitude térmica alta',
      'Radiação solar intensa'
    ],
    recommendations: [
      'Vedações internas pesadas',
      'Cobertura isolada',
      'Resfriamento evaporativo',
      'Proteção solar rigorosa'
    ],
    thermalLimits: {
      wallTransmittance: 2.5,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Vedações internas pesadas',
      'Resfriamento evaporativo',
      'Massa térmica para inércia'
    ]
  },
  'ZB7': {
    zone: 'ZB7',
    description: 'Zona Bioclimática 7 - Clima Quente e Seco',
    characteristics: [
      'Inverno seco',
      'Verão muito quente e seco',
      'Amplitude térmica muito alta',
      'Baixíssima umidade'
    ],
    recommendations: [
      'Vedações internas pesadas',
      'Cobertura isolada',
      'Resfriamento evaporativo',
      'Massa térmica elevada'
    ],
    thermalLimits: {
      wallTransmittance: 2.5,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Vedações internas pesadas',
      'Resfriamento evaporativo',
      'Massa térmica para inércia'
    ]
  },
  'ZB8': {
    zone: 'ZB8',
    description: 'Zona Bioclimática 8 - Clima Quente e Úmido',
    characteristics: [
      'Inverno quente',
      'Verão muito quente e úmido',
      'Alta umidade o ano todo',
      'Necessidade de ventilação permanente'
    ],
    recommendations: [
      'Vedações leves e refletoras',
      'Cobertura leve e ventilada',
      'Ventilação permanente',
      'Sombreamento total'
    ],
    thermalLimits: {
      wallTransmittance: 3.7,
      roofTransmittance: 2.3
    },
    designStrategies: [
      'Ventilação cruzada permanente',
      'Sombreamento das aberturas',
      'Vedações internas leves'
    ]
  }
};

/**
 * Geographic mapping of Brazilian states to bioclimatic zones
 * Based on NBR 15220-3 and official climate data
 */
export const STATE_TO_ZONE: Record<string, string[]> = {
  'AC': ['ZB8'], // Acre
  'AL': ['ZB8'], // Alagoas  
  'AP': ['ZB8'], // Amapá
  'AM': ['ZB8'], // Amazonas
  'BA': ['ZB7', 'ZB8'], // Bahia
  'CE': ['ZB8'], // Ceará
  'DF': ['ZB4'], // Distrito Federal
  'ES': ['ZB8'], // Espírito Santo
  'GO': ['ZB4', 'ZB6'], // Goiás
  'MA': ['ZB8'], // Maranhão
  'MT': ['ZB6', 'ZB7'], // Mato Grosso
  'MS': ['ZB4', 'ZB6'], // Mato Grosso do Sul
  'MG': ['ZB3', 'ZB4'], // Minas Gerais
  'PA': ['ZB8'], // Pará
  'PB': ['ZB8'], // Paraíba
  'PR': ['ZB1', 'ZB2', 'ZB3'], // Paraná
  'PE': ['ZB8'], // Pernambuco
  'PI': ['ZB7', 'ZB8'], // Piauí
  'RJ': ['ZB3', 'ZB8'], // Rio de Janeiro
  'RN': ['ZB8'], // Rio Grande do Norte
  'RS': ['ZB1', 'ZB2'], // Rio Grande do Sul
  'RO': ['ZB8'], // Rondônia
  'RR': ['ZB8'], // Roraima
  'SC': ['ZB1', 'ZB2', 'ZB3'], // Santa Catarina
  'SP': ['ZB3', 'ZB4'], // São Paulo
  'SE': ['ZB8'], // Sergipe
  'TO': ['ZB7', 'ZB8'], // Tocantins
};

/**
 * City-specific bioclimatic zone mapping for major cities
 */
export const CITY_TO_ZONE: Record<string, string> = {
  // Major cities with specific zoning
  'São Paulo': 'ZB3',
  'Rio de Janeiro': 'ZB8', 
  'Brasília': 'ZB4',
  'Salvador': 'ZB8',
  'Fortaleza': 'ZB8',
  'Belo Horizonte': 'ZB3',
  'Manaus': 'ZB8',
  'Curitiba': 'ZB2',
  'Recife': 'ZB8',
  'Porto Alegre': 'ZB2',
  'Goiânia': 'ZB4',
  'Belém': 'ZB8',
  'Guarulhos': 'ZB3',
  'Campinas': 'ZB3',
  'Nova Iguaçu': 'ZB8',
  'Maceió': 'ZB8',
  'São Luís': 'ZB8',
  'Duque de Caxias': 'ZB8',
  'Natal': 'ZB8',
  'Teresina': 'ZB7',
  'Campo Grande': 'ZB4',
  'João Pessoa': 'ZB8',
  'Jaboatão dos Guararapes': 'ZB8',
  'Santo André': 'ZB3',
  'Osasco': 'ZB3',
  'São Bernardo do Campo': 'ZB3',
  'Sorocaba': 'ZB3',
  'Uberlândia': 'ZB4',
  'Contagem': 'ZB3',
  'Aracaju': 'ZB8',
  'Feira de Santana': 'ZB8',
  'Cuiabá': 'ZB7',
  'Joinville': 'ZB2',
  'Juiz de Fora': 'ZB3',
  'Londrina': 'ZB2',
  'Aparecida de Goiânia': 'ZB4',
  'Niterói': 'ZB8',
  'Porto Velho': 'ZB8',
  'Serra': 'ZB8',
  'Caxias do Sul': 'ZB1',
  'Vila Velha': 'ZB8',
  'Florianópolis': 'ZB3',
  'Macapá': 'ZB8',
  'Campos dos Goytacazes': 'ZB8',
  'São José dos Campos': 'ZB3',
  'Ribeirão Preto': 'ZB4',
  'Salvador': 'ZB8',
  'Vitória': 'ZB8',
  'Pelotas': 'ZB2',
  'Canoas': 'ZB2',
  'Maringá': 'ZB3',
  'Mauá': 'ZB3',
  'Carapicuíba': 'ZB3',
  'Olinda': 'ZB8',
  'Campina Grande': 'ZB8',
  'São José do Rio Preto': 'ZB4',
  'Caxias': 'ZB8',
  'Mogi das Cruzes': 'ZB3',
  'Diadema': 'ZB3',
  'Betim': 'ZB3',
  'Jundiaí': 'ZB3',
  'Piracicaba': 'ZB3',
  'Cariacica': 'ZB8',
  'Bauru': 'ZB4',
  'Montes Claros': 'ZB4',
  'Anápolis': 'ZB4',
  'Caucaia': 'ZB8',
  'Caruaru': 'ZB8',
  'Santarém': 'ZB8',
  'Volta Redonda': 'ZB3',
};

/**
 * Get bioclimatic zone based on state
 */
export function getBioclimaticZoneByState(state: string): string {
  const zones = STATE_TO_ZONE[state.toUpperCase()];
  if (!zones || zones.length === 0) {
    return 'ZB3'; // Default zone
  }
  return zones[0]; // Return first zone for simplicity
}

/**
 * Get bioclimatic zone based on city name
 */
export function getBioclimaticZoneByCity(city: string): string | null {
  return CITY_TO_ZONE[city] || null;
}

/**
 * Get bioclimatic zone information
 */
export function getBioclimaticZoneInfo(zone: string): BioclimaticZoneInfo | null {
  return BIOCLIMATIC_ZONES[zone] || null;
}

/**
 * Get all available bioclimatic zones
 */
export function getAllBioclimaticZones(): string[] {
  return Object.keys(BIOCLIMATIC_ZONES);
}

/**
 * Get thermal recommendations for a specific zone
 */
export function getThermalRecommendations(zone: string): string[] {
  const zoneInfo = getBioclimaticZoneInfo(zone);
  return zoneInfo?.recommendations || [];
}

/**
 * Get design strategies for a specific zone
 */
export function getDesignStrategies(zone: string): string[] {
  const zoneInfo = getBioclimaticZoneInfo(zone);
  return zoneInfo?.designStrategies || [];
}

/**
 * Determine bioclimatic zone from geographic coordinates
 * This is a simplified implementation - in production, would use more precise mapping
 */
export function getBioclimaticZoneByCoordinates(latitude: number, longitude: number): string {
  // Brazil approximate coordinate ranges
  // This is a simplified algorithm - real implementation would use detailed climate maps
  
  // Northern regions (Amazon) - hot and humid
  if (latitude > -5) {
    return 'ZB8';
  }
  
  // Northeast - hot and dry/humid
  if (latitude > -15 && longitude > -45) {
    return 'ZB8';
  }
  
  // Central-west - hot and dry
  if (latitude > -20 && longitude < -50) {
    return longitude < -55 ? 'ZB7' : 'ZB4';
  }
  
  // Southeast - varies by elevation and location
  if (latitude > -25) {
    return longitude > -45 ? 'ZB8' : 'ZB3';
  }
  
  // South - temperate to cold
  if (latitude > -30) {
    return 'ZB2';
  }
  
  // Far south - cold
  return 'ZB1';
}

/**
 * Validate if a bioclimatic zone is valid
 */
export function isValidBioclimaticZone(zone: string): boolean {
  return zone in BIOCLIMATIC_ZONES;
}
