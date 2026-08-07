import * as migration_20260806_211140_initial from './20260806_211140_initial';
import * as migration_20260806_212710_data_model from './20260806_212710_data_model';
import * as migration_20260807_190436_discounts from './20260807_190436_discounts';

export const migrations = [
  {
    up: migration_20260806_211140_initial.up,
    down: migration_20260806_211140_initial.down,
    name: '20260806_211140_initial',
  },
  {
    up: migration_20260806_212710_data_model.up,
    down: migration_20260806_212710_data_model.down,
    name: '20260806_212710_data_model',
  },
  {
    up: migration_20260807_190436_discounts.up,
    down: migration_20260807_190436_discounts.down,
    name: '20260807_190436_discounts'
  },
];
