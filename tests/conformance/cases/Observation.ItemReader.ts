import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Observation.ItemReader';
const itemReaderArtifacts = getDeploymentConfig().deploymentConfig?.artifacts?.itemReader;
const itemReaderBucket = itemReaderArtifacts?.bucketName ?? 'missing-itemreader-bucket';
const jsonItemsPointerKey =
  itemReaderArtifacts?.jsonItemsPointerKey ?? 'missing-itemreader-json-key';
const listNonePrefix = itemReaderArtifacts?.listNonePrefix ?? 'missing-itemreader-list-prefix/';
const loadAndFlattenPrefix =
  itemReaderArtifacts?.loadAndFlattenPrefix ?? 'missing-itemreader-load-and-flatten-prefix/';
const s3GetObjectResource = 'arn:aws:states:::s3:getObject';
const s3ListObjectsV2Resource = 'arn:aws:states:::s3:listObjectsV2';
const csvFirstRowKey =
  itemReaderArtifacts?.csvFirstRowKey ?? 'missing-itemreader-csv-first-row-key';
const csvPipeKey = itemReaderArtifacts?.csvPipeKey ?? 'missing-itemreader-csv-pipe-key';
const csvGivenKey = itemReaderArtifacts?.csvGivenKey ?? 'missing-itemreader-csv-given-key';
const jsonlKey = itemReaderArtifacts?.jsonlKey ?? 'missing-itemreader-jsonl-key';

function buildLocalItemReaderResources(): Record<string, (payload: unknown) => unknown> {
  return {
    [s3GetObjectResource]: payload => {
      const key =
        payload &&
        typeof payload === 'object' &&
        'Key' in payload &&
        typeof payload.Key === 'string'
          ? payload.Key
          : undefined;

      if (key === jsonItemsPointerKey) {
        return { Body: JSON.stringify({ data: { items: [{ id: 'a' }, { id: 'b' }] } }) };
      }

      if (key === `${loadAndFlattenPrefix}one.json`) {
        return { Body: JSON.stringify([{ id: 'one-a' }, { id: 'one-b' }]) };
      }

      if (key === `${loadAndFlattenPrefix}two.json`) {
        return { Body: JSON.stringify([{ id: 'two-a' }]) };
      }

      if (key === csvFirstRowKey) {
        return { Body: ['id,name', '1,Alice', '2,Bob', '3,Carol'].join('\n') };
      }

      if (key === csvPipeKey) {
        return { Body: ['id|name', '1|Alice', '2|Bob'].join('\n') };
      }
      if (key === csvGivenKey) {
        return { Body: ['1,Alice', '2,Bob'].join('\n') };
      }

      if (key === jsonlKey) {
        return { Body: ['{"id":"x"}', '{"id":"y"}'].join('\n') };
      }

      throw new Error(`Unknown local s3:getObject key: ${String(key)}`);
    },
    [s3ListObjectsV2Resource]: payload => {
      const prefix =
        payload &&
        typeof payload === 'object' &&
        'Prefix' in payload &&
        typeof payload.Prefix === 'string'
          ? payload.Prefix
          : undefined;

      if (prefix === listNonePrefix) {
        return {
          Contents: [{ Key: `${listNonePrefix}a.json` }, { Key: `${listNonePrefix}b.json` }],
        };
      }

      if (prefix === loadAndFlattenPrefix) {
        return {
          Contents: [
            { Key: `${loadAndFlattenPrefix}one.json` },
            { Key: `${loadAndFlattenPrefix}two.json` },
          ],
        };
      }

      throw new Error(`Unknown local s3:listObjectsV2 prefix: ${String(prefix)}`);
    },
  };
}

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectOutputSatisfying(check: (output: unknown) => void): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    check(result.output);
  };
}

export const observationItemReaderCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-json-itemspointer-extracts-nested-items',
    title: 'ItemReader JSON + ItemsPointer extracts the nested array items from S3 JSON input',
    group,
    tags: ['observation', 'itemreader', 'json', 'itemspointer', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'JSON',
              ItemsPointer: '/data/items',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: jsonItemsPointerKey,
            },
          },
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
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([{ id: 'a' }, { id: 'b' }]),
  }),
  customDefinitionCase({
    id: '002-listobjectsv2-none-emits-metadata-and-bucket-source',
    title:
      'ItemReader ListObjectsV2 with Transformation NONE emits metadata items and bucket-level source',
    group,
    tags: ['observation', 'itemreader', 'listobjectsv2', 'source', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3ListObjectsV2Resource,
            ReaderConfig: {
              Transformation: 'NONE',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Prefix: listNonePrefix,
            },
          },
          ItemSelector: {
            'Source.$': '$$.Map.Item.Source',
            'Key.$': '$$.Map.Item.Value.Key',
          },
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
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutputSatisfying(output => {
      expect(Array.isArray(output)).toBe(true);
      const items = output as Array<{ Source: string; Key: string }>;
      expect(items).toHaveLength(2);
      expect(items.every(item => item.Source === `s3://${itemReaderBucket}`)).toBe(true);
      expect(items.map(item => item.Key).sort()).toStrictEqual([
        `${listNonePrefix}a.json`,
        `${listNonePrefix}b.json`,
      ]);
    }),
  }),
  customDefinitionCase({
    id: '003-listobjectsv2-load-and-flatten-materializes-json-records',
    title:
      'ItemReader ListObjectsV2 with LOAD_AND_FLATTEN materializes JSON records with object-level source',
    group,
    tags: ['observation', 'itemreader', 'load_and_flatten', 'source', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3ListObjectsV2Resource,
            ReaderConfig: {
              InputType: 'JSON',
              Transformation: 'LOAD_AND_FLATTEN',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Prefix: loadAndFlattenPrefix,
            },
          },
          ItemSelector: {
            'Source.$': '$$.Map.Item.Source',
            'Value.$': '$$.Map.Item.Value',
          },
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
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutputSatisfying(output => {
      expect(Array.isArray(output)).toBe(true);
      const items = output as Array<{ Source: string; Value: { id: string } }>;
      expect(items).toHaveLength(3);
      expect(items.map(item => item.Value.id).sort()).toStrictEqual(['one-a', 'one-b', 'two-a']);
      expect(items.every(item => item.Source.startsWith(`s3://${itemReaderBucket}/`))).toBe(true);
    }),
  }),
  customDefinitionCase({
    id: '004-json-itemspointer-maxitems-limits-materialized-items',
    title: 'ItemReader JSON + ItemsPointer respects MaxItems when materializing nested items',
    group,
    tags: ['observation', 'itemreader', 'json', 'itemspointer', 'maxitems', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'JSON',
              ItemsPointer: '/data/items',
              MaxItems: 1,
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: jsonItemsPointerKey,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([{ id: 'a' }]),
  }),
  customDefinitionCase({
    id: '005-csv-first-row-materializes-string-records',
    title: 'ItemReader CSV with FIRST_ROW header materializes row objects with string values',
    group,
    tags: ['observation', 'itemreader', 'csv', 'first_row', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'CSV',
              CSVHeaderLocation: 'FIRST_ROW',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: csvFirstRowKey,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' },
    ]),
  }),
  customDefinitionCase({
    id: '006-csv-pipe-delimiter-materializes-string-records',
    title: 'ItemReader CSV with PIPE delimiter materializes row objects with string values',
    group,
    tags: ['observation', 'itemreader', 'csv', 'delimiter', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'CSV',
              CSVHeaderLocation: 'FIRST_ROW',
              CSVDelimiter: 'PIPE',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: csvPipeKey,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]),
  }),
  customDefinitionCase({
    id: '007-csv-given-headers-materializes-string-records',
    title: 'ItemReader CSV with GIVEN headers materializes row objects using CSVHeaders',
    group,
    tags: ['observation', 'itemreader', 'csv', 'given_headers', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'CSV',
              CSVHeaderLocation: 'GIVEN',
              CSVHeaders: ['id', 'name'],
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: csvGivenKey,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]),
  }),
  customDefinitionCase({
    id: '008-jsonl-materializes-line-delimited-records',
    title: 'ItemReader JSONL materializes one item per non-empty line',
    group,
    tags: ['observation', 'itemreader', 'jsonl', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'JSONL',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: jsonlKey,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    setupLocalResources: buildLocalItemReaderResources,
    expected: expectOutput([{ id: 'x' }, { id: 'y' }]),
  }),
  customDefinitionCase({
    id: '009-parquet-getobject-remains-aws-only-locally',
    title: 'ItemReader PARQUET via S3 getObject remains AWS-only in the local runner',
    group,
    tags: ['observation', 'itemreader', 'parquet', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3GetObjectResource,
            ReaderConfig: {
              InputType: 'PARQUET',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Key: 'dataset/file.parquet',
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    awsExecutable: false,
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toBe('Local ItemReader does not support PARQUET input.');
    },
    notes:
      'Kept as an explicit local limitation because the repo currently has no Parquet decoder dependency or fixture generation pipeline.',
  }),
  customDefinitionCase({
    id: '010-parquet-load-and-flatten-remains-aws-only-locally',
    title: 'ItemReader PARQUET with LOAD_AND_FLATTEN remains AWS-only in the local runner',
    group,
    tags: ['observation', 'itemreader', 'parquet', 'load_and_flatten', 'aws_only'],
    definition: {
      StartAt: 'ReadItems',
      States: {
        ReadItems: {
          Type: 'Map',
          ItemReader: {
            Resource: s3ListObjectsV2Resource,
            ReaderConfig: {
              InputType: 'PARQUET',
              Transformation: 'LOAD_AND_FLATTEN',
            },
            Parameters: {
              Bucket: itemReaderBucket,
              Prefix: loadAndFlattenPrefix,
            },
          },
          ItemProcessor: {
            ProcessorConfig: {
              Mode: 'DISTRIBUTED',
              ExecutionType: 'STANDARD',
            },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    localExecutable: true,
    awsExecutable: false,
    setupLocalResources: buildLocalItemReaderResources,
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toBe('Local ItemReader does not support PARQUET input.');
    },
    notes:
      'Useful as a guardrail until a real Parquet reader exists; AWS behavior around row-group and footer handling should be verified in the AWS runner instead of guessed locally.',
  }),
];
