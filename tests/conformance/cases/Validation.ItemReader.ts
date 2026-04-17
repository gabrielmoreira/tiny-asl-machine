import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Validation.ItemReader';

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectFailureCode(code: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(code);
    expect(result.cause).toEqual(expect.any(String));
  };
}

function buildDistributedMapWithItemReader(
  itemReader: Record<string, unknown>
): ConformanceCase['definition'] {
  return {
    StartAt: 'ReadItems',
    States: {
      ReadItems: {
        Type: 'Map',
        ItemReader: itemReader,
        ItemProcessor: {
          ProcessorConfig: {
            Mode: 'DISTRIBUTED',
            ExecutionType: 'STANDARD',
          },
          StartAt: 'Echo',
          States: {
            Echo: {
              Type: 'Pass',
              End: true,
            },
          },
        },
        End: true,
      },
    },
  } as unknown as ConformanceCase['definition'];
}

export const validationItemReaderCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-s3-inventory-must-not-specify-inputtype',
    title: 'fails validation when ManifestType S3_INVENTORY is combined with InputType',
    group,
    tags: ['validation', 'itemreader', 's3_inventory', 'manifest_type'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        ManifestType: 'S3_INVENTORY',
        InputType: 'CSV',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'inventory/manifest.json',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '002-load-and-flatten-requires-inputtype',
    title: 'fails validation when LOAD_AND_FLATTEN is set without InputType',
    group,
    tags: ['validation', 'itemreader', 'load_and_flatten', 'inputtype'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:listObjectsV2',
      ReaderConfig: {
        Transformation: 'LOAD_AND_FLATTEN',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Prefix: 'dataset/',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '003-itemspointer-requires-json-inputtype',
    title: 'fails validation when ItemsPointer is used with non-JSON InputType',
    group,
    tags: ['validation', 'itemreader', 'itemspointer', 'inputtype'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'CSV',
        ItemsPointer: '/data/items',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.csv',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '004-itemspointer-must-be-valid-json-pointer',
    title: 'fails validation when ItemsPointer is not a valid JSONPointer string',
    group,
    tags: ['validation', 'itemreader', 'itemspointer', 'jsonpointer'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'JSON',
        ItemsPointer: 'data/items',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.json',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '005-csv-header-location-must-match-supported-inputtypes',
    title: 'fails validation when CSVHeaderLocation is used with JSON input',
    group,
    tags: ['validation', 'itemreader', 'csv_header_location', 'inputtype'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'JSON',
        CSVHeaderLocation: 'FIRST_ROW',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.json',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '006-parquet-versionid-is-unsupported',
    title: 'fails validation when PARQUET ItemReader specifies VersionId',
    group,
    tags: ['validation', 'itemreader', 'parquet', 'versionid'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'PARQUET',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.parquet',
        VersionId: 'example-version-id',
      },
    }),
    input: {},
    expected: expectFailureCode('States.ItemReaderFailed'),
  }),
  customDefinitionCase({
    id: '007-athena-manifest-requires-supported-inputtype',
    title: 'fails validation when ATHENA_DATA manifest uses unsupported InputType JSON',
    group,
    tags: ['validation', 'itemreader', 'manifest', 'athena'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        ManifestType: 'ATHENA_DATA',
        InputType: 'JSON',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'athena/query-manifest.csv',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '008-csv-given-requires-csvheaders',
    title: 'fails validation when CSVHeaderLocation GIVEN is used without CSVHeaders',
    group,
    tags: ['validation', 'itemreader', 'csv', 'given_headers'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'CSV',
        CSVHeaderLocation: 'GIVEN',
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.csv',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '009-csvheaders-must-not-be-used-with-jsonl',
    title: 'fails validation when CSVHeaders are provided for JSONL input',
    group,
    tags: ['validation', 'itemreader', 'csvheaders', 'jsonl'],
    definition: buildDistributedMapWithItemReader({
      Resource: 'arn:aws:states:::s3:getObject',
      ReaderConfig: {
        InputType: 'JSONL',
        CSVHeaderLocation: 'GIVEN',
        CSVHeaders: ['id'],
      },
      Parameters: {
        Bucket: 'amzn-s3-demo-bucket',
        Key: 'dataset/file.jsonl',
      },
    }),
    input: {},
    localExecutable: false,
    expected: expectValidationFailure(),
  }),
];
