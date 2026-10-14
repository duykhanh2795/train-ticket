export const STATIONS = [
  { id: "HN", name: "Hà Nội", short: "Hà Nội", subtitle: "Ga Hà Nội" },
  { id: "ND", name: "Nam Định", short: "Nam Định", subtitle: "Ga Nam Định" },
  { id: "VINH", name: "Vinh", short: "Vinh", subtitle: "Ga Vinh" },
  { id: "DN", name: "Đà Nẵng", short: "Đà Nẵng", subtitle: "Ga Đà Nẵng" },
  { id: "SG", name: "Sài Gòn", short: "Sài Gòn", subtitle: "Ga Sài Gòn" },
] as const;

export function stationName(id: string) {
  return STATIONS.find((station) => station.id === id)?.name ?? id;
}
