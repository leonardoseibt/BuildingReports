interface PerformanceMatrixProps {
  data: {
    structuralSafety: "minimum" | "intermediate" | "superior";
    thermalPerformance: "minimum" | "intermediate" | "superior";
    acousticPerformance: "minimum" | "intermediate" | "superior";
    waterTightness: "minimum" | "intermediate" | "superior";
    fireSafety: "minimum" | "intermediate" | "superior";
  };
}

const criteriaLabels = {
  structuralSafety: "Seg. Estrutural",
  thermalPerformance: "Desempenho Térmico",
  acousticPerformance: "Desempenho Acústico",
  waterTightness: "Estanqueidade",
  fireSafety: "Seg. contra Incêndio",
};

const performanceConfig = {
  minimum: {
    color: "bg-blue-500",
    textColor: "text-blue-600",
    label: "Mínimo",
  },
  intermediate: {
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    label: "Intermediário",
  },
  superior: {
    color: "bg-green-500",
    textColor: "text-green-600",
    label: "Superior",
  },
};

export default function PerformanceMatrix({ data }: PerformanceMatrixProps) {
  return (
    <div className="space-y-4" data-testid="performance-matrix">
      {Object.entries(data).map(([criterion, level]) => {
        const config = performanceConfig[level];
        const label = criteriaLabels[criterion as keyof typeof criteriaLabels];
        
        return (
          <div 
            key={criterion} 
            className="flex items-center justify-between"
            data-testid={`performance-item-${criterion}`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 ${config.color} rounded-full`}></div>
              <span className="text-sm font-medium text-slate-900" data-testid={`text-criterion-${criterion}`}>
                {label}
              </span>
            </div>
            <span className={`text-sm font-medium ${config.textColor}`} data-testid={`text-level-${criterion}`}>
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
