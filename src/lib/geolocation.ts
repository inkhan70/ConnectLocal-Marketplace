/**
 * Geolocation utilities for location-based features
 * Handles browser geolocation and IP-based country detection
 */

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationData {
  coordinates: LocationCoordinates;
  source?: 'browser';
  city: string;
  state: string;
  country: string;
  countryCode: string;
}

export interface BusinessWithDistance {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number; // in kilometers
  city: string;
  state: string;
  category: string;
  subcategoryName?: string;
  address: string;
  [key: string]: any;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get browser's current location using Geolocation API
 * Returns promise with coordinates
 */
export async function getBrowserLocation(): Promise<LocationCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      console.warn("[ConnectLocal] Geolocation API not available (it also requires HTTPS).");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        // Reject invalid coordinates instead of accidentally treating 0,0 as the user.
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          resolve(null);
          return;
        }
        resolve({ latitude, longitude, accuracy: position.coords.accuracy, timestamp: Date.now() });
      },
      (error) => {
        // Keep failure non-fatal; the UI can still show non-radius results and let
        // the visitor retry. Error codes are useful for diagnosing browser settings.
        console.warn("[ConnectLocal] Geolocation failed:", error.code, error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Get user's country and location based on IP address
 * Uses free IP geolocation API
 */
export async function getLocationFromIP(): Promise<LocationData | null> {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("IP geolocation failed");

    const data = await response.json();
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    // IP coordinates are approximate and must never be presented as GPS accuracy.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    
    return {
      coordinates: {
        latitude,
        longitude,
        timestamp: Date.now(),
      },
      city: data.city || "",
      state: data.region || "",
      country: data.country_name || "",
      countryCode: data.country_code || "",
    };
  } catch (error) {
    console.warn("[ConnectLocal] IP geolocation unavailable:", error);
    return null;
  }
}

/**
 * Request browser location permission and get coordinates
 * Falls back to IP-based location if browser location unavailable
 */
export async function getUserLocation(): Promise<LocationData | null> {
  // Try browser geolocation first
  const browserLocation = await getBrowserLocation();
  
  if (browserLocation) {
    // For browser location, we need to reverse geocode to get city/state
    // For now, return with IP-based city/state
    const ipLocation = await getLocationFromIP();
    if (ipLocation) {
      return {
        coordinates: browserLocation,
        source: 'browser',
        city: ipLocation.city,
        state: ipLocation.state,
        country: ipLocation.country,
        countryCode: ipLocation.countryCode,
      };
    }
    return {
      coordinates: browserLocation,
      city: "",
      state: "",
      country: "",
      countryCode: "",
    };
  }

  // Fallback to IP-based geolocation
  return getLocationFromIP();
}

/**
 * Filter businesses by distance from user location
 * Returns businesses within specified distance (default 100km)
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (lat === null || lat === undefined || lat === '' || lon === null || lon === undefined || lon === '') return false;
  const la = Number(lat);
  const lo = Number(lon);
  return Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

export function filterBusinessesByDistance(
  businesses: any[],
  userLat: number,
  userLon: number,
  maxDistanceKm: number = 100,
  limit: number = 20
): BusinessWithDistance[] {
  return businesses
    .map((business) => {
      // 0 is a valid latitude/longitude (equator / prime meridian); only genuinely missing values are skipped.
      if (!isValidCoordinate(business.latitude, business.longitude)) {
        return null;
      }
      const distance = calculateDistance(
        userLat,
        userLon,
        Number(business.latitude),
        Number(business.longitude)
      );
      return {
        ...business,
        distance,
      };
    })
    .filter((business) => business !== null && business.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit); // Return the closest `limit` businesses (default 20)
}

/**
 * Filter businesses by country when nearby results not available
 * Returns businesses from the same country
 */
export function filterBusinessesByCountry(
  businesses: any[],
  countryCode: string
): any[] {
  return businesses
    .filter((business) => business.countryCode === countryCode)
    .slice(0, 20);
}

/**
 * Get cached location from localStorage
 * Cache expires after specified time (default 1 hour)
 */
export function getCachedLocation(cacheMinutes: number = 60): LocationData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem("userLocation");
    if (!cached) return null;

    const data = JSON.parse(cached);
    if (data.source !== 'browser') return null;
    const ageMinutes = (Date.now() - data.coordinates.timestamp) / (1000 * 60);

    if (ageMinutes > cacheMinutes) {
      localStorage.removeItem("userLocation");
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Save location to localStorage cache
 */
export function cacheLocation(location: LocationData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem("userLocation", JSON.stringify(location));
  } catch {
    console.warn("[ConnectLocal] Failed to cache location");
  }
}

/**
 * Format distance for display
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}

/**
 * Format location for display
 */
export function formatLocation(city: string, state: string): string {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return "Unknown location";
}
