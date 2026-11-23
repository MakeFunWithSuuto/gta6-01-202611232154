// Shared tuning numbers for Solmar Bay: the city grid, the simulation step and the feel of
// walking, driving, shooting and the police response.

export const STEP = 1 / 60;
export const TILE = 64;
/** Roads run every BLOCK tiles; each road is two tiles wide (one lane each way). */
export const BLOCK = 12;
export const BLOCKS_X = 8;
export const BLOCKS_Y = 7;
export const MAP_W = BLOCKS_X * BLOCK + 2;
export const MAP_H = 100;
/** First tile row of sand; the coastal boulevard runs just above it. */
export const BEACH_ROW = BLOCKS_Y * BLOCK + 2;
export const WATER_ROW = BEACH_ROW + 6;

export const T_ROAD = 0;
export const T_WALK = 1;
export const T_BUILDING = 2;
export const T_GRASS = 3;
export const T_SAND = 4;
export const T_WATER = 5;
export const T_PLAZA = 6;
export const T_LOT = 7;
export const T_DOCK = 8;

export const PLAYER_WALK = 150;
export const PLAYER_SPRINT = 250;
export const PLAYER_RADIUS = 11;
export const PED_RADIUS = 10;
export const CAR_RADIUS = 20;

export const TRAFFIC_COUNT = 34;
export const PED_COUNT = 70;
export const MAX_COPS_BY_STARS = [0, 2, 3, 5, 7, 9];
/** Seconds out of police sight before one star fades, by current stars. */
export const WANTED_COOLDOWN = [0, 10, 14, 18, 24, 30];

export const SAVE_KEY = 'solmar-bay-save-v1';
export const CAMERA_HEIGHT = 1100;
