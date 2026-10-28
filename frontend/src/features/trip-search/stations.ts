export const STATIONS = [
  { id: "HN", name: "Hanoi", short: "Hanoi", subtitle: "Hanoi Station" },
  {
    id: "ND",
    name: "Nam Dinh",
    short: "Nam Dinh",
    subtitle: "Nam Dinh Station",
  },
  { id: "VINH", name: "Vinh", short: "Vinh", subtitle: "Vinh Station" },
  { id: "DN", name: "Da Nang", short: "Da Nang", subtitle: "Da Nang Station" },
  { id: "SG", name: "Saigon", short: "Saigon", subtitle: "Saigon Station" },
] as const;

export function stationName(id: string) {
  return STATIONS.find((station) => station.id === id)?.name ?? id;
}
