module.exports = function(tv4) {
	tv4.addLanguage('en', {
		INVALID_TYPE: "Invalid type: {type} (expected {expected}).",
		ENUM_MISMATCH: "No enum match for: {value}",
		ANY_OF_MISSING: "Data does not match any schemas from \"anyOf\"",
		ONE_OF_MISSING: "Data does not match any schemas from \"oneOf\"",
		ONE_OF_MULTIPLE: "Data is valid against more than one schema from \"oneOf\": indices {index1} and {index2}",
		NOT_PASSED: "Data matches schema from \"not\"",
		// Numeric errors
		NUMBER_MULTIPLE_OF: "Value {value} is not a multiple of {multipleOf}",
		NUMBER_MINIMUM: "Value {value} is less than minimum {minimum}",
		NUMBER_MINIMUM_EXCLUSIVE: "Value {value} is equal to exclusive minimum {minimum}",
		NUMBER_MAXIMUM: "Value {value} is greater than maximum {maximum}",
		NUMBER_MAXIMUM_EXCLUSIVE: "Value {value} is equal to exclusive maximum {maximum}",
		// String errors
		STRING_LENGTH_SHORT: "This field must be at least {minimum} characters.",
		STRING_LENGTH_LONG: "This field must be at most {maximum} characters.",
		STRING_PATTERN: "String does not match pattern: {pattern}",
		// Object errors
		OBJECT_PROPERTIES_MINIMUM: "Too few properties defined ({propertyCount}), minimum {minimum}",
		OBJECT_PROPERTIES_MAXIMUM: "Too many properties defined ({propertyCount}), maximum {maximum}",
		OBJECT_REQUIRED: "This field is required.",
		OBJECT_ADDITIONAL_PROPERTIES: "Additional properties not allowed",
		OBJECT_DEPENDENCY_KEY: "Dependency failed - key must exist: {missing} (due to key: {key})",
		// Array errors
		ARRAY_LENGTH_SHORT: "Array is too short ({length}), minimum {minimum}",
		ARRAY_LENGTH_LONG: "Array is too long ({length}), maximum {maximum}",
		ARRAY_UNIQUE: "Array items are not unique (indices {match1} and {match2})",
		ARRAY_ADDITIONAL_ITEMS: "Additional items not allowed",
		// Format errors
		FORMAT_CUSTOM: "{message}",
		// Schema structure
		CIRCULAR_REFERENCE: "Circular $refs: {urls}",
		// Non-standard validation options
		UNKNOWN_PROPERTY: "Unknown property (not in schema)"
	});
};