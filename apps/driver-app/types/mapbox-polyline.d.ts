declare module '@mapbox/polyline' {
  type LatLngTuple = [number, number];

  const polyline: {
    decode: (input: string, precision?: number) => LatLngTuple[];
    encode: (coordinates: LatLngTuple[], precision?: number) => string;
  };

  export default polyline;
}
