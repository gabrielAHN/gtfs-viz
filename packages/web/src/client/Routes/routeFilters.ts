export const routeNameCandidates = (route: any) => {
  return [route.route_name, route.route_short_name, route.route_long_name]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
};

export const routeMatchesNameFilter = (route: any, routeName?: string) => {
  const needle = routeName?.trim().toLowerCase();
  if (!needle) return true;
  return routeNameCandidates(route).some((value) => value.toLowerCase() === needle);
};

export const buildRouteNameOptions = (routes: any[]) => {
  // Build unique name options with searchLabel including route_id and all name variants
  const seen = new Set<string>();
  const options: Array<{ label: string; value: string; searchLabel: string }> = [];
  for (const route of routes) {
    const names = routeNameCandidates(route);
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      const searchParts = [name, route.route_id, ...names].filter(Boolean);
      options.push({ label: name, value: name, searchLabel: searchParts.join(" ") });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
};
