-- Performance indexes for production deployment
-- Created: 2025-10-23
-- Purpose: Add missing indexes to improve query performance

-- Buildings table indexes
CREATE INDEX IF NOT EXISTS idx_buildings_user_id ON buildings(user_id);
CREATE INDEX IF NOT EXISTS idx_buildings_technician_id ON buildings(technician_id);
CREATE INDEX IF NOT EXISTS idx_buildings_typology_id ON buildings(typology_id);
CREATE INDEX IF NOT EXISTS idx_buildings_noise_class_id ON buildings(noise_class_id);
CREATE INDEX IF NOT EXISTS idx_buildings_aggressiveness_class_id ON buildings(aggressiveness_class_id);
CREATE INDEX IF NOT EXISTS idx_buildings_predominant_color_id ON buildings(predominant_color_id);
CREATE INDEX IF NOT EXISTS idx_buildings_city ON buildings(city);
CREATE INDEX IF NOT EXISTS idx_buildings_state ON buildings(state);
CREATE INDEX IF NOT EXISTS idx_buildings_bioclimatic_zone ON buildings(bioclimatic_zone);
CREATE INDEX IF NOT EXISTS idx_buildings_cep ON buildings(cep);
CREATE INDEX IF NOT EXISTS idx_buildings_created_at ON buildings(created_at DESC);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_building_id ON reports(building_id);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified) WHERE email_verified = true;

-- Technicians table indexes
CREATE INDEX IF NOT EXISTS idx_technicians_user_id ON technicians(user_id);
CREATE INDEX IF NOT EXISTS idx_technicians_cep ON technicians(cep);

-- Bioclimatic zone coverages indexes
CREATE INDEX IF NOT EXISTS idx_bioclimatic_coverages_zone_id ON bioclimatic_zone_coverages(zone_id);
CREATE INDEX IF NOT EXISTS idx_bioclimatic_coverages_city_id ON bioclimatic_zone_coverages(city_id);

-- Isopleth coverages indexes  
CREATE INDEX IF NOT EXISTS idx_isopleth_coverages_isopleth_id ON isopleth_coverages(isopleth_id);

-- Parameters table indexes
CREATE INDEX IF NOT EXISTS idx_parameters_analysis_id ON parameters(analysis_id);
CREATE INDEX IF NOT EXISTS idx_parameters_attribute_id ON parameters(attribute_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_buildings_user_created ON buildings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buildings_city_state ON buildings(state, city);

COMMENT ON INDEX idx_buildings_user_id IS 'Performance: Listagem de edificações por usuário';
COMMENT ON INDEX idx_buildings_created_at IS 'Performance: Ordenação cronológica de edificações';
COMMENT ON INDEX idx_reports_building_id IS 'Performance: Busca de relatórios por edificação';
COMMENT ON INDEX idx_session_expire IS 'Performance: Limpeza automática de sessões expiradas';
