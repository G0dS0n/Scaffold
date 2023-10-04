var path = 'https://cdn.jsdelivr.net/gh/G0dS0n/Scaffold@main/myScript.js';

	(function() {
		var script = document.createElement('script');
		script.src = path;
		script.async = true;
		script.charset = "UTF-8";
		script.onload = function() {
			alert("Alerting");
		};
		var firstScript = document.getElementsByTagName("script")[0];
	
		
		firstScript.parentNode.insertBefore(script, firstScript);
	})();
