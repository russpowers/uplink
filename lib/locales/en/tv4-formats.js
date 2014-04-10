module.exports = function(tv4) {

	tv4.addFormat('date', function (data, schema) {
		console.log(data)
    	if (typeof data === 'string' && /^[0-9][0-9]?\/[0-9][0-9]?\/[0-9][0-9](?:[0-9][0-9])?$/.test(data)) {
     	  return null;
    	}
    	return "Must be a date MM/DD/YY or MM/DD/YYYY.";
	});
	
};