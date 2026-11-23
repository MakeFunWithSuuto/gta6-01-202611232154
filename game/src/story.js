// The story of "Solmar Bay: Heatwave": who Rae Calder works for, and the six missions in order.
// Each mission is data: who gives it, where, the dialogue, its reward, and a list of steps the
// mission runner (missions.js) plays through. Steps may set the scene with `setup`.
import { TILE } from './config.js';
import { createCar } from './vehicles.js';
import { createPed } from './peds.js';
import { raiseWanted } from './police.js';
import { placeOnRoad } from './traffic.js';

export const CAST = {
  rae: { name: 'Rae', color: '#7fe3ff' },
  marisol: { name: 'Marisol Vega', color: '#ffcf5a' },
  dex: { name: 'Dex Okafor', color: '#b99bff' },
  brandt: { name: 'Lyle Brandt', color: '#ff7a7a' },
  radio: { name: 'SBPD Radio', color: '#8fb6ff' },
};

function parkCar(world, model, x, y, angle, tag, color) {
  const car = createCar(model, x, y, angle, color);
  car.tag = tag;
  world.cars.push(car);
  return car;
}

function gangAt(world, x, y, count, tag, spread = 90) {
  for (let k = 0; k < count; k += 1) {
    const a = (k / count) * Math.PI * 2;
    const ped = createPed(world, 'gang', x + Math.cos(a) * spread, y + Math.sin(a) * spread * 0.6);
    ped.tag = tag;
    ped.hostile = false;
    ped.guard = true;
    world.peds.push(ped);
  }
}

/** Wake every armed walker carrying `tag`: they now hunt the player. */
export function alertTagged(world, tag) {
  for (const ped of world.peds) if (ped.tag === tag) ped.hostile = true;
}

export const MISSIONS = [
  {
    id: 'homecoming', title: 'Homecoming', giver: 'garage', contact: 'marisol', reward: 500,
    intro: [
      ['marisol', 'Rae Calder. Six years gone and you walk in like you never left.'],
      ['rae', 'I need work, Mari. Real work.'],
      ['marisol', 'Then show me your hands still remember. Red Mako GT, parked at Mercado Norte. Bring it here without a scratch.'],
    ],
    outro: [['marisol', "Still drives like a hurricane. Welcome home, querida. I'll have more."]],
    steps: [
      {
        kind: 'enter', tag: 'mako', text: 'Steal the red Mako GT at Mercado Norte',
        setup(world) { const m = world.city.places.market; parkCar(world, 'mako', m.x + 40, m.y + TILE * 1.3, 0, 'mako', '#e0303a'); },
      },
      { kind: 'deliver', tag: 'mako', at: 'garage', text: "Drive the Mako to Vega's Garage" },
    ],
  },
  {
    id: 'bluepaint', title: 'Blue Paint', giver: 'garage', contact: 'marisol', reward: 900,
    intro: [
      ['marisol', 'A buyer up in the Heights wants a police cruiser. Do not ask me why.'],
      ['rae', 'From the precinct lot? In daylight?'],
      ['marisol', 'Spray-Lab will make it disappear. Get it painted, then get it here.'],
    ],
    outro: [['marisol', 'Cream with gold trim. Nobody will ever know. You did good.']],
    steps: [
      {
        kind: 'enter', tag: 'cruiser', text: 'Steal a Bastion Cruiser from the SBPD Precinct',
        setup(world) { const m = world.city.places.police; parkCar(world, 'bastion', m.x - 70, m.y + TILE * 1.3, Math.PI, 'cruiser'); },
      },
      {
        kind: 'lose', tag: 'cruiser', text: 'Lose your wanted level, or respray at Spray-Lab',
        setup(world) { raiseWanted(world, 2); world.subtitle('radio', 'All units, a cruiser has been stolen from the precinct. Respond.'); },
      },
      { kind: 'deliver', tag: 'cruiser', at: 'garage', text: "Deliver the cruiser to Vega's Garage" },
    ],
  },
  {
    id: 'coldcuts', title: 'Cold Cuts', giver: 'club', contact: 'dex', reward: 1200, unlock: { smg: 120 },
    intro: [
      ['dex', 'The Tidewater Crew is taxing my corners on the Strand. I want it to stop.'],
      ['dex', 'Their bagman, Pike, counts money on Saltworks Pier every afternoon. Go change his schedule.'],
      ['rae', 'Permanently, I take it.'],
    ],
    outro: [['dex', 'Pike is fish food and the Crew is rattled. There is a Vespa SMG at Iron Coast Arms with your name on it.']],
    steps: [
      {
        kind: 'goto', at: 'pier', radius: 220, text: 'Go to Saltworks Pier',
        setup(world) {
          const pier = world.city.places.pier;
          gangAt(world, pier.x, pier.y + 30, 4, 'crew');
          const pike = createPed(world, 'gang', pier.x + 10, pier.y + 40);
          pike.tag = 'pike'; pike.hp = 110; pike.shirt = '#f6d743'; pike.weapon = 'smg'; pike.hostile = false; pike.guard = true;
          world.peds.push(pike);
        },
      },
      { kind: 'kill', tag: 'pike', text: 'Kill Pike (yellow shirt)', setup(world) { alertTagged(world, 'crew'); alertTagged(world, 'pike'); } },
      { kind: 'lose', text: 'Lose your wanted level' },
      { kind: 'goto', at: 'club', radius: 70, text: 'Return to Club Marea' },
    ],
  },
  {
    id: 'papertrail', title: 'Paper Trail', giver: 'club', contact: 'dex', reward: 1500, unlock: { armor: 100 },
    intro: [
      ['dex', 'Councilman Lyle Brandt. Smiles on every billboard, owns half the Crew.'],
      ['dex', 'He keeps his real ledger in Halcyon Tower. Walk in, take it, get it to your safehouse.'],
      ['rae', 'And the alarm?'],
      ['dex', 'Oh, it will go off. Run fast.'],
    ],
    outro: [['dex', "Two sets of books. Brandt is finished, he just doesn't know it yet."]],
    steps: [
      { kind: 'goto', at: 'tower', radius: 60, onFoot: true, text: 'Walk into the lobby of Halcyon Tower' },
      {
        kind: 'goto', at: 'safehouse', radius: 80, limit: 110, text: 'Get the ledger to your safehouse',
        setup(world) { raiseWanted(world, 3); world.subtitle('radio', 'Break-in at Halcyon Tower. Suspect fleeing. All units.'); },
      },
    ],
  },
  {
    id: 'saltworks', title: 'Saltworks', giver: 'garage', contact: 'marisol', reward: 3000, unlock: { shotgun: 36 },
    intro: [
      ['marisol', 'Brandt moves the Crew money in an armored Vault truck. Tonight it sits at the Saltworks.'],
      ['marisol', 'Guards with rifles. A truck made of bank vault. You will love it.'],
    ],
    outro: [['marisol', 'Mira esto. Brandt is broke, and very, very angry.']],
    steps: [
      {
        kind: 'goto', at: 'pier', radius: 260, text: 'Go to the Saltworks docks',
        setup(world) {
          const pier = world.city.places.pier;
          parkCar(world, 'vault', pier.x + 260, pier.y + 20, 0, 'vault');
          gangAt(world, pier.x + 240, pier.y + 20, 6, 'guard', 120);
        },
      },
      { kind: 'kill', tag: 'guard', text: 'Take out the truck guards', setup(world) { alertTagged(world, 'guard'); } },
      { kind: 'enter', tag: 'vault', text: 'Get in the Vault truck' },
      {
        kind: 'deliver', tag: 'vault', at: 'garage', text: "Drive the truck to Vega's Garage",
        setup(world) { raiseWanted(world, 4); world.subtitle('brandt', 'You have no idea whose money that is. Every cop in Solmar Bay is coming.'); },
      },
    ],
  },
  {
    id: 'heatwave', title: 'Heatwave', giver: 'club', contact: 'dex', reward: 5000,
    intro: [
      ['dex', "Brandt is running. Black Marquis limo, airport money in the trunk."],
      ['rae', 'Then he does not reach the airport.'],
    ],
    outro: [
      ['dex', 'The ledger is with the papers. The Crew is scattered. Solmar Bay belongs to us now.'],
      ['rae', 'To me, Dex. It belongs to me.'],
    ],
    steps: [
      {
        kind: 'destroy', tag: 'brandt', text: "Wreck Brandt's black Marquis limo",
        setup(world) {
          const car = createCar('marquis', 0, 0, 0);
          placeOnRoad(car, 4, 3, 0, 200);
          car.tag = 'brandt'; car.driver = 'ai'; car.health = 220; car.fleeing = true;
          world.cars.push(car);
          raiseWanted(world, 2);
        },
      },
      { kind: 'lose', text: 'Lose the cops' },
    ],
  },
];
