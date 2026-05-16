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
    if (!navigator.geolocation) {
      console.log("[v0] Geolocation API not available");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      (error) => {
        console.log("[v0] Geolocation error:", error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
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
    
    return {
      coordinates: {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        timestamp: Date.now(),
      },
      city: data.city || "",
      state: data.region || "",
      country: data.country_name || "",
      countryCode: data.country_code || "",
    };
  } catch (error) {
    console.log("[v0] IP geolocation error:", error);
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
export function filterBusinessesByDistance(
  businesses: any[],
  userLat: number,
  userLon: number,
  maxDistanceKm: number = 100
): BusinessWithDistance[] {
  return businesses
    .map((business) => {
      if (!business.latitude || !business.longitude) {
        return null;
      }
      const distance = calculateDistance(
        userLat,
        userLon,
        business.latitude,
        business.longitude
      );
      return {
        ...business,
        distance,
      };
    })
    .filter((business) => business !== null && business.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20); // Return top 20 closest businesses
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
  try {
    const cached = localStorage.getItem("userLocation");
    if (!cached) return null;

    const data = JSON.parse(cached);
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
  try {
    localStorage.setItem("userLocation", JSON.stringify(location));
  } catch {
    console.log("[v0] Failed to cache location");
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
