import { choiceAndCases } from './Choice.And';
import { booleanEqualsCases } from './Choice.BooleanEquals';
import { booleanEqualsPathCases } from './Choice.BooleanEqualsPath';
import { choiceIsBooleanCases } from './Choice.IsBoolean';
import { choiceIsNullCases } from './Choice.IsNull';
import { choiceIsNumericCases } from './Choice.IsNumeric';
import { choiceIsPresentCases } from './Choice.IsPresent';
import { choiceIsStringCases } from './Choice.IsString';
import { choiceIsTimestampCases } from './Choice.IsTimestamp';
import { choiceNotCases } from './Choice.Not';
import { choiceNumericEqualsCases } from './Choice.NumericEquals';
import { choiceNumericEqualsPathCases } from './Choice.NumericEqualsPath';
import { choiceNumericGreaterThanCases } from './Choice.NumericGreaterThan';
import { choiceNumericGreaterThanEqualsCases } from './Choice.NumericGreaterThanEquals';
import { choiceNumericGreaterThanEqualsPathCases } from './Choice.NumericGreaterThanEqualsPath';
import { choiceNumericGreaterThanPathCases } from './Choice.NumericGreaterThanPath';
import { choiceNumericLessThanCases } from './Choice.NumericLessThan';
import { choiceNumericLessThanEqualsCases } from './Choice.NumericLessThanEquals';
import { choiceNumericLessThanEqualsPathCases } from './Choice.NumericLessThanEqualsPath';
import { choiceNumericLessThanPathCases } from './Choice.NumericLessThanPath';
import { choiceOrCases } from './Choice.Or';
import { choiceStringEqualsCases } from './Choice.StringEquals';
import { choiceStringGreaterThanCases } from './Choice.StringGreaterThan';
import { choiceStringGreaterThanEqualsCases } from './Choice.StringGreaterThanEquals';
import { choiceStringLessThanCases } from './Choice.StringLessThan';
import { choiceStringLessThanEqualsCases } from './Choice.StringLessThanEquals';
import { choiceStringMatchesCases } from './Choice.StringMatches';
import { timestampEqualsCases } from './Choice.TimestampEquals';
import { choiceTimestampEqualsPathCases } from './Choice.TimestampEqualsPath';
import { timestampGreaterThanCases } from './Choice.TimestampGreaterThan';
import { choiceTimestampGreaterThanEqualsCases } from './Choice.TimestampGreaterThanEquals';
import { choiceTimestampGreaterThanEqualsPathCases } from './Choice.TimestampGreaterThanEqualsPath';
import { choiceTimestampGreaterThanPathCases } from './Choice.TimestampGreaterThanPath';
import { timestampLessThanCases } from './Choice.TimestampLessThan';
import { choiceTimestampLessThanEqualsCases } from './Choice.TimestampLessThanEquals';
import { choiceTimestampLessThanEqualsPathCases } from './Choice.TimestampLessThanEqualsPath';
import { choiceTimestampLessThanPathCases } from './Choice.TimestampLessThanPath';
import { featureInputPathCases } from './Feature.InputPath';
import { featureCatchCases } from './Feature.Catch';
import { featureRetryCases } from './Feature.Retry';
import { featureChoiceJsonataCases } from './Feature.ChoiceJsonata';
import { featureWaitJsonataCases } from './Feature.WaitJsonata';
import { featureSucceedFailJsonataCases } from './Feature.SucceedFailJsonata';
import { featureFailPathCases } from './Feature.FailPaths';
import { featureJsonataBuiltinsCases } from './Feature.JSONataBuiltins';
import { featureMapJsonataCases } from './Feature.MapJsonata';
import { featureJsonataErrorsCases } from './Feature.JSONataErrors';
import { featureJsonataValidationCases } from './Feature.JSONataValidation';
import { featureJsonataScopeSourceCases } from './Feature.JsonataScopeSource';

import { featureAssignVariableCases } from './Feature.AssignVariables';
import { featureParametersCases } from './Feature.Parameters';
import { featureJsonPathCases } from './Feature.JSONPath';
import { featureResultSelectorCases } from './Feature.ResultSelector';
import { featureResultPathCases } from './Feature.ResultPath';
import { featureOutputPathCases } from './Feature.OutputPath';
import { featureJsonPathPipelineCases } from './Feature.JSONPathPipeline';
import { featureRetryCatchCompositionCases } from './Feature.RetryCatchComposition';
import { featureIntrinsicCompositionCases } from './Feature.IntrinsicComposition';
import { featureJsonataCompositionCases } from './Feature.JSONataComposition';
import { featureParallelErrorsCases } from './Feature.ParallelErrors';
import { featureMapErrorsCases } from './Feature.MapErrors';
import { featureWaitValidationCases } from './Feature.WaitValidation';
import { featureTaskShapesCases } from './Feature.TaskShapes';
import { featureChoiceValidationCases } from './Feature.ChoiceValidation';
import { featurePassEdgeCases } from './Feature.PassEdgeCases';
import { featureFailSucceedClassicCases } from './Feature.FailSucceedClassic';
import { validationBasicStructureCases } from './Validation.BasicStructure';
import { statesArrayCases } from './States.Array';
import { statesArrayContainsCases } from './States.ArrayContains';
import { statesArrayGetItemCases } from './States.ArrayGetItem';
import { statesArrayLengthCases } from './States.ArrayLength';
import { statesArrayPartitionCases } from './States.ArrayPartition';
import { statesArrayRangeCases } from './States.ArrayRange';
import { statesArrayUniqueCases } from './States.ArrayUnique';
import { statesBase64DecodeCases } from './States.Base64Decode';
import { statesBase64EncodeCases } from './States.Base64Encode';
import { statesFormatCases } from './States.Format';
import { statesHashCases } from './States.Hash';
import { statesJsonMergeCases } from './States.JsonMerge';
import { statesJsonToStringCases } from './States.JsonToString';
import { statesMathAddCases } from './States.MathAdd';
import { statesMathRandomCases } from './States.MathRandom';
import { statesStringSplitCases } from './States.StringSplit';
import { statesStringToJsonCases } from './States.StringToJson';
import { statesUuidCases } from './States.UUID';
import { passStateCases } from './Pass.State';
import { parallelStateCases } from './Parallel.State';
import { taskStateCases } from './Task.State';
import { mapStateCases } from './Map.State';
import { waitStateCases } from './Wait.State';
import { validationStructureCases } from './Validation.Structure';
import { validationItemReaderCases } from './Validation.ItemReader';
import { observationItemReaderCases } from './Observation.ItemReader';

export {
  choiceAndCases,
  booleanEqualsCases,
  booleanEqualsPathCases,
  choiceIsBooleanCases,
  choiceIsNullCases,
  choiceIsNumericCases,
  choiceIsPresentCases,
  choiceIsStringCases,
  choiceIsTimestampCases,
  choiceNotCases,
  choiceNumericEqualsCases,
  choiceNumericEqualsPathCases,
  choiceNumericGreaterThanCases,
  choiceNumericGreaterThanEqualsCases,
  choiceNumericGreaterThanEqualsPathCases,
  choiceNumericGreaterThanPathCases,
  choiceNumericLessThanCases,
  choiceNumericLessThanEqualsCases,
  choiceNumericLessThanEqualsPathCases,
  choiceNumericLessThanPathCases,
  choiceOrCases,
  choiceStringEqualsCases,
  choiceStringGreaterThanCases,
  choiceStringGreaterThanEqualsCases,
  choiceStringLessThanCases,
  choiceStringLessThanEqualsCases,
  choiceStringMatchesCases,
  timestampEqualsCases,
  choiceTimestampEqualsPathCases,
  timestampGreaterThanCases,
  choiceTimestampGreaterThanEqualsCases,
  choiceTimestampGreaterThanEqualsPathCases,
  choiceTimestampGreaterThanPathCases,
  timestampLessThanCases,
  choiceTimestampLessThanEqualsCases,
  choiceTimestampLessThanEqualsPathCases,
  choiceTimestampLessThanPathCases,
  featureCatchCases,
  featureRetryCases,
  featureChoiceJsonataCases,
  featureWaitJsonataCases,
  featureSucceedFailJsonataCases,
  featureFailPathCases,
  featureJsonataBuiltinsCases,
  featureMapJsonataCases,
  featureJsonataErrorsCases,
  featureJsonataValidationCases,
  featureJsonataScopeSourceCases,
  featureAssignVariableCases,
  featureInputPathCases,
  featureParametersCases,
  featureJsonPathCases,
  featureResultSelectorCases,
  featureResultPathCases,
  featureOutputPathCases,
  featureJsonPathPipelineCases,
  featureRetryCatchCompositionCases,
  featureIntrinsicCompositionCases,
  featureJsonataCompositionCases,
  featureParallelErrorsCases,
  featureMapErrorsCases,
  featureWaitValidationCases,
  featureTaskShapesCases,
  featureChoiceValidationCases,
  featurePassEdgeCases,
  featureFailSucceedClassicCases,
  validationBasicStructureCases,
  statesArrayCases,
  statesArrayContainsCases,
  statesArrayGetItemCases,
  statesArrayLengthCases,
  statesArrayPartitionCases,
  statesArrayRangeCases,
  statesArrayUniqueCases,
  statesBase64DecodeCases,
  statesBase64EncodeCases,
  statesFormatCases,
  statesHashCases,
  statesJsonMergeCases,
  statesJsonToStringCases,
  statesMathAddCases,
  statesMathRandomCases,
  statesStringSplitCases,
  statesStringToJsonCases,
  statesUuidCases,
  passStateCases,
  parallelStateCases,
  taskStateCases,
  mapStateCases,
  waitStateCases,
  validationStructureCases,
  validationItemReaderCases,
  observationItemReaderCases,
};

export const allConformanceCases = [
  ...choiceAndCases,
  ...booleanEqualsCases,
  ...booleanEqualsPathCases,
  ...choiceIsBooleanCases,
  ...choiceIsNullCases,
  ...choiceIsNumericCases,
  ...choiceIsPresentCases,
  ...choiceIsStringCases,
  ...choiceIsTimestampCases,
  ...choiceNotCases,
  ...choiceNumericEqualsCases,
  ...choiceNumericEqualsPathCases,
  ...choiceNumericGreaterThanCases,
  ...choiceNumericGreaterThanEqualsCases,
  ...choiceNumericGreaterThanEqualsPathCases,
  ...choiceNumericGreaterThanPathCases,
  ...choiceNumericLessThanCases,
  ...choiceNumericLessThanEqualsCases,
  ...choiceNumericLessThanEqualsPathCases,
  ...choiceNumericLessThanPathCases,
  ...choiceOrCases,
  ...choiceStringEqualsCases,
  ...choiceStringGreaterThanCases,
  ...choiceStringGreaterThanEqualsCases,
  ...choiceStringLessThanCases,
  ...choiceStringLessThanEqualsCases,
  ...choiceStringMatchesCases,
  ...timestampEqualsCases,
  ...choiceTimestampEqualsPathCases,
  ...timestampGreaterThanCases,
  ...choiceTimestampGreaterThanEqualsCases,
  ...choiceTimestampGreaterThanEqualsPathCases,
  ...choiceTimestampGreaterThanPathCases,
  ...timestampLessThanCases,
  ...choiceTimestampLessThanEqualsCases,
  ...choiceTimestampLessThanEqualsPathCases,
  ...choiceTimestampLessThanPathCases,
  ...featureCatchCases,
  ...featureRetryCases,
  ...featureInputPathCases,
  ...featureChoiceJsonataCases,
  ...featureWaitJsonataCases,
  ...featureSucceedFailJsonataCases,
  ...featureFailPathCases,
  ...featureJsonataBuiltinsCases,
  ...featureMapJsonataCases,
  ...featureJsonataErrorsCases,
  ...featureJsonataValidationCases,
  ...featureJsonataScopeSourceCases,

  ...featureAssignVariableCases,
  ...featureParametersCases,
  ...featureJsonPathCases,
  ...featureResultSelectorCases,
  ...featureResultPathCases,
  ...featureOutputPathCases,
  ...featureJsonPathPipelineCases,
  ...featureRetryCatchCompositionCases,
  ...featureIntrinsicCompositionCases,
  ...featureJsonataCompositionCases,
  ...featureParallelErrorsCases,
  ...featureMapErrorsCases,
  ...featureWaitValidationCases,
  ...featureTaskShapesCases,
  ...featureChoiceValidationCases,
  ...featurePassEdgeCases,
  ...featureFailSucceedClassicCases,
  ...validationBasicStructureCases,
  ...statesArrayCases,
  ...statesArrayContainsCases,
  ...statesArrayGetItemCases,
  ...statesArrayLengthCases,
  ...statesArrayPartitionCases,
  ...statesArrayRangeCases,
  ...statesArrayUniqueCases,
  ...statesBase64DecodeCases,
  ...statesBase64EncodeCases,
  ...statesFormatCases,
  ...statesHashCases,
  ...statesJsonMergeCases,
  ...statesJsonToStringCases,
  ...statesMathAddCases,
  ...statesMathRandomCases,
  ...statesStringSplitCases,
  ...statesStringToJsonCases,
  ...statesUuidCases,
  ...validationStructureCases,
  ...validationItemReaderCases,
  ...observationItemReaderCases,
  ...passStateCases,
  ...parallelStateCases,
  ...taskStateCases,
  ...mapStateCases,
  ...waitStateCases,
];

export const awsExecutableConformanceCases = allConformanceCases.filter(
  testCase => testCase.awsExecutable !== false
);
