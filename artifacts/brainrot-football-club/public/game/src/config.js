export const ASSETS = {
  mascot: 'https://static.seeles.ai/data/asset/export/749b6d56-e5d0-430c-9be3-a28672ff7d34/663069/threeJs_12c65451-e6bf-4c1c-8eca-acb10632e2f6.glb',
  ball: 'https://static.seeles.ai/data/asset/export/e629ae85-9dc4-41b1-8939-0133424d4d14/1012041/threeJs_1012041_2885778.glb',
  goal: 'https://static.seeles.ai/data/asset/export/320fe056-2ef9-4f2b-9603-e285dc7e09a2/941222/thing_0db16deb-e610-4b10-a711-46023bb39779.glb',
  egg: 'https://static.seeles.ai/data/asset/export/09d07e2f-6072-49ff-b4e1-3561f31182f8/903003/threeJs_81d04c95-6fb5-4516-88ef-adade554866d.glb',
  hdri: 'https://static.seeles.ai/data/asset/export/e856ee99-abfc-4c63-b59f-59ee39eafca5/970280/hdri_2745431b-d81a-452f-8a5d-d6aab739e456.hdr',
  turf: 'https://static.seeles.ai/data/asset/export/17b6a54c-6b3a-4a14-867c-727eed7c42a4/939601/Color.jpg',
  bgm: 'https://static.seeles.ai/data/asset/export/dd23542f-b4d5-4e7d-983d-933de9880af5/174987/bgm_174987_3001386.mp3',
  kick: 'https://static.seeles.ai/data/asset/export/6b447eda-ea17-431e-a855-90e45c5c4251/156761/sfx_156761_3198427.mp3',
  coin: 'https://static.seeles.ai/data/asset/export/559db98f-02ae-4c77-b0a7-e294275e1eed/171977/sfx_171977_3199469.mp3',
  hatch: 'https://static.seeles.ai/data/asset/export/297082c2-e1ac-45da-9e30-5b49fca6047b/173719/sfx_173719_3201988.mp3',
  whistle: 'https://static.seeles.ai/data/asset/export/b79bbbd3-40d6-4353-8571-aec47a572f23/171907/sfx_171907_3199401.mp3'
};

export const FACING = { player: { controlFrame: 'camera-relative', gameplayForward: '+Z', visualForward: '+Z', visualPivotYaw: 0 } };

export const RECRUITS = [
  { id:'minty', name:'Minty', role:'MIDFIELDER', rarity:'COMMON', pace:6, power:5, flair:7, color:0x52d6a4, trait:'Mint Pass — passes travel 10% faster.' },
  { id:'crunch', name:'Crunch', role:'DEFENDER', rarity:'COMMON', pace:4, power:8, flair:4, color:0x6d9cff, trait:'Crunch Tackle — stronger pressure radius.' },
  { id:'zippy', name:'Zippy', role:'STRIKER', rarity:'COMMON', pace:8, power:5, flair:5, color:0xffc94a, trait:'Zip Shot — quicker shooting wind-up.' },
  { id:'bloop', name:'Bloop', role:'MIDFIELDER', rarity:'bloop', pace:7, power:6, flair:8, color:0x9b6cff, trait:'Bloop Curve — shots gain extra bend.' },
  { id:'bricko', name:'Bricko', role:'DEFENDER', rarity:'RARE', pace:5, power:9, flair:5, color:0xff626f, trait:'Brick Wall — blocks slow the ball.' },
  { id:'glimmer', name:'Glimmer', role:'STRIKER', rarity:'EPIC', pace:9, power:8, flair:9, color:0xff8cd9, trait:'Glimmer Finish — clean shots get a gold trail.' },
  { id:'voltano', name:'Voltano', role:'STRIKER', rarity:'LEGENDARY', pace:10, power:10, flair:10, color:0xff7a18, trait:'Voltage Finale — legendary shots blast forward with a blazing gold trail.' },
  { id:'bonko', name:'Bonko', role:'DEFENDER', rarity:'COMMON', pace:5, power:7, flair:4, color:0x7bb3ff, trait:'Bonk Block — headers send the ball twice as far.' },
  { id:'dripzy', name:'Dripzy', role:'MIDFIELDER', rarity:'RARE', pace:7, power:5, flair:8, color:0x00e5cc, trait:'Drip Pass — curved passes gain extra spin.' },
  { id:'pyro', name:'Pyro', role:'STRIKER', rarity:'EPIC', pace:8, power:7, flair:9, color:0xff4500, trait:'Pyro Burst — shots near goal ignite with a fiery trail.' },
  { id:'splonk', name:'Splonk', role:'MIDFIELDER', rarity:'COMMON', pace:6, power:6, flair:6, color:0xf0a040, trait:'Splonk Spin — midfield wobble fakes out defenders.' },
  { id:'frizz', name:'Frizz', role:'STRIKER', rarity:'RARE', pace:8, power:7, flair:7, color:0xff3399, trait:'Frizz Burst — shots crackle with electric energy.' } ,{ id:'driftwood', name:'Driftwood', rarity:'COMMON', role:'DEFENDER', pace:4, power:5, flair:8, color:0x8B6914, trait:'Solid as oak. Rarely loses a header.' },{ id:'voltrex', name:'Voltrex', rarity:'RARE', role:'MIDFIELDER', pace:7, power:6, flair:7, color:0x00CFFF, trait:'Charges through midfield like a lightning bolt.' },{ id:'phantara', name:'Phantara', rarity:'EPIC', role:'STRIKER', pace:8, power:7, flair:9, color:0xFF44AA, trait:'Appears from nowhere. Defenders never see her coming.' },{ id:'bananini', name:'Bananini', rarity:'LIMITED', role:'STRIKER', pace:8, power:8, flair:8, color:0xffd21f, trait:'Banana Power.' },{ id:'unknown', name:'???', rarity:'OG', role:'STRIKER', pace:99, power:99, flair:99, color:0xFFD700, trait:'No one knows where it came from. No one asks.' }
];

export const DEFAULT_PROFILE = { coins: 110, roster:['minty','crunch','zippy'], lineup:['minty','crunch','zippy'], wins:0, losses:0, roomHistory:[] };
