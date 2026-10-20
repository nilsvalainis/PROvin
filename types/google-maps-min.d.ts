declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    panTo(latLng: LatLngLiteral): void;
    setCenter(latLng: LatLngLiteral): void;
    setZoom(z: number): void;
    getZoom(): number | undefined;
    getCenter(): LatLng | undefined;
    fitBounds(b: LatLngBounds, pad?: number): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }
  class LatLngBounds {
    extend(p: LatLngLiteral): void;
  }
  class Marker {
    constructor(opts: Record<string, unknown>);
    setMap(map: Map | null): void;
    addListener(name: string, fn: () => void): void;
  }
  class OverlayView {
    setMap(map: Map | null): void;
    getPanes(): { overlayMouseTarget: HTMLElement } | null;
    getProjection(): { fromLatLngToDivPixel(ll: LatLng): { x: number; y: number } | null } | null;
    onAdd(): void;
    draw(): void;
    onRemove(): void;
  }
  const SymbolPath: { CIRCLE: number };
  type LatLngLiteral = { lat: number; lng: number };
  namespace event {
    function addListenerOnce(instance: object, eventName: string, handler: () => void): object;
    function trigger(instance: object, eventName: string): void;
  }
}

interface Window {
  google?: { maps: typeof google.maps };
}
