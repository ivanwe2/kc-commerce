import * as migration_20260806_211140_initial from './20260806_211140_initial';
import * as migration_20260806_212710_data_model from './20260806_212710_data_model';

export const migrations = [
  {
    up: migration_20260806_211140_initial.up,
    down: migration_20260806_211140_initial.down,
    name: '20260806_211140_initial',
  },
  {
    up: migration_20260806_212710_data_model.up,
    down: migration_20260806_212710_data_model.down,
    name: '20260806_212710_data_model'
  },
];
