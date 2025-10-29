import { db } from './db';
import { buildings, parameters, attributeDefinitions } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const snakeToCamelMap: Record<string, string> = {
  'bioclimatic_zone_id': 'bioclimaticZoneId',
  'isopleth_id': 'isoplethId',
  'noise_class_id': 'noiseClassId',
  'aggressiveness_class_id': 'aggressivenessClassId',
  'predominant_color_id': 'predominantColorId',
  'typology_id': 'typologyId'
};

function getAttributeValue(sourceData: any, attribute: any | undefined): any {
  if (!sourceData || !attribute) return null;

  // Try camelCase FIRST (for Drizzle ORM objects)
  if (attribute.sourceTable === 'buildings') {
    const camel = snakeToCamelMap[attribute.sourceColumn];
    if (camel && sourceData[camel] !== undefined && sourceData[camel] !== null) {
      return sourceData[camel];
    }
  }

  // Fallback: snake_case for raw SQL
  if (sourceData[attribute.sourceColumn] !== undefined && sourceData[attribute.sourceColumn] !== null) {
    return sourceData[attribute.sourceColumn];
  }

  return null;
}

function checkAttributeMatch(
  parameter: any,
  attributeId: number | null | undefined,
  attributeValueId: number | null | undefined,
  attributeDef: any | undefined,
  building: any
): boolean {
  // If parameter doesn't require an attribute, show it
  if (!attributeId || !attributeDef) return true;

  let sourceData = building;
  if (!sourceData) return true;

  let attributeValue = getAttributeValue(sourceData, attributeDef);

  // Handle null/undefined attribute values
  if (attributeValue === null || attributeValue === undefined) {
    if (attributeValueId !== null && attributeValueId !== undefined) {
      return false;
    }
    if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
      return false;
    }
    if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
      return false;
    }
    return true;
  }

  // Check specific value match
  if (attributeValueId !== null && attributeValueId !== undefined) {
    const matches = String(attributeValueId) === String(attributeValue);
    if (!matches) {
      return false;
    }
  }

  // Check numeric range limits
  const numericValue = Number(attributeValue);
  if (!Number.isNaN(numericValue)) {
    if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
      const minLimit = Number(parameter.minLimit);
      if (!Number.isNaN(minLimit) && numericValue <= minLimit) {
        return false;
      }
    }
    if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
      const maxLimit = Number(parameter.maxLimit);
      if (!Number.isNaN(maxLimit) && numericValue >= maxLimit) {
        return false;
      }
    }
  }

  return true;
}

function shouldShowParameter(
  parameter: any,
  attributeMap: Map<number, any>,
  building: any
): { show: boolean; reason: string } {
  const attribute1 = parameter.attributeId ? attributeMap.get(parameter.attributeId) : undefined;
  const attribute2 = parameter.attribute2Id ? attributeMap.get(parameter.attribute2Id) : undefined;

  const attr1Match = checkAttributeMatch(
    parameter,
    parameter.attributeId,
    parameter.attributeValueId,
    attribute1,
    building
  );

  if (!attr1Match) {
    return {
      show: false,
      reason: `Attr1 não match (${attribute1?.friendlyName}: esperado=${parameter.attributeValueId}, encontrado=${getAttributeValue(building, attribute1)})`
    };
  }

  if (parameter.attribute2Id) {
    const attr2Match = checkAttributeMatch(
      parameter,
      parameter.attribute2Id,
      parameter.attributeValue2Id,
      attribute2,
      building
    );
    
    if (!attr2Match) {
      return {
        show: false,
        reason: `Attr2 não match (${attribute2?.friendlyName}: esperado=${parameter.attributeValue2Id}, encontrado=${getAttributeValue(building, attribute2)})`
      };
    }
  }

  return { show: true, reason: 'Match completo' };
}

export async function debugFullFiltering(buildingId: number) {
  // 1. Buscar edificação
  const building = await db.query.buildings.findFirst({
    where: eq(buildings.id, buildingId)
  });

  if (!building) {
    return { error: 'Edificação não encontrada' };
  }

  // 2. Buscar todos os parâmetros da análise 131
  const allParameters = await db.query.parameters.findMany({
    where: and(
      eq(parameters.analysisId, 131),
      eq(parameters.isActive, true)
    )
  });

  // 3. Buscar definições de atributos
  const allAttributes = await db.query.attributeDefinitions.findMany();
  const attributeMap = new Map();
  for (const attr of allAttributes) {
    attributeMap.set(attr.id, attr);
  }

  // 4. Filtrar parâmetros
  const results = allParameters.map(param => {
    const result = shouldShowParameter(param, attributeMap, building);
    return {
      id: param.id,
      label: param.label,
      attributeId: param.attributeId,
      attributeValueId: param.attributeValueId,
      attribute2Id: (param as any).attribute2Id,
      attributeValue2Id: (param as any).attributeValue2Id,
      ...result
    };
  });

  const approved = results.filter(r => r.show);
  const rejected = results.filter(r => !r.show);

  return {
    building: {
      id: building.id,
      name: building.name,
      bioclimaticZoneId: building.bioclimaticZoneId,
      isoplethId: building.isoplethId
    },
    stats: {
      total: allParameters.length,
      approved: approved.length,
      rejected: rejected.length
    },
    approved: approved.map(r => ({
      id: r.id,
      label: r.label,
      reason: r.reason
    })),
    rejected: rejected.map(r => ({
      id: r.id,
      label: r.label,
      reason: r.reason
    }))
  };
}
