import * as migration_20260806_211140_initial from './20260806_211140_initial';
import * as migration_20260806_212710_data_model from './20260806_212710_data_model';
import * as migration_20260807_190436_discounts from './20260807_190436_discounts';
import * as migration_20260807_191424_brands from './20260807_191424_brands';
import * as migration_20260807_192440_merchandising from './20260807_192440_merchandising';
import * as migration_20260807_195623_accounts from './20260807_195623_accounts';
import * as migration_20260807_200000_search_index from './20260807_200000_search_index';
import * as migration_20260807_200329_growth from './20260807_200329_growth';
import * as migration_20260808_110135_stock_restored from './20260808_110135_stock_restored';
import * as migration_20260808_111444_stock_ledger from './20260808_111444_stock_ledger';
import * as migration_20260808_112754_returns from './20260808_112754_returns';

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
    name: '20260807_190436_discounts',
  },
  {
    up: migration_20260807_191424_brands.up,
    down: migration_20260807_191424_brands.down,
    name: '20260807_191424_brands',
  },
  {
    up: migration_20260807_192440_merchandising.up,
    down: migration_20260807_192440_merchandising.down,
    name: '20260807_192440_merchandising',
  },
  {
    up: migration_20260807_195623_accounts.up,
    down: migration_20260807_195623_accounts.down,
    name: '20260807_195623_accounts',
  },
  {
    up: migration_20260807_200000_search_index.up,
    down: migration_20260807_200000_search_index.down,
    name: '20260807_200000_search_index',
  },
  {
    up: migration_20260807_200329_growth.up,
    down: migration_20260807_200329_growth.down,
    name: '20260807_200329_growth',
  },
  {
    up: migration_20260808_110135_stock_restored.up,
    down: migration_20260808_110135_stock_restored.down,
    name: '20260808_110135_stock_restored',
  },
  {
    up: migration_20260808_111444_stock_ledger.up,
    down: migration_20260808_111444_stock_ledger.down,
    name: '20260808_111444_stock_ledger',
  },
  {
    up: migration_20260808_112754_returns.up,
    down: migration_20260808_112754_returns.down,
    name: '20260808_112754_returns'
  },
];
