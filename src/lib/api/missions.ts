import axios from 'axios';

const NASA_API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || 'DEMO_KEY';
const SPACEX_API = 'https://api.spacexdata.com/v5';

export type SpaceXLaunch = {
  id: string;
  name: string;
  date_unix: number;
  rocket: string;
  success: boolean | null;
  details: string | null;
};

export async function fetchSpaceXLaunches(limit = 10) {
  try {
    const response = await axios.post(`${SPACEX_API}/launches/query`, {
      options: {
        limit,
        sort: { date_unix: 'desc' },
      },
    });
    return response.data.docs as SpaceXLaunch[];
  } catch (error) {
    console.error('Failed to fetch SpaceX launches:', error);
    return [];
  }
}

export async function fetchISSPosition() {
  try {
    const response = await axios.get('http://api.open-notify.org/iss-now.json');
    return {
      latitude: parseFloat(response.data.iss_position.latitude),
      longitude: parseFloat(response.data.iss_position.longitude),
      timestamp: response.data.timestamp * 1000,
    };
  } catch (error) {
    console.error('Failed to fetch ISS position:', error);
    return null;
  }
}

export async function fetchNASAApod() {
  try {
    const response = await axios.get(
      `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch NASA APOD:', error);
    return null;
  }
}

// Satellite tracking - using simplified TLE data
export type TLEData = {
  name: string;
  line1: string;
  line2: string;
};

export async function fetchSatelliteTLE(noradId: number): Promise<TLEData | null> {
  try {
    const response = await axios.get(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=JSON`
    );
    const data = response.data[0];
    return {
      name: data.OBJECT_NAME,
      line1: data.TLE_LINE1,
      line2: data.TLE_LINE2,
    };
  } catch (error) {
    console.error('Failed to fetch TLE data:', error);
    return null;
  }
}
