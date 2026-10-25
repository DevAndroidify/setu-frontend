// The mapping for the synthetic household register the backend's generator writes (a copy of
// test/fixtures/mappings/household-register.v1.json in the setu repo), offered as a start.
import type { MappingSpec } from './api';

export const HOUSEHOLD_REGISTER_TEMPLATE: MappingSpec = {
  fields: [
    {
      target: 'person.name_ne',
      from: ['NAAM'],
      transforms: [
        {
          name: 'preetiToUnicode',
        },
        {
          name: 'trim',
        },
      ],
      rules: ['required', 'maxLength:100'],
      onError: 'quarantine',
    },
    {
      target: 'person.name_en',
      from: ['NAAM_EN'],
      transforms: [
        {
          name: 'titleCase',
        },
      ],
      rules: ['required', 'maxLength:100'],
      onError: 'quarantine',
    },
    {
      target: 'person.gender',
      from: ['LINGA'],
      transforms: [
        {
          name: 'mapValues',
          args: {
            values: {
              M: 'male',
              Male: 'male',
              Purush: 'male',
              F: 'female',
              Female: 'female',
              Mahila: 'female',
            },
          },
        },
      ],
      rules: [],
      onError: 'quarantine',
    },
    {
      target: 'person.dob_ad',
      from: ['JANMA_MITI'],
      transforms: [
        {
          name: 'devanagariDigits',
        },
        {
          name: 'bsToAd',
          args: {
            formats: ['YYYY/M/D', 'YYYY-MM-DD', 'D/M/YYYY', 'YYYY.MM.DD'],
          },
        },
      ],
      rules: ['notFuture', 'after:1940-01-01'],
      onError: 'quarantine',
    },
    {
      target: 'person.citizenship_no',
      from: ['NAGARIKTA_NO'],
      transforms: [
        {
          name: 'trim',
        },
      ],
      rules: ['citizenshipFormat'],
      onError: 'quarantine',
    },
    {
      target: 'person.father_name_ne',
      from: ['BABU_NAAM'],
      transforms: [
        {
          name: 'preetiToUnicode',
        },
        {
          name: 'trim',
        },
      ],
      rules: [],
      onError: 'null',
    },
    {
      target: 'household.no',
      from: ['GHAR_NO'],
      transforms: [
        {
          name: 'devanagariDigits',
        },
        {
          name: 'trim',
        },
      ],
      rules: [],
      onError: 'quarantine',
    },
    {
      target: 'household.local_unit_code',
      from: ['JILLA', 'GABISA'],
      transforms: [
        {
          name: 'vdcToLocalUnit',
        },
      ],
      rules: ['required'],
      onError: 'quarantine',
    },
    {
      target: 'household.ward_no',
      from: ['WARD_NO'],
      transforms: [
        {
          name: 'devanagariDigits',
        },
        {
          name: 'trim',
        },
      ],
      rules: ['required', 'max:9', 'wardInUnit'],
      onError: 'quarantine',
    },
    {
      target: 'household.tole',
      from: ['TOLE'],
      transforms: [
        {
          name: 'trim',
        },
      ],
      rules: [],
      onError: 'null',
    },
  ],
};
