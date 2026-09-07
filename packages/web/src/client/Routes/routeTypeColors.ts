const ROUTE_TYPE_COLORS: Record<string, string> = {
  "Tram, Streetcar, Light rail": "#22c55e",
  "Subway, Metro": "#ef4444",
  Rail: "#a855f7",
  Bus: "#3b82f6",
  Ferry: "#06b6d4",
  "Cable tram": "#14b8a6",
  "Aerial lift": "#0ea5e9",
  Funicular: "#ec4899",
  Trolleybus: "#f97316",
  Monorail: "#8b5cf6",
  Other: "#6b7280",
}

export const getRouteTypeColor = (routeType?: string) => {
  if (!routeType) return ROUTE_TYPE_COLORS.Other
  return ROUTE_TYPE_COLORS[routeType] || ROUTE_TYPE_COLORS.Other
}

export const getRouteTypeLegendItems = (routes: any[]) => {
  return Array.from(new Set(routes.map((route) => route.route_type_name).filter(Boolean)))
    .sort()
    .map((type) => ({
      label: String(type),
      color: getRouteTypeColor(String(type)),
    }))
}
