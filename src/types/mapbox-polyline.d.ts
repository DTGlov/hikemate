declare module '@mapbox/polyline' {
  type LatLng = [number, number];
  export function encode(coordinates: LatLng[], precision?: number): string;
  export function decode(str: string, precision?: number): LatLng[];
  export function fromGeoJSON(
    geojson: GeoJSON.LineString | GeoJSON.Feature<GeoJSON.LineString>,
    precision?: number,
  ): string;
  export function toGeoJSON(
    str: string,
    precision?: number,
  ): GeoJSON.LineString;
}
