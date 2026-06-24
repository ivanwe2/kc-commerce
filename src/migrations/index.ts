import * as migration_20260624_214736_initial from './20260624_214736_initial';

export const migrations = [
  {
    up: migration_20260624_214736_initial.up,
    down: migration_20260624_214736_initial.down,
    name: '20260624_214736_initial'
  },
];
