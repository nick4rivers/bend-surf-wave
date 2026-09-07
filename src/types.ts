export interface SurfDataResponse {
  spotName: string;
  riverName: string;
  coordinates: { lat: number; lng: number };
  lastUpdated: string;
  current: {
    flowCfs: number;
    waterTempF: number;
    waterTempC: number;
    airTempF: number;
    airTempC: number;
    waterTempStation?: string;
    statusRating: string;
    statusLabel: string;
    statusColor: string;
    statusDescription: string;
    wetsuitRec: {
      thickness: string;
      accessories: string;
      comfortLevel: string;
      icon: string;
    };
    flowTrendDiff: number;
    thresholds: {
      awesome: number;
      surfTime: number;
      skimShortFins: number;
    };
  };
  upstreamGages: {
    date: string;
    wickiup: number;
    benham: number;
    centralOregonCanal: number;
    arnoldCanal: number;
    headOfPark: number;
    littleDeschutes: number;
  };
  timeSeries: {
    flow: Array<{
      date: string;
      cfs: number;
      surfThreshold: number;
      skimThreshold: number;
      awesomeThreshold: number;
    }>;
    temperature: Array<{
      date: string;
      waterTemp: number;
      airTemp: number;
      t2mm: number;
      t32: number;
      t43: number;
      t54: number;
      t65: number;
    }>;
    canals: Array<{
      date: string;
      wickiup: number;
      benham: number;
      centralOregonCanal: number;
      arnoldCanal: number;
      headOfPark: number;
      littleDeschutes: number;
    }>;
    historical: Array<Record<string, any>>;
  };
  usgsGages: Record<string, { name: string; cfs?: number; tempF?: number; updated?: string }>;
  weather: any;
  airQuality?: {
    aqi: number;
    rating: string;
    category: string;
    color: string;
    description: string;
    recommendation: string;
    pm2_5: number;
    pm10?: number;
    ozone?: number;
    updatedAt: string;
    source?: string;
    sourceUrl?: string;
    sensorName?: string;
    sensorIndex?: number;
    distance?: string;
    pm2_5_10m?: number;
    pm2_5_1h?: number;
  };
  webcams: Array<{
    id: string;
    title: string;
    location: string;
    embedUrl: string;
    isLive: boolean;
  }>;
}

export type UnitType = "imperial" | "metric";
export type TimeRange = "24h" | "7d" | "30d" | "all";
export type ActiveTab = "overview" | "flow" | "temperature" | "historical" | "cams-weather";
