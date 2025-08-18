import type { Building, StructuralSystem, SealingSystem, RoofingSystem } from "@shared/schema";

// NBR 15575 Performance Calculation Engine

export interface PerformanceCalculationResult {
  structuralSafety: "minimum" | "intermediate" | "superior";
  thermalPerformance: "minimum" | "intermediate" | "superior";
  acousticPerformance: "minimum" | "intermediate" | "superior";
  waterTightness: "minimum" | "intermediate" | "superior";
  fireSafety: "minimum" | "intermediate" | "superior";
  details: {
    structuralSafety: StructuralSafetyResult;
    thermalPerformance: ThermalPerformanceResult;
    acousticPerformance: AcousticPerformanceResult;
    waterTightness: WaterTightnessResult;
    fireSafety: FireSafetyResult;
  };
}

export interface StructuralSafetyResult {
  designLife: number; // VUP in years
  classification: "minimum" | "intermediate" | "superior";
  compliance: boolean;
  recommendations: string[];
}

export interface ThermalPerformanceResult {
  thermalTransmittance: number; // U (W/m²K)
  thermalCapacity: number; // CT (kJ/m²K)
  zoneLimit: number; // Limit for bioclimatic zone
  classification: "minimum" | "intermediate" | "superior";
  compliance: boolean;
  recommendations: string[];
}

export interface AcousticPerformanceResult {
  soundInsulation: number; // DnT,w (dB)
  noiseClassLimit: number; // Limit for noise class
  classification: "minimum" | "intermediate" | "superior";
  compliance: boolean;
  recommendations: string[];
}

export interface WaterTightnessResult {
  waterproofingScore: number; // 0-100 scale
  drainageScore: number; // 0-100 scale
  classification: "minimum" | "intermediate" | "superior";
  compliance: boolean;
  recommendations: string[];
}

export interface FireSafetyResult {
  materialScore: number; // 0-100 scale
  escapeRouteScore: number; // 0-100 scale
  classification: "minimum" | "intermediate" | "superior";
  compliance: boolean;
  recommendations: string[];
}

// Bioclimatic zone thermal transmittance limits (W/m²K) according to NBR 15220-3
const THERMAL_LIMITS: Record<string, { wall: number; roof: number }> = {
  'ZB1': { wall: 2.5, roof: 2.3 },
  'ZB2': { wall: 2.5, roof: 2.3 },
  'ZB3': { wall: 3.7, roof: 2.3 },
  'ZB4': { wall: 3.7, roof: 2.3 },
  'ZB5': { wall: 3.7, roof: 2.3 },
  'ZB6': { wall: 2.5, roof: 2.3 },
  'ZB7': { wall: 2.5, roof: 2.3 },
  'ZB8': { wall: 3.7, roof: 2.3 },
};

// Noise class sound insulation limits (dB) according to NBR 15575-4
const ACOUSTIC_LIMITS: Record<string, number> = {
  'classe1': 35, // Rural areas
  'classe2': 40, // Strictly residential
  'classe3': 45, // Mixed commercial
  'classe4': 45, // Mixed recreational
};

/**
 * Calculate structural safety performance based on design life (VUP)
 */
export function calculateStructuralSafety(
  structuralSystem: StructuralSystem | null
): StructuralSafetyResult {
  const designLife = structuralSystem?.designLife || 50;
  
  let classification: "minimum" | "intermediate" | "superior";
  let compliance = false;
  const recommendations: string[] = [];
  
  if (designLife >= 100) {
    classification = "superior";
    compliance = true;
    recommendations.push("Vida útil de projeto excelente (≥100 anos)");
  } else if (designLife >= 75) {
    classification = "intermediate";
    compliance = true;
    recommendations.push("Vida útil de projeto adequada (75-99 anos)");
  } else if (designLife >= 50) {
    classification = "minimum";
    compliance = true;
    recommendations.push("Vida útil de projeto mínima (50-74 anos)");
  } else {
    classification = "minimum";
    compliance = false;
    recommendations.push("ATENÇÃO: Vida útil abaixo do mínimo exigido (50 anos)");
    recommendations.push("Revisar especificações estruturais e materiais");
  }
  
  // Add system-specific recommendations
  if (structuralSystem?.systemType === 'concrete') {
    recommendations.push("Verificar cobrimento adequado da armadura");
    recommendations.push("Especificar aditivos para durabilidade se necessário");
  } else if (structuralSystem?.systemType === 'steel') {
    recommendations.push("Verificar proteção anticorrosiva adequada");
    recommendations.push("Manutenção preventiva da proteção contra corrosão");
  }
  
  return {
    designLife,
    classification,
    compliance,
    recommendations,
  };
}

/**
 * Calculate thermal transmittance for wall layers
 */
export function calculateThermalTransmittance(
  layers: Array<{ material: string; thickness: number; conductivity: number }>
): number {
  // Calculate thermal resistance (R = thickness / conductivity)
  const totalResistance = layers.reduce((sum, layer) => {
    return sum + (layer.thickness / layer.conductivity);
  }, 0);
  
  // Add surface resistances (internal + external = 0.17 m²K/W)
  const totalResistanceWithSurfaces = totalResistance + 0.17;
  
  // Thermal transmittance U = 1/R
  return 1 / totalResistanceWithSurfaces;
}

/**
 * Calculate thermal performance based on transmittance and bioclimatic zone
 */
export function calculateThermalPerformance(
  building: Building,
  sealingSystem: SealingSystem | null,
  roofingSystem: RoofingSystem | null
): ThermalPerformanceResult {
  const zoneLimit = THERMAL_LIMITS[building.bioclimaticZone]?.wall || 3.7;
  
  // Extract thermal properties from sealing system
  const thermalProps = sealingSystem?.thermalProperties as any;
  const thermalTransmittance = thermalProps?.transmittance || 4.0; // Default conservative value
  const thermalCapacity = thermalProps?.capacity || 130; // Default value
  
  let classification: "minimum" | "intermediate" | "superior";
  let compliance = false;
  const recommendations: string[] = [];
  
  // Classification based on transmittance vs zone limits
  if (thermalTransmittance <= zoneLimit * 0.7) {
    classification = "superior";
    compliance = true;
    recommendations.push(`Excelente desempenho térmico (U=${thermalTransmittance.toFixed(2)} ≤ ${(zoneLimit * 0.7).toFixed(2)} W/m²K)`);
  } else if (thermalTransmittance <= zoneLimit * 0.85) {
    classification = "intermediate";
    compliance = true;
    recommendations.push(`Bom desempenho térmico (U=${thermalTransmittance.toFixed(2)} ≤ ${(zoneLimit * 0.85).toFixed(2)} W/m²K)`);
  } else if (thermalTransmittance <= zoneLimit) {
    classification = "minimum";
    compliance = true;
    recommendations.push(`Desempenho térmico mínimo (U=${thermalTransmittance.toFixed(2)} ≤ ${zoneLimit} W/m²K)`);
  } else {
    classification = "minimum";
    compliance = false;
    recommendations.push(`ATENÇÃO: Transmitância acima do limite (U=${thermalTransmittance.toFixed(2)} > ${zoneLimit} W/m²K)`);
    recommendations.push("Considerar isolamento térmico adicional");
  }
  
  // Zone-specific recommendations
  if (['ZB1', 'ZB2'].includes(building.bioclimaticZone)) {
    recommendations.push("Zona fria: priorizar isolamento térmico");
    recommendations.push("Considerar orientação solar para aquecimento passivo");
  } else if (['ZB7', 'ZB8'].includes(building.bioclimaticZone)) {
    recommendations.push("Zona quente: priorizar ventilação e sombreamento");
    recommendations.push("Considerar cores claras e telhados ventilados");
  }
  
  return {
    thermalTransmittance,
    thermalCapacity,
    zoneLimit,
    classification,
    compliance,
    recommendations,
  };
}

/**
 * Calculate acoustic performance based on sound insulation
 */
export function calculateAcousticPerformance(
  building: Building,
  sealingSystem: SealingSystem | null
): AcousticPerformanceResult {
  const nc: any = (building as any);
  const noiseKey = nc.noiseClassCode || nc.noiseClass || '';
  const noiseClassLimit = ACOUSTIC_LIMITS[noiseKey] || 45;
  
  // Extract acoustic properties from sealing system
  const acousticProps = sealingSystem?.acousticProperties as any;
  const soundInsulation = acousticProps?.isolation || 35; // Default conservative value
  
  let classification: "minimum" | "intermediate" | "superior";
  let compliance = false;
  const recommendations: string[] = [];
  
  // Classification based on sound insulation vs noise class limits
  if (soundInsulation >= noiseClassLimit + 10) {
    classification = "superior";
    compliance = true;
    recommendations.push(`Excelente isolamento acústico (${soundInsulation} ≥ ${noiseClassLimit + 10} dB)`);
  } else if (soundInsulation >= noiseClassLimit + 5) {
    classification = "intermediate";
    compliance = true;
    recommendations.push(`Bom isolamento acústico (${soundInsulation} ≥ ${noiseClassLimit + 5} dB)`);
  } else if (soundInsulation >= noiseClassLimit) {
    classification = "minimum";
    compliance = true;
    recommendations.push(`Isolamento acústico mínimo (${soundInsulation} ≥ ${noiseClassLimit} dB)`);
  } else {
    classification = "minimum";
    compliance = false;
    recommendations.push(`ATENÇÃO: Isolamento abaixo do limite (${soundInsulation} < ${noiseClassLimit} dB)`);
    recommendations.push("Considerar tratamento acústico adicional");
  }
  
  // Noise class specific recommendations
  if (noiseKey === 'classe4') {
    recommendations.push("Área recreacional: atenção especial a ruídos de impacto");
  } else if (noiseKey === 'classe3') {
    recommendations.push("Área comercial: considerar horários de funcionamento");
  }
  
  return {
    soundInsulation,
    noiseClassLimit,
    classification,
    compliance,
    recommendations,
  };
}

/**
 * Calculate water tightness performance
 */
export function calculateWaterTightness(
  building: Building,
  roofingSystem: RoofingSystem | null,
  sealingSystem: SealingSystem | null
): WaterTightnessResult {
  let waterproofingScore = 0;
  let drainageScore = 0;
  const recommendations: string[] = [];
  
  // Evaluate waterproofing
  if (roofingSystem?.waterproofing) {
    waterproofingScore += 50;
    recommendations.push("Impermeabilização de cobertura presente");
  } else {
    recommendations.push("ATENÇÃO: Especificar impermeabilização de cobertura");
  }
  
  // Evaluate slope for drainage
  const slope = Number((roofingSystem as any)?.slope ?? 0);
  if (slope >= 5) {
    drainageScore += 50;
    recommendations.push(`Inclinação adequada para drenagem (${slope}%)`);
  } else if (slope >= 2) {
    drainageScore += 30;
    recommendations.push(`Inclinação mínima para drenagem (${slope}%)`);
  } else {
    recommendations.push("ATENÇÃO: Inclinação insuficiente - risco de acúmulo de água");
  }
  
  // Evaluate thermal insulation (affects condensation)
  const thermalInsulation = roofingSystem?.thermalInsulation as any;
  if (thermalInsulation) {
    waterproofingScore += 25;
    drainageScore += 25;
    recommendations.push("Isolamento térmico reduz risco de condensação");
  }
  
  // Additional points for building type
  const typ: any = (building as any);
  const typCodeOrLabel = typ.typologyCode || typ.typology || typ.typologyLabel || '';
  if (typCodeOrLabel === 'multifamiliar') {
    waterproofingScore += 25;
    recommendations.push("Edificação multifamiliar: verificar detalhes de fachada");
  }
  
  const totalScore = (waterproofingScore + drainageScore) / 2;
  
  let classification: "minimum" | "intermediate" | "superior";
  let compliance = false;
  
  if (totalScore >= 80) {
    classification = "superior";
    compliance = true;
  } else if (totalScore >= 60) {
    classification = "intermediate";
    compliance = true;
  } else if (totalScore >= 40) {
    classification = "minimum";
    compliance = true;
  } else {
    classification = "minimum";
    compliance = false;
    recommendations.push("ATENÇÃO: Sistema de estanqueidade inadequado");
  }
  
  return {
    waterproofingScore,
    drainageScore,
    classification,
    compliance,
    recommendations,
  };
}

/**
 * Calculate fire safety performance
 */
export function calculateFireSafety(
  building: Building
): FireSafetyResult {
  let materialScore = 60; // Base score
  let escapeRouteScore = 60; // Base score
  const recommendations: string[] = [];
  const typFS: any = (building as any);
  const typCodeOrLabel = typFS.typologyCode || typFS.typology || typFS.typologyLabel || '';
  
  // Evaluate based on building characteristics
  if (building.floors <= 2) {
    escapeRouteScore += 20;
    recommendations.push("Edificação baixa: rotas de fuga facilitadas");
  } else if (building.floors <= 6) {
    escapeRouteScore += 10;
    recommendations.push("Edificação média altura: verificar saídas de emergência");
  } else {
    recommendations.push("Edificação alta: sistema de combate obrigatório");
    recommendations.push("Verificar conformidade com IT-11 (CBPMESP)");
  }
  
  // Evaluate based on typology
  if (typCodeOrLabel === 'comercial' || typCodeOrLabel === 'institucional') {
    materialScore += 20;
    escapeRouteScore += 20;
    recommendations.push("Uso não residencial: exigências especiais de segurança");
  }
  
  // Area considerations
  const area = parseFloat(building.totalArea.toString());
  if (area > 750) {
    materialScore += 10;
    recommendations.push("Área grande: sistema de detecção recomendado");
  }
  
  const totalScore = (materialScore + escapeRouteScore) / 2;
  
  let classification: "minimum" | "intermediate" | "superior";
  let compliance = false;
  
  if (totalScore >= 90) {
    classification = "superior";
    compliance = true;
  } else if (totalScore >= 75) {
    classification = "intermediate";
    compliance = true;
  } else if (totalScore >= 60) {
    classification = "minimum";
    compliance = true;
  } else {
    classification = "minimum";
    compliance = false;
    recommendations.push("ATENÇÃO: Sistema de segurança contra incêndio inadequado");
  }
  
  return {
    materialScore,
    escapeRouteScore,
    classification,
    compliance,
    recommendations,
  };
}

/**
 * Main function to calculate overall building performance
 */
export function calculateBuildingPerformance(
  building: Building,
  structuralSystem?: StructuralSystem | null,
  sealingSystem?: SealingSystem | null,
  roofingSystem?: RoofingSystem | null
): PerformanceCalculationResult {
  const structuralSafety = calculateStructuralSafety(structuralSystem || null);
  const thermalPerformance = calculateThermalPerformance(building, sealingSystem || null, roofingSystem || null);
  const acousticPerformance = calculateAcousticPerformance(building, sealingSystem || null);
  const waterTightness = calculateWaterTightness(building, roofingSystem || null, sealingSystem || null);
  const fireSafety = calculateFireSafety(building);
  
  return {
    structuralSafety: structuralSafety.classification,
    thermalPerformance: thermalPerformance.classification,
    acousticPerformance: acousticPerformance.classification,
    waterTightness: waterTightness.classification,
    fireSafety: fireSafety.classification,
    details: {
      structuralSafety,
      thermalPerformance,
      acousticPerformance,
      waterTightness,
      fireSafety,
    },
  };
}

/**
 * Calculate material thermal transmittance for common materials
 */
export function getMaterialThermalConductivity(material: string): number {
  const conductivities: Record<string, number> = {
    'concrete': 1.75,
    'brick': 0.90,
    'ceramic_block': 0.90,
    'concrete_block': 1.75,
    'mortar': 1.15,
    'plaster': 0.56,
    'ceramic_tile': 1.05,
    'paint': 0.56,
    'insulation_eps': 0.040,
    'insulation_rock_wool': 0.045,
    'insulation_glass_wool': 0.045,
    'wood': 0.29,
    'steel': 55.0,
    'aluminum': 230.0,
    'glass': 1.0,
  };
  
  return conductivities[material] || 1.0; // Default value if material not found
}

/**
 * Calculate acoustic mass law for sound insulation
 */
export function calculateSoundInsulation(
  surfaceMass: number // kg/m²
): number {
  // Simplified mass law: R = 20 * log10(M) - 48
  // Where M is surface mass in kg/m²
  return Math.max(0, 20 * Math.log10(surfaceMass) - 48);
}
