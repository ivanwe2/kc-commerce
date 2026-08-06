import * as migration_20260806_211140_initial from './20260806_211140_initial';

export const migrations = [
  {
    up: migration_20260806_211140_initial.up,
    down: migration_20260806_211140_initial.down,
    name: '20260806_211140_initial'
  },
];
